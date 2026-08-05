"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";
import { RegisterButton } from "@/components/RegisterButton";
import { BracketView } from "@/components/BracketView";
import { PayoutsList } from "@/components/PayoutsList";
import { closeRegistration, triggerPayouts } from "@/lib/actions/tournaments";
import { showToast } from "@/components/Toast";

interface Match {
  id: string;
  tournament_id: string;
  round_number: number;
  match_number: number;
  player1_id: string | null;
  player2_id: string | null;
  winner_id: string | null;
  status: string;
  is_bye: boolean;
  player1?: { id: string; username: string } | null;
  player2?: { id: string; username: string } | null;
}

interface Round {
  round_number: number;
  matches: Match[];
}

interface Payout {
  id: string;
  placement: number;
  player_id: string;
  amount_bdt: number;
  payout_status: string;
  paid_at: string | null;
  player?: { id: string; username: string } | null;
}

interface TournamentDetailClientProps {
  tournamentId: string;
  tournamentStatus: string;
  entryFeeBdt: number;
  isRegistered: boolean;
  isFull: boolean;
  isOrganizer: boolean;
  isAdmin: boolean;
  currentUserId: string;
  initialRounds: Round[];
  hasBracket: boolean;
  payouts: Payout[];
}

export function TournamentDetailClient({
  tournamentId,
  tournamentStatus,
  entryFeeBdt,
  isRegistered,
  isFull,
  isOrganizer,
  isAdmin,
  currentUserId,
  initialRounds,
  hasBracket,
  payouts,
}: TournamentDetailClientProps) {
  const router = useRouter();
  const [status, setStatus] = useState(tournamentStatus);
  const [isClosingReg, setIsClosingReg] = useState(false);
  const [isTriggeringPayouts, setIsTriggeringPayouts] = useState(false);
  const [liveRegisteredCount, setLiveRegisteredCount] = useState<number | null>(null);

  // Realtime subscription for registration count
  useEffect(() => {
    const supabase = createBrowserSupabaseClient();
    const channel = supabase
      .channel(`registrations-${tournamentId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "tournament_registrations",
          filter: `tournament_id=eq.${tournamentId}`,
        },
        () => {
          setLiveRegisteredCount((prev) => (prev ?? 0) + 1);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tournamentId]);

  const handleCloseRegistration = async () => {
    if (!confirm("Close registration and generate the bracket? This cannot be undone.")) return;
    setIsClosingReg(true);
    const result = await closeRegistration(tournamentId);
    setIsClosingReg(false);

    if (result.success) {
      setStatus("bracket_generated");
      showToast("success", "Registration closed and bracket generated!");
      router.refresh();
    } else {
      showToast("error", result.message ?? "Failed to close registration.");
    }
  };

  const handleTriggerPayouts = async () => {
    if (!confirm("Trigger prize payouts for this tournament? This will calculate and disburse prizes.")) return;
    setIsTriggeringPayouts(true);
    const result = await triggerPayouts(tournamentId);
    setIsTriggeringPayouts(false);

    if (result.success) {
      showToast("success", result.message ?? "Payouts triggered successfully!");
      router.refresh();
    } else {
      showToast("error", result.message ?? "Failed to trigger payouts.");
    }
  };

  const showBracket = hasBracket || status === "bracket_generated" || status === "in_progress" || status === "completed";
  const showPayouts = payouts.length > 0 || status === "completed";

  return (
    <div className="space-y-6">
      {/* Register Button */}
      <RegisterButton
        tournamentId={tournamentId}
        entryFeeBdt={entryFeeBdt}
        isRegistered={isRegistered}
        isFull={isFull}
        status={status}
      />

      {/* Organizer Controls */}
      {isOrganizer && status === "registration_open" && (
        <div className="bg-dark-surface border border-dark-border rounded-xl p-4">
          <h3 className="font-semibold text-text-primary text-sm mb-2">Organizer Controls</h3>
          <p className="text-xs text-text-muted mb-3">
            Close registration to generate the tournament bracket. This will lock in all registered players.
          </p>
          <button
            onClick={handleCloseRegistration}
            disabled={isClosingReg}
            className="btn-primary text-sm px-4 py-2"
          >
            {isClosingReg ? "Generating Bracket..." : "Close Registration & Generate Bracket"}
          </button>
        </div>
      )}

      {/* Trigger Payouts (organizer only, when completed) */}
      {isOrganizer && status === "completed" && payouts.length === 0 && (
        <div className="bg-dark-surface border border-dark-border rounded-xl p-4">
          <h3 className="font-semibold text-text-primary text-sm mb-2">Prize Payouts</h3>
          <p className="text-xs text-text-muted mb-3">
            Calculate and disburse prize payouts to the winners.
          </p>
          <button
            onClick={handleTriggerPayouts}
            disabled={isTriggeringPayouts}
            className="btn-primary text-sm px-4 py-2"
          >
            {isTriggeringPayouts ? "Processing..." : "Trigger Payouts"}
          </button>
        </div>
      )}

      {/* Bracket View */}
      {showBracket && (
        <BracketView
          tournamentId={tournamentId}
          initialRounds={initialRounds}
          currentUserId={currentUserId}
          isOrganizer={isOrganizer}
          isAdmin={isAdmin}
        />
      )}

      {/* Payouts */}
      {showPayouts && (
        <PayoutsList payouts={payouts} />
      )}
    </div>
  );
}