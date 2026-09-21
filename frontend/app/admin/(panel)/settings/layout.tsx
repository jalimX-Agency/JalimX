"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * Everything that is set once and then left alone.
 *
 * It all lives behind one nav item on purpose. The site's words, the list
 * of services, the case studies, the work types, the invoice header — none
 * of them is opened in a normal working day, and giving each its own place
 * in the main nav made the daily work share a list with things that change
 * twice a year.
 */

const SECTIONS: { group: string; items: { href: string; label: string; hint: string }[] }[] = [
  {
    group: "The agency",
    items: [
      { href: "/admin/settings/invoicing", label: "Invoicing", hint: "What goes on an invoice" },
      { href: "/admin/settings/work-types", label: "Work types", hint: "What kinds of work you do" },
    ],
  },
  {
    group: "The site",
    items: [
      { href: "/admin/settings/site", label: "Homepage & contact", hint: "The words that open jalimx.com" },
      { href: "/admin/settings/services", label: "Services", hint: "What the site says you do" },
      { href: "/admin/settings/case-studies", label: "Case studies", hint: "The work shown publicly" },
    ],
  },
];

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="max-w-6xl">
      <p className="font-mono text-[0.66rem] uppercase tracking-[0.16em] text-[var(--fg-faint)]">
        Settings
      </p>

      <div className="mt-6 gap-10 lg:flex">
        {/* A scrolling row on a phone, a column from lg up: the sections are
            few enough that hiding them behind a menu would cost more than
            the width they take. */}
        <nav
          aria-label="Settings sections"
          className="-mx-4 mb-8 shrink-0 overflow-x-auto px-4 lg:mx-0 lg:mb-0 lg:w-56 lg:overflow-visible lg:px-0"
        >
          <ul className="flex gap-2 lg:flex-col lg:gap-0">
            {SECTIONS.map((section) => (
              <li key={section.group} className="contents lg:block lg:not-first:mt-7">
                <p className="hidden font-mono text-[0.6rem] uppercase tracking-[0.16em] text-[var(--fg-faint)] lg:block">
                  {section.group}
                </p>
                <ul className="contents lg:mt-2 lg:block">
                  {section.items.map((item) => {
                    const active = pathname.startsWith(item.href);
                    return (
                      <li key={item.href} className="lg:border-l lg:border-[var(--hairline)]">
                        <Link
                          href={item.href}
                          aria-current={active ? "page" : undefined}
                          className={`block whitespace-nowrap px-3 py-2 text-sm transition-colors lg:-ml-px lg:whitespace-normal lg:border-l ${
                            active
                              ? "border-[var(--fg)] bg-[var(--panel)] text-[var(--fg)] lg:bg-transparent"
                              : "border-transparent text-[var(--fg-dim)] hover:text-[var(--fg)]"
                          }`}
                        >
                          {item.label}
                          <span className="mt-0.5 hidden text-xs text-[var(--fg-faint)] lg:block">
                            {item.hint}
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </li>
            ))}
          </ul>
        </nav>

        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
}
