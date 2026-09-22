"use client";

import { useState } from "react";

import { FieldLabel as Label, Modal } from "@/components/admin/modal";
import { LinkSelect, today } from "@/components/admin/tasks";
import {
  admin,
  type Engagement,
  type Task,
  type TaskLinks,
  type TaskTemplate,
} from "@/lib/admin/client";

/**
 * Using a template, and making one.
 *
 * Using one is a preview before anything is written: pick the template,
 * pick the day the job starts, see every step with the date it will get,
 * untick the ones this job does not need, then add them. Making one takes
 * the tasks of a job that went well and keeps them for the next.
 */

const addDays = (iso: string, days: number) => {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + days);
  return d;
};

const short = (d: Date) => d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });

/**
 * "From a template". Inside a work the link is that work; on the Tasks
 * page it is chosen here.
 */
export function UseTemplate({
  engagement,
  links,
  onApplied,
}: {
  engagement?: Engagement;
  links?: TaskLinks;
  onApplied: (tasks: Task[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [templates, setTemplates] = useState<TaskTemplate[] | null>(null);
  const [chosen, setChosen] = useState<number | null>(null);
  const [start, setStart] = useState(today());
  const [skip, setSkip] = useState<Set<number>>(new Set());
  const [link, setLink] = useState<{ client_id: number | null; engagement_id: number | null }>({
    client_id: null,
    engagement_id: null,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Templates for the kinds of work this job is come first.
  const typeIds = new Set(engagement?.work_types.map((t) => t.id) ?? []);
  const ordered = templates
    ? [...templates].sort(
        (a, b) =>
          Number(typeIds.has(b.work_type_id ?? -1)) - Number(typeIds.has(a.work_type_id ?? -1)),
      )
    : [];
  const template = ordered.find((t) => t.id === chosen) ?? null;
  const count = template ? template.items.length - skip.size : 0;

  async function show() {
    setOpen(true);
    setError(null);
    setSkip(new Set());
    setStart(today());
    try {
      const list = templates ?? (await admin.taskTemplates());
      setTemplates(list);
      const suggested = list.find((t) => typeIds.has(t.work_type_id ?? -1)) ?? list[0];
      setChosen(suggested?.id ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load the templates.");
    }
  }

  async function apply() {
    if (!template || busy) return;
    setBusy(true);
    setError(null);
    try {
      const made = await admin.applyTaskTemplate(template.id, {
        ...(engagement ? { engagement_id: engagement.id } : link),
        start_on: start,
        skip: [...skip],
      });
      onApplied(made);
      setOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not add them.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={show}
        className="border border-[var(--hairline)] px-3 py-2 font-mono text-[0.62rem] uppercase tracking-[0.12em] text-[var(--fg-dim)] hover:border-[var(--fg)] hover:text-[var(--fg)]"
      >
        From a template
      </button>

      <Modal open={open} onClose={() => setOpen(false)} label="Add tasks from a template" wide>
        <div className="px-6 pt-6 pb-5">
          <p className="font-mono text-[0.6rem] uppercase tracking-[0.16em] text-[var(--fg-faint)]">
            From a template
          </p>
          <h2 className="mt-2 font-display text-xl font-semibold">
            {engagement ? `Add steps to “${engagement.title}”` : "Add a set of tasks"}
          </h2>

          {!templates && !error && <p className="mt-6 text-sm text-[var(--fg-faint)]">Loading…</p>}

          {templates && templates.length === 0 && (
            <p className="mt-6 text-sm text-[var(--fg-dim)]">
              No templates yet. Make one in Settings → Task templates, or save the tasks of a work
              as one.
            </p>
          )}

          {templates && templates.length > 0 && (
            <div className="mt-6 space-y-5">
              <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
                <label className="block">
                  <Label>Template</Label>
                  <select
                    className="admin-input mt-2"
                    value={chosen ?? ""}
                    onChange={(e) => {
                      setChosen(Number(e.target.value));
                      setSkip(new Set());
                    }}
                  >
                    {ordered.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                        {typeIds.has(t.work_type_id ?? -1) ? " — suggested" : ""}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <Label>Starts on</Label>
                  <input
                    type="date"
                    className="admin-input mt-2"
                    value={start}
                    onChange={(e) => setStart(e.target.value || today())}
                  />
                </label>
              </div>

              {engagement?.starts_on && engagement.starts_on !== start && (
                <p className="-mt-3 text-xs text-[var(--fg-faint)]">
                  The work starts{" "}
                  {new Date(`${engagement.starts_on}T00:00:00`).toLocaleDateString("en-GB", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                  .{" "}
                  <button
                    type="button"
                    className="text-[var(--link)] hover:underline"
                    onClick={() => setStart(engagement.starts_on!)}
                  >
                    Count from that day
                  </button>
                </p>
              )}

              {!engagement && links && (
                <label className="block">
                  <Label>Linked to</Label>
                  <LinkSelect
                    links={links}
                    className="mt-2"
                    value={
                      link.engagement_id
                        ? `e:${link.engagement_id}`
                        : link.client_id
                          ? `c:${link.client_id}`
                          : ""
                    }
                    onChange={setLink}
                  />
                </label>
              )}

              {template && (
                <div>
                  {template.description && (
                    <p className="mb-3 text-sm text-[var(--fg-dim)]">{template.description}</p>
                  )}
                  {/* Every step with the date it will get. Untick to leave
                      one out of this job. */}
                  <ul className="max-h-[40vh] overflow-y-auto border border-[var(--hairline)]">
                    {template.items.map((step, i) => {
                      const on = !skip.has(i);
                      return (
                        <li
                          key={i}
                          className="border-b border-[var(--hairline)] last:border-b-0"
                        >
                          <label className="flex cursor-pointer items-start gap-3 px-3 py-2.5">
                            <input
                              type="checkbox"
                              className="mt-1"
                              checked={on}
                              onChange={() =>
                                setSkip((s) => {
                                  const n = new Set(s);
                                  if (on) n.add(i);
                                  else n.delete(i);
                                  return n;
                                })
                              }
                            />
                            <span className={`min-w-0 flex-1 text-sm ${on ? "" : "text-[var(--fg-faint)] line-through"}`}>
                              {step.priority === "high" && (
                                <span className="mr-1.5 font-mono font-bold text-[var(--color-signal)]">!</span>
                              )}
                              {step.title}
                              {step.checklist.length > 0 && (
                                <span className="ml-2 text-xs text-[var(--fg-faint)]">
                                  {step.checklist.length} steps
                                </span>
                              )}
                            </span>
                            <span className="shrink-0 font-mono text-[0.58rem] uppercase tracking-[0.12em] text-[var(--fg-faint)]">
                              {step.day === null ? "No date" : short(addDays(start, step.day))}
                            </span>
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </div>
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
            onClick={() => setOpen(false)}
            className="px-4 py-2 text-sm text-[var(--fg-dim)] hover:text-[var(--fg)]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={apply}
            disabled={!template || count === 0 || busy}
            className="bg-[var(--fg)] px-4 py-2 font-mono text-[0.66rem] uppercase tracking-[0.12em] text-[var(--ground)] disabled:opacity-35"
          >
            {busy ? "Adding…" : `Add ${count} ${count === 1 ? "task" : "tasks"}`}
          </button>
        </div>
      </Modal>
    </>
  );
}

/** Keep this work's tasks as a template for the next job like it. */
export function SaveAsTemplate({ engagement }: { engagement: Engagement }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  async function save() {
    const n = name.trim();
    if (!n || busy) return;
    setBusy(true);
    setError(null);
    try {
      const t = await admin.templateFromWork(engagement.id, n);
      setSaved(t.name);
      setOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save it.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setName(engagement.title);
          setError(null);
          setSaved(null);
          setOpen(true);
        }}
        className="px-1 py-2 text-xs text-[var(--fg-faint)] hover:text-[var(--fg)]"
      >
        Save as template
      </button>
      {saved && (
        <span role="status" className="text-xs text-[var(--link)]">
          Saved as “{saved}”
        </span>
      )}

      <Modal open={open} onClose={() => setOpen(false)} label="Save these tasks as a template">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
        >
          <div className="px-6 pt-6 pb-5">
            <p className="font-mono text-[0.6rem] uppercase tracking-[0.16em] text-[var(--fg-faint)]">
              Save as template
            </p>
            <h2 className="mt-2 font-display text-xl font-semibold">Keep these steps for next time</h2>
            <p className="mt-3 text-sm leading-relaxed text-[var(--fg-dim)]">
              All {engagement.tasks.length} tasks of this work, with their checklists and priorities.
              Dates become “day 0, day 7…” counted from{" "}
              {engagement.starts_on ? "the work's start date" : "the first task's date"}.
            </p>
            <label className="mt-5 block">
              <Label>Template name</Label>
              <input
                autoFocus
                className="admin-input mt-2"
                maxLength={120}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
            {error && (
              <p role="alert" className="mt-3 text-xs text-[var(--color-signal)]">
                {error}
              </p>
            )}
          </div>
          <div className="flex flex-wrap items-center justify-end gap-3 border-t border-[var(--hairline)] px-6 py-4">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="px-4 py-2 text-sm text-[var(--fg-dim)] hover:text-[var(--fg)]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!name.trim() || busy}
              className="bg-[var(--fg)] px-4 py-2 font-mono text-[0.66rem] uppercase tracking-[0.12em] text-[var(--ground)] disabled:opacity-35"
            >
              {busy ? "Saving…" : "Save template"}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}

