import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { SmoothScroll } from "@/components/motion/smooth-scroll";
import { chakra, plexMono, plexSans } from "../fonts";
import "../globals.css";
import { routing } from "@/i18n/routing";

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
  const t = await getTranslations({ locale, namespace: "footer" });

  return {
    metadataBase: new URL("https://jalimx.com"),
    title: {
      default: `JalimX — ${t("tagline")}`,
      template: "%s · JalimX",
    },
    description:
      locale === "fr"
        ? "Un studio de développement web. Nous construisons des sites à partir d'un fichier vide — sans gabarit ni page builder."
        : "A web development studio. We build websites from an empty file — no templates, no page builders.",
    openGraph: {
      type: "website",
      siteName: "JalimX",
      locale: locale === "fr" ? "fr_FR" : "en_GB",
    },
    alternates: {
      canonical: locale === "fr" ? "/fr" : "/",
      languages: {
        en: "/",
        fr: "/fr",
        "x-default": "/",
      },
    },
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

  return (
    <html
      lang={locale}
      className={`${chakra.variable} ${plexSans.variable} ${plexMono.variable}`}
    >
      <body>
        <SmoothScroll />
        <NextIntlClientProvider>{children}</NextIntlClientProvider>
      </body>
    </html>
  );
}
