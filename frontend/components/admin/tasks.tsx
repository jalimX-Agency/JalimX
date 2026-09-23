"use client";

import { useEffect, useRef, useState } from "react";

import { useConfirm } from "@/components/admin/confirm";
import { FieldLabel, Modal } from "@/components/admin/modal";
import { SaveAsTemplate, UseTemplate } from "@/components/admin/task-templates";
import {
  admin,
  REMINDER_PRESETS,
  TASK_PRIORITIES,
  TASK_REPEATS,
  TASK_STATUSES,
  type Engagement,
  type Task,
  type TaskInput,
  type TaskLinks,
  type TaskPriority,
  type TaskRepeat,
  type TaskStatus,
} from "@/lib/admin/client";

/**
 * Tasks, in the pieces both lists are built from: the row, the drawer that
 * opens when a row is clicked, the one-line add, and the list that sits
 * inside a piece of work. The Tasks page puts the same pieces together
 * across every client.
 *
 * Everything saves as it happens — ticking a box is not something anyone
 * expects to confirm with a Save button. Adding is one line and Enter;
 * the rest (status, priority, checklist, repeat) is there in the drawer
 * for the tasks that need it, and out of the way for the ones that do not.
 */

export const STATUS_LABEL: Record<TaskStatus, string> = {
  todo: "To do",
  doing: "Doing",
  waiting: "Waiting",
  done: "Done",
};

/** What each step means, said once where the status is chosen. */
const STATUS_HINT: Record<TaskStatus, string> = {
  todo: "Not started",
  doing: "Being worked on",
  waiting: "On someone else — the client, a supplier",
  done: "Finished",
};

export const PRIORITY_LABEL: Record<TaskPriority, string> = {
  low: "Low",
  normal: "Normal",
  high: "High",
};

export const REPEAT_LABEL: Record<TaskRepeat, string> = {
  daily: "Every day",
  weekdays: "Every weekday",
  weekly: "Every week",
  monthly: "Every month",
};

export const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/** Whole days from today to a date: negative when it has passed. */
export const daysUntil = (due: string) =>
  Math.round(
    (new Date(`${due}T00:00:00`).getTime() - new Date(`${today()}T00:00:00`).getTime()) / 86_400_000
  );

/** "Today", "Tomorrow", "3 days late", or the date itself further out. */
export function when(due: string): { label: string; late: boolean; soon: boolean } {
  const days = daysUntil(due);
  if (days < 0)
    return { label: `${-days} ${days === -1 ? "day" : "days"} late`, late: true, soon: false };
  if (days === 0) return { label: "Today", late: false, soon: true };
  if (days === 1) return { label: "Tomorrow", late: false, soon: true };
  const label = new Date(`${due}T00:00:00`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
  });
  return { label, late: false, soon: days <= 7 };
}

const RANK: Record<TaskPriority, number> = { high: 0, normal: 1, low: 2 };

/** Same order the server uses, with the urgent first inside a day. */
export function sortTasks(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => {
    if (!!a.done_at !== !!b.done_at) return a.done_at ? 1 : -1;
    if (a.done_at && b.done_at) return b.done_at.localeCompare(a.done_at);
    if (!!a.due_on !== !!b.due_on) return a.due_on ? -1 : 1;
    if (a.due_on && b.due_on && a.due_on !== b.due_on) return a.due_on.localeCompare(b.due_on);
    if (a.priority !== b.priority) return RANK[a.priority] - RANK[b.priority];
    return a.id - b.id;
  });
}

/** "Client · Work", "Client", or nothing for a task of its own. */
export const linkLabel = (t: Pick<Task, "client" | "work">) =>
  [t.client, t.work].filter(Boolean).join(" · ");

/*
 * The link picker encodes three kinds of answer in one <select> value:
 * "" for nothing, "c:ID" for a client only, "e:ID" for a piece of work.
 */
const linkValue = (t: { client_id: number | null; engagement_id: number | null }) =>
  t.engagement_id ? `e:${t.engagement_id}` : t.client_id ? `c:${t.client_id}` : "";

function parseLink(value: string): { client_id: number | null; engagement_id: number | null } {
  if (value.startsWith("e:")) return { engagement_id: Number(value.slice(2)), client_id: null };
  if (value.startsWith("c:")) return { client_id: Number(value.slice(2)), engagement_id: null };
  return { client_id: null, engagement_id: null };
}

export function LinkSelect({
  links,
  value,
  onChange,
  className = "",
  current,
}: {
  links: TaskLinks;
  value: string;
  onChange: (link: { client_id: number | null; engagement_id: number | null }) => void;
  className?: string;
  /** A finished work the task is still on, which the list no longer offers. */
  current?: { id: number; title: string } | null;
}) {
  const known = links.some((c) => c.works.some((w) => `e:${w.id}` === value));
  return (
    <select
      className={`admin-input ${className}`}
      aria-label="Linked to"
      value={value}
      onChange={(e) => onChange(parseLink(e.target.value))}
    >
      <option value="">Not linked — just a task</option>
      {current && !known && <option value={`e:${current.id}`}>{current.title}</option>}
      {links.map((c) => (
        <optgroup key={c.id} label={c.name}>
          <option value={`c:${c.id}`}>{c.name} — the client only</option>
          {c.works.map((w) => (
            <option key={w.id} value={`e:${w.id}`}>
              {w.title}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}

// ——— Small marks ————————————————————————————————————————————————

const STATUS_TONE: Record<TaskStatus, string> = {
  todo: "border-[var(--hairline)] text-[var(--fg-faint)]",
  doing: "border-[var(--link)] text-[var(--link)]",
  waiting:
    "border-[color-mix(in_oklab,#c98a1b_70%,var(--fg))] text-[color-mix(in_oklab,#c98a1b_80%,var(--fg))]",
  done: "border-[var(--hairline)] text-[var(--fg-faint)]",
};

export function StatusMark({ status }: { status: TaskStatus }) {
  return (
    <span
      className={`inline-block border px-1.5 py-px font-mono text-[0.56rem] uppercase tracking-[0.12em] ${STATUS_TONE[status]}`}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}

export function Progress({ value, className = "" }: { value: number; className?: string }) {
  return (
    <span
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={value}
      aria-label={`${value}% done`}
      className={`relative block h-1 overflow-hidden bg-[var(--hairline)] ${className}`}
    >
      <span
        className="absolute inset-y-0 left-0 bg-[var(--link)] transition-[width] duration-300"
        style={{ width: `${value}%` }}
      />
    </span>
  );
}

// ——— The row —————————————————————————————————————————————————————

export function TaskRow({
  task,
  onToggle,
  onOpen,
  showLink,
  selected,
  onSelect,
}: {
  task: Task;
  onToggle: () => void;
  onOpen: () => void;
  /** On the Tasks page, say what it belongs to; inside a work it is obvious. */
  showLink?: boolean;
  /** Given while a selection is being made; absent the rest of the time. */
  selected?: boolean;
  onSelect?: (event: React.MouseEvent | React.ChangeEvent) => void;
}) {
  const isDone = !!task.done_at;
  const w = task.due_on && !isDone ? when(task.due_on) : null;
  const checked = task.checklist.filter((i) => i.done).length;
  const link = linkLabel(task);

  return (
    <li
      className={`group flex items-start gap-3 border-b border-[var(--hairline)] px-4 py-3 last:border-b-0 ${
        selected
          ? "bg-[color-mix(in_oklab,var(--link)_8%,transparent)]"
          : "hover:bg-[color-mix(in_oklab,var(--fg)_3%,transparent)]"
      }`}
    >
      {onSelect && (
        // Picking rows out is its own box: the one beside it means done.
        <input
          type="checkbox"
          className="mt-1 shrink-0 accent-[var(--link)]"
          checked={!!selected}
          onChange={() => {}}
          onClick={onSelect}
          aria-label={`Select "${task.title}"`}
        />
      )}
      <input
        type="checkbox"
        className="mt-1 shrink-0"
        checked={isDone}
        onChange={onToggle}
        aria-label={isDone ? `Mark "${task.title}" as not done` : `Mark "${task.title}" as done`}
      />

      <button type="button" onClick={onOpen} className="min-w-0 flex-1 text-left">
        <span className="flex items-baseline gap-2">
          {task.priority === "high" && !isDone && (
            <span
              className="shrink-0 font-mono text-[0.62rem] font-bold text-[var(--color-signal)]"
              title="High priority"
            >
              !
            </span>
          )}
          <span
            className={`min-w-0 text-sm ${
              isDone
                ? "text-[var(--fg-faint)] line-through"
                : task.priority === "low"
                  ? "text-[var(--fg-dim)] group-hover:text-[var(--link)]"
                  : "group-hover:text-[var(--link)]"
            }`}
          >
            {task.title}
          </span>
        </span>

        {/* The second line carries only what is true of this task. */}
        {(() => {
          const bits = [
            showLink ? link || "Not linked" : null,
            task.checklist.length ? `${checked}/${task.checklist.length}` : null,
            task.repeat ? `↻ ${REPEAT_LABEL[task.repeat]}` : null,
            task.reminders.length && !isDone ? "📱 Reminder" : null,
            task.notes ? "Notes" : null,
          ].filter(Boolean);
          const status = !isDone && task.status !== "todo";
          if (!bits.length && !status && !(task.progress > 0 && !isDone)) return null;
          return (
            <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--fg-faint)]">
              {status && <StatusMark status={task.status} />}
              {bits.map((b) => (
                <span key={b} className="truncate">
                  {b}
                </span>
              ))}
              {task.progress > 0 && !isDone && (
                <span className="flex items-center gap-2">
                  <Progress value={task.progress} className="w-16" />
                  <span className="tabular-nums">{task.progress}%</span>
                </span>
              )}
            </span>
          );
        })()}
      </button>

      {w && (
        <span
          className={`mt-0.5 shrink-0 font-mono text-[0.6rem] uppercase tracking-[0.12em] ${
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
    </li>
  );
}

// ——— Adding ——————————————————————————————————————————————————————

/**
 * One line and Enter. The date — and on the Tasks page the link and the
 * priority — are there if they matter and ignored if they do not.
 */
export function QuickAdd({
  onAdd,
  links,
  defaultLink = "",
}: {
  onAdd: (input: TaskInput & { title: string }) => Promise<void>;
  /** Given on the Tasks page, where a task can be linked to anything. */
  links?: TaskLinks;
  defaultLink?: string;
}) {
  const [title, setTitle] = useState("");
  const [due, setDue] = useState("");
  const [link, setLink] = useState(defaultLink);
  const [high, setHigh] = useState(false);
  const [busy, setBusy] = useState(false);
  const [full, setFull] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function add() {
    const text = title.trim();
    // A second Enter while the first is still on its way would add it twice.
    if (!text || busy) return;
    setBusy(true);
    setError(null);
    try {
      await onAdd({
        title: text,
        due_on: due || null,
        ...(links ? parseLink(link) : {}),
        ...(high ? { priority: "high" as const } : {}),
      });
      setTitle("");
      setDue("");
      setHigh(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not add it.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
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
        {links && (
          <LinkSelect
            links={links}
            value={link}
            onChange={(l) => setLink(linkValue(l))}
            className="w-auto max-w-64"
          />
        )}
        <input
          type="date"
          className="admin-input w-auto"
          aria-label="Due date (optional)"
          value={due}
          onChange={(e) => setDue(e.target.value)}
        />
        <label className="flex cursor-pointer items-center gap-2 text-xs text-[var(--fg-dim)]">
          <input type="checkbox" checked={high} onChange={(e) => setHigh(e.target.checked)} />
          High
        </label>
        <button
          type="submit"
          disabled={busy || !title.trim()}
          className="bg-[var(--fg)] px-4 py-2 font-mono text-[0.66rem] uppercase tracking-[0.12em] text-[var(--ground)] disabled:opacity-35"
        >
          {busy ? "Adding…" : "Add"}
        </button>
        {/* For a task that needs more than a line: the whole thing at
            once, rather than adding it and opening it again. */}
        <button
          type="button"
          onClick={() => setFull(true)}
          className="px-1 py-2 text-xs text-[var(--fg-dim)] hover:text-[var(--fg)]"
        >
          More…
        </button>
      </form>

      <NewTask
        open={full}
        links={links}
        // Whatever was typed on the line carries over.
        start={{
          title,
          due_on: due || null,
          priority: high ? "high" : "normal",
          ...(links ? parseLink(link) : {}),
        }}
        onClose={() => setFull(false)}
        onAdd={async (input) => {
          await onAdd(input);
          setTitle("");
          setDue("");
          setHigh(false);
          setFull(false);
        }}
      />
      {error && (
        <p role="alert" className="mt-3 text-xs text-[var(--color-signal)]">
          {error}
        </p>
      )}
    </div>
  );
}

/**
 * Which WhatsApp reminders are armed for a task. Needs a due date to
 * count against, so it stays out of the way until one is set.
 */
function ReminderPicker({ value, onChange }: { value: number[]; onChange: (next: number[]) => void }) {
  return (
    <div>
      <FieldLabel>WhatsApp reminder</FieldLabel>
      <div className="mt-2 flex flex-wrap gap-2">
        {REMINDER_PRESETS.map((p) => {
          const on = value.includes(p.minutes);
          return (
            <button
              key={p.minutes}
              type="button"
              aria-pressed={on}
              onClick={() =>
                onChange(on ? value.filter((m) => m !== p.minutes) : [...value, p.minutes])
              }
              className={`border px-2.5 py-1.5 text-xs ${
                on
                  ? "border-[var(--link)] bg-[color-mix(in_oklab,var(--link)_12%,transparent)] text-[var(--link)]"
                  : "border-[var(--hairline)] text-[var(--fg-dim)] hover:border-[var(--fg)] hover:text-[var(--fg)]"
              }`}
            >
              {p.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * A new task with everything filled in at once: the checklist, the
 * notes, the status — rather than adding a line and opening it again to
 * say what it actually involves.
 */
function NewTask({
  open,
  links,
  start,
  onAdd,
  onClose,
}: {
  open: boolean;
  links?: TaskLinks;
  start: TaskInput;
  onAdd: (input: TaskInput & { title: string }) => Promise<void>;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<TaskInput>(start);
  const [list, setList] = useState<{ text: string; done: boolean }[]>([]);
  const [item, setItem] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Opening it picks up whatever was already typed on the line.
  const [wasOpen, setWasOpen] = useState(open);
  if (wasOpen !== open) {
    setWasOpen(open);
    if (open) {
      setDraft(start);
      setList([]);
      setItem("");
      setError(null);
    }
  }

  const set = (change: TaskInput) => setDraft((d) => ({ ...d, ...change }));

  async function submit() {
    const title = draft.title?.trim();
    if (!title || busy) return;
    setBusy(true);
    setError(null);
    try {
      // The half-typed checklist line counts too; losing it on save is
      // the kind of small betrayal that stops people trusting a form.
      const rest = item.trim() ? [...list, { text: item.trim(), done: false }] : list;
      await onAdd({ ...draft, title, checklist: rest.length ? rest : undefined });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not add it.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} label="New task" wide>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <div className="max-h-[calc(100dvh-12rem)] overflow-y-auto px-6 pt-6 pb-5">
          <p className="font-mono text-[0.6rem] uppercase tracking-[0.16em] text-[var(--fg-faint)]">
            New task
          </p>

          <input
            autoFocus
            className="admin-input mt-3 font-display text-lg"
            maxLength={190}
            placeholder="What has to be done"
            aria-label="Task"
            value={draft.title ?? ""}
            onChange={(e) => set({ title: e.target.value })}
            onKeyDown={(e) => {
              // Enter here saves; the checklist has its own field.
              if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                e.preventDefault();
                submit();
              }
            }}
          />

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            {links && (
              <label className="block sm:col-span-2">
                <FieldLabel>Linked to</FieldLabel>
                <LinkSelect
                  links={links}
                  className="mt-2"
                  value={linkValue({
                    client_id: draft.client_id ?? null,
                    engagement_id: draft.engagement_id ?? null,
                  })}
                  onChange={(l) => set(l)}
                />
              </label>
            )}
            <label className="block">
              <FieldLabel>Due</FieldLabel>
              <div className="mt-2 flex gap-2">
                <input
                  type="date"
                  className="admin-input min-w-0 flex-1"
                  value={draft.due_on ?? ""}
                  onChange={(e) => set({ due_on: e.target.value || null })}
                />
                <input
                  type="time"
                  className="admin-input w-28"
                  aria-label="Due time (optional)"
                  value={draft.due_time ?? ""}
                  disabled={!draft.due_on}
                  onChange={(e) => set({ due_time: e.target.value || null })}
                />
              </div>
            </label>
            <label className="block">
              <FieldLabel>Priority</FieldLabel>
              <select
                className="admin-input mt-2"
                value={draft.priority ?? "normal"}
                onChange={(e) => set({ priority: e.target.value as TaskPriority })}
              >
                {TASK_PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {PRIORITY_LABEL[p]}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <FieldLabel>Status</FieldLabel>
              <select
                className="admin-input mt-2"
                value={draft.status ?? "todo"}
                onChange={(e) => set({ status: e.target.value as TaskStatus })}
              >
                {TASK_STATUSES.filter((s) => s !== "done").map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABEL[s]}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <FieldLabel>Repeats</FieldLabel>
              <select
                className="admin-input mt-2"
                value={draft.repeat ?? ""}
                onChange={(e) => set({ repeat: (e.target.value || null) as TaskRepeat | null })}
              >
                <option value="">Does not repeat</option>
                {TASK_REPEATS.map((r) => (
                  <option key={r} value={r}>
                    {REPEAT_LABEL[r]}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="mt-5">
            <FieldLabel>Checklist</FieldLabel>
            {list.length > 0 && (
              <ul className="mt-2 border border-[var(--hairline)]">
                {list.map((it, i) => (
                  <li
                    key={i}
                    className="flex items-center gap-3 border-b border-[var(--hairline)] px-3 py-2 last:border-b-0"
                  >
                    <span className="min-w-0 flex-1 text-sm">{it.text}</span>
                    <button
                      type="button"
                      aria-label={`Remove "${it.text}"`}
                      onClick={() => setList(list.filter((_, j) => j !== i))}
                      className="px-1 text-[var(--fg-faint)] hover:text-[var(--color-signal)]"
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <input
              className="admin-input mt-2"
              maxLength={190}
              placeholder="Add a step — then Enter"
              aria-label="New checklist step"
              value={item}
              onChange={(e) => setItem(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                  // Enter belongs to the checklist while this field has
                  // the cursor, not to the form.
                  e.preventDefault();
                  const text = item.trim();
                  if (!text) return;
                  setList([...list, { text, done: false }]);
                  setItem("");
                }
              }}
            />
          </div>

          <label className="mt-5 block">
            <FieldLabel>Notes</FieldLabel>
            <textarea
              rows={4}
              maxLength={5000}
              className="admin-input mt-2"
              placeholder="Links, details, what was said…"
              value={draft.notes ?? ""}
              onChange={(e) => set({ notes: e.target.value || null })}
            />
          </label>

          {draft.due_on ? (
            <div className="mt-5">
              <ReminderPicker value={draft.reminders ?? []} onChange={(reminders) => set({ reminders })} />
            </div>
          ) : (
            <p className="mt-5 text-xs text-[var(--fg-faint)]">Add a due date to arm a WhatsApp reminder.</p>
          )}

          {error && (
            <p role="alert" className="mt-4 text-xs text-[var(--color-signal)]">
              {error}
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-end gap-3 border-t border-[var(--hairline)] px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm text-[var(--fg-dim)] hover:text-[var(--fg)]"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy || !draft.title?.trim()}
            className="bg-[var(--fg)] px-4 py-2 font-mono text-[0.66rem] uppercase tracking-[0.12em] text-[var(--ground)] disabled:opacity-35"
          >
            {busy ? "Adding…" : "Add task"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ——— The drawer ——————————————————————————————————————————————————

/**
 * Everything about one task, opened from any list. Each field saves when
 * it is left or changed, the same as the tick; there is no Save button to
 * forget.
 */
export function TaskDrawer({
  task,
  links,
  onSaved,
  onDeleted,
  onClose,
}: {
  task: Task | null;
  /** Without links (inside a work) the task cannot be moved elsewhere. */
  links?: TaskLinks;
  onSaved: (task: Task, next: Task | null) => void;
  onDeleted: (task: Task) => void;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const ask = useConfirm();
  const [draft, setDraft] = useState<Task | null>(task);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [newItem, setNewItem] = useState("");

  /*
   * Opening another task replaces the draft; a save from the same task
   * refreshes it. Done while rendering, the way React suggests for state
   * that follows a prop, so the drawer never shows the previous task.
   */
  const [shownTask, setShownTask] = useState(task);
  if (shownTask !== task) {
    setShownTask(task);
    setDraft(task);
    if (task?.id !== shownTask?.id) setError(null);
  }

  useEffect(() => {
    const el = dialog.current;
    if (!el) return;
    if (task && !el.open) el.showModal();
    if (!task && el.open) el.close();
  }, [task]);

  async function save(change: TaskInput) {
    if (!task) return;
    setSaving(true);
    setError(null);
    try {
      const { task: saved, next } = await admin.updateTask(task.id, change);
      onSaved(saved, next);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save that.");
      setDraft(task);
    } finally {
      setSaving(false);
    }
  }

  const set = (change: Partial<Task>) => setDraft((d) => (d ? { ...d, ...change } : d));

  async function remove() {
    if (!task) return;
    if (
      !(await ask({
        title: `Delete "${task.title}"?`,
        body: task.done_at
          ? undefined
          : "It is not done yet. Marking it done keeps a record; deleting does not.",
        confirmLabel: "Delete",
        tone: "danger",
      }))
    ) {
      return;
    }
    try {
      await admin.removeTask(task.id);
      onDeleted(task);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not delete it.");
    }
  }

  const list = draft?.checklist ?? [];
  const setList = (next: Task["checklist"]) => {
    set({ checklist: next });
    save({ checklist: next });
  };

  return (
    <dialog
      ref={dialog}
      aria-labelledby="task-title"
      // Same reason as the confirm dialog: Chrome does not always fire
      // "cancel" for Escape.
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
      className="fixed inset-y-0 right-0 left-auto m-0 h-dvh max-h-dvh w-[min(34rem,100vw)] max-w-none border-l border-[var(--hairline)] bg-[var(--panel)] p-0 text-[var(--fg)] shadow-[0_0_60px_-20px_rgb(0_0_0/0.45)] backdrop:bg-[color-mix(in_oklab,var(--ground)_55%,black_45%)] backdrop:backdrop-blur-[2px]"
    >
      {task && draft && draft.id === task.id && (
        <div className="flex h-full flex-col">
          <header className="flex items-center justify-between gap-3 border-b border-[var(--hairline)] px-6 py-3.5">
            <p className="font-mono text-[0.6rem] uppercase tracking-[0.16em] text-[var(--fg-faint)]">
              {saving ? "Saving…" : task.done_at ? "Done" : "Task"}
            </p>
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={remove}
                className="text-xs text-[var(--fg-faint)] hover:text-[var(--color-signal)]"
              >
                Delete
              </button>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="px-1 text-lg leading-none text-[var(--fg-dim)] hover:text-[var(--fg)]"
              >
                ×
              </button>
            </div>
          </header>

          <div className="flex-1 space-y-6 overflow-y-auto px-6 py-6">
            <textarea
              id="task-title"
              rows={2}
              maxLength={190}
              className="w-full resize-none bg-transparent font-display text-xl font-semibold leading-snug outline-none"
              aria-label="Task"
              value={draft.title}
              onChange={(e) => set({ title: e.target.value.replace(/\n/g, " ") })}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  e.currentTarget.blur();
                }
              }}
              onBlur={() => {
                const t = draft.title.trim();
                if (!t) set({ title: task.title });
                else if (t !== task.title) save({ title: t });
              }}
            />

            {error && (
              <p role="alert" className="text-xs text-[var(--color-signal)]">
                {error}
              </p>
            )}

            {/* Status: four steps, one click each. */}
            <fieldset>
              <legend className="font-mono text-[0.6rem] uppercase tracking-[0.14em] text-[var(--fg-faint)]">
                Status
              </legend>
              <div className="mt-2 grid grid-cols-4 border border-[var(--hairline)]">
                {TASK_STATUSES.map((s) => (
                  <button
                    key={s}
                    type="button"
                    title={STATUS_HINT[s]}
                    aria-pressed={draft.status === s}
                    onClick={() => {
                      if (s === draft.status) return;
                      set({ status: s });
                      save({ status: s });
                    }}
                    className={`border-r border-[var(--hairline)] px-2 py-2 text-xs last:border-r-0 ${
                      draft.status === s
                        ? "bg-[var(--fg)] text-[var(--ground)]"
                        : "text-[var(--fg-dim)] hover:text-[var(--fg)]"
                    }`}
                  >
                    {STATUS_LABEL[s]}
                  </button>
                ))}
              </div>
              <p className="mt-1.5 text-xs text-[var(--fg-faint)]">{STATUS_HINT[draft.status]}</p>
            </fieldset>

            {/* Progress: counted from the checklist when there is one,
              set by hand when there is not. */}
            <div>
              <div className="flex items-baseline justify-between">
                <label
                  htmlFor="task-progress"
                  className="font-mono text-[0.6rem] uppercase tracking-[0.14em] text-[var(--fg-faint)]"
                >
                  Progress
                </label>
                <span className="text-sm tabular-nums">{draft.progress}%</span>
              </div>
              {list.length ? (
                <>
                  <Progress value={draft.progress} className="mt-2" />
                  <p className="mt-1.5 text-xs text-[var(--fg-faint)]">
                    Counted from the checklist below.
                  </p>
                </>
              ) : (
                <input
                  id="task-progress"
                  type="range"
                  min={0}
                  max={100}
                  step={10}
                  className="mt-2 w-full accent-[var(--link)]"
                  value={draft.progress}
                  onChange={(e) => set({ progress: Number(e.target.value) })}
                  onPointerUp={() => commitProgress()}
                  onKeyUp={() => commitProgress()}
                />
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="font-mono text-[0.6rem] uppercase tracking-[0.14em] text-[var(--fg-faint)]">
                  Due
                </span>
                <div className="mt-2 flex gap-2">
                  <input
                    type="date"
                    className="admin-input min-w-0 flex-1"
                    value={draft.due_on ?? ""}
                    onChange={(e) => {
                      const due_on = e.target.value || null;
                      set({ due_on });
                      save({ due_on });
                    }}
                  />
                  <input
                    type="time"
                    className="admin-input w-28"
                    aria-label="Due time (optional)"
                    disabled={!draft.due_on}
                    value={draft.due_time ?? ""}
                    onChange={(e) => {
                      const due_time = e.target.value || null;
                      set({ due_time });
                      save({ due_time });
                    }}
                  />
                </div>
              </label>
              <label className="block">
                <span className="font-mono text-[0.6rem] uppercase tracking-[0.14em] text-[var(--fg-faint)]">
                  Priority
                </span>
                <select
                  className="admin-input mt-2"
                  value={draft.priority}
                  onChange={(e) => {
                    const priority = e.target.value as TaskPriority;
                    set({ priority });
                    save({ priority });
                  }}
                >
                  {TASK_PRIORITIES.map((p) => (
                    <option key={p} value={p}>
                      {PRIORITY_LABEL[p]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="font-mono text-[0.6rem] uppercase tracking-[0.14em] text-[var(--fg-faint)]">
                  Repeats
                </span>
                <select
                  className="admin-input mt-2"
                  value={draft.repeat ?? ""}
                  onChange={(e) => {
                    const repeat = (e.target.value || null) as TaskRepeat | null;
                    set({ repeat });
                    save({ repeat });
                  }}
                >
                  <option value="">Does not repeat</option>
                  {TASK_REPEATS.map((r) => (
                    <option key={r} value={r}>
                      {REPEAT_LABEL[r]}
                    </option>
                  ))}
                </select>
              </label>
              {links && (
                <label className="block">
                  <span className="font-mono text-[0.6rem] uppercase tracking-[0.14em] text-[var(--fg-faint)]">
                    Linked to
                  </span>
                  <LinkSelect
                    links={links}
                    className="mt-2"
                    value={linkValue(draft)}
                    current={
                      draft.engagement_id && draft.work
                        ? { id: draft.engagement_id, title: draft.work }
                        : null
                    }
                    onChange={(l) => {
                      set(l);
                      save(l);
                    }}
                  />
                </label>
              )}
            </div>
            {draft.repeat && (
              <p className="-mt-3 text-xs text-[var(--fg-faint)]">
                When it is marked done, the next one is added with its new date.
              </p>
            )}

            {/* The checklist: the steps inside one task. */}
            <div>
              <p className="font-mono text-[0.6rem] uppercase tracking-[0.14em] text-[var(--fg-faint)]">
                Checklist
              </p>
              {list.length > 0 && (
                <ul className="mt-2 border border-[var(--hairline)]">
                  {list.map((item, i) => (
                    <li
                      key={i}
                      className="flex items-center gap-3 border-b border-[var(--hairline)] px-3 py-2 last:border-b-0"
                    >
                      <input
                        type="checkbox"
                        checked={item.done}
                        aria-label={`Mark "${item.text}" as ${item.done ? "not done" : "done"}`}
                        onChange={() =>
                          setList(list.map((it, j) => (j === i ? { ...it, done: !it.done } : it)))
                        }
                      />
                      <span
                        className={`min-w-0 flex-1 text-sm ${item.done ? "text-[var(--fg-faint)] line-through" : ""}`}
                      >
                        {item.text}
                      </span>
                      <button
                        type="button"
                        aria-label={`Remove "${item.text}"`}
                        onClick={() => setList(list.filter((_, j) => j !== i))}
                        className="px-1 text-[var(--fg-faint)] hover:text-[var(--color-signal)]"
                      >
                        ×
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <input
                className="admin-input mt-2"
                maxLength={190}
                placeholder="Add a step — then Enter"
                aria-label="New checklist step"
                value={newItem}
                onChange={(e) => setNewItem(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                    e.preventDefault();
                    const text = newItem.trim();
                    if (!text) return;
                    setList([...list, { text, done: false }]);
                    setNewItem("");
                  }
                }}
              />
            </div>

            {draft.due_on ? (
              <ReminderPicker
                value={draft.reminders}
                onChange={(reminders) => {
                  set({ reminders });
                  save({ reminders });
                }}
              />
            ) : (
              <p className="text-xs text-[var(--fg-faint)]">Add a due date to arm a WhatsApp reminder.</p>
            )}

            <label className="block">
              <span className="font-mono text-[0.6rem] uppercase tracking-[0.14em] text-[var(--fg-faint)]">
                Notes
              </span>
              <textarea
                rows={5}
                maxLength={5000}
                className="admin-input mt-2"
                placeholder="Links, details, what was said…"
                value={draft.notes ?? ""}
                onChange={(e) => set({ notes: e.target.value })}
                onBlur={() => {
                  const notes = draft.notes?.trim() || null;
                  if (notes !== (task.notes ?? null)) save({ notes });
                }}
              />
            </label>

            <p className="text-xs text-[var(--fg-faint)]">
              Added{" "}
              {new Date(task.created_at).toLocaleDateString("en-GB", {
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
              {task.done_at &&
                ` · done ${new Date(task.done_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`}
            </p>
          </div>
        </div>
      )}
    </dialog>
  );

  function commitProgress() {
    if (!task || !draft || draft.progress === task.progress) return;
    // Moving the bar off zero means it has been started.
    const change: TaskInput = { progress: draft.progress };
    if (draft.status === "todo" && draft.progress > 0) {
      change.status = "doing";
      set({ status: "doing" });
    }
    save(change);
  }
}

// ——— Inside a piece of work ——————————————————————————————————————

export function Tasks({
  engagement,
  onChanged,
}: {
  engagement: Engagement;
  onChanged: (next: Engagement) => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [showDone, setShowDone] = useState(false);
  const [openId, setOpenId] = useState<number | null>(null);

  const tasks = sortTasks(engagement.tasks);
  const open = tasks.filter((t) => !t.done_at);
  const done = tasks.filter((t) => t.done_at);
  const opened = tasks.find((t) => t.id === openId) ?? null;

  const put = (next: Task[]) => onChanged({ ...engagement, tasks: sortTasks(next) });
  const upsert = (list: Task[], task: Task) =>
    list.some((t) => t.id === task.id)
      ? list.map((t) => (t.id === task.id ? task : t))
      : [...list, task];

  /** A task moved to another work or client leaves this list. */
  const saved = (task: Task, next: Task | null) => {
    let list = engagement.tasks;
    list =
      task.engagement_id === engagement.id
        ? upsert(list, task)
        : list.filter((t) => t.id !== task.id);
    if (next && next.engagement_id === engagement.id) list = upsert(list, next);
    put(list);
    if (task.engagement_id !== engagement.id) setOpenId(null);
  };

  /*
   * The tick answers the click, not the network: it flips at once and is
   * put back only if the save fails. A checkbox that waits a second on a
   * slow connection feels broken.
   */
  async function toggle(task: Task) {
    const flipped: Task = task.done_at
      ? { ...task, done_at: null, status: "todo" }
      : { ...task, done_at: new Date().toISOString(), status: "done" };
    put(upsert(engagement.tasks, flipped));
    try {
      const { task: t, next } = await admin.updateTask(task.id, { done: !task.done_at });
      saved(t, next);
    } catch (e) {
      put(upsert(engagement.tasks, task));
      setError(e instanceof Error ? e.message : "Could not save that.");
    }
  }

  return (
    <div>
      <QuickAdd
        onAdd={async (input) => {
          const task = await admin.createTask(engagement.id, input);
          put([...engagement.tasks, task]);
        }}
      />
      {/* A whole job's worth of steps at once, and the reverse: this
          job's steps kept for the next one like it. */}
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <UseTemplate
          engagement={engagement}
          onApplied={(made) => put([...engagement.tasks, ...made])}
        />
        {engagement.tasks.length > 0 && <SaveAsTemplate engagement={engagement} />}
      </div>

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
                <TaskRow
                  key={task.id}
                  task={task}
                  onToggle={() => toggle(task)}
                  onOpen={() => setOpenId(task.id)}
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
                    <TaskRow
                      key={task.id}
                      task={task}
                      onToggle={() => toggle(task)}
                      onOpen={() => setOpenId(task.id)}
                    />
                  ))}
                </ul>
              )}
            </div>
          )}
        </>
      )}

      <TaskDrawer
        task={opened}
        onSaved={saved}
        onDeleted={(task) => {
          setOpenId(null);
          put(engagement.tasks.filter((t) => t.id !== task.id));
        }}
        onClose={() => setOpenId(null)}
      />
    </div>
  );
}
