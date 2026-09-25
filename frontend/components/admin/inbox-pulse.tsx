"use client";

import Link from "next/link";
import { createContext, useContext, useEffect, useRef, useState } from "react";

import { admin } from "@/lib/admin/client";

/**
 * "Has anything happened in the WhatsApp inbox?", asked by the whole
 * dashboard at once.
 *
 * One small request every few seconds, answered from the server's cache
 * rather than its database. The menu badge, the tab title and the inbox
 * page all read the same answer; the inbox fetches real messages only
 * when its version moves. A tab in the background asks every 30 seconds
 * instead of 8, and at once when it is looked at again.
 */

export type Pulse = { version: string | null; unread: number };

const EVERY = 8_000;
const HIDDEN_EVERY = 30_000;

const PulseContext = createContext<Pulse>({ version: null, unread: 0 });

export const useInboxPulse = () => useContext(PulseContext);

export function useInboxPulseSource(enabled: boolean): Pulse {
  const [pulse, setPulse] = useState<Pulse>({ version: null, unread: 0 });

  useEffect(() => {
    if (!enabled) return;
    let live = true;

    /*
     * A tab in the background still asks, less often: its title is how a
     * new message is noticed while you work in another tab.
     */
    let last = 0;
    const check = () => {
      if (document.hidden && Date.now() - last < HIDDEN_EVERY) return;
      last = Date.now();
      admin.inboxPulse().then(
        (p) => {
          if (!live) return;
          // Same version, same object: nothing downstream re-renders.
          setPulse((old) => (old.version === p.version && old.unread === p.unread ? old : p));
        },
        () => {},
      );
    };

    check();
    const timer = window.setInterval(check, EVERY);
    // Back on the tab: ask now, not in up to eight seconds.
    document.addEventListener("visibilitychange", check);
    window.addEventListener("focus", check);

    return () => {
      live = false;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", check);
      window.removeEventListener("focus", check);
    };
  }, [enabled]);

  return pulse;
}

export function InboxPulseProvider({ value, children }: { value: Pulse; children: React.ReactNode }) {
  return <PulseContext.Provider value={value}>{children}</PulseContext.Provider>;
}

/**
 * A new message while you are somewhere else: the count in the tab title,
 * and a notice in the corner for a few seconds. Not shown on the inbox,
 * which updates itself.
 */
export function InboxNotice({ pulse, onInbox }: { pulse: Pulse; onInbox: boolean }) {
  const previous = useRef<number | null>(null);
  const [show, setShow] = useState(false);

  useEffect(() => {
    const base = document.title.replace(/^\(\d+\)\s*/, "");
    document.title = pulse.unread > 0 ? `(${pulse.unread}) ${base}` : base;
  }, [pulse.unread]);

  useEffect(() => {
    const before = previous.current;
    previous.current = pulse.unread;
    // Only a rise counts, and not the first answer after the page loads.
    if (before === null || pulse.unread <= before || onInbox) return;
    setShow(true);
    const t = window.setTimeout(() => setShow(false), 10_000);
    return () => window.clearTimeout(t);
  }, [pulse.unread, onInbox]);

  if (!show || onInbox) return null;

  return (
    <div
      role="status"
      className="fixed right-4 bottom-4 z-50 flex items-center gap-4 border border-[var(--hairline)] bg-[var(--panel)] px-4 py-3 text-sm shadow-[0_12px_40px_-12px_rgb(0_0_0/0.4)]"
    >
      <span>💬 New WhatsApp message</span>
      <Link href="/admin/inbox" onClick={() => setShow(false)} className="text-[var(--link)] hover:underline">
        Open the inbox
      </Link>
      <button
        type="button"
        onClick={() => setShow(false)}
        aria-label="Dismiss"
        className="text-[var(--fg-faint)] hover:text-[var(--fg)]"
      >
        ×
      </button>
    </div>
  );
}
