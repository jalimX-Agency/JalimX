/**
 * What the dashboard shows while it waits for the API.
 *
 * The database sits in Europe and PHP opens a fresh connection on every
 * request, so a page here routinely waits a second or two — long enough that
 * a blank panel reads as broken. These stand in the shape of the real thing,
 * so the layout does not jump when the data lands.
 *
 * The pulse is dropped for anyone who asked for less motion; the blocks are
 * still visible, just still.
 */

export function Block({ className = "" }: { className?: string }) {
  return (
    <span
      className={`block rounded-[2px] bg-[color-mix(in_oklab,var(--fg)_9%,transparent)] motion-safe:animate-pulse ${className}`}
    />
  );
}

/** Heading, sentence, and whatever the page puts under them. */
export function PageSkeleton({ children }: { children?: React.ReactNode }) {
  return (
    <div aria-hidden="true" className="max-w-5xl">
      <Block className="h-2.5 w-16" />
      <Block className="mt-4 h-8 w-52" />
      <Block className="mt-4 h-3.5 w-full max-w-[42ch]" />
      <Block className="mt-2 h-3.5 w-full max-w-[34ch]" />
      {children}
    </div>
  );
}

/** A list of rows inside one bordered panel — leads, projects. */
export function RowsSkeleton({ rows = 5, thumb = false }: { rows?: number; thumb?: boolean }) {
  return (
    <div className="mt-10 grid gap-px border border-[var(--hairline)] bg-[var(--hairline)]">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-5 bg-[var(--panel)] px-5 py-4">
          {thumb ? <Block className="h-14 w-20 shrink-0" /> : <Block className="h-2 w-2 shrink-0 rounded-full" />}
          <div className="min-w-0 flex-1">
            <Block className="h-3.5 w-40" />
            <Block className="mt-2 h-2.5 w-28" />
          </div>
          <Block className="hidden h-3 w-64 sm:block" />
          <Block className="h-4 w-16 shrink-0" />
        </div>
      ))}
    </div>
  );
}

/** Stacked panels, each with a header strip and a body — the editing pages. */
export function PanelsSkeleton({ panels = 3, lines = 4 }: { panels?: number; lines?: number }) {
  return (
    <div className="mt-10 flex flex-col gap-8">
      {Array.from({ length: panels }).map((_, i) => (
        <div key={i} className="border border-[var(--hairline)] bg-[var(--panel)]">
          <div className="border-b border-[var(--hairline)] px-5 py-4">
            <Block className="h-2.5 w-24" />
          </div>
          <div className="grid gap-5 p-5 md:grid-cols-2">
            {Array.from({ length: lines }).map((_, j) => (
              <div key={j}>
                <Block className="h-2 w-20" />
                <Block className="mt-2 h-9 w-full" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
