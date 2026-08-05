import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient, requireAuthUserId } from "@/lib/supabase/server";

/**
 * GET /api/trades/[id]
 * Full trade detail plus its transaction_status_history.
 * Only accessible to the trade's buyer_id, seller_id, or an admin.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const userId = await requireAuthUserId();
    const supabase = await createServerSupabaseClient();

    const { data: transaction, error } = await supabase
      .from("escrow_transactions")
      .select(
        `
        *,
        listing:listings (*),
        buyer:profiles!escrow_transactions_buyer_id_fkey (
          id, username, avatar_url, reputation_score, total_trades
        ),
        seller:profiles!escrow_transactions_seller_id_fkey (
          id, username, avatar_url, reputation_score, total_trades
        )
      `
      )
      .eq("id", id)
      .single();

    if (error || !transaction) {
      return NextResponse.json(
        { success: false, code: "NOT_FOUND", message: "Trade not found" },
        { status: 404 }
      );
    }

    // Defense in depth: verify the requester is buyer, seller, or admin
    const isParticipant =
      transaction.buyer_id === userId || transaction.seller_id === userId;

    // Check admin status
    const { data: isAdmin } = await supabase.rpc("is_admin");

    if (!isParticipant && !isAdmin) {
      return NextResponse.json(
        {
          success: false,
          code: "FORBIDDEN",
          message: "You do not have access to this trade",
        },
        { status: 403 }
      );
    }

    // Fetch status history
    const { data: statusHistory, error: historyError } = await supabase
      .from("transaction_status_history")
      .select("*")
      .eq("transaction_id", id)
      .order("created_at", { ascending: true });

    if (historyError) {
      console.error("Error fetching status history:", historyError);
    }

    return NextResponse.json({
      success: true,
      data: {
        ...transaction,
        status_history: statusHistory ?? [],
      },
    });
  } catch (err) {
    if (err instanceof Error && err.message === "AUTH_REQUIRED") {
      return NextResponse.json(
        { success: false, code: "AUTH_REQUIRED", message: "Authentication required" },
        { status: 401 }
      );
    }
    console.error("Unexpected error in GET /api/trades/[id]:", err);
    return NextResponse.json(
      { success: false, code: "INTERNAL_ERROR", message: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}