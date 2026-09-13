/**
 * Full-page screenshots of our own site, for reviewing a page as a whole.
 *
 * Scrolling a dev server by hand shows you one viewport at a time; a lot of
 * layout problems only appear when you can see the whole column at once.
 *
 *   pnpm shot                 homepage, desktop + mobile
 *   pnpm shot -- /approach
 *   pnpm shot -- / /approach /design-system
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
      /*
       * `networkidle` waits for a 500ms gap with zero connections, which a
       * page carrying several large images reaches unreliably — it timed out
       * on desktop while succeeding on mobile, purely because desktop loads
       * bigger variants. The scroll pass below is what actually guarantees
       * lazy images are in, so waiting on the DOM is enough here.
       */
      await page.goto(`${BASE}${route}`, {
        waitUntil: "domcontentloaded",
        timeout: 60_000,
      });
      await page.evaluate(() => document.fonts?.ready).catch(() => {});

      // Let lazy images below the fold load before a full-page capture, or
      // they photograph as empty boxes.
      await page.evaluate(async () => {
        const step = window.innerHeight;
        for (let y = 0; y < document.body.scrollHeight; y += step) {
          window.scrollTo(0, y);
          await new Promise((r) => setTimeout(r, 120));
        }
        window.scrollTo(0, 0);
      });
      await page.waitForTimeout(1200);

      const file = path.join(OUT, `${slug}-${name}.jpg`);
      await page.screenshot({
        path: file,
        type: "jpeg",
        quality: 80,
        fullPage: true,
      });

      const height = await page.evaluate(() => document.body.scrollHeight);
      console.log(`  ${slug} · ${name}  ${height}px`);
    } catch (error) {
      console.log(`  FAILED ${slug} · ${name} — ${error.message.split("\n")[0]}`);
    } finally {
      await context.close();
    }
  }
}

await browser.close();
console.log(`\nwritten to .shots/`);
