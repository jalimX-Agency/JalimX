import { getTranslations } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import type { Locale, Service } from "@/lib/api/client";
import { t as pickLocale } from "@/lib/api/client";

/**
 * What we do — the section that has to land before any portfolio does.
 *
 * A row of four equal cards is the shape every agency template already has, so
 * this is an editorial list instead: a sticky label on the left, the services
 * stacked on the right, web development carrying the extra weight because it is
 * the flagship and the only one with a page of its own.
 */

type Props = {
  services: Service[];
  locale: Locale;
};

/** Only the flagship has somewhere deeper to go, for now. */
const DEEP_LINKS: Record<string, string> = {
  "web-development": "/approach",
};

export async function ServicesSection({ services, locale }: Props) {
  const t = await getTranslations("services");

  if (services.length === 0) return null;

  return (
    <section
      id="services"
      className="mx-auto max-w-6xl px-6 pb-28 sm:px-10 md:pb-36"
    >
      <div className="grid gap-12 border-t border-[var(--hairline)] pt-8 md:grid-cols-[16rem_1fr] md:gap-16">
        <div className="md:sticky md:top-10 md:self-start">
          <h2 className="font-display text-sm font-semibold uppercase tracking-[0.14em]">
            {t("heading")}
          </h2>
          <p className="mt-4 max-w-[28ch] text-sm leading-relaxed text-[var(--fg-dim)]">
            {t("intro")}
          </p>
        </div>

        <ul className="flex flex-col">
          {services.map((service, i) => {
            const href = DEEP_LINKS[service.slug];
            const lead = i === 0;

            return (
              <li
                key={service.slug}
                className="border-b border-[var(--hairline)] py-8 first:pt-0 last:border-b-0"
              >
                <div className="flex flex-wrap items-baseline gap-x-4 gap-y-2">
                  <h3
                    className={
                      lead
                        ? "font-display text-2xl font-semibold tracking-tight sm:text-3xl"
                        : "font-display text-xl font-semibold tracking-tight"
                    }
                  >
                    {pickLocale(service.title, locale)}
                  </h3>

                  {href && (
                    <Link
                      href={href}
                      className="ml-auto inline-flex items-center gap-1.5 font-mono text-[0.68rem] uppercase tracking-[0.12em] text-[var(--link)] underline-offset-4 hover:underline"
                    >
                      {t("deepLink")}
                      <span aria-hidden="true">→</span>
                    </Link>
                  )}
                </div>

                <p
                  className={`mt-3 max-w-[54ch] ${lead ? "text-lg" : ""} text-[var(--fg-dim)]`}
                >
                  {pickLocale(service.tagline, locale)}
                </p>

                {lead && (
                  <p className="mt-4 max-w-[58ch] text-sm leading-relaxed text-[var(--fg-dim)]">
                    {pickLocale(service.body, locale)}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
