import { getTranslations } from "next-intl/server";

import { JxMark } from "@/components/brand/logo";
import { Link } from "@/i18n/navigation";

/**
 * The closing block: call to action and footer share one dark surface.
 *
 * Dark for two reasons. It gives a long light page somewhere to land, and it is
 * the first glimpse of the world /approach lives in — so the jump between
 * the two densities reads as one site going deeper rather than two designs.
 */

type Props = {
  /** From `settings`. Empty strings render as nothing rather than as a gap. */
  email?: string;
  phone?: string;
  location?: string;
  /** Off on the contact page itself, where it would point at the current page. */
  showCta?: boolean;
};

export async function ClosingBlock({
  email,
  phone,
  location,
  showCta = true,
}: Props) {
  const t = await getTranslations("closing");
  const f = await getTranslations("footer");
  const nav = await getTranslations("nav");

  const year = new Date().getFullYear();

  const links = [
    { href: "/work", label: nav("work") },
    { href: "/approach", label: nav("approach") },
    { href: "/about", label: nav("about") },
    { href: "/contact", label: nav("contact") },
  ];

  return (
    <div className="surface-dark">
      {showCta && (
        <section
          id="contact"
          className="mx-auto max-w-6xl px-6 py-24 sm:px-10 md:py-32"
        >
          <div className="flex flex-col gap-10 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 className="font-display text-[clamp(2rem,5vw,3.5rem)] font-semibold leading-[1.02] tracking-[-0.02em] text-balance">
                {t("heading")}
              </h2>
              <p className="mt-6 max-w-[44ch] text-[var(--fg-dim)]">
                {t("body")}
              </p>
            </div>

            <div className="flex flex-col gap-4">
              <Link href="/contact" className="cta w-fit">
                {nav("cta")}
              </Link>
              {email && (
                <a
                  href={`mailto:${email}`}
                  className="font-mono text-sm text-[var(--fg-dim)] underline-offset-4 hover:text-[var(--fg)] hover:underline"
                >
                  {email}
                </a>
              )}
            </div>
          </div>
        </section>
      )}

      <footer className="border-t border-[var(--hairline)]">
        <div className="mx-auto max-w-6xl px-6 py-14 sm:px-10">
          <div className="flex flex-col gap-12 md:flex-row md:justify-between">
            <div className="flex flex-col gap-4">
              <span className="flex items-center gap-2.5">
                <JxMark className="h-6 w-auto" />
                <span className="font-display text-[0.95rem] font-semibold uppercase tracking-[0.075em]">
                  JalimX
                </span>
              </span>
              <p className="font-mono text-[0.72rem] uppercase tracking-[0.14em] text-[var(--fg-faint)]">
                {f("tagline")}
              </p>
            </div>

            <nav className="flex flex-col gap-3">
              {links.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="text-sm text-[var(--fg-dim)] transition-colors hover:text-[var(--fg)]"
                >
                  {item.label}
                </Link>
              ))}
            </nav>

            {/*
              The only place on the site that states where we are. Kept out of
              every piece of positioning copy, kept here because a studio with
              no address at all reads as harder to trust, not easier — and the
              invoices carry it regardless.
            */}
            <address className="flex flex-col gap-3 not-italic">
              {email && (
                <a
                  href={`mailto:${email}`}
                  className="text-sm text-[var(--fg-dim)] hover:text-[var(--fg)]"
                >
                  {email}
                </a>
              )}
              {phone && (
                <a
                  href={`tel:${phone.replace(/\s/g, "")}`}
                  className="text-sm text-[var(--fg-dim)] hover:text-[var(--fg)]"
                >
                  {phone}
                </a>
              )}
              {location && (
                <span className="text-sm text-[var(--fg-faint)]">{location}</span>
              )}
            </address>
          </div>

          <div className="mt-14 flex flex-col gap-3 border-t border-[var(--hairline)] pt-6 sm:flex-row sm:items-center sm:justify-between">
            <p className="font-mono text-[0.68rem] text-[var(--fg-faint)]">
              {f("copyright", { year })}
            </p>
            <Link
              href="/privacy"
              className="font-mono text-[0.68rem] text-[var(--fg-faint)] hover:text-[var(--fg-dim)]"
            >
              {f("privacy")}
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
