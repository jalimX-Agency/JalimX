/**
 * Captures screenshots of the live client sites for the work section.
 *
 * We show pictures rather than embedding the real sites: five iframes would
 * make this the slowest page we ship, most sites refuse framing outright, and a
 * client redesign would silently break the portfolio. A screenshot plus a link
 * to the live site gives the same proof at none of that cost.
 *
 *   pnpm capture:work            all sites
 *   pnpm capture:work -- globale  just the ones whose slug matches
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { chromium, devices } from "playwright";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "public", "work");

/** Slugs match the `projects` table so the frontend can find images by slug. */
const SITES = [
  { slug: "globale-explore-tours", url: "https://www.globaleexploretours.com/fr" },
  { slug: "arabian-desert-home", url: "https://www.arabiandeserthome.ma/" },
  { slug: "families-tours", url: "https://www.familiestours.com/en" },
];

const VIEWPORTS = [
  // 1.5x is enough for a card that renders around 800px wide on a retina
  // screen; 2x just doubled the bytes for pixels nothing ever shows.
  { name: "desktop", width: 1440, height: 900, deviceScaleFactor: 1.5 },
  { name: "mobile", ...devices["iPhone 13"] },
  /*
   * The whole page in one tall image, so the work section can scroll a site
   * inside a frame rather than showing a single frozen fold. 1x here: these
   * run to several thousand pixels and a retina copy of that is megabytes for
   * detail nobody reads at the size it renders.
   */
  { name: "full", width: 1440, height: 900, deviceScaleFactor: 1, full: true },
];

/**
 * Floating chat bubbles sit in the corner of nearly every hospitality site and
 * look like part of our screenshot rather than part of theirs. Hidden rather
 * than clicked — clicking one opens a panel over the page.
 */
const HIDE = [
  // Class and id names vary per site; the destination does not. Matching on
  // href catches the WhatsApp bubble whatever the markup around it is called.
  "a[href*='wa.me']",
  "a[href*='api.whatsapp.com']",
  "a[href*='web.whatsapp.com']",
  "[class*='whatsapp' i]",
  "[id*='whatsapp' i]",
  "[class*='chat-widget' i]",
  "[class*='crisp-client']",
  "[id*='tawk']",
  "[class*='intercom']",
  "iframe[title*='chat' i]",
];

/**
 * Cookie banners and newsletter popups sit over the hero on most sites and
 * would be the first thing in every screenshot. Try to dismiss, never fail on
 * it — a banner is a worse screenshot, not a broken run.
 */
const DISMISS = [
  "button:has-text('Accept')",
  "button:has-text('Accepter')",
  "button:has-text('Tout accepter')",
  "button:has-text('J\\'accepte')",
  "button:has-text('Got it')",
  "button:has-text('OK')",
  "[aria-label='Close']",
  ".cookie button",
  "#onetrust-accept-btn-handler",
];

async function dismissOverlays(page) {
  for (const selector of DISMISS) {
    try {
      const el = page.locator(selector).first();
      if (await el.isVisible({ timeout: 400 })) {
        await el.click({ timeout: 1000 });
        await page.waitForTimeout(400);
      }
    } catch {
      // selector absent or not clickable — expected for most of them
    }
  }
}

async function capture(browser, site, viewport) {
  // `full` is ours, not Playwright's — it would be an unknown context option.
  const { full = false, name: _name, ...contextOptions } = viewport;

  const context = await browser.newContext({
    ...contextOptions,
    // Some hosts serve a stripped page to unknown agents.
    userAgent:
      viewport.userAgent ??
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
        "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    locale: "en-GB",
  });

  const page = await context.newPage();
  const label = `${site.slug} · ${viewport.name}`;

  try {
    await page.goto(site.url, { waitUntil: "domcontentloaded", timeout: 45_000 });

    // `networkidle` never settles on sites with polling or chat widgets, so
    // wait for the fonts and give lazy hero media a moment instead.
    await page.evaluate(() => document.fonts?.ready).catch(() => {});
    await page.waitForTimeout(2500);

    await dismissOverlays(page);

    await page.evaluate(() => window.scrollTo(0, 0));

    /*
     * Most of these sites reveal their hero copy on load. Screenshotting too
     * early catches a paragraph at half opacity, which reads as a rendering
     * bug rather than as their design.
     */
    await page.waitForTimeout(2000);

    /*
     * Hidden here rather than earlier: these widgets are injected by
     * third-party scripts that often land several seconds in, so anything
     * hidden before the settle wait simply reappears in time for the shot.
     */
    await page.evaluate((selectors) => {
      const hide = (el) => el.style.setProperty("display", "none", "important");

      // 1. Known third-party widgets, by name.
      for (const selector of selectors) {
        for (const el of document.querySelectorAll(selector)) {
          let node = el;
          for (let i = 0; i < 3 && node?.parentElement; i++) {
            if (["fixed", "sticky"].includes(getComputedStyle(node).position)) break;
            node = node.parentElement;
          }
          hide(node ?? el);
        }
      }

      /*
       * 2. Anything else pinned to a bottom corner.
       *
       * Naming is useless here: the button on one of these sites is a plain
       * `fixed bottom-6 right-6` div with a chat icon and no identifying class
       * at all. What every floating widget *does* share is the behaviour — a
       * small fixed box in a bottom corner. Bounded by size so a fixed header,
       * a nav drawer or a full-screen overlay is never caught.
       */
      const vw = window.innerWidth;
      const vh = window.innerHeight;

      for (const el of document.body.querySelectorAll("*")) {
        const style = getComputedStyle(el);
        if (style.position !== "fixed") continue;

        const box = el.getBoundingClientRect();
        if (box.width === 0 || box.height === 0) continue;

        const small = box.width < vw * 0.25 && box.height < vh * 0.25;
        const lowDown = box.top > vh * 0.55;
        const atEdge = box.left > vw * 0.6 || box.right < vw * 0.4;

        if (small && lowDown && atEdge) hide(el);
      }
    }, HIDE);

    /*
     * A full-page shot photographs lazy images as empty boxes unless something
     * has scrolled past them first. Walk the page, then come back to the top so
     * the capture starts where the visitor would.
     */
    if (full) {
      await page.evaluate(async () => {
        const step = window.innerHeight;
        for (let y = 0; y < document.body.scrollHeight; y += step) {
          window.scrollTo(0, y);
          await new Promise((r) => setTimeout(r, 260));
        }
        window.scrollTo(0, 0);
      });
      await page.waitForTimeout(1200);
    }

    await page.waitForTimeout(250);

    /*
     * JPEG, not PNG. A full-bleed photographic hero as PNG lands around 3 MB;
     * the same frame at quality 86 is under a tenth of that with no visible
     * difference at card size. next/image re-encodes to WebP or AVIF on the way
     * out anyway, so the only thing PNG would buy us is a heavier repo.
     */
    const file = path.join(OUT, `${site.slug}-${viewport.name}.jpg`);
    await page.screenshot({
      path: file,
      type: "jpeg",
      quality: full ? 78 : 86,
      fullPage: full,
    });

    /*
     * The capture's own pixel size travels with it. The work index scrolls a
     * tall page inside a short frame and needs the real dimensions to know how
     * far to travel; reading them back off the file at request time would mean
     * decoding a JPEG header on the server for every render.
     */
    const shape = await page.evaluate(() => ({
      width: document.documentElement.clientWidth,
      height: Math.max(document.body.scrollHeight, window.innerHeight),
    }));
    const scale = viewport.deviceScaleFactor ?? 1;

    console.log(`  ok      ${label}`);
    return {
      ...site,
      viewport: viewport.name,
      file,
      ok: true,
      width: Math.round((full ? shape.width : viewport.width ?? shape.width) * scale),
      height: Math.round((full ? shape.height : viewport.height ?? shape.height) * scale),
    };
  } catch (error) {
    console.log(`  FAILED  ${label} — ${error.message.split("\n")[0]}`);
    return { ...site, viewport: viewport.name, ok: false };
  } finally {
    await context.close();
  }
}

const filter = process.argv.slice(2).filter((a) => !a.startsWith("-"));
const targets = filter.length
  ? SITES.filter((s) => filter.some((f) => s.slug.includes(f)))
  : SITES;

if (targets.length === 0) {
  console.error("No sites matched. Known slugs:", SITES.map((s) => s.slug).join(", "));
  process.exit(1);
}

await mkdir(OUT, { recursive: true });
console.log(`capturing ${targets.length} site(s) → public/work/\n`);

const browser = await chromium.launch();
const results = [];

for (const site of targets) {
  for (const viewport of VIEWPORTS) {
    results.push(await capture(browser, site, viewport));
  }
}

await browser.close();

/*
 * A manifest so the frontend knows which shots exist without guessing at paths.
 *
 * Merged into whatever is already there rather than replacing it: a filtered
 * run (`-- families`) would otherwise drop every other site from the manifest
 * and quietly empty the work section, while the image files sat on disk
 * perfectly intact.
 */
const manifestPath = path.join(OUT, "manifest.json");

let existing = [];
try {
  existing = JSON.parse(await readFile(manifestPath, "utf8")).shots ?? [];
} catch {
  // first run
}

const bySrc = new Map(existing.map((shot) => [shot.src, shot]));

for (const r of results.filter((r) => r.ok)) {
  const src = `/work/${r.slug}-${r.viewport}.jpg`;
  bySrc.set(src, {
    slug: r.slug,
    viewport: r.viewport,
    url: r.url,
    src,
    width: r.width,
    height: r.height,
  });
}

await writeFile(
  manifestPath,
  JSON.stringify(
    {
      captured_at: new Date().toISOString(),
      shots: [...bySrc.values()].sort((a, b) =>
        `${a.slug}${a.viewport}`.localeCompare(`${b.slug}${b.viewport}`)
      ),
    },
    null,
    2
  ) + "\n"
);

const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} captured`);
if (failed) process.exitCode = 1;
