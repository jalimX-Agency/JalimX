import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { ApproachSections } from "@/components/site/approach-sections";
import { ClosingBlock } from "@/components/site/footer";
import { Header } from "@/components/site/header";
import { TitleBlockHero } from "@/components/site/title-block-hero";
import { routing } from "@/i18n/routing";
import { api } from "@/lib/api/client";
import { text } from "@/lib/settings";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "approach" });

  return {
    title: t("title"),
    description: t("description"),
    alternates: { languages: { en: "/approach", fr: "/fr/approach" } },
  };
}

export default async function ApproachPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const settings = await api.settings
    .all()
    .catch(() => ({}) as Record<string, unknown>);

  return (
    <div className="surface-dark">
      <Header />
      <main>
        <TitleBlockHero />
        <ApproachSections />
      </main>
      <ClosingBlock
        email={text(settings, "contact_email")}
        phone={text(settings, "contact_phone")}
        location={text(settings, "contact_location")}
      />
    </div>
  );
}
