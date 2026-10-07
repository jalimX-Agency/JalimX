import type { Metadata } from "next";

import { routing } from "@/i18n/routing";

/**
 * The one address this site answers to.
 *
 * The host serves www.jalimx.com and redirects the bare domain to it, so every
 * address the site announces about itself — canonical, hreflang, sitemap,
 * robots — has to be the www one. Announcing jalimx.com while the server sends
 * visitors to www told Google two things at once: each page claimed to live at
 * an address that redirected away from it, and the same page was indexed under
 * both hosts with its signals split between them.
 *
 * If the redirect ever points the other way, this is the only line to change.
 */
export const SITE_URL = "https://www.jalimx.com";

export const SITE_NAME = "JalimX";

/**
 * A path as it is served in a locale: English at the root, French under /fr.
 * "/" is "/" in English and "/fr" in French, never "/fr/".
 */
export function localePath(locale: string, path: string): string {
  const clean = path === "/" ? "" : path;

  return locale === routing.defaultLocale ? clean || "/" : `/${locale}${clean}`;
}

/** The full address of a page, for places that need one (JSON-LD, sitemap). */
export function absoluteUrl(locale: string, path: string): string {
  const local = localePath(locale, path);

  return local === "/" ? SITE_URL : `${SITE_URL}${local}`;
}

/**
 * Canonical and language alternates for a page.
 *
 * Every page declares itself: a page with no canonical leaves Google to pick
 * one, and it picks by guessing between the www and bare address, the trailing
 * slash and the `/en` variant. `x-default` is English, the version a visitor
 * gets when nothing says otherwise.
 */
export function pageAlternates(
  locale: string,
  path: string
): NonNullable<Metadata["alternates"]> {
  return {
    canonical: localePath(locale, path),
    languages: {
      en: localePath("en", path),
      fr: localePath("fr", path),
      "x-default": localePath("en", path),
    },
  };
}

/**
 * The default card for a shared link, one per language (see lib/og-card).
 * Written out in full: it has to be a real, absolute address that the page
 * names itself, not one the framework works out from whichever host it ran on.
 */
export function ogImage(locale: string) {
  const code = locale === "fr" ? "fr" : "en";

  return {
    url: `${SITE_URL}/og-${code}.png`,
    width: 1200,
    height: 630,
    alt: SITE_NAME,
  };
}

/** What a shared link says, with the site name and the page's own address. */
export function pageOpenGraph(
  locale: string,
  path: string,
  title: string,
  description: string
): NonNullable<Metadata["openGraph"]> {
  return {
    type: "website",
    siteName: SITE_NAME,
    locale: locale === "fr" ? "fr_FR" : "en_GB",
    url: localePath(locale, path),
    title,
    description,
    images: [ogImage(locale)],
  };
}
