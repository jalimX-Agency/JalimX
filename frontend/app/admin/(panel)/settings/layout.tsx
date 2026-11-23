"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

import { useAdminUser } from "@/app/admin/(panel)/layout";
import { SettingsIcon } from "@/components/admin/settings-icon";
import { allowedSettings } from "@/lib/admin/settings-sections";

/**
 * Everything that is set once and then left alone, behind one menu item.
 *
 * A sidebar of its own from lg up, with an icon per section so the list can
 * be scanned rather than read; on a phone, one dropdown instead of a row
 * that scrolls sideways and hides most of its items. Only the sections the
 * person's role allows are listed.
 */
export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const user = useAdminUser();
  const groups = allowedSettings(user?.permissions);
  const items = groups.flatMap((g) => g.items);
  const current = items.find((item) => pathname.startsWith(item.href));

  return (
    <div className="mx-auto max-w-6xl">
      <div className="lg:grid lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-10">
        {/* Phone and tablet: one control, the current section showing. */}
        <div className="mb-8 lg:hidden">
          <label htmlFor="settings-section" className="mb-1.5 block text-xs font-medium text-[var(--fg-dim)]">
            Settings
          </label>
          <select
            id="settings-section"
            value={current?.href ?? ""}
            onChange={(e) => router.push(e.target.value)}
            className="w-full border border-[var(--hairline)] bg-[var(--panel)] px-3 py-2.5 text-sm"
          >
            {groups.map((group) => (
              <optgroup key={group.group} label={group.group}>
                {group.items.map((item) => (
                  <option key={item.href} value={item.href}>
                    {item.label}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
          {current && <p className="mt-2 text-xs text-[var(--fg-faint)]">{current.hint}</p>}
        </div>

        {/* Desktop: a sidebar that stays in view while a long form scrolls. */}
        <nav aria-label="Settings sections" className="hidden lg:block">
          <div className="sticky top-6 border border-[var(--hairline)] bg-[var(--panel)] p-2">
            <p className="px-3 pb-2 pt-2 text-base font-semibold">Settings</p>
            {groups.map((group) => (
              <div key={group.group} className="mt-3 first-of-type:mt-1">
                <p className="px-3 pb-1 text-xs font-medium text-[var(--fg-faint)]">{group.group}</p>
                <ul className="flex flex-col gap-0.5">
                  {group.items.map((item) => {
                    const active = current?.href === item.href;
                    const icon = item.href.split("/").pop() ?? "";
                    return (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          aria-current={active ? "page" : undefined}
                          title={item.hint}
                          className={`flex items-center gap-2.5 px-3 py-2 text-sm transition-colors ${
                            active
                              ? "bg-[color-mix(in_oklab,var(--link)_10%,transparent)] font-medium text-[var(--fg)] shadow-[inset_2px_0_0_var(--link)]"
                              : "text-[var(--fg-dim)] hover:bg-[color-mix(in_oklab,var(--fg)_4%,transparent)] hover:text-[var(--fg)]"
                          }`}
                        >
                          <SettingsIcon name={icon} className={active ? "text-[var(--link)]" : "text-[var(--fg-faint)]"} />
                          {item.label}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        </nav>

        <div className="min-w-0 max-w-4xl">{children}</div>
      </div>
    </div>
  );
}
