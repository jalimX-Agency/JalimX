import { defineRouting } from "next-intl/routing";

/**
 * English lives at the root, French under /fr.
 *
 * `as-needed` keeps the default locale unprefixed — /work rather than /en/work
 * — so the URLs people already have keep working and the English site does not
 * carry a redirect on every entry.
 */
export const routing = defineRouting({
  locales: ["en", "fr"],
  defaultLocale: "en",
  localePrefix: "as-needed",
});

export type AppLocale = (typeof routing.locales)[number];
