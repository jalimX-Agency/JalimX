import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { ClosingBlock } from "@/components/site/footer";
import { Header } from "@/components/site/header";
import { SiteFrame } from "@/components/site/site-frame";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import type { Locale, Project } from "@/lib/api/client";
import { api, t as pickLocale } from "@/lib/api/client";
import { text } from "@/lib/settings";
import { getWorkShots, shotFor } from "@/lib/work-shots";

/**
 * The work index.
 *
 * Each project is the client's whole site, scrolling inside a frame with its
 * real address above it — so a visitor sees the finished thing rather than a
 * card describing it, and can go and check.
 *
 * The tag chips are gone. "WEB · BOOKING · SEO" appeared on every card and
 * separated nothing; what a buyer wants to know is what the site had to do and
 * what came of it, which is what the sentence and the outcome line carry.
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
  const t = await getTranslations({ locale, namespace: "work" });

  return {
    title: t("pageTitle"),
    description: t("pageDescription"),
    alternates: { languages: { en: "/work", fr: "/fr/work" } },
  };
}

async function getProjects(): Promise<Project[]> {
  try {
    return await api.projects.list();
  } catch {
    return [];
  }
}

export default async function WorkPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("work");
  const active = locale as Locale;

  const [projects, settings, shots] = await Promise.all([
    getProjects(),
    api.settings.all().catch(() => ({}) as Record<string, unknown>),
    getWorkShots(),
  ]);

  return (
    <>
      <div className="surface-light">
        <Header />

        <main className="mx-auto max-w-6xl px-6 py-16 sm:px-10 md:py-24">
          <header className="max-w-[52ch]">
            <p className="font-mono text-[0.72rem] uppercase tracking-[0.18em] text-[var(--fg-faint)]">
              {t("pageTitle")}
            </p>
            <h1 className="mt-6 font-display text-[clamp(2.4rem,5.5vw,3.8rem)] font-semibold leading-[1.02] tracking-[-0.02em] text-balance">
              {t("pageHeading")}
            </h1>
          </header>

          {projects.length === 0 ? (
            <p className="mt-16 text-[var(--fg-dim)]">{t("empty")}</p>
          ) : (
            <ul className="mt-16 flex flex-col gap-20 md:mt-20 md:gap-28">
              {projects.map((project, i) => {
                // The whole page if we have it; the single fold is the
                // fallback for a site captured before full-page shots existed.
                const shot =
                  shotFor(shots, project.slug, "full") ??
                  shotFor(shots, project.slug, "desktop");

                const metrics = project.metrics ?? [];

                return (
                  <li key={project.slug}>
                    <article className="grid gap-8 lg:grid-cols-12 lg:items-start lg:gap-12">
                      <div className="lg:col-span-7">
                        {shot ? (
                          <SiteFrame
                            src={shot.src}
                            url={shot.url}
                            alt={`${project.client_name} — ${pickLocale(project.title, active)}`}
                            width={shot.width ?? 1280}
                            height={shot.height ?? 800}
                            // Only the first one is above the fold; the rest
                            // would be three large images racing the LCP.
                            priority={i === 0}
                          />
                        ) : (
                          <div className="flex aspect-[16/10] items-center justify-center rounded-xl border border-[var(--hairline)] bg-[var(--panel)]">
                            <span className="font-mono text-xs text-[var(--fg-faint)]">
                              {t("notLaunched")}
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="lg:col-span-5 lg:pt-4">
                        <p className="font-mono text-[0.68rem] uppercase tracking-[0.14em] text-[var(--fg-faint)]">
                          {project.client_name}
                          {project.year ? ` · ${project.year}` : ""}
                        </p>

                        <h2 className="mt-3 font-display text-[1.7rem] font-semibold leading-tight tracking-tight">
                          <Link
                            href={`/work/${project.slug}`}
                            className="underline-offset-4 hover:underline"
                          >
                            {pickLocale(project.title, active)}
                          </Link>
                        </h2>

                        <p className="mt-4 max-w-[46ch] leading-relaxed text-[var(--fg-dim)]">
                          {pickLocale(project.summary, active)}
                        </p>

                        {/* Figures, where the project has any. Rendered as a
                            row of value-over-label pairs rather than prose,
                            because a number is the one thing on this page a
                            reader will stop for. */}
                        {metrics.length > 0 && (
                          <dl className="mt-7 flex flex-wrap gap-x-10 gap-y-4 border-t border-[var(--hairline)] pt-6">
                            {metrics.map((metric) => {
                              // The label is prose and translated; the value
                              // is a plain string, because "343" reads the same
                              // in both languages.
                              const label = pickLocale(metric.label, active);
                              return (
                                <div key={label} className="flex flex-col">
                                  <dt className="order-2 mt-1 font-mono text-[0.62rem] uppercase tracking-[0.14em] text-[var(--fg-faint)]">
                                    {label}
                                  </dt>
                                  <dd className="order-1 font-display text-2xl font-semibold tabular-nums tracking-tight">
                                    {metric.value}
                                  </dd>
                                </div>
                              );
                            })}
                          </dl>
                        )}

                        <Link
                          href={`/work/${project.slug}`}
                          className="group mt-7 inline-flex items-center gap-2 text-sm text-[var(--link)] underline-offset-4 hover:underline"
                        >
                          {t("readCase")}
                          <span
                            aria-hidden="true"
                            className="transition-transform duration-200 group-hover:translate-x-1"
                          >
                            →
                          </span>
                        </Link>
                      </div>
                    </article>
                  </li>
                );
              })}
            </ul>
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
