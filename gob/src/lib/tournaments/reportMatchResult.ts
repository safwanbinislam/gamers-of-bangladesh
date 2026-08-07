import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

type TypedSupabaseClient = SupabaseClient<Database>;
type MatchRow = Database["public"]["Tables"]["tournament_matches"]["Row"];

export type ReportMatchResultOutcome =
  | { success: true; match: MatchRow }
  | { success: false; code: string; message: string };

/**
 * Reports a match result. The `report_match_result` RPC is atomic on the
 * database side: it validates the caller (organizer or admin), records the
 * winner, AND advances the winner into the next round (or marks the
 * tournament 'completed' for the final round) inside one function/transaction.
 * Application code therefore makes a single `.rpc()` call — there is NO
 * separate `advance_winner_to_next_round` call here, and one must not be
 * added: that function carries no authorization checks of its own, and its
 * `authenticated` EXECUTE grant is revoked (20260807020100) so it is
 * internal-only.
 *
 * Steps performed here (defense in depth, independent of RLS):
 *
 *   1. Verify the caller is the tournament organizer or an admin (checked
 *      here, independent of RLS) — participants cannot self-report; this
 *      matches the RPC's own internal rule and the UI (BracketView only
 *      renders the report control for organizer/admin).
 *   2. Validate winner_id is actually one of the two players.
 *   3. Call report_match_result(match_id, winner_id) — this single RPC
 *      records the result and advances/completes in one DB transaction.
 *
 * IDEMPOTENCY / RETRY: if this function is called again for a match that
 * is already 'reported' with the SAME winner_id, step 3 is skipped as a
 * no-op — this makes it safe for a client to retry after a transient
 * failure without double-reporting. If the match is already 'reported' with
 * a DIFFERENT winner_id, that is a genuine conflict and is rejected —
 * resolving a disputed result is handled via the existing disputes flow,
 * not this function.
 */
export async function reportMatchResult(
  supabase: TypedSupabaseClient,
  matchId: string,
  winnerId: string,
  callerId: string
): Promise<ReportMatchResultOutcome> {
  const { data: match, error: fetchError } = await supabase
    .from("tournament_matches")
    .select("*")
    .eq("id", matchId)
    .single();

  if (fetchError || !match) {
    return { success: false, code: "NOT_FOUND", message: "Match not found" };
  }

  // Fetch the tournament to enforce the organizer/admin gate. Participants
  // cannot self-report — this matches the RPC's own internal rule and the UI
  // (BracketView only shows the report control to organizer/admin).
  const { data: tournament, error: tournamentError } = await supabase
    .from("tournaments")
    .select("organizer_id")
    .eq("id", match.tournament_id)
    .single();

  if (tournamentError || !tournament) {
    return { success: false, code: "NOT_FOUND", message: "Tournament not found" };
  }

  const isOrganizer = tournament.organizer_id === callerId;
  let isAdmin = false;
  if (!isOrganizer) {
    const { data: adminCheck } = await supabase.rpc("is_admin");
    isAdmin = adminCheck === true;
  }

  if (!isOrganizer && !isAdmin) {
    return {
      success: false,
      code: "FORBIDDEN",
      message: "Only the tournament organizer or an admin can report a match result",
    };
  }

  if (winnerId !== match.player1_id && winnerId !== match.player2_id) {
    return {
      success: false,
      code: "INVALID_WINNER",
      message: "winner_id must be one of the two players in this match",
    };
  }

  const alreadyReportedSameWinner = match.status === "reported" && match.winner_id === winnerId;

  if (!alreadyReportedSameWinner) {
    if (match.status === "reported" && match.winner_id && match.winner_id !== winnerId) {
      return {
        success: false,
        code: "CONFLICTING_REPORT",
        message:
          "This match already has a different reported result. Use the disputes flow to contest it rather than re-reporting.",
      };
    }

    const { error: reportError } = await supabase.rpc("report_match_result", {
      p_match_id: matchId,
      p_winner_id: winnerId,
    });

    if (reportError) {
      console.error("Error reporting match result:", reportError);
      return { success: false, code: "REPORT_FAILED", message: "Failed to report the match result" };
    }
  }

  const { data: reportedMatch, error: refetchError } = await supabase
    .from("tournament_matches")
    .select("*")
    .eq("id", matchId)
    .single();

  if (refetchError || !reportedMatch) {
    return {
      success: false,
      code: "DATABASE_ERROR",
      message: "Result reported but the match could not be refetched",
    };
  }

  return { success: true, match: reportedMatch };
}
