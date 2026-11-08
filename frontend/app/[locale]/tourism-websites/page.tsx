import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { ClosingBlock } from "@/components/site/footer";
import { Header } from "@/components/site/header";
import { JsonLd } from "@/components/site/json-ld";
import { WorkSection } from "@/components/site/work-section";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import type { Locale, Project } from "@/lib/api/client";
import { api } from "@/lib/api/client";
import { degrade } from "@/lib/api/degrade";
import { absoluteUrl, pageAlternates, pageOpenGraph, SITE_NAME, SITE_URL } from "@/lib/seo";
import { numbers, text } from "@/lib/settings";
import { getWorkShots } from "@/lib/work-shots";

/**
 * The page for one kind of client: tour operators, desert camps and villas.
 *
 * The rest of the site says "web development studio", which competes with
 * every agency in Marrakech. Every case study is a tourism business, so this
 * page says so, for the operator searching for exactly that, and lets the
 * case studies carry the proof.
 *
 * Deliberately not in the menu (linked from Work instead), and deliberately
 * without prices or durations: both depend on the project.
 */

type Item = { term: string; note: string };
type Faq = { q: string; a: string };

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
    title: t("tourismTitle"),
    description: t("tourismDescription"),
    alternates: pageAlternates(locale, "/tourism-websites"),
    openGraph: pageOpenGraph(
      locale,
      "/tourism-websites",
      `${t("tourismTitle")} · JalimX`,
      t("tourismDescription")
    ),
  };
}

async function getProjects(): Promise<Project[]> {
  try {
    return await api.projects.list();
  } catch (error) {
    return degrade(error, []);
  }
}

function ItemGrid({ items }: { items: Item[] }) {
  return (
    <dl className="grid gap-x-12 gap-y-10 md:grid-cols-2">
      {items.map((item) => (
        <div key={item.term}>
          <dt className="font-display text-lg font-semibold tracking-tight">{item.term}</dt>
          <dd className="mt-2 max-w-[48ch] leading-relaxed text-[var(--fg-dim)]">{item.note}</dd>
        </div>
      ))}
    </dl>
  );
}

export default async function TourismPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("tourism");
  const active = locale as Locale;

  const [projects, settings, shots] = await Promise.all([
    getProjects(),
    api.settings.all().catch((error) => degrade(error, {} as Record<string, unknown>)),
    getWorkShots(),
  ]);

  const problems = t.raw("problems") as Item[];
  const build = t.raw("build") as Item[];
  const how = t.raw("how") as string[];
  const faq = t.raw("faq") as Faq[];

  const pageUrl = absoluteUrl(active, "/tourism-websites");

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
                { "@type": "ListItem", position: 2, name: t("eyebrow"), item: pageUrl },
              ],
            },
            {
              "@type": "Service",
              "@id": `${pageUrl}#service`,
              name: t("heading"),
              serviceType: t("eyebrow"),
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
            <p className="font-mono text-[0.72rem] uppercase tracking-[0.18em] text-[var(--fg-faint)]">
              {t("eyebrow")}
            </p>
            <h1 className="mt-6 max-w-[24ch] font-display text-[clamp(2.2rem,5vw,3.6rem)] font-semibold leading-[1.04] tracking-[-0.02em] text-balance">
              {t("heading")}
            </h1>
          </header>

          <p className="mt-8 max-w-[58ch] text-lg leading-relaxed text-[var(--fg-dim)]">
            {t("intro")}
          </p>

          <div className="mt-10">
            <Link href="/contact" className="cta">
              {t("cta")}
            </Link>
          </div>

          <section className="mt-24">
            <h2 className="border-t border-[var(--hairline)] pt-8 font-mono text-[0.72rem] uppercase tracking-[0.18em] text-signal">
              {t("problemsHeading")}
            </h2>
            <div className="mt-10">
              <ItemGrid items={problems} />
            </div>
          </section>

          <section className="mt-20">
            <h2 className="border-t border-[var(--hairline)] pt-8 font-mono text-[0.72rem] uppercase tracking-[0.18em] text-[var(--link)]">
              {t("buildHeading")}
            </h2>
            <div className="mt-10">
              <ItemGrid items={build} />
            </div>
          </section>
        </main>

        {projects.length > 0 && (
          <>
            <div className="mx-auto max-w-6xl px-6 pb-8 sm:px-10">
              <h2 className="font-display text-2xl font-semibold tracking-tight">
                {t("proofHeading")}
              </h2>
              <p className="mt-3 max-w-[56ch] text-[var(--fg-dim)]">{t("proofNote")}</p>
            </div>
            <WorkSection projects={projects} shots={shots} locale={active} />
          </>
        )}

        <div className="mx-auto max-w-6xl px-6 pb-24 sm:px-10">
          <section>
            <h2 className="border-t border-[var(--hairline)] pt-8 font-display text-2xl font-semibold tracking-tight">
              {t("howHeading")}
            </h2>
            <ol className="mt-8 grid gap-8 md:grid-cols-3">
              {how.map((step, i) => (
                <li key={step} className="flex flex-col gap-3">
                  <span className="font-mono text-[0.72rem] tabular-nums text-[var(--fg-faint)]">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <p className="leading-relaxed text-[var(--fg-dim)]">{step}</p>
                </li>
              ))}
            </ol>
            <Link
              href="/approach"
              className="mt-8 inline-flex items-center gap-2 text-sm text-[var(--link)] underline-offset-4 hover:underline"
            >
              {t("howLink")}
              <span aria-hidden="true">→</span>
            </Link>
          </section>

          <section className="mt-24">
            <h2 className="border-t border-[var(--hairline)] pt-8 font-display text-2xl font-semibold tracking-tight">
              {t("faqHeading")}
            </h2>
            <div className="mt-6 max-w-[70ch]">
              {faq.map((item) => (
                <details
                  key={item.q}
                  className="group border-b border-[var(--hairline)] py-5"
                >
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
