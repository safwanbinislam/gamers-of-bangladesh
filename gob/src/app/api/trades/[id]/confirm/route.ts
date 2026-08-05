import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient, requireAuthUserId, setCurrentUserId } from "@/lib/supabase/server";
import { confirmTradeSchema } from "@/lib/validation/trades";
import { releaseEscrowFunds } from "@/lib/trades/releaseFunds";

/**
 * POST /api/trades/[id]/confirm
 * Buyer confirms they received the item as expected.
 * Only allowed if requester is the buyer and current status is 'item_delivered'.
 * Calls releaseEscrowFunds() to finalize the release.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const userId = await requireAuthUserId();
    const supabase = await createServerSupabaseClient();

    // Parse optional body (note from buyer)
    const body = await request.json().catch(() => ({}));
    const validationResult = confirmTradeSchema.safeParse(body);

    // Fetch the transaction and validate the buyer owns it
    const { data: transaction, error: fetchError } = await supabase
      .from("escrow_transactions")
      .select("*")
      .eq("id", id)
      .single();

    if (fetchError || !transaction) {
      return NextResponse.json(
        { success: false, code: "NOT_FOUND", message: "Trade not found" },
        { status: 404 }
      );
    }

    if (transaction.buyer_id !== userId) {
      return NextResponse.json(
        { success: false, code: "FORBIDDEN", message: "Only the buyer can confirm receipt" },
        { status: 403 }
      );
    }

    if (transaction.status !== "item_delivered") {
      return NextResponse.json(
        {
          success: false,
          code: "INVALID_STATUS",
          message: `Cannot confirm receipt: current status is "${transaction.status}", expected "item_delivered"`,
        },
        { status: 400 }
      );
    }

    // Set the session variable so the status-history trigger records the user
    await setCurrentUserId(supabase, userId);

    // Release the escrow funds
    const releaseResult = await releaseEscrowFunds(id, userId);

    if (!releaseResult.success) {
      console.error("Failed to release funds:", releaseResult.error);
      return NextResponse.json(
        {
          success: false,
          code: "RELEASE_FAILED",
          message: releaseResult.error ?? "Failed to release funds",
        },
        { status: 500 }
      );
    }

    // Fetch the updated transaction
    const { data: updatedTransaction } = await supabase
      .from("escrow_transactions")
      .select("*")
      .eq("id", id)
      .single();

    return NextResponse.json({
      success: true,
      data: updatedTransaction ?? transaction,
    });
  } catch (err) {
    if (err instanceof Error && err.message === "AUTH_REQUIRED") {
      return NextResponse.json(
        { success: false, code: "AUTH_REQUIRED", message: "Authentication required" },
        { status: 401 }
      );
    }
    console.error("Unexpected error in POST /api/trades/[id]/confirm:", err);
    return NextResponse.json(
      { success: false, code: "INTERNAL_ERROR", message: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}