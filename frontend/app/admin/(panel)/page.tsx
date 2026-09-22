"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { STATUS_LABEL } from "@/components/admin/lead-status";
import { PageSkeleton, RowsSkeleton } from "@/components/admin/skeleton";
import { admin, isSignedOut, type Overview } from "@/lib/admin/client";

/**
 * The first screen.
 *
 * It answers one question — what needs me today — and it answers it with
 * work you can start from here, not with charts. Everything on it is
 * either a task due this week, money that has not arrived, a month nobody
 * has billed, a draft that was never sent, or someone waiting for a reply.
 * When all of them are empty the page says so and stops talking.
 */

const money = (amount: string, currency: string) =>
  `${Number(amount).toLocaleString("en-GB", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ${currency}`;

const monthName = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString("en-GB", { month: "long", year: "numeric" });

const day = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });

export default function OverviewPage() {
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    admin.overview().then(
      (o) => live && setData(o),
      (e) => live && !isSignedOut(e) && setError(e.message),
    );
    return () => {
      live = false;
    };
  }, []);

  if (error) {
    return (
      <p role="alert" className="text-sm text-[var(--color-signal)]">
        {error}
      </p>
    );
  }

  if (!data) {
    return (
      <PageSkeleton>
        <RowsSkeleton rows={5} />
      </PageSkeleton>
    );
  }

  const quiet =
    data.tasks.length === 0 &&
    data.overdue.length === 0 &&
    data.unbilled.length === 0 &&
    data.drafts.length === 0 &&
    data.leads.unread === 0;

  return (
    <div className="w-full">
      <h1 className="font-display text-3xl font-semibold tracking-tight">Today</h1>

      {/* The money line first, because it is the reason this exists. One
          row per currency; almost always one row. */}
      {data.money.length > 0 && (
        <dl className="mt-8 grid gap-px border border-[var(--hairline)] bg-[var(--hairline)] sm:grid-cols-2 lg:grid-cols-4">
          {data.money.map((m) => (
            <Figure
              key={`${m.currency}-owed`}
              label="Owed to you"
              value={money(m.outstanding, m.currency)}
              note={
                Number(m.overdue) > 0
                  ? `${money(m.overdue, m.currency)} of it late`
                  : "Nothing late"
              }
              alarm={Number(m.overdue) > 0}
            />
          ))}
          {data.money.map((m) => (
            <Figure
              key={`${m.currency}-in`}
              label="Came in this month"
              value={money(m.paid_this_month, m.currency)}
            />
          ))}
          {data.money.map((m) => (
            <Figure
              key={`${m.currency}-rec`}
              label="Every month"
              value={money(m.recurring, m.currency)}
              note="From work that runs on"
            />
          ))}
          <Figure
            label="Clients"
            value={String(data.counts.clients)}
            note={
              data.counts.clients_without_ice > 0
                ? `${data.counts.clients_without_ice} without an ICE`
                : `${data.counts.active_work} jobs running`
            }
            alarm={data.counts.clients_without_ice > 0}
          />
        </dl>
      )}

      {quiet && (
        <p className="mt-10 max-w-[60ch] text-sm text-[var(--fg-dim)]">
          Nothing is waiting: no task is due this week, no invoice is late,
          every month is billed, there are no drafts sitting unsent, and
          every enquiry has been read.
        </p>
      )}

      <div className="mt-10 grid gap-8 lg:grid-cols-2">
        {data.tasks.length > 0 && <Due tasks={data.tasks} />}

        {data.unbilled.length > 0 && (
          <Panel
            title="Months not billed"
            hint="Work that runs on, for a month nobody has invoiced"
          >
            <ul>
              {data.unbilled.map((row) => (
                <Row
                  key={`${row.engagement_id}-${row.period}`}
                  href={`/admin/clients/${row.client_id}`}
                  title={`${row.client} — ${monthName(row.period)}`}
                  note={row.title}
                  right={row.amount ? money(row.amount, row.currency) : "No price set"}
                />
              ))}
            </ul>
          </Panel>
        )}

        {data.overdue.length > 0 && (
          <Panel title="Late" hint="Issued, past its date, not paid">
            <ul>
              {data.overdue.map((row) => (
                <Row
                  key={row.id}
                  href={`/admin/clients/${row.client_id}`}
                  title={`${row.client} · ${row.number ?? "Invoice"}`}
                  note={`${row.days_late} ${row.days_late === 1 ? "day" : "days"} late`}
                  right={money(row.due, row.currency)}
                  alarm
                />
              ))}
            </ul>
          </Panel>
        )}

        {data.drafts.length > 0 && (
          <Panel title="Written, never sent" hint="Drafts waiting to be issued">
            <ul>
              {data.drafts.map((row) => (
                <Row
                  key={row.id}
                  href={`/admin/clients/${row.client_id}`}
                  title={`${row.client} · ${row.type === "invoice" ? "Invoice" : "Quote"}`}
                  note={row.subject ?? "No subject"}
                  right={money(row.total, row.currency)}
                />
              ))}
            </ul>
          </Panel>
        )}

        {data.leads.recent.length > 0 && (
          <Panel
            title="Enquiries"
            hint={
              data.leads.unread > 0
                ? `${data.leads.unread} not opened yet`
                : "All read"
            }
          >
            <ul>
              {data.leads.recent.map((lead) => (
                <Row
                  key={lead.id}
                  href={`/admin/leads/${lead.id}`}
                  title={lead.company ? `${lead.name} · ${lead.company}` : lead.name}
                  note={`${STATUS_LABEL[lead.status]} · ${day(lead.created_at)}`}
                  right={lead.is_read ? "" : "New"}
                  alarm={!lead.is_read}
                />
              ))}
            </ul>
          </Panel>
        )}
      </div>
    </div>
  );
}

function Figure({
  label,
  value,
  note,
  alarm,
}: {
  label: string;
  value: string;
  note?: string;
  alarm?: boolean;
}) {
  return (
    <div className="bg-[var(--panel)] px-5 py-4">
      <dt className="font-mono text-[0.6rem] uppercase tracking-[0.14em] text-[var(--fg-faint)]">
        {label}
      </dt>
      <dd className="mt-2 font-display text-2xl tabular-nums">{value}</dd>
      {note && (
        <dd
          className={`mt-1 text-xs ${alarm ? "text-[var(--color-signal)]" : "text-[var(--fg-faint)]"}`}
        >
          {note}
        </dd>
      )}
    </div>
  );
}

/**
 * Tasks due this week or late, across every client, ticked off in place.
 *
 * A ticked row stays where it is, struck through, until the page is next
 * opened: a list that reshuffles under the cursor makes you tick the
 * wrong line.
 */
function Due({ tasks }: { tasks: Overview["tasks"] }) {
  const [done, setDone] = useState<Set<number>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const late = tasks.filter((t) => t.days < 0 && !done.has(t.id)).length;

  async function toggle(id: number) {
    const now = !done.has(id);
    setDone((s) => {
      const next = new Set(s);
      if (now) next.add(id);
      else next.delete(id);
      return next;
    });
    try {
      await admin.updateTask(id, { done: now });
    } catch (e) {
      // Put the box back the way the server still has it.
      setDone((s) => {
        const next = new Set(s);
        if (now) next.delete(id);
        else next.add(id);
        return next;
      });
      setError(e instanceof Error ? e.message : "Could not save that.");
    }
  }

  const label = (days: number) =>
    days < 0
      ? `${-days} ${days === -1 ? "day" : "days"} late`
      : days === 0
        ? "Today"
        : days === 1
          ? "Tomorrow"
          : `In ${days} days`;

  return (
    <Panel title="To do" hint={late > 0 ? `${late} late` : "Due this week"}>
      {error && (
        <p role="alert" className="border-b border-[var(--hairline)] px-5 py-2 text-xs text-[var(--color-signal)]">
          {error}
        </p>
      )}
      <ul>
        {tasks.map((task) => {
          const isDone = done.has(task.id);
          return (
            <li
              key={task.id}
              className="flex items-start gap-3 border-b border-[var(--hairline)] px-5 py-3.5 last:border-b-0"
            >
              <input
                type="checkbox"
                className="mt-1 shrink-0"
                checked={isDone}
                onChange={() => toggle(task.id)}
                aria-label={`Mark "${task.title}" as ${isDone ? "not done" : "done"}`}
              />
              <Link href={`/admin/clients/${task.client_id}`} className="min-w-0 flex-1 group">
                <span
                  className={`block truncate text-sm ${
                    isDone ? "text-[var(--fg-faint)] line-through" : "group-hover:text-[var(--link)]"
                  }`}
                >
                  {task.title}
                </span>
                <span className="mt-0.5 block truncate text-xs text-[var(--fg-faint)]">
                  {task.client} · {task.work}
                </span>
              </Link>
              <span
                className={`shrink-0 font-mono text-[0.6rem] uppercase tracking-[0.12em] ${
                  isDone
                    ? "text-[var(--fg-faint)]"
                    : task.days < 0
                      ? "text-[var(--color-signal)]"
                      : task.days <= 1
                        ? "text-[var(--link)]"
                        : "text-[var(--fg-faint)]"
                }`}
              >
                {isDone ? "Done" : label(task.days)}
              </span>
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}

function Panel({
  title,
  hint,
  children,
}: {
  title: string;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border border-[var(--hairline)] bg-[var(--panel)]">
      <header className="flex flex-wrap items-baseline justify-between gap-3 border-b border-[var(--hairline)] px-5 py-3.5">
        <h2 className="font-mono text-[0.66rem] uppercase tracking-[0.14em]">{title}</h2>
        <p className="text-xs text-[var(--fg-faint)]">{hint}</p>
      </header>
      {children}
    </section>
  );
}

/** Every line on this page goes somewhere you can act. */
function Row({
  href,
  title,
  note,
  right,
  alarm,
}: {
  href: string;
  title: string;
  note: string;
  right: string;
  alarm?: boolean;
}) {
  return (
    <li className="border-b border-[var(--hairline)] last:border-b-0">
      <Link
        href={href}
        className="flex flex-wrap items-baseline justify-between gap-x-5 gap-y-1 px-5 py-3.5 hover:bg-[color-mix(in_oklab,var(--fg)_3%,transparent)]"
      >
        <span className="min-w-0">
          <span className="block truncate text-sm">{title}</span>
          <span className="mt-0.5 block truncate text-xs text-[var(--fg-faint)]">{note}</span>
        </span>
        <span
          className={`shrink-0 text-sm tabular-nums ${alarm ? "text-[var(--color-signal)]" : "text-[var(--fg-dim)]"}`}
        >
          {right}
        </span>
      </Link>
    </li>
  );
}
