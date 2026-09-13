"use client";

import { useLayoutEffect, useRef } from "react";
import gsap from "gsap";

/**
 * The headline, plotted.
 *
 * A pen rides across each line and the words appear behind it, then it returns
 * to the left margin and writes the next one — the carriage motion of a plotter
 * or a typewriter. It is the page's one loud moment, and it is loud on purpose:
 * a page promising the whole process written down should open by writing
 * something.
 *
 * It belongs to the same family as the mark on the homepage and the spine
 * through the process below — everything that moves on this site is something
 * being drawn — but this is the one that is meant to be noticed.
 *
 * Mechanically it is a clip, not a per-character animation. Splitting a display
 * headline into spans reflows it at exactly the sizes where it is largest, and
 * hands a screen reader a heading chopped into fragments. The text stays one
 * node, and the reveal is a rectangle moving across it.
 */

type Props = {
  lines: readonly string[];
  /** Seconds to wait so the sheet's rules are inked before the pen starts. */
  delay?: number;
  className?: string;
  /** Applied to every line after the first — the accent colour, here. */
  restClassName?: string;
};

/** How long the pen takes to cross one line. */
const SWEEP = 0.62;
/** Overlap between lines, so the carriage return does not feel like a stop. */
const STEP = 0.5;

export function PlottedHeadline({
  lines,
  delay = 0.45,
  className,
  restClassName,
}: Props) {
  const root = useRef<HTMLHeadingElement>(null);

  useLayoutEffect(() => {
    const el = root.current;
    if (!el) return;

    const ctx = gsap.context(() => {
      const mm = gsap.matchMedia();

      // Reduced motion gets the finished headline. It is the page's title —
      // there is no version of it that is worth withholding.
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        const texts = gsap.utils.toArray<HTMLElement>("[data-plot-text]");
        const pens = gsap.utils.toArray<HTMLElement>("[data-plot-pen]");
        if (!texts.length) return;

        /*
         * Set here rather than in the markup, inside useLayoutEffect so it
         * lands before paint. A headline clipped away in the HTML is a headline
         * that never arrives if the JavaScript fails, and this one is the
         * page's largest contentful paint.
         */
        gsap.set(texts, { clipPath: "inset(0 100% 0 0)" });
        gsap.set(pens, { left: 0, opacity: 0 });

        const tl = gsap.timeline({ delay });

        texts.forEach((text, i) => {
          const at = i * STEP;
          const pen = pens[i];

          tl.to(pen, { opacity: 1, duration: 0.08 }, at)
            .to(
              text,
              {
                clipPath: "inset(0 0% 0 0)",
                duration: SWEEP,
                // Eased at both ends: a pen accelerates off the margin and
                // settles at the end of a line rather than stopping dead.
                ease: "power2.inOut",
              },
              at,
            )
            .to(
              pen,
              { left: "100%", duration: SWEEP, ease: "power2.inOut" },
              at,
            )
            .to(pen, { opacity: 0, duration: 0.14 }, at + SWEEP - 0.04);
        });

        return () => {
          gsap.set(texts, { clearProps: "clipPath" });
          gsap.set(pens, { clearProps: "left,opacity" });
        };
      });
    }, el);

    return () => ctx.revert();
  }, [delay, lines.length]);

  return (
    <h1 ref={root} className={className}>
      {lines.map((line, i) => (
        <span
          key={line}
          className={`relative block ${i > 0 ? (restClassName ?? "") : ""}`}
        >
          <span data-plot-text className="block">
            {line}
          </span>

          {/* The pen. Sits above the line it is writing, glowing, and is
              hidden until its turn — a bar parked at the margin before the
              sequence starts would read as a cursor waiting for input. */}
          <span
            data-plot-pen
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-[0.08em] w-[2px] bg-signal opacity-0"
            style={{ boxShadow: "0 0 12px 1px var(--color-signal)" }}
          />
        </span>
      ))}
    </h1>
  );
}
