"use client";

import { useEffect } from "react";

/**
 * The dashboard's form parts, shared by every editing page so a field, a
 * switch and the save bar behave the same wherever they appear.
 */

export function Heading({ title, hint }: { title: string; hint?: string }) {
  return (
    <header className="flex flex-wrap items-baseline justify-between gap-3 border-b border-[var(--hairline)] px-5 py-3.5">
      <h2 className="font-mono text-[0.66rem] uppercase tracking-[0.14em]">{title}</h2>
      {hint && <p className="text-xs text-[var(--fg-faint)]">{hint}</p>}
    </header>
  );
}

export function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block min-w-0">
      <span className="mb-1.5 block font-mono text-[0.6rem] uppercase tracking-[0.14em] text-[var(--fg-faint)]">
        {label}
      </span>
      {children}
      {error ? (
        <span className="mt-1 block text-[0.7rem] text-[var(--color-signal)]">{error}</span>
      ) : (
        hint && <span className="mt-1 block text-[0.7rem] text-[var(--fg-faint)]">{hint}</span>
      )}
    </label>
  );
}

export function Toggle({
  label,
  hint,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  hint: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label
      className={`flex items-center justify-between gap-4 bg-[var(--panel)] px-5 py-4 ${disabled ? "opacity-50" : "cursor-pointer"}`}
    >
      <span>
        <span className="block text-sm font-medium">{label}</span>
        <span className="mt-0.5 block text-xs text-[var(--fg-faint)]">{hint}</span>
      </span>
      <input
        type="checkbox"
        role="switch"
        className="peer sr-only"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span
        aria-hidden="true"
        className="relative h-5 w-9 shrink-0 rounded-full bg-[var(--hairline)] transition-colors peer-checked:bg-[var(--link)] peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[var(--link)] after:absolute after:left-0.5 after:top-0.5 after:h-4 after:w-4 after:rounded-full after:bg-white after:shadow after:transition-transform peer-checked:after:translate-x-4"
      />
    </label>
  );
}

/** Pinned to the bottom of the window while there is something to save. */
export function SaveBar({
  dirty,
  saving,
  saved,
  message,
  onSave,
  onDiscard,
}: {
  dirty: boolean;
  saving: boolean;
  saved: boolean;
  message: string | null;
  onSave: () => void;
  onDiscard: () => void;
}) {
  return (
    <div
      className={`fixed inset-x-0 bottom-0 z-30 border-t border-[var(--hairline)] bg-[var(--panel)] transition-transform duration-200 md:left-60 ${
        dirty || message || saved ? "translate-y-0" : "translate-y-full"
      }`}
    >
      <div className="flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3 md:px-8 lg:px-12">
        <p
          role="status"
          className={`text-sm ${message ? "text-[var(--color-signal)]" : saved ? "text-[var(--link)]" : "text-[var(--fg-dim)]"}`}
        >
          {message ?? (saved && !dirty ? "Saved — the site updates in a few seconds." : "Unsaved changes")}
        </p>
        <div className="flex items-center gap-3">
          {dirty && (
            <button
              type="button"
              onClick={onDiscard}
              disabled={saving}
              className="px-3 py-2 text-sm text-[var(--fg-dim)] hover:text-[var(--fg)]"
            >
              Discard
            </button>
          )}
          <button
            type="button"
            onClick={onSave}
            disabled={!dirty || saving}
            className="bg-[var(--fg)] px-5 py-2.5 font-mono text-[0.68rem] uppercase tracking-[0.12em] text-[var(--ground)] disabled:opacity-35"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Warns before the tab closes while there is unsaved work. */
export function useUnsavedWarning(dirty: boolean) {
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
}
