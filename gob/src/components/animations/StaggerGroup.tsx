"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * Reveals a group of sibling elements in sequence (a gentle stagger).
 * The reveal classes are applied directly to each direct child so the
 * children keep their own styling/containers — no extra wrapper elements
 * are introduced into the grid layout.
 */
export function StaggerGroup({
  gap = 90,
  className = "",
  children,
}: {
  /** Extra delay (ms) added for each subsequent child. */
  gap?: number;
  className?: string;
  children?: ReactNode;
}) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    if (
      window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
      typeof IntersectionObserver === "undefined"
    ) {
      return; // keep content fully visible
    }

    const items = Array.from(root.children).filter(
      (el): el is HTMLElement => el instanceof HTMLElement
    );
    if (items.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          observer.disconnect();

          // Pass 1: apply the hidden start state and force a style flush so
          // the transition has a stable starting point before we reveal.
          items.forEach((el, index) => {
            el.classList.add("rv-init");
            el.style.transitionDelay = `${index * gap}ms`;
          });
          void root.offsetHeight;

          // Pass 2: reveal each child — transitions start at staggered times.
          items.forEach((el) => {
            el.classList.add("rv-in");
            el.classList.remove("rv-init");
            const cleanup = () => {
              el.classList.remove("rv-in");
              el.style.transitionDelay = "";
            };
            el.addEventListener("transitionend", cleanup, { once: true });
          });
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -8% 0px" }
    );

    observer.observe(root);
    return () => observer.disconnect();
  }, [gap]);

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}