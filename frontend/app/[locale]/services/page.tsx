import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { ClosingBlock } from "@/components/site/footer";
import { Header } from "@/components/site/header";
import { JsonLd } from "@/components/site/json-ld";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import type { Locale, Service } from "@/lib/api/client";
import { api, t as pickLocale } from "@/lib/api/client";
import { degrade } from "@/lib/api/degrade";
import { absoluteUrl, pageAlternates, pageOpenGraph, SITE_NAME } from "@/lib/seo";
import { SERVICE_SLUGS, servicePath } from "@/lib/services";
import { numbers, text } from "@/lib/settings";

/**
 * The services index: the four services, each pointing at its own page.
 *
 * The depth is on the service pages, one per search a buyer actually makes;
 * this page only has to say what the four are and send people on.
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

  return {
    title: t("servicesTitle"),
    description: t("servicesDescription"),
    alternates: pageAlternates(locale, "/services"),
    openGraph: pageOpenGraph(
      locale,
      "/services",
      `${t("servicesTitle")} · JalimX`,
      t("servicesDescription")
    ),
  };
}

async function getServices(): Promise<Service[]> {
  try {
    return await api.services.list();
  } catch (error) {
    return degrade(error, []);
  }
}

export default async function ServicesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("servicePages");
  const seo = await getTranslations("seo");
  const active = locale as Locale;

  const [services, settings] = await Promise.all([
    getServices(),
    api.settings.all().catch((error) => degrade(error, {} as Record<string, unknown>)),
  ]);

  // Always the four, in order: the dashboard's wording where the API answered,
  // the page titles otherwise, so the index is never an empty list.
  const listed = SERVICE_SLUGS.map((slug) => {
    const service = services.find((s) => s.slug === slug);
    return {
      slug,
      title: service ? pickLocale(service.title, active) : seo(`service.${slug}.title`),
      tagline: service ? pickLocale(service.tagline, active) : "",
      body: service ? pickLocale(service.body, active) : seo(`service.${slug}.description`),
    };
  });
  const pageUrl = absoluteUrl(active, "/services");

  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: SITE_NAME, item: absoluteUrl(active, "/") },
            { "@type": "ListItem", position: 2, name: t("eyebrow"), item: pageUrl },
          ],
        }}
      />

      <div className="surface-light">
        <Header />

        <main className="mx-auto max-w-6xl px-6 py-16 sm:px-10 md:py-24">
          <header>
            <p className="font-mono text-[0.72rem] uppercase tracking-[0.18em] text-[var(--fg-faint)]">
              {t("eyebrow")}
            </p>
            <h1 className="mt-6 max-w-[22ch] font-display text-[clamp(2.2rem,5vw,3.6rem)] font-semibold leading-[1.04] tracking-[-0.02em] text-balance">
              {t("heading")}
            </h1>
          </header>

          <p className="mt-8 max-w-[58ch] text-lg leading-relaxed text-[var(--fg-dim)]">
            {t("intro")}
          </p>

          <ul className="mt-20 flex flex-col">
            {listed.map((service, i) => (
              <li key={service.slug} className="border-t border-[var(--hairline)]">
                <Link
                  href={servicePath(service.slug)}
                  className="group grid gap-4 py-10 md:grid-cols-12 md:gap-10"
                >
                  <span className="font-mono text-[0.72rem] tabular-nums text-[var(--fg-faint)] md:col-span-1">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <div className="md:col-span-7">
                    <h2 className="font-display text-[1.7rem] font-semibold leading-tight tracking-tight group-hover:underline group-hover:underline-offset-4">
                      {service.title}
                    </h2>
                    {service.tagline && (
                      <p className="mt-3 text-lg text-[var(--fg-dim)]">{service.tagline}</p>
                    )}
                    <p className="mt-3 max-w-[58ch] text-sm leading-relaxed text-[var(--fg-dim)]">
                      {service.body}
                    </p>
                  </div>
                  <span className="inline-flex items-center gap-2 self-start font-mono text-[0.68rem] uppercase tracking-[0.12em] text-[var(--link)] md:col-span-4 md:justify-self-end">
                    {t("open")}
                    <span
                      aria-hidden="true"
                      className="transition-transform duration-200 group-hover:translate-x-1"
                    >
                      →
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>

          <p className="mt-6 border-t border-[var(--hairline)] pt-8">
            <Link
              href="/tourism-websites"
              className="inline-flex items-center gap-2 text-sm text-[var(--link)] underline-offset-4 hover:underline"
            >
              {t("tourismLink")}
              <span aria-hidden="true">→</span>
            </Link>
          </p>
        </main>
      </div>

      <ClosingBlock
        email={text(settings, "contact_email")}
        phone={text(settings, "contact_phone")}
        whatsapp={numbers(settings, "contact_whatsapp")}
        location={text(settings, "contact_location")}
      />
    </>
  );
}
