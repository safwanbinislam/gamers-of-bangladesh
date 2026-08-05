import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

type TypedSupabaseClient = SupabaseClient<Database>;
type MatchRow = Database["public"]["Tables"]["tournament_matches"]["Row"];

export type ReportMatchResultOutcome =
  | { success: true; match: MatchRow }
  | { success: false; code: string; message: string };

/**
 * Reports a match result and advances the winner to the next round.
 *
 * SEQUENCING: `report_match_result` and `advance_winner_to_next_round` are
 * two SEPARATE Postgres functions — each `.rpc()` call here is its own
 * round-trip, not wrapped together in one database transaction from this
 * application's perspective. A failure between the two calls can therefore
 * leave a match 'reported' with a recorded winner, but that winner not yet
 * placed into the next round's match slot. We handle this explicitly:
 *
 *   1. Verify the caller is one of the two players in the match, or an
 *      admin (checked here, independent of RLS).
 *   2. Validate winner_id is actually one of the two players.
 *   3. Call report_match_result(match_id, winner_id).
 *   4. Call advance_winner_to_next_round(...).
 *   5. If step 4 fails, we do NOT attempt to roll back step 3 — there is
 *      no "un-report" operation, and the recorded result itself is still a
 *      valid, real outcome that should not be discarded just because the
 *      bracket-advancement step failed. Instead we return a distinct
 *      ADVANCEMENT_FAILED error so the caller/UI can surface "the result
 *      was recorded, but the bracket could not be advanced automatically;
 *      please retry" rather than silently losing the recorded result.
 *
 * IDEMPOTENCY / RETRY: if this function is called again for a match that
 * is already 'reported' with the SAME winner_id, step 3 is skipped as a
 * no-op and we proceed straight to (re-)attempting step 4 — this makes it
 * safe for a client to retry after an ADVANCEMENT_FAILED response without
 * double-reporting. If the match is already 'reported' with a DIFFERENT
 * winner_id, that is a genuine conflict and is rejected — resolving a
 * disputed result is handled via the existing disputes flow, not this
 * function.
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

  const isParticipant = match.player1_id === callerId || match.player2_id === callerId;
  let isAdmin = false;
  if (!isParticipant) {
    const { data: adminCheck } = await supabase.rpc("is_admin");
    isAdmin = adminCheck === true;
  }

  if (!isParticipant && !isAdmin) {
    return {
      success: false,
      code: "FORBIDDEN",
      message: "Only the two players in this match or an admin can report its result",
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

  // Advance the winner into the next round. If this match's round is the
  // final round, there is no next round to advance into — that "is this
  // the final?" determination correctly belongs to the RPC/schema, not
  // this application code, so we call it unconditionally and rely on the
  // RPC to no-op gracefully for a final-round match.
  const { error: advanceError } = await supabase.rpc("advance_winner_to_next_round", {
    p_tournament_id: reportedMatch.tournament_id,
    p_round_number: reportedMatch.round_number,
    p_match_number: reportedMatch.match_number,
    p_winner_id: winnerId,
  });

  if (advanceError) {
    console.error("Error advancing winner to next round:", advanceError);
    return {
      success: false,
      code: "ADVANCEMENT_FAILED",
      message:
        "The match result was recorded, but the bracket could not be advanced automatically. Please retry this request.",
    };
  }

  return { success: true, match: reportedMatch };
}
