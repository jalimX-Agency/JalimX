import type { Metadata } from "next";
import Image from "next/image";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { ClosingBlock } from "@/components/site/footer";
import { Header } from "@/components/site/header";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import type { Locale, Project } from "@/lib/api/client";
import { api, t as pickLocale } from "@/lib/api/client";
import { text } from "@/lib/settings";
import { getWorkShots, shotFor } from "@/lib/work-shots";

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
            <ul className="mt-20 flex flex-col gap-24 md:gap-32">
              {projects.map((project, i) => {
                const shot = shotFor(shots, project.slug);

                return (
                  <li key={project.slug}>
                    <article className="grid gap-8 md:grid-cols-12 md:items-center md:gap-12">
                      <div
                        className={`md:col-span-7 ${i % 2 === 1 ? "md:order-2" : ""}`}
                      >
                        <Link
                          href={`/work/${project.slug}`}
                          className="group block overflow-hidden rounded-xl border border-[var(--hairline)] bg-[var(--panel)]"
                        >
                          {shot ? (
                            <Image
                              src={shot.src}
                              alt={`${project.client_name} — ${pickLocale(project.title, active)}`}
                              width={2160}
                              height={1350}
                              sizes="(min-width: 768px) 640px, 100vw"
                              className="w-full transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.015]"
                            />
                          ) : (
                            <div className="flex aspect-[16/10] items-center justify-center">
                              <span className="font-mono text-xs text-[var(--fg-faint)]">
                                {t("notLaunched")}
                              </span>
                            </div>
                          )}
                        </Link>
                      </div>

                      <div className="md:col-span-5">
                        <p className="font-mono text-[0.68rem] uppercase tracking-[0.14em] text-[var(--fg-faint)]">
                          {project.client_name}
                          {project.year ? ` · ${project.year}` : ""}
                        </p>

                        <h2 className="mt-3 font-display text-2xl font-semibold tracking-tight">
                          <Link
                            href={`/work/${project.slug}`}
                            className="underline-offset-4 hover:underline"
                          >
                            {pickLocale(project.title, active)}
                          </Link>
                        </h2>

                        <p className="mt-4 text-[var(--fg-dim)]">
                          {pickLocale(project.summary, active)}
                        </p>

                        <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-3">
                          <ul className="flex flex-wrap gap-1.5">
                            {project.tags.map((tag) => (
                              <li
                                key={tag}
                                className="rounded border border-[var(--hairline)] px-2 py-0.5 font-mono text-[0.62rem] uppercase tracking-wider text-[var(--fg-faint)]"
                              >
                                {tag}
                              </li>
                            ))}
                          </ul>

                          <Link
                            href={`/work/${project.slug}`}
                            className="ml-auto inline-flex items-center gap-1.5 text-sm text-[var(--link)] underline-offset-4 hover:underline"
                          >
                            {t("readCase")}
                            <span aria-hidden="true">→</span>
                          </Link>
                        </div>
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
