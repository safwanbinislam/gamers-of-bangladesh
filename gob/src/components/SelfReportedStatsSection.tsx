import { getGameLabel } from "@/lib/utils";
import type { PassportGameStat } from "@/lib/passport/types";

interface SelfReportedStatsSectionProps {
  gameStats: PassportGameStat[];
}

export function SelfReportedStatsSection({ gameStats }: SelfReportedStatsSectionProps) {
  return (
    <div className="bg-dark-surface border border-dark-border rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xs font-medium text-text-muted uppercase tracking-wide">Self-Reported Stats</h2>
        <span className="text-[10px] font-medium text-amber-300 bg-amber-900/30 border border-amber-700/40 px-2 py-0.5 rounded-full">
          Self-Reported — Not Verified
        </span>
      </div>

      {!gameStats || gameStats.length === 0 ? (
        <p className="text-sm text-text-muted">No self-reported stats yet</p>
      ) : (
        <div className="space-y-3">
          {gameStats.map((stat) => (
            <div key={stat.game} className="bg-dark-surface-2 border border-dark-border rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-text-secondary bg-dark-surface px-2 py-0.5 rounded-full">
                  {getGameLabel(stat.game)}
                </span>
                <span className="text-[10px] text-amber-300/80">Not Verified</span>
              </div>
              <p className="text-sm font-medium text-text-primary">{stat.in_game_name}</p>
              {stat.rank_or_level && (
                <p className="text-xs text-text-secondary mt-0.5">Rank/Level: {stat.rank_or_level}</p>
              )}
              {stat.stats && Object.keys(stat.stats).length > 0 && (
                <dl className="mt-2 space-y-1">
                  {Object.entries(stat.stats).map(([key, value]) => (
                    <div key={key} className="flex justify-between text-xs">
                      <dt className="text-text-muted capitalize">{key.replace(/_/g, " ")}</dt>
                      <dd className="text-text-primary">{String(value)}</dd>
                    </div>
                  ))}
                </dl>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}