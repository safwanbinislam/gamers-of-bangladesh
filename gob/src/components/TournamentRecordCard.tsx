interface TournamentRecordCardProps {
  tournamentsPlayed: number;
  tournamentsWon: number;
  bestPlacement: number | null;
  totalMatchesWon: number;
  totalMatchesPlayed: number;
}

function formatPlacement(placement: number | null): string {
  if (placement === null) return "—";
  const suffix =
    placement % 100 >= 11 && placement % 100 <= 13
      ? "th"
      : placement % 10 === 1
      ? "st"
      : placement % 10 === 2
      ? "nd"
      : placement % 10 === 3
      ? "rd"
      : "th";
  return `${placement}${suffix} Place`;
}

export function TournamentRecordCard({
  tournamentsPlayed,
  tournamentsWon,
  bestPlacement,
  totalMatchesWon,
  totalMatchesPlayed,
}: TournamentRecordCardProps) {
  return (
    <div className="bg-dark-surface border border-dark-border rounded-xl p-4">
      <h2 className="text-xs font-medium text-text-muted uppercase tracking-wide mb-3">Tournament Record</h2>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-2xl font-bold text-text-primary">{tournamentsPlayed}</p>
          <p className="text-xs text-text-muted">Tournaments Played</p>
        </div>
        <div>
          <p className="text-2xl font-bold text-text-primary">{tournamentsWon}</p>
          <p className="text-xs text-text-muted">Tournaments Won</p>
        </div>
        <div>
          <p className="text-2xl font-bold text-primary-light">{formatPlacement(bestPlacement)}</p>
          <p className="text-xs text-text-muted">Best Placement</p>
        </div>
        <div>
          <p className="text-2xl font-bold text-text-primary">
            {totalMatchesWon}
            <span className="text-sm text-text-muted font-normal"> / {totalMatchesPlayed}</span>
          </p>
          <p className="text-xs text-text-muted">Matches Won</p>
        </div>
      </div>
    </div>
  );
}