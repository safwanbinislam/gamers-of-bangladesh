interface TradeReputationCardProps {
  reputationScore: number;
  totalTrades: number;
}

export function TradeReputationCard({ reputationScore, totalTrades }: TradeReputationCardProps) {
  return (
    <div className="bg-dark-surface border border-dark-border rounded-xl p-4">
      <h2 className="text-xs font-medium text-text-muted uppercase tracking-wide mb-3">Trading Reputation</h2>
      <div className="flex items-center gap-4">
        {/* Star rating */}
        <div className="flex items-center gap-1">
          <span className="text-amber-400 text-lg">★</span>
          <span className="text-2xl font-bold text-text-primary">{reputationScore.toFixed(1)}</span>
        </div>
        <div className="h-8 w-px bg-dark-border" />
        <div>
          <p className="text-2xl font-bold text-text-primary">{totalTrades}</p>
          <p className="text-xs text-text-muted">Trades</p>
        </div>
      </div>
    </div>
  );
}