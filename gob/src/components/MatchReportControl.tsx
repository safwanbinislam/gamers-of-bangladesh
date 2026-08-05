"use client";

import { useState } from "react";
import { reportMatchResult } from "@/lib/actions/tournaments";
import { showToast } from "@/components/Toast";

interface Player {
  id: string;
  username: string;
}

interface Match {
  id: string;
  tournament_id: string;
  round_number: number;
  match_number: number;
  player1_id: string | null;
  player2_id: string | null;
  winner_id: string | null;
  status: string;
  player1?: Player | null;
  player2?: Player | null;
}

interface MatchReportControlProps {
  match: Match;
  onComplete: () => void;
}

export function MatchReportControl({ match, onComplete }: MatchReportControlProps) {
  const [selectedWinner, setSelectedWinner] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmStep, setConfirmStep] = useState(false);

  const handleSubmit = async () => {
    if (!selectedWinner) return;
    setIsSubmitting(true);

    const result = await reportMatchResult(match.id, selectedWinner);

    setIsSubmitting(false);
    if (result.success) {
      showToast("success", "Match result reported successfully!");
      onComplete();
    } else {
      showToast("error", result.message ?? "Failed to report match result.");
    }
  };

  const player1Name = match.player1?.username ?? (match.player1_id ? `Player ${match.player1_id.slice(0, 6)}` : "Unknown");
  const player2Name = match.player2?.username ?? (match.player2_id ? `Player ${match.player2_id.slice(0, 6)}` : "Unknown");

  if (!match.player1_id || !match.player2_id) {
    return (
      <div className="text-sm text-text-muted text-center py-4">
        This match doesn't have two players yet. It may be a bye or waiting for advancement.
      </div>
    );
  }

  if (match.status === "reported" || match.status === "confirmed") {
    return (
      <div className="text-sm text-text-muted text-center py-4">
        This match has already been reported.
      </div>
    );
  }

  if (!confirmStep) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-text-secondary">Select the winner of this match:</p>

        <button
          onClick={() => {
            setSelectedWinner(match.player1_id!);
            setConfirmStep(true);
          }}
          className="w-full flex items-center gap-3 p-3 rounded-lg border border-dark-border hover:border-primary/50 hover:bg-dark-surface-2 transition-colors text-left"
        >
          <div className="w-8 h-8 rounded-full bg-primary-subtle text-primary-light flex items-center justify-center font-bold text-sm">
            {player1Name[0].toUpperCase()}
          </div>
          <span className="text-sm font-medium text-text-primary">{player1Name}</span>
        </button>

        <button
          onClick={() => {
            setSelectedWinner(match.player2_id!);
            setConfirmStep(true);
          }}
          className="w-full flex items-center gap-3 p-3 rounded-lg border border-dark-border hover:border-primary/50 hover:bg-dark-surface-2 transition-colors text-left"
        >
          <div className="w-8 h-8 rounded-full bg-primary-subtle text-primary-light flex items-center justify-center font-bold text-sm">
            {player2Name[0].toUpperCase()}
          </div>
          <span className="text-sm font-medium text-text-primary">{player2Name}</span>
        </button>
      </div>
    );
  }

  const winnerName = selectedWinner === match.player1_id ? player1Name : player2Name;

  return (
    <div className="space-y-3">
      <div className="bg-amber-900/20 border border-amber-700/30 rounded-lg p-3">
        <p className="text-sm text-amber-200 font-medium">Confirm Result</p>
        <p className="text-sm text-text-secondary mt-1">
          You are about to report <span className="text-primary-light font-semibold">{winnerName}</span> as the winner of this match.
        </p>
        <p className="text-xs text-text-muted mt-1">
          This action cannot be undone through the UI. Make sure the result is correct.
        </p>
      </div>

      <div className="flex gap-2">
        <button
          onClick={handleSubmit}
          disabled={isSubmitting}
          className="flex-1 bg-primary text-white rounded-lg py-2.5 font-medium hover:bg-primary-hover disabled:opacity-50 transition-colors"
        >
          {isSubmitting ? "Submitting..." : "Confirm & Report"}
        </button>
        <button
          onClick={() => setConfirmStep(false)}
          className="px-4 py-2 text-sm text-text-muted hover:text-text-primary"
        >
          Back
        </button>
      </div>
    </div>
  );
}