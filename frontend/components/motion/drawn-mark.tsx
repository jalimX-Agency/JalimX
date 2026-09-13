"use client";

import { useLayoutEffect, useRef } from "react";
import gsap from "gsap";

/**
 * The JX monogram, drawn rather than placed.
 *
 * The hero's subject is the studio's own craft, so its one graphic is the
 * studio's own mark — not a screenshot of a client's site. A client's homepage
 * in our hero puts their brand in our first impression and ends the animation
 * on a full-screen advert for someone else.
 *
 * On load the outline strokes itself in and the solid form arrives behind it:
 * the tagline says "made, not assembled", and this is the only moment on the
 * site where you actually watch something being made. Afterwards it drifts
 * with the pointer — depth, not decoration.
 *
 * The fill is in the DOM at full opacity from the server. GSAP only takes it
 * down inside `useLayoutEffect`, which runs before paint, so there is no flash
 * and no-JS renders the finished mark.
 */

const MARK_W =
  "M27.36 0.72L49.82 0.72L51.09 1.27L71.01 28.26L64.49 34.78L27.36 0.72ZM33.70 19.75L45.65 19.93L38.77 41.30L36.41 45.83L33.33 50.00L27.36 55.07L21.74 57.61L15.22 58.70L1.99 58.70L0.91 58.33L0.00 57.07L0.00 56.16L1.27 50.00L2.54 48.55L3.80 48.19L13.41 48.37L18.30 47.64L22.64 45.47L25.54 42.75L28.26 38.04L33.70 19.75Z";

const MARK_B =
  "M81.52 0.00L100.00 0.18L73.19 25.54L65.76 15.40L79.53 0.72L81.52 0.00ZM54.35 30.25L60.69 31.16L64.67 34.96L61.41 38.41L41.49 58.33L36.78 58.70L27.17 58.51L30.80 56.34L35.33 51.99L38.41 47.64L39.86 44.38L54.35 30.25ZM73.19 31.16L94.02 58.70L77.54 58.70L75.36 57.61L63.59 41.67L73.19 31.16Z";

export function DrawnMark({ className }: { className?: string }) {
  const root = useRef<SVGSVGElement>(null);

  useLayoutEffect(() => {
    const svg = root.current;
    if (!svg) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");

    const ctx = gsap.context(() => {
      const fills = gsap.utils.toArray<SVGPathElement>("[data-mark-fill]");
      const strokes = gsap.utils.toArray<SVGPathElement>("[data-mark-stroke]");

      const strokeGroup = svg.querySelector("[data-mark-strokes]");

      if (reduced.matches) {
        // Finished state, no drawing. The outlines exist for the animation
        // only, so they simply never appear.
        return;
      }

      // Dash each outline to its own length so the line appears to be drawn
      // rather than wiped — a single shared length makes the shorter paths
      // finish early and the whole thing look mechanical.
      strokes.forEach((path) => {
        const len = path.getTotalLength();
        gsap.set(path, { strokeDasharray: len, strokeDashoffset: len, opacity: 1 });
      });

      gsap.set(fills, { opacity: 0 });

      /*
       * The group carries `opacity="0"` in the markup so that a visitor
       * without JS sees only the finished mark. Opacity multiplies down the
       * tree, so setting it on the paths alone left every stroke at zero and
       * the draw invisible while its dash offset animated perfectly.
       */
      gsap.set(strokeGroup, { opacity: 1 });

      const tl = gsap.timeline({ delay: 0.15 });

      tl.to(strokes, {
        strokeDashoffset: 0,
        duration: 1.25,
        ease: "power2.inOut",
        stagger: 0.12,
      })
        // The solid form arrives under the finished outline…
        .to(fills, { opacity: 1, duration: 0.5, ease: "power2.out" }, "-=0.35")
        // …and the outline hands over to it.
        .to(strokeGroup, { opacity: 0, duration: 0.4, ease: "power1.out" }, "<0.15");
    }, svg);

    return () => ctx.revert();
  }, []);

  return (
    <svg
      ref={root}
      viewBox="0 0 100 58.70"
      className={className}
      role="img"
      aria-label="JalimX"
      // Strokes are drawn outside the path edge; without this they clip.
      style={{ overflow: "visible" }}
    >
      <g>
        <path data-mark-fill fill="currentColor" d={MARK_W} />
        <path data-mark-fill fill="var(--jx-accent, var(--color-jx))" d={MARK_B} />
      </g>
      <g data-mark-strokes fill="none" strokeWidth="0.7" strokeLinejoin="round" opacity="0">
        <path data-mark-stroke stroke="currentColor" d={MARK_W} />
        <path
          data-mark-stroke
          stroke="var(--jx-accent, var(--color-jx))"
          d={MARK_B}
        />
      </g>
    </svg>
  );
}
