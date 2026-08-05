"use client";

import { useState } from "react";
import { upsertGameStat } from "@/lib/actions/passport";
import { showToast } from "@/components/Toast";
import type { PassportGameStat } from "@/lib/passport/types";

const GAMES = [
  { value: "free_fire", label: "Free Fire" },
  { value: "pubg_mobile", label: "PUBG Mobile" },
  { value: "mobile_legends", label: "Mobile Legends" },
  { value: "other", label: "Other" },
];

interface GameStatEditFormProps {
  playerId: string;
  existing: PassportGameStat | null;
  onSaved: () => void;
}

export function GameStatEditForm({ playerId, existing, onSaved }: GameStatEditFormProps) {
  const [game, setGame] = useState(existing?.game ?? "");
  const [inGameName, setInGameName] = useState(existing?.in_game_name ?? "");
  const [rankOrLevel, setRankOrLevel] = useState(existing?.rank_or_level ?? "");
  const [kdRatio, setKdRatio] = useState(
    existing?.stats && typeof existing.stats.kd_ratio === "number" ? String(existing.stats.kd_ratio) : ""
  );
  const [matchesPlayed, setMatchesPlayed] = useState(
    existing?.stats && typeof existing.stats.matches_played === "number" ? String(existing.stats.matches_played) : ""
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    setFieldErrors({});

    // Build the optional stats object from the two labeled fields.
    const stats: Record<string, unknown> = {};
    if (kdRatio.trim() !== "") {
      const parsed = parseFloat(kdRatio);
      if (!isNaN(parsed)) stats.kd_ratio = parsed;
    }
    if (matchesPlayed.trim() !== "") {
      const parsed = parseInt(matchesPlayed, 10);
      if (!isNaN(parsed)) stats.matches_played = parsed;
    }

    const result = await upsertGameStat({
      game,
      in_game_name: inGameName,
      rank_or_level: rankOrLevel.trim() === "" ? null : rankOrLevel,
      stats: Object.keys(stats).length > 0 ? stats : null,
    });

    setIsSubmitting(false);

    if (result.success) {
      showToast("success", existing ? "Game stats updated" : "Game stats added");
      onSaved();
    } else {
      if (result.fieldErrors) setFieldErrors(result.fieldErrors);
      showToast("error", result.message ?? "Failed to save game stats");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-dark-surface border border-dark-border rounded-xl p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-text-primary">
          {existing ? `Edit ${existing.game.replace(/_/g, " ")} stats` : "Add game stats"}
        </h3>
        <span className="text-[10px] font-medium text-amber-300 bg-amber-900/30 border border-amber-700/40 px-2 py-0.5 rounded-full">
          Self-Reported — Not Verified
        </span>
      </div>

      {/* Game */}
      <div>
        <label htmlFor="game" className="block text-sm font-medium text-text-secondary mb-1">
          Game <span className="text-red-400">*</span>
        </label>
        <select
          id="game"
          value={game}
          onChange={(e) => setGame(e.target.value)}
          required
          className="w-full rounded-lg border border-dark-border-light px-3 py-2 text-sm bg-dark-surface text-text-primary focus:border-primary focus:ring-1 focus:ring-primary"
        >
          <option value="" disabled>
            Select a game
          </option>
          {GAMES.map((g) => (
            <option key={g.value} value={g.value}>
              {g.label}
            </option>
          ))}
        </select>
        {fieldErrors.game?.map((e) => (
          <p key={e} className="text-sm text-red-300 mt-1">
            {e}
          </p>
        ))}
      </div>

      {/* In-game name */}
      <div>
        <label htmlFor="in_game_name" className="block text-sm font-medium text-text-secondary mb-1">
          In-Game Name <span className="text-red-400">*</span>
        </label>
        <input
          id="in_game_name"
          type="text"
          value={inGameName}
          onChange={(e) => setInGameName(e.target.value)}
          required
          minLength={2}
          maxLength={32}
          placeholder="e.g. ProSniper99"
          className="w-full rounded-lg border border-dark-border-light px-3 py-2 text-sm bg-dark-surface text-text-primary placeholder-text-muted focus:border-primary focus:ring-1 focus:ring-primary"
        />
        {fieldErrors.in_game_name?.map((e) => (
          <p key={e} className="text-sm text-red-300 mt-1">
            {e}
          </p>
        ))}
      </div>

      {/* Rank / level */}
      <div>
        <label htmlFor="rank_or_level" className="block text-sm font-medium text-text-secondary mb-1">
          Rank / Level
        </label>
        <input
          id="rank_or_level"
          type="text"
          value={rankOrLevel}
          onChange={(e) => setRankOrLevel(e.target.value)}
          maxLength={50}
          placeholder="e.g. Heroic, Ace, Mythic"
          className="w-full rounded-lg border border-dark-border-light px-3 py-2 text-sm bg-dark-surface text-text-primary placeholder-text-muted focus:border-primary focus:ring-1 focus:ring-primary"
        />
        {fieldErrors.rank_or_level?.map((e) => (
          <p key={e} className="text-sm text-red-300 mt-1">
            {e}
          </p>
        ))}
      </div>

      {/* Optional extra stats — kept simple with two labeled fields */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="kd_ratio" className="block text-sm font-medium text-text-secondary mb-1">
            K/D Ratio
          </label>
          <input
            id="kd_ratio"
            type="number"
            step="0.01"
            min="0"
            value={kdRatio}
            onChange={(e) => setKdRatio(e.target.value)}
            placeholder="e.g. 3.2"
            className="w-full rounded-lg border border-dark-border-light px-3 py-2 text-sm bg-dark-surface text-text-primary placeholder-text-muted focus:border-primary focus:ring-1 focus:ring-primary"
          />
        </div>
        <div>
          <label htmlFor="matches_played" className="block text-sm font-medium text-text-secondary mb-1">
            Matches Played
          </label>
          <input
            id="matches_played"
            type="number"
            min="0"
            step="1"
            value={matchesPlayed}
            onChange={(e) => setMatchesPlayed(e.target.value)}
            placeholder="e.g. 500"
            className="w-full rounded-lg border border-dark-border-light px-3 py-2 text-sm bg-dark-surface text-text-primary placeholder-text-muted focus:border-primary focus:ring-1 focus:ring-primary"
          />
        </div>
      </div>

      <button type="submit" disabled={isSubmitting} className="w-full btn-primary py-2.5">
        {isSubmitting ? "Saving..." : existing ? "Update Stats" : "Add Stats"}
      </button>
    </form>
  );
}