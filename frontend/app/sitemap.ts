import type { MetadataRoute } from "next";

import { routing } from "@/i18n/routing";
import { api } from "@/lib/api/client";

const BASE = "https://jalimx.com";

/**
 * Every route in every locale, with the alternates declared.
 *
 * `alternates.languages` is what tells a search engine that /work and /fr/work
 * are the same page in two languages rather than two pages competing for the
 * same terms — the mistake that quietly halves a bilingual site's ranking.
 *
 * Built from the API rather than a hand-kept list so a project published from
 * the dashboard appears here without anyone remembering to add it.
 */

/** English sits at the root; French is prefixed. Mirrors `localePrefix`. */
function url(locale: string, path: string): string {
  const prefix = locale === routing.defaultLocale ? "" : `/${locale}`;
  return `${BASE}${prefix}${path === "/" ? "" : path}` || BASE;
}

function entry(
  path: string,
  options: Partial<MetadataRoute.Sitemap[number]> = {}
): MetadataRoute.Sitemap[number] {
  return {
    url: url(routing.defaultLocale, path),
    alternates: {
      languages: Object.fromEntries(
        routing.locales.map((locale) => [locale, url(locale, path)])
      ),
    },
    ...options,
  };
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const fixed = [
    entry("/", { changeFrequency: "monthly", priority: 1 }),
    entry("/work", { changeFrequency: "monthly", priority: 0.9 }),
    entry("/approach", { changeFrequency: "yearly", priority: 0.8 }),
    entry("/about", { changeFrequency: "yearly", priority: 0.6 }),
    entry("/contact", { changeFrequency: "yearly", priority: 0.7 }),
  ];

  try {
    const projects = await api.projects.list();

    return [
      ...fixed,
      ...projects.map((project) =>
        entry(`/work/${project.slug}`, {
          lastModified: project.published_at
            ? new Date(project.published_at)
            : undefined,
          changeFrequency: "yearly",
          priority: 0.7,
        })
      ),
    ];
  } catch {
    // A sitemap missing the case studies still beats a build failure.
    return fixed;
  }
}
