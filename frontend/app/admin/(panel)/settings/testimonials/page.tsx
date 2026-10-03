"use client";

import { useEffect, useState } from "react";

import { useConfirm } from "@/components/admin/confirm";
import { Field, Toggle } from "@/components/admin/fields";
import { RowsSkeleton } from "@/components/admin/skeleton";
import { useToast } from "@/components/admin/toast";
import {
  admin,
  ApiError,
  isSignedOut,
  type ProjectSummary,
  type TestimonialInput,
  type TestimonialRow,
} from "@/lib/admin/client";

/**
 * The client quotes the site shows on the homepage and under a case study.
 *
 * A new one starts hidden: each is approved in writing by the person named
 * (docs/collecting-testimonials.md), and nothing should go public by accident.
 */

const EMPTY: TestimonialInput = {
  author_name: "",
  author_role: null,
  client_name: null,
  project_slug: null,
  position: 0,
  is_published: false,
  quote: { en: "", fr: "" },
};

export default function TestimonialsPage() {
  const [rows, setRows] = useState<TestimonialRow[] | null>(null);
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  // `null` closed, `0` a new quote, otherwise the id being edited.
  const [open, setOpen] = useState<number | null>(null);

  const load = () =>
    admin.testimonials().then(setRows, (e) => !isSignedOut(e) && setError(e.message));

  useEffect(() => {
    let live = true;
    admin.testimonials().then(
      (r) => live && setRows(r),
      (e) => live && !isSignedOut(e) && setError(e.message),
    );
    admin.projects().then((p) => live && setProjects(p), () => {});
    return () => {
      live = false;
    };
  }, []);

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="font-display text-3xl font-semibold tracking-tight">Testimonials</h1>
        {open === null && (
          <button
            type="button"
            onClick={() => setOpen(0)}
            className="bg-[var(--fg)] px-4 py-2.5 font-mono text-[0.66rem] uppercase tracking-[0.12em] text-[var(--ground)]"
          >
            + New quote
          </button>
        )}
      </div>
      <p className="mt-2 max-w-[60ch] text-sm text-[var(--fg-dim)]">
        What clients say, on the homepage and under their case study. Only publish a quote the
        person has approved in writing.
      </p>

      {error && (
        <p role="alert" className="mt-8 text-sm text-[var(--color-signal)]">
          {error}
        </p>
      )}

      {open === 0 && (
        <Editor
          projects={projects}
          initial={{ ...EMPTY, position: rows?.length ?? 0 }}
          onDone={() => {
            setOpen(null);
            load();
          }}
          onCancel={() => setOpen(null)}
        />
      )}

      {!rows && !error && <RowsSkeleton rows={3} />}

      {rows && rows.length === 0 && open !== 0 && (
        <p className="mt-10 text-sm text-[var(--fg-faint)]">No quotes yet.</p>
      )}

      {rows && rows.length > 0 && (
        <ul className="mt-10 grid gap-px border border-[var(--hairline)] bg-[var(--hairline)]">
          {rows.map((row) => (
            <li key={row.id} className="bg-[var(--panel)]">
              {open === row.id ? (
                <Editor
                  projects={projects}
                  id={row.id}
                  initial={row}
                  onDone={() => {
                    setOpen(null);
                    load();
                  }}
                  onCancel={() => setOpen(null)}
                />
              ) : (
                <button
                  type="button"
                  onClick={() => setOpen(row.id)}
                  className="flex w-full items-start gap-5 px-5 py-4 text-left hover:bg-[color-mix(in_oklab,var(--link)_4%,var(--panel))]"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-mono text-[0.62rem] uppercase tracking-[0.14em] text-[var(--fg-faint)]">
                      {row.author_name}
                      {row.client_name ? ` · ${row.client_name}` : ""}
                    </p>
                    <p className="mt-1 line-clamp-2 text-sm">{row.quote.en || row.quote.fr}</p>
                  </div>
                  <span
                    className={`shrink-0 font-mono text-[0.6rem] uppercase tracking-[0.12em] ${
                      row.is_published ? "text-[var(--link)]" : "text-[var(--fg-faint)]"
                    }`}
                  >
                    {row.is_published ? "Published" : "Hidden"}
                  </span>
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Editor({
  initial,
  id,
  projects,
  onDone,
  onCancel,
}: {
  initial: TestimonialInput;
  id?: number;
  projects: ProjectSummary[];
  onDone: () => void;
  onCancel: () => void;
}) {
  const [input, setInput] = useState<TestimonialInput>(initial);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [busy, setBusy] = useState(false);
  const ask = useConfirm();
  const toast = useToast();

  const set = <K extends keyof TestimonialInput>(key: K, value: TestimonialInput[K]) =>
    setInput((i) => ({ ...i, [key]: value }));
  const err = (key: string) => errors[key]?.[0];

  async function save() {
    setBusy(true);
    try {
      await admin.saveTestimonial(input, id);
      toast.success("Saved — the site updates in a few seconds.");
      onDone();
    } catch (e) {
      if (e instanceof ApiError && e.status === 422) {
        setErrors(e.errors);
      } else {
        toast.error(e instanceof Error ? e.message : "Saving failed.");
      }
      setBusy(false);
    }
  }

  async function remove() {
    if (
      !id ||
      !(await ask({
        title: "Delete this quote?",
        body: "It disappears from the site. To only hide it, switch Published off instead.",
        confirmLabel: "Delete",
        tone: "danger",
      }))
    ) {
      return;
    }
    setBusy(true);
    try {
      await admin.removeTestimonial(id);
      onDone();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Deleting failed.");
      setBusy(false);
    }
  }

  return (
    <div className="mt-6 flex flex-col gap-5 border border-[var(--hairline)] bg-[var(--panel)] p-5 first:mt-6">
      <div className="grid gap-5 sm:grid-cols-3">
        <Field label="Name" error={err("author_name")}>
          <input
            className="admin-input"
            value={input.author_name}
            maxLength={120}
            onChange={(e) => set("author_name", e.target.value)}
          />
        </Field>
        <Field label="Role" hint="e.g. Owner" error={err("author_role")}>
          <input
            className="admin-input"
            value={input.author_role ?? ""}
            maxLength={120}
            onChange={(e) => set("author_role", e.target.value || null)}
          />
        </Field>
        <Field label="Business" error={err("client_name")}>
          <input
            className="admin-input"
            value={input.client_name ?? ""}
            maxLength={120}
            onChange={(e) => set("client_name", e.target.value || null)}
          />
        </Field>
        <Field label="Case study" hint="Shown under that case study" error={err("project_slug")}>
          <select
            className="admin-input"
            value={input.project_slug ?? ""}
            onChange={(e) => set("project_slug", e.target.value || null)}
          >
            <option value="">None — homepage only</option>
            {projects.map((p) => (
              <option key={p.slug} value={p.slug}>
                {p.client_name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Order" hint="Lower comes first" error={err("position")}>
          <input
            className="admin-input tabular-nums"
            inputMode="numeric"
            value={input.position}
            onChange={(e) => set("position", Number(e.target.value.replace(/\D/g, "").slice(0, 3) || 0))}
          />
        </Field>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        {(["en", "fr"] as const).map((locale) => (
          <Field
            key={locale}
            label={locale === "en" ? "Quote · English" : "Quote · Français"}
            error={err(`quote.${locale}`)}
          >
            <textarea
              lang={locale}
              className="admin-input resize-y leading-relaxed"
              rows={4}
              maxLength={600}
              value={input.quote[locale]}
              onChange={(e) => set("quote", { ...input.quote, [locale]: e.target.value })}
            />
          </Field>
        ))}
      </div>

      <Toggle
        label="Published"
        hint={input.is_published ? "Shown on the site" : "Hidden — only visible here"}
        checked={input.is_published}
        onChange={(v) => set("is_published", v)}
      />

      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={save}
          disabled={busy}
          className="bg-[var(--fg)] px-4 py-2.5 font-mono text-[0.66rem] uppercase tracking-[0.12em] text-[var(--ground)] disabled:opacity-40"
        >
          {busy ? "Saving…" : "Save"}
        </button>
        <button type="button" onClick={onCancel} disabled={busy} className="text-sm text-[var(--fg-dim)]">
          Cancel
        </button>
        {id && (
          <button
            type="button"
            onClick={remove}
            disabled={busy}
            className="ml-auto text-sm text-[var(--fg-faint)] hover:text-[var(--color-signal)]"
          >
            Delete
          </button>
        )}
      </div>
    </div>
  );
}
