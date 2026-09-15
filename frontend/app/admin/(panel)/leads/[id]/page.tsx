"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { STATUS_LABEL } from "@/components/admin/lead-status";
import { admin, LEAD_STATUSES, type Lead, type LeadStatus } from "@/lib/admin/client";

/**
 * wa.me wants the number in international form with no symbols. Most of
 * these arrive as a local Moroccan 06/07 number, which is 212 plus the rest.
 */
function whatsapp(phone: string): string | null {
  let digits = phone.replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  else if (digits.length === 10 && digits.startsWith("0")) digits = `212${digits.slice(1)}`;
  return digits.length >= 8 ? `https://wa.me/${digits}` : null;
}

export default function LeadPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [lead, setLead] = useState<Lead | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState<"status" | "note" | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    admin.lead(id).then(
      (l) => {
        setLead(l);
        setNote(l.note ?? "");
      },
      (e) => setError(e.status === 404 ? "This lead no longer exists." : e.message),
    );
  }, [id]);

  if (error) return <p role="alert" className="text-sm text-[var(--color-signal)]">{error}</p>;
  if (!lead) return null;

  async function setStatus(status: LeadStatus) {
    if (!lead || status === lead.status) return;
    setSaving("status");
    const previous = lead;
    setLead({ ...lead, status }); // the button should answer the click, not the network
    try {
      setLead(await admin.updateLead(lead.id, { status }));
    } catch (e) {
      setLead(previous);
      setError((e as Error).message);
    } finally {
      setSaving(null);
    }
  }

  async function saveNote() {
    if (!lead) return;
    setSaving("note");
    try {
      setLead(await admin.updateLead(lead.id, { note: note.trim() || null }));
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(null);
    }
  }

  async function markUnread() {
    if (!lead) return;
    await admin.updateLead(lead.id, { is_read: false });
    router.push("/admin/leads");
  }

  async function remove() {
    if (!lead) return;
    if (!window.confirm(`Delete the lead from ${lead.name}? This cannot be undone. For a real enquiry that went nowhere, mark it Lost instead.`)) return;
    await admin.removeLead(lead.id);
    router.push("/admin/leads");
  }

  const noteDirty = note.trim() !== (lead.note ?? "");
  const wa = lead.phone ? whatsapp(lead.phone) : null;
  const received = new Date(lead.created_at).toLocaleString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="max-w-5xl">
      {/* A link, not history.back(): the email notification opens this page
          directly, with nothing behind it to go back to. */}
      <Link
        href="/admin/leads"
        className="font-mono text-[0.66rem] uppercase tracking-[0.14em] text-[var(--fg-faint)] hover:text-[var(--fg)]"
      >
        ← Leads
      </Link>

      <div className="mt-6">
        <p className="font-mono text-[0.66rem] uppercase tracking-[0.16em] text-[var(--link)]">
          {received} · {lead.locale.toUpperCase()}
          {lead.source ? ` · ${lead.source}` : ""}
        </p>
        <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight">{lead.name}</h1>
        {lead.company && <p className="mt-1 text-[var(--fg-dim)]">{lead.company}</p>}
      </div>

      <div className="mt-10 grid gap-8 lg:grid-cols-[1fr_20rem]">
        <div className="flex flex-col gap-8">
          <section className="border border-[var(--hairline)] bg-[var(--panel)]">
            <dl className="grid grid-cols-2 border-b border-[var(--hairline)] text-sm">
              <div className="border-r border-[var(--hairline)] px-5 py-3.5">
                <dt className="font-mono text-[0.6rem] uppercase tracking-[0.14em] text-[var(--fg-faint)]">Service</dt>
                <dd className="mt-1">{lead.service_interest || "—"}</dd>
              </div>
              <div className="px-5 py-3.5">
                <dt className="font-mono text-[0.6rem] uppercase tracking-[0.14em] text-[var(--fg-faint)]">Budget</dt>
                <dd className="mt-1">{lead.budget_range || "—"}</dd>
              </div>
            </dl>
            <p className="whitespace-pre-wrap px-5 py-5 leading-relaxed">{lead.message}</p>
          </section>

          <section className="border border-[var(--hairline)] bg-[var(--panel)]">
            <header className="flex items-baseline justify-between gap-3 border-b border-[var(--hairline)] px-5 py-3.5">
              <h2 className="font-mono text-[0.66rem] uppercase tracking-[0.14em]">Note</h2>
              <p className="text-xs text-[var(--fg-faint)]">Only the team sees this</p>
            </header>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={5}
              maxLength={5000}
              placeholder="What was said on the call, what to send next…"
              aria-label="Note"
              className="block w-full resize-y bg-transparent px-5 py-4 text-sm leading-relaxed outline-none placeholder:text-[var(--fg-faint)]"
            />
            <div className="flex items-center justify-end gap-4 border-t border-[var(--hairline)] px-5 py-3">
              {saved && <span className="text-xs text-[var(--link)]">Saved</span>}
              <button
                type="button"
                onClick={saveNote}
                disabled={!noteDirty || saving === "note"}
                className="bg-[var(--fg)] px-4 py-2 font-mono text-[0.66rem] uppercase tracking-[0.12em] text-[var(--ground)] disabled:opacity-35"
              >
                {saving === "note" ? "Saving…" : "Save note"}
              </button>
            </div>
          </section>
        </div>

        <aside className="flex flex-col gap-8">
          <section className="border border-[var(--hairline)] bg-[var(--panel)]">
            <h2 className="border-b border-[var(--hairline)] px-5 py-3.5 font-mono text-[0.66rem] uppercase tracking-[0.14em]">
              Reach them
            </h2>
            <ul className="flex flex-col text-sm">
              <li className="border-b border-[var(--hairline)] px-5 py-3">
                <a href={`mailto:${lead.email}`} className="break-all text-[var(--link)] underline-offset-4 hover:underline">
                  {lead.email}
                </a>
              </li>
              {lead.phone && (
                <li className="flex items-center justify-between gap-3 px-5 py-3">
                  <a href={`tel:${lead.phone.replace(/[^\d+]/g, "")}`} className="tabular-nums text-[var(--link)] underline-offset-4 hover:underline">
                    {lead.phone}
                  </a>
                  {wa && (
                    <a href={wa} target="_blank" rel="noreferrer" className="text-xs text-[var(--fg-dim)] hover:text-[var(--fg)]">
                      WhatsApp ↗
                    </a>
                  )}
                </li>
              )}
            </ul>
          </section>

          <section className="border border-[var(--hairline)] bg-[var(--panel)]">
            <h2 className="border-b border-[var(--hairline)] px-5 py-3.5 font-mono text-[0.66rem] uppercase tracking-[0.14em]">
              Status
            </h2>
            <div role="radiogroup" aria-label="Status" className="flex flex-col p-2">
              {LEAD_STATUSES.map((s) => {
                const active = s === lead.status;
                return (
                  <button
                    key={s}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    disabled={saving === "status"}
                    onClick={() => setStatus(s)}
                    className={`flex items-center justify-between px-3 py-2 text-left text-sm transition-colors ${
                      active
                        ? "bg-[color-mix(in_oklab,var(--link)_10%,transparent)] text-[var(--fg)]"
                        : "text-[var(--fg-dim)] hover:text-[var(--fg)]"
                    }`}
                  >
                    {STATUS_LABEL[s]}
                    {active && <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-[var(--link)]" />}
                  </button>
                );
              })}
            </div>
          </section>

          <div className="flex items-center justify-between px-1 text-xs">
            <button type="button" onClick={markUnread} className="text-[var(--fg-dim)] hover:text-[var(--fg)]">
              Mark as unread
            </button>
            <button type="button" onClick={remove} className="text-[var(--fg-dim)] hover:text-[var(--color-signal)]">
              Delete as spam
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
}
