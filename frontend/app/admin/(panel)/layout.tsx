"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useState } from "react";

import { JxMark } from "@/components/brand/logo";
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

const NAV = [{ href: "/admin/projects", label: "Projects" }];

export default function PanelLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [failed, setFailed] = useState<string | null>(null);

  useEffect(() => {
    admin.me().then(setUser, (e) => {
      if (e instanceof ApiError && e.status === 401) router.replace("/admin/login");
      else setFailed("The API is not responding. Is Laravel running?");
    });
  }, [router]);

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

  // Nothing until the session is confirmed: a flash of the panel before the
  // redirect reads as a door that was briefly open.
  if (!user) return null;

  return (
    <UserContext.Provider value={user}>
      <div className="flex min-h-screen">
        <aside className="sticky top-0 flex h-screen w-60 shrink-0 flex-col border-r border-[var(--hairline)] bg-[var(--panel)]">
          <div className="flex items-center gap-2.5 border-b border-[var(--hairline)] px-5 py-5">
            <JxMark className="h-5 w-auto" />
            <span className="font-display text-sm font-semibold uppercase tracking-[0.075em]">
              JalimX
            </span>
          </div>

          <nav className="flex flex-col gap-px p-3">
            {NAV.map((item) => {
              const active = pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`px-3 py-2 text-sm transition-colors ${
                    active
                      ? "bg-[color-mix(in_oklab,var(--link)_9%,transparent)] text-[var(--fg)]"
                      : "text-[var(--fg-dim)] hover:text-[var(--fg)]"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="mt-auto border-t border-[var(--hairline)] px-5 py-4">
            <p className="truncate font-mono text-[0.66rem] text-[var(--fg-faint)]">
              {user.email}
            </p>
            <div className="mt-3 flex items-center justify-between">
              <a
                href="/"
                target="_blank"
                rel="noreferrer"
                className="text-xs text-[var(--link)] underline-offset-4 hover:underline"
              >
                View site ↗
              </a>
              <button
                type="button"
                onClick={signOut}
                className="text-xs text-[var(--fg-dim)] hover:text-[var(--fg)]"
              >
                Sign out
              </button>
            </div>
          </div>
        </aside>

        <main className="min-w-0 flex-1 px-8 py-10 lg:px-12">{children}</main>
      </div>
    </UserContext.Provider>
  );
}
