"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

/**
 * What an action did, said where the eye is: a card at the top of the
 * screen, instead of a line of small text somewhere down the page that
 * scrolled out of view before it arrived.
 *
 * Success goes after a few seconds; an error stays until it is read and
 * closed, because it is usually the one thing that needs doing next.
 * Hovering holds either one.
 *
 *   const toast = useToast();
 *   toast.success("Sent to +212612345678");
 *   toast.error(e, "Could not send it.");
 *
 * Field-by-field problems still show beside their field; this is for the
 * outcome of the whole action.
 */

type Tone = "success" | "error" | "info";

type Item = { id: number; tone: Tone; title: string; detail?: string };

type Toast = {
  success: (title: string, detail?: string) => void;
  /** Takes the caught error itself; `fallback` when it carries no message. */
  error: (error: unknown, fallback?: string) => void;
  info: (title: string, detail?: string) => void;
};

const ToastContext = createContext<Toast | null>(null);

export function useToast(): Toast {
  const toast = useContext(ToastContext);
  if (!toast) throw new Error("useToast needs a <ToastProvider> above it.");
  return toast;
}

/** Validation errors arrive as a map; the first one is the message. */
function describe(error: unknown, fallback: string): string {
  if (typeof error === "string") return error;
  if (error && typeof error === "object") {
    const errors = (error as { errors?: Record<string, string[]> }).errors;
    const first = errors ? Object.values(errors)[0]?.[0] : undefined;
    if (first) return first;
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message) return message;
  }
  return fallback;
}

const LIFE: Record<Tone, number | null> = { success: 4500, info: 6000, error: null };

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<Item[]>([]);
  const next = useRef(1);

  const close = useCallback((id: number) => setItems((all) => all.filter((i) => i.id !== id)), []);

  const push = useCallback((tone: Tone, title: string, detail?: string) => {
    const id = next.current++;
    setItems((all) => {
      // The same message twice in a row is one card, not a pile.
      const kept = all.filter((i) => !(i.tone === tone && i.title === title && i.detail === detail));
      return [...kept, { id, tone, title, detail }].slice(-4);
    });
  }, []);

  const [toast] = useState<Toast>(() => ({
    success: (title, detail) => push("success", title, detail),
    info: (title, detail) => push("info", title, detail),
    error: (error, fallback = "Something went wrong.") => push("error", describe(error, fallback)),
  }));

  /*
   * A popover, so it sits in the browser's top layer: an open dialog (a
   * task drawer, "are you sure?") is up there too, and would otherwise
   * cover any z-index. Shown again on each change so it lands above
   * whatever opened since.
   */
  const stack = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = stack.current;
    if (!el || typeof el.showPopover !== "function") return;
    try {
      if (el.matches(":popover-open")) el.hidePopover();
      if (items.length > 0) el.showPopover();
    } catch {
      // A browser without popovers still shows it, under any dialog.
    }
  }, [items]);

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div
        ref={stack}
        popover="manual"
        aria-live="polite"
        className="pointer-events-none fixed inset-x-4 top-4 bottom-auto z-[60] m-0 flex w-auto flex-col items-center gap-2 overflow-visible border-0 bg-transparent p-0 sm:right-6 sm:left-auto sm:items-end [&:not(:popover-open)]:hidden"
      >
        {items.map((item) => (
          <Card key={item.id} item={item} onClose={() => close(item.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

const MARK: Record<Tone, string> = { success: "✓", error: "!", info: "i" };

const COLOUR: Record<Tone, string> = {
  success: "#2f9a68",
  error: "var(--color-signal)",
  info: "var(--link)",
};

function Card({ item, onClose }: { item: Item; onClose: () => void }) {
  const [held, setHeld] = useState(false);
  const life = LIFE[item.tone];

  useEffect(() => {
    if (life === null || held) return;
    const t = window.setTimeout(onClose, life);
    return () => window.clearTimeout(t);
  }, [life, held, onClose]);

  const colour = COLOUR[item.tone];

  return (
    <div
      role={item.tone === "error" ? "alert" : "status"}
      onMouseEnter={() => setHeld(true)}
      onMouseLeave={() => setHeld(false)}
      style={{ borderLeftColor: colour }}
      className="admin-toast pointer-events-auto flex w-full max-w-[26rem] items-start gap-3 border border-l-4 border-[var(--hairline)] bg-[var(--panel)] py-3 pr-3 pl-3.5 text-[var(--fg)] shadow-[0_14px_40px_-12px_rgb(0_0_0/0.45)]"
    >
      <span
        aria-hidden
        style={{ backgroundColor: colour }}
        className="mt-px flex size-5 shrink-0 items-center justify-center rounded-full font-mono text-[0.7rem] font-bold text-white"
      >
        {MARK[item.tone]}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm leading-snug break-words">{item.title}</p>
        {item.detail && <p className="mt-1 text-xs leading-snug text-[var(--fg-dim)]">{item.detail}</p>}
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label="Dismiss"
        className="-mt-0.5 px-1 text-lg leading-none text-[var(--fg-faint)] hover:text-[var(--fg)]"
      >
        ×
      </button>
    </div>
  );
}
