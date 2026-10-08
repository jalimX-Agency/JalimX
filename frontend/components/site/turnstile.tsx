"use client";

import { useEffect, useRef } from "react";

/**
 * Cloudflare Turnstile: the check that tells a visitor from a script.
 *
 * It renders nothing a person has to do unless Cloudflare is unsure
 * (`interaction-only`), and hands the page a one-time token that the contact
 * form sends along with the enquiry; the API checks it with Cloudflare.
 *
 * Without NEXT_PUBLIC_TURNSTILE_SITE_KEY the form does not render this at all,
 * and the API (which only checks when it has its own secret) accepts the form
 * as it always did — so the key can be added when the widget has been made.
 */

declare global {
  interface Window {
    turnstile?: {
      render: (element: HTMLElement, options: Record<string, unknown>) => string;
      reset: (id?: string) => void;
      remove: (id?: string) => void;
    };
  }
}

/** The public half of the widget's key pair; safe to ship to a browser. */
export const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";

const SCRIPT = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

let loading: Promise<void> | undefined;

/** Loads Cloudflare's script once, however many forms ask for it. */
function load(): Promise<void> {
  if (window.turnstile) return Promise.resolve();

  loading ??= new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = SCRIPT;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      // A content blocker, or no connection: let a later try start over.
      loading = undefined;
      script.remove();
      reject(new Error("The Turnstile script did not load."));
    };
    document.head.append(script);
  });

  return loading;
}

export type TurnstileHandle = {
  /** A token is good for one try. Asks for a fresh one after each. */
  reset: () => void;
};

type Props = {
  locale: string;
  /** A fresh token, or null when it has expired or been used. */
  onToken: (token: string | null) => void;
  /** The check could not run at all (script blocked, or a Cloudflare error). */
  onUnavailable: () => void;
  handle: React.RefObject<TurnstileHandle | null>;
};

export function Turnstile({ locale, onToken, onUnavailable, handle }: Props) {
  const container = useRef<HTMLDivElement>(null);

  // The callbacks change on every render of the form; the widget must not be
  // torn down and rebuilt each time, so it reads the latest through a ref.
  const latest = useRef({ onToken, onUnavailable });
  useEffect(() => {
    latest.current = { onToken, onUnavailable };
  });

  useEffect(() => {
    const element = container.current;
    if (!element || !TURNSTILE_SITE_KEY) return;

    let cancelled = false;
    let widgetId: string | undefined;

    load().then(
      () => {
        if (cancelled || !window.turnstile) return;

        widgetId = window.turnstile.render(element, {
          sitekey: TURNSTILE_SITE_KEY,
          language: locale === "fr" ? "fr" : "en",
          theme: "auto",
          appearance: "interaction-only",
          callback: (token: string) => latest.current.onToken(token),
          "expired-callback": () => latest.current.onToken(null),
          "timeout-callback": () => latest.current.onToken(null),
          // true: Cloudflare's own console warning adds nothing to ours.
          "error-callback": () => {
            latest.current.onToken(null);
            latest.current.onUnavailable();
            return true;
          },
        });

        handle.current = {
          reset: () => {
            if (widgetId) window.turnstile?.reset(widgetId);
          },
        };
      },
      () => {
        if (!cancelled) latest.current.onUnavailable();
      }
    );

    return () => {
      cancelled = true;
      handle.current = null;
      if (widgetId) window.turnstile?.remove(widgetId);
    };
  }, [locale, handle]);

  return <div ref={container} />;
}
