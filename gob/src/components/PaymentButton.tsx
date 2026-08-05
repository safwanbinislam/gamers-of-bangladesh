"use client";

import { useState } from "react";
import { fundTrade } from "@/lib/actions/trades";

interface PaymentButtonProps { tradeId: string; }

export function PaymentButton({ tradeId }: PaymentButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<"bkash" | "nagad">("bkash");
  const [referenceId, setReferenceId] = useState("");

  const handlePay = async () => {
    if (!referenceId.trim()) return;
    setIsLoading(true); setError(null);
    const result = await fundTrade(tradeId, paymentMethod, referenceId.trim());
    setIsLoading(false);
    if (result.success) { setShowForm(false); setReferenceId(""); }
    else { setError(result.message ?? "Payment failed."); }
  };

  if (!showForm) return (
    <button onClick={() => setShowForm(true)}
      className="w-full bg-primary text-white rounded-lg py-3 font-medium hover:bg-primary-hover transition-colors">Pay Now</button>
  );

  return (
    <div className="space-y-3 border border-dark-border rounded-lg p-3 bg-dark-surface-2">
      <h4 className="font-medium text-sm text-text-primary">Complete Payment</h4>
      <div className="flex gap-2">
        <button onClick={() => setPaymentMethod("bkash")}
          className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${paymentMethod === "bkash" ? "border-primary bg-primary-subtle text-primary-light" : "border-dark-border-light text-text-muted"}`}>bKash</button>
        <button onClick={() => setPaymentMethod("nagad")}
          className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${paymentMethod === "nagad" ? "border-primary bg-primary-subtle text-primary-light" : "border-dark-border-light text-text-muted"}`}>Nagad</button>
      </div>
      <div>
        <label htmlFor="payment-ref" className="block text-xs font-medium text-text-secondary mb-1">{paymentMethod === "bkash" ? "bKash" : "Nagad"} Transaction ID</label>
        <input id="payment-ref" type="text" placeholder="Enter the transaction ID" value={referenceId}
          onChange={(e) => setReferenceId(e.target.value)}
          className="w-full rounded-lg border border-dark-border-light px-3 py-2 text-sm bg-dark-surface text-text-primary placeholder-text-muted focus:border-primary" />
      </div>
      {error && <p className="text-sm text-red-300">{error}</p>}
      <div className="flex gap-2">
        <button onClick={handlePay} disabled={isLoading || !referenceId.trim()}
          className="flex-1 bg-primary text-white rounded-lg py-2 font-medium hover:bg-primary-hover disabled:opacity-50">{isLoading ? "Verifying..." : "Confirm Payment"}</button>
        <button onClick={() => { setShowForm(false); setError(null); }} className="px-4 py-2 text-sm text-text-muted hover:text-text-primary">Cancel</button>
      </div>
    </div>
  );
}