"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useState } from "react";

import { JxMark } from "@/components/brand/logo";
import { Block } from "@/components/admin/skeleton";
import { admin, ApiError, type User } from "@/lib/admin/client";

/**
 * The signed-in shell: session check, sidebar, sign out.
 *
 * The check here is for the person, not for security. It keeps someone who is
 * signed out from staring at an empty dashboard; what actually protects the
 * data is Laravel refusing every /admin request without a session. Nothing is
 * rendered from this shell that the API has not already agreed to hand over.
 */

const UserContext = createContext<User | null>(null);
export const useAdminUser = () => useContext(UserContext);

/*
 * Grouped, because the items answer different questions.
 *
 * "Agency" is the work: who is asking, who is a client, what is owed. It is
 * what gets opened every day. "The site" is jalimx.com's own content — one
 * asset the agency happens to own, edited when something changes, not daily.
 * "Setup" is the handful of details the agency itself is made of.
 *
 * Sections fill out as the agency side is built (clients, projects, invoices);
 * an empty nav item that leads nowhere is worse than no item at all.
 */
const NAV: { group: string; items: { href: string; label: string }[] }[] = [
  {
    group: "Agency",
    items: [
      { href: "/admin/leads", label: "Leads" },
      { href: "/admin/clients", label: "Clients" },
    ],
  },
  {
    /*
     * The agency's own details, kept apart from the site's: this is what
     * goes at the top of an invoice, not anything a visitor ever sees.
     */
    group: "Setup",
    items: [{ href: "/admin/settings/billing", label: "Invoicing" }],
  },
  {
    group: "The site",
    items: [
      { href: "/admin/settings/site", label: "Site" },
      { href: "/admin/settings/services", label: "Services" },
      { href: "/admin/settings/case-studies", label: "Case studies" },
    ],
  },
];

export default function PanelLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    admin.me().then(setUser, (e) => {
      if (e instanceof ApiError && e.status === 401) router.replace("/admin/login");
      else setFailed("The API is not responding. Is Laravel running?");
    });
  }, [router]);

  // Counted once, then again whenever the person is somewhere in Leads, so
  // opening one clears its share of the badge. Every call is a round trip to
  // a database in Europe, so the other pages do not pay for it.
  const leadsPath = pathname.startsWith("/admin/leads") ? pathname : "";
  useEffect(() => {
    if (!user) return;
    admin.leads().then((r) => setUnread(r.meta.unread), () => {});
  }, [user, leadsPath]);

  async function signOut() {
    await admin.logout().catch(() => {});
    router.replace("/admin/login");
  }

  if (failed) {
    return (
      <p role="alert" className="p-10 text-sm text-[var(--color-signal)]">
        {failed}
      </p>
    );
  }

  return (
    <UserContext.Provider value={user}>
      <div className="flex min-h-screen flex-col md:flex-row">
        {/* A top bar on a phone — leads get read there — and a sidebar from md up. */}
        <aside className="sticky top-0 z-20 flex shrink-0 items-center border-b border-[var(--hairline)] bg-[var(--panel)] md:h-screen md:w-60 md:flex-col md:items-stretch md:border-b-0 md:border-r">
          <div className="flex items-center gap-2.5 px-4 py-3 md:border-b md:border-[var(--hairline)] md:px-5 md:py-5">
            <JxMark className="h-5 w-auto" />
            <span className="hidden font-display text-sm font-semibold uppercase tracking-[0.075em] sm:inline">
              JalimX
            </span>
          </div>

          {/* Group headings only exist from md up: the phone bar is one
              scrolling row, where a label per group costs more room than the
              grouping is worth. */}
          <nav className="flex min-w-0 gap-px overflow-x-auto py-2 md:flex-col md:gap-0 md:overflow-visible md:p-3">
            {NAV.map((section) => (
              <div key={section.group} className="flex gap-px md:flex-col md:gap-0 md:[&+div]:mt-5">
                <p className="hidden px-3 pb-1.5 font-mono text-[0.58rem] uppercase tracking-[0.14em] text-[var(--fg-faint)] md:block">
                  {section.group}
                </p>
                {section.items.map((item) => {
                  const active = pathname.startsWith(item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`shrink-0 px-3 py-2 text-sm transition-colors ${
                        active
                          ? "bg-[color-mix(in_oklab,var(--link)_9%,transparent)] text-[var(--fg)]"
                          : "text-[var(--fg-dim)] hover:text-[var(--fg)]"
                      }`}
                    >
                      <span className="flex items-center justify-between gap-3">
                        {item.label}
                        {item.href === "/admin/leads" && unread > 0 && (
                          <span className="min-w-5 bg-[var(--color-signal)] px-1.5 text-center font-mono text-[0.6rem] leading-[1.15rem] tabular-nums text-white">
                            {unread}
                          </span>
                        )}
                      </span>
                    </Link>
                  );
                })}
              </div>
            ))}
          </nav>

          <div className="ml-auto px-4 md:mt-auto md:ml-0 md:border-t md:border-[var(--hairline)] md:px-5 md:py-4">
            {user ? (
              <p className="hidden truncate font-mono text-[0.66rem] text-[var(--fg-faint)] md:block">
                {user.email}
              </p>
            ) : (
              <Block className="mb-1 hidden h-2.5 w-28 md:block" />
            )}
            <div className="flex items-center justify-between gap-4 md:mt-3">
              <a
                href="/"
                target="_blank"
                rel="noreferrer"
                className="hidden text-xs text-[var(--link)] underline-offset-4 hover:underline md:inline"
              >
                View site ↗
              </a>
              <button
                type="button"
                onClick={signOut}
                className="whitespace-nowrap text-xs text-[var(--fg-dim)] hover:text-[var(--fg)]"
              >
                Sign out
              </button>
            </div>
          </div>
        </aside>

        <main className="min-w-0 flex-1 px-4 py-8 md:px-8 md:py-10 lg:px-12">{children}</main>
      </div>
    </UserContext.Provider>
  );
}
