"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

import { RowsSkeleton } from "@/components/admin/skeleton";
import { admin, isSignedOut, type Client } from "@/lib/admin/client";

export default function ClientsPage() {
  // useSearchParams needs a boundary for the static build of /admin.
  return (
    <Suspense>
      <Clients />
    </Suspense>
  );
}

function Clients() {
  const router = useRouter();
  const q = useSearchParams().get("q") ?? "";

  const [clients, setClients] = useState<Client[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState(q);

  useEffect(() => {
    let live = true;
    admin.clients(q).then(
      (list) => live && setClients(list),
      (e) => live && !isSignedOut(e) && setError(e.message),
    );
    return () => {
      live = false;
    };
  }, [q]);

  // Search as you type, but not a request per keystroke.
  useEffect(() => {
    if (search === q) return;
    const t = setTimeout(() => {
      const term = search.trim();
      router.push(`/admin/clients${term ? `?q=${encodeURIComponent(term)}` : ""}`);
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- router is stable enough here
  }, [search]);

  return (
    <div className="max-w-5xl">
      <p className="font-mono text-[0.66rem] uppercase tracking-[0.16em] text-[var(--fg-faint)]">
        Agency
      </p>
      <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
        <h1 className="font-display text-3xl font-semibold tracking-tight">Clients</h1>
        <Link
          href="/admin/clients/new"
          className="bg-[var(--fg)] px-4 py-2.5 font-mono text-[0.66rem] uppercase tracking-[0.12em] text-[var(--ground)]"
        >
          + New client
        </Link>
      </div>
      <p className="mt-2 max-w-[60ch] text-sm text-[var(--fg-dim)]">
        The businesses you work for. What goes on an invoice lives here, so it
        is typed once and not again on every document.
      </p>

      <div className="mt-8 border-b border-[var(--hairline)] pb-3">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name, contact, email, city"
          aria-label="Search clients"
          className="w-full border border-[var(--hairline)] bg-[var(--panel)] px-3 py-2 text-sm outline-none placeholder:text-[var(--fg-faint)] focus:border-[var(--link)] sm:w-80"
        />
      </div>

      {error && (
        <p role="alert" className="mt-8 text-sm text-[var(--color-signal)]">
          {error}
        </p>
      )}

      {!clients && !error && <RowsSkeleton rows={4} />}

      {clients && clients.length === 0 && (
        <p className="mt-12 text-center text-sm text-[var(--fg-faint)]">
          {q
            ? `Nothing matches “${q}”.`
            : "No clients yet. Add one, or convert an enquiry from Leads."}
        </p>
      )}

      {clients && clients.length > 0 && (
        <ul className="mt-6 grid gap-px border border-[var(--hairline)] bg-[var(--hairline)]">
          {clients.map((c) => (
            <li key={c.id}>
              <Link
                href={`/admin/clients/${c.id}`}
                className="group flex flex-wrap items-center gap-x-5 gap-y-1 bg-[var(--panel)] px-5 py-4 transition-colors hover:bg-[color-mix(in_oklab,var(--link)_4%,var(--panel))]"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{c.name}</p>
                  <p className="truncate font-mono text-[0.66rem] text-[var(--fg-faint)]">
                    {[c.contact_name, c.city].filter(Boolean).join(" · ") || c.email || "—"}
                  </p>
                </div>

                {/* The ICE is the tell for "ready to invoice": without it a
                    Moroccan invoice is not compliant, so it is worth seeing
                    from the list rather than opening each client to check. */}
                <span
                  className={`font-mono text-[0.6rem] uppercase tracking-[0.12em] ${
                    c.ice ? "text-[var(--fg-faint)]" : "text-[var(--color-signal)]"
                  }`}
                >
                  {c.ice ? `ICE ${c.ice}` : "No ICE"}
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
