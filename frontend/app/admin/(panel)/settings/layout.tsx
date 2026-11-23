"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { useAdminUser } from "@/app/admin/(panel)/layout";
import { allowedSettings } from "@/lib/admin/settings-sections";

/**
 * Everything that is set once and then left alone.
 *
 * It all lives behind one nav item on purpose. The site's words, the list
 * of services, the case studies, the work types, the invoice header — none
 * of them is opened in a normal working day, and giving each its own place
 * in the main nav made the daily work share a list with things that change
 * twice a year.
 */



export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const user = useAdminUser();
  const SECTIONS = allowedSettings(user?.permissions);

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
