"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-9">
      <div className="grid gap-px border border-[var(--hairline)] bg-[var(--hairline)] sm:grid-cols-2">
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

        <Field label={t("phone")} name="phone" errors={errors.phone} required>
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
          {/* Radix renders a hidden native select for `name`, so this still
              submits with the rest of the FormData and needs no state here. */}
          <Select name="service_interest" disabled={busy}>
            <SelectTrigger id="service_interest" aria-label={t("service")}>
              <SelectValue placeholder={t("choose")} />
            </SelectTrigger>
            <SelectContent>
              {services.map((service) => (
                <SelectItem key={service.slug} value={service.slug}>
                  {pickLocale(service.title, locale)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field
          label={t("budget")}
          name="budget_range"
          errors={errors.budget_range}
          optional={optional}
        >
          <Select name="budget_range" disabled={busy}>
            <SelectTrigger id="budget_range" aria-label={t("budget")}>
              <SelectValue placeholder={t("choose")} />
            </SelectTrigger>
            <SelectContent>
              {BUDGET_KEYS.map((key) => (
                <SelectItem key={key} value={t(`budgets.${key}`)}>
                  {t(`budgets.${key}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field
          label={t("message")}
          name="message"
          errors={errors.message}
          required
          span
        >
          <textarea
            id="message"
            name="message"
            rows={6}
            className="field resize-y"
            placeholder={t("messagePlaceholder")}
            disabled={busy}
          />
        </Field>
      </div>

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
  span,
  children,
}: {
  label: string;
  name: string;
  errors?: string[];
  required?: boolean;
  optional?: string;
  /** Full width across the sheet, for the one field that needs the room. */
  span?: boolean;
  children: React.ReactNode;
}) {
  const error = errors?.[0];

  return (
    /*
     * A cell, not a box. Its edges are the grid's background showing through a
     * 1px gap, so neighbouring fields share a rule instead of each drawing its
     * own and doubling it — the same construction as the title block on
     * /approach, which is where this form's language comes from.
     *
     * `focus-within` rather than `peer`: the thing being styled is the cell
     * around the control, not a sibling of it.
     */
    <div
      className={`group flex flex-col gap-2 bg-[var(--panel)] px-4 py-3.5 transition-colors duration-200 focus-within:bg-[color-mix(in_oklab,var(--link)_5%,var(--panel))] ${
        span ? "sm:col-span-2" : ""
      }`}
    >
      <label
        htmlFor={name}
        className="font-mono text-[0.62rem] uppercase tracking-[0.14em] text-[var(--fg-faint)] transition-colors group-focus-within:text-[var(--link)]"
      >
        {label}
        {required && <span aria-hidden="true"> *</span>}
        {optional && (
          <span className="normal-case tracking-normal"> — {optional}</span>
        )}
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
