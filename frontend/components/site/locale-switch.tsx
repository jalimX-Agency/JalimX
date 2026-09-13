"use client";

import { useLocale } from "next-intl";

import { Link, usePathname } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";

const LABELS: Record<string, string> = { en: "EN", fr: "FR" };

/**
 * Switches locale while staying on the current page.
 *
 * `usePathname` from our navigation helpers returns the path without the locale
 * prefix, so /fr/work comes back as /work and the link can be rebuilt for the
 * other locale — rather than dumping the visitor back on the homepage, which is
 * what a plain `<a href="/fr">` would do.
 */
export function LocaleSwitch() {
  const active = useLocale();
  const pathname = usePathname();

  return (
    <div className="flex items-center gap-1 font-mono text-[0.68rem] tracking-[0.08em]">
      {routing.locales.map((locale, i) => (
        <span key={locale} className="flex items-center gap-1">
          {i > 0 && <span className="text-[var(--fg-faint)]">/</span>}
          {locale === active ? (
            <span aria-current="true" className="text-[var(--fg)]">
              {LABELS[locale]}
            </span>
          ) : (
            <Link
              href={pathname}
              locale={locale}
              className="text-[var(--fg-faint)] transition-colors hover:text-[var(--fg)]"
            >
              {LABELS[locale]}
            </Link>
          )}
        </span>
      ))}
    </div>
  );
}
