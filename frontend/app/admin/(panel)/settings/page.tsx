"use client";

import { useEffect, useState } from "react";

import { Field, Heading, SaveBar, useUnsavedWarning } from "@/components/admin/fields";
import { PageSkeleton, PanelsSkeleton } from "@/components/admin/skeleton";
import { admin, ApiError, isSignedOut, type SiteSettings, type Translated } from "@/lib/admin/client";

export default function SettingsPage() {
  const [initial, setInitial] = useState<SiteSettings | null>(null);
  const [input, setInput] = useState<SiteSettings | null>(null);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    // A response that lands after this effect was torn down is ignored: with a
    // slow database the second of React's development double-loads arrived
    // after typing had started, and silently replaced the edit.
    let live = true;
    admin.settings().then(
      (s) => {
        if (!live) return;
        setInitial(s);
        setInput(s);
      },
      (e) => live && !isSignedOut(e) && setMessage(e.message),
    );
    return () => {
      live = false;
    };
  }, []);

  const dirty = !!input && JSON.stringify(input) !== JSON.stringify(initial);
  useUnsavedWarning(dirty);

  if (!input) {
    return message ? (
      <p role="alert" className="text-sm text-[var(--color-signal)]">{message}</p>
    ) : (
      <PageSkeleton>
        <PanelsSkeleton panels={2} />
      </PageSkeleton>
    );
  }

  const err = (key: string) => errors[key]?.[0];
  const setText = (key: "hero_headline" | "hero_body", locale: keyof Translated, value: string) =>
    setInput((i) => (i ? { ...i, [key]: { ...i[key], [locale]: value } } : i));
  const set = (key: "contact_email" | "contact_phone" | "contact_location", value: string) =>
    setInput((i) => (i ? { ...i, [key]: value } : i));

  async function save() {
    if (!input) return;
    setSaving(true);
    setMessage(null);
    try {
      const next = await admin.updateSettings(input);
      setInitial(next);
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

  // The hero splits its headline at the first comma: the part after it is
  // drawn on its own line. Previewed here so that is not a surprise.
  const preview = (headline: string) => {
    const [first, ...rest] = headline.split(",");
    return rest.length ? [first.trim() + ",", rest.join(",").trim()] : [headline];
  };

  return (
    <div className="max-w-5xl pb-28">
      <p className="font-mono text-[0.66rem] uppercase tracking-[0.16em] text-[var(--fg-faint)]">Site</p>
      <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight">Settings</h1>
      <p className="mt-2 max-w-[60ch] text-sm text-[var(--fg-dim)]">
        The words that open the homepage, and the contact details shown in the
        footer of every page and on the contact page.
      </p>

      <div className="mt-10 flex flex-col gap-8">
        <section className="border border-[var(--hairline)] bg-[var(--panel)]">
          <Heading title="Homepage hero" hint="The first thing anyone reads" />
          <div className="grid md:grid-cols-2">
            {(["en", "fr"] as const).map((locale) => (
              <div key={locale} className="flex flex-col gap-5 p-5 md:border-l md:border-[var(--hairline)] md:first:border-l-0">
                <p className="font-mono text-[0.6rem] uppercase tracking-[0.14em] text-[var(--link)]">
                  {locale === "en" ? "English" : "Français"}
                </p>
                <Field label="Headline" hint="A comma splits it over two lines" error={err(`hero_headline.${locale}`)}>
                  <input
                    lang={locale}
                    className="admin-input"
                    maxLength={80}
                    value={input.hero_headline[locale]}
                    aria-invalid={!!err(`hero_headline.${locale}`)}
                    onChange={(e) => setText("hero_headline", locale, e.target.value)}
                  />
                </Field>
                <div aria-hidden="true" className="border border-dashed border-[var(--hairline)] bg-[var(--ground)] px-4 py-3">
                  {preview(input.hero_headline[locale]).map((line, i) => (
                    <p key={i} className={`font-display text-xl font-semibold leading-tight tracking-tight ${i ? "text-[var(--fg-dim)]" : ""}`}>
                      {line || "—"}
                    </p>
                  ))}
                </div>
                <Field label="Text under it" error={err(`hero_body.${locale}`)}>
                  <textarea
                    lang={locale}
                    rows={4}
                    maxLength={400}
                    className="admin-input resize-y leading-relaxed"
                    value={input.hero_body[locale]}
                    aria-invalid={!!err(`hero_body.${locale}`)}
                    onChange={(e) => setText("hero_body", locale, e.target.value)}
                  />
                </Field>
              </div>
            ))}
          </div>
        </section>

        <section className="border border-[var(--hairline)] bg-[var(--panel)]">
          <Heading title="Contact details" hint="Footer and contact page · leave phone or location empty to hide it" />
          <div className="grid gap-5 p-5 sm:grid-cols-3">
            <Field label="Email" error={err("contact_email")}>
              <input
                type="email"
                className="admin-input"
                value={input.contact_email}
                aria-invalid={!!err("contact_email")}
                onChange={(e) => set("contact_email", e.target.value.trim())}
              />
            </Field>
            <Field label="Phone" hint="As people should dial it, e.g. +212 6…" error={err("contact_phone")}>
              <input
                type="tel"
                className="admin-input tabular-nums"
                value={input.contact_phone}
                aria-invalid={!!err("contact_phone")}
                onChange={(e) => set("contact_phone", e.target.value)}
              />
            </Field>
            <Field label="Location" error={err("contact_location")}>
              <input
                className="admin-input"
                maxLength={80}
                value={input.contact_location}
                aria-invalid={!!err("contact_location")}
                onChange={(e) => set("contact_location", e.target.value)}
              />
            </Field>
          </div>
        </section>
      </div>

      <SaveBar
        dirty={dirty}
        saving={saving}
        saved={saved}
        message={message}
        onSave={save}
        onDiscard={() => {
          setInput(initial);
          setErrors({});
          setMessage(null);
        }}
      />
    </div>
  );
}
