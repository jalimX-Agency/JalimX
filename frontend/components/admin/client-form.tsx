"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Field, Heading, SaveBar, useUnsavedWarning } from "@/components/admin/fields";
import { admin, ApiError, type Client, type ClientInput } from "@/lib/admin/client";

/**
 * One form for both creating and editing a client.
 *
 * Split in two panels on purpose: the top is who you talk to, the bottom is
 * what an invoice needs. They are filled at different times — the first when
 * the enquiry arrives, the second only once there is money involved — and
 * keeping them apart stops the form reading as a tax return on day one.
 */

type Props = {
  /** Absent when creating. */
  client?: Client;
  onSaved?: (next: Client) => void;
};

export function ClientForm({ client, onSaved }: Props) {
  const router = useRouter();
  const initial: ClientInput = {
    name: client?.name ?? "",
    legal_name: client?.legal_name ?? null,
    ice: client?.ice ?? null,
    contact_name: client?.contact_name ?? null,
    email: client?.email ?? null,
    phone: client?.phone ?? null,
    website: client?.website ?? null,
    address: client?.address ?? null,
    city: client?.city ?? null,
    country: client?.country ?? "Morocco",
    currency: client?.currency ?? "MAD",
    notes: client?.notes ?? null,
  };

  const [input, setInput] = useState<ClientInput>(initial);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const dirty = JSON.stringify(input) !== JSON.stringify(initial);
  useUnsavedWarning(dirty);

  const err = (key: string) => errors[key]?.[0];
  // Empty is absent, not "": a blank optional field should be null in the
  // database rather than an empty string that later reads as a real value.
  const set = (key: keyof ClientInput, value: string) =>
    setInput((i) => ({ ...i, [key]: value === "" ? null : value }));

  async function save() {
    setSaving(true);
    setMessage(null);
    try {
      const next = client
        ? await admin.updateClient(client.id, input)
        : await admin.createClient(input);

      setErrors({});
      if (client) {
        setSaved(true);
        setTimeout(() => setSaved(false), 2500);
        onSaved?.(next);
      } else {
        router.push(`/admin/clients/${next.id}`);
      }
    } catch (e) {
      if (e instanceof ApiError && e.status === 422) {
        setErrors(e.errors);
        const n = Object.keys(e.errors).length;
        setMessage(n === 1 ? Object.values(e.errors)[0][0] : `${n} fields need attention.`);
      } else {
        setMessage(e instanceof Error ? e.message : "Saving failed.");
      }
    } finally {
      setSaving(false);
    }
  }

  const text = (key: keyof ClientInput) => (input[key] as string | null) ?? "";

  return (
    <div className="flex flex-col gap-8 pb-28">
      <section className="border border-[var(--hairline)] bg-[var(--panel)]">
        <Heading title="Who they are" hint="What you call them, and who you talk to" />
        <div className="grid gap-5 p-5 sm:grid-cols-2">
          <Field label="Name" hint="How you refer to them day to day" error={err("name")}>
            <input
              className="admin-input"
              maxLength={120}
              value={text("name")}
              aria-invalid={!!err("name")}
              onChange={(e) => set("name", e.target.value)}
            />
          </Field>
          <Field label="Contact person" error={err("contact_name")}>
            <input
              className="admin-input"
              maxLength={120}
              value={text("contact_name")}
              onChange={(e) => set("contact_name", e.target.value)}
            />
          </Field>
          <Field label="Email" error={err("email")}>
            <input
              type="email"
              className="admin-input"
              value={text("email")}
              aria-invalid={!!err("email")}
              onChange={(e) => set("email", e.target.value.trim())}
            />
          </Field>
          <Field label="Phone" error={err("phone")}>
            <input
              type="tel"
              className="admin-input tabular-nums"
              value={text("phone")}
              aria-invalid={!!err("phone")}
              onChange={(e) => set("phone", e.target.value)}
            />
          </Field>
          <Field label="Website" hint="Their own site" error={err("website")}>
            <input
              type="url"
              className="admin-input"
              placeholder="https://"
              value={text("website")}
              aria-invalid={!!err("website")}
              onChange={(e) => set("website", e.target.value.trim())}
            />
          </Field>
          <Field label="City" error={err("city")}>
            <input
              className="admin-input"
              maxLength={80}
              value={text("city")}
              onChange={(e) => set("city", e.target.value)}
            />
          </Field>
        </div>
      </section>

      <section className="border border-[var(--hairline)] bg-[var(--panel)]">
        <Heading title="For invoices" hint="Only needed once you bill them" />
        <div className="grid gap-5 p-5 sm:grid-cols-2">
          <Field
            label="Legal name"
            hint="The registered company, if different"
            error={err("legal_name")}
          >
            <input
              className="admin-input"
              maxLength={160}
              value={text("legal_name")}
              onChange={(e) => set("legal_name", e.target.value)}
            />
          </Field>
          <Field label="ICE" hint="Their company ID — goes on the invoice" error={err("ice")}>
            <input
              className="admin-input font-mono text-sm tabular-nums"
              maxLength={20}
              value={text("ice")}
              aria-invalid={!!err("ice")}
              onChange={(e) => set("ice", e.target.value)}
            />
          </Field>
          <Field label="Address" error={err("address")}>
            <input
              className="admin-input"
              maxLength={190}
              value={text("address")}
              onChange={(e) => set("address", e.target.value)}
            />
          </Field>
          <div className="grid grid-cols-2 gap-5">
            <Field label="Country" error={err("country")}>
              <input
                className="admin-input"
                maxLength={80}
                value={text("country")}
                aria-invalid={!!err("country")}
                onChange={(e) => setInput((i) => ({ ...i, country: e.target.value }))}
              />
            </Field>
            <Field label="Currency" hint="3 letters" error={err("currency")}>
              <input
                className="admin-input font-mono uppercase"
                maxLength={3}
                value={text("currency")}
                aria-invalid={!!err("currency")}
                onChange={(e) =>
                  setInput((i) => ({ ...i, currency: e.target.value.toUpperCase() }))
                }
              />
            </Field>
          </div>
        </div>
      </section>

      <section className="border border-[var(--hairline)] bg-[var(--panel)]">
        <Heading title="Notes" hint="Only you see this" />
        <textarea
          rows={4}
          maxLength={5000}
          className="admin-input resize-y border-0 leading-relaxed"
          placeholder="How they like to work, what they asked for, anything worth remembering…"
          value={text("notes")}
          onChange={(e) => set("notes", e.target.value)}
        />
      </section>

      <SaveBar
        dirty={dirty || !client}
        saving={saving}
        saved={saved}
        message={message}
        onSave={save}
        onDiscard={() => {
          if (!client) {
            router.push("/admin/clients");
            return;
          }
          setInput(initial);
          setErrors({});
          setMessage(null);
        }}
      />
    </div>
  );
}
