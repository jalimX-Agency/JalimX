"use client";

/* eslint-disable @next/next/no-img-element -- dashboard thumbnails come from
   the R2 CDN and need no optimisation pass; next/image would only add a
   remote-pattern config and a resize round-trip for a 56px square. */

import Link from "next/link";
import { useEffect, useState } from "react";

import { admin, type ProjectSummary } from "@/lib/admin/client";

export default function ProjectsPage() {
  const [projects, setProjects] = useState<ProjectSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    admin.projects().then(setProjects, (e) => setError(e.message));
  }, []);

  return (
    <div className="max-w-5xl">
      <p className="font-mono text-[0.66rem] uppercase tracking-[0.16em] text-[var(--fg-faint)]">
        Content
      </p>
      <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight">
        Projects
      </h1>
      <p className="mt-2 max-w-[60ch] text-sm text-[var(--fg-dim)]">
        Every case study, including the ones not on the site yet. Open one to
        add its cover, gallery and dashboard screenshots.
      </p>

      {error && (
        <p role="alert" className="mt-8 text-sm text-[var(--color-signal)]">
          {error}
        </p>
      )}

      {projects && (
        <ul className="mt-10 grid gap-px border border-[var(--hairline)] bg-[var(--hairline)]">
          {projects.map((p) => (
            <li key={p.slug}>
              <Link
                href={`/admin/projects/${p.slug}`}
                className="group flex items-center gap-5 bg-[var(--panel)] px-5 py-4 transition-colors hover:bg-[color-mix(in_oklab,var(--link)_4%,var(--panel))]"
              >
                <div className="flex h-14 w-20 shrink-0 items-center justify-center overflow-hidden bg-[var(--ground)]">
                  {p.cover ? (
                    <img src={p.cover.url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <span className="font-mono text-[0.58rem] uppercase tracking-[0.12em] text-[var(--fg-faint)]">
                      No cover
                    </span>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <p className="font-mono text-[0.62rem] uppercase tracking-[0.14em] text-[var(--fg-faint)]">
                    {p.client_name}
                    {p.year ? ` · ${p.year}` : ""}
                  </p>
                  <p className="mt-1 truncate font-medium">{p.title.en}</p>
                </div>

                <dl className="hidden gap-6 font-mono text-[0.62rem] uppercase tracking-[0.12em] text-[var(--fg-faint)] sm:flex">
                  <div className="text-right">
                    <dt>Gallery</dt>
                    <dd className="mt-0.5 text-sm tabular-nums text-[var(--fg)]">{p.counts.gallery}</dd>
                  </div>
                  <div className="text-right">
                    <dt>Dashboard</dt>
                    <dd className="mt-0.5 text-sm tabular-nums text-[var(--fg)]">{p.counts.dashboard}</dd>
                  </div>
                </dl>

                <span
                  className={`w-24 shrink-0 text-center font-mono text-[0.6rem] uppercase tracking-[0.12em] ${
                    p.is_published ? "text-[var(--link)]" : "text-[var(--fg-faint)]"
                  }`}
                >
                  {p.is_published ? "Published" : "Hidden"}
                </span>

                <span
                  aria-hidden="true"
                  className="text-[var(--fg-faint)] transition-transform group-hover:translate-x-0.5"
                >
                  →
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
