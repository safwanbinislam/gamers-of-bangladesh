"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { deleteGameStat } from "@/lib/actions/passport";
import { showToast } from "@/components/Toast";
import { GameStatEditForm } from "@/components/GameStatEditForm";
import { getGameLabel } from "@/lib/utils";
import type { PassportGameStat } from "@/lib/passport/types";

interface EditStatsClientProps {
  playerId: string;
  gameStats: PassportGameStat[];
}

export function EditStatsClient({ playerId, gameStats }: EditStatsClientProps) {
  const router = useRouter();
  const [stats, setStats] = useState<PassportGameStat[]>(gameStats);
  const [editingGame, setEditingGame] = useState<string | null>(null);
  const [deletingGame, setDeletingGame] = useState<string | null>(null);

  const handleSaved = () => {
    setEditingGame(null);
    // Re-fetch the server component data so the list reflects the new entry.
    router.refresh();
  };

  const handleDelete = async (game: string) => {
    if (!confirm(`Delete your ${getGameLabel(game)} stats?`)) return;
    setDeletingGame(game);
    const result = await deleteGameStat(game);
    setDeletingGame(null);

    if (result.success) {
      showToast("success", "Game stats deleted");
      setStats((prev) => prev.filter((s) => s.game !== game));
      if (editingGame === game) setEditingGame(null);
    } else {
      showToast("error", result.message ?? "Failed to delete game stats");
    }
  };

  const existing = editingGame ? stats.find((s) => s.game === editingGame) ?? null : null;

  return (
    <div className="space-y-6">
      {/* Add / edit form */}
      <GameStatEditForm
        playerId={playerId}
        existing={existing}
        onSaved={handleSaved}
      />

      {/* Existing entries */}
      <div className="bg-dark-surface border border-dark-border rounded-xl p-4">
        <h2 className="text-xs font-medium text-text-muted uppercase tracking-wide mb-3">Your Entries</h2>
        {stats.length === 0 ? (
          <p className="text-sm text-text-muted">You haven't added any game stats yet.</p>
        ) : (
          <div className="space-y-2">
            {stats.map((stat) => (
              <div
                key={stat.game}
                className="flex items-center justify-between gap-3 bg-dark-surface-2 border border-dark-border rounded-lg p-3"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-text-primary">{getGameLabel(stat.game)}</p>
                  <p className="text-xs text-text-secondary truncate">{stat.in_game_name}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => setEditingGame(stat.game)}
                    className="text-xs px-3 py-1.5 rounded-lg bg-dark-surface border border-dark-border text-text-secondary hover:border-primary/40 hover:text-text-primary transition-colors"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(stat.game)}
                    disabled={deletingGame === stat.game}
                    className="text-xs px-3 py-1.5 rounded-lg bg-red-950/40 border border-red-900/50 text-red-300 hover:bg-red-900/40 transition-colors disabled:opacity-50"
                  >
                    {deletingGame === stat.game ? "Deleting..." : "Delete"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}