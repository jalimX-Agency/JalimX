import { existsSync } from "node:fs";
import path from "node:path";

import Image from "next/image";
import { getTranslations } from "next-intl/server";

import type { Project } from "@/lib/api/client";

/**
 * The clients, as a quiet row.
 *
 * Greyscale by default so four unrelated brand palettes read as one texture
 * rather than four competing logos; colour returns on hover. It is the first
 * thing a business owner scans for — "who else trusted them" — so it sits
 * inside the hero rather than further down the page.
 */

type Props = {
  /** The published case studies; only those with a logo file are shown. */
  projects: Project[];
};

type Logo = { key: string; name: string; src: string; width: number; height: number };

/**
 * The logo uploaded to the case study in the dashboard, or else a file named
 * after its slug in public/clients — where the first logos were kept. The
 * list follows the dashboard: unpublish a project and it leaves the strip.
 *
 * One logo per client: a client with two case studies (a site, then a
 * retainer) is one business, shown once.
 */
function logos(projects: Project[]): Logo[] {
  const dir = path.join(process.cwd(), "public", "clients");
  const seen = new Set<string>();
  const out: Logo[] = [];

  for (const p of projects) {
    const key = p.client_name.trim().toLowerCase();
    if (seen.has(key)) continue;

    const logo: Logo | null = p.logo
      ? { key, name: p.client_name, src: p.logo.url, width: p.logo.width ?? 320, height: p.logo.height ?? 128 }
      : existsSync(path.join(dir, `${p.slug}.webp`))
        ? { key, name: p.client_name, src: `/clients/${p.slug}.webp`, width: 320, height: 128 }
        : null;

    if (logo) {
      seen.add(key);
      out.push(logo);
    }
  }

  return out;
}

export async function ClientStrip({ projects }: Props) {
  const t = await getTranslations("clients");
  const clients = logos(projects);

  // A row of nothing is worse than no row.
  if (clients.length === 0) return null;

  return (
    <div className="border-t border-[var(--hairline)] pt-8">
      <p className="font-mono text-[0.62rem] uppercase tracking-[0.18em] text-[var(--fg-faint)]">
        {t("label")}
      </p>

      <ul className="mt-6 flex flex-wrap items-center gap-x-10 gap-y-6 sm:gap-x-14">
        {clients.map((client) => (
          <li key={client.key}>
            <Image
              src={client.src}
              alt={client.name}
              width={client.width}
              height={client.height}
              className="h-9 w-auto opacity-60 grayscale transition duration-300 hover:opacity-100 hover:grayscale-0 sm:h-10"
            />
          </li>
        ))}
      </ul>
    </div>
  );
}
