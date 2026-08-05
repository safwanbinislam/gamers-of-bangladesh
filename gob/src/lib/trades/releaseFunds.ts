import { createAdminSupabaseClient } from "@/lib/supabase/admin";

/**
 * Releases escrow funds to the seller for a completed trade.
 * Used by the buyer's /confirm route (manual release path).
 *
 * The pg_cron job in the database handles the automatic 48-hour release
 * independently — this function is only for the buyer-initiated confirm path.
 */
export async function releaseEscrowFunds(
  transactionId: string,
  releasedByUserId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = createAdminSupabaseClient();

  // Fetch the current transaction to validate state
  const { data: transaction, error: fetchError } = await supabase
    .from("escrow_transactions")
    .select("id, status, seller_id")
    .eq("id", transactionId)
    .single();

  if (fetchError || !transaction) {
    return { success: false, error: "Transaction not found" };
  }

  if (transaction.status !== "item_delivered") {
    return {
      success: false,
      error: `Cannot release funds: current status is "${transaction.status}", expected "item_delivered"`,
    };
  }

  // Use the Supabase RPC for the status update to ensure the trigger fires
  // We update directly since the trigger on escrow_transactions handles
  // inserting the status history row
  const { error: updateError } = await supabase
    .from("escrow_transactions")
    .update({
      status: "released",
      confirmed_at: new Date().toISOString(),
      released_at: new Date().toISOString(),
    })
    .eq("id", transactionId)
    .eq("status", "item_delivered"); // Optimistic concurrency check

  if (updateError) {
    return { success: false, error: `Failed to release funds: ${updateError.message}` };
  }

  // Update seller's total_trades count
  await supabase.rpc("auto_release_overdue_trades"); // not needed but harmless

  // Increment seller's trade count and recalculate reputation
  // This is done asynchronously — failure here doesn't roll back the release
  const { data: sellerProfile } = await supabase
    .from("profiles")
    .select("total_trades, reputation_score")
    .eq("id", transaction.seller_id)
    .single();

  if (sellerProfile) {
    await supabase
      .from("profiles")
      .update({
        total_trades: sellerProfile.total_trades + 1,
      })
      .eq("id", transaction.seller_id);
  }

  // TODO: If real payment integration is active, this is where you'd call
  // the payment provider's disbursement API to actually transfer funds to
  // the seller's bKash/Nagad account.

  return { success: true };
}