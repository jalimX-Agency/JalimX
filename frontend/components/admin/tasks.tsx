"use client";

import { useState } from "react";

import { useConfirm } from "@/components/admin/confirm";
import { admin, type Engagement, type Task } from "@/lib/admin/client";

/**
 * The to-do list inside a piece of work.
 *
 * Everything saves as it happens — ticking a box is not something anyone
 * expects to confirm with a Save button, which is also why this sits
 * beside the form rather than inside it. Adding is one line and Enter;
 * a date is optional, because most tasks do not have one and a form that
 * insists gets fewer tasks written down.
 */

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/** "Today", "Tomorrow", "3 days late", or the date itself further out. */
function when(due: string): { label: string; late: boolean; soon: boolean } {
  const days = Math.round(
    (new Date(`${due}T00:00:00`).getTime() - new Date(`${today()}T00:00:00`).getTime()) /
      86_400_000,
  );
  if (days < 0) return { label: `${-days} ${days === -1 ? "day" : "days"} late`, late: true, soon: false };
  if (days === 0) return { label: "Today", late: false, soon: true };
  if (days === 1) return { label: "Tomorrow", late: false, soon: true };
  const label = new Date(`${due}T00:00:00`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
  });
  return { label, late: false, soon: days <= 7 };
}

/** Same order the server uses, so a tick moves a row where a reload would. */
function sorted(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => {
    if (!!a.done_at !== !!b.done_at) return a.done_at ? 1 : -1;
    if (a.done_at && b.done_at) return b.done_at.localeCompare(a.done_at);
    if (!!a.due_on !== !!b.due_on) return a.due_on ? -1 : 1;
    if (a.due_on && b.due_on && a.due_on !== b.due_on) return a.due_on.localeCompare(b.due_on);
    return a.id - b.id;
  });
}

export function Tasks({
  engagement,
  onChanged,
}: {
  engagement: Engagement;
  onChanged: (next: Engagement) => void;
}) {
  const [title, setTitle] = useState("");
  const [due, setDue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDone, setShowDone] = useState(false);
  const [editing, setEditing] = useState<number | null>(null);
  const ask = useConfirm();

  const tasks = sorted(engagement.tasks);
  const open = tasks.filter((t) => !t.done_at);
  const done = tasks.filter((t) => t.done_at);

  const put = (next: Task[]) => onChanged({ ...engagement, tasks: sorted(next) });
  const replace = (task: Task) => put(engagement.tasks.map((t) => (t.id === task.id ? task : t)));

  async function add() {
    const text = title.trim();
    // A second Enter while the first is still on its way would add it twice.
    if (!text || busy) return;
    setBusy(true);
    setError(null);
    try {
      const task = await admin.createTask(engagement.id, { title: text, due_on: due || null });
      put([...engagement.tasks, task]);
      setTitle("");
      setDue("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not add it.");
    } finally {
      setBusy(false);
    }
  }

  /*
   * The tick answers the click, not the network: it flips at once and is
   * put back only if the save fails. A checkbox that waits a second on a
   * slow connection feels broken.
   */
  async function toggle(task: Task) {
    const optimistic = { ...task, done_at: task.done_at ? null : new Date().toISOString() };
    replace(optimistic);
    try {
      replace(await admin.updateTask(task.id, { done: !task.done_at }));
    } catch (e) {
      replace(task);
      setError(e instanceof Error ? e.message : "Could not save that.");
    }
  }

  async function save(task: Task, change: { title?: string; due_on?: string | null }) {
    setError(null);
    try {
      replace(await admin.updateTask(task.id, change));
      setEditing(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save that.");
    }
  }

  async function remove(task: Task) {
    if (
      !(await ask({
        title: `Delete "${task.title}"?`,
        body: task.done_at ? undefined : "It is not done yet. Ticking it off keeps a record; deleting does not.",
        confirmLabel: "Delete",
        tone: "danger",
      }))
    ) {
      return;
    }
    try {
      await admin.removeTask(task.id);
      put(engagement.tasks.filter((t) => t.id !== task.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not delete it.");
    }
  }

  return (
    <div>
      {/* One line and Enter. The date is there if it matters and ignored
          if it does not. */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          add();
        }}
        className="flex flex-wrap items-center gap-3"
      >
        <input
          className="admin-input min-w-0 flex-1 basis-60"
          maxLength={190}
          placeholder="Something to do — then Enter"
          aria-label="New task"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          /*
           * Enter is handled here rather than left to the form's implicit
           * submission, which does not fire for every way a key can arrive.
           * preventDefault stops the form submitting as well, so a real
           * keyboard adds the task once, not twice.
           */
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.nativeEvent.isComposing) {
              e.preventDefault();
              add();
            }
          }}
        />
        <input
          type="date"
          className="admin-input w-auto"
          aria-label="Due date (optional)"
          value={due}
          onChange={(e) => setDue(e.target.value)}
        />
        <button
          type="submit"
          disabled={busy || !title.trim()}
          className="bg-[var(--fg)] px-4 py-2 font-mono text-[0.66rem] uppercase tracking-[0.12em] text-[var(--ground)] disabled:opacity-35"
        >
          {busy ? "Adding…" : "Add"}
        </button>
      </form>

      {error && (
        <p role="alert" className="mt-3 text-xs text-[var(--color-signal)]">
          {error}
        </p>
      )}

      {open.length === 0 && done.length === 0 ? (
        <p className="mt-6 border border-dashed border-[var(--hairline)] px-5 py-10 text-center text-sm text-[var(--fg-faint)]">
          Nothing to do yet.
        </p>
      ) : (
        <>
          {open.length === 0 ? (
            <p className="mt-6 text-sm text-[var(--fg-dim)]">Everything on this list is done.</p>
          ) : (
            <ul className="mt-5 border border-[var(--hairline)] bg-[var(--panel)]">
              {open.map((task) => (
                <Row
                  key={task.id}
                  task={task}
                  editing={editing === task.id}
                  onToggle={() => toggle(task)}
                  onEdit={() => setEditing(task.id)}
                  onCancel={() => setEditing(null)}
                  onSave={(change) => save(task, change)}
                  onDelete={() => remove(task)}
                />
              ))}
            </ul>
          )}

          {done.length > 0 && (
            <div className="mt-4">
              <button
                type="button"
                onClick={() => setShowDone((v) => !v)}
                aria-expanded={showDone}
                className="font-mono text-[0.6rem] uppercase tracking-[0.14em] text-[var(--fg-faint)] hover:text-[var(--fg)]"
              >
                {showDone ? "Hide" : "Show"} done ({done.length})
              </button>
              {showDone && (
                <ul className="mt-3 border border-[var(--hairline)] bg-[var(--panel)]">
                  {done.map((task) => (
                    <Row
                      key={task.id}
                      task={task}
                      editing={false}
                      onToggle={() => toggle(task)}
                      onEdit={() => {}}
                      onCancel={() => {}}
                      onSave={() => {}}
                      onDelete={() => remove(task)}
                    />
                  ))}
                </ul>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Row({
  task,
  editing,
  onToggle,
  onEdit,
  onCancel,
  onSave,
  onDelete,
}: {
  task: Task;
  editing: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onCancel: () => void;
  onSave: (change: { title?: string; due_on?: string | null }) => void;
  onDelete: () => void;
}) {
  const [title, setTitle] = useState(task.title);
  const [due, setDue] = useState(task.due_on ?? "");
  const isDone = !!task.done_at;
  const w = task.due_on && !isDone ? when(task.due_on) : null;

  return (
    <li className="flex items-start gap-3 border-b border-[var(--hairline)] px-4 py-3 last:border-b-0">
      <input
        type="checkbox"
        className="mt-1 shrink-0"
        checked={isDone}
        onChange={onToggle}
        aria-label={isDone ? `Mark "${task.title}" as not done` : `Mark "${task.title}" as done`}
      />

      {editing ? (
        <form
          className="flex min-w-0 flex-1 flex-wrap items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const change: { title?: string; due_on?: string | null } = {};
            if (title.trim() && title.trim() !== task.title) change.title = title.trim();
            if ((due || null) !== task.due_on) change.due_on = due || null;
            if (Object.keys(change).length) onSave(change);
            else onCancel();
          }}
          // Escape backs out of the edit, the way it does everywhere else.
          onKeyDown={(e) => {
            if (e.key === "Escape") onCancel();
          }}
        >
          <input
            autoFocus
            className="admin-input min-w-0 flex-1 basis-48 py-1.5"
            maxLength={190}
            aria-label="Task"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            // Same reason as the add field: Enter saves, whatever sent it.
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                e.preventDefault();
                e.currentTarget.form?.requestSubmit();
              }
            }}
          />
          <input
            type="date"
            className="admin-input w-auto py-1.5"
            aria-label="Due date"
            value={due}
            onChange={(e) => setDue(e.target.value)}
          />
          <button type="submit" className="px-2 text-xs text-[var(--link)]">
            Save
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="px-2 text-xs text-[var(--fg-dim)] hover:text-[var(--fg)]"
          >
            Cancel
          </button>
        </form>
      ) : (
        <>
          <button
            type="button"
            onClick={isDone ? undefined : onEdit}
            disabled={isDone}
            className={`min-w-0 flex-1 text-left text-sm ${
              isDone ? "text-[var(--fg-faint)] line-through" : "hover:text-[var(--link)]"
            }`}
          >
            {task.title}
          </button>
          {w && (
            <span
              className={`shrink-0 font-mono text-[0.6rem] uppercase tracking-[0.12em] ${
                w.late
                  ? "text-[var(--color-signal)]"
                  : w.soon
                    ? "text-[var(--link)]"
                    : "text-[var(--fg-faint)]"
              }`}
            >
              {w.label}
            </span>
          )}
          <button
            type="button"
            onClick={onDelete}
            aria-label={`Delete "${task.title}"`}
            className="shrink-0 px-1 text-[var(--fg-faint)] hover:text-[var(--color-signal)]"
          >
            ×
          </button>
        </>
      )}
    </li>
  );
}
