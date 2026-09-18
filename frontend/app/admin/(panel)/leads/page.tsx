"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

import { LeadStatusChip, STATUS_LABEL, when } from "@/components/admin/lead-status";
import { RowsSkeleton } from "@/components/admin/skeleton";
import { admin, isSignedOut, LEAD_STATUSES, type LeadPage, type LeadStatus } from "@/lib/admin/client";

export default function LeadsPage() {
  // useSearchParams needs a boundary for the static build of /admin.
  return (
    <Suspense>
      <Inbox />
    </Suspense>
  );
}

function Inbox() {
  const router = useRouter();
  const params = useSearchParams();

  // The filter lives in the URL, so "back" from a lead returns to the same tab.
  const status = (LEAD_STATUSES as readonly string[]).includes(params.get("status") ?? "")
    ? (params.get("status") as LeadStatus)
    : undefined;
  const q = params.get("q") ?? "";
  const page = Number(params.get("page") ?? 1) || 1;

  const [result, setResult] = useState<LeadPage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState(q);

  useEffect(() => {
    let live = true;
    admin.leads({ status, q, page }).then(
      (r) => live && setResult(r),
      (e) => live && !isSignedOut(e) && setError(e.message),
    );
    return () => {
      live = false;
    };
  }, [status, q, page]);

  function go(next: { status?: LeadStatus; q?: string; page?: number }) {
    const query = new URLSearchParams();
    if (next.status) query.set("status", next.status);
    if (next.q) query.set("q", next.q);
    if (next.page && next.page > 1) query.set("page", String(next.page));
    const qs = query.toString();
    router.push(`/admin/leads${qs ? `?${qs}` : ""}`);
  }

  // Search as you type, but not a request per keystroke.
  useEffect(() => {
    if (search === q) return;
    const t = setTimeout(() => go({ status, q: search.trim() }), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- go is rebuilt every render
  }, [search]);

  const counts = result?.meta.counts;
  const all = counts ? Object.values(counts).reduce((a, b) => a + b, 0) : null;

  return (
    <div className="max-w-5xl">
      <p className="font-mono text-[0.66rem] uppercase tracking-[0.16em] text-[var(--fg-faint)]">
        Inbox
      </p>
      <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
        <h1 className="font-display text-3xl font-semibold tracking-tight">Leads</h1>
        {result && result.meta.unread > 0 && (
          <p className="font-mono text-[0.66rem] uppercase tracking-[0.12em] text-[var(--color-signal)]">
            {result.meta.unread} unread
          </p>
        )}
      </div>
      <p className="mt-2 max-w-[60ch] text-sm text-[var(--fg-dim)]">
        Everyone who sent the contact form. Move a lead along as the
        conversation goes; notes stay here and are never shown to them.
      </p>

      <div className="mt-8 flex flex-wrap items-center justify-between gap-4 border-b border-[var(--hairline)]">
        <nav aria-label="Filter by status" className="-mb-px flex max-w-full overflow-x-auto">
          {[undefined, ...LEAD_STATUSES].map((s) => {
            const active = s === status;
            const count = s ? counts?.[s] : all;
            return (
              <button
                key={s ?? "all"}
                type="button"
                onClick={() => go({ status: s, q })}
                aria-current={active ? "page" : undefined}
                className={`flex shrink-0 items-center gap-2 border-b-2 px-3 py-2.5 text-sm transition-colors ${
                  active
                    ? "border-[var(--link)] text-[var(--fg)]"
                    : "border-transparent text-[var(--fg-dim)] hover:text-[var(--fg)]"
                }`}
              >
                {s ? STATUS_LABEL[s] : "All"}
                {count != null && (
                  <span className="font-mono text-[0.62rem] tabular-nums text-[var(--fg-faint)]">{count}</span>
                )}
              </button>
            );
          })}
        </nav>

        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name, email, company, phone"
          aria-label="Search leads"
          className="mb-2 w-full border border-[var(--hairline)] bg-[var(--panel)] px-3 py-2 text-sm outline-none placeholder:text-[var(--fg-faint)] focus:border-[var(--link)] sm:w-72"
        />
      </div>

      {error && (
        <p role="alert" className="mt-8 text-sm text-[var(--color-signal)]">
          {error}
        </p>
      )}

      {!result && !error && <RowsSkeleton rows={6} />}

      {result && result.data.length === 0 && (
        <p className="mt-12 text-center text-sm text-[var(--fg-faint)]">
          {q ? `Nothing matches “${q}”.` : status ? `No ${STATUS_LABEL[status].toLowerCase()} leads.` : "No leads yet. They arrive here from the contact form."}
        </p>
      )}

      {result && result.data.length > 0 && (
        <ul className="mt-6 grid gap-px border border-[var(--hairline)] bg-[var(--hairline)]">
          {result.data.map((lead) => (
            <li key={lead.id}>
              <Link
                href={`/admin/leads/${lead.id}`}
                className="group grid grid-cols-[0.5rem_1fr_auto] items-start gap-x-4 gap-y-1 bg-[var(--panel)] px-5 py-4 transition-colors hover:bg-[color-mix(in_oklab,var(--link)_4%,var(--panel))] sm:grid-cols-[0.5rem_14rem_1fr_auto]"
              >
                <span
                  aria-label={lead.is_read ? undefined : "Unread"}
                  className={`mt-2 h-2 w-2 rounded-full ${lead.is_read ? "" : "bg-[var(--color-signal)]"}`}
                />

                <div className="min-w-0">
                  <p className={`truncate ${lead.is_read ? "" : "font-semibold"}`}>{lead.name}</p>
                  <p className="truncate font-mono text-[0.66rem] text-[var(--fg-faint)]">
                    {lead.company || lead.email}
                  </p>
                </div>

                <div className="col-start-2 row-start-2 min-w-0 sm:col-start-3 sm:row-start-1">
                  <p className="font-mono text-[0.62rem] uppercase tracking-[0.1em] text-[var(--fg-faint)]">
                    {[lead.service_interest, lead.budget_range].filter(Boolean).join(" · ") || "—"}
                  </p>
                  <p className="mt-1 line-clamp-1 text-sm text-[var(--fg-dim)]">{lead.message}</p>
                </div>

                <div className="col-start-3 row-span-2 flex flex-col items-end gap-2 sm:col-start-4 sm:row-span-1">
                  <LeadStatusChip status={lead.status} />
                  <time
                    dateTime={lead.created_at}
                    className="font-mono text-[0.62rem] tabular-nums text-[var(--fg-faint)]"
                  >
                    {when(lead.created_at)}
                  </time>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {result && result.meta.last_page > 1 && (
        <div className="mt-6 flex items-center justify-between text-sm">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => go({ status, q, page: page - 1 })}
            className="text-[var(--link)] disabled:text-[var(--fg-faint)]"
          >
            ← Newer
          </button>
          <span className="font-mono text-[0.66rem] tabular-nums text-[var(--fg-faint)]">
            {page} / {result.meta.last_page}
          </span>
          <button
            type="button"
            disabled={page >= result.meta.last_page}
            onClick={() => go({ status, q, page: page + 1 })}
            className="text-[var(--link)] disabled:text-[var(--fg-faint)]"
          >
            Older →
          </button>
        </div>
      )}
    </div>
  );
}
