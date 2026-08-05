import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { bkashProvider } from "@/lib/payments/bkash";
import { nagadProvider } from "@/lib/payments/nagad";

type TypedSupabaseClient = SupabaseClient<Database>;
type TournamentRow = Database["public"]["Tables"]["tournaments"]["Row"];
type PayoutRow = Database["public"]["Tables"]["tournament_prize_payouts"]["Row"];
type MatchRow = Database["public"]["Tables"]["tournament_matches"]["Row"];
type PrizeSplit = Record<string, number>;

export interface PayoutDisbursementResult {
  success: boolean;
  code?: string;
  message: string;
  payouts?: PayoutRow[];
}

/**
 * Maps ordinal placement labels used in prize_split ("1st", "2nd", "3rd", ...)
 * to a numeric placement rank (1, 2, 3, ...) for storing in
 * tournament_prize_payouts.placement.
 *
 * ASSUMPTION: prize_split keys follow the "1st"/"2nd"/"3rd"/"4th" English
 * ordinal convention, matching the example already used in this schema's own
 * tests ('{"1st":70,"2nd":30}'). If organizers are allowed to use arbitrary
 * label strings this mapping will need to be revisited — for now we parse
 * the leading integer out of each key.
 */
function placementFromLabel(label: string): number | null {
  const match = label.match(/^(\d+)/);
  if (!match) return null;
  return parseInt(match[1], 10);
}

/**
 * Determines final placements for a completed single-elimination tournament
 * from its match results: the final's winner is 1st, the final's loser is
 * 2nd, and the semifinal losers (if prize_split awards a 3rd place) share
 * 3rd/4th.
 *
 * ASSUMPTION: this bracket format does not implement a dedicated 3rd-place
 * playoff match (confirmed — the schema/RPCs only model the single
 * elimination bracket itself, no consolation bracket). If prize_split
 * includes a "3rd" placement, we assign 3rd/4th to the two semifinal losers
 * in match_number order. This is a reasonable best-effort default; an
 * organizer who needs an exact head-to-head 3rd-place decision would need a
 * real decider match, which is outside the current schema's scope.
 */
async function resolveFinalPlacements(
  supabase: TypedSupabaseClient,
  tournamentId: string
): Promise<{ placement: number; playerId: string }[]> {
  const { data: matches, error } = await supabase
    .from("tournament_matches")
    .select("*")
    .eq("tournament_id", tournamentId)
    .order("round_number", { ascending: false });

  if (error || !matches || matches.length === 0) {
    return [];
  }

  const finalRound = (matches[0] as MatchRow).round_number;
  const finalMatch = matches.find((m) => m.round_number === finalRound);

  if (!finalMatch || !finalMatch.winner_id) {
    return [];
  }

  const placements: { placement: number; playerId: string }[] = [
    { placement: 1, playerId: finalMatch.winner_id },
  ];

  const runnerUpId =
    finalMatch.player1_id === finalMatch.winner_id ? finalMatch.player2_id : finalMatch.player1_id;
  if (runnerUpId) {
    placements.push({ placement: 2, playerId: runnerUpId });
  }

  const semifinalRound = finalRound - 1;
  const semifinalMatches = matches
    .filter((m) => m.round_number === semifinalRound)
    .sort((a, b) => a.match_number - b.match_number);

  const semifinalLosers = semifinalMatches
    .filter((m) => m.winner_id)
    .map((m) => (m.player1_id === m.winner_id ? m.player2_id : m.player1_id))
    .filter((id): id is string => Boolean(id));

  semifinalLosers.forEach((playerId, index) => {
    placements.push({ placement: 3 + index, playerId });
  });

  return placements;
}

/**
 * Calculates each placement's payout amount, inserts tournament_prize_payouts
 * rows (payout_status = 'pending'), and attempts disbursement via the
 * relevant payment adapter's disburse() stub.
 *
 * Idempotency: this function does NOT check for existing payout rows itself
 * — callers (the POST /api/tournaments/[id]/payouts route) are responsible
 * for rejecting the request up front if tournament_prize_payouts rows
 * already exist for this tournament. This function assumes it is only
 * invoked once per tournament, guarded upstream.
 */
export async function disbursePayouts(
  supabase: TypedSupabaseClient,
  tournament: TournamentRow
): Promise<PayoutDisbursementResult> {
  if (tournament.status !== "completed") {
    return {
      success: false,
      code: "INVALID_STATUS",
      message: `Cannot disburse payouts: tournament status is "${tournament.status}", expected "completed"`,
    };
  }

  const prizeSplit = tournament.prize_split as PrizeSplit | null;
  if (!prizeSplit || typeof prizeSplit !== "object" || Array.isArray(prizeSplit)) {
    return { success: false, code: "INVALID_PRIZE_SPLIT", message: "Tournament has no valid prize_split configured" };
  }

  // Total pool = entry_fee_bdt * number of PAID registrations, minus platform fee.
  const { count: paidCount, error: countError } = await supabase
    .from("tournament_registrations")
    .select("*", { count: "exact", head: true })
    .eq("tournament_id", tournament.id)
    .eq("payment_status", "paid");

  if (countError) {
    return { success: false, code: "DATABASE_ERROR", message: "Failed to count paid registrations" };
  }

  const totalCollected = tournament.entry_fee_bdt * (paidCount ?? 0);
  const platformFee = totalCollected * (tournament.platform_fee_percent / 100);
  const distributable = Math.max(0, totalCollected - platformFee);

  const placements = await resolveFinalPlacements(supabase, tournament.id);
  if (placements.length === 0) {
    return { success: false, code: "NO_RESULTS", message: "Could not determine final placements for this tournament" };
  }

  const rowsToInsert: Database["public"]["Tables"]["tournament_prize_payouts"]["Insert"][] = [];

  for (const { placement, playerId } of placements) {
    const label = Object.keys(prizeSplit).find((key) => placementFromLabel(key) === placement);
    if (!label) continue; // No prize configured for this placement (e.g. no 3rd place prize)

    const percent = prizeSplit[label];
    const amount = Math.round(distributable * (percent / 100));

    rowsToInsert.push({
      tournament_id: tournament.id,
      player_id: playerId,
      placement,
      amount_bdt: amount,
      payout_status: "pending",
    });
  }

  if (rowsToInsert.length === 0) {
    return {
      success: false,
      code: "NO_PAYOUTS_CALCULATED",
      message: "No payout rows could be calculated from the prize split and final placements",
    };
  }

  const { data: insertedPayouts, error: insertError } = await supabase
    .from("tournament_prize_payouts")
    .insert(rowsToInsert)
    .select();

  if (insertError || !insertedPayouts) {
    console.error("Error inserting payout rows:", insertError);
    return { success: false, code: "DATABASE_ERROR", message: "Failed to record payout rows" };
  }

  /**
   * ASSUMPTION / SCHEMA GAP: to actually send money we need each winner's
   * payout destination (a wallet number), but the schema only captured a
   * payment_method + payment_reference_id at REGISTRATION time (i.e. how
   * they PAID their entry fee), not a persistent "send payouts here"
   * field. We reuse the player's registration payment_method as their
   * payout method, and their payment_reference_id as an approximate payout
   * recipient. This is a reasonable default for a sandbox/demo flow, but is
   * NOT guaranteed to be a valid disbursement destination in production —
   * payment_reference_id is a transaction reference, not necessarily the
   * payer's own wallet number. A production implementation should collect
   * a dedicated "payout wallet number" from winners before disbursing.
   * Flagged clearly here since this is a genuine gap in the current schema,
   * not something we can safely resolve at the application layer alone.
   */
  const finalPayouts: PayoutRow[] = [];

  for (const payout of insertedPayouts) {
    const { data: registration } = await supabase
      .from("tournament_registrations")
      .select("payment_method, payment_reference_id")
      .eq("tournament_id", tournament.id)
      .eq("player_id", payout.player_id)
      .maybeSingle();

    const provider = registration?.payment_method === "nagad" ? nagadProvider : bkashProvider;
    const recipient = registration?.payment_reference_id ?? payout.player_id;

    try {
      const disbursement = await provider.disburse({
        amount: payout.amount_bdt,
        recipient,
        reason: `Tournament prize payout - placement ${payout.placement} - tournament ${tournament.id}`,
      });

      if (disbursement.success) {
        const { data: updated } = await supabase
          .from("tournament_prize_payouts")
          .update({ payout_status: "paid", paid_at: new Date().toISOString() })
          .eq("id", payout.id)
          .select()
          .single();
        finalPayouts.push(updated ?? payout);
      } else {
        // Leave as 'pending' — NOT 'failed'. 'failed' is reserved for a
        // real provider actively rejecting the request; disburse() here is
        // a stub that never actually attempted a transfer (see the TODO on
        // PaymentProvider.disburse in lib/payments/types.ts).
        console.warn(
          `[payoutDisbursement] Disbursement not completed for payout ${payout.id}: ${disbursement.message}`
        );
        finalPayouts.push(payout);
      }
    } catch (err) {
      console.error(`[payoutDisbursement] Error disbursing payout ${payout.id}:`, err);
      finalPayouts.push(payout);
    }
  }

  return {
    success: true,
    message:
      "Payout rows created. Disbursement via bKash/Nagad is not yet integrated (see lib/payments/types.ts) — payouts remain 'pending' until processed manually or real payout API credentials are added.",
    payouts: finalPayouts,
  };
}
