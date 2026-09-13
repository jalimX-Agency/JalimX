import { getTranslations } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import type { Locale, Testimonial } from "@/lib/api/client";
import { t as pickLocale } from "@/lib/api/client";

/**
 * Client quotes, immediately before the call to action.
 *
 * Renders nothing at all when there are none. An empty "what clients say"
 * heading is worse than no section: it advertises that nobody has said
 * anything. See docs/collecting-testimonials.md for how these get gathered —
 * every one of them is approved in writing by the person named.
 */

type Props = {
  testimonials: Testimonial[];
  locale: Locale;
};

export async function TestimonialsSection({ testimonials, locale }: Props) {
  const t = await getTranslations("testimonials");

  if (testimonials.length === 0) return null;

  const [lead, ...rest] = testimonials;

  return (
    <section
      id="clients"
      className="mx-auto max-w-6xl px-6 pb-28 sm:px-10 md:pb-36"
    >
      <div className="border-t border-[var(--hairline)] pt-8">
        <h2 className="font-display text-sm font-semibold uppercase tracking-[0.14em]">
          {t("heading")}
        </h2>
      </div>

      <figure className="mt-14 max-w-[64ch]">
        <blockquote className="font-display text-[clamp(1.5rem,3.2vw,2.25rem)] font-medium leading-[1.25] tracking-[-0.01em] text-balance">
          “{pickLocale(lead.quote, locale)}”
        </blockquote>
        <figcaption className="mt-7 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[0.7rem] uppercase tracking-[0.14em] text-[var(--fg-faint)]">
          <span className="text-[var(--fg-dim)]">{lead.author_name}</span>
          {lead.author_role && <span>· {lead.author_role}</span>}
          {lead.client_name && <span>· {lead.client_name}</span>}
          {lead.project_slug && (
            <Link
              href={`/work/${lead.project_slug}`}
              className="text-[var(--link)] underline-offset-4 hover:underline"
            >
              {t("readCase")} →
            </Link>
          )}
        </figcaption>
      </figure>

      {rest.length > 0 && (
        <div className="mt-20 grid gap-14 md:grid-cols-2 md:gap-16">
          {rest.map((quote) => (
            <figure key={quote.id}>
              <blockquote className="text-lg leading-relaxed text-[var(--fg-dim)]">
                “{pickLocale(quote.quote, locale)}”
              </blockquote>
              <figcaption className="mt-5 font-mono text-[0.66rem] uppercase tracking-[0.14em] text-[var(--fg-faint)]">
                <span className="text-[var(--fg-dim)]">{quote.author_name}</span>
                {quote.author_role && ` · ${quote.author_role}`}
                {quote.client_name && ` · ${quote.client_name}`}
              </figcaption>
            </figure>
          ))}
        </div>
      )}
    </section>
  );
}
