/**
 * Renders an inline SVG for a badge icon name (as returned by
 * getBadgeDisplay().icon). The project does not use an icon library —
 * it uses inline SVGs everywhere — so we map the icon-name strings from
 * lib/badges/labels.ts to hand-rolled SVG paths here.
 */

interface BadgeIconProps {
  name: string;
  className?: string;
}

export function BadgeIcon({ name, className = "w-3.5 h-3.5" }: BadgeIconProps) {
  const common = {
    className,
    fill: "none",
    stroke: "currentColor",
    viewBox: "0 0 24 24",
  } as const;

  switch (name) {
    case "BadgeCheck":
      return (
        <svg {...common}>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
        </svg>
      );
    case "TrendingUp":
      return (
        <svg {...common}>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
        </svg>
      );
    case "Trophy":
      return (
        <svg {...common}>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 21h8m-4-4v4m-7-14h14v2a7 7 0 01-14 0V7zm0 0H4a2 2 0 012-2h2m10 0h2a2 2 0 012 2v0a7 7 0 01-14 0" />
        </svg>
      );
    case "Swords":
      return (
        <svg {...common}>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3l6 6m0 0l-2 2m2-2l-2-2m8 8l2 2m-2-2l2-2m-2 2l-2 2m6-6l2-2m-2 2l-2-2M3 21l6-6m-2 2l-2-2m2 2l2-2" />
        </svg>
      );
    case "Award":
    default:
      return (
        <svg {...common}>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15a5 5 0 100-10 5 5 0 000 10zm0 0l1.5 4.5L12 21l-1.5-1.5L12 15z" />
        </svg>
      );
  }
}