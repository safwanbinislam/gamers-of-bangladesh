"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";
import { getMatchStatusLabel } from "@/lib/utils";
import { MatchReportControl } from "./MatchReportControl";

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
  is_bye: boolean;
  player1?: Player | null;
  player2?: Player | null;
}

interface Round {
  round_number: number;
  matches: Match[];
}

interface BracketViewProps {
  tournamentId: string;
  initialRounds: Round[];
  currentUserId: string;
  isOrganizer: boolean;
  isAdmin: boolean;
}

export function BracketView({ tournamentId, initialRounds, currentUserId, isOrganizer, isAdmin }: BracketViewProps) {
  const [rounds, setRounds] = useState<Round[]>(initialRounds);
  const [activeMatchId, setActiveMatchId] = useState<string | null>(null);
  const [mobileRoundIndex, setMobileRoundIndex] = useState(0);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const tabScrollRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef(0);
  const touchEndX = useRef(0);
  const canReport = isOrganizer || isAdmin;
  const totalRounds = rounds.length;

  // Auto-scroll active tab into view
  useEffect(() => {
    if (tabScrollRef.current) {
      const tab = tabScrollRef.current.children[mobileRoundIndex] as HTMLElement;
      if (tab) {
        tab.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
      }
    }
  }, [mobileRoundIndex]);

  // Handle touch swipe on mobile
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    touchEndX.current = e.changedTouches[0].clientX;
    const delta = touchStartX.current - touchEndX.current;
    if (Math.abs(delta) > 50) {
      if (delta > 0 && mobileRoundIndex < totalRounds - 1) {
        setMobileRoundIndex((i) => i + 1);
      } else if (delta < 0 && mobileRoundIndex > 0) {
        setMobileRoundIndex((i) => i - 1);
      }
    }
  };

  useEffect(() => {
    if (initialRounds.length === 0) return;

    const supabase = createBrowserSupabaseClient();
    const channel = supabase
      .channel(`bracket-${tournamentId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "tournament_matches",
          filter: `tournament_id=eq.${tournamentId}`,
        },
        async (payload) => {
          const changedMatch = payload.new as Match;

          // Fetch player data for the changed match
          let player1: Player | null = null;
          let player2: Player | null = null;

          if (changedMatch.player1_id) {
            const { data: p1 } = await supabase
              .from("profiles")
              .select("id, username")
              .eq("id", changedMatch.player1_id)
              .single();
            if (p1) player1 = p1;
          }
          if (changedMatch.player2_id) {
            const { data: p2 } = await supabase
              .from("profiles")
              .select("id, username")
              .eq("id", changedMatch.player2_id)
              .single();
            if (p2) player2 = p2;
          }

          setRounds((prev) =>
            prev.map((round) => ({
              ...round,
              matches: round.matches.map((m) =>
                m.id === changedMatch.id
                  ? { ...changedMatch, player1: player1 ?? m.player1, player2: player2 ?? m.player2 }
                  : m
              ),
            }))
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tournamentId, initialRounds]);

  if (rounds.length === 0) {
    return (
      <div className="bg-dark-surface border border-dark-border rounded-xl p-8 text-center">
        <div className="text-4xl mb-3">🏆</div>
        <h3 className="font-semibold text-text-primary text-lg">Bracket Not Generated Yet</h3>
        <p className="text-text-muted text-sm mt-1">
          The bracket will appear here once registration is closed and the bracket is generated.
        </p>
      </div>
    );
  }

  const isLargeBracket = totalRounds > 4;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-text-primary">Tournament Bracket</h3>
        <span className="text-xs text-text-muted">
          {totalRounds} round{totalRounds !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Mobile: round tab selector + swipeable rounds */}
      <div className="sm:hidden" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
        {/* Round tab pills */}
        <div
          ref={tabScrollRef}
          className="flex gap-1.5 overflow-x-auto pb-2 scrollbar-none -mx-1 px-1"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
        >
          {rounds.map((round, idx) => (
            <button
              key={round.round_number}
              onClick={() => setMobileRoundIndex(idx)}
              className={`shrink-0 text-xs font-semibold px-3 py-1.5 rounded-full transition-all border ${
                idx === mobileRoundIndex
                  ? "bg-primary/20 text-primary-light border-primary/50"
                  : "bg-dark-surface text-text-muted border-dark-border hover:border-dark-border-light"
              }`}
            >
              Round {round.round_number}
              {round.round_number === totalRounds ? " (Final)" : ""}
            </button>
          ))}
        </div>

        {/* Current round matches */}
        {rounds[mobileRoundIndex] && (
          <div className="bg-dark-surface border border-dark-border rounded-xl p-3">
            <div className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-2 flex items-center justify-between">
              <span>
                Round {rounds[mobileRoundIndex].round_number}
                {rounds[mobileRoundIndex].round_number === totalRounds ? " — Final" : ""}
              </span>
              <span className="text-[10px] text-text-muted">
                {mobileRoundIndex + 1} of {totalRounds}
              </span>
            </div>
            <div className="space-y-2">
              {rounds[mobileRoundIndex].matches.map((match) => (
                <MatchBox
                  key={match.id}
                  match={match}
                  isOrganizer={canReport}
                  currentUserId={currentUserId}
                  isActive={activeMatchId === match.id}
                  onReportClick={() => setActiveMatchId(activeMatchId === match.id ? null : match.id)}
                  compact
                />
              ))}
            </div>
          </div>
        )}

        {/* Swipe hint / prev-next buttons */}
        <div className="flex items-center justify-between pt-2">
          <button
            onClick={() => setMobileRoundIndex((i) => Math.max(0, i - 1))}
            disabled={mobileRoundIndex === 0}
            className="text-xs px-3 py-1.5 rounded-lg bg-dark-surface border border-dark-border text-text-secondary disabled:opacity-30 disabled:cursor-not-allowed hover:border-dark-border-light transition-colors"
          >
            ← Previous
          </button>
          <span className="text-[10px] text-text-muted">Swipe to navigate</span>
          <button
            onClick={() => setMobileRoundIndex((i) => Math.min(totalRounds - 1, i + 1))}
            disabled={mobileRoundIndex === totalRounds - 1}
            className="text-xs px-3 py-1.5 rounded-lg bg-dark-surface border border-dark-border text-text-secondary disabled:opacity-30 disabled:cursor-not-allowed hover:border-dark-border-light transition-colors"
          >
            Next →
          </button>
        </div>
      </div>

      {/* Desktop: horizontal bracket with scroll */}
      <div
        ref={scrollContainerRef}
        className={`hidden sm:block overflow-x-auto pb-4 ${isLargeBracket ? "cursor-grab active:cursor-grabbing" : ""}`}
      >
        <div
          className="flex gap-4 min-w-0"
          style={{ width: `${totalRounds * 240}px` }}
        >
          {rounds.map((round, roundIdx) => {
            const matchHeight = 80;
            const verticalGap = roundIdx === 0 ? 8 : Math.pow(2, roundIdx - 1) * matchHeight + 8;

            return (
              <div key={round.round_number} className="flex flex-col gap-0" style={{ width: "220px", minWidth: "220px" }}>
                <div className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-2 text-center">
                  Round {round.round_number}
                  {round.round_number === totalRounds ? " (Final)" : ""}
                </div>
                <div className="flex flex-col" style={{ gap: `${verticalGap}px` }}>
                  {round.matches.map((match) => (
                    <MatchBox
                      key={match.id}
                      match={match}
                      isOrganizer={canReport}
                      currentUserId={currentUserId}
                      isActive={activeMatchId === match.id}
                      onReportClick={() => setActiveMatchId(activeMatchId === match.id ? null : match.id)}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Match report modal */}
      {activeMatchId && canReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" onClick={() => setActiveMatchId(null)}>
          <div className="bg-dark-surface border border-dark-border rounded-xl p-5 max-w-md w-full" onClick={(e) => e.stopPropagation()}>
            <h4 className="font-semibold text-text-primary mb-3">Report Match Result</h4>
            {(() => {
              const match = rounds.flatMap((r) => r.matches).find((m) => m.id === activeMatchId);
              if (!match) return null;
              return (
                <MatchReportControl
                  match={match}
                  onComplete={() => setActiveMatchId(null)}
                />
              );
            })()}
            <button
              onClick={() => setActiveMatchId(null)}
              className="mt-3 text-sm text-text-muted hover:text-text-primary"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function MatchBox({
  match,
  isOrganizer,
  currentUserId,
  isActive,
  onReportClick,
  compact = false,
}: {
  match: Match;
  isOrganizer: boolean;
  currentUserId: string;
  isActive: boolean;
  onReportClick: () => void;
  compact?: boolean;
}) {
  const isBye = match.is_bye === true || !match.player2_id;
  const isTbd = !match.player1_id && !match.player2_id;
  const isReported = match.status === "reported" || match.status === "confirmed";
  const isReady = match.status === "ready" || match.status === "pending";
  const canReportThis = isOrganizer && isReady && match.player1_id && match.player2_id;

  const player1Won = isReported && match.winner_id === match.player1_id;
  const player2Won = isReported && match.winner_id === match.player2_id;

  const borderClass = isTbd
    ? "border-dashed border-dark-border-light"
    : isBye && !match.player1_id
    ? "border-dark-border-light"
    : isReported
    ? "border-primary/50"
    : isActive
    ? "border-primary"
    : "border-dark-border";

  return (
    <div
      className={`bg-dark-surface-2 border rounded-lg transition-all ${borderClass} ${compact ? "p-2" : "p-2.5"}`}
    >
      {/* Player 1 */}
      <div
        className={`flex items-center gap-1.5 py-1 ${
          isTbd ? "text-text-muted" : player1Won ? "text-primary-light font-semibold" : player2Won ? "text-text-muted opacity-60" : "text-text-primary"
        }`}
      >
        <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
          isTbd ? "bg-dark-surface-2 border border-dashed border-dark-border-light" : "bg-dark-surface"
        }`}>
          {isTbd ? "?" : match.player1?.username?.[0]?.toUpperCase() ?? "?"}
        </div>
        <span className={`text-xs min-w-0 truncate ${compact ? "text-[11px]" : ""}`} title={match.player1?.username ?? undefined}>
          {isTbd
            ? "TBD"
            : match.player1?.username ?? (match.player1_id ? `Player ${match.player1_id.slice(0, 6)}` : "TBD")}
        </span>
        {player1Won && (
          <span className="ml-auto text-[10px] bg-emerald-900/40 text-emerald-300 font-bold px-1.5 py-0.5 rounded shrink-0">
            WIN
          </span>
        )}
        {isBye && !match.player1_id && (
          <span className="ml-auto text-[10px] text-text-muted italic shrink-0">bye</span>
        )}
      </div>

      {/* Divider */}
      {!isTbd && <div className="border-t border-dark-border my-1" />}

      {/* Player 2 or Bye */}
      {isTbd ? (
        <div className="flex items-center gap-1.5 py-1 text-text-muted">
          <div className="w-5 h-5 rounded-full bg-dark-surface-2 border border-dashed border-dark-border-light flex items-center justify-center text-[10px] font-bold shrink-0">
            ?
          </div>
          <span className="text-xs italic min-w-0 truncate">TBD</span>
        </div>
      ) : isBye ? (
        <div className="flex items-center gap-1.5 py-1 text-text-muted/60">
          <div className="w-5 h-5 rounded-full bg-dark-surface-2 flex items-center justify-center text-[10px] font-bold shrink-0 text-text-muted/40">
            —
          </div>
          <span className="text-xs italic min-w-0 truncate">Bye</span>
        </div>
      ) : (
        <div
          className={`flex items-center gap-1.5 py-1 ${
            player2Won ? "text-primary-light font-semibold" : player1Won ? "text-text-muted opacity-60" : "text-text-primary"
          }`}
        >
          <div className="w-5 h-5 rounded-full bg-dark-surface flex items-center justify-center text-[10px] font-bold shrink-0">
            {match.player2?.username?.[0]?.toUpperCase() ?? "?"}
          </div>
          <span className={`text-xs min-w-0 truncate ${compact ? "text-[11px]" : ""}`} title={match.player2?.username ?? undefined}>
            {match.player2?.username ?? (match.player2_id ? `Player ${match.player2_id.slice(0, 6)}` : "TBD")}
          </span>
          {player2Won && (
            <span className="ml-auto text-[10px] bg-emerald-900/40 text-emerald-300 font-bold px-1.5 py-0.5 rounded shrink-0">
              WIN
            </span>
          )}
        </div>
      )}

      {/* Report button for organizer */}
      {canReportThis && (
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onReportClick();
          }}
          className="mt-1.5 w-full text-[10px] py-1 rounded bg-primary/20 text-primary-light hover:bg-primary/30 font-medium transition-colors"
        >
          Report Result
        </button>
      )}

      {/* Status badge */}
      {isReported && (
        <div className="mt-1 text-[10px] bg-emerald-900/20 text-emerald-400/80 text-center font-medium px-1.5 py-0.5 rounded">
          ✓ {getMatchStatusLabel(match.status)}
        </div>
      )}
    </div>
  );
}
