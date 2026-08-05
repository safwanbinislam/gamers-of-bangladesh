"use client";

import { useState } from "react";
import { formatBDT, getStatusLabel, getStatusColor } from "@/lib/utils";
import { deliverTrade, confirmTrade, disputeTrade } from "@/lib/actions/trades";
import { PaymentButton } from "./PaymentButton";

interface TradeActionPanelProps {
  trade: { id: string; status: string; amount_bdt: number; buyer_id: string; seller_id: string; auto_release_deadline: string | null; payment_method: string | null };
  currentUserId: string;
}

export function TradeActionPanel({ trade, currentUserId }: TradeActionPanelProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showDisputeForm, setShowDisputeForm] = useState(false);
  const [disputeReason, setDisputeReason] = useState("");
  const [showDeliverForm, setShowDeliverForm] = useState(false);
  const [proofUrl, setProofUrl] = useState("");

  const isBuyer = trade.buyer_id === currentUserId;
  const isSeller = trade.seller_id === currentUserId;
  const statusColors = getStatusColor(trade.status);

  const handleAction = async (action: () => Promise<{ success: boolean; code?: string; message?: string }>) => {
    setIsLoading(true); setError(null); setSuccess(null);
    const result = await action();
    setIsLoading(false);
    if (result.success) { setSuccess("Action completed!"); setTimeout(() => setSuccess(null), 3000); }
    else { setError(result.message ?? "Something went wrong."); setTimeout(() => setError(null), 5000); }
  };

  return (
    <div className="bg-dark-surface border border-dark-border rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm text-text-muted">Current Status</span>
        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium ${statusColors.bg} ${statusColors.text}`}>
          <span className={`w-2 h-2 rounded-full ${statusColors.dot}`} />
          {getStatusLabel(trade.status)}
        </span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-sm text-text-muted">Amount</span>
        <span className="font-bold text-lg text-text-primary">{formatBDT(trade.amount_bdt)}</span>
      </div>

      {trade.auto_release_deadline && trade.status === "item_delivered" && (
        <div className="text-sm text-amber-300 bg-amber-950/30 rounded-lg p-2 text-center">
          Auto-release in {(() => { const d = new Date(trade.auto_release_deadline).getTime() - Date.now(); if (d <= 0) return "any moment"; const h = Math.floor(d / 3600000); const m = Math.floor((d % 3600000) / 60000); return `${h}h ${m}m`; })()}
        </div>
      )}

      {success && <div className="text-sm text-emerald-300 bg-emerald-950/30 rounded-lg p-2 text-center">{success}</div>}
      {error && <div className="text-sm text-red-300 bg-red-950/30 rounded-lg p-2 text-center">{error}</div>}

      <div className="space-y-2">
        {isBuyer && trade.status === "awaiting_payment" && <PaymentButton tradeId={trade.id} />}

        {isSeller && trade.status === "funds_held" && !showDeliverForm && (
          <button onClick={() => setShowDeliverForm(true)} disabled={isLoading}
            className="w-full bg-blue-600 text-white rounded-lg py-3 font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors">
            Mark as Delivered
          </button>
        )}
        {isSeller && trade.status === "funds_held" && showDeliverForm && (
          <div className="space-y-2">
            <input type="url" placeholder="Proof screenshot URL (optional)" value={proofUrl}
              onChange={(e) => setProofUrl(e.target.value)}
              className="w-full rounded-lg border border-dark-border-light px-3 py-2 text-sm bg-dark-surface text-text-primary placeholder-text-muted focus:border-primary" />
            <div className="flex gap-2">
              <button onClick={() => handleAction(() => deliverTrade(trade.id, proofUrl || undefined))} disabled={isLoading}
                className="flex-1 bg-blue-600 text-white rounded-lg py-2 font-medium hover:bg-blue-700 disabled:opacity-50">
                {isLoading ? "Processing..." : "Confirm Delivery"}
              </button>
              <button onClick={() => setShowDeliverForm(false)} className="px-4 py-2 text-sm text-text-muted hover:text-text-primary">Cancel</button>
            </div>
          </div>
        )}

        {isBuyer && trade.status === "item_delivered" && (
          <button onClick={() => handleAction(() => confirmTrade(trade.id))} disabled={isLoading}
            className="w-full bg-success text-gray-900 rounded-lg py-3 font-medium hover:bg-success-hover disabled:opacity-50">
            {isLoading ? "Processing..." : "Confirm Receipt & Release Funds"}
          </button>
        )}

        {(isBuyer || isSeller) && ["awaiting_payment", "funds_held", "item_delivered"].includes(trade.status) && !showDisputeForm && (
          <button onClick={() => setShowDisputeForm(true)}
            className="w-full border border-red-900/50 text-red-300 rounded-lg py-2 text-sm font-medium hover:bg-red-950/30 transition-colors">
            Open Dispute
          </button>
        )}
        {showDisputeForm && (
          <div className="space-y-2">
            <textarea placeholder="Describe the issue in detail..." value={disputeReason}
              onChange={(e) => setDisputeReason(e.target.value)} rows={3}
              className="w-full rounded-lg border border-dark-border-light px-3 py-2 text-sm bg-dark-surface text-text-primary placeholder-text-muted focus:border-red-500" />
            <div className="flex gap-2">
              <button onClick={() => { if (!disputeReason.trim()) return; handleAction(() => disputeTrade(trade.id, disputeReason)); setShowDisputeForm(false); setDisputeReason(""); }}
                disabled={isLoading || !disputeReason.trim()}
                className="flex-1 bg-red-600 text-white rounded-lg py-2 font-medium hover:bg-red-700 disabled:opacity-50">
                {isLoading ? "Processing..." : "Submit Dispute"}
              </button>
              <button onClick={() => setShowDisputeForm(false)} className="px-4 py-2 text-sm text-text-muted hover:text-text-primary">Cancel</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}