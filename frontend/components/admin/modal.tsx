"use client";

import { useEffect, useRef } from "react";

/**
 * The dashboard's plain centred dialog: the same frame as the confirm,
 * for the few places that ask for more than a yes or no.
 *
 * Built on the native <dialog>, so focus stays inside while it is open
 * and the page behind is inert.
 */
export function Modal({
  open,
  onClose,
  label,
  children,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  label: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-label={label}
      // Chrome does not always fire "cancel" for Escape; handle both.
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.preventDefault();
          onClose();
        }
      }}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className={`m-auto max-h-[calc(100dvh-2rem)] ${
        wide ? "w-[min(40rem,calc(100vw-2rem))]" : "w-[min(28rem,calc(100vw-2rem))]"
      } border border-[var(--hairline)] bg-[var(--panel)] p-0 text-[var(--fg)] shadow-[0_24px_60px_-20px_rgb(0_0_0/0.45)] backdrop:bg-[color-mix(in_oklab,var(--ground)_55%,black_45%)] backdrop:backdrop-blur-[2px]`}
    >
      {open && <div className="border-t-2 border-[var(--link)]">{children}</div>}
    </dialog>
  );
}

/** The small uppercase caption above a field. */
export function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="font-mono text-[0.6rem] uppercase tracking-[0.14em] text-[var(--fg-faint)]">
      {children}
    </span>
  );
}
