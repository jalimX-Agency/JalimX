"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

/**
 * The dashboard's own "are you sure?".
 *
 * Replaces window.confirm, which cannot be styled, says "localhost:3200
 * says" above whatever it is asked, and puts OK — the destructive choice —
 * where the eye lands first.
 *
 * Built on the native <dialog> element, so the browser supplies what a
 * hand-made modal usually gets wrong: focus kept inside while it is open,
 * Escape to cancel, and the page behind made inert. Used as a promise, so
 * a call site reads exactly as it did with window.confirm:
 *
 *   if (!(await confirm({ title: "Delete this?" }))) return;
 */

export type ConfirmOptions = {
  title: string;
  /** One string per paragraph. */
  body?: string | string[];
  confirmLabel?: string;
  cancelLabel?: string;
  /** "danger" for anything that cannot be undone. */
  tone?: "danger" | "default";
};

type Ask = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<Ask | null>(null);

export function useConfirm(): Ask {
  const ask = useContext(ConfirmContext);
  if (!ask) throw new Error("useConfirm needs a <ConfirmProvider> above it.");
  return ask;
}

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const cancelButton = useRef<HTMLButtonElement>(null);
  const confirmButton = useRef<HTMLButtonElement>(null);
  const settle = useRef<((answer: boolean) => void) | null>(null);
  const [options, setOptions] = useState<ConfirmOptions | null>(null);

  const ask = useCallback<Ask>((next) => {
    // A second question while one is open answers the first with "no"
    // rather than leaving its caller waiting forever.
    settle.current?.(false);
    setOptions(next);
    return new Promise<boolean>((resolve) => {
      settle.current = resolve;
    });
  }, []);

  const answer = useCallback((yes: boolean) => {
    settle.current?.(yes);
    settle.current = null;
    dialog.current?.close();
    setOptions(null);
  }, []);

  useEffect(() => {
    const el = dialog.current;
    if (!options || !el) return;
    if (!el.open) el.showModal();
    /*
     * Focus starts on Cancel when the action cannot be undone, so an Enter
     * pressed out of habit backs away instead of deleting.
     */
    (options.tone === "danger" ? cancelButton : confirmButton).current?.focus();
  }, [options]);

  const paragraphs = options?.body
    ? Array.isArray(options.body)
      ? options.body
      : [options.body]
    : [];
  const danger = options?.tone === "danger";

  return (
    <ConfirmContext.Provider value={ask}>
      {children}
      <dialog
        ref={dialog}
        aria-labelledby="confirm-title"
        /*
         * Escape is handled here as well as through the native "cancel"
         * event, because Chrome's close-watcher rules skip that event in
         * some cases — the key arrived and the dialog simply stayed open.
         * Either path counts as "no".
         */
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.preventDefault();
            answer(false);
          }
        }}
        onCancel={(e) => {
          e.preventDefault();
          answer(false);
        }}
        // A click on the backdrop lands on the dialog element itself.
        onClick={(e) => {
          if (e.target === e.currentTarget) answer(false);
        }}
        className="m-auto w-[min(28rem,calc(100vw-2rem))] border border-[var(--hairline)] bg-[var(--panel)] p-0 text-[var(--fg)] shadow-[0_24px_60px_-20px_rgb(0_0_0/0.45)] backdrop:bg-[color-mix(in_oklab,var(--ground)_55%,black_45%)] backdrop:backdrop-blur-[2px]"
      >
        {options && (
          <div className={`border-t-2 ${danger ? "border-[var(--color-signal)]" : "border-[var(--link)]"}`}>
            <div className="px-6 pt-6 pb-5">
              <p
                className={`font-mono text-[0.6rem] uppercase tracking-[0.16em] ${
                  danger ? "text-[var(--color-signal)]" : "text-[var(--fg-faint)]"
                }`}
              >
                {danger ? "Cannot be undone" : "Check"}
              </p>
              <h2 id="confirm-title" className="mt-2 font-display text-xl font-semibold leading-snug text-balance">
                {options.title}
              </h2>
              {paragraphs.map((p, i) => (
                <p key={i} className="mt-3 text-sm leading-relaxed text-[var(--fg-dim)]">
                  {p}
                </p>
              ))}
            </div>
            <div className="flex flex-wrap items-center justify-end gap-3 border-t border-[var(--hairline)] px-6 py-4">
              <button
                ref={cancelButton}
                type="button"
                onClick={() => answer(false)}
                className="px-4 py-2 text-sm text-[var(--fg-dim)] outline-offset-2 hover:text-[var(--fg)]"
              >
                {options.cancelLabel ?? "Cancel"}
              </button>
              <button
                ref={confirmButton}
                type="button"
                onClick={() => answer(true)}
                className={`px-4 py-2 font-mono text-[0.66rem] uppercase tracking-[0.12em] outline-offset-2 ${
                  danger
                    ? "bg-[var(--color-signal)] text-white"
                    : "bg-[var(--fg)] text-[var(--ground)]"
                }`}
              >
                {options.confirmLabel ?? "Confirm"}
              </button>
            </div>
          </div>
        )}
      </dialog>
    </ConfirmContext.Provider>
  );
}
