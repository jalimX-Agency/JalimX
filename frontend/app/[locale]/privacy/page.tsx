import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { ClosingBlock } from "@/components/site/footer";
import { Header } from "@/components/site/header";
import { routing } from "@/i18n/routing";
import { api } from "@/lib/api/client";
import { degrade } from "@/lib/api/degrade";
import { pageAlternates, pageOpenGraph } from "@/lib/seo";
import { numbers, text } from "@/lib/settings";

/**
 * What the contact form does with what is typed into it, in plain words.
 *
 * The page says only what the site actually does: the form's fields, the
 * services that run it, no analytics and no cookies. If the site gains an
 * analytics script or a newsletter, this page has to change first.
 */

type Section = {
  heading: string;
  body?: string;
  items?: string[];
  after?: string;
};

const ORDER = ["who", "collect", "why", "share", "keep", "cookies", "rights", "changes"] as const;

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "seo" });

  return {
    title: t("privacyTitle"),
    description: t("privacyDescription"),
    alternates: pageAlternates(locale, "/privacy"),
    openGraph: pageOpenGraph(
      locale,
      "/privacy",
      `${t("privacyTitle")} · JalimX`,
      t("privacyDescription")
    ),
  };
}

export default async function PrivacyPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("privacy");
  const settings = await api.settings
    .all()
    .catch((error) => degrade(error, {} as Record<string, unknown>));
  // The sentence it ends ("write to") makes no sense without an address, so a
  // failed settings read falls back to the studio's own.
  const email = text(settings, "contact_email") || "contact@jalimx.com";

  const sections = ORDER.map((key) => t.raw(`sections.${key}`) as Section);

  return (
    <>
      <div className="surface-light">
        <Header />

        <main className="mx-auto max-w-6xl px-6 py-16 sm:px-10 md:py-24">
          <header>
            <p className="font-mono text-[0.72rem] uppercase tracking-[0.18em] text-[var(--fg-faint)]">
              {t("title")}
            </p>
            <h1 className="mt-6 max-w-[22ch] font-display text-[clamp(2.2rem,5vw,3.4rem)] font-semibold leading-[1.04] tracking-[-0.02em]">
              {t("heading")}
            </h1>
            <p className="mt-6 font-mono text-[0.7rem] uppercase tracking-[0.14em] text-[var(--fg-faint)]">
              {t("updated")}
            </p>
          </header>

          <p className="mt-8 max-w-[60ch] text-lg leading-relaxed text-[var(--fg-dim)]">
            {t("intro")}
          </p>

          <div className="mt-16 max-w-[64ch]">
            {sections.map((section) => (
              <section
                key={section.heading}
                className="border-t border-[var(--hairline)] py-9"
              >
                <h2 className="font-display text-xl font-semibold tracking-tight">
                  {section.heading}
                </h2>
                {section.body && (
                  <p className="mt-3 leading-relaxed text-[var(--fg-dim)]">
                    {section.body}
                    {section.heading === sections[0].heading && email && (
                      <>
                        {" "}
                        <a
                          href={`mailto:${email}`}
                          className="text-[var(--link)] underline-offset-4 hover:underline"
                        >
                          {email}
                        </a>
                      </>
                    )}
                  </p>
                )}
                {section.items && (
                  <ul className="mt-3 list-disc space-y-1.5 pl-5 leading-relaxed text-[var(--fg-dim)] marker:text-[var(--fg-faint)]">
                    {section.items.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                )}
                {section.after && (
                  <p className="mt-3 leading-relaxed text-[var(--fg-dim)]">{section.after}</p>
                )}
              </section>
            ))}
          </div>
        </main>
      </div>

      <ClosingBlock
        email={email}
        phone={text(settings, "contact_phone")}
        whatsapp={numbers(settings, "contact_whatsapp")}
        location={text(settings, "contact_location")}
      />
    </>
  );
}
