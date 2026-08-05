import { notFound } from "next/navigation";
import Link from "next/link";
import { createServerSupabaseClient, requireAuthUserId } from "@/lib/supabase/server";
import { DisputeThread } from "@/components/DisputeThread";
import { getStatusLabel } from "@/lib/utils";

export default async function DisputeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = await requireAuthUserId();
  const supabase = await createServerSupabaseClient();

  const { data: dispute, error: disputeError } = await supabase
    .from("disputes")
    .select("*, escrow_transactions!disputes_transaction_id_fkey(id, buyer_id, seller_id, status)")
    .eq("id", id)
    .single();

  if (disputeError || !dispute) notFound();

  const transaction = dispute.escrow_transactions as unknown as { id: string; buyer_id: string; seller_id: string; status: string };
  const isParticipant = transaction.buyer_id === userId || transaction.seller_id === userId || dispute.raised_by === userId;
  const { data: isAdmin } = await supabase.rpc("is_admin");
  if (!isParticipant && !isAdmin) notFound();

  const { data: messages } = await supabase
    .from("dispute_messages")
    .select("*, sender:profiles!dispute_messages_sender_id_fkey(id, username, avatar_url, is_admin)")
    .eq("dispute_id", id)
    .order("created_at", { ascending: true });

  const isResolved = ["resolved_buyer", "resolved_seller", "resolved_split"].includes(dispute.status);

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
      <Link href={`/trades/${transaction.id}`} className="inline-flex items-center text-sm text-text-secondary hover:text-text-primary">
        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back to Trade
      </Link>

      <div className="bg-dark-surface border border-dark-border rounded-xl p-4">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-lg font-bold text-text-primary flex items-center gap-2"><span>⚠️</span><span>Dispute</span></h1>
            <p className="text-sm text-text-secondary mt-1">Status: <span className="font-medium text-red-300">{getStatusLabel(dispute.status)}</span></p>
            <p className="text-xs text-text-muted mt-0.5">Reason: {dispute.reason}</p>
          </div>
          {isResolved && <span className="bg-gray-800 text-text-secondary text-xs px-3 py-1 rounded-full font-medium">Resolved</span>}
        </div>
        {dispute.admin_notes && (
          <div className="mt-3 bg-primary-subtle/30 rounded-lg p-3 text-sm text-primary-light">
            <span className="font-medium">Admin notes:</span> {dispute.admin_notes}
          </div>
        )}
      </div>

      <div>
        <h2 className="text-xs font-medium text-text-muted uppercase tracking-wide mb-3">Messages</h2>
        <DisputeThread
          disputeId={id}
          initialMessages={(messages ?? []) as any}
          currentUserId={userId}
        />
      </div>
    </div>
  );
}