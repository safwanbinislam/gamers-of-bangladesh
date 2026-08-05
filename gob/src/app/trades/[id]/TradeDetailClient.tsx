"use client";

import { useState, useEffect } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";
import { TradeActionPanel } from "@/components/TradeActionPanel";
import { ReviewModal } from "@/components/ReviewModal";
import { formatBDT, getStatusColor, getStatusLabel, getGameLabel, getItemTypeLabel } from "@/lib/utils";
import Link from "next/link";

interface TransactionData {
  id: string; status: string; amount_bdt: number; platform_fee_bdt: number;
  buyer_id: string; seller_id: string; payment_method: string | null;
  payment_reference_id: string | null; auto_release_deadline: string | null;
  funded_at: string | null; delivered_at: string | null;
  confirmed_at: string | null; released_at: string | null; created_at: string;
  listing: { id: string; title: string; game: string; item_type: string; price_bdt: number; screenshots: string[] | null } | null;
  buyer: { id: string; username: string; avatar_url: string | null; reputation_score: number; total_trades: number } | null;
  seller: { id: string; username: string; avatar_url: string | null; reputation_score: number; total_trades: number } | null;
}

interface TradeDetailClientProps {
  transaction: TransactionData;
  statusHistory: { id: string; old_status: string | null; new_status: string; note: string | null; created_at: string }[];
  currentUserId: string;
}

export function TradeDetailClient({ transaction: initialTransaction, statusHistory, currentUserId }: TradeDetailClientProps) {
  const [transaction, setTransaction] = useState(initialTransaction);
  const [showReview, setShowReview] = useState(false);
  const isBuyer = transaction.buyer_id === currentUserId;
  const otherParty = isBuyer ? transaction.seller : transaction.seller;

  useEffect(() => {
    const supabase = createBrowserSupabaseClient();
    const channel = supabase.channel(`trade-${transaction.id}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "escrow_transactions", filter: `id=eq.${transaction.id}` },
        (payload) => setTransaction((prev) => ({ ...prev, ...payload.new as TransactionData })))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [transaction.id]);

  useEffect(() => {
    if (transaction.status === "released" && isBuyer) setShowReview(true);
  }, [transaction.status, isBuyer]);

  return (
    <>
      <div className="space-y-6">
        {transaction.listing && (
          <div className="bg-dark-surface border border-dark-border rounded-xl p-4">
            <h2 className="text-xs font-medium text-text-muted uppercase tracking-wide mb-2">Item</h2>
            <div className="flex items-start justify-between">
              <div>
                <p className="font-medium text-text-primary">{transaction.listing.title}</p>
                <div className="flex gap-2 mt-1">
                  <span className="text-xs bg-dark-surface-2 text-text-secondary px-2 py-0.5 rounded">{getGameLabel(transaction.listing.game)}</span>
                  <span className="text-xs bg-dark-surface-2 text-text-secondary px-2 py-0.5 rounded">{getItemTypeLabel(transaction.listing.item_type)}</span>
                </div>
              </div>
              <Link href={`/marketplace/${transaction.listing.id}`} className="text-xs text-primary-light hover:underline shrink-0">View Listing</Link>
            </div>
          </div>
        )}

        {transaction.seller && (
          <div className="bg-dark-surface border border-dark-border rounded-xl p-4">
            <h2 className="text-xs font-medium text-text-muted uppercase tracking-wide mb-2">{isBuyer ? "Seller" : "Buyer"}</h2>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary-subtle text-primary-light flex items-center justify-center font-bold text-sm">
                {transaction.seller.username[0].toUpperCase()}
              </div>
              <div>
                <p className="font-medium text-text-primary">{transaction.seller.username}</p>
                <div className="flex items-center gap-2 text-xs text-text-muted">
                  <span className="text-amber-400">★</span>
                  <span>{transaction.seller.reputation_score.toFixed(1)}</span>
                  <span>·</span>
                  <span>{transaction.seller.total_trades} trades</span>
                </div>
              </div>
            </div>
          </div>
        )}

        <TradeActionPanel trade={transaction} currentUserId={currentUserId} />

        {statusHistory.length > 0 && (
          <div className="bg-dark-surface border border-dark-border rounded-xl p-4">
            <h2 className="text-xs font-medium text-text-muted uppercase tracking-wide mb-3">Status History</h2>
            <div className="space-y-2">
              {statusHistory.map((entry) => {
                const colors = getStatusColor(entry.new_status);
                return (
                  <div key={entry.id} className="flex items-start gap-3 text-sm">
                    <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${colors.dot}`} />
                    <div className="min-w-0">
                      <span className={`inline-block font-medium ${colors.text}`}>{getStatusLabel(entry.new_status)}</span>
                      {entry.note && <p className="text-text-muted text-xs mt-0.5">{entry.note}</p>}
                      <p className="text-text-muted text-xs mt-0.5">{new Date(entry.created_at).toLocaleString("en-BD")}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="bg-dark-surface border border-dark-border rounded-xl p-4">
          <h2 className="text-xs font-medium text-text-muted uppercase tracking-wide mb-3">Details</h2>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between"><dt className="text-text-muted">Trade ID</dt><dd className="text-text-primary font-mono text-xs">{transaction.id.slice(0, 8)}...</dd></div>
            <div className="flex justify-between"><dt className="text-text-muted">Amount</dt><dd className="text-text-primary font-medium">{formatBDT(transaction.amount_bdt)}</dd></div>
            {transaction.platform_fee_bdt > 0 && <div className="flex justify-between"><dt className="text-text-muted">Platform Fee</dt><dd className="text-text-primary">{formatBDT(transaction.platform_fee_bdt)}</dd></div>}
            {transaction.payment_method && <div className="flex justify-between"><dt className="text-text-muted">Payment Method</dt><dd className="text-text-primary uppercase">{transaction.payment_method}</dd></div>}
            {transaction.funded_at && <div className="flex justify-between"><dt className="text-text-muted">Funded At</dt><dd className="text-text-primary">{new Date(transaction.funded_at).toLocaleString("en-BD")}</dd></div>}
            {transaction.delivered_at && <div className="flex justify-between"><dt className="text-text-muted">Delivered At</dt><dd className="text-text-primary">{new Date(transaction.delivered_at).toLocaleString("en-BD")}</dd></div>}
            <div className="flex justify-between"><dt className="text-text-muted">Created</dt><dd className="text-text-primary">{new Date(transaction.created_at).toLocaleString("en-BD")}</dd></div>
          </dl>
        </div>
      </div>

      <ReviewModal
        tradeId={transaction.id}
        revieweeId={otherParty?.id ?? ""}
        revieweeUsername={otherParty?.username ?? "User"}
        isOpen={showReview}
        onClose={() => setShowReview(false)}
      />
    </>
  );
}