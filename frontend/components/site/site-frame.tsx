"use client";

import Image from "next/image";
import { useLayoutEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

/**
 * A client's site, browsing itself.
 *
 * The work index used to show one frozen fold per project, which proves only
 * that a homepage exists. Here the whole page is one tall capture and it
 * travels inside the frame as the visitor scrolls past — so in the time it
 * takes to scroll one screen they have seen the entire site, hero to footer,
 * without leaving ours.
 *
 * That is the most honest thing a portfolio can do. There is no claim to
 * believe: the thing itself is on screen, and the real address sits in the bar
 * above it so anyone who doubts it can go and look.
 *
 * Not an iframe, deliberately: most of these sites refuse framing, three live
 * embeds would make this the slowest page we ship, and a client's redesign
 * would silently rewrite our portfolio. A capture plus the live link gives the
 * same proof and stays ours.
 */

type Props = {
  src: string;
  /** The live address — shown in the bar and linked from it. */
  url: string;
  alt: string;
  /** Natural pixel size of the capture; these run to several thousand tall. */
  width: number;
  height: number;
  /** Visible window, as a CSS aspect ratio. */
  ratio?: string;
  priority?: boolean;
};

export function SiteFrame({
  src,
  url,
  alt,
  width,
  height,
  ratio = "16 / 10",
  priority = false,
}: Props) {
  const root = useRef<HTMLDivElement>(null);
  const window_ = useRef<HTMLDivElement>(null);
  const sheet = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const holder = root.current;
    const port = window_.current;
    const page = sheet.current;
    if (!holder || !port || !page) return;

    gsap.registerPlugin(ScrollTrigger);

    const ctx = gsap.context(() => {
      const mm = gsap.matchMedia();

      // Reduced motion keeps the top of the page in view. The capture is still
      // the whole site; it simply does not move.
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        /*
         * Measured on every refresh rather than derived from the ratio: the
         * rendered height depends on the column width, which changes with the
         * breakpoint, and a travel computed once is wrong at every other size.
         */
        const travel = () =>
          Math.max(page.offsetHeight - port.clientHeight, 0);

        const tween = gsap.fromTo(
          page,
          { y: 0 },
          {
            // Pixels, not percentages. A percentage here resolves against the
            // element's own height, which is exactly the number that varies.
            y: () => -travel(),
            ease: "none",
            scrollTrigger: {
              trigger: holder,
              /*
               * Normally the run begins as the frame enters from below. The
               * first frame on the page is already on screen at load, though,
               * and "top bottom" scores that as a quarter of the way through —
               * so the very first thing a visitor saw was a client's site
               * opened somewhere in its middle, hero already gone. Clamping the
               * start to the frame's own resting position means anything
               * visible at load begins at the top of its page, and everything
               * further down still enters from the bottom edge.
               */
              start: () => {
                const fromTop =
                  holder.getBoundingClientRect().top + window.scrollY;
                return `top ${Math.min(fromTop, window.innerHeight)}px`;
              },
              // Runs until the frame has left, so the site is still moving
              // while it is comfortably on screen rather than racing out in
              // the last few pixels.
              end: "bottom top",
              scrub: 0.6,
              invalidateOnRefresh: true,
            },
          },
        );

        return () => {
          tween.scrollTrigger?.kill();
          tween.kill();
          gsap.set(page, { clearProps: "transform" });
        };
      });
    }, holder);

    return () => ctx.revert();
  }, []);

  return (
    <div ref={root} className="overflow-hidden rounded-xl border border-[var(--hairline)] bg-[var(--panel)]">
      {/* The address bar. No traffic-light dots — the point of it is the real
          URL, and a fake macOS chrome would only say "this is a mockup". */}
      <div className="flex items-center gap-3 border-b border-[var(--hairline)] px-4 py-2.5">
        <span
          aria-hidden="true"
          className="h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--link)]"
        />
        <a
          href={url}
          target="_blank"
          rel="noreferrer noopener"
          className="group inline-flex min-w-0 items-center gap-2 font-mono text-[0.7rem] text-[var(--fg-dim)] transition-colors hover:text-[var(--fg)]"
        >
          <span className="truncate">{url.replace(/^https?:\/\//, "")}</span>
          <span
            aria-hidden="true"
            className="shrink-0 transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
          >
            ↗
          </span>
        </a>
      </div>

      <div
        ref={window_}
        className="relative overflow-hidden"
        style={{ aspectRatio: ratio }}
      >
        <div ref={sheet} className="absolute inset-x-0 top-0 will-change-transform">
          <Image
            src={src}
            alt={alt}
            width={width}
            height={height}
            sizes="(min-width: 1024px) 760px, 100vw"
            priority={priority}
            className="block w-full"
          />
        </div>
      </div>
    </div>
  );
}
