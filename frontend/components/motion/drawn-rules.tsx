"use client";

import { useLayoutEffect, useRef } from "react";
import gsap from "gsap";

/**
 * Inks the rules of a drawing sheet.
 *
 * Wraps a block and draws every `[data-rule]` inside it — horizontal rules from
 * their left edge, vertical ones from their top — so a bordered layout assembles
 * itself the way a pen goes round a sheet rather than simply appearing.
 *
 * It is the same gesture as the homepage's mark and the process spine, and
 * deliberately so: the site has one motion idea, applied to three different
 * things, instead of three effects. Geometry stays in the markup — this only
 * animates what it finds, so a layout change needs no change here.
 *
 * Rules are full-size in the markup and scaled down inside `useLayoutEffect`,
 * which runs before paint. No flash, and no JavaScript means a finished sheet.
 */
export function DrawnRules({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const root = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const el = root.current;
    if (!el) return;

    const ctx = gsap.context(() => {
      const mm = gsap.matchMedia();

      // Reduced motion gets the finished sheet. There is no reduced version of
      // a line: either it is drawn or the layout has no edges.
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        const across = gsap.utils.toArray<HTMLElement>('[data-rule="x"]');
        const down = gsap.utils.toArray<HTMLElement>('[data-rule="y"]');
        if (!across.length && !down.length) return;

        gsap.set(across, { transformOrigin: "left center", scaleX: 0 });
        gsap.set(down, { transformOrigin: "center top", scaleY: 0 });

        const tl = gsap.timeline({ delay: 0.12 });

        // Across first, then down: a sheet reads as ruled off horizontally and
        // then divided, and doing both at once just looks like a fade.
        tl.to(across, {
          scaleX: 1,
          duration: 0.6,
          ease: "power2.inOut",
          stagger: 0.08,
        }).to(
          down,
          { scaleY: 1, duration: 0.5, ease: "power2.inOut", stagger: 0.07 },
          "-=0.4",
        );

        return () => {
          gsap.set([...across, ...down], {
            clearProps: "transform,transformOrigin",
          });
        };
      });
    }, el);

    return () => ctx.revert();
  }, []);

  return (
    <div ref={root} className={className}>
      {children}
    </div>
  );
}
