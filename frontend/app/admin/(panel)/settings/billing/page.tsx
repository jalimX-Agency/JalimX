"use client";

import { useEffect, useState } from "react";

import { Field, Heading, SaveBar, useUnsavedWarning } from "@/components/admin/fields";
import { PageSkeleton, PanelsSkeleton } from "@/components/admin/skeleton";
import { admin, ApiError, isSignedOut, type BillingProfile } from "@/lib/admin/client";

/**
 * What appears at the top of every invoice.
 *
 * Only the trading name is required. JalimX is a freelancer today — no
 * company number, no VAT registration — and an invoice that cannot be
 * written until an ICE exists would be an invoice that cannot be written.
 * Empty fields are simply left off the page.
 */
export default function BillingSettingsPage() {
  const [profile, setProfile] = useState<BillingProfile | null>(null);
  const [input, setInput] = useState<BillingProfile | null>(null);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let live = true;
    admin.billingProfile().then(
      (p) => {
        if (!live) return;
        setProfile(p);
        setInput(p);
      },
      (e) => live && !isSignedOut(e) && setMessage(e.message),
    );
    return () => {
      live = false;
    };
  }, []);

  const dirty = !!input && !!profile && JSON.stringify(input) !== JSON.stringify(profile);
  useUnsavedWarning(dirty);

  if (!input || !profile) {
    return (
      <PageSkeleton>
        <PanelsSkeleton panels={2} />
      </PageSkeleton>
    );
  }

  const err = (key: string) => errors[key]?.[0];
  const set = (key: keyof BillingProfile, value: string) =>
    setInput((i) => (i ? { ...i, [key]: value } : i));
  const text = (key: keyof BillingProfile) => input[key] ?? "";

  async function save() {
    if (!input) return;
    setSaving(true);
    setMessage(null);
    try {
      const next = await admin.updateBillingProfile(input);
      setProfile(next);
      setInput(next);
      setErrors({});
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
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

  return (
    <div className="max-w-5xl">
      <p className="font-mono text-[0.66rem] uppercase tracking-[0.16em] text-[var(--fg-faint)]">
        Setup
      </p>
      <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight">Invoicing</h1>
      <p className="mt-2 max-w-[60ch] text-sm text-[var(--fg-dim)]">
        The details printed at the top of every quote and invoice. Only the
        name is required — leave the rest empty until there is something to
        put in it, and it simply will not be printed.
      </p>

      <div className="mt-8 flex flex-col gap-8 pb-28">
        <section className="border border-[var(--hairline)] bg-[var(--panel)]">
          <Heading title="Who is billing" hint="Name and how to reach you" />
          <div className="grid gap-5 p-5 sm:grid-cols-2">
            <Field label="Name" hint="As the client knows you" error={err("name")}>
              <input
                className="admin-input"
                maxLength={120}
                value={text("name")}
                aria-invalid={!!err("name")}
                onChange={(e) => set("name", e.target.value)}
              />
            </Field>
            <Field
              label="Legal name"
              hint="The registered entity, once there is one"
              error={err("legal_name")}
            >
              <input
                className="admin-input"
                maxLength={160}
                value={text("legal_name")}
                onChange={(e) => set("legal_name", e.target.value)}
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
            <Field label="Address" error={err("address")}>
              <input
                className="admin-input"
                maxLength={190}
                value={text("address")}
                onChange={(e) => set("address", e.target.value)}
              />
            </Field>
            <div className="grid grid-cols-2 gap-5">
              <Field label="City" error={err("city")}>
                <input
                  className="admin-input"
                  maxLength={80}
                  value={text("city")}
                  onChange={(e) => set("city", e.target.value)}
                />
              </Field>
              <Field label="Country" error={err("country")}>
                <input
                  className="admin-input"
                  maxLength={80}
                  value={text("country")}
                  onChange={(e) => set("country", e.target.value)}
                />
              </Field>
            </div>
          </div>
        </section>

        <section className="border border-[var(--hairline)] bg-[var(--panel)]">
          <Heading
            title="Company numbers"
            hint="Leave empty until they exist — nothing is printed for a blank one"
          />
          <div className="grid gap-5 p-5 sm:grid-cols-4">
            <Field label="ICE" error={err("ice")}>
              <input
                className="admin-input font-mono text-sm tabular-nums"
                maxLength={20}
                value={text("ice")}
                onChange={(e) => set("ice", e.target.value)}
              />
            </Field>
            <Field label="IF" error={err("if")}>
              <input
                className="admin-input font-mono text-sm tabular-nums"
                maxLength={20}
                value={text("if")}
                onChange={(e) => set("if", e.target.value)}
              />
            </Field>
            <Field label="RC" error={err("rc")}>
              <input
                className="admin-input font-mono text-sm"
                maxLength={30}
                value={text("rc")}
                onChange={(e) => set("rc", e.target.value)}
              />
            </Field>
            <Field label="Patente" error={err("patente")}>
              <input
                className="admin-input font-mono text-sm"
                maxLength={30}
                value={text("patente")}
                onChange={(e) => set("patente", e.target.value)}
              />
            </Field>
          </div>
        </section>

        <section className="border border-[var(--hairline)] bg-[var(--panel)]">
          <Heading title="How they pay" hint="Bank details, VAT and the standard terms" />
          <div className="grid gap-5 p-5 sm:grid-cols-2">
            <Field label="Bank" error={err("bank_name")}>
              <input
                className="admin-input"
                maxLength={80}
                value={text("bank_name")}
                onChange={(e) => set("bank_name", e.target.value)}
              />
            </Field>
            <Field label="RIB" hint="Printed on the invoice, so they can transfer" error={err("rib")}>
              <input
                className="admin-input font-mono text-sm tabular-nums"
                maxLength={34}
                value={text("rib")}
                onChange={(e) => set("rib", e.target.value)}
              />
            </Field>
            <Field
              label="VAT %"
              hint="Zero while you are not registered. Every new document starts from this."
              error={err("tva_rate")}
            >
              <input
                inputMode="decimal"
                className="admin-input tabular-nums"
                value={text("tva_rate")}
                aria-invalid={!!err("tva_rate")}
                onChange={(e) => set("tva_rate", e.target.value.trim())}
              />
            </Field>
            <div className="sm:col-span-2">
              <Field
                label="Payment terms"
                hint="Copied onto every new document — 50% to start, 50% on delivery, and the like"
                error={err("payment_terms")}
              >
                <textarea
                  rows={3}
                  maxLength={2000}
                  className="admin-input resize-y leading-relaxed"
                  value={text("payment_terms")}
                  onChange={(e) => set("payment_terms", e.target.value)}
                />
              </Field>
            </div>
            <div className="sm:col-span-2">
              <Field
                label="Footer line"
                hint="One quiet line at the very bottom of the page"
                error={err("footer_note")}
              >
                <input
                  className="admin-input"
                  maxLength={500}
                  value={text("footer_note")}
                  onChange={(e) => set("footer_note", e.target.value)}
                />
              </Field>
            </div>
          </div>
        </section>
      </div>

      <SaveBar
        dirty={dirty}
        saving={saving}
        saved={saved}
        message={message}
        savedMessage="Saved. New documents will use these details."
        onSave={save}
        onDiscard={() => {
          setInput(profile);
          setErrors({});
          setMessage(null);
        }}
      />
    </div>
  );
}
