"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { useConfirm } from "@/components/admin/confirm";
import { PageSkeleton, RowsSkeleton } from "@/components/admin/skeleton";
import { UseTemplate } from "@/components/admin/task-templates";
import {
  daysUntil,
  linkLabel,
  Progress,
  QuickAdd,
  REPEAT_LABEL,
  sortTasks,
  STATUS_LABEL,
  TaskDrawer,
  TaskRow,
  when,
} from "@/components/admin/tasks";
import {
  admin,
  isSignedOut,
  TASK_STATUSES,
  type Task,
  type TaskLinks,
  type TaskStatus,
} from "@/lib/admin/client";

/**
 * Every task in one place: the ones inside a piece of work, the ones about
 * a client, and the ones that belong to nobody ("read today's email").
 *
 * Two ways to look at the same list. The list answers "what is next", in
 * date order, grouped by how soon. The board answers "where is everything",
 * by status, and a card is dragged from one column to the next.
 */

type View = "list" | "board";

const VIEW_KEY = "jx.tasks.view";

/** Buckets for the list, in the order they are read. */
const GROUPS = [
  { key: "late", title: "Late" },
  { key: "today", title: "Today" },
  { key: "week", title: "This week" },
  { key: "later", title: "Later" },
  { key: "someday", title: "Some day", hint: "No date" },
] as const;

type GroupKey = (typeof GROUPS)[number]["key"];

function bucket(task: Task): GroupKey {
  if (!task.due_on) return "someday";
  const d = daysUntil(task.due_on);
  if (d < 0) return "late";
  if (d === 0) return "today";
  if (d <= 7) return "week";
  return "later";
}

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[] | null>(null);
  const [links, setLinks] = useState<TaskLinks>([]);
  const [error, setError] = useState<string | null>(null);
  /** A save that failed after the page loaded; the page itself stays. */
  const [notice, setNotice] = useState<string | null>(null);
  const [view, setView] = useState<View>("list");
  const [filter, setFilter] = useState("all");
  const [q, setQ] = useState("");
  const [showDone, setShowDone] = useState(false);
  const [openId, setOpenId] = useState<number | null>(null);
  /** Rows picked out for one change to all of them. */
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const [picking, setPicking] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);
  /** Where the last pick was, so shift-click can take the run between. */
  const lastPicked = useRef<number | null>(null);
  const ask = useConfirm();

  useEffect(() => {
    let live = true;
    admin.tasks().then(
      (r) => {
        if (!live) return;
        // The view chosen last time, read once the page is in the browser.
        try {
          const saved = localStorage.getItem(VIEW_KEY);
          if (saved === "list" || saved === "board") setView(saved);
        } catch {
          // No storage (private window): the list is the default anyway.
        }
        setTasks(r.data);
        setLinks(r.links);
      },
      (e) => live && !isSignedOut(e) && setError(e.message)
    );
    return () => {
      live = false;
    };
  }, []);

  const choose = (next: View) => {
    setView(next);
    try {
      localStorage.setItem(VIEW_KEY, next);
    } catch {
      // Remembering the choice is a convenience, not a requirement.
    }
  };

  const shown = useMemo(() => {
    if (!tasks) return [];
    const needle = q.trim().toLowerCase();
    return sortTasks(
      tasks.filter((t) => {
        if (filter === "none" && (t.client_id || t.engagement_id)) return false;
        if (filter === "high" && t.priority !== "high") return false;
        if (filter.startsWith("c:") && t.client_id !== Number(filter.slice(2))) return false;
        if (!needle) return true;
        return [t.title, t.notes, t.client, t.work].some((s) => s?.toLowerCase().includes(needle));
      })
    );
  }, [tasks, filter, q]);

  if (error) {
    return (
      <p role="alert" className="text-sm text-[var(--color-signal)]">
        {error}
      </p>
    );
  }

  if (!tasks) {
    return (
      <PageSkeleton>
        <RowsSkeleton rows={6} />
      </PageSkeleton>
    );
  }

  const put = (task: Task) =>
    setTasks((list) =>
      list
        ? list.some((t) => t.id === task.id)
          ? list.map((t) => (t.id === task.id ? task : t))
          : [...list, task]
        : list
    );

  const saved = (task: Task, next: Task | null) => {
    put(task);
    if (next) put(next);
  };

  /** Flip at once, put back if the save fails. */
  async function change(task: Task, status: TaskStatus) {
    if (task.status === status) return;
    setNotice(null);
    put({
      ...task,
      status,
      done_at: status === "done" ? (task.done_at ?? new Date().toISOString()) : null,
      progress: status === "done" && !task.checklist.length ? 100 : task.progress,
    });
    try {
      const { task: t, next } = await admin.updateTask(task.id, { status });
      saved(t, next);
    } catch (e) {
      put(task);
      setNotice(e instanceof Error ? e.message : "Could not save that.");
    }
  }

  /**
   * The rows in the order they are shown, which shift-click runs along
   * and "select all" takes. Finished ones only while they are on screen:
   * nothing can be picked that cannot be seen.
   */
  const inOrder = [
    ...GROUPS.flatMap((g) => shown.filter((t) => !t.done_at && bucket(t) === g.key)),
    ...(showDone ? shown.filter((t) => t.done_at) : []),
  ];

  function pick(task: Task, event: React.MouseEvent | React.ChangeEvent) {
    const at = inOrder.findIndex((t) => t.id === task.id);
    const from = lastPicked.current;
    const shift = "shiftKey" in event && event.shiftKey;
    const span =
      shift && from !== null && from !== -1 && at !== -1
        ? inOrder.slice(Math.min(from, at), Math.max(from, at) + 1)
        : [task];
    setPicked((s) => {
      const next = new Set(s);
      // The click decides the direction; the run follows it.
      const turningOn = !next.has(task.id);
      for (const t of span) {
        if (turningOn) next.add(t.id);
        else next.delete(t.id);
      }
      return next;
    });
    lastPicked.current = at;
  }

  /** delete, done or undone, applied to everything picked, in one request. */
  async function apply(action: "delete" | "done" | "undone") {
    const ids = inOrder.filter((t) => picked.has(t.id)).map((t) => t.id);
    if (!ids.length) return;
    if (
      action === "delete" &&
      !(await ask({
        title: `Delete ${ids.length} ${ids.length === 1 ? "task" : "tasks"}?`,
        body: "Marking them done keeps a record; deleting does not.",
        confirmLabel: `Delete ${ids.length}`,
        tone: "danger",
      }))
    ) {
      return;
    }
    setNotice(null);
    setBulkBusy(true);
    try {
      const r = await admin.bulkTasks(ids, action);
      setTasks((list) => {
        const gone = new Set(r.deleted);
        const changed = new Map([...r.data, ...r.next].map((t) => [t.id, t]));
        const kept = (list ?? []).filter((t) => !gone.has(t.id)).map((t) => changed.get(t.id) ?? t);
        // A repeating task that was ticked brings its next one along.
        const added = r.next.filter((t) => !(list ?? []).some((x) => x.id === t.id));
        return [...kept, ...added];
      });
      setPicked(new Set());
      lastPicked.current = null;
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Could not do that.");
    } finally {
      setBulkBusy(false);
    }
  }

  const open = shown.filter((t) => !t.done_at);
  const done = shown.filter((t) => t.done_at);
  const all = tasks.filter((t) => !t.done_at);
  const late = all.filter((t) => t.due_on && daysUntil(t.due_on) < 0).length;
  const waiting = all.filter((t) => t.status === "waiting").length;
  const doing = all.filter((t) => t.status === "doing").length;
  const opened = tasks.find((t) => t.id === openId) ?? null;

  return (
    <div className="w-full">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight">Tasks</h1>
          <p className="mt-2 text-sm text-[var(--fg-dim)]">
            {all.length === 0
              ? "Nothing open."
              : [
                  `${all.length} open`,
                  doing ? `${doing} in progress` : null,
                  waiting ? `${waiting} waiting on someone` : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
            {late > 0 && <span className="text-[var(--color-signal)]"> · {late} late</span>}
          </p>
        </div>
        <div className="flex border border-[var(--hairline)]" role="group" aria-label="View">
          {(["list", "board"] as const).map((v) => (
            <button
              key={v}
              type="button"
              aria-pressed={view === v}
              onClick={() => choose(v)}
              className={`px-4 py-2 font-mono text-[0.62rem] uppercase tracking-[0.14em] ${
                view === v
                  ? "bg-[var(--fg)] text-[var(--ground)]"
                  : "text-[var(--fg-dim)] hover:text-[var(--fg)]"
              }`}
            >
              {v === "list" ? "List" : "Board"}
            </button>
          ))}
        </div>
      </header>

      <div className="mt-8">
        <QuickAdd
          links={links}
          onAdd={async (input) => {
            const task = await admin.createTask(null, input);
            put(task);
          }}
        />
        <div className="mt-3">
          <UseTemplate
            links={links}
            onApplied={(made) => setTasks((list) => [...(list ?? []), ...made])}
          />
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-[var(--hairline)] pt-5">
        <input
          type="search"
          className="admin-input w-auto min-w-0 flex-1 basis-48 sm:max-w-72"
          placeholder="Search tasks"
          aria-label="Search tasks"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select
          className="admin-input w-auto"
          aria-label="Show"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          <option value="all">Everything</option>
          <option value="high">High priority</option>
          <option value="none">Not linked to a client</option>
          {links.length > 0 && (
            <optgroup label="One client">
              {links.map((c) => (
                <option key={c.id} value={`c:${c.id}`}>
                  {c.name}
                </option>
              ))}
            </optgroup>
          )}
        </select>
        {view === "list" && (
          <button
            type="button"
            aria-pressed={picking}
            onClick={() => {
              setPicking((v) => !v);
              setPicked(new Set());
              lastPicked.current = null;
            }}
            className={`border px-3 py-2 font-mono text-[0.62rem] uppercase tracking-[0.12em] ${
              picking
                ? "border-[var(--fg)] bg-[var(--fg)] text-[var(--ground)]"
                : "border-[var(--hairline)] text-[var(--fg-dim)] hover:border-[var(--fg)] hover:text-[var(--fg)]"
            }`}
          >
            {picking ? "Done selecting" : "Select"}
          </button>
        )}
        {(q || filter !== "all") && (
          <button
            type="button"
            onClick={() => {
              setQ("");
              setFilter("all");
            }}
            className="text-xs text-[var(--link)]"
          >
            Clear
          </button>
        )}
      </div>

      {notice && (
        <p role="alert" className="mt-4 text-xs text-[var(--color-signal)]">
          {notice}
        </p>
      )}

      {picking && view === "list" && (
        /* Sticky, because a selection made at the bottom of a long list
           still needs its buttons. */
        <div className="sticky top-0 z-10 mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 border border-[var(--hairline)] bg-[var(--panel)] px-4 py-3">
          <span className="font-mono text-[0.62rem] uppercase tracking-[0.12em]">
            {picked.size} selected
          </span>
          <button
            type="button"
            onClick={() => {
              setPicked(new Set(inOrder.map((t) => t.id)));
              lastPicked.current = null;
            }}
            className="text-xs text-[var(--link)] hover:underline"
          >
            Select all {inOrder.length}
          </button>
          {picked.size > 0 && (
            <>
              <button
                type="button"
                disabled={bulkBusy}
                onClick={() => apply("done")}
                className="text-xs text-[var(--fg-dim)] hover:text-[var(--fg)] disabled:opacity-40"
              >
                Mark done
              </button>
              <button
                type="button"
                disabled={bulkBusy}
                onClick={() => apply("undone")}
                className="text-xs text-[var(--fg-dim)] hover:text-[var(--fg)] disabled:opacity-40"
              >
                Mark not done
              </button>
              <button
                type="button"
                disabled={bulkBusy}
                onClick={() => apply("delete")}
                className="text-xs text-[var(--fg-dim)] hover:text-[var(--color-signal)] disabled:opacity-40"
              >
                {bulkBusy ? "Working…" : "Delete"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setPicked(new Set());
                  lastPicked.current = null;
                }}
                className="text-xs text-[var(--fg-faint)] hover:text-[var(--fg)]"
              >
                Clear
              </button>
            </>
          )}
          <span className="ml-auto hidden text-xs text-[var(--fg-faint)] sm:block">
            Shift-click to take a run of them
          </span>
        </div>
      )}

      {view === "list" ? (
        <ListView
          open={open}
          done={done}
          showDone={showDone}
          setShowDone={setShowDone}
          filtered={!!q || filter !== "all"}
          picked={picking ? picked : null}
          onPick={pick}
          onToggle={(t) => change(t, t.done_at ? "todo" : "done")}
          onOpen={(t) => setOpenId(t.id)}
        />
      ) : (
        <BoardView tasks={shown} onMove={change} onOpen={(t) => setOpenId(t.id)} />
      )}

      <TaskDrawer
        task={opened}
        links={links}
        onSaved={saved}
        onDeleted={(task) => {
          setOpenId(null);
          setTasks((list) => list?.filter((t) => t.id !== task.id) ?? list);
        }}
        onClose={() => setOpenId(null)}
      />
    </div>
  );
}

function ListView({
  open,
  done,
  showDone,
  setShowDone,
  filtered,
  picked,
  onPick,
  onToggle,
  onOpen,
}: {
  open: Task[];
  done: Task[];
  showDone: boolean;
  setShowDone: (fn: (v: boolean) => boolean) => void;
  filtered: boolean;
  /** The picked ids while a selection is being made, null otherwise. */
  picked: Set<number> | null;
  onPick: (t: Task, event: React.MouseEvent | React.ChangeEvent) => void;
  onToggle: (t: Task) => void;
  onOpen: (t: Task) => void;
}) {
  if (open.length === 0 && done.length === 0) {
    return (
      <p className="mt-8 border border-dashed border-[var(--hairline)] px-5 py-12 text-center text-sm text-[var(--fg-faint)]">
        {filtered ? "No task matches that." : "Nothing to do. Add the first one above."}
      </p>
    );
  }

  return (
    <div className="mt-8 space-y-8">
      {open.length === 0 && (
        <p className="text-sm text-[var(--fg-dim)]">Everything here is done.</p>
      )}
      {GROUPS.map((g) => {
        const rows = open.filter((t) => bucket(t) === g.key);
        if (!rows.length) return null;
        return (
          <section key={g.key}>
            <h2
              className={`flex items-baseline gap-3 font-mono text-[0.62rem] uppercase tracking-[0.14em] ${
                g.key === "late" ? "text-[var(--color-signal)]" : "text-[var(--fg-dim)]"
              }`}
            >
              {g.title}
              <span className="text-[var(--fg-faint)]">{rows.length}</span>
              {"hint" in g && <span className="normal-case tracking-normal text-[var(--fg-faint)]">{g.hint}</span>}
            </h2>
            <ul className="mt-3 border border-[var(--hairline)] bg-[var(--panel)]">
              {rows.map((t) => (
                <TaskRow
                  key={t.id}
                  task={t}
                  showLink
                  selected={picked?.has(t.id)}
                  onSelect={picked ? (e) => onPick(t, e) : undefined}
                  onToggle={() => onToggle(t)}
                  onOpen={() => onOpen(t)}
                />
              ))}
            </ul>
          </section>
        );
      })}

      {done.length > 0 && (
        <section>
          <button
            type="button"
            onClick={() => setShowDone((v) => !v)}
            aria-expanded={showDone}
            className="font-mono text-[0.62rem] uppercase tracking-[0.14em] text-[var(--fg-faint)] hover:text-[var(--fg)]"
          >
            {showDone ? "Hide" : "Show"} done in the last 30 days ({done.length})
          </button>
          {showDone && (
            <ul className="mt-3 border border-[var(--hairline)] bg-[var(--panel)]">
              {done.map((t) => (
                <TaskRow
                  key={t.id}
                  task={t}
                  showLink
                  selected={picked?.has(t.id)}
                  onSelect={picked ? (e) => onPick(t, e) : undefined}
                  onToggle={() => onToggle(t)}
                  onOpen={() => onOpen(t)}
                />
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}

/**
 * Four columns, one per status. A card is dragged to change it; on a
 * phone, where dragging does not work, the card opens and the status is
 * one tap in the drawer.
 */
function BoardView({
  tasks,
  onMove,
  onOpen,
}: {
  tasks: Task[];
  onMove: (t: Task, status: TaskStatus) => void;
  onOpen: (t: Task) => void;
}) {
  const [over, setOver] = useState<TaskStatus | null>(null);
  const [dragging, setDragging] = useState<number | null>(null);

  return (
    <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {TASK_STATUSES.map((status) => {
        const cards = tasks.filter((t) => t.status === status);
        return (
          <section
            key={status}
            aria-label={STATUS_LABEL[status]}
            onDragOver={(e) => {
              if (dragging === null) return;
              e.preventDefault();
              e.dataTransfer.dropEffect = "move";
              setOver(status);
            }}
            onDragLeave={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOver(null);
            }}
            onDrop={(e) => {
              e.preventDefault();
              setOver(null);
              const task = tasks.find((t) => t.id === dragging);
              if (task) onMove(task, status);
              setDragging(null);
            }}
            className={`flex min-h-40 flex-col border bg-[var(--panel)] transition-colors ${
              over === status
                ? "border-[var(--link)] bg-[color-mix(in_oklab,var(--link)_6%,var(--panel))]"
                : "border-[var(--hairline)]"
            }`}
          >
            <header className="flex items-baseline justify-between border-b border-[var(--hairline)] px-4 py-3">
              <h2 className="font-mono text-[0.62rem] uppercase tracking-[0.14em]">{STATUS_LABEL[status]}</h2>
              <span className="text-xs tabular-nums text-[var(--fg-faint)]">{cards.length}</span>
            </header>
            <ul className="flex flex-1 flex-col gap-2 p-2">
              {cards.map((t) => (
                <Card
                  key={t.id}
                  task={t}
                  dragging={dragging === t.id}
                  onDragStart={() => setDragging(t.id)}
                  onDragEnd={() => {
                    setDragging(null);
                    setOver(null);
                  }}
                  onOpen={() => onOpen(t)}
                />
              ))}
              {cards.length === 0 && (
                <li className="flex flex-1 items-center justify-center px-3 py-6 text-center text-xs text-[var(--fg-faint)]">
                  {status === "done" ? "Nothing finished this month" : "Empty"}
                </li>
              )}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

function Card({
  task,
  dragging,
  onDragStart,
  onDragEnd,
  onOpen,
}: {
  task: Task;
  dragging: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
  onOpen: () => void;
}) {
  const isDone = !!task.done_at;
  const w = task.due_on && !isDone ? when(task.due_on) : null;
  const link = linkLabel(task);
  const checked = task.checklist.filter((i) => i.done).length;

  return (
    <li
      draggable
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", String(task.id));
        onDragStart();
      }}
      onDragEnd={onDragEnd}
      className={`cursor-grab border border-[var(--hairline)] bg-[var(--ground)] active:cursor-grabbing ${
        dragging ? "opacity-40" : ""
      } ${task.priority === "high" && !isDone ? "border-l-2 border-l-[var(--color-signal)]" : ""}`}
    >
      <button type="button" onClick={onOpen} className="block w-full px-3 py-2.5 text-left">
        <span
          className={`block text-sm leading-snug ${
            isDone ? "text-[var(--fg-faint)] line-through" : "hover:text-[var(--link)]"
          }`}
        >
          {task.title}
        </span>
        <span className="mt-1 block truncate text-xs text-[var(--fg-faint)]">{link || "Not linked"}</span>
        {task.progress > 0 && !isDone && (
          <span className="mt-2 flex items-center gap-2 text-xs text-[var(--fg-faint)]">
            <Progress value={task.progress} className="flex-1" />
            <span className="tabular-nums">{task.progress}%</span>
          </span>
        )}
        {(w || task.checklist.length > 0 || task.repeat) && (
          <span className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--fg-faint)]">
            {w && (
              <span
                className={`font-mono text-[0.58rem] uppercase tracking-[0.12em] ${
                  w.late ? "text-[var(--color-signal)]" : w.soon ? "text-[var(--link)]" : ""
                }`}
              >
                {w.label}
              </span>
            )}
            {task.checklist.length > 0 && (
              <span>
                {checked}/{task.checklist.length}
              </span>
            )}
            {task.repeat && <span>↻ {REPEAT_LABEL[task.repeat]}</span>}
          </span>
        )}
      </button>
    </li>
  );
}
