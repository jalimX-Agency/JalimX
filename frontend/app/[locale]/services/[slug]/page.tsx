import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { ClosingBlock } from "@/components/site/footer";
import { Header } from "@/components/site/header";
import { JsonLd } from "@/components/site/json-ld";
import { WorkSection } from "@/components/site/work-section";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import type { Locale, Project, Service } from "@/lib/api/client";
import { api, t as pickLocale } from "@/lib/api/client";
import { degrade } from "@/lib/api/degrade";
import { absoluteUrl, pageAlternates, pageOpenGraph, SITE_NAME, SITE_URL } from "@/lib/seo";
import { isServiceSlug, SERVICE_SLUGS, SERVICE_TAG, servicePath } from "@/lib/services";
import { numbers, text } from "@/lib/settings";
import { getWorkShots } from "@/lib/work-shots";

/**
 * One service, one page, one search a buyer makes.
 *
 * The heading, tagline and short description come from the dashboard; the
 * depth around them (what is included, who it is for, the questions) is in
 * messages. The proof is the case studies tagged with this service, so a page
 * only claims what a published project shows.
 */

type Item = { term: string; note: string };
type Faq = { q: string; a: string };
type Params = { params: Promise<{ locale: string; slug: string }> };

export const dynamicParams = false;

export function generateStaticParams() {
  return routing.locales.flatMap((locale) =>
    SERVICE_SLUGS.map((slug) => ({ locale, slug }))
  );
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!isServiceSlug(slug)) return {};
  const t = await getTranslations({ locale, namespace: "seo" });
  const path = servicePath(slug);

  return {
    title: t(`service.${slug}.title`),
    description: t(`service.${slug}.description`),
    alternates: pageAlternates(locale, path),
    openGraph: pageOpenGraph(
      locale,
      path,
      `${t(`service.${slug}.title`)} · JalimX`,
      t(`service.${slug}.description`)
    ),
  };
}

async function getService(slug: string): Promise<Service | null> {
  try {
    const all = await api.services.list();
    return all.find((s) => s.slug === slug) ?? null;
  } catch (error) {
    return degrade(error, null);
  }
}

async function getProjects(): Promise<Project[]> {
  try {
    return await api.projects.list();
  } catch (error) {
    return degrade(error, []);
  }
}

export default async function ServicePage({ params }: Params) {
  const { locale, slug } = await params;
  if (!isServiceSlug(slug)) notFound();
  setRequestLocale(locale);

  const t = await getTranslations("servicePages");
  const seo = await getTranslations("seo");
  const active = locale as Locale;

  const [service, projects, settings, shots] = await Promise.all([
    getService(slug),
    getProjects(),
    api.settings.all().catch((error) => degrade(error, {} as Record<string, unknown>)),
    getWorkShots(),
  ]);

  const includes = t.raw(`pages.${slug}.includes`) as Item[];
  const faq = t.raw(`pages.${slug}.faq`) as Faq[];
  const proof = projects.filter((p) => (p.tags ?? []).includes(SERVICE_TAG[slug]));

  // The dashboard's wording when it is there; the page's own title when the
  // API did not answer at build time.
  const title = service ? pickLocale(service.title, active) : seo(`service.${slug}.title`);
  const tagline = service ? pickLocale(service.tagline, active) : "";
  const body = service ? pickLocale(service.body, active) : seo(`service.${slug}.description`);

  const path = servicePath(slug);
  const pageUrl = absoluteUrl(active, path);

  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "BreadcrumbList",
              itemListElement: [
                { "@type": "ListItem", position: 1, name: SITE_NAME, item: absoluteUrl(active, "/") },
                { "@type": "ListItem", position: 2, name: t("eyebrow"), item: absoluteUrl(active, "/services") },
                { "@type": "ListItem", position: 3, name: title, item: pageUrl },
              ],
            },
            {
              "@type": "Service",
              "@id": `${pageUrl}#service`,
              name: title,
              description: body,
              areaServed: { "@type": "Country", name: "Morocco" },
              provider: { "@id": `${SITE_URL}/#organization` },
              url: pageUrl,
            },
            {
              "@type": "FAQPage",
              "@id": `${pageUrl}#faq`,
              inLanguage: active,
              mainEntity: faq.map((item) => ({
                "@type": "Question",
                name: item.q,
                acceptedAnswer: { "@type": "Answer", text: item.a },
              })),
            },
          ],
        }}
      />

      <div className="surface-light">
        <Header />

        <main className="mx-auto max-w-6xl px-6 py-16 sm:px-10 md:py-24">
          <header>
            <Link
              href="/services"
              className="font-mono text-[0.72rem] uppercase tracking-[0.18em] text-[var(--fg-faint)] hover:text-[var(--fg)]"
            >
              ← {t("allServices")}
            </Link>
            <h1 className="mt-6 max-w-[22ch] font-display text-[clamp(2.2rem,5vw,3.6rem)] font-semibold leading-[1.04] tracking-[-0.02em] text-balance">
              {title}
            </h1>
            {tagline && (
              <p className="mt-4 max-w-[40ch] font-display text-xl text-[var(--link)]">
                {tagline}
              </p>
            )}
          </header>

          <p className="mt-8 max-w-[58ch] text-lg leading-relaxed text-[var(--fg-dim)]">
            {body}
          </p>

          <div className="mt-10">
            <Link href="/contact" className="cta">
              {t("cta")}
            </Link>
          </div>

          <section className="mt-24">
            <h2 className="border-t border-[var(--hairline)] pt-8 font-mono text-[0.72rem] uppercase tracking-[0.18em] text-[var(--link)]">
              {t(`pages.${slug}.includesHeading`)}
            </h2>
            <dl className="mt-10 grid gap-x-12 gap-y-10 md:grid-cols-2">
              {includes.map((item) => (
                <div key={item.term}>
                  <dt className="font-display text-lg font-semibold tracking-tight">{item.term}</dt>
                  <dd className="mt-2 max-w-[48ch] leading-relaxed text-[var(--fg-dim)]">{item.note}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section className="mt-20">
            <h2 className="border-t border-[var(--hairline)] pt-8 font-mono text-[0.72rem] uppercase tracking-[0.18em] text-[var(--fg-faint)]">
              {t(`pages.${slug}.forHeading`)}
            </h2>
            <p className="mt-6 max-w-[62ch] text-lg leading-relaxed text-[var(--fg-dim)]">
              {t(`pages.${slug}.for`)}
            </p>
            {slug === "web-development" && (
              <div className="mt-6 flex flex-col gap-3">
                <Link
                  href="/tourism-websites"
                  className="inline-flex items-center gap-2 text-sm text-[var(--link)] underline-offset-4 hover:underline"
                >
                  {t("tourismLink")}
                  <span aria-hidden="true">→</span>
                </Link>
                <Link
                  href="/approach"
                  className="inline-flex items-center gap-2 text-sm text-[var(--link)] underline-offset-4 hover:underline"
                >
                  {t("approachLink")}
                  <span aria-hidden="true">→</span>
                </Link>
              </div>
            )}
          </section>
        </main>

        {proof.length > 0 && (
          <>
            <div className="mx-auto max-w-6xl px-6 pb-8 sm:px-10">
              <h2 className="font-display text-2xl font-semibold tracking-tight">
                {t("proofHeading")}
              </h2>
            </div>
            <WorkSection projects={proof} shots={shots} locale={active} />
          </>
        )}

        <div className="mx-auto max-w-6xl px-6 pb-24 sm:px-10">
          <section>
            <h2 className="border-t border-[var(--hairline)] pt-8 font-display text-2xl font-semibold tracking-tight">
              {t("faqHeading")}
            </h2>
            <div className="mt-6 max-w-[70ch]">
              {faq.map((item) => (
                <details key={item.q} className="group border-b border-[var(--hairline)] py-5">
                  <summary className="flex cursor-pointer list-none items-baseline justify-between gap-6 font-medium">
                    {item.q}
                    <span
                      aria-hidden="true"
                      className="font-mono text-[var(--fg-faint)] transition-transform group-open:rotate-45"
                    >
                      +
                    </span>
                  </summary>
                  <p className="mt-3 leading-relaxed text-[var(--fg-dim)]">{item.a}</p>
                </details>
              ))}
            </div>
          </section>
        </div>
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
