"use client";

import { useEffect, useState } from "react";

import { Field, SaveBar, Toggle, useUnsavedWarning } from "@/components/admin/fields";
import { PageSkeleton, PanelsSkeleton } from "@/components/admin/skeleton";
import { admin, ApiError, isSignedOut, type ServiceRow, type Translated } from "@/lib/admin/client";

const TEXT = [
  { key: "title", label: "Name", rows: 1, max: 60 },
  { key: "tagline", label: "One line", rows: 2, max: 160 },
  { key: "body", label: "Description", rows: 4, max: 1200 },
] as const;

export default function ServicesPage() {
  const [initial, setInitial] = useState<ServiceRow[] | null>(null);
  const [rows, setRows] = useState<ServiceRow[] | null>(null);
  // Errors per service, since one save can touch several of them.
  const [errors, setErrors] = useState<Record<string, Record<string, string[]>>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    // A response that lands after this effect was torn down is ignored: with a
    // slow database the second of React's development double-loads arrived
    // after typing had started, and silently replaced the edit.
    let live = true;
    admin.services().then(
      (list) => {
        if (!live) return;
        setInitial(list);
        setRows(list);
      },
      (e) => live && !isSignedOut(e) && setMessage(e.message),
    );
    return () => {
      live = false;
    };
  }, []);

  const changed = (rows ?? []).filter(
    (row, i) => JSON.stringify(row) !== JSON.stringify(initial?.[i]),
  );
  const dirty = changed.length > 0;
  useUnsavedWarning(dirty);

  if (!rows) {
    return message ? (
      <p role="alert" className="text-sm text-[var(--color-signal)]">{message}</p>
    ) : (
      <PageSkeleton>
        <PanelsSkeleton panels={4} lines={6} />
      </PageSkeleton>
    );
  }

  const update = (slug: string, change: (r: ServiceRow) => ServiceRow) =>
    setRows((list) => list?.map((r) => (r.slug === slug ? change(r) : r)) ?? list);

  /** Only the services that changed are sent; each one that saves is kept. */
  async function save() {
    setSaving(true);
    setMessage(null);
    const nextErrors: typeof errors = {};
    let next = [...(initial ?? [])];

    for (const row of changed) {
      try {
        const savedRow = await admin.updateService(row);
        next = next.map((r) => (r.slug === savedRow.slug ? savedRow : r));
      } catch (e) {
        nextErrors[row.slug] =
          e instanceof ApiError && e.status === 422 ? e.errors : { _: [e instanceof Error ? e.message : "Saving failed."] };
      }
    }

    // Saved rows become the new baseline; failed ones keep the edits on screen.
    setInitial(next);
    setRows((list) => list?.map((r) => (nextErrors[r.slug] ? r : (next.find((n) => n.slug === r.slug) ?? r))) ?? list);
    setErrors(nextErrors);
    setSaving(false);

    const failed = Object.keys(nextErrors).length;
    if (failed) {
      setMessage(failed === 1 ? "One service could not be saved — see the marked fields." : `${failed} services could not be saved.`);
    } else {
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    }
  }

  const ordered = [...rows].sort((a, b) => a.position - b.position);

  return (
    <div className="max-w-5xl pb-28">
      <h1 className="font-display text-3xl font-semibold tracking-tight">Services</h1>
      <p className="mt-2 max-w-[60ch] text-sm text-[var(--fg-dim)]">
        What the homepage says JalimX does, and the choices in the contact
        form. A hidden service disappears from both.
      </p>

      <div className="mt-10 flex flex-col gap-8">
        {ordered.map((row, index) => {
          const err = (key: string) => errors[row.slug]?.[key]?.[0];
          const isChanged = changed.some((c) => c.slug === row.slug);
          return (
            <section key={row.slug} className="border border-[var(--hairline)] bg-[var(--panel)]">
              <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--hairline)] px-5 py-3">
                <div className="flex items-baseline gap-3">
                  <h2 className="font-display text-lg font-semibold tracking-tight">{row.title.en || row.slug}</h2>
                  {isChanged && <span className="font-mono text-[0.58rem] uppercase tracking-[0.12em] text-[var(--link)]">Edited</span>}
                </div>
                <div className="flex items-center gap-1">
                  <MoveButton
                    label="Move up"
                    disabled={index === 0}
                    onClick={() => {
                      const above = ordered[index - 1];
                      update(row.slug, (r) => ({ ...r, position: above.position }));
                      update(above.slug, (r) => ({ ...r, position: row.position }));
                    }}
                  >
                    ↑
                  </MoveButton>
                  <MoveButton
                    label="Move down"
                    disabled={index === ordered.length - 1}
                    onClick={() => {
                      const below = ordered[index + 1];
                      update(row.slug, (r) => ({ ...r, position: below.position }));
                      update(below.slug, (r) => ({ ...r, position: row.position }));
                    }}
                  >
                    ↓
                  </MoveButton>
                </div>
              </header>

              {errors[row.slug]?._ && (
                <p role="alert" className="border-b border-[var(--hairline)] px-5 py-2.5 text-xs text-[var(--color-signal)]">
                  {errors[row.slug]._[0]}
                </p>
              )}

              <div className="border-b border-[var(--hairline)]">
                <Toggle
                  label="Shown on the site"
                  hint={row.is_published ? "On the homepage and in the contact form" : "Hidden everywhere"}
                  checked={row.is_published}
                  onChange={(v) => update(row.slug, (r) => ({ ...r, is_published: v }))}
                />
              </div>

              <div className="grid gap-px bg-[var(--hairline)] md:grid-cols-2">
                {(["en", "fr"] as const).map((locale) => (
                  <div key={locale} className="flex flex-col gap-4 bg-[var(--panel)] p-5">
                    <p className="font-mono text-[0.6rem] uppercase tracking-[0.14em] text-[var(--link)]">
                      {locale === "en" ? "English" : "Français"}
                    </p>
                    {TEXT.map((f) => {
                      const value = row[f.key][locale];
                      const onChange = (v: string) =>
                        update(row.slug, (r) => ({ ...r, [f.key]: { ...(r[f.key] as Translated), [locale]: v } }));
                      const e = err(`${f.key}.${locale}`);
                      return (
                        <Field key={f.key} label={f.label} error={e}>
                          {f.rows === 1 ? (
                            <input lang={locale} className="admin-input" maxLength={f.max} value={value} aria-invalid={!!e} onChange={(ev) => onChange(ev.target.value)} />
                          ) : (
                            <textarea lang={locale} rows={f.rows} maxLength={f.max} className="admin-input resize-y leading-relaxed" value={value} aria-invalid={!!e} onChange={(ev) => onChange(ev.target.value)} />
                          )}
                        </Field>
                      );
                    })}
                  </div>
                ))}
              </div>
            </section>
          );
        })}
      </div>

      <SaveBar
        dirty={dirty}
        saving={saving}
        saved={saved}
        message={message}
        onSave={save}
        onDiscard={() => {
          setRows(initial);
          setErrors({});
          setMessage(null);
        }}
      />
    </div>
  );
}

function MoveButton({ label, disabled, onClick, children }: { label: string; disabled: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="flex h-8 w-8 items-center justify-center border border-[var(--hairline)] text-sm text-[var(--fg-dim)] hover:text-[var(--fg)] disabled:opacity-30"
    >
      {children}
    </button>
  );
}
