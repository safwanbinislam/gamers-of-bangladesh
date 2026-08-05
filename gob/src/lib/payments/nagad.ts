import type { DisbursementResult, PaymentProvider, PaymentVerificationResult, RefundResult } from "./types";

/**
 * Nagad payment adapter implementing the PaymentProvider interface.
 *
 * ASSUMPTION: Nagad's sandbox API follows their merchant API pattern.
 * The exact endpoint URLs and request/response shapes should be replaced
 * with actual Nagad API documentation values when integrating.
 *
 * Sandbox credentials are read from environment variables:
 * - NAGAD_MERCHANT_ID
 * - NAGAD_PRIVATE_KEY
 */

const NAGAD_SANDBOX_BASE_URL = "https://sandbox.mynagad.com/api";

export const nagadProvider: PaymentProvider = {
  async initiatePayment({ amount, orderReference, customerPhone }) {
    const merchantId = process.env.NAGAD_MERCHANT_ID;
    const privateKey = process.env.NAGAD_PRIVATE_KEY;

    if (!merchantId || !privateKey) {
      throw new Error("Missing NAGAD_MERCHANT_ID or NAGAD_PRIVATE_KEY environment variables");
    }

    // TODO: Replace with actual Nagad createPayment API call:
    // POST ${NAGAD_SANDBOX_BASE_URL}/checkout/create
    // Body uses Nagad's specific encrypted payload format with:
    // - merchantId
    // - orderId: orderReference
    // - amount: amount.toString()
    // - clientMobile: customerPhone (if available)
    // - callbackUrl: `${APP_URL}/api/webhooks/nagad`
    //
    // Nagad uses a specific encryption scheme with the private key.
    // The response includes a "callBackUrl" that the user is redirected to
    // to complete the payment.

    console.log(
      `[Nagad Sandbox] initiatePayment: amount=${amount}, orderReference=${orderReference}, customerPhone=${customerPhone}`
    );

    return {
      success: true,
      referenceId: `nagad-mock-${orderReference}-${Date.now()}`,
      redirectUrl: `${NAGAD_SANDBOX_BASE_URL}/checkout?merchantId=${merchantId}&orderId=${orderReference}`,
    };
  },

  async verifyPayment({ paymentReferenceId, webhookBody, signature }): Promise<PaymentVerificationResult> {
    // TODO: In production, verify the webhook payload using Nagad's signature verification.
    // Nagad sends a POST callback with encrypted response containing:
    // - merchantId
    // - orderId
    // - paymentRefId
    // - amount
    // - clientMobileNo
    // - transactionId
    // - dateTime
    // - status ("
    //
    // The response is encrypted with the merchant's private key and needs to be decrypted.
    // The signature in the "signature" parameter or a checksum header should be verified.

    console.log(
      `[Nagad Sandbox] verifyPayment: paymentReferenceId=${paymentReferenceId}, signature=${signature}`
    );

    // Sandbox: always return verified with mock data
    return {
      verified: true,
      paymentReferenceId,
      amountPaid: 0, // Will be set from the actual amount
      providerTransactionId: `nagad-trx-${paymentReferenceId}`,
    };
  },

  async refund({ paymentReferenceId, amount, reason }): Promise<RefundResult> {
    // TODO: Replace with actual Nagad refund API call:
    // POST ${NAGAD_SANDBOX_BASE_URL}/checkout/refund
    // Body: {
    //   merchantId,
    //   paymentRefId: paymentReferenceId,
    //   amount: amount.toString(),
    //   reason
    // }

    console.log(
      `[Nagad Sandbox] refund: paymentReferenceId=${paymentReferenceId}, amount=${amount}, reason=${reason}`
    );

    return {
      success: true,
      providerRefundId: `nagad-refund-${paymentReferenceId}-${Date.now()}`,
      message: "Refund processed successfully (sandbox)",
    };
  },

  async disburse({ amount, recipient, reason }): Promise<DisbursementResult> {
    // TODO / STUB: Nagad's "Merchant Payout" (B2C disbursement) API is a
    // SEPARATE product from the checkout API used above and requires its
    // own merchant approval + sandbox credentials (typically distinct env
    // vars, e.g. NAGAD_PAYOUT_MERCHANT_ID / NAGAD_PAYOUT_PRIVATE_KEY) which
    // this project does not currently have. We deliberately do NOT fake a
    // success response here — unlike the payment-COLLECTION sandbox mocks
    // above (which are harmless to fake for local testing), faking a
    // successful money-OUT transfer could cause the calling code to
    // incorrectly mark a real prize payout as 'paid' when no money actually
    // moved.
    //
    // Real implementation would look roughly like:
    // POST ${NAGAD_SANDBOX_BASE_URL}/payout/create (or similar — exact
    // endpoint depends on Nagad's Merchant Payout API docs, which differ
    // from the checkout docs referenced elsewhere in this file)
    // Body: { merchantId, receiverMobileNo: recipient, amount: amount.toString(), purpose: reason }

    console.warn(
      `[Nagad Sandbox] disburse() STUB called — NOT actually sent. amount=${amount}, recipient=${recipient}, reason=${reason}`
    );

    return {
      success: false,
      providerDisbursementId: `nagad-disbursement-stub-${Date.now()}`,
      message:
        "Nagad Merchant Payout is not integrated in this environment. This payout requires manual processing.",
    };
  },
};
