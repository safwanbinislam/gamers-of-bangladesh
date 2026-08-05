import type { DisbursementResult, PaymentProvider, PaymentVerificationResult, RefundResult } from "./types";

/**
 * bKash payment adapter implementing the PaymentProvider interface.
 *
 * ASSUMPTION: bKash's sandbox API follows a similar pattern to their production API
 * but with test endpoints. The exact endpoint URLs and request/response shapes
 * should be replaced with actual bKash API documentation values when integrating.
 *
 * Sandbox credentials are read from environment variables:
 * - BKASH_APP_KEY
 * - BKASH_APP_SECRET
 */

const BKASH_SANDBOX_BASE_URL = "https://tokenized.sandbox.bka.sh/v1.2.0-beta";

async function getBkashToken(): Promise<string> {
  const appKey = process.env.BKASH_APP_KEY;
  const appSecret = process.env.BKASH_APP_SECRET;

  if (!appKey || !appSecret) {
    throw new Error("Missing BKASH_APP_KEY or BKASH_APP_SECRET environment variables");
  }

  // In sandbox mode, return a mock token
  // TODO: Replace with actual API call:
  // POST ${BKASH_SANDBOX_BASE_URL}/tokenized/checkout/token/grant
  // Body: { app_key: appKey, app_secret: appSecret }
  return "sandbox-bkash-token-mock";
}

export const bkashProvider: PaymentProvider = {
  async initiatePayment({ amount, orderReference, customerPhone }) {
    const token = await getBkashToken();

    // TODO: Replace with actual bKash createPayment API call:
    // POST ${BKASH_SANDBOX_BASE_URL}/tokenized/checkout/create
    // Headers: { Authorization: token, X-APP-Key: appKey }
    // Body: {
    //   mode: "0011",
    //   payerReference: orderReference,
    //   callbackURL: `${APP_URL}/api/webhooks/bkash`,
    //   amount: amount.toString(),
    //   currency: "BDT",
    //   intent: "sale",
    //   merchantInvoiceNumber: orderReference
    // }

    console.log(
      `[bKash Sandbox] initiatePayment: amount=${amount}, orderReference=${orderReference}, customerPhone=${customerPhone}`
    );

    return {
      success: true,
      referenceId: `bkash-mock-${orderReference}-${Date.now()}`,
      // In sandbox, bKash returns a redirect URL for the user to complete payment
      redirectUrl: `${BKASH_SANDBOX_BASE_URL}/tokenized/checkout?token=${token}`,
    };
  },

  async verifyPayment({ paymentReferenceId, webhookBody, signature }): Promise<PaymentVerificationResult> {
    // TODO: In production, verify the webhook signature using bKash's public key
    // and call the executePayment API to confirm the transaction.
    //
    // bKash sends a POST callback with:
    // - paymentID
    // - trxID
    // - transactionStatus
    // - amount
    // - merchantInvoiceNumber
    //
    // Then call: POST ${BKASH_SANDBOX_BASE_URL}/tokenized/checkout/execute
    // with { paymentID } to confirm.

    console.log(
      `[bKash Sandbox] verifyPayment: paymentReferenceId=${paymentReferenceId}, signature=${signature}`
    );

    // Sandbox: always return verified with mock data
    return {
      verified: true,
      paymentReferenceId,
      amountPaid: 0, // Will be set from the actual amount in the webhook
      providerTransactionId: `bkash-trx-${paymentReferenceId}`,
    };
  },

  async refund({ paymentReferenceId, amount, reason }): Promise<RefundResult> {
    // TODO: Replace with actual bKash refund API call:
    // POST ${BKASH_SANDBOX_BASE_URL}/tokenized/checkout/payment/refund
    // Body: {
    //   paymentID: paymentReferenceId,
    //   amount: amount.toString(),
    //   trxID: "...",
    //   sku: "refund",
    //   reason: reason
    // }

    console.log(
      `[bKash Sandbox] refund: paymentReferenceId=${paymentReferenceId}, amount=${amount}, reason=${reason}`
    );

    return {
      success: true,
      providerRefundId: `bkash-refund-${paymentReferenceId}-${Date.now()}`,
      message: "Refund processed successfully (sandbox)",
    };
  },

  async disburse({ amount, recipient, reason }): Promise<DisbursementResult> {
    // TODO / STUB: bKash's B2C "Send Money"/Disbursement API is a SEPARATE
    // product from the checkout API used above and requires its own
    // merchant approval + sandbox credentials (typically distinct env vars,
    // e.g. BKASH_B2C_APP_KEY / BKASH_B2C_APP_SECRET) which this project does
    // not currently have. We deliberately do NOT fake a success response
    // here — unlike the payment-COLLECTION sandbox mocks above (which are
    // harmless to fake for local testing), faking a successful money-OUT
    // transfer could cause the calling code to incorrectly mark a real
    // prize payout as 'paid' when no money actually moved.
    //
    // Real implementation would look roughly like:
    // POST ${BKASH_SANDBOX_BASE_URL}/disbursement/payout/create (or similar
    // — exact endpoint depends on bKash's B2C API docs, which differ from
    // the tokenized checkout docs referenced elsewhere in this file)
    // Body: { receiverMSISDN: recipient, amount: amount.toString(), reference: reason }

    console.warn(
      `[bKash Sandbox] disburse() STUB called — NOT actually sent. amount=${amount}, recipient=${recipient}, reason=${reason}`
    );

    return {
      success: false,
      providerDisbursementId: `bkash-disbursement-stub-${Date.now()}`,
      message:
        "bKash B2C disbursement is not integrated in this environment. This payout requires manual processing.",
    };
  },
};
