import { defineRouting } from "next-intl/routing";

/**
 * English lives at the root, French under /fr.
 *
 * `as-needed` keeps the default locale unprefixed — /work rather than /en/work
 * — so the URLs people already have keep working and the English site does not
 * carry a redirect on every entry.
 *
 * A page's language is its address, and nothing else. Detection from the
 * browser's language or a remembered cookie is off: with it on, the same
 * address answered with a redirect for some visitors and a page for others, and
 * the language switcher had to point at /en/… to override the cookie — an
 * address that only ever redirects, which search engines found and listed as
 * duplicates of the real pages. Visitors choose a language with the switcher.
 */
export const routing = defineRouting({
  locales: ["en", "fr"],
  defaultLocale: "en",
  localePrefix: "as-needed",
  localeDetection: false,
  localeCookie: false,
});

export type AppLocale = (typeof routing.locales)[number];
