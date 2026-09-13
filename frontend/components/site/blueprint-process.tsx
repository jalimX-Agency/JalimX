"use client";

import { useLayoutEffect, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

/**
 * The process, drawn.
 *
 * The homepage draws the studio's mark; this page draws its method. That is
 * deliberately the same gesture twice, because it makes the site one system
 * rather than a collection of effects — and because a drawing is what precedes
 * making something. "Made, not assembled" has to look like something.
 *
 * The line is not decoration: it is the project, from the first call to the day
 * it goes live, and it carries the real durations as annotations the way a
 * technical drawing carries dimensions. A client sees their own job drawn as an
 * engineering schedule, which says "these people are organised" before they
 * have read a word.
 *
 * A single light travels at the point being drawn — warm, against the cool line
 * behind it — so there is one focal point moving down the page instead of a
 * uniform reveal.
 */

export type Phase = {
  key: string;
  index: string;
  name: string;
  duration: string;
  body: string;
  need: string;
};

type Props = {
  eyebrow: string;
  heading: string;
  intro: string;
  terms: string;
  needLabel: string;
  phases: readonly Phase[];
};

/** Where the spine sits inside the drawing gutter, in px. */
const SPINE_X = 15;
/** How far each node's tick reaches toward its row. */
const TICK = 13;

export function BlueprintProcess({
  eyebrow,
  heading,
  intro,
  terms,
  needLabel,
  phases,
}: Props) {
  const root = useRef<HTMLDivElement>(null);
  const svg = useRef<SVGSVGElement>(null);
  const line = useRef<SVGPathElement>(null);
  const tip = useRef<SVGCircleElement>(null);
  const [active, setActive] = useState(-1);

  useLayoutEffect(() => {
    const holder = root.current;
    const canvas = svg.current;
    const path = line.current;
    const dot = tip.current;
    if (!holder || !canvas || !path || !dot) return;

    gsap.registerPlugin(ScrollTrigger);

    const nodesOf = () => {
      const top = holder.getBoundingClientRect().top;
      return [...holder.querySelectorAll<HTMLElement>("[data-phase]")].map(
        // The first line of the row, not its middle: a long paragraph would
        // otherwise drag its node halfway down the page.
        (row) => Math.round(row.getBoundingClientRect().top - top + 22),
      );
    };

    /*
     * The path is built from where the rows actually landed rather than from
     * assumed spacing: the phase bodies wrap differently in French, and at
     * every width, so a hardcoded geometry would have the ticks pointing at
     * the gaps between rows.
     */
    const build = () => {
      const ys = nodesOf();
      if (!ys.length) return 0;

      const height = holder.offsetHeight;
      canvas.setAttribute("viewBox", `0 0 40 ${height}`);
      canvas.setAttribute("height", String(height));

      const d = [`M ${SPINE_X} 0`];
      for (const y of ys) {
        d.push(
          `L ${SPINE_X} ${y}`,
          `L ${SPINE_X + TICK} ${y}`,
          `L ${SPINE_X} ${y}`,
        );
      }
      d.push(`L ${SPINE_X} ${height}`);
      path.setAttribute("d", d.join(" "));
      return path.getTotalLength();
    };

    const ctx = gsap.context(() => {
      const mm = gsap.matchMedia();

      mm.add("(prefers-reduced-motion: reduce)", () => {
        // The finished drawing, held still. Refusing to animate is not the
        // same as refusing to draw, and an empty gutter beside an indented
        // list reads as a broken image.
        build();
        gsap.set(path, { clearProps: "strokeDasharray,strokeDashoffset" });
        return () => path.removeAttribute("d");
      });

      mm.add("(prefers-reduced-motion: no-preference)", () => {
        let length = build();
        gsap.set(path, { strokeDasharray: length });

        const paint = (progress: number) => {
          if (!length) return;
          gsap.set(path, { strokeDashoffset: length * (1 - progress) });

          // The light rides the point currently being drawn.
          const at = path.getPointAtLength(length * progress);
          gsap.set(dot, {
            attr: { cx: at.x, cy: at.y },
            opacity: progress > 0.003 ? 1 : 0,
          });

          const ys = nodesOf();
          let reached = -1;
          ys.forEach((y, i) => {
            if (y <= at.y) reached = i;
          });
          setActive(reached);
        };

        const trigger = ScrollTrigger.create({
          trigger: holder,
          // Draws as the block enters and finishes before it leaves, so the
          // last phase is lit while it is still comfortably on screen.
          start: "top 72%",
          end: "bottom 72%",
          scrub: true,
          invalidateOnRefresh: true,
          onRefresh: (self) => {
            length = build();
            gsap.set(path, { strokeDasharray: length });
            paint(self.progress);
          },
          onUpdate: (self) => paint(self.progress),
        });

        paint(trigger.progress);

        return () => {
          trigger.kill();
          gsap.set(path, { clearProps: "strokeDasharray,strokeDashoffset" });
          gsap.set(dot, { clearProps: "opacity" });
        };
      });
    }, holder);

    return () => ctx.revert();
  }, []);

  return (
    <section className="pb-24 pt-16 md:pb-32">
      <div className="flex items-baseline gap-4 border-t border-[var(--hairline)] pt-8">
        <span className="font-mono text-[0.72rem] tracking-[0.16em] text-signal">
          {eyebrow}
        </span>
        <h2 className="font-display text-sm font-semibold uppercase tracking-[0.14em]">
          {heading}
        </h2>
      </div>

      <div className="mt-8">
        <p className="max-w-[62ch] text-lg leading-relaxed text-[var(--fg-dim)]">
          {intro}
        </p>
        <p className="mt-4 font-mono text-[0.72rem] tracking-[0.06em] text-signal">
          {terms}
        </p>
      </div>

      <div ref={root} className="relative mt-14">
        {/* A guide line that is always there, drawn in CSS. The blue path inks
            over it, which is how a technical drawing actually goes: pencil,
            then ink. It also means the gutter is never simply empty — with
            JavaScript off, under reduced motion, or before the first scroll. */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute bottom-0 top-0 w-px bg-[var(--hairline)]"
          style={{ left: SPINE_X }}
        />

        {/* The drawing sits in its own gutter to the left of the rows. It is
            purely a depiction of what the list already says, so it is hidden
            from assistive technology rather than described. */}
        <svg
          ref={svg}
          aria-hidden="true"
          className="pointer-events-none absolute left-0 top-0 w-10 overflow-visible"
          width="40"
          preserveAspectRatio="xMinYMin meet"
        >
          <path
            ref={line}
            fill="none"
            stroke="var(--color-jx)"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          <circle
            ref={tip}
            r="3.5"
            fill="var(--color-signal)"
            opacity="0"
            style={{ filter: "drop-shadow(0 0 6px var(--color-signal))" }}
          />
        </svg>

        {/* Margin, not padding, and not positioned. Padding put the list's own
            background into the drawing gutter as a grey band, and being
            positioned it painted straight over the SVG — the line was
            invisible. The drawing needs the gutter to itself. */}
        <ol className="ml-10 flex flex-col gap-px bg-[var(--hairline)] sm:ml-12">
          {phases.map((phase, i) => {
            const lit = i === active;
            return (
              <li
                key={phase.key}
                data-phase
                /*
                 * The reached phase flips to paper. One light element on a dark
                 * page carries further than either ground does on its own, and
                 * it marks where the drawing has got to without a second colour.
                 */
                className={`p-6 transition-colors duration-500 sm:p-7 ${
                  lit
                    ? "bg-[var(--color-paper)] text-[var(--color-ink)]"
                    : "bg-[var(--panel)]"
                }`}
              >
                <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
                  <span
                    className={`font-mono text-[0.72rem] tracking-[0.16em] ${
                      lit ? "text-signal-dim" : "text-signal"
                    }`}
                  >
                    {phase.index}
                  </span>
                  <h3 className="font-display text-xl font-semibold tracking-tight">
                    {phase.name}
                  </h3>
                  <span
                    className={`ml-auto font-mono text-[0.72rem] tracking-[0.08em] ${
                      lit
                        ? "text-[var(--color-ink-faint)]"
                        : "text-[var(--fg-faint)]"
                    }`}
                  >
                    {phase.duration}
                  </span>
                </div>

                <p
                  className={`mt-3 max-w-[64ch] leading-relaxed ${
                    lit ? "text-[var(--color-ink-dim)]" : "text-[var(--fg-dim)]"
                  }`}
                >
                  {phase.body}
                </p>

                <p className="mt-4 flex flex-wrap gap-x-3 gap-y-1 text-sm">
                  <span
                    className={`font-mono text-[0.68rem] uppercase tracking-[0.12em] ${
                      lit
                        ? "text-[var(--color-ink-faint)]"
                        : "text-[var(--fg-faint)]"
                    }`}
                  >
                    {needLabel}
                  </span>
                  <span
                    className={
                      lit ? "text-[var(--color-ink)]" : "text-[var(--fg)]"
                    }
                  >
                    {phase.need}
                  </span>
                </p>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
