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

/**
 * A logo is a file named after the case study's slug in public/clients. The
 * list follows the dashboard — unpublish a project and it leaves the strip —
 * instead of a second list kept by hand in the code.
 */
function withLogo(projects: Project[]) {
  const dir = path.join(process.cwd(), "public", "clients");

  return projects.filter((p) => existsSync(path.join(dir, `${p.slug}.webp`)));
}

export async function ClientStrip({ projects }: Props) {
  const t = await getTranslations("clients");
  const clients = withLogo(projects);

  // A row of nothing is worse than no row.
  if (clients.length === 0) return null;

  return (
    <div className="border-t border-[var(--hairline)] pt-8">
      <p className="font-mono text-[0.62rem] uppercase tracking-[0.18em] text-[var(--fg-faint)]">
        {t("label")}
      </p>

      <ul className="mt-6 flex flex-wrap items-center gap-x-10 gap-y-6 sm:gap-x-14">
        {clients.map((client) => (
          <li key={client.slug}>
            <Image
              src={`/clients/${client.slug}.webp`}
              alt={client.client_name}
              width={320}
              height={128}
              className="h-9 w-auto opacity-60 grayscale transition duration-300 hover:opacity-100 hover:grayscale-0 sm:h-10"
            />
          </li>
        ))}
      </ul>
    </div>
  );
}
