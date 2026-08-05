/**
 * Format a number as BDT currency: ৳1,500
 */
export function formatBDT(amount: number): string {
  return `৳${amount.toLocaleString("en-BD")}`;
}

/**
 * Get the color classes for a given escrow status.
 * Used consistently across all components for status badges, steppers, etc.
 */
export function getStatusColor(status: string): {
  bg: string;
  text: string;
  dot: string;
} {
  switch (status) {
    case "awaiting_payment":
      return { bg: "status-awaiting", text: "text-amber-300", dot: "bg-amber-400" };
    case "funds_held":
      return { bg: "status-held", text: "text-emerald-300", dot: "bg-emerald-400" };
    case "item_delivered":
      return { bg: "status-delivered", text: "text-sky-300", dot: "bg-sky-400" };
    case "buyer_confirmed":
    case "released":
    case "auto_released":
      return { bg: "status-completed", text: "text-gray-300", dot: "bg-gray-400" };
    case "disputed":
      return { bg: "status-disputed", text: "text-red-300", dot: "bg-red-400" };
    case "refunded":
      return { bg: "status-refunded", text: "text-orange-300", dot: "bg-orange-400" };
    case "cancelled":
      return { bg: "status-cancelled", text: "text-gray-400", dot: "bg-gray-500" };
    default:
      return { bg: "bg-dark-surface-2", text: "text-text-secondary", dot: "bg-gray-500" };
  }
}

/**
 * Human-readable label for each escrow status.
 */
export function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    awaiting_payment: "Awaiting Payment",
    funds_held: "Funds Held",
    item_delivered: "Item Delivered",
    buyer_confirmed: "Buyer Confirmed",
    released: "Completed",
    disputed: "Disputed",
    refunded: "Refunded",
    cancelled: "Cancelled",
    auto_released: "Auto-Released",
  };
  return labels[status] ?? status.replace(/_/g, " ");
}

/**
 * Get the game display name.
 */
export function getGameLabel(game: string): string {
  const labels: Record<string, string> = {
    free_fire: "Free Fire",
    pubg_mobile: "PUBG Mobile",
    mobile_legends: "Mobile Legends",
    other: "Other",
  };
  return labels[game] ?? game;
}

/**
 * Get the item type display name.
 */
export function getItemTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    account: "Account",
    skin: "Skin",
    uc: "UC",
    diamonds: "Diamonds",
    other: "Other",
  };
  return labels[type] ?? type;
}

/**
 * Tournament status display label.
 */
export function getTournamentStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    draft: "Draft",
    registration_open: "Registration Open",
    registration_closed: "Registration Closed",
    bracket_generated: "Bracket Generated",
    in_progress: "In Progress",
    completed: "Completed",
    cancelled: "Cancelled",
  };
  return labels[status] ?? status.replace(/_/g, " ");
}

/**
 * Color classes for tournament status badges.
 * Mirrors the status badge conventions used in the marketplace (amber=awaiting,
 * emerald=held/active, sky=delivered, gray=completed, red=disputed, orange=refunded).
 */
export function getTournamentStatusColor(status: string): {
  bg: string;
  text: string;
  dot: string;
} {
  switch (status) {
    case "draft":
      return { bg: "bg-dark-surface-2", text: "text-text-muted", dot: "bg-gray-500" };
    case "registration_open":
      return { bg: "status-awaiting", text: "text-amber-300", dot: "bg-amber-400" };
    case "registration_closed":
      return { bg: "bg-dark-surface-2", text: "text-text-secondary", dot: "bg-gray-400" };
    case "bracket_generated":
      return { bg: "status-held", text: "text-emerald-300", dot: "bg-emerald-400" };
    case "in_progress":
      return { bg: "status-delivered", text: "text-sky-300", dot: "bg-sky-400" };
    case "completed":
      return { bg: "status-completed", text: "text-gray-300", dot: "bg-gray-400" };
    case "cancelled":
      return { bg: "status-cancelled", text: "text-gray-400", dot: "bg-gray-500" };
    default:
      return { bg: "bg-dark-surface-2", text: "text-text-secondary", dot: "bg-gray-500" };
  }
}

/**
 * Payout status display label.
 */
export function getPayoutStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    pending: "Pending",
    paid: "Paid",
    failed: "Failed",
  };
  return labels[status] ?? status;
}

/**
 * Squad session status display label.
 */
export function getSquadStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    requested: "Requested",
    accepted: "Accepted",
    declined: "Declined",
    cancelled: "Cancelled",
    completed: "Completed",
  };
  return labels[status] ?? status.replace(/_/g, " ");
}

/**
 * Color classes for squad session status badges.
 * Mirrors the status badge conventions used across the app
 * (amber=awaiting/requested, emerald=held/accepted, gray=completed, red=disputed/declined).
 */
export function getSquadStatusColor(status: string): {
  bg: string;
  text: string;
  dot: string;
} {
  switch (status) {
    case "requested":
      return { bg: "status-awaiting", text: "text-amber-300", dot: "bg-amber-400" };
    case "accepted":
      return { bg: "status-held", text: "text-emerald-300", dot: "bg-emerald-400" };
    case "declined":
      return { bg: "status-disputed", text: "text-red-300", dot: "bg-red-400" };
    case "cancelled":
      return { bg: "status-cancelled", text: "text-gray-400", dot: "bg-gray-500" };
    case "completed":
      return { bg: "status-completed", text: "text-gray-300", dot: "bg-gray-400" };
    default:
      return { bg: "bg-dark-surface-2", text: "text-text-secondary", dot: "bg-gray-500" };
  }
}

/**
 * Match status display label.
 */
export function getMatchStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    pending: "Scheduled",
    ready: "Ready",
    reported: "Reported",
    confirmed: "Confirmed",
  };
  return labels[status] ?? status;
}

/**
 * Client-side fetch wrapper that handles the standard API response shape.
 */
export async function apiFetch<T>(
  url: string,
  options?: RequestInit
): Promise<{ success: boolean; data?: T; code?: string; message?: string }> {
  try {
    const res = await fetch(url, {
      headers: { "Content-Type": "application/json" },
      ...options,
    });
    return await res.json();
  } catch (err) {
    return {
      success: false,
      code: "NETWORK_ERROR",
      message: "Network error. Please check your connection.",
    };
  }
}