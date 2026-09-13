"use client";

import { useEffect } from "react";
import Lenis from "lenis";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

/**
 * Smooth scroll, wired to GSAP's ticker.
 *
 * Mounted once at the layout so every pinned or scrubbed section on the site
 * shares one scroll loop. Running Lenis and ScrollTrigger on separate clocks is
 * the standard way to get pinned sections that jitter — they have to be driven
 * by the same frame.
 *
 * Does nothing at all under `prefers-reduced-motion`: the page keeps the
 * browser's own scrolling, and every ScrollTrigger elsewhere checks the same
 * setting before it animates.
 */
export function SmoothScroll() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    gsap.registerPlugin(ScrollTrigger);

    const lenis = new Lenis({
      // 0.09 is deliberately heavier than the default. It is what makes the
      // page feel like it has mass rather than like scrolling is delayed.
      lerp: 0.09,
      wheelMultiplier: 1,
    });

    lenis.on("scroll", ScrollTrigger.update);

    const raf = (time: number) => lenis.raf(time * 1000);
    gsap.ticker.add(raf);
    gsap.ticker.lagSmoothing(0);

    return () => {
      gsap.ticker.remove(raf);
      lenis.destroy();
    };
  }, []);

  return null;
}
