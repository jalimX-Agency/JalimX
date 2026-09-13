/**
 * First-viewport screenshots, with a check on where the call to action lands.
 *
 * `pnpm shot` captures the whole column, which is right for reviewing a page's
 * rhythm and wrong for the one question a hero has to answer: on a short laptop
 * screen, is the button still on screen? A full-page image hides exactly that,
 * and a hero that pushes its CTA past the fold looks fine in every screenshot
 * and fails for the visitor.
 *
 *   pnpm fold                 homepage
 *   pnpm fold -- /approach
 */

import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { chromium, devices } from "playwright";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, ".shots");
const BASE = process.env.PREVIEW_URL ?? "http://localhost:3200";

const routes = process.argv.slice(2).filter((a) => a.startsWith("/"));
const targets = routes.length ? routes : ["/"];

const VIEWPORTS = [
  ["desktop", { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 }],
  // The one that catches overgrown heroes: a 13" laptop with browser chrome.
  ["laptop", { viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 }],
  // Exactly Tailwind's `lg`: the narrowest width that gets the desktop layout,
  // so it is where a two-column composition first runs out of room.
  ["narrow", { viewport: { width: 1024, height: 768 }, deviceScaleFactor: 1 }],
  ["mobile", devices["iPhone 13"]],
];

await mkdir(OUT, { recursive: true });

const browser = await chromium.launch();

for (const route of targets) {
  for (const [name, config] of VIEWPORTS) {
    const context = await browser.newContext(config);
    const page = await context.newPage();
    const slug = route === "/" ? "home" : route.replace(/\//g, "-").slice(1);

    try {
      await page.goto(`${BASE}${route}`, {
        waitUntil: "domcontentloaded",
        timeout: 60_000,
      });
      await page.evaluate(() => document.fonts?.ready).catch(() => {});
      // Long enough for the mark to finish drawing and the copy to settle.
      await page.waitForTimeout(3000);

      const cta = await page.evaluate(() => {
        // The hero's own button, not the header's — they share an href.
        const el =
          document.querySelector("[data-hero-cta]") ??
          document.querySelector('main a[href$="/contact"]');
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { bottom: Math.round(r.bottom), vh: window.innerHeight };
      });

      await page.screenshot({
        path: path.join(OUT, `${slug}-fold-${name}.png`),
        type: "png",
      });

      const verdict = !cta
        ? "no CTA found"
        : cta.bottom > cta.vh
          ? `CTA ${cta.bottom}px / ${cta.vh}px  <-- BELOW THE FOLD`
          : `CTA ${cta.bottom}px / ${cta.vh}px`;
      console.log(`  ${slug} · ${name}  ${verdict}`);
    } catch (error) {
      console.log(`  FAILED ${slug} · ${name} — ${error.message.split("\n")[0]}`);
    } finally {
      await context.close();
    }
  }
}

await browser.close();
console.log(`\nwritten to .shots/`);
