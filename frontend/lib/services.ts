/**
 * The four services and what ties each to the case studies.
 *
 * The slugs are the dashboard's. A service's title, tagline and short body
 * come from the API, so an edit in the dashboard shows on its page; the
 * long-form content around them lives in messages under servicePages.pages.
 */

export const SERVICE_SLUGS = [
  "web-development",
  "brand-identity",
  "content-social",
  "seo-growth",
] as const;

export type ServiceSlug = (typeof SERVICE_SLUGS)[number];

export function isServiceSlug(slug: string): slug is ServiceSlug {
  return (SERVICE_SLUGS as readonly string[]).includes(slug);
}

/** The case-study tag that shows a project used this service. */
export const SERVICE_TAG: Record<ServiceSlug, string> = {
  "web-development": "web",
  "brand-identity": "branding",
  "content-social": "content",
  "seo-growth": "seo",
};

export const servicePath = (slug: string) => `/services/${slug}`;
