"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { Attachments } from "@/components/admin/attachments";
import { useConfirm } from "@/components/admin/confirm";
import { Field } from "@/components/admin/fields";
import { Tasks } from "@/components/admin/tasks";
import {
  admin,
  ApiError,
  BILLINGS,
  emptyEngagement,
  ENGAGEMENT_STATUSES,
  type Billing,
  type Client,
  type Engagement,
  type EngagementInput,
  type EngagementStatus,
  type WorkType,
} from "@/lib/admin/client";

/**
 * The work done for one client, edited in place.
 *
 * No page of its own per piece of work, and no list of everyone's work: a
 * project only makes sense next to the client paying for it, so it opens
 * as a row on their page and closes again there.
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

const BILLING_LABEL: Record<Billing, string> = {
  one_off: "One-off",
  monthly: "Monthly",
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

const openTasks = (e: Engagement) => e.tasks.filter((t) => !t.done_at).length;

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
  const [types, setTypes] = useState<WorkType[]>([]);

  // Fetched when the first editor opens, not on page load: most visits to
  // a client are to read, and only the editor needs the list.
  useEffect(() => {
    if (open === null || types.length) return;
    let live = true;
    admin.workTypes().then(
      (t) => live && setTypes(t),
      () => {},
    );
    return () => {
      live = false;
    };
  }, [open, types.length]);

  /*
   * Cancelled work is left out: it was never money, and a figure that
   * counts it reads as a lie the first time you check it. Retainers are
   * summarised apart from one-off prices — adding a monthly fee to a fixed
   * total gives a number that means nothing.
   */
  const live = rows.filter((r) => r.status !== "cancelled");
  const oneOff = live
    .filter((r) => r.billing === "one_off")
    .reduce((sum, r) => sum + Number(r.budget ?? 0), 0);
  const perMonth = live
    .filter((r) => r.billing === "monthly" && r.status === "active")
    .reduce((sum, r) => sum + Number(r.budget ?? 0), 0);

  const summary =
    rows.length === 0
      ? "Work"
      : [
          `${rows.length} ${rows.length === 1 ? "project" : "projects"}`,
          oneOff > 0 ? `${money(String(oneOff), client.currency)} agreed` : null,
          perMonth > 0 ? `${money(String(perMonth), client.currency)} a month` : null,
        ]
          .filter(Boolean)
          .join(" · ");

  return (
    <section className="border border-[var(--hairline)] bg-[var(--panel)]">
      {/* The tab above already says "Work", so this line spends itself on
          the numbers you would otherwise add up by hand. */}
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
          types={types}
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
          Nothing yet. Add the work you agreed on — a name and a status is
          enough to start.
        </p>
      ) : (
        <ul>
          {rows.map((row) => (
            <li key={row.id} className="border-t border-[var(--hairline)]">
              {open === row.id ? (
                <EngagementEditor
                  client={client}
                  types={types}
                  engagement={row}
                  value={{
                    title: row.title,
                    status: row.status,
                    billing: row.billing,
                    budget: row.budget,
                    starts_on: row.starts_on,
                    ends_on: row.ends_on,
                    description: row.description,
                    work_type_ids: row.work_types.map((t) => t.id),
                  }}
                  onCancel={() => setOpen(null)}
                  onSave={async (input) => {
                    const next = await admin.updateEngagement(row.id, input);
                    setRows((r) => r.map((x) => (x.id === row.id ? next : x)));
                    setOpen(null);
                  }}
                  onChanged={(next) =>
                    setRows((r) => r.map((x) => (x.id === next.id ? next : x)))
                  }
                  onDeleted={async () => {
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
                        row.work_types.map((t) => t.name).join(", ") || null,
                        row.billing === "monthly"
                          ? row.starts_on
                            ? `Monthly since ${day(row.starts_on)}`
                            : "Monthly"
                          : span(row.starts_on, row.ends_on),
                        openTasks(row) > 0
                          ? `${openTasks(row)} to do`
                          : null,
                        row.attachments.length
                          ? `${row.attachments.length} ${row.attachments.length === 1 ? "file" : "files"}`
                          : null,
                      ]
                        .filter(Boolean)
                        .join(" · ") || "Nothing filled in yet"}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-baseline gap-5 text-sm">
                    {row.budget !== null && (
                      <span className="tabular-nums text-[var(--fg-dim)]">
                        {money(row.budget, client.currency)}
                        {row.billing === "monthly" && (
                          <span className="text-[var(--fg-faint)]"> /month</span>
                        )}
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
  types,
  engagement,
  value,
  onSave,
  onCancel,
  onChanged,
  onDeleted,
}: {
  client: Client;
  types: WorkType[];
  /** Absent while adding: the parts that need a saved row stay hidden. */
  engagement?: Engagement;
  value: EngagementInput;
  onSave: (input: EngagementInput) => Promise<void>;
  onCancel: () => void;
  onChanged?: (next: Engagement) => void;
  onDeleted?: () => Promise<void>;
}) {
  const [input, setInput] = useState<EngagementInput>(value);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [writing, setWriting] = useState(false);
  const [section, setSection] = useState<"details" | "tasks" | "files">("details");
  const ask = useConfirm();

  const err = (key: string) => errors[key]?.[0];
  const set = (key: keyof EngagementInput, v: string) =>
    setInput((i) => ({ ...i, [key]: v === "" ? null : v }));

  const monthly = input.billing === "monthly";

  const toggleType = (id: number) =>
    setInput((i) => ({
      ...i,
      work_type_ids: i.work_type_ids.includes(id)
        ? i.work_type_ids.filter((n) => n !== id)
        : [...i.work_type_ids, id],
    }));

  /* A retired kind still shows when this work already carries it. */
  const offered = types.filter((t) => t.is_active || input.work_type_ids.includes(t.id));

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
    if (!onDeleted) return;
    if (
      !(await ask({
        title: `Delete "${input.title || "this work"}"?`,
        body: "Its files go with it. Work that has been quoted or invoiced cannot be deleted — mark it cancelled instead.",
        confirmLabel: "Delete",
        tone: "danger",
      }))
    ) {
      return;
    }
    setBusy(true);
    try {
      await onDeleted();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Could not delete it.");
      setBusy(false);
    }
  }

  /** Starts the public page about this work and links the two. */
  async function writeCaseStudy() {
    if (!engagement) return;
    setWriting(true);
    setMessage(null);
    try {
      onChanged?.(await admin.createCaseStudy(engagement.id));
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Could not start it.");
    } finally {
      setWriting(false);
    }
  }

  const files = engagement?.attachments.length ?? 0;
  const todo = engagement ? openTasks(engagement) : 0;

  return (
    <div className="bg-[color-mix(in_oklab,var(--fg)_3%,transparent)]">
      {/* The actions sit beside the name of the thing being edited. On a
          form this long they were otherwise a scroll away from whatever
          you had just changed. */}
      <header className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-b border-[var(--hairline)] px-5 py-3">
        <div className="flex min-w-0 items-baseline gap-4">
          <h3 className="truncate text-sm font-medium">
            {input.title.trim() || (engagement ? "This work" : "New work")}
          </h3>
          <p role="status" className="truncate text-xs text-[var(--color-signal)]">
            {message}
          </p>
        </div>
        <div className="flex items-center gap-4">
          {onDeleted && (
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
      </header>

      <div className="md:flex">
        {/* Tasks and files are drawers rather than part of the form: they
            save themselves the moment they change, and sitting under a
            Save button would suggest otherwise. */}
        <nav
          aria-label="This work"
          className="flex shrink-0 gap-2 border-b border-[var(--hairline)] px-5 py-3 md:w-44 md:flex-col md:gap-0 md:border-r md:border-b-0 md:py-5"
        >
          {(
            [
              ["details", "Details"],
              ["tasks", todo ? `Tasks (${todo})` : "Tasks"],
              ["files", files ? `Files (${files})` : "Files"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              aria-current={section === key ? "true" : undefined}
              // Tasks and files hang off a saved piece of work.
              disabled={key !== "details" && !engagement}
              onClick={() => setSection(key)}
              className={`px-3 py-2 text-left text-sm transition-colors disabled:opacity-35 md:-ml-px md:border-l ${
                section === key
                  ? "border-[var(--fg)] bg-[var(--panel)] text-[var(--fg)] md:bg-transparent"
                  : "border-transparent text-[var(--fg-dim)] hover:text-[var(--fg)]"
              }`}
            >
              {label}
            </button>
          ))}
        </nav>

        <div className="min-w-0 flex-1 px-5 py-5">
          <div className="grid gap-5 lg:grid-cols-3" hidden={section !== "details"}>
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

            <div className="lg:col-span-3">
              <span className="mb-1.5 block font-mono text-[0.6rem] uppercase tracking-[0.14em] text-[var(--fg-faint)]">
                Kind of work
              </span>
              {offered.length === 0 ? (
                <p className="text-xs text-[var(--fg-faint)]">
                  None set up yet —{" "}
                  <Link
                    href="/admin/settings/work-types"
                    className="text-[var(--link)] hover:underline"
                  >
                    add them in Settings
                  </Link>
                  .
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {offered.map((t) => {
                    const on = input.work_type_ids.includes(t.id);
                    return (
                      <button
                        key={t.id}
                        type="button"
                        aria-pressed={on}
                        onClick={() => toggleType(t.id)}
                        className={`border px-3 py-1.5 text-sm transition-colors ${
                          on
                            ? "border-[var(--fg)] bg-[var(--fg)] text-[var(--ground)]"
                            : "border-[var(--hairline)] text-[var(--fg-dim)] hover:text-[var(--fg)]"
                        }`}
                      >
                        {t.name}
                      </button>
                    );
                  })}
                </div>
              )}
              <span className="mt-1.5 block text-[0.7rem] text-[var(--fg-faint)]">
                One job can be more than one — social media and platforms together,
                for instance.
              </span>
            </div>

            {/* How it is charged decides what the money and the dates mean, so
                it sits above both. */}
            <Field label="How it is charged" error={err("billing")}>
              <select
                className="admin-input"
                value={input.billing}
                onChange={(e) => setInput((i) => ({ ...i, billing: e.target.value as Billing }))}
              >
                {BILLINGS.map((b) => (
                  <option key={b} value={b}>
                    {BILLING_LABEL[b]}
                  </option>
                ))}
              </select>
            </Field>

            <Field
              label={monthly ? `Each month (${client.currency})` : `Budget (${client.currency})`}
              hint={monthly ? "What they pay every month, before tax" : "Agreed total, before tax"}
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
              <Field label={monthly ? "Running since" : "Starts"} error={err("starts_on")}>
                <input
                  type="date"
                  className="admin-input"
                  value={input.starts_on ?? ""}
                  onChange={(e) => set("starts_on", e.target.value)}
                />
              </Field>
              <Field
                label={monthly ? "Stopped" : "Ends"}
                hint={monthly ? "Leave empty while it runs" : undefined}
                error={err("ends_on")}
              >
                <input
                  type="date"
                  className="admin-input"
                  value={input.ends_on ?? ""}
                  aria-invalid={!!err("ends_on")}
                  onChange={(e) => set("ends_on", e.target.value)}
                />
              </Field>
            </div>

            <div className="lg:col-span-3">
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

          {engagement && (
            <div
              className="mt-6 border-t border-[var(--hairline)] pt-5"
              hidden={section !== "details"}
            >
              {/* The case study is written about work that happened, so
                  it is started from here rather than picked from a list. */}
              <div className="flex flex-wrap items-center gap-3 text-sm">
                {engagement.case_study ? (
                  <>
                    <span className="text-[var(--fg-faint)]">Case study:</span>
                    <Link
                      href={`/admin/settings/case-studies/${engagement.case_study.slug}`}
                      className="text-[var(--link)] underline-offset-4 hover:underline"
                    >
                      {engagement.case_study.title} ↗
                    </Link>
                    <span className="font-mono text-[0.6rem] uppercase tracking-[0.12em] text-[var(--fg-faint)]">
                      {engagement.case_study.is_published ? "Published" : "Draft"}
                    </span>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={writeCaseStudy}
                      disabled={writing}
                      className="border border-[var(--hairline)] px-4 py-2 font-mono text-[0.66rem] uppercase tracking-[0.12em] disabled:opacity-35"
                    >
                      {writing ? "Starting…" : "Write a case study"}
                    </button>
                    <span className="text-xs text-[var(--fg-faint)]">
                      Starts a hidden page on the site, with the client and the
                      name already filled in.
                    </span>
                  </>
                )}
              </div>
            </div>
          )}

          {engagement && (
            <div hidden={section !== "tasks"}>
              <Tasks engagement={engagement} onChanged={(next) => onChanged?.(next)} />
            </div>
          )}

          {engagement && (
            <div hidden={section !== "files"}>
              <Attachments engagement={engagement} onChanged={(next) => onChanged?.(next)} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
