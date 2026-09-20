"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { ClientForm } from "@/components/admin/client-form";
import { PageSkeleton, PanelsSkeleton } from "@/components/admin/skeleton";
import { admin, isSignedOut, type Client } from "@/lib/admin/client";

export default function ClientPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [client, setClient] = useState<Client | null>(null);
  const [error, setError] = useState<string | null>(null);

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
        `Delete ${client.name}? This cannot be undone. Everything you have written about them goes too.`,
      )
    ) {
      return;
    }
    await admin.removeClient(client.id);
    router.push("/admin/clients");
  }

  return (
    <div className="max-w-5xl">
      <Link
        href="/admin/clients"
        className="font-mono text-[0.66rem] uppercase tracking-[0.14em] text-[var(--fg-faint)] hover:text-[var(--fg)]"
      >
        ← Clients
      </Link>

      <div className="mt-6 flex flex-wrap items-end justify-between gap-6">
        <div>
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

      <div className="mt-8">
        <ClientForm key={client.id} client={client} onSaved={setClient} />
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
  );
}
