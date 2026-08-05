"use client";

import { formatBDT, getPayoutStatusLabel } from "@/lib/utils";

interface Payout {
  id: string;
  placement: number;
  player_id: string;
  amount_bdt: number;
  payout_status: string;
  paid_at: string | null;
  player?: { id: string; username: string } | null;
}

interface PayoutsListProps {
  payouts: Payout[];
}

export function PayoutsList({ payouts }: PayoutsListProps) {
  if (payouts.length === 0) {
    return (
      <div className="bg-dark-surface border border-dark-border rounded-xl p-6 text-center">
        <p className="text-text-muted text-sm">No payouts have been processed yet.</p>
      </div>
    );
  }

  return (
    <div className="bg-dark-surface border border-dark-border rounded-xl overflow-hidden">
      <div className="p-4 border-b border-dark-border">
        <h3 className="font-semibold text-text-primary">Prize Payouts</h3>
      </div>
      <div className="divide-y divide-dark-border">
        {payouts.map((payout) => {
          const statusColor =
            payout.payout_status === "paid"
              ? "text-emerald-400 bg-emerald-900/30"
              : payout.payout_status === "failed"
              ? "text-red-300 bg-red-900/30"
              : "text-amber-300 bg-amber-900/30";

          return (
            <div key={payout.id} className="flex items-center justify-between px-4 py-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-primary-subtle text-primary-light flex items-center justify-center font-bold text-xs">
                  #{payout.placement}
                </div>
                <div>
                  <p className="text-sm font-medium text-text-primary">
                    {payout.player?.username ?? `Player ${payout.player_id.slice(0, 8)}`}
                  </p>
                  <p className="text-xs text-text-muted">
                    {payout.placement === 1
                      ? "1st Place"
                      : payout.placement === 2
                      ? "2nd Place"
                      : payout.placement === 3
                      ? "3rd Place"
                      : `${payout.placement}th Place`}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold text-primary-light">{formatBDT(payout.amount_bdt)}</p>
                <span className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium ${statusColor}`}>
                  {getPayoutStatusLabel(payout.payout_status)}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}