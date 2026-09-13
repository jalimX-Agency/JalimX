/**
 * JalimX logo. Inline SVG rather than <img> so the mark inherits `currentColor`,
 * can be animated, and costs no extra request. See brand/BRAND.md.
 *
 * The blue comes from `--jx-accent`, which defaults to the identity blue but can
 * be overridden per context (e.g. a deeper blue on light grounds).
 */

const MARK_W =
  "M27.36 0.72L49.82 0.72L51.09 1.27L71.01 28.26L64.49 34.78L27.36 0.72ZM33.70 19.75L45.65 19.93L38.77 41.30L36.41 45.83L33.33 50.00L27.36 55.07L21.74 57.61L15.22 58.70L1.99 58.70L0.91 58.33L0.00 57.07L0.00 56.16L1.27 50.00L2.54 48.55L3.80 48.19L13.41 48.37L18.30 47.64L22.64 45.47L25.54 42.75L28.26 38.04L33.70 19.75Z";

const MARK_B =
  "M81.52 0.00L100.00 0.18L73.19 25.54L65.76 15.40L79.53 0.72L81.52 0.00ZM54.35 30.25L60.69 31.16L64.67 34.96L61.41 38.41L41.49 58.33L36.78 58.70L27.17 58.51L30.80 56.34L35.33 51.99L38.41 47.64L39.86 44.38L54.35 30.25ZM73.19 31.16L94.02 58.70L77.54 58.70L75.36 57.61L63.59 41.67L73.19 31.16Z";

type MarkProps = React.SVGProps<SVGSVGElement> & {
  title?: string;
};

export function JxMark({ title = "JalimX", ...props }: MarkProps) {
  return (
    <svg viewBox="0 0 100 58.70" role="img" aria-label={title} {...props}>
      <path fill="currentColor" d={MARK_W} />
      <path fill="var(--jx-accent, var(--color-jx))" d={MARK_B} />
    </svg>
  );
}

/**
 * Horizontal lockup for headers. The wordmark is live text in Chakra Petch
 * rather than traced paths: it stays selectable, scales with the type system,
 * and ships nothing extra. Below ~200px wide, use <JxMark /> alone.
 */
export function JxLockup({ className }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className ?? ""}`}>
      <JxMark className="h-7 w-auto" />
      <span className="font-display text-[1.05rem] font-semibold uppercase tracking-[0.075em]">
        JalimX
      </span>
    </span>
  );
}
