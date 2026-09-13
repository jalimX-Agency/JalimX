import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { ClosingBlock } from "@/components/site/footer";
import { Header } from "@/components/site/header";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import type { Locale, Project } from "@/lib/api/client";
import { api, t as pickLocale } from "@/lib/api/client";
import { text } from "@/lib/settings";
import { getWorkShots, shotFor } from "@/lib/work-shots";

type Params = { params: Promise<{ locale: string; slug: string }> };

/**
 * Pre-render every published case study in every locale at build time. The
 * list is small and changes rarely, so there is no reason for any of these to
 * be rendered on demand — and Laravel drops the tag when one is edited.
 */
export async function generateStaticParams() {
  try {
    const projects = await api.projects.list();

    return routing.locales.flatMap((locale) =>
      projects.map((project) => ({ locale, slug: project.slug }))
    );
  } catch {
    return [];
  }
}

async function find(slug: string): Promise<Project | null> {
  try {
    return await api.projects.get(slug);
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale, slug } = await params;
  const t = await getTranslations({ locale, namespace: "caseStudy" });
  const project = await find(slug);

  if (!project) return { title: t("notFound") };

  const active = locale as Locale;

  return {
    title: `${project.client_name} — ${pickLocale(project.title, active)}`,
    description: pickLocale(project.summary, active),
    alternates: {
      languages: { en: `/work/${slug}`, fr: `/fr/work/${slug}` },
    },
  };
}

function Chapter({ label, body }: { label: string; body: string }) {
  if (!body) return null;

  return (
    <section className="grid gap-4 border-t border-[var(--hairline)] pt-8 md:grid-cols-[14rem_1fr] md:gap-12">
      <h2 className="font-mono text-[0.68rem] uppercase tracking-[0.14em] text-[var(--fg-faint)]">
        {label}
      </h2>
      <p className="max-w-[62ch] text-lg leading-relaxed text-[var(--fg-dim)]">
        {body}
      </p>
    </section>
  );
}

export default async function CaseStudy({ params }: Params) {
  const { locale, slug } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("caseStudy");
  const active = locale as Locale;

  const [project, shots, settings] = await Promise.all([
    find(slug),
    getWorkShots(),
    api.settings.all().catch(() => ({}) as Record<string, unknown>),
  ]);

  if (!project) notFound();

  const desktop = shotFor(shots, project.slug, "desktop");
  const mobile = shotFor(shots, project.slug, "mobile");

  return (
    <>
      <div className="surface-light">
        <Header />

        <main className="mx-auto max-w-6xl px-6 py-14 sm:px-10 md:py-20">
          <Link
            href="/work"
            className="inline-flex items-center gap-2 font-mono text-[0.68rem] uppercase tracking-[0.14em] text-[var(--fg-faint)] hover:text-[var(--fg)]"
          >
            <span aria-hidden="true">←</span> {t("allWork")}
          </Link>

          <header className="mt-10 max-w-[56ch]">
            <p className="font-mono text-[0.72rem] uppercase tracking-[0.16em] text-[var(--link)]">
              {project.client_name}
              {project.year ? ` · ${project.year}` : ""}
            </p>
            <h1 className="mt-5 font-display text-[clamp(2.2rem,5vw,3.6rem)] font-semibold leading-[1.03] tracking-[-0.02em] text-balance">
              {pickLocale(project.title, active)}
            </h1>
            <p className="mt-6 text-lg leading-relaxed text-[var(--fg-dim)]">
              {pickLocale(project.summary, active)}
            </p>
          </header>

          <dl className="mt-10 flex flex-wrap gap-x-12 gap-y-6">
            {project.stack.length > 0 && (
              <div>
                <dt className="font-mono text-[0.62rem] uppercase tracking-[0.14em] text-[var(--fg-faint)]">
                  {t("builtWith")}
                </dt>
                <dd className="mt-1.5 text-sm">{project.stack.join(" · ")}</dd>
              </div>
            )}
            <div>
              <dt className="font-mono text-[0.62rem] uppercase tracking-[0.14em] text-[var(--fg-faint)]">
                {t("scope")}
              </dt>
              <dd className="mt-1.5 text-sm">{project.tags.join(" · ")}</dd>
            </div>
            {project.project_url && (
              <div>
                <dt className="font-mono text-[0.62rem] uppercase tracking-[0.14em] text-[var(--fg-faint)]">
                  {t("live")}
                </dt>
                <dd className="mt-1.5 text-sm">
                  <a
                    href={project.project_url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[var(--link)] underline-offset-4 hover:underline"
                  >
                    {new URL(project.project_url).hostname.replace(/^www\./, "")}{" "}
                    <span aria-hidden="true">↗</span>
                  </a>
                </dd>
              </div>
            )}
          </dl>

          {desktop && (
            <div className="mt-14 overflow-hidden rounded-xl border border-[var(--hairline)] bg-[var(--panel)]">
              <Image
                src={desktop.src}
                alt={`${project.client_name} — desktop`}
                width={2160}
                height={1350}
                priority
                sizes="(min-width: 1024px) 1120px, 100vw"
                className="w-full"
              />
            </div>
          )}

          {/* Metrics only render when they exist. An empty stat row is worse
              than none — it reads as a claim the page failed to make. */}
          {project.metrics.length > 0 && (
            <ul className="mt-14 grid gap-8 sm:grid-cols-3">
              {project.metrics.map((metric) => (
                <li key={metric.label.en} className="flex flex-col gap-2">
                  <span className="font-display text-4xl font-semibold tracking-tight text-[var(--link)]">
                    {metric.value}
                  </span>
                  <span className="text-sm text-[var(--fg-dim)]">
                    {pickLocale(metric.label, active)}
                  </span>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-20 flex flex-col gap-12">
            <Chapter label={t("problem")} body={pickLocale(project.challenge, active)} />
            <Chapter label={t("solution")} body={pickLocale(project.solution, active)} />
            <Chapter label={t("result")} body={pickLocale(project.outcome, active)} />
          </div>

          {mobile && (
            <div className="mt-20 grid items-center gap-10 border-t border-[var(--hairline)] pt-14 md:grid-cols-[14rem_1fr] md:gap-12">
              <h2 className="font-mono text-[0.68rem] uppercase tracking-[0.14em] text-[var(--fg-faint)]">
                {t("onPhone")}
              </h2>
              <div className="max-w-[300px] overflow-hidden rounded-2xl border border-[var(--hairline)] bg-[var(--panel)]">
                <Image
                  src={mobile.src}
                  alt={`${project.client_name} — mobile`}
                  width={1170}
                  height={1992}
                  sizes="300px"
                  className="w-full"
                />
              </div>
            </div>
          )}

          {project.testimonials && project.testimonials.length > 0 && (
            <div className="mt-20 border-t border-[var(--hairline)] pt-14">
              {project.testimonials.map((quote) => (
                <figure key={quote.id} className="max-w-[62ch]">
                  <blockquote className="font-display text-2xl font-medium leading-snug tracking-tight">
                    “{pickLocale(quote.quote, active)}”
                  </blockquote>
                  <figcaption className="mt-5 font-mono text-[0.7rem] uppercase tracking-[0.14em] text-[var(--fg-faint)]">
                    {quote.author_name}
                    {quote.author_role ? ` · ${quote.author_role}` : ""}
                  </figcaption>
                </figure>
              ))}
            </div>
          )}
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
