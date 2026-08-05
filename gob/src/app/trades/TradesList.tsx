"use client";

import { useState } from "react";
import Link from "next/link";
import { formatBDT, getStatusColor, getStatusLabel, getGameLabel, getItemTypeLabel } from "@/lib/utils";

interface TradeSummary {
  id: string;
  status: string;
  amount_bdt: number;
  created_at: string;
  listing: { id: string; title: string; game: string; item_type: string } | null;
  seller?: { id: string; username: string; reputation_score: number; total_trades: number } | null;
  buyer?: { id: string; username: string; reputation_score: number; total_trades: number } | null;
}

interface TradesListProps {
  buyingTrades: TradeSummary[];
  sellingTrades: TradeSummary[];
}

export function TradesList({ buyingTrades, sellingTrades }: TradesListProps) {
  const [activeTab, setActiveTab] = useState<"buying" | "selling">("buying");
  const trades = activeTab === "buying" ? buyingTrades : sellingTrades;

  return (
    <div className="space-y-4">
      <div className="flex bg-dark-surface-2 rounded-xl p-1">
        <button onClick={() => setActiveTab("buying")}
          className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${activeTab === "buying" ? "bg-dark-surface text-text-primary shadow-sm" : "text-text-muted"}`}>
          Buying ({buyingTrades.length})
        </button>
        <button onClick={() => setActiveTab("selling")}
          className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${activeTab === "selling" ? "bg-dark-surface text-text-primary shadow-sm" : "text-text-muted"}`}>
          Selling ({sellingTrades.length})
        </button>
      </div>

      {trades.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-5xl mb-4">🤝</div>
          <h3 className="font-semibold text-text-primary text-lg">No active trades</h3>
          <p className="text-text-muted text-sm mt-1">
            {activeTab === "buying" ? "Browse the marketplace to start a trade." : "Create a listing to start selling."}
          </p>
          {activeTab === "buying" && (
            <Link href="/marketplace" className="inline-block mt-4 btn-primary px-6 py-2 text-sm">Browse Marketplace</Link>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {trades.map((trade) => {
            const statusColors = getStatusColor(trade.status);
            const otherParty = activeTab === "buying" ? trade.seller : trade.buyer;
            return (
              <Link key={trade.id} href={`/trades/${trade.id}`}
                className="block bg-dark-surface border border-dark-border rounded-xl p-4 hover:border-primary/40 transition-all">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <h3 className="font-medium text-sm text-text-primary truncate">{trade.listing?.title ?? "Unknown Item"}</h3>
                    <div className="flex items-center gap-2 mt-1 text-xs text-text-muted">
                      {trade.listing && <><span>{getGameLabel(trade.listing.game)}</span><span>·</span><span>{getItemTypeLabel(trade.listing.item_type)}</span></>}
                    </div>
                    {otherParty && <p className="text-xs text-text-muted mt-1">{activeTab === "buying" ? "From" : "To"}: {otherParty.username}</p>}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-bold text-sm text-text-primary">{formatBDT(trade.amount_bdt)}</p>
                    <span className={`inline-block mt-1 text-[10px] px-2 py-0.5 rounded-full font-medium ${statusColors.bg} ${statusColors.text}`}>
                      {getStatusLabel(trade.status)}
                    </span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}