"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { registerForTournament } from "@/lib/actions/tournaments";
import { formatBDT } from "@/lib/utils";
import { showToast } from "@/components/Toast";

interface RegisterButtonProps {
  tournamentId: string;
  entryFeeBdt: number;
  isRegistered: boolean;
  isFull: boolean;
  status: string;
}

export function RegisterButton({ tournamentId, entryFeeBdt, isRegistered, isFull, status }: RegisterButtonProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<"bkash" | "nagad">("bkash");
  const [referenceId, setReferenceId] = useState("");

  const isRegistrationOpen = status === "registration_open";

  // Disabled states
  if (isRegistered) {
    return (
      <div className="bg-dark-surface-2 border border-dark-border rounded-xl p-4 text-center">
        <p className="text-emerald-400 font-medium text-sm">✅ You are registered for this tournament</p>
      </div>
    );
  }

  if (!isRegistrationOpen) {
    const statusLabels: Record<string, string> = {
      draft: "Registration has not started yet",
      registration_closed: "Registration is closed",
      bracket_generated: "Registration is closed — bracket has been generated",
      in_progress: "Tournament is in progress",
      completed: "Tournament has ended",
      cancelled: "Tournament was cancelled",
    };
    return (
      <div className="bg-dark-surface-2 border border-dark-border rounded-xl p-4 text-center">
        <p className="text-text-muted text-sm">{statusLabels[status] ?? "Registration is not available"}</p>
      </div>
    );
  }

  if (isFull) {
    return (
      <div className="bg-dark-surface-2 border border-dark-border rounded-xl p-4 text-center">
        <p className="text-amber-300 font-medium text-sm">Tournament is full</p>
      </div>
    );
  }

  const handlePay = async () => {
    if (!referenceId.trim()) return;
    setIsLoading(true);
    setError(null);

    const idempotencyKey = crypto.randomUUID();
    const result = await registerForTournament(tournamentId, paymentMethod, referenceId.trim(), idempotencyKey);

    setIsLoading(false);
    if (result.success) {
      setShowForm(false);
      setReferenceId("");
      showToast("success", "Successfully registered for the tournament!");
      router.refresh();
    } else {
      setError(result.message ?? "Registration failed.");
      showToast("error", result.message ?? "Registration failed.");
    }
  };

  if (!showForm) {
    return (
      <button
        onClick={() => setShowForm(true)}
        className="w-full btn-primary py-3 text-base font-bold"
      >
        Join Tournament — {formatBDT(entryFeeBdt)}
      </button>
    );
  }

  return (
    <div className="space-y-3 border border-dark-border rounded-xl p-4 bg-dark-surface">
      <h4 className="font-semibold text-sm text-text-primary">Complete Payment to Join</h4>

      <div className="flex gap-2">
        <button
          onClick={() => setPaymentMethod("bkash")}
          className={`flex-1 py-2.5 rounded-lg text-sm font-medium border transition-colors ${
            paymentMethod === "bkash"
              ? "border-primary bg-primary-subtle text-primary-light"
              : "border-dark-border-light text-text-muted"
          }`}
        >
          bKash
        </button>
        <button
          onClick={() => setPaymentMethod("nagad")}
          className={`flex-1 py-2.5 rounded-lg text-sm font-medium border transition-colors ${
            paymentMethod === "nagad"
              ? "border-primary bg-primary-subtle text-primary-light"
              : "border-dark-border-light text-text-muted"
          }`}
        >
          Nagad
        </button>
      </div>

      <div>
        <label htmlFor="payment-ref" className="block text-xs font-medium text-text-secondary mb-1">
          {paymentMethod === "bkash" ? "bKash" : "Nagad"} Transaction ID
        </label>
        <p className="text-xs text-text-muted mb-2">
          Pay {formatBDT(entryFeeBdt)} to our {paymentMethod === "bkash" ? "bKash" : "Nagad"} number, then enter the transaction ID below.
        </p>
        <input
          id="payment-ref"
          type="text"
          placeholder="Enter the transaction ID"
          value={referenceId}
          onChange={(e) => setReferenceId(e.target.value)}
          className="w-full rounded-lg border border-dark-border-light px-3 py-2 text-sm bg-dark-surface text-text-primary placeholder-text-muted focus:border-primary"
        />
      </div>

      {error && <p className="text-sm text-red-300">{error}</p>}

      <div className="flex gap-2">
        <button
          onClick={handlePay}
          disabled={isLoading || !referenceId.trim()}
          className="flex-1 bg-primary text-white rounded-lg py-2.5 font-medium hover:bg-primary-hover disabled:opacity-50 transition-colors"
        >
          {isLoading ? "Verifying Payment..." : "Confirm & Join"}
        </button>
        <button
          onClick={() => { setShowForm(false); setError(null); }}
          className="px-4 py-2 text-sm text-text-muted hover:text-text-primary"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}