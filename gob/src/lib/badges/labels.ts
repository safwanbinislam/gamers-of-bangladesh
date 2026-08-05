/**
 * Badge display labels.
 *
 * The database returns raw badge identifiers (e.g. 'verified', 'top_trader')
 * from get_player_badges().  This file maps those identifiers to human-readable
 * display labels, descriptions, and Lucide icon names that the frontend can
 * render directly.
 *
 * IMPORTANT: When a new badge identifier is added to the database, add its
 * mapping here.  If this file hasn't been updated yet, getBadgeDisplay() will
 * return a sensible fallback so the app doesn't crash.
 */

export interface BadgeDisplay {
  label: string;
  description: string;
  icon: string; // Lucide icon name
}

const BADGE_DISPLAY_MAP: Record<string, BadgeDisplay> = {
  verified: {
    label: "Verified",
    description: "Phone number confirmed",
    icon: "BadgeCheck",
  },
  top_trader: {
    label: "Top Trader",
    description: "10+ completed trades",
    icon: "TrendingUp",
  },
  tournament_champion: {
    label: "Tournament Champion",
    description: "Won a tournament",
    icon: "Trophy",
  },
  active_competitor: {
    label: "Active Competitor",
    description: "Played 5+ tournaments",
    icon: "Swords",
  },
};

/**
 * Returns the display mapping for a given badge identifier.
 *
 * If the identifier is not recognised (e.g. a future badge added to the
 * database before this file is updated), a sensible fallback is returned
 * so the frontend never crashes over an unknown badge.
 */
export function getBadgeDisplay(identifier: string): BadgeDisplay {
  const entry = BADGE_DISPLAY_MAP[identifier];
  if (entry) return entry;

  return {
    label: identifier.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
    description: "",
    icon: "Award",
  };
}