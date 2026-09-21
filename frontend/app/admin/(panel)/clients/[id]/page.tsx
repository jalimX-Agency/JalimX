"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { ClientForm } from "@/components/admin/client-form";
import { Engagements } from "@/components/admin/engagements";
import { PageSkeleton, PanelsSkeleton } from "@/components/admin/skeleton";
import { admin, isSignedOut, type Client } from "@/lib/admin/client";

/**
 * One client, one page.
 *
 * Everything about them lives here — how to reach them, the work, and the
 * details an invoice needs — because chasing a client across three screens
 * to answer one question is how a dashboard becomes something you avoid.
 * The tabs swap a section in place; they are not links, and nothing is
 * fetched again when you move between them.
 */

const TABS = ["Work", "Details"] as const;
type Tab = (typeof TABS)[number];

export default function ClientPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [client, setClient] = useState<Client | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("Work");
  const [detailsDirty, setDetailsDirty] = useState(false);

  useEffect(() => {
    let live = true;
    admin.client(id).then(
      (c) => live && setClient(c),
      (e) =>
        live &&
        !isSignedOut(e) &&
        setError(e.status === 404 ? "This client no longer exists." : e.message),
    );
    return () => {
      live = false;
    };
  }, [id]);

  if (error) {
    return (
      <p role="alert" className="text-sm text-[var(--color-signal)]">
        {error}
      </p>
    );
  }
  if (!client) {
    return (
      <PageSkeleton>
        <PanelsSkeleton panels={2} />
      </PageSkeleton>
    );
  }

  async function remove() {
    if (!client) return;
    if (
      !window.confirm(
        `Delete ${client.name}? This cannot be undone. Everything you have written about them, and all their work, goes too.`,
      )
    ) {
      return;
    }
    await admin.removeClient(client.id);
    router.push("/admin/clients");
  }

  const reach = [
    client.contact_name,
    client.email,
    client.phone,
    client.city,
  ].filter(Boolean) as string[];

  return (
    <div className="max-w-5xl">
      <Link
        href="/admin/clients"
        className="font-mono text-[0.66rem] uppercase tracking-[0.14em] text-[var(--fg-faint)] hover:text-[var(--fg)]"
      >
        ← Clients
      </Link>

      <div className="mt-6 flex flex-wrap items-end justify-between gap-6">
        <div className="min-w-0">
          <h1 className="font-display text-3xl font-semibold tracking-tight">{client.name}</h1>
          {client.legal_name && client.legal_name !== client.name && (
            <p className="mt-1 text-sm text-[var(--fg-dim)]">{client.legal_name}</p>
          )}
        </div>

        <div className="flex items-center gap-5 text-sm">
          {client.lead_id && (
            <Link
              href={`/admin/leads/${client.lead_id}`}
              className="text-[var(--link)] underline-offset-4 hover:underline"
            >
              From enquiry ↗
            </Link>
          )}
          {client.website && (
            <a
              href={client.website}
              target="_blank"
              rel="noreferrer"
              className="text-[var(--fg-dim)] underline-offset-4 hover:underline"
            >
              Their site ↗
            </a>
          )}
        </div>
      </div>

      {/* The line you read before picking up the phone. Email and number are
          live links, so the page is also the way you get in touch. */}
      <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-[var(--fg-dim)]">
        {client.contact_name && <span>{client.contact_name}</span>}
        {client.email && (
          <a
            href={`mailto:${client.email}`}
            className="break-all text-[var(--link)] underline-offset-4 hover:underline"
          >
            {client.email}
          </a>
        )}
        {client.phone && (
          <a
            href={`tel:${client.phone.replace(/[^\d+]/g, "")}`}
            className="tabular-nums text-[var(--link)] underline-offset-4 hover:underline"
          >
            {client.phone}
          </a>
        )}
        {client.city && <span>{client.city}</span>}
        {reach.length === 0 && <span className="text-[var(--fg-faint)]">No contact details yet</span>}
        {!client.ice && (
          <span className="font-mono text-[0.66rem] uppercase tracking-[0.12em] text-[var(--color-signal)]">
            No ICE
          </span>
        )}
      </div>

      <div
        role="tablist"
        aria-label="This client"
        className="mt-8 flex gap-6 border-b border-[var(--hairline)]"
      >
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={`-mb-px border-b px-1 pb-3 font-mono text-[0.66rem] uppercase tracking-[0.14em] transition-colors ${
              tab === t
                ? "border-[var(--fg)] text-[var(--fg)]"
                : "border-transparent text-[var(--fg-faint)] hover:text-[var(--fg)]"
            }`}
          >
            {t}
            {t === "Details" && detailsDirty && (
              <span
                aria-label="unsaved"
                className="ml-2 inline-block h-1.5 w-1.5 rounded-full bg-[var(--color-signal)] align-middle"
              />
            )}
          </button>
        ))}
      </div>

      {/* Both panels stay mounted: switching tabs must not throw away a half
          typed note or a half filled form. */}
      <div className="mt-8" hidden={tab !== "Work"}>
        <Engagements client={client} />
      </div>

      <div hidden={tab !== "Details"}>
        <div className="mt-8">
          <ClientForm
            key={client.id}
            client={client}
            onSaved={setClient}
            onDirtyChange={setDetailsDirty}
          />
        </div>

        {/* Below the form and quiet: deleting is rare and should never sit
            next to Save. */}
        <div className="-mt-20 pb-4">
          <button
            type="button"
            onClick={remove}
            className="text-xs text-[var(--fg-dim)] hover:text-[var(--color-signal)]"
          >
            Delete this client
          </button>
        </div>
      </div>
    </div>
  );
}
