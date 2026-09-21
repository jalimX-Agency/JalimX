"use client";

import { useEffect, useState } from "react";

import { useConfirm } from "@/components/admin/confirm";
import { Field } from "@/components/admin/fields";
import { RowsSkeleton } from "@/components/admin/skeleton";
import { admin, ApiError, isSignedOut, type WorkType, type WorkTypeInput } from "@/lib/admin/client";

/**
 * The kinds of work the agency does.
 *
 * A list you can edit rather than one written into the code, because the
 * offer changes faster than a deployment. The one thing a kind decides is
 * whether that work involves signing in somewhere: a site and a booking
 * platform do, a logo does not, and the logins panel follows this.
 */
export default function WorkTypesPage() {
  const [rows, setRows] = useState<WorkType[] | null>(null);
  const [open, setOpen] = useState<number | "new" | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    admin.workTypes().then(
      (list) => live && setRows(list),
      (e) => live && !isSignedOut(e) && setError(e.message),
    );
    return () => {
      live = false;
    };
  }, []);

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="font-display text-3xl font-semibold tracking-tight">Work types</h1>
        <button
          type="button"
          onClick={() => setOpen(open === "new" ? null : "new")}
          className="bg-[var(--fg)] px-4 py-2.5 font-mono text-[0.66rem] uppercase tracking-[0.12em] text-[var(--ground)]"
        >
          {open === "new" ? "Cancel" : "+ New type"}
        </button>
      </div>
      <p className="mt-2 max-w-[60ch] text-sm text-[var(--fg-dim)]">
        What a piece of work can be filed under. One job can carry several —
        social media and platforms together, for instance. These are yours
        alone; the services shown on the site are a separate list.
      </p>

      {error && (
        <p role="alert" className="mt-8 text-sm text-[var(--color-signal)]">
          {error}
        </p>
      )}

      {!rows && !error && (
        <div className="mt-8">
          <RowsSkeleton rows={4} />
        </div>
      )}

      {rows && (
        <div className="mt-8 border border-[var(--hairline)] bg-[var(--panel)]">
          {open === "new" && (
            <TypeEditor
              value={{ name: "", needs_logins: false, is_active: true }}
              onCancel={() => setOpen(null)}
              onSave={async (input) => {
                const created = await admin.createWorkType(input);
                setRows((r) => [...(r ?? []), created]);
                setOpen(null);
              }}
            />
          )}

          {rows.length === 0 && open !== "new" ? (
            <p className="px-5 py-8 text-sm text-[var(--fg-faint)]">
              Nothing yet. A website, social media, SEO — whatever you are
              actually asked for.
            </p>
          ) : (
            <ul>
              {rows.map((row) => (
                <li key={row.id} className="border-t border-[var(--hairline)] first:border-t-0">
                  {open === row.id ? (
                    <TypeEditor
                      type={row}
                      value={{
                        name: row.name,
                        needs_logins: row.needs_logins,
                        is_active: row.is_active,
                      }}
                      onCancel={() => setOpen(null)}
                      onSave={async (input) => {
                        const next = await admin.updateWorkType(row.id, input);
                        setRows((r) => (r ?? []).map((x) => (x.id === row.id ? next : x)));
                        setOpen(null);
                      }}
                      onDeleted={async () => {
                        await admin.removeWorkType(row.id);
                        setRows((r) => (r ?? []).filter((x) => x.id !== row.id));
                        setOpen(null);
                      }}
                    />
                  ) : (
                    <button
                      type="button"
                      onClick={() => setOpen(row.id)}
                      className="flex w-full flex-wrap items-baseline justify-between gap-4 px-5 py-4 text-left hover:bg-[color-mix(in_oklab,var(--fg)_3%,transparent)]"
                    >
                      <span className={row.is_active ? "" : "text-[var(--fg-faint)]"}>
                        {row.name}
                        {!row.is_active && (
                          <span className="ml-3 font-mono text-[0.6rem] uppercase tracking-[0.12em]">
                            Retired
                          </span>
                        )}
                      </span>
                      {row.needs_logins && (
                        <span className="font-mono text-[0.6rem] uppercase tracking-[0.12em] text-[var(--fg-faint)]">
                          Has logins
                        </span>
                      )}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function TypeEditor({
  type,
  value,
  onSave,
  onCancel,
  onDeleted,
}: {
  type?: WorkType;
  value: WorkTypeInput;
  onSave: (input: WorkTypeInput) => Promise<void>;
  onCancel: () => void;
  onDeleted?: () => Promise<void>;
}) {
  const [input, setInput] = useState<WorkTypeInput>(value);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const ask = useConfirm();

  async function submit() {
    setBusy(true);
    setMessage(null);
    try {
      await onSave(input);
    } catch (e) {
      if (e instanceof ApiError && e.status === 422) {
        setMessage(Object.values(e.errors)[0]?.[0] ?? "Check the fields above.");
      } else {
        setMessage(e instanceof Error ? e.message : "Saving failed.");
      }
      setBusy(false);
    }
  }

  async function remove() {
    if (!onDeleted) return;
    if (
      !(await ask({
        title: `Delete "${input.name}"?`,
        body: "Only possible while no work is filed under it. Otherwise switch it off instead.",
        confirmLabel: "Delete",
        tone: "danger",
      }))
    ) {
      return;
    }
    setBusy(true);
    try {
      await onDeleted();
    } catch (e) {
      // The API refuses when work is already filed under it, and says so.
      setMessage(e instanceof Error ? e.message : "Could not delete it.");
      setBusy(false);
    }
  }

  return (
    <div className="bg-[color-mix(in_oklab,var(--fg)_3%,transparent)] px-5 py-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Name" hint="As you would say it to a client">
          <input
            className="admin-input"
            maxLength={80}
            value={input.name}
            onChange={(e) => setInput((i) => ({ ...i, name: e.target.value }))}
          />
        </Field>

        <div className="flex flex-col justify-center gap-3 pt-1">
          <label className="flex cursor-pointer items-start gap-3 text-sm">
            <input
              type="checkbox"
              className="mt-1"
              checked={input.needs_logins}
              onChange={(e) => setInput((i) => ({ ...i, needs_logins: e.target.checked }))}
            />
            <span>
              Needs logins
              <span className="mt-0.5 block text-xs text-[var(--fg-faint)]">
                Work of this kind means signing into something of theirs, so
                their logins show on the client page.
              </span>
            </span>
          </label>

          <label className="flex cursor-pointer items-start gap-3 text-sm">
            <input
              type="checkbox"
              className="mt-1"
              checked={input.is_active}
              onChange={(e) => setInput((i) => ({ ...i, is_active: e.target.checked }))}
            />
            <span>
              Still offered
              <span className="mt-0.5 block text-xs text-[var(--fg-faint)]">
                Switch off to stop offering it. Work already filed under it
                keeps it.
              </span>
            </span>
          </label>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <p role="status" className="max-w-[48ch] text-xs text-[var(--color-signal)]">
          {message}
        </p>
        <div className="flex items-center gap-4">
          {onDeleted && type && (
            <button
              type="button"
              onClick={remove}
              disabled={busy}
              className="text-xs text-[var(--fg-dim)] hover:text-[var(--color-signal)]"
            >
              Delete
            </button>
          )}
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="px-3 py-2 text-sm text-[var(--fg-dim)] hover:text-[var(--fg)]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={busy || !input.name.trim()}
            className="bg-[var(--fg)] px-4 py-2 font-mono text-[0.66rem] uppercase tracking-[0.12em] text-[var(--ground)] disabled:opacity-35"
          >
            {busy ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
