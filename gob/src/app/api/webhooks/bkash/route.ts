import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { bkashProvider } from "@/lib/payments/bkash";

/**
 * POST /api/webhooks/bkash
 * Receive and verify incoming bKash payment webhooks.
 *
 * ASSUMPTION: bKash sends POST callbacks with a JSON body containing paymentID,
 * trxID, transactionStatus, amount, and merchantInvoiceNumber. The webhook
 * includes a signature in the Authorization header or a separate signature field.
 *
 * The exact payload shape depends on bKash's API version and integration type
 * (checkout/tokenized vs. direct API). Adjust field names when integrating.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const signature = request.headers.get("authorization") ?? undefined;

    // Extract the payment reference and status from the webhook payload
    // These field names are based on bKash's tokenized checkout webhook format
    const paymentReferenceId = body.merchantInvoiceNumber as string | undefined;
    const transactionStatus = body.transactionStatus as string | undefined;
    const paymentId = body.paymentID as string | undefined;

    if (!paymentReferenceId || !paymentId) {
      console.warn("[bKash Webhook] Missing required fields:", {
        paymentReferenceId,
        paymentId,
      });
      return NextResponse.json({ success: false, message: "Missing required fields" }, { status: 400 });
    }

    // Verify the payment with bKash
    const verificationResult = await bkashProvider.verifyPayment({
      paymentReferenceId,
      webhookBody: body,
      signature,
    });

    if (!verificationResult.verified) {
      console.warn("[bKash Webhook] Payment verification failed:", paymentReferenceId);
      return NextResponse.json(
        { success: false, message: "Payment verification failed" },
        { status: 400 }
      );
    }

    /**
     * This webhook is shared by TWO different payment flows that both use
     * bKash — trade escrow funding (escrow_transactions) and tournament
     * entry fee payments (tournament_registrations) — since a real bKash
     * webhook callback is routed purely by merchantInvoiceNumber / payment
     * reference, not by which product was being paid for. We therefore
     * check both tables. In practice this webhook route mostly duplicates
     * the synchronous verification already performed by
     * /api/trades/[id]/fund and /api/tournaments/[id]/register (both call
     * bkashProvider.verifyPayment() directly before writing their own
     * status), so this handler is a defensive fallback for payment
     * confirmations that arrive out-of-band from bKash's servers rather
     * than the primary write path.
     */
    const adminSupabase = createAdminSupabaseClient();
    const { data: existingTransaction } = await adminSupabase
      .from("escrow_transactions")
      .select("id, status")
      .eq("payment_reference_id", paymentReferenceId)
      .maybeSingle();

    if (existingTransaction) {
      // If already processed, acknowledge silently (idempotent)
      if (existingTransaction.status !== "awaiting_payment") {
        return NextResponse.json({ success: true, message: "Already processed" });
      }

      const { error: updateError } = await adminSupabase
        .from("escrow_transactions")
        .update({
          status: "funds_held",
          funded_at: new Date().toISOString(),
          auto_release_deadline: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
        })
        .eq("id", existingTransaction.id);

      if (updateError) {
        console.error("[bKash Webhook] Failed to update transaction:", updateError);
        return NextResponse.json({ success: false, message: "Database update failed" }, { status: 500 });
      }

      console.log("[bKash Webhook] Successfully processed trade payment:", paymentReferenceId);
      return NextResponse.json({ success: true, message: "Payment confirmed" });
    }

    const { data: existingRegistration } = await adminSupabase
      .from("tournament_registrations")
      .select("id, payment_status")
      .eq("payment_reference_id", paymentReferenceId)
      .maybeSingle();

    if (!existingRegistration) {
      console.warn("[bKash Webhook] No transaction or registration found for reference:", paymentReferenceId);
      // Still return 200 to prevent bKash from retrying, but log the issue
      return NextResponse.json({ success: true, message: "Reference not found, but acknowledged" });
    }

    if (existingRegistration.payment_status !== "pending") {
      return NextResponse.json({ success: true, message: "Already processed" });
    }

    const { error: registrationUpdateError } = await adminSupabase
      .from("tournament_registrations")
      .update({ payment_status: "paid" })
      .eq("id", existingRegistration.id);

    if (registrationUpdateError) {
      console.error("[bKash Webhook] Failed to update registration:", registrationUpdateError);
      return NextResponse.json({ success: false, message: "Database update failed" }, { status: 500 });
    }

    console.log("[bKash Webhook] Successfully processed tournament registration:", paymentReferenceId);
    return NextResponse.json({ success: true, message: "Payment confirmed" });
  } catch (err) {
    console.error("[bKash Webhook] Unexpected error:", err);
    // Return 200 to prevent bKash from retrying — the fund/register routes
    // handle synchronous confirmation if the webhook fails
    return NextResponse.json({ success: true, message: "Acknowledged" });
  }
}
