import { Suspense } from "react";
import { createServerSupabaseClient, requireAuthUserId } from "@/lib/supabase/server";
import { EscrowInfoBanner } from "@/components/EscrowInfoBanner";
import { TradesList } from "./TradesList";

async function TradesContent() {
  const userId = await requireAuthUserId();
  const supabase = await createServerSupabaseClient();

  const { data: buyingTrades } = await supabase
    .from("escrow_transactions")
    .select("*, listing:listings (id, title, game, item_type), seller:profiles!escrow_transactions_seller_id_fkey (id, username, reputation_score, total_trades)")
    .eq("buyer_id", userId)
    .order("created_at", { ascending: false });

  const { data: sellingTrades } = await supabase
    .from("escrow_transactions")
    .select("*, listing:listings (id, title, game, item_type), buyer:profiles!escrow_transactions_buyer_id_fkey (id, username, reputation_score, total_trades)")
    .eq("seller_id", userId)
    .order("created_at", { ascending: false });

  return <TradesList buyingTrades={buyingTrades ?? []} sellingTrades={sellingTrades ?? []} />;
}

function TradesSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="bg-dark-surface border border-dark-border rounded-xl p-4 animate-pulse space-y-2">
          <div className="h-4 bg-dark-surface-2 rounded w-1/3" />
          <div className="h-3 bg-dark-surface-2 rounded w-2/3" />
        </div>
      ))}
    </div>
  );
}

export default function TradesPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
      <h1 className="text-2xl font-bold text-text-primary font-display">My Trades</h1>
      <EscrowInfoBanner />
      <Suspense fallback={<TradesSkeleton />}>
        <TradesContent />
      </Suspense>
    </div>
  );
}