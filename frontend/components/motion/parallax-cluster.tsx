"use client";

import Image from "next/image";
import { useEffect, useRef } from "react";

/**
 * The hero's visual: two real client sites, stacked, drifting slightly with the
 * pointer.
 *
 * Motion is driven by the mouse rather than by scroll on purpose. Scroll-linked
 * effects are what every agency site reaches for first; pointer-reactive depth
 * is rarer, and — more to the point here — it happens while the visitor is
 * still reading the headline instead of only after they leave it.
 *
 * The layers are laid out entirely in CSS. This only adds an offset on top, so
 * the resting composition is whatever the server rendered: correct with no JS,
 * correct on a touch screen, correct under reduced motion.
 */

type Layer = {
  slug: string;
  alt: string;
  /** How far this layer drifts, in px at the edge of the container. */
  depth: number;
  className: string;
};

const LAYERS: Layer[] = [
  {
    slug: "families-tours",
    alt: "Families Tours — a site we built",
    depth: 10,
    className:
      "absolute right-0 top-0 w-[74%] rotate-[1.5deg] opacity-90 md:w-[70%]",
  },
  {
    slug: "globale-explore-tours",
    alt: "Globale Explore Tours — a site we built",
    depth: 24,
    className:
      "absolute bottom-0 left-0 w-[82%] -rotate-[1deg] md:w-[78%]",
  },
];

export function ParallaxCluster() {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const fine = window.matchMedia("(pointer: fine)");
    if (reduced.matches || !fine.matches) return;

    const layers = Array.from(
      host.querySelectorAll<HTMLElement>("[data-depth]")
    );

    let targetX = 0;
    let targetY = 0;
    let currentX = 0;
    let currentY = 0;
    let raf = 0;
    let running = false;

    const draw = () => {
      // Ease toward the pointer rather than snapping to it — the lag is what
      // makes it read as weight instead of as a cursor follower.
      currentX += (targetX - currentX) * 0.075;
      currentY += (targetY - currentY) * 0.075;

      for (const layer of layers) {
        const depth = Number(layer.dataset.depth ?? 0);
        layer.style.transform = `translate3d(${currentX * depth}px, ${
          currentY * depth
        }px, 0)`;
      }

      // Stop the loop once it has effectively arrived, so an idle page is not
      // burning a frame callback forever.
      if (Math.abs(targetX - currentX) > 0.001 || Math.abs(targetY - currentY) > 0.001) {
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

    const onPointerMove = (event: PointerEvent) => {
      const rect = host.getBoundingClientRect();
      // -1 .. 1 from the centre of the container
      targetX = ((event.clientX - rect.left) / rect.width - 0.5) * 2;
      targetY = ((event.clientY - rect.top) / rect.height - 0.5) * 2;
      start();
    };

    const onLeave = () => {
      targetX = 0;
      targetY = 0;
      start();
    };

    window.addEventListener("pointermove", onPointerMove, { passive: true });
    document.addEventListener("pointerleave", onLeave);

    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("pointerleave", onLeave);
      cancelAnimationFrame(raf);
      for (const layer of layers) layer.style.transform = "";
    };
  }, []);

  return (
    <div ref={hostRef} className="relative">
      {/*
        One soft light behind the stack. It gives the corner some atmosphere
        without introducing a second colour or a pattern — the homepage stays
        the quiet density.
      */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -inset-[18%] rounded-full opacity-70 blur-3xl"
        style={{
          background:
            "radial-gradient(60% 50% at 60% 40%, color-mix(in oklab, var(--color-jx) 22%, transparent), transparent 70%)",
        }}
      />

      <div className="relative aspect-[4/3.1] w-full">
        {LAYERS.map((layer) => (
          <div
            key={layer.slug}
            data-depth={layer.depth}
            className={`${layer.className} overflow-hidden rounded-lg border border-[var(--hairline)] bg-[var(--panel)] shadow-[0_18px_50px_-20px_rgb(20_22_26_/_0.35)] will-change-transform`}
          >
            <Image
              src={`/work/${layer.slug}-desktop.jpg`}
              alt={layer.alt}
              width={2160}
              height={1350}
              priority
              sizes="(min-width: 1024px) 520px, 80vw"
              className="w-full"
            />
          </div>
        ))}
      </div>
    </div>
  );
}
