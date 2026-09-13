import { getTranslations } from "next-intl/server";

import { JxMark } from "@/components/brand/logo";
import { LocaleSwitch } from "@/components/site/locale-switch";
import { MobileNav } from "@/components/site/mobile-nav";
import { Link } from "@/i18n/navigation";

/**
 * Works on either ground. Every colour comes from the semantic tokens the
 * surrounding .surface-light / .surface-dark sets, so there is one Header
 * rather than a light one and a dark one drifting apart.
 */
export async function Header() {
  const t = await getTranslations("nav");

  const nav = [
    { href: "/work", label: t("work") },
    { href: "/approach", label: t("approach") },
    { href: "/about", label: t("about") },
    { href: "/contact", label: t("contact") },
  ];

  return (
    <header className="site-header z-20 border-b border-[var(--hairline)]">
      <div className="mx-auto flex max-w-6xl items-center gap-6 px-6 py-5 sm:px-10">
        <Link href="/" className="flex items-center gap-2.5" aria-label={t("home")}>
          {/* `data-nav-mark` is the landing pad for the homepage hero, which
              flies its own oversized copy of this mark up here on scroll and
              hands over. Renamed or removed, the hero simply skips the
              handoff — it looks the target up and gives up if it is gone. */}
          <JxMark data-nav-mark className="h-6 w-auto" />
          <span className="font-display text-[0.95rem] font-semibold uppercase tracking-[0.075em]">
            JalimX
          </span>
        </Link>

        <nav className="ml-auto hidden items-center gap-7 md:flex">
          {nav
            .filter((item) => item.href !== "/contact")
            .map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="text-sm text-[var(--fg-dim)] transition-colors hover:text-[var(--fg)]"
              >
                {item.label}
              </Link>
            ))}
        </nav>

        <div className="ml-auto hidden md:ml-0 md:flex md:items-center md:gap-6">
          <LocaleSwitch />
          <Link href="/contact" className="cta">
            {t("cta")}
          </Link>
        </div>

        <div className="ml-auto flex items-center gap-4 md:hidden">
          <LocaleSwitch />
          <MobileNav
            items={nav}
            labels={{
              menu: t("menu"),
              open: t("openMenu"),
              close: t("closeMenu"),
              cta: t("cta"),
            }}
          />
        </div>
      </div>
    </header>
  );
}
