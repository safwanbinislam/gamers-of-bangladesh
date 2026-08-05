"use client";

import Link from "next/link";

const GAMES = [
  { value: "free_fire", label: "Free Fire" },
  { value: "pubg_mobile", label: "PUBG Mobile" },
  { value: "mobile_legends", label: "Mobile Legends" },
  { value: "other", label: "Other" },
] as const;

interface SquadGameTabsProps {
  currentGame: string;
}

export function SquadGameTabs({ currentGame }: SquadGameTabsProps) {
  return (
    <div className="flex bg-dark-surface-2 rounded-xl p-1 overflow-x-auto">
      {GAMES.map((g) => {
        const active = g.value === currentGame;
        return (
          <Link
            key={g.value}
            href={`/squads?game=${g.value}`}
            className={`flex-1 min-w-[100px] py-2 text-sm font-medium rounded-lg text-center transition-colors ${
              active ? "bg-dark-surface text-text-primary shadow-sm" : "text-text-muted hover:text-text-secondary"
            }`}
          >
            {g.label}
          </Link>
        );
      })}
    </div>
  );
}