import type { LeadStatus } from "@/lib/admin/client";

/**
 * Where a lead stands, as a chip. The colour carries meaning, not decoration:
 * "new" is the one that asks for action, "won" and "lost" are closed, the
 * middle two are conversations in progress.
 */

export const STATUS_LABEL: Record<LeadStatus, string> = {
  new: "New",
  contacted: "Contacted",
  quoted: "Quoted",
  won: "Won",
  lost: "Lost",
};

const TONE: Record<LeadStatus, string> = {
  new: "border-[color-mix(in_oklab,var(--color-signal)_45%,transparent)] text-[var(--color-signal)]",
  contacted: "border-[color-mix(in_oklab,var(--link)_40%,transparent)] text-[var(--link)]",
  quoted: "border-[color-mix(in_oklab,var(--link)_40%,transparent)] text-[var(--link)]",
  won: "border-[color-mix(in_oklab,#1f9d6b_45%,transparent)] text-[#1a8a5d]",
  lost: "border-[var(--hairline)] text-[var(--fg-faint)]",
};

export function LeadStatusChip({ status }: { status: LeadStatus }) {
  return (
    <span
      className={`inline-block border px-2 py-0.5 font-mono text-[0.58rem] uppercase tracking-[0.12em] ${TONE[status]}`}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}

/** "3h ago", "Tue 14:05", "12 Aug" — the shape an inbox reads at a glance. */
export function when(iso: string): string {
  const date = new Date(iso);
  const minutes = Math.round((Date.now() - date.getTime()) / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (minutes < 60 * 24) return `${Math.round(minutes / 60)}h ago`;
  if (minutes < 60 * 24 * 6) {
    return date.toLocaleString("en-GB", { weekday: "short", hour: "2-digit", minute: "2-digit" });
  }
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    ...(date.getFullYear() !== new Date().getFullYear() ? { year: "numeric" } : {}),
  });
}
