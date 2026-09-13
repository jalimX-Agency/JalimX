"use client";

import Link from "next/link";
import { useLayoutEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

import { DrawnMark } from "@/components/motion/drawn-mark";

/**
 * The homepage opener.
 *
 * Rebuilt after the first version led with a client's homepage. That put
 * someone else's brand in our first impression and ended the animation on a
 * full-screen advert for a tour operator — the work belongs in the work
 * section, captioned and credited, not standing in for our own identity.
 *
 * The subject here is the studio's craft, so the one graphic is the studio's
 * own mark, and it is drawn rather than placed. "Made, not assembled" is a
 * claim about making; this is the only moment on the site where you watch
 * something being made.
 *
 * It then has somewhere to go. On scroll the monogram shrinks and travels the
 * width of the screen into the header, where it hands over to the header's own
 * mark — so the thing you watched being drawn turns out to be the logo you
 * navigate by for the rest of the visit. That is the whole reason the header is
 * sticky: see `.site-header`.
 *
 * Two compositions. Stacked and centred on a phone; from `lg` the copy takes
 * the left column and the mark holds the right. The mark is sized in viewport
 * *height* rather than width in both — an earlier pass sized it by width and on
 * a short laptop screen it grew until the call to action was pushed off the
 * bottom, the one element that cannot afford to be below the fold. `pnpm fold`
 * measures exactly that.
 */

type Props = {
  headline: string;
  body: string;
  labels: { cta: string; seeWork: string; eyebrow: string };
};

export function CinematicHero({ headline, body, labels }: Props) {
  const root = useRef<HTMLElement>(null);
  const [first, ...rest] = headline.split(",");

  useLayoutEffect(() => {
    const el = root.current;
    if (!el) return;

    gsap.registerPlugin(ScrollTrigger);

    const ctx = gsap.context(() => {
      const mm = gsap.matchMedia();

      mm.add("(prefers-reduced-motion: no-preference)", () => {
        // The copy sets after the mark has drawn, so the two read as one
        // sequence rather than competing for the same half second.
        gsap.from("[data-rise]", {
          y: 20,
          opacity: 0,
          duration: 0.8,
          ease: "power3.out",
          stagger: 0.08,
          delay: 0.55,
        });
      });

      /*
       * Pointer drift, eased rather than tracked. A mark with some weight to it
       * responds while the visitor is still reading, which is when it counts.
       * It rides on its own element so it never fights the scroll handoff below
       * for the same `transform`.
       */
      mm.add(
        "(pointer: fine) and (prefers-reduced-motion: no-preference)",
        () => {
          const mark = el.querySelector<HTMLElement>("[data-mark-wrap]");
          if (!mark) return;

          const drift = { x: 0, y: 0 };
          const target = { x: 0, y: 0 };
          let raf = 0;
          let running = false;

          const draw = () => {
            drift.x += (target.x - drift.x) * 0.06;
            drift.y += (target.y - drift.y) * 0.06;
            gsap.set(mark, {
              x: drift.x * 16,
              y: drift.y * 11,
              rotate: drift.x * 0.6,
            });

            if (
              Math.abs(target.x - drift.x) > 0.001 ||
              Math.abs(target.y - drift.y) > 0.001
            ) {
              raf = requestAnimationFrame(draw);
            } else {
              running = false;
            }
          };

          const start = () => {
            if (running) return;
            running = true;
            raf = requestAnimationFrame(draw);
          };

          const onMove = (event: PointerEvent) => {
            const r = el.getBoundingClientRect();
            target.x = ((event.clientX - r.left) / r.width - 0.5) * 2;
            target.y = ((event.clientY - r.top) / r.height - 0.5) * 2;
            start();
          };

          const onLeave = () => {
            target.x = 0;
            target.y = 0;
            start();
          };

          window.addEventListener("pointermove", onMove, { passive: true });
          document.addEventListener("pointerleave", onLeave);

          return () => {
            window.removeEventListener("pointermove", onMove);
            document.removeEventListener("pointerleave", onLeave);
            cancelAnimationFrame(raf);
          };
        },
      );

      /*
       * The handoff: the hero mark becomes the header mark.
       *
       * Desktop only. On a phone the mark sits in the middle of the column and
       * has nowhere to travel to that would read as anything but a glitch.
       *
       * Mechanically the flying element is switched to `position: fixed` at its
       * resting spot, so its start point stops moving with the page and the
       * whole journey is one static delta rather than a per-frame recalculation
       * against a target that scrolls. `[data-mark-slot]` keeps the layout box
       * — it carries the mark's aspect ratio, so the grid column holds its
       * width whether or not the mark is still in flow.
       *
       * It is also lifted out to <body> for the duration. The hero section
       * isolates its own stacking context, so a mark left inside it paints
       * *under* the header no matter what z-index it carries, and spent the
       * last stretch of the journey hidden behind the very bar it was flying
       * into. Reparenting is what GSAP's own `pinReparent` does for the same
       * reason; the cleanup below puts it back before React unmounts the slot.
       */
      mm.add(
        "(min-width: 1024px) and (prefers-reduced-motion: no-preference)",
        () => {
          const slot = el.querySelector<HTMLElement>("[data-mark-slot]");
          const fly = el.querySelector<HTMLElement>("[data-mark-fly]");
          const copy = el.querySelector<HTMLElement>("[data-hero-copy]");
          const navMark =
            document.querySelector<HTMLElement>("[data-nav-mark]");
          if (!slot || !fly || !copy || !navMark) return;

          /*
           * The header's mark waits as a ghost rather than as nothing. Held at
           * zero it left a visible hole beside the wordmark for the whole
           * journey, which reads as a missing image; at a tenth of an opacity
           * it reads as the socket the arriving mark plugs into. Set from JS
           * rather than in the markup so that a visitor without JavaScript —
           * or on a phone, or with reduced motion — still gets a whole header.
           */
          const GHOST = 0.12;
          gsap.set(navMark, { opacity: GHOST });

          // Move it up the tree so it can clear the header. Same node, so the
          // draw animation already running inside it is undisturbed.
          document.body.appendChild(fly);

          let home = { x: 0, y: 0, h: 1 };
          let dest = { x: 0, y: 0, h: 1 };

          const measure = (start: number) => {
            gsap.set(fly, {
              clearProps: "position,left,top,width,height,transform,opacity",
            });

            const r = slot.getBoundingClientRect();
            // Where the slot sits when the trigger is at progress 0, which is
            // not necessarily now — a reload restores the previous scroll.
            const restTop = r.top + window.scrollY - start;

            home = {
              x: r.left + r.width / 2,
              y: restTop + r.height / 2,
              h: r.height || 1,
            };

            gsap.set(fly, {
              position: "fixed",
              left: r.left,
              top: restTop,
              width: r.width,
              height: r.height,
              // Above the header (z-20) so the last stretch of the journey is
              // visible rather than hidden behind the bar it is landing on.
              zIndex: 40,
              pointerEvents: "none",
            });

            const n = navMark.getBoundingClientRect();
            dest = {
              x: n.left + n.width / 2,
              y: n.top + n.height / 2,
              h: n.height || 1,
            };
          };

          const apply = (p: number) => {
            // The swap happens in the last breath of the journey, when the two
            // marks are already the same size in the same place, so it reads as
            // one object arriving rather than a dissolve between two.
            const swap = gsap.utils.clamp(0, 1, (p - 0.94) / 0.06);

            /*
             * The copy clears out ahead of the mark. Its path from the right of
             * the section to the header runs diagonally through the headline
             * and paragraph — which are themselves rising to meet it as the
             * page scrolls — and a monogram sliding across live body text is
             * just text you cannot read. Fading the words as they leave hands
             * the section over to the mark instead of fighting it.
             */
            const copyOut = gsap.utils.clamp(0, 1, p / 0.6);
            gsap.set(copy, {
              opacity: 1 - copyOut,
              pointerEvents: copyOut > 0.9 ? "none" : "auto",
            });

            gsap.set(fly, {
              x: (dest.x - home.x) * p,
              y: (dest.y - home.y) * p,
              scale: 1 + (dest.h / home.h - 1) * p,
              opacity: 1 - swap,
            });
            gsap.set(navMark, { opacity: GHOST + (1 - GHOST) * swap });
          };

          const trigger = ScrollTrigger.create({
            trigger: el,
            start: "top top",
            /*
             * A measured distance, not "bottom something". Anchoring the end to
             * the hero's own bottom edge gave the whole journey 81px of scroll,
             * because by then the hero is already most of the way out of the
             * viewport — the mark shot into the header in one flick of the
             * wheel. This gives it most of a screen to cross.
             */
            end: () => "+=" + Math.round(el.offsetHeight * 0.85),
            invalidateOnRefresh: true,
            onRefresh: (self) => {
              measure(self.start);
              apply(self.progress);
            },
            onUpdate: (self) => apply(self.progress),
          });

          return () => {
            trigger.kill();
            gsap.set(fly, {
              clearProps:
                "position,left,top,width,height,transform,opacity,zIndex,pointerEvents",
            });
            gsap.set(navMark, { clearProps: "opacity" });
            gsap.set(copy, { clearProps: "opacity,pointerEvents" });
            // Back where React put it, before React comes looking for it.
            slot.appendChild(fly);
          };
        },
      );
    }, el);

    return () => ctx.revert();
  }, []);

  return (
    <section
      ref={root}
      className="relative isolate flex min-h-[86svh] items-center overflow-hidden py-[clamp(2rem,5vh,4rem)] lg:min-h-[74svh]"
    >
      {/* Atmosphere: a wide, weak wash and a fine grain. Flat colour was most
          of why the old hero read as a wireframe. The close light lives on the
          mark itself so it travels with it. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-20"
        style={{
          background:
            "radial-gradient(85% 66% at 50% 24%, color-mix(in oklab, var(--color-jx) 10%, transparent), transparent 76%)",
        }}
      />
      <div aria-hidden="true" className="grain -z-20" />

      {/*
        Two compositions, one DOM order. Stacked and centred up to `lg`; a
        two-column grid above it, placed explicitly rather than by source order
        so the eyebrow can sit above the headline in the text column while still
        preceding the mark in the markup — the order that reads correctly
        stacked.

        The gutter lives inside the container rather than on the section so the
        text lands on the same rail as the header's logo and every section below
        it, and the mark's outer edge on the same rail as the header's button;
        section-level padding offset the whole hero by 40px against the rest of
        the page.
      */}
      <div
        data-hero-copy
        className="mx-auto flex w-full max-w-6xl flex-col items-center px-6 text-center sm:px-10 lg:grid lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center lg:gap-x-14 lg:text-left xl:gap-x-20">
        <p
          data-rise
          className="font-mono text-[0.7rem] uppercase tracking-[0.2em] text-[var(--fg-faint)] lg:col-start-1 lg:row-start-1"
        >
          {labels.eyebrow}
        </p>

        {/*
          Every stacked gap is measured in viewport *height*, so a short laptop
          screen compresses the whole column evenly instead of pushing the
          button off the bottom — which is what fixed rem spacing did here.

          The slot carries the mark's own aspect ratio so it reserves the right
          box on its own; the flying element inside it leaves the flow on
          desktop and the grid column must not collapse when it does.
        */}
        <div
          data-mark-slot
          aria-hidden="true"
          className="pointer-events-none mt-[clamp(1.25rem,4vh,2.75rem)] aspect-[1000/587] h-[clamp(80px,16vh,172px)] lg:col-start-2 lg:row-span-4 lg:row-start-1 lg:mt-0 lg:h-[clamp(150px,26vh,250px)] lg:self-center"
        >
          <div data-mark-fly className="h-full w-full">
            <div
              data-mark-wrap
              className="relative h-full w-full text-[var(--fg)] will-change-transform"
            >
              {/* The close light, attached to the mark rather than to the
                  section, so it travels and shrinks with it. */}
              <span
                className="absolute left-1/2 top-1/2 -z-10 h-[220%] w-[190%] -translate-x-1/2 -translate-y-1/2 lg:h-[170%] lg:w-[150%]"
                style={{
                  background:
                    "radial-gradient(closest-side, color-mix(in oklab, var(--color-jx) 17%, transparent), transparent)",
                }}
              />
              <DrawnMark className="h-full w-full" />
            </div>
          </div>
        </div>

        <h1
          data-rise
          className="mt-[clamp(1.5rem,4.5vh,3rem)] font-display text-[clamp(2.4rem,6.4vw,5.2rem)] font-semibold leading-[0.94] tracking-[-0.035em] text-balance lg:col-start-1 lg:row-start-2 lg:mt-4 lg:text-[clamp(3rem,5vw,5rem)]"
        >
          <span className="block">{first},</span>
          {rest.length > 0 && (
            <span className="block text-[var(--link)]">
              {rest.join(",").trim()}
            </span>
          )}
        </h1>

        <p
          data-rise
          className="mt-[clamp(1rem,2.5vh,1.75rem)] max-w-[54ch] text-lg leading-relaxed text-[var(--fg-dim)] lg:col-start-1 lg:row-start-3 lg:mt-6 lg:max-w-[48ch]"
        >
          {body}
        </p>

        <div
          data-rise
          className="mt-[clamp(1.5rem,3.5vh,2.5rem)] flex flex-wrap items-center justify-center gap-x-7 gap-y-4 lg:col-start-1 lg:row-start-4 lg:mt-9 lg:justify-start"
        >
          <Link href="/contact" data-hero-cta className="cta">
            {labels.cta}
          </Link>
          <Link
            href="#work"
            className="group inline-flex items-center gap-2 text-sm text-[var(--fg)] underline-offset-8 hover:underline"
          >
            {labels.seeWork}
            <span
              aria-hidden="true"
              className="transition-transform duration-200 group-hover:translate-x-1"
            >
              →
            </span>
          </Link>
        </div>
      </div>
    </section>
  );
}
