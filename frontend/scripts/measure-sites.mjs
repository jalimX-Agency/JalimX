/**
 * What the delivered work actually measures.
 *
 * /approach claims the sites we build are fast. That claim is checkable by
 * anyone with a browser, so it had better be checkable by us first. This loads
 * each live site on a phone profile and reports the numbers a visitor pays for:
 * bytes over the wire, request count, third-party hosts, and LCP.
 *
 * Written because the PageSpeed Insights API is rate-limited without a key and
 * silently returns a quota error instead of data — which is a poor foundation
 * for a claim on a public page.
 *
 *   pnpm measure
 *   pnpm measure -- https://example.com
 */

import { chromium, devices } from "playwright";

const LIVE = [
  "https://familiestours.com",
  "https://arabiandeserthome.ma",
  "https://globaleexploretours.com",
];

const LOCAL = process.env.PREVIEW_URL ?? "http://localhost:3200";

const args = process.argv.slice(2).filter((a) => a.startsWith("http"));
const targets = args.length ? args : [...LIVE, `${LOCAL}/approach`];

const browser = await chromium.launch();

for (const url of targets) {
  // A phone profile, because that is what most of these visitors are on and it
  // is the profile the numbers are worst on.
  const context = await browser.newContext({ ...devices["iPhone 13"] });
  const page = await context.newPage();

  let bytes = 0;
  let requests = 0;
  const thirdParty = new Set();
  const host = new URL(url).host;

  page.on("response", (response) => {
    requests++;
    /*
     * content-length only. Reading the body to get a true transfer size means
     * buffering every asset on the page, which on a 20MB site takes long enough
     * to change the timings this script exists to report. Anything served
     * chunked is undercounted, so treat these as a floor.
     */
    const declared = response.headers()["content-length"];
    if (declared) bytes += Number(declared);

    try {
      const from = new URL(response.url()).host;
      if (from !== host && !from.startsWith("localhost")) thirdParty.add(from);
    } catch {
      // Data and blob URLs have no host; they are not third parties.
    }
  });

  try {
    const started = Date.now();
    await page.goto(url, { waitUntil: "load", timeout: 60_000 });
    const load = Date.now() - started;

    // Let late images settle; LCP can still move after `load`.
    await page.waitForTimeout(2500);

    const lcp = await page.evaluate(
      () =>
        new Promise((resolve) => {
          let latest = 0;
          try {
            new PerformanceObserver((list) => {
              for (const entry of list.getEntries()) latest = entry.startTime;
            }).observe({
              type: "largest-contentful-paint",
              buffered: true,
            });
          } catch {
            // Not supported in this engine; report zero rather than guessing.
          }
          setTimeout(() => resolve(Math.round(latest)), 600);
        }),
    );

    console.log(url);
    console.log(
      `   ${(bytes / 1024).toFixed(0)} KB · ${requests} requests · ` +
        `${thirdParty.size} third-party hosts · LCP ${lcp}ms · load ${load}ms`,
    );
    if (thirdParty.size) {
      console.log(`   third-party: ${[...thirdParty].slice(0, 8).join(", ")}`);
    }
  } catch (error) {
    console.log(`${url}\n   FAILED — ${error.message.split("\n")[0]}`);
  } finally {
    await context.close();
  }
}

await browser.close();
