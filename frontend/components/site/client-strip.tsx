import Image from "next/image";
import { getTranslations } from "next-intl/server";

/**
 * The clients, as a quiet row.
 *
 * Greyscale by default so four unrelated brand palettes read as one texture
 * rather than four competing logos; colour returns on hover. It is the first
 * thing a business owner scans for — "who else trusted them" — so it sits
 * inside the hero rather than further down the page.
 */

const CLIENTS = [
  { slug: "globale-explore-tours", name: "Globale Explore Tours" },
  { slug: "arabian-desert-home", name: "Arabian Desert Home" },
  { slug: "families-tours", name: "Families Tours" },
  { slug: "villa-serena", name: "Villa Serena" },
];

export async function ClientStrip() {
  const t = await getTranslations("clients");

  return (
    <div className="border-t border-[var(--hairline)] pt-8">
      <p className="font-mono text-[0.62rem] uppercase tracking-[0.18em] text-[var(--fg-faint)]">
        {t("label")}
      </p>

      <ul className="mt-6 flex flex-wrap items-center gap-x-10 gap-y-6 sm:gap-x-14">
        {CLIENTS.map((client) => (
          <li key={client.slug}>
            <Image
              src={`/clients/${client.slug}.webp`}
              alt={client.name}
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
