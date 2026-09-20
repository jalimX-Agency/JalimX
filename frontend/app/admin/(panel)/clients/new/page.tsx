"use client";

import Link from "next/link";

import { ClientForm } from "@/components/admin/client-form";

export default function NewClientPage() {
  return (
    <div className="max-w-5xl">
      <Link
        href="/admin/clients"
        className="font-mono text-[0.66rem] uppercase tracking-[0.14em] text-[var(--fg-faint)] hover:text-[var(--fg)]"
      >
        ← Clients
      </Link>

      <h1 className="mt-6 font-display text-3xl font-semibold tracking-tight">New client</h1>
      <p className="mt-2 max-w-[60ch] text-sm text-[var(--fg-dim)]">
        Only the name is required. The invoicing details can wait until there
        is something to invoice.
      </p>

      <div className="mt-8">
        <ClientForm />
      </div>
    </div>
  );
}
