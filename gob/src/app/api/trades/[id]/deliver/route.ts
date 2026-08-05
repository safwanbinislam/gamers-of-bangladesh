import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient, requireAuthUserId, setCurrentUserId } from "@/lib/supabase/server";
import { deliverTradeSchema } from "@/lib/validation/trades";

/**
 * POST /api/trades/[id]/deliver
 * Seller marks the item as delivered.
 * Requires a proof screenshot path. Only allowed if requester is the seller
 * and current status is 'funds_held'.
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
    const validationResult = deliverTradeSchema.safeParse(body);

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

    const { proof_screenshot_url, delivery_note } = validationResult.data;

    // Fetch the transaction and validate the seller owns it
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

    if (transaction.seller_id !== userId) {
      return NextResponse.json(
        { success: false, code: "FORBIDDEN", message: "Only the seller can mark delivery" },
        { status: 403 }
      );
    }

    if (transaction.status !== "funds_held") {
      return NextResponse.json(
        {
          success: false,
          code: "INVALID_STATUS",
          message: `Cannot mark delivered: current status is "${transaction.status}", expected "funds_held"`,
        },
        { status: 400 }
      );
    }

    // Set the session variable so the status-history trigger records the user
    await setCurrentUserId(supabase, userId);

    // Update transaction to item_delivered
    const { error: updateError } = await supabase
      .from("escrow_transactions")
      .update({
        status: "item_delivered",
        delivered_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("status", "funds_held"); // Optimistic concurrency check

    if (updateError) {
      console.error("Error updating transaction after delivery:", updateError);
      return NextResponse.json(
        { success: false, code: "DATABASE_ERROR", message: "Failed to record delivery" },
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
    console.error("Unexpected error in POST /api/trades/[id]/deliver:", err);
    return NextResponse.json(
      { success: false, code: "INTERNAL_ERROR", message: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}