"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";
import { respondToSquadSession, cancelSquadSession } from "@/lib/actions/squadFinder";
import { showToast } from "@/components/Toast";
import { getGameLabel, getSquadStatusLabel, getSquadStatusColor } from "@/lib/utils";

interface SquadSessionRow {
  id: string;
  game: string;
  status: string;
  scheduled_at: string | null;
  created_at: string;
  initiator_id: string;
  recipient_id: string;
  initiator: { id: string; username: string; avatar_url: string | null; reputation_score: number } | null;
  recipient: { id: string; username: string; avatar_url: string | null; reputation_score: number } | null;
}

interface SquadRequestsListProps {
  sessions: SquadSessionRow[];
  currentUserId: string;
}

export function SquadRequestsList({ sessions, currentUserId }: SquadRequestsListProps) {
  const [items, setItems] = useState<SquadSessionRow[]>(sessions);
  const [respondingId, setRespondingId] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  // Live-update incoming requests via Realtime (squad_sessions is in supabase_realtime).
  useEffect(() => {
    const supabase = createBrowserSupabaseClient();
    const channel = supabase
      .channel("squad-requests")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "squad_sessions",
          filter: `recipient_id=eq.${currentUserId}`,
        },
        async (payload) => {
          const row = payload.new as { id: string; game: string; status: string; scheduled_at: string | null; created_at: string; initiator_id: string; recipient_id: string };
          // Fetch the initiator profile for display.
          const { data: profile } = await supabase
            .from("profiles")
            .select("id, username, avatar_url, reputation_score")
            .eq("id", row.initiator_id)
            .single();
          setItems((prev) => [
            {
              ...row,
              initiator: profile ?? null,
              recipient: { id: currentUserId, username: "You", avatar_url: null, reputation_score: 0 },
            },
            ...prev,
          ]);
          showToast("info", "New squad request received!");
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUserId]);

  const handleRespond = async (sessionId: string, accept: boolean) => {
    setRespondingId(sessionId);
    const result = await respondToSquadSession(sessionId, accept);
    setRespondingId(null);

    if (result.success) {
      setItems((prev) =>
        prev.map((s) => (s.id === sessionId ? { ...s, status: accept ? "accepted" : "declined" } : s))
      );
      showToast("success", accept ? "Squad request accepted" : "Squad request declined");
    } else {
      showToast("error", result.message ?? "Failed to respond to request");
    }
  };

  const handleCancel = async (sessionId: string) => {
    setCancellingId(sessionId);
    const result = await cancelSquadSession(sessionId);
    setCancellingId(null);

    if (result.success) {
      setItems((prev) => prev.filter((s) => s.id !== sessionId));
      showToast("success", "Squad request cancelled");
    } else {
      showToast("error", result.message ?? "Failed to cancel squad request");
    }
  };

  if (items.length === 0) {
    return (
      <div className="text-center py-12 bg-dark-surface border border-dark-border rounded-xl">
        <div className="text-5xl mb-4">📭</div>
        <h3 className="font-semibold text-text-primary text-lg">No squad requests</h3>
        <p className="text-text-muted text-sm mt-1">
          When someone requests to squad up with you, it will show up here.
        </p>
        <Link href="/squads" className="inline-block mt-4 btn-primary px-6 py-2 text-sm">
          Find Teammates
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {items.map((session) => {
        const statusColor = getSquadStatusColor(session.status);
        const isIncoming = session.recipient_id === currentUserId;
        const otherParty = isIncoming ? session.initiator : session.recipient;
        const canRespond = isIncoming && session.status === "requested";
        const canCancel = !isIncoming && session.status === "requested";

        return (
          <div key={session.id} className="bg-dark-surface border border-dark-border rounded-xl p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-full bg-primary-subtle text-primary-light flex items-center justify-center font-bold shrink-0">
                  {otherParty?.username?.[0]?.toUpperCase() ?? "?"}
                </div>
                <div className="min-w-0">
                  <p className="font-medium text-sm text-text-primary truncate">
                    {isIncoming ? (
                      <>
                        <Link href={`/players/${session.initiator_id}`} className="hover:text-primary-light">
                          {otherParty?.username ?? "Unknown"}
                        </Link>{" "}
                        wants to squad up
                      </>
                    ) : (
                      <>
                        You requested{" "}
                        <Link href={`/players/${session.recipient_id}`} className="hover:text-primary-light">
                          {otherParty?.username ?? "Unknown"}
                        </Link>
                      </>
                    )}
                  </p>
                  <div className="flex items-center gap-2 text-xs text-text-muted mt-0.5">
                    <span className="bg-dark-surface-2 px-2 py-0.5 rounded text-text-secondary">
                      {getGameLabel(session.game)}
                    </span>
                    <span className={`px-2 py-0.5 rounded-full font-medium ${statusColor.bg} ${statusColor.text}`}>
                      {getSquadStatusLabel(session.status)}
                    </span>
                  </div>
                </div>
              </div>
              <Link
                href={`/squads/${session.id}`}
                className="text-xs text-text-secondary hover:text-primary-light shrink-0"
              >
                View →
              </Link>
            </div>

            {canRespond && (
              <div className="flex gap-2 mt-3 pt-3 border-t border-dark-border">
                <button
                  onClick={() => handleRespond(session.id, true)}
                  disabled={respondingId === session.id}
                  className="flex-1 bg-primary text-white rounded-lg py-2 text-sm font-medium hover:bg-primary-hover disabled:opacity-50"
                >
                  {respondingId === session.id ? "Accepting..." : "Accept"}
                </button>
                <button
                  onClick={() => handleRespond(session.id, false)}
                  disabled={respondingId === session.id}
                  className="flex-1 btn-ghost py-2 text-sm"
                >
                  Decline
                </button>
              </div>
            )}

            {canCancel && (
              <div className="flex gap-2 mt-3 pt-3 border-t border-dark-border">
                <button
                  onClick={() => handleCancel(session.id)}
                  disabled={cancellingId === session.id}
                  className="flex-1 btn-ghost py-2 text-sm"
                >
                  {cancellingId === session.id ? "Cancelling..." : "Cancel Request"}
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}