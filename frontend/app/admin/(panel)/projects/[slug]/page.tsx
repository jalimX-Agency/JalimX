"use client";

import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";

import { MediaDrop } from "@/components/admin/media-drop";
import { ProjectForm } from "@/components/admin/project-form";
import { admin, type ProjectDetail } from "@/lib/admin/client";

export default function ProjectPage() {
  return (
    <Suspense>
      <Project />
    </Suspense>
  );
}

function Project() {
  const { slug } = useParams<{ slug: string }>();
  const router = useRouter();
  // The tab lives in the URL so a reload, or a link to the images, lands there.
  const tab = useSearchParams().get("tab") === "images" ? "images" : "content";
  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    admin.project(slug).then(setProject, (e) => setError(e.message));
  }, [slug]);

  useEffect(load, [load]);

  if (error) {
    return (
      <p role="alert" className="text-sm text-[var(--color-signal)]">
        {error}
      </p>
    );
  }
  if (!project) return null;

  return (
    <div className="max-w-5xl">
      <Link
        href="/admin/projects"
        className="font-mono text-[0.66rem] uppercase tracking-[0.14em] text-[var(--fg-faint)] hover:text-[var(--fg)]"
      >
        ← Projects
      </Link>

      <div className="mt-6 flex flex-wrap items-end justify-between gap-6">
        <div>
          <p className="font-mono text-[0.66rem] uppercase tracking-[0.16em] text-[var(--link)]">
            {project.client_name}
            {project.year ? ` · ${project.year}` : ""}
          </p>
          <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight">
            {project.title.en}
          </h1>
        </div>

        <div className="flex items-center gap-5 text-sm">
          <span
            className={`font-mono text-[0.62rem] uppercase tracking-[0.12em] ${
              project.is_published ? "text-[var(--link)]" : "text-[var(--fg-faint)]"
            }`}
          >
            {project.is_published ? "Published" : "Hidden"}
          </span>
          {project.is_published && (
            <a
              href={`/work/${project.slug}`}
              target="_blank"
              rel="noreferrer"
              className="text-[var(--link)] underline-offset-4 hover:underline"
            >
              Case study ↗
            </a>
          )}
          {project.project_url && (
            <a
              href={project.project_url}
              target="_blank"
              rel="noreferrer"
              className="text-[var(--fg-dim)] underline-offset-4 hover:underline"
            >
              Live site ↗
            </a>
          )}
        </div>
      </div>

      <div role="tablist" className="mt-8 flex border-b border-[var(--hairline)]">
        {(["content", "images"] as const).map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={tab === t}
            onClick={() =>
              router.replace(
                `/admin/projects/${project.slug}${t === "images" ? "?tab=images" : ""}`
              )
            }
            className={`-mb-px border-b-2 px-4 py-2.5 text-sm ${
              tab === t
                ? "border-[var(--link)] text-[var(--fg)]"
                : "border-transparent text-[var(--fg-dim)] hover:text-[var(--fg)]"
            }`}
          >
            {t === "content"
              ? "Content"
              : `Images · ${(project.cover ? 1 : 0) + project.gallery.length + project.dashboard.length}`}
          </button>
        ))}
      </div>

      <p className="mt-4 max-w-[64ch] text-sm text-[var(--fg-dim)]">
        Changes reach the public site on their own, a few seconds after they are saved.
      </p>

      {/* Hidden rather than unmounted, so switching to the images and back
          does not throw away words that have not been saved yet. */}
      <div hidden={tab !== "content"}>
        <div className="mt-8">
          <ProjectForm
            key={project.slug}
            project={project}
            onSaved={(next) => {
              setProject(next);
              // A renamed address moves the dashboard page along with it.
              if (next.slug !== slug) router.replace(`/admin/projects/${next.slug}`);
            }}
          />
        </div>
      </div>

      {tab === "images" && (
        <div className="mt-8 flex flex-col gap-8">
          <MediaDrop
            slug={project.slug}
            collection="cover"
            title="Cover"
            hint="One image · the homepage card and link previews"
            items={project.cover ? [project.cover] : []}
            single
            onChange={load}
          />
          <MediaDrop
            slug={project.slug}
            collection="gallery"
            title="Gallery"
            hint="Photos of the client's business, shown through the case study"
            items={project.gallery}
            onChange={load}
          />
          <MediaDrop
            slug={project.slug}
            collection="dashboard"
            title="Dashboard screenshots"
            hint="The client's admin, as proof the owner runs it"
            warning="No customer names, emails, phone numbers or bookings in these. Use pages like prices, rooms or tours — never reservations or messages."
            items={project.dashboard}
            onChange={load}
          />
        </div>
      )}
    </div>
  );
}
