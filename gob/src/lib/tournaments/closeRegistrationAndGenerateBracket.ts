import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

type TypedSupabaseClient = SupabaseClient<Database>;
type TournamentRow = Database["public"]["Tables"]["tournaments"]["Row"];
type MatchRow = Database["public"]["Tables"]["tournament_matches"]["Row"];

export type CloseRegistrationResult =
  | { success: true; tournament: TournamentRow; matches: MatchRow[] }
  | { success: false; code: string; message: string };

/**
 * Closes registration for a tournament and generates its bracket.
 *
 * SEQUENCING (this state-transition orchestration lives here in application
 * code, per the task brief, because the `generate_bracket` RPC assumes the
 * tournament's status is ALREADY 'registration_closed' when it is invoked —
 * it raises an exception otherwise. The RPC itself does not, and should
 * not, own the 'registration_open' -> 'registration_closed' transition):
 *
 *   1. Fetch the tournament and verify the caller is its organizer OR an
 *      admin (re-checked here server-side, independent of RLS).
 *   2. Verify current status is 'registration_open' — the only valid state
 *      to close registration from.
 *   3. Flip status -> 'registration_closed' (satisfies generate_bracket's
 *      own precondition).
 *   4. Call generate_bracket(tournament_id).
 *   5. If generate_bracket fails (e.g. fewer than 2 paid registrations), we
 *      roll the status back to 'registration_open' so the organizer isn't
 *      left with a tournament stuck in 'registration_closed' with no
 *      bracket and no way to fix it (e.g. wait for more registrations)
 *      through the normal flow. This avoids the partial-failure/orphaned
 *      state problem called out in the task rules.
 *
 * NOTE ON generate_bracket's OWN STATUS UPDATE: direct testing against the
 * deployed `generate_bracket` function confirmed it already sets the
 * tournament's status to 'bracket_generated' as its own final step, on top
 * of requiring 'registration_closed' as a precondition. The task brief's
 * description of this helper says it should "update the tournament's
 * status to 'bracket_generated'" after a successful RPC call — that update
 * is therefore redundant in the success path today, but we still perform a
 * defensive re-check (and force the update if it were ever missing) so this
 * function's documented contract holds regardless of that RPC's internal
 * implementation details changing in the future.
 */
export async function closeRegistrationAndGenerateBracket(
  supabase: TypedSupabaseClient,
  tournamentId: string,
  callerId: string
): Promise<CloseRegistrationResult> {
  const { data: tournament, error: fetchError } = await supabase
    .from("tournaments")
    .select("*")
    .eq("id", tournamentId)
    .single();

  if (fetchError || !tournament) {
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
      message: "Only the tournament organizer or an admin can close registration",
    };
  }

  if (tournament.status !== "registration_open") {
    return {
      success: false,
      code: "INVALID_STATUS",
      message: `Cannot close registration: current status is "${tournament.status}", expected "registration_open"`,
    };
  }

  // Step 3: flip to registration_closed. Optimistic concurrency guard via
  // the .eq("status", ...) condition prevents a double-close race.
  const { error: closeError, count: closeCount } = await supabase
    .from("tournaments")
    .update({ status: "registration_closed" })
    .eq("id", tournamentId)
    .eq("status", "registration_open");

  if (closeError) {
    return { success: false, code: "DATABASE_ERROR", message: "Failed to close registration" };
  }
  if (closeCount === 0) {
    return {
      success: false,
      code: "CONCURRENT_MODIFICATION",
      message: "Registration was already closed by another request",
    };
  }

  // Step 4: generate the bracket.
  const { error: bracketError } = await supabase.rpc("generate_bracket", {
    p_tournament_id: tournamentId,
  });

  if (bracketError) {
    // Step 5: roll back so the tournament isn't stuck with no bracket and
    // no way to retry (e.g. once more players pay their entry fee).
    await supabase
      .from("tournaments")
      .update({ status: "registration_open" })
      .eq("id", tournamentId)
      .eq("status", "registration_closed");

    if (bracketError.message?.includes("At least 2 paid registrations")) {
      return {
        success: false,
        code: "NOT_ENOUGH_PLAYERS",
        message: "At least 2 paid registrations are required to generate a bracket",
      };
    }

    console.error("Error generating bracket:", bracketError);
    return {
      success: false,
      code: "BRACKET_GENERATION_FAILED",
      message: "Failed to generate the tournament bracket",
    };
  }

  // Step 5 (success path) / defensive re-check.
  let { data: finalTournament, error: refetchError } = await supabase
    .from("tournaments")
    .select("*")
    .eq("id", tournamentId)
    .single();

  if (refetchError || !finalTournament) {
    return {
      success: false,
      code: "DATABASE_ERROR",
      message: "Bracket was generated but the tournament could not be refetched",
    };
  }

  if (finalTournament.status !== "bracket_generated") {
    const { data: forced } = await supabase
      .from("tournaments")
      .update({ status: "bracket_generated" })
      .eq("id", tournamentId)
      .select()
      .single();
    if (forced) {
      finalTournament = forced;
    }
  }

  const { data: matches, error: matchesError } = await supabase
    .from("tournament_matches")
    .select("*")
    .eq("tournament_id", tournamentId)
    .order("round_number", { ascending: true })
    .order("match_number", { ascending: true });

  if (matchesError) {
    return {
      success: false,
      code: "DATABASE_ERROR",
      message: "Bracket was generated but its matches could not be fetched",
    };
  }

  return { success: true, tournament: finalTournament, matches: matches ?? [] };
}
