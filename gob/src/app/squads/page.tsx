import { Suspense } from "react";
import Link from "next/link";
import { createServerSupabaseClient, requireAuthUserId } from "@/lib/supabase/server";
import { getSquadMatches } from "@/lib/actions/squadFinder";
import { SquadGameTabs } from "./SquadGameTabs";
import { SquadMatchCard } from "./SquadMatchCard";
import { SquadPreferencesForm } from "./SquadPreferencesForm";

const GAMES = [
  { value: "free_fire", label: "Free Fire" },
  { value: "pubg_mobile", label: "PUBG Mobile" },
  { value: "mobile_legends", label: "Mobile Legends" },
  { value: "other", label: "Other" },
] as const;

type GameValue = (typeof GAMES)[number]["value"];

async function SquadContent({ game }: { game: GameValue }) {
  const userId = await requireAuthUserId();
  const supabase = await createServerSupabaseClient();

  // Fetch the user's existing preferences for this game (for the form).
  const { data: prefs } = await supabase
    .from("squad_preferences")
    .select("*")
    .eq("player_id", userId)
    .eq("game", game)
    .maybeSingle();

  // Fetch ranked matches for this game.
  const matchesResult = await getSquadMatches(game);

  return (
    <div className="space-y-6">
      <SquadPreferencesForm game={game} existing={prefs ?? null} />

      <div>
        <h2 className="text-lg font-semibold text-text-primary font-display mb-3">Suggested Teammates</h2>
        {matchesResult.success ? (
          matchesResult.data.length === 0 ? (
            <div className="text-center py-10 bg-dark-surface border border-dark-border rounded-xl">
              <div className="text-4xl mb-3">🎯</div>
              <h3 className="font-semibold text-text-primary">No matches found yet</h3>
              <p className="text-text-muted text-sm mt-1">
                No active players match your preferences for {GAMES.find((g) => g.value === game)?.label}. Check back later.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {matchesResult.data.map((match) => (
                <SquadMatchCard key={match.player_id} match={match} game={game} />
              ))}
            </div>
          )
        ) : (
          <div className="text-center py-10 bg-dark-surface border border-dark-border rounded-xl">
            <div className="text-4xl mb-3">📝</div>
            <h3 className="font-semibold text-text-primary">Set your preferences first</h3>
            <p className="text-text-muted text-sm mt-1">
              {matchesResult.message} Fill in the form above to see compatible players.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function SquadSkeleton() {
  return (
    <div className="space-y-6">
      <div className="bg-dark-surface border border-dark-border rounded-xl p-4 space-y-3 animate-pulse">
        <div className="h-4 bg-dark-surface-2 rounded w-1/3" />
        <div className="h-10 bg-dark-surface-2 rounded" />
        <div className="h-10 bg-dark-surface-2 rounded" />
      </div>
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="bg-dark-surface border border-dark-border rounded-xl p-4 animate-pulse space-y-2">
            <div className="h-4 bg-dark-surface-2 rounded w-1/2" />
            <div className="h-3 bg-dark-surface-2 rounded w-2/3" />
          </div>
        ))}
      </div>
    </div>
  );
}

export default async function SquadsPage({
  searchParams,
}: {
  searchParams: Promise<{ game?: string }>;
}) {
  const params = await searchParams;
  const game = (GAMES.some((g) => g.value === params.game) ? params.game : "free_fire") as GameValue;

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary font-display">Squad Finder</h1>
          <p className="text-sm text-text-secondary mt-1">Find compatible players to squad up with</p>
        </div>
        <Link href="/squads/requests" className="btn-ghost shrink-0 inline-flex items-center gap-1.5 px-4 py-2 text-sm">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
          </svg>
          My Requests
        </Link>
      </div>

      <SquadGameTabs currentGame={game} />

      <Suspense fallback={<SquadSkeleton />}>
        <SquadContent game={game} />
      </Suspense>
    </div>
  );
}