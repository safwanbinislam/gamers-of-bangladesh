import { notFound } from "next/navigation";
import Link from "next/link";
import { createServerSupabaseClient, requireAuthUserId } from "@/lib/supabase/server";
import { formatBDT, getGameLabel, getTournamentStatusLabel, getTournamentStatusColor } from "@/lib/utils";
import { TournamentDetailClient } from "./TournamentDetailClient";

export default async function TournamentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = await requireAuthUserId();
  const supabase = await createServerSupabaseClient();

  const { data: tournament, error } = await supabase
    .from("tournaments")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !tournament) notFound();

  // Check if user is organizer
  const isOrganizer = tournament.organizer_id === userId;
  let isAdmin = false;
  if (!isOrganizer) {
    const { data: adminCheck } = await supabase.rpc("is_admin");
    isAdmin = adminCheck === true;
  }

  // Get registration count
  const { count: registeredCount } = await supabase
    .from("tournament_registrations")
    .select("*", { count: "exact", head: true })
    .eq("tournament_id", id);

  const { count: paidCount } = await supabase
    .from("tournament_registrations")
    .select("*", { count: "exact", head: true })
    .eq("tournament_id", id)
    .eq("payment_status", "paid");

  // Check if current user is registered
  const { data: myRegistration } = await supabase
    .from("tournament_registrations")
    .select("id, payment_status")
    .eq("tournament_id", id)
    .eq("player_id", userId)
    .maybeSingle();

  const isRegistered = !!myRegistration;

  // Get bracket data if available
  const { data: matches } = await supabase
    .from("tournament_matches")
    .select("*, player1:profiles!tournament_matches_player1_id_fkey(id, username), player2:profiles!tournament_matches_player2_id_fkey(id, username)")
    .eq("tournament_id", id)
    .order("round_number", { ascending: true })
    .order("match_number", { ascending: true });

  const hasBracket = !!(matches && matches.length > 0);

  // Group matches into rounds — cast to the client component's expected shape
  const rounds: { round_number: number; matches: unknown[] }[] = [];
  if (matches) {
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

  // Get payouts if tournament is completed
  const { data: payouts } = await supabase
    .from("tournament_prize_payouts")
    .select("*, player:profiles(id, username)")
    .eq("tournament_id", id)
    .order("placement", { ascending: true });

  const statusColor = getTournamentStatusColor(tournament.status);
  const startDate = new Date(tournament.starts_at);
  const spotsLeft = tournament.max_participants - (registeredCount ?? 0);
  const isFull = spotsLeft <= 0 && tournament.status === "registration_open";

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
      <Link href="/tournaments" className="inline-flex items-center text-sm text-text-secondary hover:text-text-primary">
        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back to Tournaments
      </Link>

      {/* Tournament Header */}
      <div className="bg-dark-surface border border-dark-border rounded-xl p-5 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="bg-dark-surface-2 text-text-secondary text-xs px-2 py-0.5 rounded-full">
                {getGameLabel(tournament.game)}
              </span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor.bg} ${statusColor.text}`}>
                {getTournamentStatusLabel(tournament.status)}
              </span>
            </div>
            <h1 className="text-xl font-bold text-text-primary font-display">{tournament.title}</h1>
          </div>
          <span className="text-2xl font-bold text-primary-light whitespace-nowrap">{formatBDT(tournament.entry_fee_bdt)}</span>
        </div>

        {tournament.rules && (
          <div className="bg-dark-surface-2 border border-dark-border rounded-lg p-3">
            <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-1">Rules</h3>
            <p className="text-sm text-text-secondary whitespace-pre-wrap">{tournament.rules}</p>
          </div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
          <div className="bg-dark-surface-2 rounded-lg p-3">
            <p className="text-lg font-bold text-primary-light">{formatBDT(tournament.entry_fee_bdt)}</p>
            <p className="text-xs text-text-muted">Entry Fee</p>
          </div>
          <div className="bg-dark-surface-2 rounded-lg p-3">
            <p className="text-lg font-bold text-text-primary">{registeredCount ?? 0}</p>
            <p className="text-xs text-text-muted">Registered</p>
          </div>
          <div className="bg-dark-surface-2 rounded-lg p-3">
            <p className="text-lg font-bold text-text-primary">{tournament.max_participants}</p>
            <p className="text-xs text-text-muted">Max Slots</p>
          </div>
          <div className="bg-dark-surface-2 rounded-lg p-3">
            <p className="text-lg font-bold text-text-primary">
              {startDate.toLocaleDateString("en-BD", { month: "short", day: "numeric" })}
            </p>
            <p className="text-xs text-text-muted">Starts</p>
          </div>
        </div>

        {/* Prize Split */}
        {tournament.prize_split && typeof tournament.prize_split === "object" && (
          <div className="border-t border-dark-border pt-3">
            <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-2">Prize Split</h3>
            <div className="flex flex-wrap gap-2">
              {Object.entries(tournament.prize_split as Record<string, number>).map(([label, percent]) => (
                <div key={label} className="bg-amber-900/20 border border-amber-700/30 rounded-lg px-3 py-1.5 text-center">
                  <p className="text-xs text-amber-300 font-medium">{label}</p>
                  <p className="text-sm font-bold text-amber-200">{percent}%</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Progress bar */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="text-text-muted">Registration Progress</span>
            <span className="text-text-secondary font-medium">
              {registeredCount ?? 0} / {tournament.max_participants}
              {isFull && <span className="text-amber-300 ml-1">(Full)</span>}
            </span>
          </div>
          <div className="w-full bg-dark-surface-2 rounded-full h-2 overflow-hidden">
            <div
              className="bg-primary h-full rounded-full transition-all"
              style={{ width: `${Math.min(100, ((registeredCount ?? 0) / tournament.max_participants) * 100)}%` }}
            />
          </div>
        </div>
      </div>

      {/* Client component for interactive parts */}
      <TournamentDetailClient
        tournamentId={tournament.id}
        tournamentStatus={tournament.status}
        entryFeeBdt={tournament.entry_fee_bdt}
        isRegistered={isRegistered}
        isFull={isFull}
        isOrganizer={isOrganizer}
        isAdmin={isAdmin}
        currentUserId={userId}
        initialRounds={rounds as any}
        hasBracket={hasBracket}
        payouts={payouts ?? []}
      />
    </div>
  );
}