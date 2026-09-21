"use client";

import { useEffect, useState } from "react";

import { Field } from "@/components/admin/fields";
import {
  admin,
  ApiError,
  emptyEngagement,
  ENGAGEMENT_STATUSES,
  type CaseStudyOption,
  type Client,
  type Engagement,
  type EngagementInput,
  type EngagementStatus,
} from "@/lib/admin/client";

/**
 * The work done for one client, edited in place.
 *
 * No page of its own per piece of work, and no list of everyone's work: a
 * project only makes sense next to the client paying for it, so it opens as
 * a row on their page and closes again there.
 */

const STATUS_LABEL: Record<EngagementStatus, string> = {
  planned: "Planned",
  active: "Active",
  paused: "Paused",
  done: "Done",
  cancelled: "Cancelled",
};

/** Only the states that want the eye get a colour; the rest stay quiet. */
const STATUS_TONE: Record<EngagementStatus, string> = {
  planned: "text-[var(--fg-dim)]",
  active: "text-[var(--link)]",
  paused: "text-[var(--color-signal)]",
  done: "text-[var(--fg-dim)]",
  cancelled: "text-[var(--fg-faint)]",
};

function money(amount: string | null, currency: string): string | null {
  if (amount === null) return null;
  const n = Number(amount);
  if (!Number.isFinite(n)) return `${amount} ${currency}`;
  return `${n.toLocaleString("en-GB", { minimumFractionDigits: n % 1 ? 2 : 0 })} ${currency}`;
}

const day = (iso: string | null) =>
  iso
    ? new Date(`${iso}T00:00:00`).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : null;

function span(from: string | null, to: string | null): string | null {
  const a = day(from);
  const b = day(to);
  if (a && b) return `${a} → ${b}`;
  if (a) return `From ${a}`;
  if (b) return `Due ${b}`;
  return null;
}

export function Engagements({ client }: { client: Client }) {
  const [rows, setRows] = useState<Engagement[]>(client.engagements ?? []);
  const [open, setOpen] = useState<number | "new" | null>(null);
  const [options, setOptions] = useState<CaseStudyOption[]>([]);

  // Fetched when the first editor opens, not on page load: most visits to a
  // client are to read, and the picker is the only thing that needs this.
  useEffect(() => {
    if (open === null || options.length) return;
    let live = true;
    admin.caseStudyOptions().then(
      (o) => live && setOptions(o),
      () => {},
    );
    return () => {
      live = false;
    };
  }, [open, options.length]);

  /*
   * Cancelled work is left out of the total: it was never money, and a
   * figure that counts it reads as a lie the first time you check it.
   */
  const counted = rows.filter((r) => r.status !== "cancelled");
  const agreed = counted.reduce((sum, r) => sum + Number(r.budget ?? 0), 0);
  const summary =
    rows.length === 0
      ? "Work"
      : [
          `${rows.length} ${rows.length === 1 ? "project" : "projects"}`,
          agreed > 0 ? `${money(String(agreed), client.currency)} agreed` : null,
        ]
          .filter(Boolean)
          .join(" · ");

  return (
    <section className="border border-[var(--hairline)] bg-[var(--panel)]">
      {/* The tab above already says "Work", so this line spends itself on
          the two numbers you would otherwise add up by hand. */}
      <header className="flex flex-wrap items-baseline justify-between gap-3 border-b border-[var(--hairline)] px-5 py-3.5">
        <h2 className="font-mono text-[0.66rem] uppercase tracking-[0.14em] text-[var(--fg-dim)]">
          {summary}
        </h2>
        <button
          type="button"
          onClick={() => setOpen(open === "new" ? null : "new")}
          className="font-mono text-[0.66rem] uppercase tracking-[0.12em] text-[var(--link)]"
        >
          {open === "new" ? "Cancel" : "+ Add work"}
        </button>
      </header>

      {open === "new" && (
        <EngagementEditor
          client={client}
          options={options}
          value={emptyEngagement()}
          onCancel={() => setOpen(null)}
          onSave={async (input) => {
            const created = await admin.createEngagement(client.id, input);
            setRows((r) => [created, ...r]);
            setOpen(null);
          }}
        />
      )}

      {rows.length === 0 && open !== "new" ? (
        <p className="px-5 py-8 text-sm text-[var(--fg-faint)]">
          Nothing yet. Add the work you agreed on — a name and a status is enough
          to start.
        </p>
      ) : (
        <ul>
          {rows.map((row) => (
            <li key={row.id} className="border-t border-[var(--hairline)]">
              {open === row.id ? (
                <EngagementEditor
                  client={client}
                  options={options}
                  value={{
                    title: row.title,
                    status: row.status,
                    budget: row.budget,
                    starts_on: row.starts_on,
                    ends_on: row.ends_on,
                    description: row.description,
                    case_study_id: row.case_study_id,
                  }}
                  current={row.case_study ? { id: row.case_study_id!, title: row.case_study.title } : null}
                  onCancel={() => setOpen(null)}
                  onSave={async (input) => {
                    const next = await admin.updateEngagement(row.id, input);
                    setRows((r) => r.map((x) => (x.id === row.id ? next : x)));
                    setOpen(null);
                  }}
                  onDelete={async () => {
                    await admin.removeEngagement(row.id);
                    setRows((r) => r.filter((x) => x.id !== row.id));
                    setOpen(null);
                  }}
                />
              ) : (
                <button
                  type="button"
                  onClick={() => setOpen(row.id)}
                  className="flex w-full flex-wrap items-baseline justify-between gap-x-6 gap-y-1 px-5 py-4 text-left hover:bg-[color-mix(in_oklab,var(--fg)_3%,transparent)]"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">{row.title}</span>
                    <span className="mt-1 block text-xs text-[var(--fg-faint)]">
                      {[
                        span(row.starts_on, row.ends_on),
                        row.case_study && `Case study: ${row.case_study.title}`,
                      ]
                        .filter(Boolean)
                        .join(" · ") || "No dates yet"}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-baseline gap-5 text-sm">
                    {row.budget !== null && (
                      <span className="tabular-nums text-[var(--fg-dim)]">
                        {money(row.budget, client.currency)}
                      </span>
                    )}
                    <span
                      className={`font-mono text-[0.66rem] uppercase tracking-[0.12em] ${STATUS_TONE[row.status]}`}
                    >
                      {STATUS_LABEL[row.status]}
                    </span>
                  </span>
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function EngagementEditor({
  client,
  options,
  value,
  current,
  onSave,
  onCancel,
  onDelete,
}: {
  client: Client;
  options: CaseStudyOption[];
  /** The case study already linked, so the picker can name it before the
      full list has arrived over a slow connection. */
  current?: { id: number; title: string } | null;
  value: EngagementInput;
  onSave: (input: EngagementInput) => Promise<void>;
  onCancel: () => void;
  onDelete?: () => Promise<void>;
}) {
  const [input, setInput] = useState<EngagementInput>(value);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const err = (key: string) => errors[key]?.[0];
  const set = (key: keyof EngagementInput, v: string) =>
    setInput((i) => ({ ...i, [key]: v === "" ? null : v }));

  async function submit() {
    setBusy(true);
    setMessage(null);
    // Cleared before the request, not after: leaving the last rejection
    // under a field you have since fixed reads as a fresh complaint.
    setErrors({});
    try {
      await onSave(input);
    } catch (e) {
      if (e instanceof ApiError && e.status === 422) {
        setErrors(e.errors);
        setMessage(Object.values(e.errors)[0]?.[0] ?? "Check the fields above.");
      } else {
        setMessage(e instanceof Error ? e.message : "Saving failed.");
      }
      setBusy(false);
    }
  }

  async function remove() {
    if (!onDelete) return;
    if (!window.confirm(`Delete "${input.title || "this work"}"? This cannot be undone.`)) return;
    setBusy(true);
    try {
      await onDelete();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Could not delete it.");
      setBusy(false);
    }
  }

  return (
    <div className="bg-[color-mix(in_oklab,var(--fg)_3%,transparent)] px-5 py-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="What is it" hint="A name you would say on the phone" error={err("title")}>
          <input
            className="admin-input"
            maxLength={160}
            value={input.title}
            aria-invalid={!!err("title")}
            onChange={(e) => setInput((i) => ({ ...i, title: e.target.value }))}
          />
        </Field>

        <Field label="Status" error={err("status")}>
          <select
            className="admin-input"
            value={input.status}
            onChange={(e) =>
              setInput((i) => ({ ...i, status: e.target.value as EngagementStatus }))
            }
          >
            {ENGAGEMENT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </Field>

        <Field
          label={`Budget (${client.currency})`}
          hint="Agreed total, before tax"
          error={err("budget")}
        >
          <input
            inputMode="decimal"
            className="admin-input tabular-nums"
            value={input.budget ?? ""}
            aria-invalid={!!err("budget")}
            onChange={(e) => set("budget", e.target.value.trim())}
          />
        </Field>

        <div className="grid grid-cols-2 gap-5">
          <Field label="Starts" error={err("starts_on")}>
            <input
              type="date"
              className="admin-input"
              value={input.starts_on ?? ""}
              onChange={(e) => set("starts_on", e.target.value)}
            />
          </Field>
          <Field label="Ends" error={err("ends_on")}>
            <input
              type="date"
              className="admin-input"
              value={input.ends_on ?? ""}
              aria-invalid={!!err("ends_on")}
              onChange={(e) => set("ends_on", e.target.value)}
            />
          </Field>
        </div>

        <div className="sm:col-span-2">
          <Field
            label="Case study"
            hint="Link this to the page about it on the site, once there is one"
            error={err("case_study_id")}
          >
            <select
              className="admin-input"
              value={input.case_study_id ?? ""}
              onChange={(e) =>
                setInput((i) => ({
                  ...i,
                  case_study_id: e.target.value === "" ? null : Number(e.target.value),
                }))
              }
            >
              <option value="">Not linked</option>
              {current && !options.some((o) => o.id === current.id) && (
                <option value={current.id}>{current.title}</option>
              )}
              {options.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.title}
                  {o.is_published ? "" : " (draft)"}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <div className="sm:col-span-2">
          <Field label="What it covers" hint="Only you see this" error={err("description")}>
            <textarea
              rows={3}
              maxLength={5000}
              className="admin-input resize-y leading-relaxed"
              value={input.description ?? ""}
              onChange={(e) => set("description", e.target.value)}
            />
          </Field>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <p role="status" className="text-xs text-[var(--color-signal)]">
          {message}
        </p>
        <div className="flex items-center gap-4">
          {onDelete && (
            <button
              type="button"
              onClick={remove}
              disabled={busy}
              className="text-xs text-[var(--fg-dim)] hover:text-[var(--color-signal)]"
            >
              Delete
            </button>
          )}
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="px-3 py-2 text-sm text-[var(--fg-dim)] hover:text-[var(--fg)]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={busy || !input.title.trim()}
            className="bg-[var(--fg)] px-4 py-2 font-mono text-[0.66rem] uppercase tracking-[0.12em] text-[var(--ground)] disabled:opacity-35"
          >
            {busy ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
