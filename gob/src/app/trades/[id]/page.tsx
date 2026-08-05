import { notFound } from "next/navigation";
import Link from "next/link";
import { createServerSupabaseClient, requireAuthUserId } from "@/lib/supabase/server";
import { TradeStatusStepper } from "@/components/TradeStatusStepper";
import { TradeDetailClient } from "./TradeDetailClient";

export default async function TradeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = await requireAuthUserId();
  const supabase = await createServerSupabaseClient();

  const { data: transaction, error } = await supabase
    .from("escrow_transactions")
    .select("*, listing:listings (*), buyer:profiles!escrow_transactions_buyer_id_fkey (id, username, avatar_url, reputation_score, total_trades), seller:profiles!escrow_transactions_seller_id_fkey (id, username, avatar_url, reputation_score, total_trades)")
    .eq("id", id)
    .single();

  if (error || !transaction) notFound();

  const isParticipant = transaction.buyer_id === userId || transaction.seller_id === userId;
  const { data: isAdmin } = await supabase.rpc("is_admin");
  if (!isParticipant && !isAdmin) notFound();

  const { data: statusHistory } = await supabase.from("transaction_status_history").select("*").eq("transaction_id", id).order("created_at", { ascending: true });

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
      <Link href="/trades" className="inline-flex items-center text-sm text-text-secondary hover:text-text-primary">
        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back to Trades
      </Link>

      <TradeStatusStepper currentStatus={transaction.status} />

      <TradeDetailClient
        transaction={transaction as any}
        statusHistory={statusHistory ?? []}
        currentUserId={userId}
      />
    </div>
  );
}