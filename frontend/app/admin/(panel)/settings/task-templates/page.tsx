"use client";

import { useEffect, useState } from "react";

import { useConfirm } from "@/components/admin/confirm";
import { Field } from "@/components/admin/fields";
import { RowsSkeleton } from "@/components/admin/skeleton";
import { PRIORITY_LABEL } from "@/components/admin/tasks";
import {
  admin,
  ApiError,
  isSignedOut,
  TASK_PRIORITIES,
  type TaskPriority,
  type TaskTemplate,
  type TaskTemplateInput,
  type TemplateStep,
  type WorkType,
} from "@/lib/admin/client";

/**
 * Task templates: the steps a kind of job always takes.
 *
 * Written once here, then dropped onto a new piece of work from its Tasks
 * section in one click, dated from the day the job starts. Editing a
 * template never changes tasks already made from it.
 */

const blankStep = (): TemplateStep => ({ title: "", day: null, priority: "normal", checklist: [] });

export default function TaskTemplatesPage() {
  const [rows, setRows] = useState<TaskTemplate[] | null>(null);
  const [types, setTypes] = useState<WorkType[]>([]);
  const [open, setOpen] = useState<number | "new" | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    Promise.all([admin.taskTemplates(), admin.workTypes()]).then(
      ([list, kinds]) => {
        if (!live) return;
        setRows(list);
        setTypes(kinds);
      },
      (e) => live && !isSignedOut(e) && setError(e.message),
    );
    return () => {
      live = false;
    };
  }, []);

  const typeName = (id: number | null) => types.find((t) => t.id === id)?.name;

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="font-display text-3xl font-semibold tracking-tight">Task templates</h1>
        <button
          type="button"
          onClick={() => setOpen(open === "new" ? null : "new")}
          className="bg-[var(--fg)] px-4 py-2.5 font-mono text-[0.66rem] uppercase tracking-[0.12em] text-[var(--ground)]"
        >
          {open === "new" ? "Cancel" : "+ New template"}
        </button>
      </div>
      <p className="mt-2 max-w-[60ch] text-sm text-[var(--fg-dim)]">
        The steps a kind of job always takes. Use one from the Tasks section of a work (or from the
        Tasks page) and every step is added at once, dated from the day the job starts. “Day 7”
        means a week after the start.
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
            <TemplateEditor
              types={types}
              value={{ name: "", description: null, work_type_id: null, items: [blankStep()] }}
              onCancel={() => setOpen(null)}
              onSave={async (input) => {
                const created = await admin.createTaskTemplate(input);
                setRows((r) => [...(r ?? []), created]);
                setOpen(null);
              }}
            />
          )}

          {rows.length === 0 && open !== "new" ? (
            <p className="px-5 py-8 text-sm text-[var(--fg-faint)]">
              No templates yet. Make one here, or open a work with tasks and choose “Save as
              template”.
            </p>
          ) : (
            <ul>
              {rows.map((row) => (
                <li key={row.id} className="border-t border-[var(--hairline)] first:border-t-0">
                  {open === row.id ? (
                    <TemplateEditor
                      types={types}
                      existing
                      value={{
                        name: row.name,
                        description: row.description,
                        work_type_id: row.work_type_id,
                        items: row.items,
                      }}
                      onCancel={() => setOpen(null)}
                      onSave={async (input) => {
                        const next = await admin.updateTaskTemplate(row.id, input);
                        setRows((r) => (r ?? []).map((x) => (x.id === row.id ? next : x)));
                        setOpen(null);
                      }}
                      onDeleted={async () => {
                        await admin.removeTaskTemplate(row.id);
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
                      <span className="min-w-0">
                        <span className="block">{row.name}</span>
                        {row.description && (
                          <span className="mt-0.5 block text-xs text-[var(--fg-faint)]">
                            {row.description}
                          </span>
                        )}
                      </span>
                      <span className="font-mono text-[0.6rem] uppercase tracking-[0.12em] text-[var(--fg-faint)]">
                        {[typeName(row.work_type_id), `${row.items.length} steps`]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
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

function TemplateEditor({
  types,
  value,
  existing,
  onSave,
  onCancel,
  onDeleted,
}: {
  types: WorkType[];
  value: TaskTemplateInput;
  existing?: boolean;
  onSave: (input: TaskTemplateInput) => Promise<void>;
  onCancel: () => void;
  onDeleted?: () => Promise<void>;
}) {
  const [input, setInput] = useState<TaskTemplateInput>(value);
  /** Which steps have their checklist box open. */
  const [lists, setLists] = useState<Set<number>>(new Set());
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const ask = useConfirm();

  const steps = input.items;
  const setSteps = (items: TemplateStep[]) => setInput((i) => ({ ...i, items }));
  const setStep = (at: number, change: Partial<TemplateStep>) =>
    setSteps(steps.map((s, i) => (i === at ? { ...s, ...change } : s)));

  function move(at: number, by: -1 | 1) {
    const to = at + by;
    if (to < 0 || to >= steps.length) return;
    const next = [...steps];
    [next[at], next[to]] = [next[to], next[at]];
    setSteps(next);
    setLists(new Set());
  }

  async function submit() {
    const items = steps
      .filter((s) => s.title.trim())
      .map((s) => ({ ...s, checklist: s.checklist.map((c) => c.trim()).filter(Boolean) }));
    if (!items.length) {
      setMessage("Add at least one step.");
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      await onSave({ ...input, name: input.name.trim(), items });
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
        body: "Tasks already made from it stay as they are.",
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
      setMessage(e instanceof Error ? e.message : "Could not delete it.");
      setBusy(false);
    }
  }

  return (
    <div className="bg-[color-mix(in_oklab,var(--fg)_3%,transparent)] px-5 py-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Name" hint="As you would call the job">
          <input
            className="admin-input"
            maxLength={120}
            value={input.name}
            onChange={(e) => setInput((i) => ({ ...i, name: e.target.value }))}
          />
        </Field>
        <Field label="Suggested for" hint="Offered first on work of this kind">
          <select
            className="admin-input"
            value={input.work_type_id ?? ""}
            onChange={(e) =>
              setInput((i) => ({ ...i, work_type_id: e.target.value ? Number(e.target.value) : null }))
            }
          >
            <option value="">Any kind of work</option>
            {types.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </Field>
        <div className="sm:col-span-2">
          <Field label="Description" hint="Optional — when to use it">
            <input
              className="admin-input"
              maxLength={500}
              value={input.description ?? ""}
              onChange={(e) => setInput((i) => ({ ...i, description: e.target.value || null }))}
            />
          </Field>
        </div>
      </div>

      {/* The steps. The day is counted from the start date chosen when
          the template is used; empty means the task has no date. */}
      <div className="mt-6">
        <div className="hidden grid-cols-[4.5rem_1fr_7rem_auto] gap-2 px-1 pb-2 font-mono text-[0.58rem] uppercase tracking-[0.14em] text-[var(--fg-faint)] sm:grid">
          <span>Day</span>
          <span>Step</span>
          <span>Priority</span>
          <span className="w-28" />
        </div>
        <ol className="border border-[var(--hairline)] bg-[var(--panel)]">
          {steps.map((step, i) => (
            <li key={i} className="border-b border-[var(--hairline)] px-2 py-2 last:border-b-0">
              <div className="grid grid-cols-[4.5rem_1fr] gap-2 sm:grid-cols-[4.5rem_1fr_7rem_auto]">
                <input
                  type="number"
                  min={0}
                  max={365}
                  inputMode="numeric"
                  className="admin-input py-1.5 tabular-nums"
                  aria-label={`Day for step ${i + 1}`}
                  placeholder="—"
                  value={step.day ?? ""}
                  onChange={(e) =>
                    setStep(i, {
                      day: e.target.value === "" ? null : Math.max(0, Math.min(365, Number(e.target.value))),
                    })
                  }
                />
                <input
                  className="admin-input py-1.5"
                  maxLength={190}
                  aria-label={`Step ${i + 1}`}
                  placeholder="What to do"
                  value={step.title}
                  onChange={(e) => setStep(i, { title: e.target.value })}
                  onKeyDown={(e) => {
                    // Enter on the last step starts the next one.
                    if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                      e.preventDefault();
                      if (i === steps.length - 1 && step.title.trim()) setSteps([...steps, blankStep()]);
                    }
                  }}
                />
                <select
                  className="admin-input col-start-2 py-1.5 sm:col-start-auto"
                  aria-label={`Priority for step ${i + 1}`}
                  value={step.priority}
                  onChange={(e) => setStep(i, { priority: e.target.value as TaskPriority })}
                >
                  {TASK_PRIORITIES.map((p) => (
                    <option key={p} value={p}>
                      {PRIORITY_LABEL[p]}
                    </option>
                  ))}
                </select>
                <div className="col-start-2 flex items-center gap-1 sm:col-start-auto">
                  <button
                    type="button"
                    onClick={() =>
                      setLists((s) => {
                        const n = new Set(s);
                        if (n.has(i)) n.delete(i);
                        else n.add(i);
                        return n;
                      })
                    }
                    aria-expanded={lists.has(i)}
                    className="px-2 py-1 text-xs text-[var(--fg-dim)] hover:text-[var(--fg)]"
                  >
                    Checklist{step.checklist.length ? ` (${step.checklist.length})` : ""}
                  </button>
                  <button
                    type="button"
                    onClick={() => move(i, -1)}
                    disabled={i === 0}
                    aria-label={`Move step ${i + 1} up`}
                    className="px-1.5 text-[var(--fg-faint)] hover:text-[var(--fg)] disabled:opacity-30"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    onClick={() => move(i, 1)}
                    disabled={i === steps.length - 1}
                    aria-label={`Move step ${i + 1} down`}
                    className="px-1.5 text-[var(--fg-faint)] hover:text-[var(--fg)] disabled:opacity-30"
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSteps(steps.filter((_, j) => j !== i));
                      setLists(new Set());
                    }}
                    aria-label={`Remove step ${i + 1}`}
                    className="px-1.5 text-[var(--fg-faint)] hover:text-[var(--color-signal)]"
                  >
                    ×
                  </button>
                </div>
              </div>
              {lists.has(i) && (
                <textarea
                  rows={Math.max(3, step.checklist.length + 1)}
                  className="admin-input mt-2 text-sm"
                  aria-label={`Checklist for step ${i + 1}, one item per line`}
                  placeholder="One item per line"
                  // Blank lines are kept while typing and dropped on save.
                  value={step.checklist.join("\n")}
                  onChange={(e) => setStep(i, { checklist: e.target.value.split("\n") })}
                />
              )}
            </li>
          ))}
        </ol>
        <button
          type="button"
          onClick={() => setSteps([...steps, blankStep()])}
          className="mt-3 text-xs text-[var(--link)] hover:underline"
        >
          + Add a step
        </button>
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <p role="status" className="max-w-[48ch] text-xs text-[var(--color-signal)]">
          {message}
        </p>
        <div className="flex items-center gap-4">
          {onDeleted && existing && (
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
