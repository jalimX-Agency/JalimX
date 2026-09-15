"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { MediaDrop } from "@/components/admin/media-drop";
import { admin, type ProjectDetail } from "@/lib/admin/client";

export default function ProjectPage() {
  const { slug } = useParams<{ slug: string }>();
  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    admin.project(slug).then(setProject, (e) => setError(e.message));
  }, [slug]);

  useEffect(load, [load]);

  if (error) {
    return <p role="alert" className="text-sm text-[var(--color-signal)]">{error}</p>;
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

      <p className="mt-4 max-w-[64ch] text-sm text-[var(--fg-dim)]">
        Changes here reach the public site on their own — the page rebuilds a
        few seconds after an image is added or removed.
      </p>

      <div className="mt-10 flex flex-col gap-8">
        <MediaDrop
          slug={project.slug}
          collection="cover"
          title="Cover"
          hint="One image · used on the work index and when the link is shared"
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
    </div>
  );
}
