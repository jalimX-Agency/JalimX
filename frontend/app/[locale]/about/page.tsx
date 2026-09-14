import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import {
  Declarations,
  type Declaration,
} from "@/components/site/declarations";
import { ClosingBlock } from "@/components/site/footer";
import { Header } from "@/components/site/header";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { api } from "@/lib/api/client";
import { text } from "@/lib/settings";

/**
 * About, as a standard rather than a story.
 *
 * There is nobody on this page by instruction — no name, no team size, no
 * history. What is left once those are gone is the only thing that was ever
 * checkable anyway: what will not be done to a client's site, and what will.
 *
 * Refusals first. "We build fast sites" is what every studio says and nothing
 * anyone can be held to; "no monthly retainer" is a commitment that can be
 * broken, which is what makes it worth reading. The page is deliberately short
 * — padding it out would mean saying things that are not true.
 */

const REFUSE = ["templates", "builders", "retainers", "surprises"] as const;
const PROMISE = ["scope", "price", "code", "accounts"] as const;

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "about" });

  return {
    title: t("title"),
    description: t("description"),
    alternates: { languages: { en: "/about", fr: "/fr/about" } },
  };
}

export default async function AboutPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("about");
  const settings = await api.settings
    .all()
    .catch(() => ({}) as Record<string, unknown>);

  /*
   * Split on the sentence boundary rather than left to wrap. The heading is two
   * halves — what will not happen, and what will — and that is the shape of the
   * page underneath it, so the break is information rather than typesetting.
   */
  const [refuseLine, ...promiseRest] = t("heading").split(". ");
  const promiseLine = promiseRest.join(". ");

  const build = (
    group: "refuse" | "promise",
    keys: readonly string[],
  ): Declaration[] =>
    keys.map((key) => ({
      key,
      term: t(`${group}.${key}.term`),
      note: t(`${group}.${key}.note`),
    }));

  return (
    <>
      <div className="surface-light">
        <Header />

        <main className="mx-auto max-w-6xl px-6 py-16 sm:px-10 md:py-24">
          <header>
            <p className="font-mono text-[0.72rem] uppercase tracking-[0.18em] text-[var(--fg-faint)]">
              {t("title")}
            </p>
            {/* The measure belongs on the heading, not the header: `ch` resolves
                against the element's own font size, and on the wrapper that is
                the body size — which broke this across six lines. */}
            <h1 className="mt-6 max-w-[22ch] font-display text-[clamp(2.2rem,5vw,3.4rem)] font-semibold leading-[1.04] tracking-[-0.02em]">
              <span className="block">{refuseLine}.</span>
              {promiseLine && (
                <span className="block text-[var(--link)]">{promiseLine}</span>
              )}
            </h1>
          </header>

          <p className="mt-8 max-w-[56ch] text-lg leading-relaxed text-[var(--fg-dim)]">
            {t("intro")}
          </p>

          {/* ---- what will not happen ---- */}
          <section className="mt-20 md:mt-24">
            <h2 className="border-t border-[var(--hairline)] pt-8 font-mono text-[0.72rem] uppercase tracking-[0.18em] text-signal">
              {t("refuseHeading")}
            </h2>

            <div className="mt-10">
              <Declarations items={build("refuse", REFUSE)} mode="strike" />
            </div>
          </section>

          {/* ---- what will ---- */}
          <section className="mt-16 md:mt-20">
            <h2 className="border-t border-[var(--hairline)] pt-8 font-mono text-[0.72rem] uppercase tracking-[0.18em] text-[var(--link)]">
              {t("promiseHeading")}
            </h2>

            <div className="mt-10">
              <Declarations items={build("promise", PROMISE)} mode="mark" />
            </div>
          </section>

          <section className="mt-24 border-t border-[var(--hairline)] pt-8">
            <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
              <div className="max-w-[46ch]">
                <h2 className="font-display text-2xl font-semibold tracking-tight">
                  {t("deeperHeading")}
                </h2>
                <p className="mt-3 text-[var(--fg-dim)]">{t("deeperBody")}</p>
              </div>
              <Link
                href="/approach"
                className="group inline-flex items-center gap-2 whitespace-nowrap text-sm text-[var(--link)] underline-offset-4 hover:underline"
              >
                {t("deeperLink")}
                <span
                  aria-hidden="true"
                  className="transition-transform duration-200 group-hover:translate-x-1"
                >
                  →
                </span>
              </Link>
            </div>
          </section>
        </main>
      </div>

      <ClosingBlock
        email={text(settings, "contact_email")}
        phone={text(settings, "contact_phone")}
        location={text(settings, "contact_location")}
      />
    </>
  );
}
