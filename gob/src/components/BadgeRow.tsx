import { getBadgeDisplay } from "@/lib/badges/labels";
import { BadgeIcon } from "./BadgeIcon";

interface BadgeRowProps {
  badges: string[];
}

export function BadgeRow({ badges }: BadgeRowProps) {
  if (!badges || badges.length === 0) {
    return (
      <div className="bg-dark-surface border border-dark-border rounded-xl p-4">
        <h2 className="text-xs font-medium text-text-muted uppercase tracking-wide mb-2">Badges</h2>
        <p className="text-sm text-text-muted">No badges yet</p>
      </div>
    );
  }

  return (
    <div className="bg-dark-surface border border-dark-border rounded-xl p-4">
      <h2 className="text-xs font-medium text-text-muted uppercase tracking-wide mb-3">Badges</h2>
      <div className="flex flex-wrap gap-2">
        {badges.map((badge) => {
          const display = getBadgeDisplay(badge);
          return (
            <span
              key={badge}
              title={display.description || display.label}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-text-secondary bg-dark-surface-2 border border-dark-border px-2.5 py-1 rounded-full"
            >
              <span className="text-primary-light">
                <BadgeIcon name={display.icon} />
              </span>
              {display.label}
            </span>
          );
        })}
      </div>
    </div>
  );
}