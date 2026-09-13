import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { ClientStrip } from "@/components/site/client-strip";
import { ClosingBlock } from "@/components/site/footer";
import { Header } from "@/components/site/header";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { api } from "@/lib/api/client";
import { text } from "@/lib/settings";

/*
 * NOTE(Mohamed): this page argues for a way of working rather than telling a
 * personal story, because the method is the part I can state accurately. If you
 * want a founder's story, years in business, or team size here, send me the
 * facts and I will write them in.
 */

const BELIEFS = ["templates", "speed", "control", "price"] as const;

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

  return (
    <>
      <div className="surface-light">
        <Header />

        <main className="mx-auto max-w-6xl px-6 py-16 sm:px-10 md:py-24">
          <header className="max-w-[54ch]">
            <p className="font-mono text-[0.72rem] uppercase tracking-[0.18em] text-[var(--fg-faint)]">
              {t("title")}
            </p>
            <h1 className="mt-6 font-display text-[clamp(2.4rem,5.5vw,3.8rem)] font-semibold leading-[1.02] tracking-[-0.02em] text-balance">
              {t("heading")}
            </h1>
            <p className="mt-7 text-lg leading-relaxed text-[var(--fg-dim)]">
              {t("intro")}
            </p>
          </header>

          <section className="mt-20 border-t border-[var(--hairline)] pt-8">
            <h2 className="font-display text-sm font-semibold uppercase tracking-[0.14em]">
              {t("beliefsHeading")}
            </h2>

            <div className="mt-12 grid gap-x-12 gap-y-14 md:grid-cols-2">
              {BELIEFS.map((belief) => (
                <div key={belief} className="flex flex-col gap-3">
                  <h3 className="font-display text-xl font-semibold tracking-tight">
                    {t(`beliefs.${belief}.title`)}
                  </h3>
                  <p className="max-w-[52ch] leading-relaxed text-[var(--fg-dim)]">
                    {t(`beliefs.${belief}.body`)}
                  </p>
                </div>
              ))}
            </div>
          </section>

          <section className="mt-24">
            <ClientStrip />
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
                className="inline-flex items-center gap-2 whitespace-nowrap text-sm text-[var(--link)] underline-offset-4 hover:underline"
              >
                {t("deeperLink")}
                <span aria-hidden="true">→</span>
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
