import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { SmoothScroll } from "@/components/motion/smooth-scroll";
import { JsonLd } from "@/components/site/json-ld";
import { chakra, plexMono, plexSans } from "../fonts";
import "../globals.css";
import { routing } from "@/i18n/routing";
import { api } from "@/lib/api/client";
import { ogImage, SITE_NAME, SITE_URL } from "@/lib/seo";
import { text } from "@/lib/settings";

/**
 * The root layout. There is no `app/layout.tsx` — every page lives under
 * `[locale]`, so this segment is the top of the tree and owns `<html>`.
 * That is what lets `lang` be correct per locale instead of hardcoded to one.
 */

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

  /*
   * No canonical or alternates here. Anything set at this level is inherited
   * by every page that does not set its own, and a canonical inherited from
   * the layout would tell Google that page is a copy of the homepage. Each
   * page declares itself (see pageAlternates in lib/seo).
   */
  return {
    metadataBase: new URL(SITE_URL),
    // The homepage's own title; every other page takes the template.
    title: {
      default: t("homeTitle"),
      template: `%s · ${SITE_NAME}`,
    },
    description: t("homeDescription"),
    openGraph: {
      type: "website",
      siteName: SITE_NAME,
      locale: locale === "fr" ? "fr_FR" : "en_GB",
      images: [ogImage(locale)],
    },
    twitter: { card: "summary_large_image", images: [ogImage(locale).url] },
  };
}

/**
 * Who this site belongs to, in the form search and answer engines read.
 *
 * Only what is already public on the site: the contact email from the
 * dashboard's settings, the city, and social profiles when one has been filled
 * in. A phone number is added the day one is set; nothing is invented to fill a
 * field.
 */
async function siteGraph(locale: string): Promise<Record<string, unknown>> {
  const [t, settings] = await Promise.all([
    getTranslations({ locale, namespace: "seo" }),
    api.settings.all().catch(() => ({}) as Record<string, unknown>),
  ]);

  const email = text(settings, "contact_email");
  const phone = text(settings, "contact_phone");
  const social = (settings.social ?? {}) as Record<string, unknown>;
  const sameAs = Object.values(social).filter(
    (url): url is string => typeof url === "string" && /^https?:\/\//.test(url)
  );

  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "ProfessionalService",
        "@id": `${SITE_URL}/#organization`,
        name: SITE_NAME,
        url: SITE_URL,
        logo: `${SITE_URL}/brand/jx-mark.svg`,
        description: t("homeDescription"),
        address: {
          "@type": "PostalAddress",
          addressLocality: "Marrakech",
          addressCountry: "MA",
        },
        ...(email ? { email } : {}),
        ...(phone ? { telephone: phone } : {}),
        ...(sameAs.length ? { sameAs } : {}),
      },
      {
        "@type": "WebSite",
        "@id": `${SITE_URL}/#website`,
        url: SITE_URL,
        name: SITE_NAME,
        inLanguage: [...routing.locales],
        publisher: { "@id": `${SITE_URL}/#organization` },
      },
    ],
  };
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  // Opts every page under this layout into static rendering. Without it
  // next-intl falls back to dynamic rendering and the whole site stops being
  // prerendered — which is the entire performance argument.
  setRequestLocale(locale);

  const graph = await siteGraph(locale);

  return (
    <html
      lang={locale}
      className={`${chakra.variable} ${plexSans.variable} ${plexMono.variable}`}
    >
      <body>
        <JsonLd data={graph} />
        <SmoothScroll />
        <NextIntlClientProvider>{children}</NextIntlClientProvider>
      </body>
    </html>
  );
}
