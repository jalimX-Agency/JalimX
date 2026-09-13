import { getTranslations } from "next-intl/server";

import {
  BlueprintProcess,
  type Phase,
} from "@/components/site/blueprint-process";

/**
 * The body of /approach.
 *
 * There is no list of technologies here any more. A stack list is what a
 * developer's portfolio carries; an agency sells an outcome, and the client
 * buying a booking system has no use for the name of the framework it arrives
 * in. If they ask, that is an answer in a phone call, not a section.
 *
 * What replaces it is the thing a serious buyer cannot get anywhere else and
 * almost no studio will publish: the process, written down, with the durations
 * and with what we will need from them at each step. Only that section moves;
 * everything after it is still and typographic, because by then the reader is
 * reading rather than being persuaded.
 */

const PHASES = ["call", "scope", "build", "review", "live"] as const;
const STANDARD = ["a", "b", "c", "d", "e", "f"] as const;
const OWN = ["a", "b", "c"] as const;
const LIMITS = ["a", "b", "c"] as const;

function SectionHead({ index, title }: { index: string; title: string }) {
  return (
    <div className="flex items-baseline gap-4 border-t border-[var(--hairline)] pt-8">
      <span className="font-mono text-[0.72rem] tracking-[0.16em] text-signal">
        {index}
      </span>
      <h2 className="font-display text-sm font-semibold uppercase tracking-[0.14em]">
        {title}
      </h2>
    </div>
  );
}

export async function ApproachSections() {
  const t = await getTranslations("approach");

  const phases: Phase[] = PHASES.map((key, i) => ({
    key,
    index: String(i + 1).padStart(2, "0"),
    name: t(`phases.${key}.name`),
    duration: t(`phases.${key}.duration`),
    body: t(`phases.${key}.body`),
    need: t(`phases.${key}.need`),
  }));

  return (
    <div className="mx-auto max-w-6xl px-6 sm:px-10">
      {/* ---- 01 how a project goes ---- */}
      <BlueprintProcess
        eyebrow="01"
        heading={t("processHeading")}
        intro={t("processIntro")}
        terms={t("processTerms")}
        needLabel={t("needLabel")}
        phases={phases}
      />

      {/* ---- 02 what every site gets ----
          A flat list rather than cards. These are conditions of sale, and
          giving each one a box would invite the reader to treat them as
          features that could be traded away. */}
      <section className="pb-24 md:pb-32">
        <SectionHead index="02" title={t("standardHeading")} />

        <p className="mt-8 max-w-[58ch] text-lg leading-relaxed text-[var(--fg-dim)]">
          {t("standardIntro")}
        </p>

        <ul className="mt-12 flex flex-col">
          {STANDARD.map((key) => (
            <li
              key={key}
              className="flex gap-5 border-b border-[var(--hairline)] py-5 last:border-b-0"
            >
              <span
                aria-hidden="true"
                className="mt-1 font-mono text-[0.8rem] text-[var(--link)]"
              >
                ✓
              </span>
              <p className="max-w-[62ch] text-[var(--fg-dim)]">
                {t(`standard.${key}`)}
              </p>
            </li>
          ))}
        </ul>
      </section>

      {/* ---- 03 what you own ---- */}
      <section className="pb-24 md:pb-32">
        <SectionHead index="03" title={t("ownHeading")} />

        <div className="mt-14 grid gap-10 md:grid-cols-3 md:gap-8">
          {OWN.map((key) => (
            <div key={key} className="flex flex-col gap-3">
              <h3 className="font-display text-lg font-semibold tracking-tight">
                {t(`own.${key}.title`)}
              </h3>
              <p className="text-sm leading-relaxed text-[var(--fg-dim)]">
                {t(`own.${key}.body`)}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ---- 04 what we do not do ----
          Given its own weight because it is the most useful thing on the page:
          a limit stated up front is worth more to a serious buyer than another
          paragraph of capability. */}
      <section className="pb-28 md:pb-36">
        <SectionHead index="04" title={t("limitsHeading")} />

        <p className="mt-8 max-w-[58ch] text-lg leading-relaxed text-[var(--fg-dim)]">
          {t("limitsIntro")}
        </p>

        <ul className="mt-12 flex flex-col gap-px overflow-hidden rounded-lg border border-[var(--hairline)] bg-[var(--hairline)]">
          {LIMITS.map((key) => (
            <li
              key={key}
              className="flex gap-4 bg-[var(--panel)] px-5 py-5 sm:px-7"
            >
              <span aria-hidden="true" className="mt-0.5 font-mono text-signal">
                ×
              </span>
              <p className="max-w-[64ch] text-[var(--fg-dim)]">
                {t(`limits.${key}`)}
              </p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
