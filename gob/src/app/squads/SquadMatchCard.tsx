"use client";

import { useState } from "react";
import Link from "next/link";
import { requestSquadSession } from "@/lib/actions/squadFinder";
import { showToast } from "@/components/Toast";
import type { SquadMatch } from "@/lib/actions/squadFinder";

interface SquadMatchCardProps {
  match: SquadMatch;
  game: string;
}

export function SquadMatchCard({ match, game }: SquadMatchCardProps) {
  const [isRequesting, setIsRequesting] = useState(false);
  const [requested, setRequested] = useState(false);
  const [scheduledAt, setScheduledAt] = useState("");

  const handleRequest = async () => {
    setIsRequesting(true);
    // datetime-local yields a local "YYYY-MM-DDTHH:mm" value (no timezone).
    // Convert to a UTC ISO string (Z suffix) which the Zod schema requires.
    const result = await requestSquadSession({
      recipient_id: match.player_id,
      game,
      scheduled_at: scheduledAt ? new Date(scheduledAt).toISOString() : null,
    });
    setIsRequesting(false);
    if (result.success) {
      setRequested(true);
      showToast("success", `Squad request sent to ${match.username}`);
    } else {
      showToast("error", result.message ?? "Failed to send squad request");
    }
  };

  const noGhost = match.no_ghost_score;

  return (
    <div className="bg-dark-surface border border-dark-border rounded-xl p-4 hover:border-primary/40 transition-all">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <Link href={`/players/${match.player_id}`} className="shrink-0">
            <div className="w-11 h-11 rounded-full bg-primary-subtle text-primary-light flex items-center justify-center text-lg font-bold">
              {match.username[0]?.toUpperCase() ?? "?"}
            </div>
          </Link>
          <div className="min-w-0">
            <Link href={`/players/${match.player_id}`} className="font-semibold text-sm text-text-primary hover:text-primary-light truncate block">
              {match.username}
            </Link>
            <div className="flex items-center gap-2 text-xs text-text-muted mt-0.5">
              <span className="text-amber-400">★</span>
              <span>{match.reputation_score.toFixed(1)}</span>
              {match.rank_or_level && <><span>·</span><span>{match.rank_or_level}</span></>}
              {match.region && <><span>·</span><span>{match.region}</span></>}
            </div>
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-lg font-bold text-primary-light">{match.compatibility_score}%</div>
          <div className="text-[10px] text-text-muted uppercase tracking-wide">Match</div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 mt-3 text-xs">
        {match.shared_days.length > 0 && (
          <span className="bg-dark-surface-2 px-2 py-0.5 rounded text-text-secondary">
            🗓 {match.shared_days.map((d) => d[0].toUpperCase() + d.slice(1, 3)).join(", ")}
          </span>
        )}
        {match.hours_overlap > 0 && (
          <span className="bg-dark-surface-2 px-2 py-0.5 rounded text-text-secondary">⏰ {match.hours_overlap}h overlap</span>
        )}
        <span className="bg-dark-surface-2 px-2 py-0.5 rounded text-text-secondary">
          {noGhost === null ? (
            <span className="text-text-muted">No track record yet</span>
          ) : (
            <span className={noGhost >= 80 ? "text-emerald-300" : noGhost >= 50 ? "text-amber-300" : "text-red-300"}>
              🛡 {noGhost}% no-ghost
            </span>
          )}
        </span>
      </div>

      <div className="mt-4 space-y-3">
        <div>
          <label
            htmlFor={`scheduled-${match.player_id}`}
            className="block text-xs text-text-muted mb-1"
          >
            Schedule (optional)
          </label>
          <input
            id={`scheduled-${match.player_id}`}
            type="datetime-local"
            value={scheduledAt}
            onChange={(e) => setScheduledAt(e.target.value)}
            disabled={isRequesting || requested}
            className="w-full rounded-lg border border-dark-border-light px-3 py-2 text-sm bg-dark-surface text-text-primary placeholder-text-muted focus:border-primary focus:ring-1 focus:ring-primary disabled:opacity-50"
          />
        </div>

        <div className="flex items-center justify-between pt-3 border-t border-dark-border">
          <Link href={`/players/${match.player_id}`} className="text-xs text-text-secondary hover:text-primary-light">View profile</Link>
          <button
            onClick={handleRequest}
            disabled={isRequesting || requested}
            className={`px-4 py-1.5 text-sm font-medium rounded-lg transition-colors ${requested ? "bg-dark-surface-2 text-text-muted cursor-default" : "btn-primary"}`}
          >
            {isRequesting ? "Sending..." : requested ? "Request Sent ✓" : "Request to Squad"}
          </button>
        </div>
      </div>
    </div>
  );
}