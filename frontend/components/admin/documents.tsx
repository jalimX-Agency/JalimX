"use client";

import { useState } from "react";

import { useConfirm } from "@/components/admin/confirm";
import { Field } from "@/components/admin/fields";
import {
  admin,
  ApiError,
  PAYMENT_METHODS,
  type BillingDocument,
  type Client,
  type DocumentInput,
  type DocumentType,
  type Engagement,
  type LineItemInput,
  type PaymentMethod,
} from "@/lib/admin/client";

/**
 * Quotes and invoices, on the client's own page.
 *
 * The line that runs through all of it: a draft is paper you are still
 * writing, an issued document is paper you have handed over. Drafts show a
 * form; issued ones show what was sent and what has been paid against it.
 * Nothing here lets you edit a number that is already in someone's inbox.
 */

const money = (amount: string, currency: string) =>
  `${Number(amount).toLocaleString("en-GB", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ${currency}`;

const day = (iso: string | null) =>
  iso
    ? new Date(`${iso}T00:00:00`).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : null;

const today = () => new Date().toISOString().slice(0, 10);

/** The first day of a month, as the API wants it. */
const monthKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;

const monthName = (key: string) =>
  new Date(`${key}T00:00:00`).toLocaleDateString("en-GB", { month: "long", year: "numeric" });

/**
 * The months a retainer could be billed for: this one and the five before
 * it, stopping at the month the work started. Far enough back to catch up
 * on one you forgot, short enough to stay a row of buttons.
 */
function billableMonths(startsOn: string | null): string[] {
  const out: string[] = [];
  const now = new Date();
  const from = startsOn ? new Date(`${startsOn}T00:00:00`) : null;

  for (let back = 0; back < 6; back++) {
    const d = new Date(now.getFullYear(), now.getMonth() - back, 1);
    if (from && d < new Date(from.getFullYear(), from.getMonth(), 1)) break;
    out.push(monthKey(d));
  }

  return out;
}

/** What the row says about where the document stands, and in what colour. */
function state(doc: BillingDocument): { label: string; tone: string } {
  if (doc.status === "draft") return { label: "Draft", tone: "text-[var(--fg-faint)]" };
  if (doc.status === "cancelled") return { label: "Cancelled", tone: "text-[var(--fg-faint)]" };
  if (doc.status === "declined") return { label: "Declined", tone: "text-[var(--fg-dim)]" };
  if (doc.type === "quote") {
    return doc.status === "accepted"
      ? { label: "Accepted", tone: "text-[var(--link)]" }
      : { label: "Sent", tone: "text-[var(--fg-dim)]" };
  }
  if (doc.settled) return { label: "Paid", tone: "text-[var(--link)]" };
  if (Number(doc.totals.paid) > 0) return { label: "Part paid", tone: "text-[var(--color-signal)]" };
  if (doc.overdue) return { label: "Overdue", tone: "text-[var(--color-signal)]" };
  return { label: "Sent", tone: "text-[var(--fg-dim)]" };
}

export function Documents({ client }: { client: Client }) {
  const [rows, setRows] = useState<BillingDocument[]>(client.documents ?? []);
  const [open, setOpen] = useState<number | null>(null);
  const [starting, setStarting] = useState<DocumentType | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const engagements = client.engagements ?? [];

  const replace = (next: BillingDocument) =>
    setRows((r) => r.map((d) => (d.id === next.id ? next : d)));

  async function create(
    type: DocumentType,
    engagementId: number | null,
    preset?: "deposit" | "balance" | "full" | "month",
    period?: string,
  ) {
    setBusy(true);
    setError(null);
    try {
      const doc = await admin.createDocument(client.id, {
        type,
        engagement_id: engagementId,
        preset,
        period,
      });
      setRows((r) => [doc, ...r]);
      setStarting(null);
      setOpen(doc.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start it.");
    } finally {
      setBusy(false);
    }
  }

  /*
   * What is still owed, across every issued invoice that was not cancelled.
   * Quotes are left out: a quote is a hope, not a debt.
   */
  const outstanding = rows
    .filter((d) => d.type === "invoice" && d.status === "sent")
    .reduce((sum, d) => sum + Number(d.totals.due), 0);

  const issued = rows.filter((d) => d.type === "invoice" && d.status !== "draft");

  /*
   * "All settled" is only true once something has actually been issued.
   * A page holding nothing but a draft has settled nothing.
   */
  const summary =
    rows.length === 0
      ? "Money"
      : outstanding > 0
        ? `${money(String(outstanding), client.currency)} outstanding`
        : issued.length > 0
          ? "All settled"
          : "Nothing issued yet";

  return (
    <section className="border border-[var(--hairline)] bg-[var(--panel)]">
      <header className="flex flex-wrap items-baseline justify-between gap-3 border-b border-[var(--hairline)] px-5 py-3.5">
        <h2
          className={`font-mono text-[0.66rem] uppercase tracking-[0.14em] ${
            outstanding > 0 ? "text-[var(--color-signal)]" : "text-[var(--fg-dim)]"
          }`}
        >
          {summary}
        </h2>
        <div className="flex items-center gap-4">
          <button
            type="button"
            disabled={busy}
            onClick={() => setStarting(starting === "quote" ? null : "quote")}
            className="font-mono text-[0.66rem] uppercase tracking-[0.12em] text-[var(--link)] disabled:opacity-40"
          >
            + Quote
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => setStarting(starting === "invoice" ? null : "invoice")}
            className="font-mono text-[0.66rem] uppercase tracking-[0.12em] text-[var(--link)] disabled:opacity-40"
          >
            + Invoice
          </button>
        </div>
      </header>

      {error && (
        <p role="alert" className="border-b border-[var(--hairline)] px-5 py-3 text-sm text-[var(--color-signal)]">
          {error}
        </p>
      )}

      {starting && (
        <Starter
          type={starting}
          engagements={engagements}
          documents={rows}
          currency={client.currency}
          busy={busy}
          onStart={create}
          onCancel={() => setStarting(null)}
        />
      )}

      {rows.length === 0 && !starting ? (
        <p className="px-5 py-8 text-sm text-[var(--fg-faint)]">
          Nothing billed yet. A quote first if they asked for one, an invoice
          when the work is agreed.
        </p>
      ) : (
        <ul>
          {rows.map((doc) => {
            const s = state(doc);
            return (
              <li key={doc.id} className="border-t border-[var(--hairline)]">
                <button
                  type="button"
                  onClick={() => setOpen(open === doc.id ? null : doc.id)}
                  aria-expanded={open === doc.id}
                  className="flex w-full flex-wrap items-baseline justify-between gap-x-6 gap-y-1 px-5 py-4 text-left hover:bg-[color-mix(in_oklab,var(--fg)_3%,transparent)]"
                >
                  <span className="min-w-0">
                    <span className="block text-sm font-medium">
                      {doc.number ?? (doc.type === "invoice" ? "Invoice" : "Quote")}
                      {doc.subject ? (
                        <span className="font-normal text-[var(--fg-dim)]"> · {doc.subject}</span>
                      ) : null}
                    </span>
                    <span className="mt-1 block text-xs text-[var(--fg-faint)]">
                      {[
                        day(doc.issue_date),
                        doc.type === "invoice" && doc.due_date ? `due ${day(doc.due_date)}` : null,
                        Number(doc.totals.paid) > 0 && !doc.settled
                          ? `${money(doc.totals.due, doc.currency)} left`
                          : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-baseline gap-5 text-sm">
                    <span className="tabular-nums text-[var(--fg-dim)]">
                      {money(doc.totals.total, doc.currency)}
                    </span>
                    <span className={`font-mono text-[0.66rem] uppercase tracking-[0.12em] ${s.tone}`}>
                      {s.label}
                    </span>
                  </span>
                </button>

                {open === doc.id &&
                  (doc.editable ? (
                    <DraftEditor
                      doc={doc}
                      engagements={engagements}
                      onSaved={replace}
                      onDeleted={() => {
                        setRows((r) => r.filter((d) => d.id !== doc.id));
                        setOpen(null);
                      }}
                    />
                  ) : (
                    <IssuedPanel
                      doc={doc}
                      clientPhone={client.phone}
                      onChanged={replace}
                      onDeleted={() => {
                        setRows((r) => r.filter((d) => d.id !== doc.id));
                        setOpen(null);
                      }}
                    />
                  ))}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

/**
 * The step between "+ Invoice" and a draft: which work is it for, and is
 * this the half up front or the half after. Skipped entirely when the
 * client has no projects to bill against.
 */
function Starter({
  type,
  engagements,
  documents,
  currency,
  busy,
  onStart,
  onCancel,
}: {
  type: DocumentType;
  engagements: Engagement[];
  documents: BillingDocument[];
  currency: string;
  busy: boolean;
  onStart: (
    type: DocumentType,
    engagementId: number | null,
    preset?: "deposit" | "balance" | "full" | "month",
    period?: string,
  ) => void;
  onCancel: () => void;
}) {
  const [engagementId, setEngagementId] = useState<number | null>(engagements[0]?.id ?? null);
  const chosen = engagements.find((e) => e.id === engagementId) ?? null;
  const monthly = chosen?.billing === "monthly";
  const months = monthly ? billableMonths(chosen?.starts_on ?? null) : [];
  /* Cancelled invoices do not count as billed: that month is owed again. */
  const billed = new Set(
    documents
      .filter((d) => d.engagement_id === engagementId && d.period && d.status !== "cancelled")
      .map((d) => d.period as string),
  );
  const budget = chosen?.budget ? Number(chosen.budget) : 0;
  /*
   * Halved the way the server halves it — in centimes, rounding down, with
   * the stray centime left on the balance. A button that promises 16,000.01
   * and then writes 16,000.00 is a button nobody trusts twice.
   */
  const half = Math.floor(Math.round(budget * 100) / 2) / 100;

  return (
    <div className="border-b border-[var(--hairline)] bg-[color-mix(in_oklab,var(--fg)_3%,transparent)] px-5 py-5">
      <p className="font-mono text-[0.66rem] uppercase tracking-[0.14em] text-[var(--fg-dim)]">
        New {type}
      </p>

      {engagements.length > 0 && (
        <div className="mt-4 max-w-md">
          <Field label="For which work" hint="Fills in the subject, and lets you split the budget">
            <select
              className="admin-input"
              value={engagementId ?? ""}
              onChange={(e) => setEngagementId(e.target.value === "" ? null : Number(e.target.value))}
            >
              <option value="">Not tied to a project</option>
              {engagements.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.title}
                  {e.budget ? ` — ${money(e.budget, currency)}` : ""}
                </option>
              ))}
            </select>
          </Field>
        </div>
      )}

      {/* A retainer is billed by the month, so the choice is which month,
          not which half. Months already invoiced say so rather than
          disappearing — the answer to "did I bill March?" is the point. */}
      {monthly && budget > 0 && (
        <div className="mt-5">
          <span className="mb-2 block font-mono text-[0.6rem] uppercase tracking-[0.14em] text-[var(--fg-faint)]">
            Which month
          </span>
          <div className="flex flex-wrap gap-2">
            {months.map((key) => {
              const done = billed.has(key);
              return (
                <button
                  key={key}
                  type="button"
                  disabled={busy || done}
                  onClick={() => onStart(type, engagementId, "month", key)}
                  className={`border px-3 py-2 text-sm ${
                    done
                      ? "border-[var(--hairline)] text-[var(--fg-faint)]"
                      : "border-[var(--fg)] hover:bg-[var(--fg)] hover:text-[var(--ground)]"
                  } disabled:cursor-not-allowed`}
                >
                  {monthName(key)}
                  {done && <span className="ml-2 text-xs">billed</span>}
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-xs text-[var(--fg-faint)]">
            {money(String(budget), currency)} a month.
          </p>
        </div>
      )}

      <div className="mt-5 flex flex-wrap items-center gap-3">
        {!monthly && budget > 0 && (
          <>
            <button
              type="button"
              disabled={busy}
              onClick={() => onStart(type, engagementId, "deposit")}
              className="bg-[var(--fg)] px-4 py-2 font-mono text-[0.66rem] uppercase tracking-[0.12em] text-[var(--ground)] disabled:opacity-35"
            >
              Deposit 50% — {money(String(half), currency)}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => onStart(type, engagementId, "balance")}
              className="border border-[var(--hairline)] px-4 py-2 font-mono text-[0.66rem] uppercase tracking-[0.12em] disabled:opacity-35"
            >
              Balance 50%
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => onStart(type, engagementId, "full")}
              className="border border-[var(--hairline)] px-4 py-2 font-mono text-[0.66rem] uppercase tracking-[0.12em] disabled:opacity-35"
            >
              The whole budget
            </button>
          </>
        )}
        <button
          type="button"
          disabled={busy}
          onClick={() => onStart(type, engagementId)}
          className={`px-4 py-2 font-mono text-[0.66rem] uppercase tracking-[0.12em] disabled:opacity-35 ${
            budget > 0
              ? "text-[var(--fg-dim)] hover:text-[var(--fg)]"
              : "bg-[var(--fg)] text-[var(--ground)]"
          }`}
        >
          {busy ? "Starting…" : "Empty, I will write the lines"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-2 py-2 text-sm text-[var(--fg-dim)] hover:text-[var(--fg)]"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function DraftEditor({
  doc,
  engagements,
  onSaved,
  onDeleted,
}: {
  doc: BillingDocument;
  engagements: Engagement[];
  onSaved: (next: BillingDocument) => void;
  onDeleted: () => void;
}) {
  const [input, setInput] = useState<DocumentInput>({
    engagement_id: doc.engagement_id,
    issue_date: doc.issue_date,
    due_date: doc.due_date,
    period: doc.period,
    tva_rate: doc.tva_rate,
    subject: doc.subject,
    notes: doc.notes,
    terms: doc.terms,
    items: doc.items.map((i) => ({
      description: i.description,
      quantity: i.quantity,
      unit_price: i.unit_price,
    })),
  });
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const ask = useConfirm();

  const err = (key: string) => errors[key]?.[0];
  const set = <K extends keyof DocumentInput>(key: K, value: DocumentInput[K]) =>
    setInput((i) => ({ ...i, [key]: value }));

  const work = engagements.find((e) => e.id === input.engagement_id) ?? null;

  const addLine = (line: LineItemInput) =>
    setInput((i) => ({ ...i, items: [...i.items, line] }));

  const setItem = (index: number, patch: Partial<LineItemInput>) =>
    setInput((i) => ({
      ...i,
      items: i.items.map((item, n) => (n === index ? { ...item, ...patch } : item)),
    }));

  // Added up here as well as on the server, so the figure answers typing
  // rather than the network.
  const subtotal = input.items.reduce(
    (sum, i) => sum + Math.round(Number(i.quantity || 0) * Number(i.unit_price || 0) * 100),
    0,
  );
  const tva = Math.round((subtotal * Number(input.tva_rate || 0)) / 100);
  const c = (centimes: number) => money((centimes / 100).toFixed(2), doc.currency);

  async function save(then?: "issue") {
    setBusy(true);
    setMessage(null);
    setErrors({});
    try {
      let next = await admin.updateDocument(doc.id, input);
      if (then === "issue") next = await admin.issueDocument(doc.id);
      onSaved(next);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e) {
      if (e instanceof ApiError && e.status === 422) {
        setErrors(e.errors);
        setMessage(Object.values(e.errors)[0]?.[0] ?? "Check the fields above.");
      } else {
        setMessage(e instanceof Error ? e.message : "Saving failed.");
      }
    } finally {
      setBusy(false);
    }
  }

  async function issue() {
    if (
      !(await ask({
        title: `Issue this ${doc.type}?`,
        body: "It gets its number and can no longer be edited — only paid, or cancelled.",
        confirmLabel: "Issue",
      }))
    ) {
      return;
    }
    await save("issue");
  }

  async function remove() {
    if (
      !(await ask({
        title: "Delete this draft?",
        body: "Nothing has been sent, so nothing is lost.",
        confirmLabel: "Delete",
        tone: "danger",
      }))
    ) {
      return;
    }
    setBusy(true);
    try {
      await admin.removeDocument(doc.id);
      onDeleted();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Could not delete it.");
      setBusy(false);
    }
  }

  return (
    <div className="bg-[color-mix(in_oklab,var(--fg)_3%,transparent)] px-5 py-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Subject" hint="What this is for, in one line" error={err("subject")}>
          <input
            className="admin-input"
            maxLength={190}
            value={input.subject ?? ""}
            onChange={(e) => set("subject", e.target.value || null)}
          />
        </Field>

        {engagements.length > 0 && (
          <Field label="Project" error={err("engagement_id")}>
            <select
              className="admin-input"
              value={input.engagement_id ?? ""}
              onChange={(e) =>
                set("engagement_id", e.target.value === "" ? null : Number(e.target.value))
              }
            >
              <option value="">Not tied to a project</option>
              {engagements.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.title}
                </option>
              ))}
            </select>
          </Field>
        )}

        <div className="grid grid-cols-2 gap-5">
          <Field label="Date" error={err("issue_date")}>
            <input
              type="date"
              className="admin-input"
              value={input.issue_date ?? ""}
              onChange={(e) => set("issue_date", e.target.value || null)}
            />
          </Field>
          {doc.type === "invoice" && (
            <Field label="Due" error={err("due_date")}>
              <input
                type="date"
                className="admin-input"
                value={input.due_date ?? ""}
                aria-invalid={!!err("due_date")}
                onChange={(e) => set("due_date", e.target.value || null)}
              />
            </Field>
          )}
        </div>

        <Field
          label="VAT %"
          hint="Zero until JalimX is registered for it"
          error={err("tva_rate")}
        >
          <input
            inputMode="decimal"
            className="admin-input tabular-nums"
            value={input.tva_rate}
            aria-invalid={!!err("tva_rate")}
            onChange={(e) => set("tva_rate", e.target.value.trim())}
          />
        </Field>
      </div>

      <div className="mt-6 border border-[var(--hairline)] bg-[var(--panel)]">
        <div className="hidden border-b border-[var(--hairline)] px-4 py-2 font-mono text-[0.6rem] uppercase tracking-[0.14em] text-[var(--fg-faint)] sm:grid sm:grid-cols-[1fr_5rem_8rem_7rem_2rem] sm:gap-3">
          <span>Description</span>
          <span className="text-right">Qty</span>
          <span className="text-right">Unit price</span>
          <span className="text-right">Amount</span>
          <span />
        </div>

        {input.items.length === 0 && (
          <p className="px-4 py-5 text-sm text-[var(--fg-faint)]">
            No lines yet.
          </p>
        )}

        {input.items.map((item, index) => {
          const lineTotal = Math.round(
            Number(item.quantity || 0) * Number(item.unit_price || 0) * 100,
          );
          return (
            <div
              key={index}
              className="grid gap-3 border-b border-[var(--hairline)] px-4 py-3 sm:grid-cols-[1fr_5rem_8rem_7rem_2rem] sm:items-center"
            >
              <input
                className="admin-input"
                maxLength={500}
                aria-label={`Line ${index + 1} description`}
                placeholder="What they are paying for"
                value={item.description}
                aria-invalid={!!err(`items.${index}.description`)}
                onChange={(e) => setItem(index, { description: e.target.value })}
              />
              <input
                inputMode="decimal"
                aria-label={`Line ${index + 1} quantity`}
                className="admin-input text-right tabular-nums"
                value={item.quantity}
                onChange={(e) => setItem(index, { quantity: e.target.value.trim() })}
              />
              <input
                inputMode="decimal"
                aria-label={`Line ${index + 1} unit price`}
                className="admin-input text-right tabular-nums"
                value={item.unit_price}
                onChange={(e) => setItem(index, { unit_price: e.target.value.trim() })}
              />
              <span className="text-right text-sm tabular-nums text-[var(--fg-dim)]">
                {c(lineTotal)}
              </span>
              <button
                type="button"
                aria-label={`Remove line ${index + 1}`}
                onClick={() =>
                  setInput((i) => ({ ...i, items: i.items.filter((_, n) => n !== index) }))
                }
                className="justify-self-end px-2 text-[var(--fg-faint)] hover:text-[var(--color-signal)]"
              >
                ×
              </button>
            </div>
          );
        })}

        <div className="flex flex-wrap items-start justify-between gap-4 px-4 py-3">
          <div className="flex flex-wrap items-center gap-4">
            <button
              type="button"
              onClick={() => addLine({ description: "", quantity: "1", unit_price: "0" })}
              className="font-mono text-[0.66rem] uppercase tracking-[0.12em] text-[var(--link)]"
            >
              + Add line
            </button>

            {/* Straight off the work rather than typed again: the price and
                the wording are already agreed, and retyping them is how the
                invoice ends up saying something the client never saw. */}
            {work && (
              <>
                <span className="text-[var(--fg-faint)]">|</span>
                <button
                  type="button"
                  onClick={() =>
                    addLine({
                      description:
                        work.billing === "monthly"
                          ? `${work.title} — ${monthName(input.period ?? monthKey(new Date()))}`
                          : work.title,
                      quantity: "1",
                      unit_price: work.budget ?? "0",
                    })
                  }
                  className="font-mono text-[0.66rem] uppercase tracking-[0.12em] text-[var(--fg-dim)] hover:text-[var(--fg)]"
                >
                  + {work.billing === "monthly" ? "The month" : "The whole job"}
                </button>
                {work.work_types.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() =>
                      addLine({ description: `${t.name} — ${work.title}`, quantity: "1", unit_price: "0" })
                    }
                    className="font-mono text-[0.66rem] uppercase tracking-[0.12em] text-[var(--fg-dim)] hover:text-[var(--fg)]"
                  >
                    + {t.name}
                  </button>
                ))}
              </>
            )}
          </div>

          <dl className="min-w-[14rem] text-sm">
            <div className="flex justify-between gap-6">
              <dt className="text-[var(--fg-faint)]">Before VAT</dt>
              <dd className="tabular-nums">{c(subtotal)}</dd>
            </div>
            <div className="mt-1 flex justify-between gap-6">
              <dt className="text-[var(--fg-faint)]">VAT {input.tva_rate || 0}%</dt>
              <dd className="tabular-nums">{c(tva)}</dd>
            </div>
            <div className="mt-2 flex justify-between gap-6 border-t border-[var(--hairline)] pt-2 font-medium">
              <dt>Total</dt>
              <dd className="tabular-nums">{c(subtotal + tva)}</dd>
            </div>
          </dl>
        </div>
      </div>

      <div className="mt-6 grid gap-5 sm:grid-cols-2">
        <Field label="Payment terms" hint="Printed on the document" error={err("terms")}>
          <textarea
            rows={3}
            maxLength={2000}
            className="admin-input resize-y leading-relaxed"
            value={input.terms ?? ""}
            onChange={(e) => set("terms", e.target.value || null)}
          />
        </Field>
        <Field label="Notes" hint="Also printed — not a private note" error={err("notes")}>
          <textarea
            rows={3}
            maxLength={2000}
            className="admin-input resize-y leading-relaxed"
            value={input.notes ?? ""}
            onChange={(e) => set("notes", e.target.value || null)}
          />
        </Field>
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <p
          role="status"
          className={`text-xs ${message ? "text-[var(--color-signal)]" : "text-[var(--link)]"}`}
        >
          {message ?? (saved ? "Saved" : "")}
        </p>
        <div className="flex flex-wrap items-center gap-4">
          <button
            type="button"
            onClick={remove}
            disabled={busy}
            className="text-xs text-[var(--fg-dim)] hover:text-[var(--color-signal)]"
          >
            Delete draft
          </button>
          <a
            href={admin.documentPdf(doc.id)}
            target="_blank"
            rel="noreferrer"
            className="px-3 py-2 text-sm text-[var(--fg-dim)] hover:text-[var(--fg)]"
          >
            Preview PDF ↗
          </a>
          <button
            type="button"
            onClick={() => save()}
            disabled={busy}
            className="border border-[var(--hairline)] px-4 py-2 font-mono text-[0.66rem] uppercase tracking-[0.12em] disabled:opacity-35"
          >
            {busy ? "Working…" : "Save draft"}
          </button>
          <button
            type="button"
            onClick={issue}
            disabled={busy || input.items.length === 0}
            className="bg-[var(--fg)] px-4 py-2 font-mono text-[0.66rem] uppercase tracking-[0.12em] text-[var(--ground)] disabled:opacity-35"
          >
            Issue
          </button>
        </div>
      </div>
    </div>
  );
}

/** An issued document: what was sent, and what has come back against it. */
/**
 * The issued invoice, sent to the client on WhatsApp with the same PDF as
 * "Open the PDF". The number defaults to the client's and can be changed
 * for this one send — to the person who actually pays, say.
 */
function SendInvoiceOnWhatsApp({ doc, clientPhone }: { doc: BillingDocument; clientPhone: string | null }) {
  const [open, setOpen] = useState(false);
  const [to, setTo] = useState(clientPhone ?? "");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const ask = useConfirm();

  async function send() {
    const number = to.trim();
    if (!number || busy) return;
    if (
      !(await ask({
        title: `Send ${doc.number} on WhatsApp?`,
        body: [
          `To ${number}, with the invoice PDF attached.`,
          "The client must have agreed to receive WhatsApp messages from you.",
        ],
        confirmLabel: "Send",
      }))
    ) {
      return;
    }
    setBusy(true);
    setResult(null);
    try {
      const r = await admin.sendInvoiceWhatsApp(doc.id, number);
      setResult({ ok: true, text: `Sent to +${r.sent_to}.` });
      setOpen(false);
    } catch (e) {
      setResult({
        ok: false,
        text:
          e instanceof ApiError && e.status === 422
            ? (Object.values(e.errors)[0]?.[0] ?? e.message)
            : e instanceof Error
              ? e.message
              : "It was not sent.",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      {!open ? (
        <button
          type="button"
          onClick={() => {
            setOpen(true);
            setResult(null);
          }}
          className="w-full border border-[var(--hairline)] bg-[var(--panel)] px-4 py-2.5 font-mono text-[0.66rem] uppercase tracking-[0.12em] hover:border-[var(--fg)]"
        >
          Send on WhatsApp
        </button>
      ) : (
        <div className="border border-[var(--hairline)] bg-[var(--panel)] p-4">
          <p className="font-mono text-[0.6rem] uppercase tracking-[0.14em] text-[var(--fg-faint)]">
            Send on WhatsApp
          </p>
          <div className="mt-3">
            <Field label="To" hint={clientPhone ? "The client's number; change it for this send only." : "This client has no number on file."}>
              <input
                className="admin-input tabular-nums"
                inputMode="tel"
                maxLength={30}
                placeholder="0612345678"
                value={to}
                onChange={(e) => setTo(e.target.value)}
              />
            </Field>
          </div>
          <div className="mt-3 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="px-2 py-2 text-sm text-[var(--fg-dim)] hover:text-[var(--fg)]"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={send}
              disabled={busy || !to.trim()}
              className="bg-[var(--fg)] px-4 py-2 font-mono text-[0.66rem] uppercase tracking-[0.12em] text-[var(--ground)] disabled:opacity-35"
            >
              {busy ? "Sending…" : "Send"}
            </button>
          </div>
        </div>
      )}
      {result && (
        <p
          role={result.ok ? "status" : "alert"}
          className={`mt-2 text-xs ${result.ok ? "text-[var(--link)]" : "text-[var(--color-signal)]"}`}
        >
          {result.text}
        </p>
      )}
    </div>
  );
}

function IssuedPanel({
  doc,
  clientPhone,
  onChanged,
  onDeleted,
}: {
  doc: BillingDocument;
  clientPhone: string | null;
  onChanged: (next: BillingDocument) => void;
  onDeleted: () => void;
}) {
  const [amount, setAmount] = useState(doc.totals.due);
  const [paidOn, setPaidOn] = useState(today());
  const [method, setMethod] = useState<PaymentMethod>("transfer");
  const [reference, setReference] = useState("");
  const ask = useConfirm();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function run(work: () => Promise<BillingDocument>) {
    setBusy(true);
    setMessage(null);
    try {
      onChanged(await work());
    } catch (e) {
      if (e instanceof ApiError && e.status === 422) {
        setMessage(Object.values(e.errors)[0]?.[0] ?? "That was refused.");
      } else {
        setMessage(e instanceof Error ? e.message : "That did not work.");
      }
    } finally {
      setBusy(false);
    }
  }

  const canBePaid = doc.type === "invoice" && doc.status === "sent" && !doc.settled;

  return (
    <div className="bg-[color-mix(in_oklab,var(--fg)_3%,transparent)] px-5 py-5">
      <div className="grid gap-6 lg:grid-cols-[1fr_18rem]">
        <div>
          <ul className="border border-[var(--hairline)] bg-[var(--panel)]">
            {doc.items.map((item) => (
              <li
                key={item.id}
                className="flex flex-wrap items-baseline justify-between gap-4 border-b border-[var(--hairline)] px-4 py-3 text-sm last:border-b-0"
              >
                <span className="min-w-0">{item.description}</span>
                <span className="shrink-0 tabular-nums text-[var(--fg-dim)]">
                  {Number(item.quantity) !== 1 ? `${item.quantity} × ` : ""}
                  {money(item.unit_price, doc.currency)}
                </span>
              </li>
            ))}
          </ul>

          <dl className="mt-4 max-w-xs text-sm">
            <div className="flex justify-between gap-6">
              <dt className="text-[var(--fg-faint)]">Before VAT</dt>
              <dd className="tabular-nums">{money(doc.totals.subtotal, doc.currency)}</dd>
            </div>
            <div className="mt-1 flex justify-between gap-6">
              <dt className="text-[var(--fg-faint)]">VAT {doc.tva_rate}%</dt>
              <dd className="tabular-nums">{money(doc.totals.tva, doc.currency)}</dd>
            </div>
            <div className="mt-2 flex justify-between gap-6 border-t border-[var(--hairline)] pt-2 font-medium">
              <dt>Total</dt>
              <dd className="tabular-nums">{money(doc.totals.total, doc.currency)}</dd>
            </div>
            {Number(doc.totals.paid) > 0 && (
              <>
                <div className="mt-1 flex justify-between gap-6">
                  <dt className="text-[var(--fg-faint)]">Paid</dt>
                  <dd className="tabular-nums">− {money(doc.totals.paid, doc.currency)}</dd>
                </div>
                {/* Only while something is actually owed: "Still owed 0.00"
                    in red is a warning about nothing. */}
                {Number(doc.totals.due) > 0 && (
                  <div className="mt-1 flex justify-between gap-6 font-medium text-[var(--color-signal)]">
                    <dt>Still owed</dt>
                    <dd className="tabular-nums">{money(doc.totals.due, doc.currency)}</dd>
                  </div>
                )}
              </>
            )}
          </dl>

          {doc.payments.length > 0 && (
            <ul className="mt-5 text-sm">
              {doc.payments.map((p) => (
                <li
                  key={p.id}
                  className="flex flex-wrap items-baseline justify-between gap-3 border-b border-[var(--hairline)] py-2"
                >
                  <span className="text-[var(--fg-dim)]">
                    {day(p.paid_on)} · {p.method}
                    {p.reference ? ` · ${p.reference}` : ""}
                  </span>
                  <span className="flex items-baseline gap-4">
                    <span className="tabular-nums">{money(p.amount, doc.currency)}</span>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => run(() => admin.removePayment(p.id))}
                      className="text-xs text-[var(--fg-faint)] hover:text-[var(--color-signal)]"
                    >
                      Remove
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <aside className="flex flex-col gap-5">
          <a
            href={admin.documentPdf(doc.id)}
            target="_blank"
            rel="noreferrer"
            className="bg-[var(--fg)] px-4 py-2.5 text-center font-mono text-[0.66rem] uppercase tracking-[0.12em] text-[var(--ground)]"
          >
            Open the PDF ↗
          </a>

          {doc.type === "invoice" && doc.status === "sent" && doc.number && (
            <SendInvoiceOnWhatsApp doc={doc} clientPhone={clientPhone} />
          )}

          {canBePaid && (
            <div className="border border-[var(--hairline)] bg-[var(--panel)] p-4">
              <p className="font-mono text-[0.6rem] uppercase tracking-[0.14em] text-[var(--fg-faint)]">
                Record a payment
              </p>
              <div className="mt-3 flex flex-col gap-3">
                <Field label={`Amount (${doc.currency})`}>
                  <input
                    inputMode="decimal"
                    className="admin-input tabular-nums"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value.trim())}
                  />
                </Field>
                <Field label="Date">
                  <input
                    type="date"
                    className="admin-input"
                    value={paidOn}
                    onChange={(e) => setPaidOn(e.target.value)}
                  />
                </Field>
                <Field label="How">
                  <select
                    className="admin-input"
                    value={method}
                    onChange={(e) => setMethod(e.target.value as PaymentMethod)}
                  >
                    {PAYMENT_METHODS.map((m) => (
                      <option key={m} value={m}>
                        {m[0].toUpperCase() + m.slice(1)}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Reference" hint="Cheque number, transfer note">
                  <input
                    className="admin-input"
                    maxLength={120}
                    value={reference}
                    onChange={(e) => setReference(e.target.value)}
                  />
                </Field>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    run(async () => {
                      const next = await admin.addPayment(doc.id, {
                        amount,
                        paid_on: paidOn,
                        method,
                        reference: reference || null,
                      });
                      setReference("");
                      setAmount(next.totals.due);
                      return next;
                    })
                  }
                  className="bg-[var(--fg)] px-4 py-2 font-mono text-[0.66rem] uppercase tracking-[0.12em] text-[var(--ground)] disabled:opacity-35"
                >
                  {busy ? "Saving…" : "Record it"}
                </button>
              </div>
            </div>
          )}

          {doc.type === "quote" && doc.status === "sent" && (
            <div className="flex gap-3">
              <button
                type="button"
                disabled={busy}
                onClick={() => run(() => admin.setDocumentStatus(doc.id, "accepted"))}
                className="flex-1 border border-[var(--hairline)] px-3 py-2 font-mono text-[0.66rem] uppercase tracking-[0.12em] disabled:opacity-35"
              >
                Accepted
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => run(() => admin.setDocumentStatus(doc.id, "declined"))}
                className="flex-1 border border-[var(--hairline)] px-3 py-2 font-mono text-[0.66rem] uppercase tracking-[0.12em] text-[var(--fg-dim)] disabled:opacity-35"
              >
                Declined
              </button>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3">
            {doc.status !== "cancelled" ? (
              <button
                type="button"
                disabled={busy}
                onClick={async () => {
                  if (
                    await ask({
                      title: `Cancel ${doc.number ?? `this ${doc.type}`}?`,
                      body: "It keeps its number and stays in the list, marked cancelled.",
                      confirmLabel: "Cancel it",
                      cancelLabel: "Keep it",
                    })
                  ) {
                    run(() => admin.setDocumentStatus(doc.id, "cancelled"));
                  }
                }}
                className="text-xs text-[var(--fg-dim)] hover:text-[var(--color-signal)]"
              >
                Cancel this {doc.type}
              </button>
            ) : (
              <span />
            )}

            {/* Deleting an issued document leaves a hole in the numbering,
                so the question says exactly that, and exactly what else
                disappears with it. */}
            <button
              type="button"
              disabled={busy}
              onClick={async () => {
                const parts = [
                  doc.payments.length > 0
                    ? `The ${doc.payments.length === 1 ? "payment" : `${doc.payments.length} payments`} recorded against it go too.`
                    : null,
                  doc.number
                    ? `${doc.number} will be missing from the numbering, which is the first thing an inspector asks about. Cancelling keeps the number and marks it cancelled.`
                    : null,
                ].filter((p): p is string => Boolean(p));

                if (
                  await ask({
                    title: `Delete ${doc.number ?? `this ${doc.type}`} for good?`,
                    body: parts,
                    confirmLabel: "Delete",
                    tone: "danger",
                  })
                ) {
                  setBusy(true);
                  admin.removeDocument(doc.id).then(onDeleted, (e) => {
                    setMessage(e instanceof Error ? e.message : "Could not delete it.");
                    setBusy(false);
                  });
                }
              }}
              className="text-xs text-[var(--fg-faint)] hover:text-[var(--color-signal)]"
            >
              Delete
            </button>
          </div>

          {message && (
            <p role="alert" className="text-xs text-[var(--color-signal)]">
              {message}
            </p>
          )}
        </aside>
      </div>
    </div>
  );
}
