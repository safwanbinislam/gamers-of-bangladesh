import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { nagadProvider } from "@/lib/payments/nagad";

/**
 * POST /api/webhooks/nagad
 * Receive and verify incoming Nagad payment webhooks.
 *
 * ASSUMPTION: Nagad sends POST callbacks with an encrypted or signed JSON body
 * containing merchantId, orderId, paymentRefId, amount, transactionId, and status.
 * The payload may be encrypted with the merchant's private key and needs to be
 * decrypted/verified before processing.
 *
 * Exact payload shape depends on Nagad's API version. Adjust when integrating.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    // Nagad may send a signature in a custom header or within the encrypted body
    const signature = request.headers.get("x-nagad-signature") ?? undefined;

    // Extract payment reference from the webhook payload
    // These field names are based on Nagad's merchant API callback format
    const paymentReferenceId = body.orderId as string | undefined;
    const paymentRefId = body.paymentRefId as string | undefined;
    const transactionStatus = body.status as string | undefined;

    if (!paymentReferenceId) {
      console.warn("[Nagad Webhook] Missing orderId field");
      return NextResponse.json({ success: false, message: "Missing required fields" }, { status: 400 });
    }

    // Verify the payment with Nagad
    const verificationResult = await nagadProvider.verifyPayment({
      paymentReferenceId,
      webhookBody: body,
      signature,
    });

    if (!verificationResult.verified) {
      console.warn("[Nagad Webhook] Payment verification failed:", paymentReferenceId);
      return NextResponse.json(
        { success: false, message: "Payment verification failed" },
        { status: 400 }
      );
    }

    /**
     * This webhook is shared by TWO different payment flows that both use
     * Nagad — trade escrow funding (escrow_transactions) and tournament
     * entry fee payments (tournament_registrations) — since a real Nagad
     * webhook callback is routed purely by orderId / payment reference,
     * not by which product was being paid for. We therefore check both
     * tables. In practice this webhook route mostly duplicates the
     * synchronous verification already performed by /api/trades/[id]/fund
     * and /api/tournaments/[id]/register (both call
     * nagadProvider.verifyPayment() directly before writing their own
     * status), so this handler is a defensive fallback for payment
     * confirmations that arrive out-of-band from Nagad's servers rather
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
        console.error("[Nagad Webhook] Failed to update transaction:", updateError);
        return NextResponse.json({ success: false, message: "Database update failed" }, { status: 500 });
      }

      console.log("[Nagad Webhook] Successfully processed trade payment:", paymentReferenceId);
      return NextResponse.json({ success: true, message: "Payment confirmed" });
    }

    const { data: existingRegistration } = await adminSupabase
      .from("tournament_registrations")
      .select("id, payment_status")
      .eq("payment_reference_id", paymentReferenceId)
      .maybeSingle();

    if (!existingRegistration) {
      console.warn("[Nagad Webhook] No transaction or registration found for reference:", paymentReferenceId);
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
      console.error("[Nagad Webhook] Failed to update registration:", registrationUpdateError);
      return NextResponse.json({ success: false, message: "Database update failed" }, { status: 500 });
    }

    console.log("[Nagad Webhook] Successfully processed tournament registration:", paymentReferenceId);
    return NextResponse.json({ success: true, message: "Payment confirmed" });
  } catch (err) {
    console.error("[Nagad Webhook] Unexpected error:", err);
    return NextResponse.json({ success: true, message: "Acknowledged" });
  }
}
