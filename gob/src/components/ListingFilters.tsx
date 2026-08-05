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

const ITEM_TYPES = [
  { value: "", label: "All Types" },
  { value: "account", label: "Account" },
  { value: "skin", label: "Skin" },
  { value: "uc", label: "UC" },
  { value: "diamonds", label: "Diamonds" },
  { value: "other", label: "Other" },
];

export function ListingFilters() {
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
  const currentItemType = searchParams.get("item_type") ?? "";
  const currentMinPrice = searchParams.get("min_price") ?? "";
  const currentMaxPrice = searchParams.get("max_price") ?? "";

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
          <label htmlFor="filter-type" className="block text-xs font-semibold text-text-secondary mb-1">
            Type
          </label>
          <select
            id="filter-type"
            value={currentItemType}
            onChange={(e) => router.push(`${pathname}?${createQueryString({ item_type: e.target.value })}`)}
            className="w-full rounded-lg border border-dark-border-light px-3 py-2 text-sm text-text-primary bg-dark-surface focus:border-primary focus:ring-1 focus:ring-primary"
          >
            {ITEM_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="block text-xs font-semibold text-text-secondary mb-1">Price Range (BDT)</label>
        <div className="flex gap-2 items-center">
          <input
            type="number"
            placeholder="Min"
            value={currentMinPrice}
            onChange={(e) => router.push(`${pathname}?${createQueryString({ min_price: e.target.value })}`)}
            className="w-full rounded-lg border border-dark-border-light px-3 py-2 text-sm text-text-primary placeholder-text-muted bg-dark-surface focus:border-primary focus:ring-1 focus:ring-primary"
            min="0"
          />
          <span className="text-text-muted font-medium">—</span>
          <input
            type="number"
            placeholder="Max"
            value={currentMaxPrice}
            onChange={(e) => router.push(`${pathname}?${createQueryString({ max_price: e.target.value })}`)}
            className="w-full rounded-lg border border-dark-border-light px-3 py-2 text-sm text-text-primary placeholder-text-muted bg-dark-surface focus:border-primary focus:ring-1 focus:ring-primary"
            min="0"
          />
        </div>
      </div>

      {(currentGame || currentItemType || currentMinPrice || currentMaxPrice) && (
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