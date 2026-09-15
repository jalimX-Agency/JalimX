import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { ClosingBlock } from "@/components/site/footer";
import { Header } from "@/components/site/header";
import { ProjectImage } from "@/components/site/project-media";
import { SiteFrame } from "@/components/site/site-frame";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import type { Locale, Project } from "@/lib/api/client";
import { api, t as pickLocale } from "@/lib/api/client";
import { text } from "@/lib/settings";
import { getWorkShots, shotFor } from "@/lib/work-shots";

/**
 * One case study.
 *
 * A walkthrough of the thing rather than a description of it: the whole site
 * scrolls inside its frame at the top, the narrative runs underneath, and the
 * phone sits where the narrative talks about it. The reader sees the finished
 * work before reading a word about it, and the live address is on screen the
 * whole time so nothing here has to be taken on trust.
 *
 * Gone: "Built with Next.js · Laravel · PostgreSQL" and the WEB / BOOKING / SEO
 * chips. This is an agency's site rather than a developer's portfolio, and the
 * person deciding whether to hire us has no use for either — if they ask, that
 * is an answer on a call.
 */

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
      projects.map((project) => ({ locale, slug: project.slug })),
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
    // The cover is what a shared link shows. Without one, the platform picks
    // whatever image it finds first on the page, which is rarely the right one.
    ...(project.cover
      ? {
          openGraph: {
            images: [
              {
                url: project.cover.url,
                ...(project.cover.width && project.cover.height
                  ? { width: project.cover.width, height: project.cover.height }
                  : {}),
                alt: project.cover.alt || project.client_name,
              },
            ],
          },
        }
      : {}),
    alternates: {
      languages: { en: `/work/${slug}`, fr: `/fr/work/${slug}` },
    },
  };
}

function Chapter({ label, body }: { label: string; body: string }) {
  // A chapter with nothing in it is worse than no chapter: an empty heading
  // reads as a claim the page failed to make.
  if (!body) return null;

  return (
    <section className="grid gap-4 border-t border-[var(--hairline)] pt-8 md:grid-cols-[13rem_1fr] md:gap-12">
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

  // The whole page where we have it; a single fold is the fallback.
  const site = shotFor(shots, project.slug, "full") ?? shotFor(shots, project.slug, "desktop");
  const phone = shotFor(shots, project.slug, "mobile");
  const metrics = project.metrics ?? [];
  const gallery = project.gallery ?? [];
  const dashboard = project.dashboard ?? [];

  return (
    <>
      <div className="surface-light">
        <Header />

        <main className="mx-auto max-w-6xl px-6 py-14 sm:px-10 md:py-20">
          <Link
            href="/work"
            className="group inline-flex items-center gap-2 font-mono text-[0.68rem] uppercase tracking-[0.14em] text-[var(--fg-faint)] hover:text-[var(--fg)]"
          >
            <span
              aria-hidden="true"
              className="transition-transform duration-200 group-hover:-translate-x-1"
            >
              ←
            </span>{" "}
            {t("allWork")}
          </Link>

          <header className="mt-10 grid gap-8 lg:grid-cols-[1fr_auto] lg:items-end lg:gap-16">
            <div className="max-w-[56ch]">
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
            </div>

            {project.project_url && (
              <p className="shrink-0">
                <span className="block font-mono text-[0.62rem] uppercase tracking-[0.14em] text-[var(--fg-faint)]">
                  {t("live")}
                </span>
                <a
                  href={project.project_url}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="group mt-1.5 inline-flex items-center gap-2 text-[var(--link)] underline-offset-4 hover:underline"
                >
                  {new URL(project.project_url).hostname.replace(/^www\./, "")}
                  <span
                    aria-hidden="true"
                    className="transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
                  >
                    ↗
                  </span>
                </a>
              </p>
            )}
          </header>

          {!site && project.cover && (
            <div className="mt-12 overflow-hidden rounded-xl border border-[var(--hairline)] bg-[var(--panel)] md:mt-14">
              <ProjectImage
                media={project.cover}
                alt={`${project.client_name} — ${pickLocale(project.title, active)}`}
                sizes="(min-width: 1152px) 1072px, 100vw"
                priority
                className="w-full"
              />
            </div>
          )}

          {site && (
            <div className="mt-12 md:mt-14">
              <SiteFrame
                src={site.src}
                url={site.url}
                alt={`${project.client_name} — ${pickLocale(project.title, active)}`}
                width={site.width ?? 1280}
                height={site.height ?? 800}
                ratio="16 / 9"
                priority
              />
            </div>
          )}

          {/* Figures only where a project has them. An empty stat row reads as
              a claim the page failed to make. */}
          {metrics.length > 0 && (
            <dl className="mt-14 grid gap-8 border-t border-[var(--hairline)] pt-10 sm:grid-cols-3">
              {metrics.map((metric) => {
                const label = pickLocale(metric.label, active);
                return (
                  <div key={label} className="flex flex-col">
                    <dd className="font-display text-[2.75rem] font-semibold leading-none tabular-nums tracking-tight text-[var(--link)]">
                      {metric.value}
                    </dd>
                    <dt className="mt-3 font-mono text-[0.66rem] uppercase tracking-[0.14em] text-[var(--fg-faint)]">
                      {label}
                    </dt>
                  </div>
                );
              })}
            </dl>
          )}

          <div className="mt-16 flex flex-col gap-12 md:mt-20">
            <Chapter
              label={t("problem")}
              body={pickLocale(project.challenge, active)}
            />
            <Chapter
              label={t("solution")}
              body={pickLocale(project.solution, active)}
            />

            {/*
              The client's own admin, right after the claim that they run the
              site themselves. It is the only evidence for that sentence a
              reader can actually look at.
            */}
            {dashboard.length > 0 && (
              <section className="grid gap-8 border-t border-[var(--hairline)] pt-8 md:grid-cols-[13rem_1fr] md:gap-12">
                <div>
                  <h2 className="font-mono text-[0.68rem] uppercase tracking-[0.14em] text-[var(--fg-faint)]">
                    {t("owner")}
                  </h2>
                  <p className="mt-3 max-w-[22ch] text-sm leading-relaxed text-[var(--fg-dim)]">
                    {t("ownerNote")}
                  </p>
                </div>
                <div className="grid gap-5">
                  {dashboard.map((media) => (
                    <figure
                      key={media.id}
                      // A screenshot of the admin on a phone is portrait; at
                      // full column width it would run several screens tall.
                      className={`overflow-hidden rounded-lg border border-[var(--hairline)] bg-[var(--panel)] shadow-sm ${
                        (media.height ?? 0) > (media.width ?? 0) ? "max-w-sm" : ""
                      }`}
                    >
                      <ProjectImage
                        media={media}
                        alt={`${project.client_name} — ${t("owner")}`}
                        sizes="(min-width: 1152px) 810px, 100vw"
                        className="block w-full"
                      />
                    </figure>
                  ))}
                </div>
              </section>
            )}

            {phone && (
              <section className="grid gap-8 border-t border-[var(--hairline)] pt-8 md:grid-cols-[13rem_1fr] md:gap-12">
                <h2 className="font-mono text-[0.68rem] uppercase tracking-[0.14em] text-[var(--fg-faint)]">
                  {t("onPhone")}
                </h2>
                <div className="flex flex-wrap items-end gap-x-10 gap-y-6">
                  {/* A device rather than a bare screenshot: at this width a
                      1170px-wide image with square corners reads as a stray
                      graphic instead of as a phone. */}
                  <div className="w-[248px] shrink-0 overflow-hidden rounded-[1.75rem] border-[6px] border-[var(--color-ink)] bg-[var(--color-ink)] shadow-lg">
                    <Image
                      src={phone.src}
                      alt={`${project.client_name} — ${t("onPhone")}`}
                      width={phone.width ?? 1170}
                      height={phone.height ?? 1992}
                      sizes="248px"
                      className="block w-full rounded-[1.3rem]"
                    />
                  </div>

                  {/* The capture's own profile. It fills the space beside the
                      device with something checkable rather than a caption
                      written to fill it. */}
                  <dl className="font-mono text-[0.66rem] uppercase tracking-[0.14em]">
                    <div className="flex gap-3 py-1">
                      <dt className="w-24 text-[var(--fg-faint)]">{t("captured")}</dt>
                      <dd className="tabular-nums text-[var(--fg-dim)]">
                        {phone.width ?? 1170} × {phone.height ?? 1992}
                      </dd>
                    </div>
                    <div className="flex gap-3 py-1">
                      <dt className="w-24 text-[var(--fg-faint)]">{t("device")}</dt>
                      <dd className="text-[var(--fg-dim)]">iPhone 13</dd>
                    </div>
                  </dl>
                </div>
              </section>
            )}

            <Chapter
              label={t("result")}
              body={pickLocale(project.outcome, active)}
            />

            {/* The business itself, last: after the reader knows what was done
                for it, rather than as decoration before they do. */}
            {gallery.length > 0 && (
              <section className="grid gap-8 border-t border-[var(--hairline)] pt-8 md:grid-cols-[13rem_1fr] md:gap-12">
                <h2 className="font-mono text-[0.68rem] uppercase tracking-[0.14em] text-[var(--fg-faint)]">
                  {t("onLocation")}
                </h2>
                <div
                  className={`grid gap-4 ${gallery.length > 1 ? "sm:grid-cols-2" : ""}`}
                >
                  {gallery.map((media, i) => (
                    <figure
                      key={media.id}
                      // An odd count would leave the last photo alone in its
                      // row; let it take the full width instead.
                      className={`overflow-hidden rounded-lg bg-[var(--panel)] ${
                        gallery.length % 2 === 1 && i === gallery.length - 1 && gallery.length > 1
                          ? "sm:col-span-2"
                          : ""
                      }`}
                    >
                      <ProjectImage
                        media={media}
                        alt={`${project.client_name} — ${t("onLocation")}`}
                        sizes="(min-width: 1152px) 400px, (min-width: 640px) 50vw, 100vw"
                        className="block h-full w-full object-cover"
                      />
                    </figure>
                  ))}
                </div>
              </section>
            )}
          </div>

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
