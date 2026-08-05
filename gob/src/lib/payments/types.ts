/**
 * Shared payment provider interface for bKash and Nagad adapters.
 * Both payment gateways implement this interface so they can be swapped
 * without changing the rest of the application logic.
 */

export interface PaymentVerificationResult {
  verified: boolean;
  paymentReferenceId: string;
  /** Amount in BDT that was actually paid */
  amountPaid: number;
  /** Provider-specific transaction ID for audit trails */
  providerTransactionId: string;
}

export interface RefundResult {
  success: boolean;
  providerRefundId: string;
  message: string;
}

export interface DisbursementResult {
  /**
   * Whether the payout was ACTUALLY sent. See the TODO/stub note on
   * `disburse` below — in the current sandbox implementations this is
   * `false` by design, since no real B2C/merchant-payout integration
   * exists yet. Callers must not mark a payout row as 'paid' unless this
   * is `true`.
   */
  success: boolean;
  providerDisbursementId: string;
  message: string;
}

export interface PaymentProvider {
  /**
   * Initiate a payment request to the provider.
   * In sandbox mode this may return a mock URL or reference.
   */
  initiatePayment(params: {
    amount: number;
    orderReference: string;
    customerPhone?: string;
  }): Promise<{ success: boolean; redirectUrl?: string; referenceId: string }>;

  /**
   * Verify an incoming payment using the provider's reference ID.
   * For webhook-triggered verifications, pass the webhook payload.
   */
  verifyPayment(payload: {
    paymentReferenceId: string;
    /** Raw webhook body if called from a webhook route */
    webhookBody?: unknown;
    /** Provider-specific signature/checksum header value */
    signature?: string;
  }): Promise<PaymentVerificationResult>;

  /**
   * Issue a refund for a completed payment.
   */
  refund(params: {
    paymentReferenceId: string;
    amount: number;
    reason: string;
  }): Promise<RefundResult>;

  /**
   * TODO / STUB — send money OUT to a recipient (e.g. a tournament prize
   * payout). This is a genuinely open integration question, flagged here
   * deliberately:
   *
   * bKash and Nagad's consumer "Send Money" / B2C disbursement APIs are
   * governed by a completely different merchant agreement and API surface
   * than their payment-COLLECTION ("Create Payment"/checkout) APIs used by
   * `initiatePayment`/`verifyPayment` above. Obtaining sandbox credentials
   * for disbursement typically requires a separate merchant approval
   * process (bKash calls this "B2C Disbursement"; Nagad calls it "Merchant
   * Payout") that this codebase does not currently have credentials for.
   *
   * Both adapters implement this as a best-effort stub: they log the
   * intended payout and return `{ success: false, ... }` so calling code
   * (see lib/tournaments/payoutDisbursement.ts) leaves the corresponding
   * `tournament_prize_payouts` row as `payout_status = 'pending'` rather
   * than incorrectly marking it `'paid'` when no money actually moved.
   *
   * Real integration requires, at minimum:
   *   1. Provider-specific B2C/merchant-payout API credentials, separate
   *      from the checkout/collection credentials already configured for
   *      this project.
   *   2. Provider-specific request signing/encryption for the payout
   *      endpoint (distinct from the checkout signing scheme).
   *   3. A validated recipient wallet/MSISDN to send funds to — note that
   *      the current schema does not persist a dedicated "payout
   *      destination" for winners (see the comment on this in
   *      payoutDisbursement.ts for how we currently approximate it).
   */
  disburse(params: {
    /** Amount in BDT to send. */
    amount: number;
    /** Recipient wallet number / identifier to send the payout to. */
    recipient: string;
    /** Human-readable reason, included for audit trail / provider memo field. */
    reason: string;
  }): Promise<DisbursementResult>;
}
