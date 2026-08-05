"use client";

import { useState } from "react";
import Link from "next/link";
import { respondToSquadSession, submitSquadFeedback, completeSquadSession } from "@/lib/actions/squadFinder";
import { showToast } from "@/components/Toast";
import { getGameLabel, getSquadStatusLabel, getSquadStatusColor } from "@/lib/utils";

interface SquadSessionDetailProps {
  session: {
    id: string;
    game: string;
    status: string;
    scheduled_at: string | null;
    created_at: string;
    initiator_id: string;
    recipient_id: string;
    initiator: { id: string; username: string; avatar_url: string | null; reputation_score: number } | null;
    recipient: { id: string; username: string; avatar_url: string | null; reputation_score: number } | null;
  };
  currentUserId: string;
  myFeedback: { id: string; showed_up: boolean; note: string | null } | null;
}

export function SquadSessionDetail({ session, currentUserId, myFeedback }: SquadSessionDetailProps) {
  const [status, setStatus] = useState(session.status);
  const [isResponding, setIsResponding] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  const [feedback, setFeedback] = useState(myFeedback);
  const [showedUp, setShowedUp] = useState<boolean | null>(null);
  const [note, setNote] = useState("");
  const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false);

  const statusColor = getSquadStatusColor(status);
  const isIncoming = session.recipient_id === currentUserId;
  const otherParty = isIncoming ? session.initiator : session.recipient;
  const canRespond = isIncoming && status === "requested";

  // Feedback eligibility: completed, or accepted with a scheduled time in the past.
  const scheduledAt = session.scheduled_at ? new Date(session.scheduled_at) : null;
  const isFeedbackEligible =
    status === "completed" || (status === "accepted" && scheduledAt !== null && scheduledAt < new Date());

  const handleRespond = async (accept: boolean) => {
    setIsResponding(true);
    const result = await respondToSquadSession(session.id, accept);
    setIsResponding(false);
    if (result.success) {
      setStatus(accept ? "accepted" : "declined");
      showToast("success", accept ? "Squad request accepted" : "Squad request declined");
    } else {
      showToast("error", result.message ?? "Failed to respond");
    }
  };

  const handleComplete = async () => {
    setIsCompleting(true);
    const result = await completeSquadSession(session.id);
    setIsCompleting(false);
    if (result.success) {
      setStatus("completed");
      showToast("success", "Squad session marked as completed");
    } else {
      showToast("error", result.message ?? "Failed to complete squad session");
    }
  };

  const handleFeedback = async () => {
    if (showedUp === null || !otherParty) return;
    setIsSubmittingFeedback(true);
    const result = await submitSquadFeedback({
      session_id: session.id,
      subject_id: otherParty.id,
      showed_up: showedUp,
      note: note.trim() === "" ? null : note,
    });
    setIsSubmittingFeedback(false);
    if (result.success) {
      setFeedback({ id: result.data.id, showed_up: showedUp, note: note.trim() === "" ? null : note });
      showToast("success", "Feedback submitted");
    } else {
      showToast("error", result.message ?? "Failed to submit feedback");
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-dark-surface border border-dark-border rounded-xl p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-text-primary font-display">Squad Session</h1>
            <div className="flex items-center gap-2 mt-2 text-xs">
              <span className="bg-dark-surface-2 px-2 py-0.5 rounded text-text-secondary">{getGameLabel(session.game)}</span>
              <span className={`px-2 py-0.5 rounded-full font-medium ${statusColor.bg} ${statusColor.text}`}>
                {getSquadStatusLabel(status)}
              </span>
            </div>
          </div>
          <div className="text-right text-xs text-text-muted">
            <p>Created {new Date(session.created_at).toLocaleDateString("en-BD", { month: "short", day: "numeric", year: "numeric" })}</p>
            {scheduledAt && (
              <p className="mt-1">
                Scheduled {scheduledAt.toLocaleString("en-BD", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3 mt-4 pt-4 border-t border-dark-border">
          <div className="w-12 h-12 rounded-full bg-primary-subtle text-primary-light flex items-center justify-center text-lg font-bold">
            {otherParty?.username?.[0]?.toUpperCase() ?? "?"}
          </div>
          <div className="min-w-0">
            <Link href={`/players/${otherParty?.id ?? ""}`} className="font-semibold text-sm text-text-primary hover:text-primary-light">
              {otherParty?.username ?? "Unknown"}
            </Link>
            <p className="text-xs text-text-muted mt-0.5">
              {isIncoming ? "Requested to squad up with you" : "You requested to squad up"}
            </p>
          </div>
        </div>

        {canRespond && (
          <div className="flex gap-2 mt-4">
            <button
              onClick={() => handleRespond(true)}
              disabled={isResponding}
              className="flex-1 bg-primary text-white rounded-lg py-2 text-sm font-medium hover:bg-primary-hover disabled:opacity-50"
            >
              {isResponding ? "Accepting..." : "Accept"}
            </button>
            <button
              onClick={() => handleRespond(false)}
              disabled={isResponding}
              className="flex-1 btn-ghost py-2 text-sm"
            >
              Decline
            </button>
          </div>
        )}

        {status === "accepted" && (
          <div className="flex gap-2 mt-4">
            <button
              onClick={handleComplete}
              disabled={isCompleting}
              className="flex-1 bg-primary text-white rounded-lg py-2 text-sm font-medium hover:bg-primary-hover disabled:opacity-50"
            >
              {isCompleting ? "Completing..." : "Mark as Completed"}
            </button>
          </div>
        )}
      </div>

      {isFeedbackEligible && (
        <div className="bg-dark-surface border border-dark-border rounded-xl p-5 space-y-4">
          <h2 className="text-sm font-semibold text-text-primary">Did this squad-up happen?</h2>
          {feedback ? (
            <div className="text-sm text-text-secondary">
              <p>
                You reported:{" "}
                <span className={feedback.showed_up ? "text-emerald-300" : "text-red-300"}>
                  {feedback.showed_up ? "They showed up ✓" : "They didn't show up ✗"}
                </span>
              </p>
              {feedback.note && <p className="text-text-muted mt-1">"{feedback.note}"</p>}
            </div>
          ) : (
            <>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowedUp(true)}
                  className={`flex-1 py-2 text-sm font-medium rounded-lg border transition-colors ${
                    showedUp === true ? "bg-emerald-900/40 border-emerald-600 text-emerald-300" : "bg-dark-surface-2 border-dark-border-light text-text-secondary hover:border-emerald-600/40"
                  }`}
                >
                  ✓ They showed up
                </button>
                <button
                  onClick={() => setShowedUp(false)}
                  className={`flex-1 py-2 text-sm font-medium rounded-lg border transition-colors ${
                    showedUp === false ? "bg-red-900/40 border-red-600 text-red-300" : "bg-dark-surface-2 border-dark-border-light text-text-secondary hover:border-red-600/40"
                  }`}
                >
                  ✗ They didn't show
                </button>
              </div>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                maxLength={200}
                placeholder="Optional note..."
                className="w-full rounded-lg border border-dark-border-light px-3 py-2 text-sm bg-dark-surface text-text-primary placeholder-text-muted focus:border-primary focus:ring-1 focus:ring-primary"
              />
              <button
                onClick={handleFeedback}
                disabled={showedUp === null || isSubmittingFeedback}
                className="w-full btn-primary py-2.5 disabled:opacity-50"
              >
                {isSubmittingFeedback ? "Submitting..." : "Submit Feedback"}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}