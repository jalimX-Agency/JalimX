"use client";

import { useEffect, useRef, useState } from "react";

import { Link, usePathname } from "@/i18n/navigation";

/**
 * Navigation below the `md` breakpoint, where the inline links are hidden.
 *
 * Uses the native `<dialog>` element rather than a hand-built overlay: the
 * browser gives focus trapping, Escape-to-close, inert background and the
 * top layer for free, and all of those are things a bespoke drawer gets
 * subtly wrong.
 */

type Item = { href: string; label: string };

type Labels = { menu: string; open: string; close: string; cta: string };

export function MobileNav({
  items,
  labels,
}: {
  items: Item[];
  labels: Labels;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // Close on navigation — the dialog outlives the route change otherwise.
  useEffect(() => {
    ref.current?.close();
    setOpen(false);
  }, [pathname]);

  // Keep React's state in step with closes the browser performs itself
  // (Escape, or the backdrop click below).
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;

    const onClose = () => setOpen(false);
    dialog.addEventListener("close", onClose);
    return () => dialog.removeEventListener("close", onClose);
  }, []);

  const show = () => {
    ref.current?.showModal();
    setOpen(true);
  };

  return (
    <>
      <button
        type="button"
        onClick={show}
        aria-expanded={open}
        aria-label={labels.open}
        className="-mr-2 flex size-10 items-center justify-center md:hidden"
      >
        <span aria-hidden="true" className="flex flex-col gap-[5px]">
          <span className="block h-px w-5 bg-[var(--fg)]" />
          <span className="block h-px w-5 bg-[var(--fg)]" />
        </span>
      </button>

      <dialog
        ref={ref}
        // The dialog renders in the top layer, outside the surface wrapper, so
        // it has to declare its own ground rather than inherit one.
        className="surface-light m-0 h-dvh max-h-none w-screen max-w-none p-0 backdrop:bg-black/40"
        onClick={(event) => {
          // Clicks land on the dialog itself only when they hit the backdrop.
          if (event.target === ref.current) ref.current?.close();
        }}
      >
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between border-b border-[var(--hairline)] px-6 py-5">
            <span className="font-mono text-[0.68rem] uppercase tracking-[0.16em] text-[var(--fg-faint)]">
              {labels.menu}
            </span>
            <button
              type="button"
              onClick={() => ref.current?.close()}
              aria-label={labels.close}
              className="-mr-2 flex size-10 items-center justify-center text-2xl leading-none text-[var(--fg)]"
            >
              ×
            </button>
          </div>

          <nav className="flex flex-col px-6 py-4">
            {items.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="border-b border-[var(--hairline)] py-5 font-display text-2xl font-semibold tracking-tight last:border-b-0"
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="mt-auto px-6 pb-10">
            <Link href="/contact" className="cta w-full justify-center">
              {labels.cta}
            </Link>
          </div>
        </div>
      </dialog>
    </>
  );
}
