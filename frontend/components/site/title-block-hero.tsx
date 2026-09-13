import { getTranslations } from "next-intl/server";

import { DrawnRules } from "@/components/motion/drawn-rules";
import { PlottedHeadline } from "@/components/motion/plotted-headline";
import { PageTelemetry } from "@/components/site/page-telemetry";
import { Link } from "@/i18n/navigation";

/**
 * The /approach opener: a drawing's title block.
 *
 * The previous version of this hero was the site's generic dense treatment —
 * an engineering grid, a scanline, HUD brackets, a headline machining itself
 * into place — with whatever copy the page happened to need poured into it. It
 * was furniture, and it looked the same here as it would have on any page.
 *
 * This one is specific to what the page actually is. Every technical drawing
 * carries a title block: a ruled box naming the document, its terms and its
 * sheet number, with the values in labelled cells. The page promises the whole
 * process written down, so its opener is the cover sheet of that document — and
 * the rules ink themselves in, the same gesture as the mark on the homepage and
 * the spine through the process below it.
 *
 * The scanline and the brackets are gone with the old concept. What remains of
 * the atmosphere is the grid, which on a sheet reads as paper rather than as a
 * head-up display.
 */
export async function TitleBlockHero() {
  const t = await getTranslations("approach");
  const nav = await getTranslations("nav");
  const hero = await getTranslations("hero");

  const facts = [
    { label: t("sheet.termsLabel"), value: t("sheet.termsValue") },
    { label: t("sheet.typicalLabel"), value: t("sheet.typicalValue") },
    { label: t("sheet.revisionsLabel"), value: t("sheet.revisionsValue") },
  ];

  return (
    <section className="relative overflow-hidden border-b border-[var(--hairline)]">
      <div className="tech-grid" aria-hidden="true" />

      <div className="relative mx-auto max-w-6xl px-6 py-[clamp(2.5rem,6vh,5rem)] sm:px-10">
        <DrawnRules className="relative">
          {/* The sheet's own border. Four rules rather than a CSS border so the
              pen can go round it; `data-rule` is what DrawnRules animates. */}
          <span
            data-rule="x"
            aria-hidden="true"
            className="absolute left-0 top-0 h-px w-full bg-[var(--hairline)]"
          />
          <span
            data-rule="x"
            aria-hidden="true"
            className="absolute bottom-0 left-0 h-px w-full bg-[var(--hairline)]"
          />
          <span
            data-rule="y"
            aria-hidden="true"
            className="absolute left-0 top-0 h-full w-px bg-[var(--hairline)]"
          />
          <span
            data-rule="y"
            aria-hidden="true"
            className="absolute right-0 top-0 h-full w-px bg-[var(--hairline)]"
          />

          {/* ---- sheet header ---- */}
          <div className="flex items-baseline justify-between gap-4 px-5 py-3 font-mono text-[0.62rem] uppercase tracking-[0.14em] sm:px-7">
            <span className="text-signal">{t("sheet.doc")}</span>
            <span className="text-[var(--fg-faint)]">{t("sheet.of")}</span>
          </div>

          <span
            data-rule="x"
            aria-hidden="true"
            className="block h-px w-full bg-[var(--hairline)]"
          />

          {/* ---- the title ---- */}
          <div className="px-5 py-[clamp(1.75rem,4.5vh,3rem)] sm:px-7">
            <p className="eyebrow text-[var(--fg-faint)]">{t("eyebrow")}</p>
            {/* The page's one loud moment: a pen writes the title across the
                sheet. Everything else here is quiet so that this lands. */}
            <PlottedHeadline
              className="h-display mt-[clamp(1rem,2.5vh,1.5rem)] text-[clamp(2.25rem,6.8vw,5.5rem)]"
              restClassName="text-[var(--link)]"
              lines={[t("headlineTop"), t("headlineBottom")]}
            />
          </div>

          <span
            data-rule="x"
            aria-hidden="true"
            className="block h-px w-full bg-[var(--hairline)]"
          />

          {/* ---- the cells ----
              Three, in the order a buyer reads them: what this is, what it
              costs, and whether we can be believed about any of it. */}
          <div className="grid lg:grid-cols-[1fr_auto_auto]">
            <div className="px-5 py-6 sm:px-7">
              <p className="max-w-[46ch] leading-relaxed text-[var(--fg-dim)]">
                {t("body")}
              </p>

              <div className="mt-[clamp(1.25rem,3vh,1.75rem)] flex flex-wrap items-center gap-x-7 gap-y-4">
                <Link href="/contact" className="cta">
                  {nav("cta")}
                </Link>
                <Link
                  href="/work"
                  className="group inline-flex items-center gap-2 text-sm text-[var(--fg)] underline-offset-8 hover:underline"
                >
                  {hero("seeWork")}
                  <span
                    aria-hidden="true"
                    className="transition-transform duration-200 group-hover:translate-x-1"
                  >
                    →
                  </span>
                </Link>
              </div>
            </div>

            <div className="border-t border-[var(--hairline)] px-5 py-6 sm:px-7 lg:min-w-[13rem] lg:border-l lg:border-t-0">
              <dl>
                {facts.map((fact) => (
                  <div key={fact.label} className="flex flex-col gap-0.5 py-1.5">
                    <dt className="font-mono text-[0.62rem] uppercase tracking-[0.14em] text-[var(--fg-faint)]">
                      {fact.label}
                    </dt>
                    <dd className="font-mono text-sm text-[var(--fg)]">
                      {fact.value}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>

            <div className="border-t border-[var(--hairline)] px-5 py-6 sm:px-7 lg:min-w-[17rem] lg:border-l lg:border-t-0">
              <PageTelemetry
                label={t("telemetry.label")}
                rows={{
                  bytes: t("telemetry.bytes"),
                  requests: t("telemetry.requests"),
                  thirdParty: t("telemetry.thirdParty"),
                  lcp: t("telemetry.lcp"),
                }}
                note={t("telemetry.note")}
              />
            </div>
          </div>
        </DrawnRules>
      </div>
    </section>
  );
}
