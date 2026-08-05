import { notFound } from "next/navigation";
import Link from "next/link";
import { createServerSupabaseClient, requireAuthUserId } from "@/lib/supabase/server";
import { BracketView } from "@/components/BracketView";

export default async function TournamentBracketPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = await requireAuthUserId();
  const supabase = await createServerSupabaseClient();

  const { data: tournament, error } = await supabase
    .from("tournaments")
    .select("id, title, status, organizer_id")
    .eq("id", id)
    .single();

  if (error || !tournament) notFound();

  const isOrganizer = tournament.organizer_id === userId;
  let isAdmin = false;
  if (!isOrganizer) {
    const { data: adminCheck } = await supabase.rpc("is_admin");
    isAdmin = adminCheck === true;
  }

  const { data: matches } = await supabase
    .from("tournament_matches")
    .select("*, player1:profiles!tournament_matches_player1_id_fkey(id, username), player2:profiles!tournament_matches_player2_id_fkey(id, username)")
    .eq("tournament_id", id)
    .order("round_number", { ascending: true })
    .order("match_number", { ascending: true });

  const rounds: { round_number: number; matches: unknown[] }[] = [];
  if (matches && matches.length > 0) {
    const roundsMap = new Map<number, unknown[]>();
    for (const match of matches) {
      const existing = roundsMap.get(match.round_number) ?? [];
      existing.push(match);
      roundsMap.set(match.round_number, existing);
    }
    for (const [round_number, roundMatches] of Array.from(roundsMap.entries()).sort(([a], [b]) => a - b)) {
      rounds.push({ round_number, matches: roundMatches ?? [] });
    }
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
      <Link href={`/tournaments/${id}`} className="inline-flex items-center text-sm text-text-secondary hover:text-text-primary">
        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back to Tournament
      </Link>

      <div>
        <h1 className="text-xl font-bold text-text-primary font-display">{tournament.title}</h1>
        <p className="text-sm text-text-secondary mt-1">Tournament Bracket</p>
      </div>

      <BracketView
        tournamentId={tournament.id}
        initialRounds={rounds as any}
        currentUserId={userId}
        isOrganizer={isOrganizer}
        isAdmin={isAdmin}
      />
    </div>
  );
}