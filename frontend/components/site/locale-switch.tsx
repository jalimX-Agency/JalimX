"use client";

import NextLink from "next/link";
import { useLocale } from "next-intl";

import { usePathname } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { localePath } from "@/lib/seo";

const LABELS: Record<string, string> = { en: "EN", fr: "FR" };

/**
 * Switches locale while staying on the current page.
 *
 * `usePathname` from our navigation helpers returns the path without the locale
 * prefix, so /fr/work comes back as /work and the link can be rebuilt for the
 * other locale — rather than dumping the visitor back on the homepage, which is
 * what a plain `<a href="/fr">` would do.
 *
 * The href is the page's real address in the other language, written out here
 * rather than left to the library's locale-aware Link. That one forces a
 * prefix on the English address (/en/work) so that it can override a remembered
 * language; with detection off there is nothing to override, and the forced
 * address was only a redirect that search engines kept finding.
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
            <NextLink
              href={localePath(locale, pathname)}
              hrefLang={locale}
              lang={locale}
              className="text-[var(--fg-faint)] transition-colors hover:text-[var(--fg)]"
            >
              {LABELS[locale]}
            </NextLink>
          )}
        </span>
      ))}
    </div>
  );
}
