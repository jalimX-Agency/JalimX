"use client";

import { useEffect, useMemo, useState } from "react";

import {
  admin,
  ApiError,
  type Metric,
  type ProjectDetail,
  type ProjectInput,
  type Translated,
} from "@/lib/admin/client";

/**
 * A case study's words, in both languages side by side.
 *
 * English and French sit next to each other rather than behind a language
 * switch, because the usual mistake is not a typo — it is a French version
 * that stopped matching the English one three edits ago.
 */

const TEXT: {
  key: "title" | "summary" | "challenge" | "solution" | "outcome";
  label: string;
  hint: string;
  rows: number;
  max: number;
}[] = [
  {
    key: "title",
    label: "Headline",
    hint: "The one line under the client's name",
    rows: 1,
    max: 160,
  },
  {
    key: "summary",
    label: "Summary",
    hint: "Two sentences — shown on the work index and in link previews",
    rows: 3,
    max: 1200,
  },
  {
    key: "challenge",
    label: "The problem",
    hint: "What was in the way before the site",
    rows: 5,
    max: 1200,
  },
  {
    key: "solution",
    label: "What we built",
    hint: "What changed, told from the visitor's side",
    rows: 5,
    max: 1200,
  },
  {
    key: "outcome",
    label: "Result",
    hint: "What is different for the business now",
    rows: 5,
    max: 1200,
  },
];

function toInput(p: ProjectDetail): ProjectInput {
  return {
    slug: p.slug,
    client_name: p.client_name,
    year: p.year,
    project_url: p.project_url,
    position: p.position,
    is_published: p.is_published,
    is_featured: p.is_featured,
    title: p.title,
    summary: p.summary,
    challenge: p.challenge,
    solution: p.solution,
    outcome: p.outcome,
    tags: p.tags,
    metrics: p.metrics,
  };
}

type Props = { project: ProjectDetail; onSaved: (next: ProjectDetail) => void };

export function ProjectForm({ project, onSaved }: Props) {
  const initial = useMemo(() => toInput(project), [project]);
  const [input, setInput] = useState<ProjectInput>(initial);
  const [tagText, setTagText] = useState(initial.tags.join(", "));
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const withTags = (i: ProjectInput): ProjectInput => ({
    ...i,
    tags: tagText
      .split(",")
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean),
  });
  const dirty = JSON.stringify(withTags(input)) !== JSON.stringify(initial);

  // Leaving with unsaved words is the one loss here that cannot be recovered.
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const set = <K extends keyof ProjectInput>(key: K, value: ProjectInput[K]) =>
    setInput((i) => ({ ...i, [key]: value }));
  const setText = (key: keyof ProjectInput, locale: keyof Translated, value: string) =>
    setInput((i) => ({ ...i, [key]: { ...(i[key] as Translated), [locale]: value } }));
  const setMetric = (index: number, change: (m: Metric) => Metric) =>
    set(
      "metrics",
      input.metrics.map((m, i) => (i === index ? change(m) : m))
    );

  const err = (key: string) => errors[key]?.[0];

  async function save() {
    setSaving(true);
    setMessage(null);
    try {
      const next = await admin.updateProject(project.slug, withTags(input));
      // The server's version becomes the form: it trims, lowercases tags and
      // drops empty translations, and "dirty" should compare against that.
      setInput(toInput(next));
      setTagText(next.tags.join(", "));
      setErrors({});
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
      onSaved(next);
    } catch (e) {
      if (e instanceof ApiError && e.status === 422) {
        setErrors(e.errors);
        const n = Object.keys(e.errors).length;
        setMessage(n === 1 ? Object.values(e.errors)[0][0] : `${n} fields need attention.`);
      } else {
        setMessage(e instanceof Error ? e.message : "Saving failed.");
      }
    } finally {
      setSaving(false);
    }
  }

  function discard() {
    setInput(initial);
    setTagText(initial.tags.join(", "));
    setErrors({});
    setMessage(null);
  }

  return (
    <div className="flex flex-col gap-8 pb-28">
      {/* Visibility */}
      <section className="border border-[var(--hairline)] bg-[var(--panel)]">
        <Heading title="On the site" />
        <div className="grid gap-px bg-[var(--hairline)] sm:grid-cols-2">
          <Toggle
            label="Published"
            hint={
              input.is_published ? "The case study is live at /work" : "Hidden — only visible here"
            }
            checked={input.is_published}
            onChange={(v) =>
              setInput((i) => ({ ...i, is_published: v, is_featured: v && i.is_featured }))
            }
          />
          <Toggle
            label="On the homepage"
            hint={
              input.is_published
                ? "Shown in the homepage's work section"
                : "Publish the project first"
            }
            checked={input.is_featured}
            disabled={!input.is_published}
            onChange={(v) => set("is_featured", v)}
          />
        </div>
        {(err("title.fr") || err("summary.en") || err("summary.fr")) && input.is_published && (
          <p className="border-t border-[var(--hairline)] px-5 py-2.5 text-xs text-[var(--color-signal)]">
            A published project needs its headline and summary in both languages.
          </p>
        )}
      </section>

      {/* Details */}
      <section className="border border-[var(--hairline)] bg-[var(--panel)]">
        <Heading title="Details" />
        <div className="grid gap-5 p-5 sm:grid-cols-2">
          <Field label="Client" error={err("client_name")}>
            <input
              className="admin-input"
              value={input.client_name}
              maxLength={120}
              onChange={(e) => set("client_name", e.target.value)}
            />
          </Field>
          <Field label="Year" error={err("year")}>
            <input
              className="admin-input tabular-nums"
              inputMode="numeric"
              value={input.year ?? ""}
              onChange={(e) => {
                const digits = e.target.value.replace(/\D/g, "").slice(0, 4);
                set("year", digits ? Number(digits) : null);
              }}
            />
          </Field>
          <Field label="Live site" hint="The client's own address" error={err("project_url")}>
            <input
              className="admin-input"
              type="url"
              placeholder="https://"
              value={input.project_url ?? ""}
              onChange={(e) => set("project_url", e.target.value.trim() || null)}
            />
          </Field>
          <Field
            label="Address on jalimx.com"
            hint={
              project.is_live
                ? "Locked — this page has been published and its link is out there"
                : "Lowercase letters, numbers and dashes"
            }
            error={err("slug")}
          >
            <div className="flex items-stretch">
              <span className="flex items-center border border-r-0 border-[var(--hairline)] bg-[var(--ground)] px-2.5 font-mono text-xs text-[var(--fg-faint)]">
                /work/
              </span>
              <input
                className="admin-input font-mono text-sm"
                value={input.slug}
                readOnly={project.is_live}
                aria-readonly={project.is_live}
                onChange={(e) =>
                  set("slug", e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))
                }
              />
            </div>
          </Field>
          <Field label="Order" hint="Lower comes first on the work page" error={err("position")}>
            <input
              className="admin-input tabular-nums"
              inputMode="numeric"
              value={input.position}
              onChange={(e) =>
                set("position", Number(e.target.value.replace(/\D/g, "").slice(0, 3) || 0))
              }
            />
          </Field>
          <Field
            label="Tags"
            hint="Comma separated, e.g. web, booking"
            error={err("tags") ?? err("tags.0")}
          >
            <input
              className="admin-input"
              value={tagText}
              onChange={(e) => setTagText(e.target.value)}
            />
          </Field>
        </div>
      </section>

      {/* Words */}
      <section className="border border-[var(--hairline)] bg-[var(--panel)]">
        <div className="grid grid-cols-[1fr] border-b border-[var(--hairline)] md:grid-cols-[12rem_1fr_1fr]">
          <h2 className="px-5 py-3.5 font-mono text-[0.66rem] uppercase tracking-[0.14em]">
            Case study
          </h2>
          <p className="hidden border-l border-[var(--hairline)] px-5 py-3.5 font-mono text-[0.66rem] uppercase tracking-[0.14em] text-[var(--fg-faint)] md:block">
            English
          </p>
          <p className="hidden border-l border-[var(--hairline)] px-5 py-3.5 font-mono text-[0.66rem] uppercase tracking-[0.14em] text-[var(--fg-faint)] md:block">
            Français
          </p>
        </div>
        {TEXT.map((f) => (
          <div
            key={f.key}
            className="grid border-b border-[var(--hairline)] last:border-b-0 md:grid-cols-[12rem_1fr_1fr]"
          >
            <div className="px-5 pb-1 pt-4 md:py-4">
              <p className="text-sm font-medium">{f.label}</p>
              <p className="mt-1 text-xs leading-snug text-[var(--fg-faint)]">{f.hint}</p>
            </div>
            {(["en", "fr"] as const).map((locale) => {
              const value = (input[f.key] as Translated)[locale];
              const e = err(`${f.key}.${locale}`);
              return (
                <label
                  key={locale}
                  className="relative block px-5 py-3 md:border-l md:border-[var(--hairline)] md:py-4"
                >
                  <span className="mb-1 block font-mono text-[0.58rem] uppercase tracking-[0.14em] text-[var(--fg-faint)] md:sr-only">
                    {locale === "en" ? "English" : "Français"}
                  </span>
                  {f.rows === 1 ? (
                    <input
                      lang={locale}
                      className="admin-input"
                      value={value}
                      maxLength={f.max}
                      aria-invalid={!!e}
                      onChange={(ev) => setText(f.key, locale, ev.target.value)}
                    />
                  ) : (
                    <textarea
                      lang={locale}
                      className="admin-input resize-y leading-relaxed"
                      rows={f.rows}
                      value={value}
                      maxLength={f.max}
                      aria-invalid={!!e}
                      onChange={(ev) => setText(f.key, locale, ev.target.value)}
                    />
                  )}
                  <span className="mt-1 flex justify-between gap-3 text-[0.68rem]">
                    <span className="text-[var(--color-signal)]">{e}</span>
                    <span
                      className={`font-mono tabular-nums ${value.length > f.max * 0.9 ? "text-[var(--color-signal)]" : "text-[var(--fg-faint)]"}`}
                    >
                      {value.length > f.max * 0.6 ? `${value.length}/${f.max}` : ""}
                    </span>
                  </span>
                </label>
              );
            })}
          </div>
        ))}
      </section>

      {/* Metrics */}
      <section className="border border-[var(--hairline)] bg-[var(--panel)]">
        <Heading
          title="Figures"
          hint="Only numbers anyone can check on the live site — up to four"
        />
        <div className="flex flex-col">
          {input.metrics.map((m, i) => (
            <div
              key={i}
              className="grid items-start gap-3 border-b border-[var(--hairline)] px-5 py-4 sm:grid-cols-[7rem_1fr_1fr_auto]"
            >
              <Field label="Figure" error={err(`metrics.${i}.value`)}>
                <input
                  className="admin-input font-display text-lg font-semibold tabular-nums"
                  value={m.value}
                  maxLength={12}
                  placeholder="343"
                  onChange={(e) => setMetric(i, (x) => ({ ...x, value: e.target.value }))}
                />
              </Field>
              <Field label="Label · English" error={err(`metrics.${i}.label.en`)}>
                <input
                  className="admin-input"
                  lang="en"
                  value={m.label.en}
                  maxLength={60}
                  placeholder="Tours in the catalogue"
                  onChange={(e) =>
                    setMetric(i, (x) => ({ ...x, label: { ...x.label, en: e.target.value } }))
                  }
                />
              </Field>
              <Field label="Label · Français" error={err(`metrics.${i}.label.fr`)}>
                <input
                  className="admin-input"
                  lang="fr"
                  value={m.label.fr}
                  maxLength={60}
                  placeholder="Voyages au catalogue"
                  onChange={(e) =>
                    setMetric(i, (x) => ({ ...x, label: { ...x.label, fr: e.target.value } }))
                  }
                />
              </Field>
              <button
                type="button"
                onClick={() =>
                  set(
                    "metrics",
                    input.metrics.filter((_, j) => j !== i)
                  )
                }
                className="self-center text-xs text-[var(--fg-dim)] hover:text-[var(--color-signal)] sm:mt-5"
              >
                Remove
              </button>
            </div>
          ))}
          {input.metrics.length < 4 && (
            <button
              type="button"
              onClick={() =>
                set("metrics", [...input.metrics, { value: "", label: { en: "", fr: "" } }])
              }
              className="px-5 py-3.5 text-left text-sm text-[var(--link)] hover:underline"
            >
              + Add a figure
            </button>
          )}
        </div>
      </section>

      {/* Save bar: pinned to the bottom of the window while there is something to save. */}
      <div
        className={`fixed inset-x-0 bottom-0 z-30 border-t border-[var(--hairline)] bg-[var(--panel)] transition-transform duration-200 md:left-60 ${
          dirty || message || saved ? "translate-y-0" : "translate-y-full"
        }`}
      >
        <div className="flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3 md:px-8 lg:px-12">
          <p
            role="status"
            className={`text-sm ${message ? "text-[var(--color-signal)]" : saved ? "text-[var(--link)]" : "text-[var(--fg-dim)]"}`}
          >
            {message ??
              (saved && !dirty ? "Saved — the site updates in a few seconds." : "Unsaved changes")}
          </p>
          <div className="flex items-center gap-3">
            {dirty && (
              <button
                type="button"
                onClick={discard}
                disabled={saving}
                className="px-3 py-2 text-sm text-[var(--fg-dim)] hover:text-[var(--fg)]"
              >
                Discard
              </button>
            )}
            <button
              type="button"
              onClick={save}
              disabled={!dirty || saving}
              className="bg-[var(--fg)] px-5 py-2.5 font-mono text-[0.68rem] uppercase tracking-[0.12em] text-[var(--ground)] disabled:opacity-35"
            >
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Heading({ title, hint }: { title: string; hint?: string }) {
  return (
    <header className="flex flex-wrap items-baseline justify-between gap-3 border-b border-[var(--hairline)] px-5 py-3.5">
      <h2 className="font-mono text-[0.66rem] uppercase tracking-[0.14em]">{title}</h2>
      {hint && <p className="text-xs text-[var(--fg-faint)]">{hint}</p>}
    </header>
  );
}

function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block min-w-0">
      <span className="mb-1.5 block font-mono text-[0.6rem] uppercase tracking-[0.14em] text-[var(--fg-faint)]">
        {label}
      </span>
      {children}
      {error ? (
        <span className="mt-1 block text-[0.7rem] text-[var(--color-signal)]">{error}</span>
      ) : (
        hint && <span className="mt-1 block text-[0.7rem] text-[var(--fg-faint)]">{hint}</span>
      )}
    </label>
  );
}

function Toggle({
  label,
  hint,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  hint: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label
      className={`flex items-center justify-between gap-4 bg-[var(--panel)] px-5 py-4 ${disabled ? "opacity-50" : "cursor-pointer"}`}
    >
      <span>
        <span className="block text-sm font-medium">{label}</span>
        <span className="mt-0.5 block text-xs text-[var(--fg-faint)]">{hint}</span>
      </span>
      <input
        type="checkbox"
        role="switch"
        className="peer sr-only"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span
        aria-hidden="true"
        className="relative h-5 w-9 shrink-0 rounded-full bg-[var(--hairline)] transition-colors peer-checked:bg-[var(--link)] peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[var(--link)] after:absolute after:left-0.5 after:top-0.5 after:h-4 after:w-4 after:rounded-full after:bg-white after:shadow after:transition-transform peer-checked:after:translate-x-4"
      />
    </label>
  );
}
