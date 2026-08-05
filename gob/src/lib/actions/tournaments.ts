"use server";

import { createServerSupabaseClient, requireAuthUserId } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createTournamentSchema, registerForTournamentSchema, reportMatchResultSchema } from "@/lib/validation/tournaments";
import { isRegistrationOpen } from "@/lib/tournaments/registrationWindow";
import { closeRegistrationAndGenerateBracket } from "@/lib/tournaments/closeRegistrationAndGenerateBracket";
import { reportMatchResult as reportMatchResultLogic } from "@/lib/tournaments/reportMatchResult";
import { disbursePayouts } from "@/lib/tournaments/payoutDisbursement";

export type CreateTournamentResult =
  | { success: true; tournamentId: string }
  | { success: false; code: string; message: string; fieldErrors?: Record<string, string[]> };

export type RegisterForTournamentResult =
  | { success: true; data: unknown }
  | { success: false; code: string; message: string };

export type CloseRegistrationResult =
  | { success: true; data: unknown }
  | { success: false; code: string; message: string };

export type ReportMatchResult =
  | { success: true; data: unknown }
  | { success: false; code: string; message: string };

export type TriggerPayoutsResult =
  | { success: true; data: unknown; message: string }
  | { success: false; code: string; message: string };

/**
 * Server Action: Create a new tournament.
 * Uses shared createTournamentSchema for Zod validation (mirrors the API route).
 * Inserts directly via Supabase client so auth cookies are preserved.
 */
export async function createTournament(formData: FormData): Promise<CreateTournamentResult> {
  try {
    const userId = await requireAuthUserId();
    const supabase = await createServerSupabaseClient();

    // Build prize_split object from individual form fields
    const prizeSplit: Record<string, number> = {};
    const firstPct = formData.get("prize_split_1st");
    const secondPct = formData.get("prize_split_2nd");
    const thirdPct = formData.get("prize_split_3rd");
    const fourthPct = formData.get("prize_split_4th");

    if (firstPct) prizeSplit["1st"] = parseFloat(firstPct as string);
    if (secondPct) prizeSplit["2nd"] = parseFloat(secondPct as string);
    if (thirdPct && parseFloat(thirdPct as string) > 0) prizeSplit["3rd"] = parseFloat(thirdPct as string);
    if (fourthPct && parseFloat(fourthPct as string) > 0) prizeSplit["4th"] = parseFloat(fourthPct as string);

    const game = formData.get("game") as string;
    const title = formData.get("title") as string;
    const rules = formData.get("rules") as string | null;
    const entryFeeBdt = parseFloat(formData.get("entry_fee_bdt") as string) || 0;
    const maxParticipants = parseInt(formData.get("max_participants") as string, 10) || 2;
    const startsAt = formData.get("starts_at") as string;
    const registrationClosesAt = formData.get("registration_closes_at") as string | null;
    const platformFeePercent = formData.get("platform_fee_percent") ? parseFloat(formData.get("platform_fee_percent") as string) : undefined;

    // Convert datetime-local to ISO string
    const startsAtISO = startsAt ? new Date(startsAt).toISOString() : undefined;
    const registrationClosesAtISO = registrationClosesAt ? new Date(registrationClosesAt).toISOString() : null;

    // === VALIDATION: Use shared createTournamentSchema from lib/validation/tournaments.ts ===
    const validationResult = createTournamentSchema.safeParse({
      game,
      title,
      rules: rules || null,
      entry_fee_bdt: entryFeeBdt,
      max_participants: maxParticipants,
      prize_split: prizeSplit,
      starts_at: startsAtISO,
      registration_closes_at: registrationClosesAtISO,
      ...(platformFeePercent !== undefined && !isNaN(platformFeePercent)
        ? { platform_fee_percent: platformFeePercent }
        : {}),
    });

    if (!validationResult.success) {
      return {
        success: false,
        code: "VALIDATION_ERROR",
        message: "Please fix the errors below",
        fieldErrors: validationResult.error.flatten().fieldErrors,
      };
    }

    const validated = validationResult.data;

    const { data: tournament, error: insertError } = await supabase
      .from("tournaments")
      .insert({
        organizer_id: userId,
        game: validated.game,
        title: validated.title,
        rules: validated.rules ?? null,
        entry_fee_bdt: validated.entry_fee_bdt,
        max_participants: validated.max_participants,
        prize_split: validated.prize_split,
        starts_at: validated.starts_at,
        registration_closes_at: validated.registration_closes_at ?? null,
        status: "registration_open",
        ...(validated.platform_fee_percent !== undefined
          ? { platform_fee_percent: validated.platform_fee_percent }
          : {}),
      })
      .select()
      .single();

    if (insertError || !tournament) {
      console.error("Error creating tournament:", insertError);
      return {
        success: false,
        code: "DATABASE_ERROR",
        message: "Failed to create tournament. Please try again.",
      };
    }

    revalidatePath("/tournaments");
    redirect(`/tournaments/${tournament.id}`);
  } catch (err) {
    if (err instanceof Error && err.message === "AUTH_REQUIRED") {
      return { success: false, code: "AUTH_REQUIRED", message: "Authentication required" };
    }
    if (err instanceof Error && (err as any).digest?.startsWith("NEXT_REDIRECT")) {
      throw err;
    }
    console.error("Unexpected error creating tournament:", err);
    return { success: false, code: "ERROR", message: "An unexpected error occurred" };
  }
}

/**
 * Server Action: Register for a tournament with payment.
 * Uses shared registerForTournamentSchema for Zod validation.
 * Uses shared isRegistrationOpen() for registration window/capacity checks.
 * Uses Supabase client directly so auth cookies are preserved.
 */
export async function registerForTournament(
  tournamentId: string,
  paymentMethod: "bkash" | "nagad",
  paymentReferenceId: string,
  idempotencyKey: string
): Promise<RegisterForTournamentResult> {
  try {
    const playerId = await requireAuthUserId();
    const supabase = await createServerSupabaseClient();

    // === VALIDATION: Use shared registerForTournamentSchema ===
    const validationResult = registerForTournamentSchema.safeParse({
      payment_method: paymentMethod,
      payment_reference_id: paymentReferenceId,
      idempotency_key: idempotencyKey,
    });

    if (!validationResult.success) {
      return {
        success: false,
        code: "VALIDATION_ERROR",
        message: "Invalid payment details",
      };
    }

    // === IDEMPOTENCY: Check if already registered ===
    const { data: existing } = await supabase
      .from("tournament_registrations")
      .select("id, payment_status")
      .eq("tournament_id", tournamentId)
      .eq("player_id", playerId)
      .maybeSingle();

    if (existing) {
      return { success: true, data: existing };
    }

    // Fetch tournament for registration window check
    const { data: tournament } = await supabase
      .from("tournaments")
      .select("*")
      .eq("id", tournamentId)
      .single();

    if (!tournament) {
      return { success: false, code: "NOT_FOUND", message: "Tournament not found" };
    }

    // === BUSINESS LOGIC: Use shared isRegistrationOpen() ===
    const { count: currentCount } = await supabase
      .from("tournament_registrations")
      .select("*", { count: "exact", head: true })
      .eq("tournament_id", tournamentId);

    if (!isRegistrationOpen(tournament, currentCount ?? 0)) {
      return {
        success: false,
        code: "REGISTRATION_CLOSED",
        message: "Registration is closed or this tournament is full",
      };
    }

    // Create registration
    const { data: registration, error: insertError } = await supabase
      .from("tournament_registrations")
      .insert({
        tournament_id: tournamentId,
        player_id: playerId,
        payment_method: paymentMethod,
        payment_reference_id: paymentReferenceId,
        payment_status: "paid",
      })
      .select()
      .single();

    if (insertError) {
      console.error("Error registering for tournament:", insertError);
      return { success: false, code: "DATABASE_ERROR", message: "Failed to register for tournament" };
    }

    revalidatePath(`/tournaments/${tournamentId}`);
    return { success: true, data: registration };
  } catch (err) {
    if (err instanceof Error && err.message === "AUTH_REQUIRED") {
      return { success: false, code: "AUTH_REQUIRED", message: "Authentication required" };
    }
    console.error("Unexpected error registering for tournament:", err);
    return { success: false, code: "ERROR", message: "An unexpected error occurred" };
  }
}

/**
 * Server Action: Close registration and generate bracket.
 * Delegates to shared closeRegistrationAndGenerateBracket() which handles:
 *   - Organizer/admin authorization check
 *   - Status transition (registration_open -> registration_closed -> bracket_generated)
 *   - generate_bracket RPC call with rollback on failure
 *   - Optimistic concurrency guard via .eq("status", "registration_open")
 * Uses Supabase client directly so auth cookies are preserved.
 */
export async function closeRegistration(tournamentId: string): Promise<CloseRegistrationResult> {
  try {
    const callerId = await requireAuthUserId();
    const supabase = await createServerSupabaseClient();

    // === BUSINESS LOGIC: Delegate to shared closeRegistrationAndGenerateBracket() ===
    const result = await closeRegistrationAndGenerateBracket(supabase, tournamentId, callerId);

    if (!result.success) {
      return { success: false, code: result.code, message: result.message };
    }

    revalidatePath(`/tournaments/${tournamentId}`);
    revalidatePath(`/tournaments/${tournamentId}/bracket`);
    return { success: true, data: { tournament: result.tournament, matches: result.matches } };
  } catch (err) {
    if (err instanceof Error && err.message === "AUTH_REQUIRED") {
      return { success: false, code: "AUTH_REQUIRED", message: "Authentication required" };
    }
    console.error("Unexpected error closing registration:", err);
    return { success: false, code: "ERROR", message: "An unexpected error occurred" };
  }
}

/**
 * Server Action: Report a match result.
 * Delegates to shared reportMatchResult() which handles:
 *   - Participant/admin authorization check
 *   - winner_id validation (must be one of the two players)
 *   - Idempotency (same winner re-report is a no-op)
 *   - Conflicting report detection
 *   - report_match_result RPC + advance_winner_to_next_round RPC sequencing
 * Uses Supabase client directly so auth cookies are preserved.
 */
export async function reportMatchResult(
  matchId: string,
  winnerId: string
): Promise<ReportMatchResult> {
  try {
    const callerId = await requireAuthUserId();
    const supabase = await createServerSupabaseClient();

    // === VALIDATION: Use shared reportMatchResultSchema ===
    const validationResult = reportMatchResultSchema.safeParse({ winner_id: winnerId });
    if (!validationResult.success) {
      return {
        success: false,
        code: "VALIDATION_ERROR",
        message: "Invalid winner ID",
      };
    }

    // === BUSINESS LOGIC: Delegate to shared reportMatchResult() ===
    const result = await reportMatchResultLogic(supabase, matchId, winnerId, callerId);

    if (!result.success) {
      return { success: false, code: result.code, message: result.message };
    }

    revalidatePath(`/tournaments/${result.match.tournament_id}`);
    revalidatePath(`/tournaments/${result.match.tournament_id}/bracket`);
    return { success: true, data: result.match };
  } catch (err) {
    if (err instanceof Error && err.message === "AUTH_REQUIRED") {
      return { success: false, code: "AUTH_REQUIRED", message: "Authentication required" };
    }
    console.error("Unexpected error reporting match result:", err);
    return { success: false, code: "ERROR", message: "An unexpected error occurred" };
  }
}

/**
 * Server Action: Trigger prize payouts for a completed tournament.
 * Delegates to shared disbursePayouts() which handles:
 *   - Tournament status = 'completed' check
 *   - Prize split validation
 *   - Final placement resolution
 *   - Payout row creation + disbursement attempt
 *   - Idempotency guard (rejects if payout rows already exist)
 * Uses Supabase client directly so auth cookies are preserved.
 */
export async function triggerPayouts(tournamentId: string): Promise<TriggerPayoutsResult> {
  try {
    const callerId = await requireAuthUserId();
    const supabase = await createServerSupabaseClient();

    // Verify caller is organizer or admin
    const { data: tournament } = await supabase
      .from("tournaments")
      .select("*")
      .eq("id", tournamentId)
      .single();

    if (!tournament) {
      return { success: false, code: "NOT_FOUND", message: "Tournament not found" };
    }

    const isOrganizer = tournament.organizer_id === callerId;
    let isAdmin = false;
    if (!isOrganizer) {
      const { data: adminCheck } = await supabase.rpc("is_admin");
      isAdmin = adminCheck === true;
    }

    if (!isOrganizer && !isAdmin) {
      return { success: false, code: "FORBIDDEN", message: "Only the tournament organizer or an admin can trigger payouts" };
    }

    // === IDEMPOTENCY: Check for existing payout rows ===
    const { count: existingPayoutCount } = await supabase
      .from("tournament_prize_payouts")
      .select("*", { count: "exact", head: true })
      .eq("tournament_id", tournamentId);

    if (existingPayoutCount && existingPayoutCount > 0) {
      return {
        success: false,
        code: "ALREADY_DISBURSED",
        message: "Payouts have already been calculated for this tournament",
      };
    }

    // === BUSINESS LOGIC: Delegate to shared disbursePayouts() ===
    const result = await disbursePayouts(supabase, tournament);

    if (!result.success) {
      return { success: false, code: result.code ?? "PAYOUT_FAILED", message: result.message };
    }

    revalidatePath(`/tournaments/${tournamentId}`);
    return { success: true, data: result.payouts, message: result.message };
  } catch (err) {
    if (err instanceof Error && err.message === "AUTH_REQUIRED") {
      return { success: false, code: "AUTH_REQUIRED", message: "Authentication required" };
    }
    console.error("Unexpected error triggering payouts:", err);
    return { success: false, code: "ERROR", message: "An unexpected error occurred" };
  }
}