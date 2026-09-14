"use client";

import { useLayoutEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

/**
 * The about page's spine: things refused, and things guaranteed.
 *
 * A refusal is a stronger thing to publish than a claim. "We build fast sites"
 * is what every studio says and nothing a client can hold anyone to; "no
 * monthly retainer" is a commitment that can be broken, which is exactly why it
 * is worth reading.
 *
 * Each line carries a stroke that draws itself as the reader arrives at it —
 * through the term where it is refused, under it where it is promised. Same
 * gesture, opposite meaning, and the same one the mark on the homepage and the
 * process line on /approach are made of: everything that moves on this site is
 * something being drawn.
 *
 * The strokes are full width in the markup and scaled to nothing inside
 * `useLayoutEffect`, which runs before paint. Without JavaScript the page reads
 * as a finished list — struck and underlined — rather than as a list of plain
 * sentences whose whole meaning was in the motion.
 */

export type Declaration = {
  key: string;
  term: string;
  note: string;
};

type Props = {
  items: readonly Declaration[];
  /** `strike` crosses the term out; `mark` underscores it. */
  mode: "strike" | "mark";
};

export function Declarations({ items, mode }: Props) {
  const root = useRef<HTMLUListElement>(null);
  const struck = mode === "strike";

  useLayoutEffect(() => {
    const el = root.current;
    if (!el) return;

    gsap.registerPlugin(ScrollTrigger);

    const ctx = gsap.context(() => {
      const mm = gsap.matchMedia();

      mm.add("(prefers-reduced-motion: no-preference)", () => {
        const strokes = gsap.utils.toArray<HTMLElement>("[data-stroke]");
        if (!strokes.length) return;

        gsap.set(strokes, { transformOrigin: "left center", scaleX: 0 });

        const tween = gsap.to(strokes, {
          scaleX: 1,
          duration: 0.42,
          ease: "power2.inOut",
          stagger: 0.12,
          scrollTrigger: {
            trigger: el,
            // Late enough that the list is properly in view, early enough that
            // the last line is struck before it reaches the top of the screen.
            start: "top 76%",
            once: true,
          },
        });

        return () => {
          tween.scrollTrigger?.kill();
          tween.kill();
          gsap.set(strokes, { clearProps: "transform,transformOrigin" });
        };
      });
    }, el);

    return () => ctx.revert();
  }, []);

  return (
    <ul ref={root} className="flex flex-col">
      {items.map((item) => (
        <li
          key={item.key}
          className="grid gap-x-10 gap-y-2 border-b border-[var(--hairline)] py-7 last:border-b-0 md:grid-cols-[minmax(0,20rem)_1fr] md:py-8"
        >
          <h3
            className={`relative inline-block w-fit font-display text-[clamp(1.6rem,3.4vw,2.4rem)] font-semibold leading-none tracking-tight ${
              struck ? "text-[var(--fg-faint)]" : ""
            }`}
          >
            {item.term}
            <span
              data-stroke
              aria-hidden="true"
              /*
               * Through the middle for a refusal, along the baseline for a
               * promise. `left-0 w-full` on both so the scale runs the length
               * of the words rather than of the column.
               */
              className={
                struck
                  ? "absolute left-0 top-1/2 h-[3px] w-full -translate-y-1/2 bg-signal"
                  : "absolute -bottom-1.5 left-0 h-[3px] w-full bg-[var(--link)]"
              }
            />
          </h3>

          <p className="max-w-[52ch] leading-relaxed text-[var(--fg-dim)] md:pt-1">
            {item.note}
          </p>
        </li>
      ))}
    </ul>
  );
}
