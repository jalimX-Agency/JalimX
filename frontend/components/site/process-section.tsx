import { getTranslations } from "next-intl/server";

/**
 * How a project actually runs.
 *
 * The homepage audience is buying something they cannot evaluate technically,
 * so the reassurance they need is procedural: what happens, in what order, and
 * when they have to decide anything.
 *
 * Numbering is used here and nowhere else on the page, because this is the one
 * section where the order carries information.
 *
 * Terms confirmed by Mohamed on 2026-09-08: fixed quote, 50/50 split, agreed
 * target date. The earlier 30/70 came from the Globale contract and is
 * superseded — older signed contracts keep their own terms.
 */

const STEPS = ["call", "scope", "build", "handover"] as const;

export async function ProcessSection() {
  const t = await getTranslations("process");

  return (
    <section
      id="process"
      className="mx-auto max-w-6xl px-6 pb-28 sm:px-10 md:pb-36"
    >
      <div className="border-t border-[var(--hairline)] pt-8">
        <h2 className="font-display text-sm font-semibold uppercase tracking-[0.14em]">
          {t("heading")}
        </h2>
      </div>

      <ol className="mt-14 grid gap-x-10 gap-y-12 sm:grid-cols-2 lg:grid-cols-4">
        {STEPS.map((step, i) => (
          <li key={step} className="flex flex-col gap-3">
            <span className="font-mono text-[0.72rem] tracking-[0.16em] text-[var(--link)]">
              {String(i + 1).padStart(2, "0")}
            </span>
            <h3 className="font-display text-lg font-semibold tracking-tight">
              {t(`steps.${step}.title`)}
            </h3>
            <p className="text-sm leading-relaxed text-[var(--fg-dim)]">
              {t(`steps.${step}.body`)}
            </p>
          </li>
        ))}
      </ol>
    </section>
  );
}
