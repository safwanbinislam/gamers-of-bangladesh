"use client";

import {
  useEffect,
  useLayoutEffect,
  useRef,
  type ReactNode,
} from "react";

/**
 * Lightweight scroll-reveal primitives for the GOB homepage.
 *
 * Strategy: no animation library. An IntersectionObserver toggles
 * GPU-friendly classes (transform + opacity only, defined in globals.css).
 * Elements are rendered fully visible by default (SSR-safe, works without
 * JS); the hidden init state is applied only when JS is present AND the
 * user has not requested reduced motion.
 */

const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

export type RevealVariant = "up" | "down" | "left" | "right" | "scale" | "fade";

type RevealProps = {
  /** Entrance direction/variant. Defaults to a subtle upward rise. */
  variant?: RevealVariant;
  /** Extra delay before the entrance transition starts (ms). */
  delay?: number;
  className?: string;
  children?: ReactNode;
};

/** Reveals a single element when it scrolls into view. */
export function Reveal({
  variant = "up",
  delay = 0,
  className = "",
  children,
}: RevealProps) {
  const ref = useRef<HTMLDivElement | null>(null);

  useIsomorphicLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (
      window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
      typeof IntersectionObserver === "undefined"
    ) {
      return; // keep content fully visible
    }

    // Start state (applied before paint, so no visible flash).
    el.classList.add("rv-init", `rv-${variant}`);
    el.style.transitionDelay = `${delay}ms`;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          observer.disconnect();
          // End state — triggers the entrance transition.
          el.classList.add("rv-in");
          el.classList.remove("rv-init");
          const cleanup = () => {
            el.classList.remove("rv-in");
            el.style.transitionDelay = "";
          };
          el.addEventListener("transitionend", cleanup, { once: true });
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -8% 0px" }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [variant, delay]);

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}