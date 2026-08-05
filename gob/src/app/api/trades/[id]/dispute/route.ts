import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient, requireAuthUserId, setCurrentUserId } from "@/lib/supabase/server";
import { disputeTradeSchema } from "@/lib/validation/trades";

/**
 * POST /api/trades/[id]/dispute
 * Either buyer or seller opens a dispute.
 * Creates a disputes row and sets the trade's status to 'disputed'.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const userId = await requireAuthUserId();
    const supabase = await createServerSupabaseClient();

    const body = await request.json();
    const validationResult = disputeTradeSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        {
          success: false,
          code: "VALIDATION_ERROR",
          message: "Invalid request data",
          errors: validationResult.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const { reason } = validationResult.data;

    // Fetch the transaction and validate the user is a participant
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

    const isParticipant =
      transaction.buyer_id === userId || transaction.seller_id === userId;

    if (!isParticipant) {
      return NextResponse.json(
        { success: false, code: "FORBIDDEN", message: "Only trade participants can open a dispute" },
        { status: 403 }
      );
    }

    // Only allow disputing if the trade is in a disputable state
    const disputableStatuses = ["awaiting_payment", "funds_held", "item_delivered"];
    if (!disputableStatuses.includes(transaction.status)) {
      return NextResponse.json(
        {
          success: false,
          code: "INVALID_STATUS",
          message: `Cannot dispute trade: current status is "${transaction.status}". Disputes can only be opened when status is awaiting_payment, funds_held, or item_delivered.`,
        },
        { status: 400 }
      );
    }

    // Check if a dispute already exists for this transaction
    const { data: existingDispute } = await supabase
      .from("disputes")
      .select("id, status")
      .eq("transaction_id", id)
      .maybeSingle();

    if (existingDispute && existingDispute.status !== "resolved_buyer" && existingDispute.status !== "resolved_seller" && existingDispute.status !== "resolved_split") {
      return NextResponse.json(
        {
          success: false,
          code: "DISPUTE_EXISTS",
          message: "A dispute is already open for this transaction",
        },
        { status: 409 }
      );
    }

    // Create the dispute and update the transaction status in sequence
    // We use the admin client for the transaction status update since the
    // RLS policy on escrow_transactions may restrict status changes
    const { data: dispute, error: disputeError } = await supabase
      .from("disputes")
      .insert({
        transaction_id: id,
        raised_by: userId,
        reason,
        status: "open",
      })
      .select()
      .single();

    if (disputeError) {
      console.error("Error creating dispute:", disputeError);
      return NextResponse.json(
        { success: false, code: "DATABASE_ERROR", message: "Failed to create dispute" },
        { status: 500 }
      );
    }

    // Set the session variable so the status-history trigger records the user
    await setCurrentUserId(supabase, userId);

    // Update the transaction status to disputed
    const { error: updateError } = await supabase
      .from("escrow_transactions")
      .update({ status: "disputed" })
      .eq("id", id);

    if (updateError) {
      console.error("Error updating transaction status to disputed:", updateError);
      // Don't roll back the dispute creation — the dispute exists even if the
      // status update fails, and an admin can resolve it
    }

    return NextResponse.json({ success: true, data: dispute }, { status: 201 });
  } catch (err) {
    if (err instanceof Error && err.message === "AUTH_REQUIRED") {
      return NextResponse.json(
        { success: false, code: "AUTH_REQUIRED", message: "Authentication required" },
        { status: 401 }
      );
    }
    console.error("Unexpected error in POST /api/trades/[id]/dispute:", err);
    return NextResponse.json(
      { success: false, code: "INTERNAL_ERROR", message: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}