"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useCallback } from "react";

const GAMES = [
  { value: "", label: "All Games" },
  { value: "free_fire", label: "Free Fire" },
  { value: "pubg_mobile", label: "PUBG Mobile" },
  { value: "mobile_legends", label: "Mobile Legends" },
  { value: "other", label: "Other" },
];

const STATUSES = [
  { value: "", label: "All Statuses" },
  { value: "registration_open", label: "Registration Open" },
  { value: "registration_closed", label: "Registration Closed" },
  { value: "in_progress", label: "In Progress" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
];

export function TournamentFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const createQueryString = useCallback(
    (updates: Record<string, string>) => {
      const params = new URLSearchParams(searchParams.toString());
      Object.entries(updates).forEach(([key, value]) => {
        if (value) {
          params.set(key, value);
        } else {
          params.delete(key);
        }
      });
      params.set("page", "1");
      return params.toString();
    },
    [searchParams]
  );

  const currentGame = searchParams.get("game") ?? "";
  const currentStatus = searchParams.get("status") ?? "";

  return (
    <div className="bg-dark-surface border border-dark-border rounded-xl p-4 space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="filter-game" className="block text-xs font-semibold text-text-secondary mb-1">
            Game
          </label>
          <select
            id="filter-game"
            value={currentGame}
            onChange={(e) => router.push(`${pathname}?${createQueryString({ game: e.target.value })}`)}
            className="w-full rounded-lg border border-dark-border-light px-3 py-2 text-sm text-text-primary bg-dark-surface focus:border-primary focus:ring-1 focus:ring-primary"
          >
            {GAMES.map((g) => (
              <option key={g.value} value={g.value}>{g.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="filter-status" className="block text-xs font-semibold text-text-secondary mb-1">
            Status
          </label>
          <select
            id="filter-status"
            value={currentStatus}
            onChange={(e) => router.push(`${pathname}?${createQueryString({ status: e.target.value })}`)}
            className="w-full rounded-lg border border-dark-border-light px-3 py-2 text-sm text-text-primary bg-dark-surface focus:border-primary focus:ring-1 focus:ring-primary"
          >
            {STATUSES.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>
      </div>

      {(currentGame || currentStatus) && (
        <button
          onClick={() => router.push(pathname)}
          className="text-sm text-primary-light hover:text-primary font-medium"
        >
          Clear all filters
        </button>
      )}
    </div>
  );
}