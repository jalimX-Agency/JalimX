import Image from "next/image";
import { getTranslations } from "next-intl/server";

import { ProjectImage } from "@/components/site/project-media";
import { Link } from "@/i18n/navigation";
import type { Locale, Project } from "@/lib/api/client";
import { t as pickLocale } from "@/lib/api/client";
import { shotFor, type WorkShot } from "@/lib/work-shots";

/**
 * The homepage's proof.
 *
 * Screenshots plus a link out to the real thing — no iframes. Five embedded
 * sites would make this the slowest page we ship, most refuse framing anyway,
 * and a client redesign would break the portfolio silently. The link is what
 * makes it verifiable; the picture is what makes it fast.
 */

type Props = {
  projects: Project[];
  shots: Map<string, WorkShot[]>;
  locale: Locale;
};

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function Card({
  project,
  shot,
  locale,
  featured,
  readLabel,
}: {
  project: Project;
  shot?: WorkShot;
  locale: Locale;
  featured?: boolean;
  readLabel: string;
}) {
  const href = `/work/${project.slug}`;
  const alt = `${project.client_name} — ${pickLocale(project.title, locale)}`;
  const sizes = featured
    ? "(min-width: 1024px) 1120px, 100vw"
    : "(min-width: 1024px) 550px, 100vw";
  const zoom =
    "w-full transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.015]";

  return (
    <article className="group flex flex-col gap-6">
      {/* The same rule as the work page and the case study: the capture of
          the live site first, the cover from the dashboard when there is none.
          The whole card opens the case study. */}
      <Link
        href={href}
        aria-label={alt}
        tabIndex={-1}
        className="block overflow-hidden rounded-xl border border-[var(--hairline)] bg-[var(--panel)]"
      >
        {shot ? (
          <Image
            src={shot.src}
            alt={alt}
            width={shot.width ?? 1920}
            height={shot.height ?? 1080}
            priority={featured}
            sizes={sizes}
            className={zoom}
          />
        ) : project.cover ? (
          <ProjectImage
            media={project.cover}
            alt={alt}
            priority={featured}
            sizes={sizes}
            className={zoom}
          />
        ) : (
          // Nothing to show yet: the client's name, not a note to ourselves.
          <span className="flex aspect-[16/10] items-center justify-center font-display text-xl font-semibold tracking-tight text-[var(--fg-faint)]">
            {project.client_name}
          </span>
        )}
      </Link>

      <div className="flex flex-col gap-3">
        <p className="font-mono text-[0.68rem] uppercase tracking-[0.14em] text-[var(--fg-faint)]">
          {project.client_name}
          {project.year ? ` · ${project.year}` : ""}
        </p>

        <h3
          className={
            featured
              ? "font-display text-2xl font-semibold tracking-tight sm:text-3xl"
              : "font-display text-xl font-semibold tracking-tight"
          }
        >
          <Link href={href} className="underline-offset-4 hover:underline">
            {pickLocale(project.title, locale)}
          </Link>
        </h3>

        <p className="max-w-[52ch] text-[var(--fg-dim)]">
          {pickLocale(project.summary, locale)}
        </p>

        <div className="mt-1 flex flex-wrap items-center gap-x-5 gap-y-3">
          <Link
            href={href}
            className="group/read inline-flex items-center gap-2 text-sm text-[var(--link)] underline-offset-4 hover:underline"
          >
            {readLabel}
            <span
              aria-hidden="true"
              className="transition-transform duration-200 group-hover/read:translate-x-1"
            >
              →
            </span>
          </Link>

          {project.project_url && (
            <a
              href={project.project_url}
              target="_blank"
              rel="noreferrer"
              className="ml-auto inline-flex items-center gap-2 text-sm text-[var(--link)] underline-offset-4 hover:underline"
            >
              {hostOf(project.project_url)}
              <span aria-hidden="true">↗</span>
            </a>
          )}
        </div>
      </div>
    </article>
  );
}

export async function WorkSection({ projects, shots, locale }: Props) {
  const t = await getTranslations("work");

  if (projects.length === 0) return null;

  const [lead, ...rest] = projects;
  const readLabel = t("readCase");

  return (
    <section
      id="work"
      className="mx-auto max-w-6xl px-6 pb-28 sm:px-10 md:pb-40"
    >
      <div className="flex items-baseline justify-between border-t border-[var(--hairline)] pt-8">
        <h2 className="font-display text-sm font-semibold uppercase tracking-[0.14em]">
          {t("heading")}
        </h2>
        <Link
          href="/work"
          className="text-sm text-[var(--fg-dim)] underline-offset-4 hover:text-[var(--fg)] hover:underline"
        >
          {t("allProjects")}
        </Link>
      </div>

      <div className="mt-14 flex flex-col gap-20 md:gap-28">
        {/* One cell deliberately twice the others — an evenly tiled grid of
            three is the shape every template already has. */}
        <Card
          project={lead}
          shot={shotFor(shots, lead.slug, "desktop")}
          locale={locale}
          featured
          readLabel={readLabel}
        />

        {rest.length > 0 && (
          <div className="grid gap-20 md:grid-cols-2 md:gap-10">
            {rest.map((project) => (
              <Card
                key={project.slug}
                project={project}
                shot={shotFor(shots, project.slug, "desktop")}
                locale={locale}
                readLabel={readLabel}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
