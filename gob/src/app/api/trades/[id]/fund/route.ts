import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient, requireAuthUserId, setCurrentUserId } from "@/lib/supabase/server";
import { fundTradeSchema } from "@/lib/validation/trades";
import { bkashProvider } from "@/lib/payments/bkash";
import { nagadProvider } from "@/lib/payments/nagad";

/**
 * POST /api/trades/[id]/fund
 * Buyer confirms payment was made.
 * Calls the relevant payment adapter's verifyPayment().
 * On success: sets status to 'funds_held', sets funded_at, sets auto_release_deadline.
 * Idempotent via payment_reference_id.
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
    const validationResult = fundTradeSchema.safeParse(body);

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

    const { payment_method, payment_reference_id } = validationResult.data;

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
        { success: false, code: "FORBIDDEN", message: "Only the buyer can fund this trade" },
        { status: 403 }
      );
    }

    if (transaction.status !== "awaiting_payment") {
      return NextResponse.json(
        {
          success: false,
          code: "INVALID_STATUS",
          message: `Cannot fund trade: current status is "${transaction.status}", expected "awaiting_payment"`,
        },
        { status: 400 }
      );
    }

    // Idempotency check: if payment_reference_id already exists, this is a duplicate
    if (transaction.payment_reference_id) {
      return NextResponse.json({
        success: true,
        data: transaction,
        message: "Payment already processed for this trade",
      });
    }

    // Verify payment with the appropriate provider
    const provider =
      payment_method === "bkash" ? bkashProvider : nagadProvider;

    let verificationResult;
    try {
      verificationResult = await provider.verifyPayment({
        paymentReferenceId: payment_reference_id,
      });
    } catch (providerError) {
      console.error("Payment verification failed:", providerError);
      return NextResponse.json(
        {
          success: false,
          code: "PAYMENT_VERIFICATION_FAILED",
          message: "Payment could not be verified. Please check the payment reference and try again.",
        },
        { status: 502 }
      );
    }

    if (!verificationResult.verified) {
      return NextResponse.json(
        {
          success: false,
          code: "PAYMENT_NOT_VERIFIED",
          message: "Payment verification failed. The reference may be invalid.",
        },
        { status: 400 }
      );
    }

    // Set the session variable so the status-history trigger records the user
    await setCurrentUserId(supabase, userId);

    // Update transaction to funds_held
    const { error: updateError } = await supabase
      .from("escrow_transactions")
      .update({
        status: "funds_held",
        payment_method,
        payment_reference_id,
        funded_at: new Date().toISOString(),
        auto_release_deadline: new Date(
          Date.now() + 48 * 60 * 60 * 1000
        ).toISOString(), // 48 hours from now
      })
      .eq("id", id)
      .eq("status", "awaiting_payment"); // Optimistic concurrency check

    if (updateError) {
      console.error("Error updating transaction after funding:", updateError);
      return NextResponse.json(
        { success: false, code: "DATABASE_ERROR", message: "Failed to record payment" },
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
    console.error("Unexpected error in POST /api/trades/[id]/fund:", err);
    return NextResponse.json(
      { success: false, code: "INTERNAL_ERROR", message: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}