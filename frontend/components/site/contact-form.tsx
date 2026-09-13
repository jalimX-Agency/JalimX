"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { ApiError, api, t as pickLocale, type Locale, type Service } from "@/lib/api/client";

/**
 * The contact form.
 *
 * Validation lives in Laravel — this renders whatever the 422 comes back with
 * rather than duplicating the rules here. Two copies of the same rules drift,
 * and the copy that matters is the one the server enforces.
 *
 * Server messages arrive in English regardless of locale; translating them
 * would mean maintaining a message map that silently rots every time a rule
 * changes. Laravel's own translation files are the right place for that, and
 * they can be added without touching this component.
 */

type Props = {
  services: Service[];
  locale: Locale;
};

const BUDGET_KEYS = ["b1", "b2", "b3", "b4", "b5"] as const;

type Status = "idle" | "sending" | "sent";

export function ContactForm({ services, locale }: Props) {
  const t = useTranslations("contact.form");

  const [status, setStatus] = useState<Status>("idle");
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [failure, setFailure] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("sending");
    setErrors({});
    setFailure(null);

    const form = new FormData(event.currentTarget);

    try {
      await api.leads.create({
        name: String(form.get("name") ?? ""),
        email: String(form.get("email") ?? ""),
        phone: String(form.get("phone") ?? "") || null,
        company: String(form.get("company") ?? "") || null,
        budget_range: String(form.get("budget_range") ?? "") || null,
        service_interest: String(form.get("service_interest") ?? "") || null,
        message: String(form.get("message") ?? ""),
        locale,
        source: "contact-page",
      });

      setStatus("sent");
    } catch (error) {
      setStatus("idle");

      if (error instanceof ApiError) {
        if (error.errors) setErrors(error.errors);
        else if (error.status === 429) setFailure(t("throttled"));
        else setFailure(error.message);
        return;
      }

      setFailure(t("networkError"));
    }
  }

  if (status === "sent") {
    return (
      <div
        role="status"
        className="rounded-xl border border-[var(--hairline)] bg-[var(--panel)] p-8"
      >
        <h2 className="font-display text-2xl font-semibold tracking-tight">
          {t("successTitle")}
        </h2>
        <p className="mt-3 max-w-[46ch] text-[var(--fg-dim)]">
          {t("successBody")}
        </p>
      </div>
    );
  }

  const busy = status === "sending";
  const optional = t("optional");

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-6">
      <div className="grid gap-6 sm:grid-cols-2">
        <Field label={t("name")} name="name" errors={errors.name} required>
          <input id="name" name="name" autoComplete="name" className="field" disabled={busy} />
        </Field>

        <Field label={t("email")} name="email" errors={errors.email} required>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            className="field"
            disabled={busy}
          />
        </Field>

        <Field label={t("phone")} name="phone" errors={errors.phone} optional={optional}>
          <input id="phone" name="phone" type="tel" autoComplete="tel" className="field" disabled={busy} />
        </Field>

        <Field label={t("company")} name="company" errors={errors.company} optional={optional}>
          <input
            id="company"
            name="company"
            autoComplete="organization"
            className="field"
            disabled={busy}
          />
        </Field>

        <Field
          label={t("service")}
          name="service_interest"
          errors={errors.service_interest}
          optional={optional}
        >
          <select
            id="service_interest"
            name="service_interest"
            className="field"
            disabled={busy}
            defaultValue=""
          >
            <option value="">{t("choose")}</option>
            {services.map((service) => (
              <option key={service.slug} value={service.slug}>
                {pickLocale(service.title, locale)}
              </option>
            ))}
          </select>
        </Field>

        <Field
          label={t("budget")}
          name="budget_range"
          errors={errors.budget_range}
          optional={optional}
        >
          <select
            id="budget_range"
            name="budget_range"
            className="field"
            disabled={busy}
            defaultValue=""
          >
            <option value="">{t("choose")}</option>
            {BUDGET_KEYS.map((key) => (
              <option key={key} value={t(`budgets.${key}`)}>
                {t(`budgets.${key}`)}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <Field label={t("message")} name="message" errors={errors.message} required>
        <textarea
          id="message"
          name="message"
          rows={6}
          className="field resize-y"
          placeholder={t("messagePlaceholder")}
          disabled={busy}
        />
      </Field>

      {failure && (
        <p role="alert" className="text-sm text-[var(--color-signal)]">
          {failure}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-5">
        <button type="submit" className="cta" disabled={busy}>
          {busy ? t("sending") : t("submit")}
        </button>
        <p className="text-xs text-[var(--fg-faint)]">{t("note")}</p>
      </div>
    </form>
  );
}

function Field({
  label,
  name,
  errors,
  required,
  optional,
  children,
}: {
  label: string;
  name: string;
  errors?: string[];
  required?: boolean;
  optional?: string;
  children: React.ReactNode;
}) {
  const error = errors?.[0];

  return (
    <div className="flex flex-col gap-2">
      <label
        htmlFor={name}
        className="font-mono text-[0.68rem] uppercase tracking-[0.12em] text-[var(--fg-faint)]"
      >
        {label}
        {required && <span aria-hidden="true"> *</span>}
        {optional && <span className="normal-case tracking-normal"> — {optional}</span>}
      </label>

      {children}

      {error && (
        <p className="text-xs text-[var(--color-signal)]" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
