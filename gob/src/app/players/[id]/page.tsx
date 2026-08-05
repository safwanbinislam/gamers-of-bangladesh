import { notFound } from "next/navigation";
import Link from "next/link";
import { getPlayerPassport } from "@/lib/actions/passport";
import { getAuthUserId } from "@/lib/supabase/server";
import { PassportHeader } from "@/components/PassportHeader";
import { BadgeRow } from "@/components/BadgeRow";
import { TradeReputationCard } from "@/components/TradeReputationCard";
import { TournamentRecordCard } from "@/components/TournamentRecordCard";
import { SelfReportedStatsSection } from "@/components/SelfReportedStatsSection";
import type { PlayerPassport } from "@/lib/passport/types";

export default async function PlayerPassportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await getPlayerPassport(id);

  if (!result.success) {
    notFound();
  }

  const passport = result.data as unknown as PlayerPassport;
  const currentUserId = await getAuthUserId();
  const isOwn = currentUserId === id;

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">
      <PassportHeader
        username={passport.username}
        avatarUrl={passport.avatar_url}
        memberSince={passport.member_since}
        phoneVerified={passport.phone_verified}
      />

      {isOwn && (
        <Link
          href={`/players/${id}/edit-stats`}
          className="btn-primary inline-flex items-center justify-center gap-2 px-4 py-2 text-sm w-full sm:w-auto"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
          Edit My Stats
        </Link>
      )}

      <BadgeRow badges={passport.badges} />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <TradeReputationCard
          reputationScore={passport.reputation_score}
          totalTrades={passport.total_trades}
        />
        <TournamentRecordCard
          tournamentsPlayed={passport.tournaments_played}
          tournamentsWon={passport.tournaments_won}
          bestPlacement={passport.best_placement}
          totalMatchesWon={passport.total_matches_won}
          totalMatchesPlayed={passport.total_matches_played}
        />
      </div>

      <SelfReportedStatsSection gameStats={passport.game_stats} />
    </div>
  );
}