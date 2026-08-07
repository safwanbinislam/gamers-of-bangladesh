"use server";

import { createServerSupabaseClient, requireAuthUserId } from "@/lib/supabase/server";
import {
  upsertSquadPreferencesSchema,
  requestSquadSessionSchema,
  cancelSquadSessionSchema,
  completeSquadSessionSchema,
  sendSquadSessionMessageSchema,
} from "@/lib/validation/squadFinder";
import { revalidatePath } from "next/cache";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * A single ranked match result from `get_squad_matches()`.
 *
 * NOTE ON NULLABILITY: `get_no_ghost_score()` returns NULL when the candidate
 * has zero feedback rows (SQL comment #6 — "no track record yet" is distinct
 * from a 0% "always ghosts" score). `rank_or_level`, `region`, and
 * `avatar_url` are nullable in the source tables. The Supabase-generated types
 * type these as non-nullable (a codegen limitation for SQL functions), so we
 * define the app-facing type explicitly and cast on read.
 */
export type SquadMatch = {
  player_id: string;
  username: string;
  avatar_url: string | null;
  reputation_score: number;
  rank_or_level: string | null;
  region: string | null;
  shared_days: string[];
  hours_overlap: number;
  compatibility_score: number;
  no_ghost_score: number | null;
};

export type GetSquadMatchesResult =
  | { success: true; data: SquadMatch[] }
  | { success: false; code: string; message: string };

export type UpsertSquadPreferencesResult =
  | { success: true; data: { id: string } }
  | { success: false; code: string; message: string; fieldErrors?: Record<string, string[]> };

export type RequestSquadSessionResult =
  | { success: true; data: { session_id: string } }
  | { success: false; code: string; message: string; fieldErrors?: Record<string, string[]> };

export type RespondToSquadSessionResult =
  | { success: true; data: { session_id: string; status: string } }
  | { success: false; code: string; message: string };

export type GetSquadSessionResult =
  | { success: true; data: {
      id: string;
      game: string;
      initiator_id: string;
      recipient_id: string;
      status: string;
      scheduled_at: string | null;
      created_at: string;
      updated_at: string;
    } }
  | { success: false; code: string; message: string };

export type GetNoGhostScoreResult =
  | { success: true; data: number | null }
  | { success: false; code: string; message: string };

export type SubmitSquadFeedbackResult =
  | { success: true; data: { id: string } }
  | { success: false; code: string; message: string };

export type SendSquadSessionMessageResult =
  | { success: true; data: { id: string } }
  | { success: false; code: string; message: string; fieldErrors?: Record<string, string[]> };

export type SquadSessionMessage = {
  id: string;
  session_id: string;
  sender_id: string;
  message: string;
  created_at: string;
  sender: { id: string; username: string; avatar_url: string | null } | null;
};

export type GetSquadSessionMessagesResult =
  | { success: true; data: SquadSessionMessage[] }
  | { success: false; code: string; message: string };

// ---------------------------------------------------------------------------
// getSquadMatches
// ---------------------------------------------------------------------------

/**
 * Server Action: Fetch the ranked list of most-compatible active players for
 * the authenticated user in a given game.
 *
 * `get_squad_matches()` SILENTLY returns zero rows when the caller has no
 * `squad_preferences` row for `p_game` (the CROSS JOIN on `me` yields
 * nothing — SQL comment #4). To give the UI a meaningful "set your
 * preferences first" state, we detect that case with a lightweight own-pref
 * lookup and return `PREFERENCES_NOT_SET`.
 */
export async function getSquadMatches(
  game: string,
  limit?: number
): Promise<GetSquadMatchesResult> {
  try {
    const userId = await requireAuthUserId();

    const gameType = game as "free_fire" | "pubg_mobile" | "mobile_legends" | "other";

    const supabase = await createServerSupabaseClient();

    // Distinguish "no preferences set" from "no candidates found".
    const { data: ownPref } = await supabase
      .from("squad_preferences")
      .select("id")
      .eq("player_id", userId)
      .eq("game", gameType)
      .maybeSingle();

    if (!ownPref) {
      return {
        success: false,
        code: "PREFERENCES_NOT_SET",
        message: "Set your squad preferences for this game to see matches.",
      };
    }

    const { data, error } = await supabase.rpc("get_squad_matches", {
      p_player_id: userId,
      p_game: gameType,
      p_limit: limit ?? 20,
    });

    if (error) {
      console.error("Error fetching squad matches:", error);
      return { success: false, code: "ERROR", message: "Failed to load squad matches." };
    }

    // Cast to the app-facing SquadMatch type (see type doc for why).
    return { success: true, data: (data ?? []) as unknown as SquadMatch[] };
  } catch (err) {
    if (err instanceof Error && err.message === "AUTH_REQUIRED") {
      return { success: false, code: "AUTH_REQUIRED", message: "Authentication required." };
    }
    console.error("Unexpected error fetching squad matches:", err);
    return { success: false, code: "ERROR", message: "An unexpected error occurred." };
  }
}

// ---------------------------------------------------------------------------
// upsertSquadPreferences
// ---------------------------------------------------------------------------

/**
 * Server Action: Create or update the authenticated user's squad matchmaking
 * preferences for a given game.
 *
 * `player_id` is always derived from the authenticated session — never trusted
 * from client input. Uses a genuine upsert on the `(player_id, game)` unique
 * constraint (SQL comment #5), the same pattern as `upsertGameStat` in the
 * Reputation Passport feature.
 */
export async function upsertSquadPreferences(input: {
  game: string;
  rank_or_level?: string | null;
  preferred_squad_size?: number;
  playtime_days?: string[];
  playtime_start_hour?: number | null;
  playtime_end_hour?: number | null;
  region?: string | null;
  looking_for_note?: string | null;
  is_active?: boolean;
}): Promise<UpsertSquadPreferencesResult> {
  try {
    const userId = await requireAuthUserId();
    const supabase = await createServerSupabaseClient();

    // === VALIDATION ===
    const validationResult = upsertSquadPreferencesSchema.safeParse(input);
    if (!validationResult.success) {
      return {
        success: false,
        code: "VALIDATION_ERROR",
        message: "Please fix the errors below",
        fieldErrors: validationResult.error.flatten().fieldErrors,
      };
    }

    const validated = validationResult.data;

    const { data: pref, error } = await supabase
      .from("squad_preferences")
      .upsert(
        {
          player_id: userId,
          game: validated.game,
          rank_or_level: validated.rank_or_level ?? null,
          preferred_squad_size: validated.preferred_squad_size,
          playtime_days: validated.playtime_days,
          playtime_start_hour: validated.playtime_start_hour ?? null,
          playtime_end_hour: validated.playtime_end_hour ?? null,
          region: validated.region ?? null,
          looking_for_note: validated.looking_for_note ?? null,
          is_active: validated.is_active,
        },
        {
          onConflict: "player_id, game",
          ignoreDuplicates: false,
        }
      )
      .select("id")
      .single();

    if (error) {
      console.error("Error upserting squad preferences:", error);
      return { success: false, code: "DATABASE_ERROR", message: "Failed to save squad preferences." };
    }

    revalidatePath("/squads");
    return { success: true, data: { id: pref.id } };
  } catch (err) {
    if (err instanceof Error && err.message === "AUTH_REQUIRED") {
      return { success: false, code: "AUTH_REQUIRED", message: "Authentication required." };
    }
    console.error("Unexpected error upserting squad preferences:", err);
    return { success: false, code: "ERROR", message: "An unexpected error occurred." };
  }
}

// ---------------------------------------------------------------------------
// requestSquadSession
// ---------------------------------------------------------------------------

/**
 * Server Action: Send a squad-up request to another player for a game.
 *
 * Delegates to the `request_squad_session` RPC, which owns the business rules
 * (no self-requests, no duplicate pending requests in either direction).
 * The caller stays on the current page; the recipient is notified via the
 * existing Realtime/NotificationBell pattern (SQL comment #1) — no redirect.
 */
export async function requestSquadSession(input: {
  recipient_id: string;
  game: string;
  scheduled_at?: string | null;
}): Promise<RequestSquadSessionResult> {
  try {
    await requireAuthUserId();
    const supabase = await createServerSupabaseClient();

    // === VALIDATION ===
    const validationResult = requestSquadSessionSchema.safeParse(input);
    if (!validationResult.success) {
      return {
        success: false,
        code: "VALIDATION_ERROR",
        message: "Please fix the errors below",
        fieldErrors: validationResult.error.flatten().fieldErrors,
      };
    }

    const validated = validationResult.data;

    const { data: sessionId, error } = await supabase.rpc("request_squad_session", {
      p_recipient_id: validated.recipient_id,
      p_game: validated.game,
      // The param is typed `string | undefined`; omitting it lets the
      // function apply its DEFAULT NULL (no scheduled time).
      ...(validated.scheduled_at ? { p_scheduled_at: validated.scheduled_at } : {}),
    });

    if (error) {
      if (error.message?.includes("You cannot request to squad up with yourself")) {
        return { success: false, code: "SELF_REQUEST", message: "You cannot request to squad up with yourself." };
      }
      if (error.message?.includes("A pending squad request already exists")) {
        return { success: false, code: "DUPLICATE_REQUEST", message: "A pending squad request already exists between you and this player for this game." };
      }
      console.error("Error requesting squad session:", error);
      return { success: false, code: "ERROR", message: "Failed to send squad request." };
    }

    revalidatePath("/squads");
    return { success: true, data: { session_id: sessionId as string } };
  } catch (err) {
    if (err instanceof Error && err.message === "AUTH_REQUIRED") {
      return { success: false, code: "AUTH_REQUIRED", message: "Authentication required." };
    }
    console.error("Unexpected error requesting squad session:", err);
    return { success: false, code: "ERROR", message: "An unexpected error occurred." };
  }
}

// ---------------------------------------------------------------------------
// respondToSquadSession
// ---------------------------------------------------------------------------

/**
 * Server Action: Accept or decline an incoming squad request.
 *
 * Delegates to the `respond_to_squad_session` RPC. Only the recipient may
 * respond, and only while the session is still `requested`. On success we
 * return the session id and new status so the UI can update without a round
 * trip; the page is revalidated for server-rendered consumers.
 */
export async function respondToSquadSession(
  sessionId: string,
  accept: boolean
): Promise<RespondToSquadSessionResult> {
  try {
    const userId = await requireAuthUserId();
    const supabase = await createServerSupabaseClient();

    // Validate input shape up front (cheap defense; sessionId must be a uuid).
    if (!sessionId || typeof accept !== "boolean") {
      return { success: false, code: "VALIDATION_ERROR", message: "Invalid request." };
    }

    const { error } = await supabase.rpc("respond_to_squad_session", {
      p_session_id: sessionId,
      p_accept: accept,
    });

    if (error) {
      if (error.message?.includes("Only the recipient can respond")) {
        return { success: false, code: "NOT_RECIPIENT", message: "Only the recipient can respond to this squad request." };
      }
      if (error.message?.includes("has already been responded to")) {
        return { success: false, code: "ALREADY_RESPONDED", message: "This squad request has already been responded to." };
      }
      if (error.message?.includes("does not exist")) {
        return { success: false, code: "NOT_FOUND", message: "This squad request no longer exists." };
      }
      console.error("Error responding to squad session:", error);
      return { success: false, code: "ERROR", message: "Failed to respond to squad request." };
    }

    revalidatePath("/squads");
    // The caller is the recipient in both directions (initiator already known).
    // Reflect on the requester's page as well via their profile route.
    revalidatePath(`/players/${userId}`);

    return {
      success: true,
      data: { session_id: sessionId, status: accept ? "accepted" : "declined" },
    };
  } catch (err) {
    if (err instanceof Error && err.message === "AUTH_REQUIRED") {
      return { success: false, code: "AUTH_REQUIRED", message: "Authentication required." };
    }
    console.error("Unexpected error responding to squad session:", err);
    return { success: false, code: "ERROR", message: "An unexpected error occurred." };
  }
}

// ---------------------------------------------------------------------------
// cancelSquadSession
// ---------------------------------------------------------------------------

/**
 * Server Action: Cancel an outgoing squad request.
 *
 * Delegates to the `cancel_squad_session` RPC. Only the initiator may cancel,
 * and only while the session is still `requested`. On success the page is
 * revalidated so the request disappears from the outgoing list.
 */
export async function cancelSquadSession(
  sessionId: string
): Promise<{ success: true; data: { session_id: string } } | { success: false; code: string; message: string }> {
  try {
    const userId = await requireAuthUserId();
    const supabase = await createServerSupabaseClient();

    // === VALIDATION ===
    const validationResult = cancelSquadSessionSchema.safeParse({ session_id: sessionId });
    if (!validationResult.success) {
      return { success: false, code: "VALIDATION_ERROR", message: "Invalid request." };
    }

    const { error } = await supabase.rpc("cancel_squad_session", {
      p_session_id: sessionId,
    });

    if (error) {
      if (error.message?.includes("does not exist")) {
        return { success: false, code: "NOT_FOUND", message: "This squad request no longer exists." };
      }
      if (error.message?.includes("Only the initiator can cancel")) {
        return { success: false, code: "NOT_INITIATOR", message: "Only the initiator can cancel this squad request." };
      }
      if (error.message?.includes("already been responded to")) {
        return { success: false, code: "ALREADY_RESPONDED", message: "This squad request has already been responded to." };
      }
      console.error("Error cancelling squad session:", error);
      return { success: false, code: "ERROR", message: "Failed to cancel squad request." };
    }

    revalidatePath("/squads/requests");
    revalidatePath("/squads");
    revalidatePath(`/players/${userId}`);

    return { success: true, data: { session_id: sessionId } };
  } catch (err) {
    if (err instanceof Error && err.message === "AUTH_REQUIRED") {
      return { success: false, code: "AUTH_REQUIRED", message: "Authentication required." };
    }
    console.error("Unexpected error cancelling squad session:", err);
    return { success: false, code: "ERROR", message: "An unexpected error occurred." };
  }
}

// ---------------------------------------------------------------------------
// completeSquadSession
// ---------------------------------------------------------------------------

/**
 * Server Action: Mark an accepted squad session as completed.
 *
 * Delegates to the `complete_squad_session` RPC. Only a participant may
 * complete, and only while the session is `accepted`. Completing is what
 * unlocks the post-session feedback form (and therefore the no-ghost score).
 */
export async function completeSquadSession(
  sessionId: string
): Promise<{ success: true; data: { session_id: string } } | { success: false; code: string; message: string }> {
  try {
    const userId = await requireAuthUserId();
    const supabase = await createServerSupabaseClient();

    // === VALIDATION ===
    const validationResult = completeSquadSessionSchema.safeParse({ session_id: sessionId });
    if (!validationResult.success) {
      return { success: false, code: "VALIDATION_ERROR", message: "Invalid request." };
    }

    const { error } = await supabase.rpc("complete_squad_session", {
      p_session_id: sessionId,
    });

    if (error) {
      if (error.message?.includes("does not exist")) {
        return { success: false, code: "NOT_FOUND", message: "This squad session no longer exists." };
      }
      if (error.message?.includes("Only a participant can complete")) {
        return { success: false, code: "NOT_PARTICIPANT", message: "Only a participant can complete this squad session." };
      }
      if (error.message?.includes("Only an accepted squad session can be completed")) {
        return { success: false, code: "INVALID_STATUS", message: "Only an accepted squad session can be completed." };
      }
      console.error("Error completing squad session:", error);
      return { success: false, code: "ERROR", message: "Failed to complete squad session." };
    }

    revalidatePath(`/squads/${sessionId}`);
    revalidatePath("/squads");
    revalidatePath(`/players/${userId}`);

    return { success: true, data: { session_id: sessionId } };
  } catch (err) {
    if (err instanceof Error && err.message === "AUTH_REQUIRED") {
      return { success: false, code: "AUTH_REQUIRED", message: "Authentication required." };
    }
    console.error("Unexpected error completing squad session:", err);
    return { success: false, code: "ERROR", message: "An unexpected error occurred." };
  }
}

// ---------------------------------------------------------------------------
// getSquadSession
// ---------------------------------------------------------------------------

/**
 * Server Action: Fetch a single squad session for the session detail page.
 *
 * RLS on `squad_sessions` restricts reads to the two participants (or an
 * admin), so a non-participant simply gets `null` + NOT_FOUND.
 */
export async function getSquadSession(sessionId: string): Promise<GetSquadSessionResult> {
  try {
    await requireAuthUserId();
    const supabase = await createServerSupabaseClient();

    const { data, error } = await supabase
      .from("squad_sessions")
      .select("*")
      .eq("id", sessionId)
      .maybeSingle();

    if (error) {
      console.error("Error fetching squad session:", error);
      return { success: false, code: "ERROR", message: "Failed to load squad session." };
    }

    if (!data) {
      return { success: false, code: "NOT_FOUND", message: "Squad session not found." };
    }

    return { success: true, data };
  } catch (err) {
    if (err instanceof Error && err.message === "AUTH_REQUIRED") {
      return { success: false, code: "AUTH_REQUIRED", message: "Authentication required." };
    }
    console.error("Unexpected error fetching squad session:", err);
    return { success: false, code: "ERROR", message: "An unexpected error occurred." };
  }
}

// ---------------------------------------------------------------------------
// getNoGhostScore
// ---------------------------------------------------------------------------

/**
 * Server Action: Fetch a player's public no-ghost score (0–100).
 *
 * Returns `null` when the player has no squad feedback yet — the UI must
 * display "no track record yet" as distinct from an actual 0%
 * "always ghosts" score (SQL comment #6).
 *
 * Public read — no auth required (same as getPlayerPassport).
 */
export async function getNoGhostScore(playerId: string): Promise<GetNoGhostScoreResult> {
  try {
    const supabase = await createServerSupabaseClient();

    const { data, error } = await supabase.rpc("get_no_ghost_score", {
      p_player_id: playerId,
    });

    if (error) {
      console.error("Error fetching no-ghost score:", error);
      return { success: false, code: "ERROR", message: "Failed to load no-ghost score." };
    }

    return { success: true, data: (data as number) ?? null };
  } catch (err) {
    console.error("Unexpected error fetching no-ghost score:", err);
    return { success: false, code: "ERROR", message: "An unexpected error occurred." };
  }
}

// ---------------------------------------------------------------------------
// submitSquadFeedback
// ---------------------------------------------------------------------------

/**
 * Server Action: Submit post-session feedback ("did this happen as planned").
 *
 * Inserts into `squad_session_feedback`. The `validate_squad_session_feedback`
 * trigger enforces: reporter is a participant, subject is the OTHER
 * participant, and the session is feedback-eligible (completed, or accepted
 * with a scheduled time in the past). RLS enforces reporter = auth.uid().
 */
export async function submitSquadFeedback(input: {
  session_id: string;
  subject_id: string;
  showed_up: boolean;
  note?: string | null;
}): Promise<SubmitSquadFeedbackResult> {
  try {
    const userId = await requireAuthUserId();
    const supabase = await createServerSupabaseClient();

    // Cheap input-shape defense (session_id and subject_id must be uuids).
    if (!input.session_id || !input.subject_id || typeof input.showed_up !== "boolean") {
      return { success: false, code: "VALIDATION_ERROR", message: "Invalid request." };
    }

    const { data, error } = await supabase
      .from("squad_session_feedback")
      .insert({
        session_id: input.session_id,
        reporter_id: userId,
        subject_id: input.subject_id,
        showed_up: input.showed_up,
        note: input.note?.trim() ? input.note.trim() : null,
      })
      .select("id")
      .single();

    if (error) {
      console.error("Error submitting squad feedback:", error);
      return { success: false, code: "ERROR", message: "Failed to submit feedback." };
    }

    revalidatePath(`/squads/${input.session_id}`);
    return { success: true, data: { id: data.id } };
  } catch (err) {
    if (err instanceof Error && err.message === "AUTH_REQUIRED") {
      return { success: false, code: "AUTH_REQUIRED", message: "Authentication required." };
    }
    console.error("Unexpected error submitting squad feedback:", err);
    return { success: false, code: "ERROR", message: "An unexpected error occurred." };
  }
}

// ---------------------------------------------------------------------------
// sendSquadSessionMessage
// ---------------------------------------------------------------------------

/**
 * Server Action: Send a message in a squad session chat.
 *
 * The `sender_id` is ALWAYS derived from the authenticated session — never
 * trusted from the client. Order-of-insert eligibility (real participant +
 * session already 'accepted'/'completed') is enforced by the
 * `validate_squad_session_message` BEFORE INSERT trigger in the DB; here we
 * translate its exceptions into the standard error shape so raw Postgres
 * errors never reach the client. RLS additionally restricts writes to the
 * session's participants (or an admin).
 */
export async function sendSquadSessionMessage(input: {
  session_id: string;
  message: string;
}): Promise<SendSquadSessionMessageResult> {
  try {
    const userId = await requireAuthUserId();
    const supabase = await createServerSupabaseClient();

    // === VALIDATION ===
    const validationResult = sendSquadSessionMessageSchema.safeParse(input);
    if (!validationResult.success) {
      return {
        success: false,
        code: "VALIDATION_ERROR",
        message: "Please fix the errors below",
        fieldErrors: validationResult.error.flatten().fieldErrors,
      };
    }

    const validated = validationResult.data;

    const { data, error } = await supabase
      .from("squad_session_messages")
      .insert({
        session_id: validated.session_id,
        sender_id: userId,
        message: validated.message,
      })
      .select("id")
      .single();

    if (error) {
      const msg = error.message ?? "";
      if (msg.includes("does not exist")) {
        return { success: false, code: "NOT_FOUND", message: "This squad session no longer exists." };
      }
      if (msg.includes("Only a participant")) {
        return { success: false, code: "NOT_PARTICIPANT", message: "You are not a participant of this squad session." };
      }
      if (msg.includes("Messages can only be sent by the authenticated user")) {
        return { success: false, code: "FORBIDDEN", message: "You cannot send a message on behalf of another user." };
      }
      if (msg.includes("Chat is only available once a session is accepted")) {
        return { success: false, code: "INVALID_STATUS", message: "Chat is only available after a squad request is accepted." };
      }
      console.error("Error sending squad session message:", error);
      return { success: false, code: "ERROR", message: "Failed to send message." };
    }

    revalidatePath(`/squads/${validated.session_id}`);
    return { success: true, data: { id: data.id } };
  } catch (err) {
    if (err instanceof Error && err.message === "AUTH_REQUIRED") {
      return { success: false, code: "AUTH_REQUIRED", message: "Authentication required." };
    }
    console.error("Unexpected error sending squad session message:", err);
    return { success: false, code: "ERROR", message: "An unexpected error occurred." };
  }
}

// ---------------------------------------------------------------------------
// getSquadSessionMessages
// ---------------------------------------------------------------------------

/**
 * Server Action: Fetch the message history for a squad session, oldest first.
 *
 * RLS on `squad_session_messages` restricts reads to the session's
 * participants (or an admin) via an EXISTS-join to the parent session, so a
 * non-participant's query returns no rows. To give callers a clear signal (and
 * as defense-in-depth over RLS), we first confirm the caller is a participant
 * (or admin) of the session before returning any messages.
 */
export async function getSquadSessionMessages(
  sessionId: string
): Promise<GetSquadSessionMessagesResult> {
  try {
    const userId = await requireAuthUserId();
    const supabase = await createServerSupabaseClient();

    // Defense-in-depth participant check over RLS.
    const { data: session, error: sessionError } = await supabase
      .from("squad_sessions")
      .select("id, initiator_id, recipient_id")
      .eq("id", sessionId)
      .maybeSingle();

    if (sessionError) {
      console.error("Error loading squad session for chat:", sessionError);
      return { success: false, code: "ERROR", message: "Failed to load messages." };
    }
    if (!session) {
      return { success: false, code: "NOT_FOUND", message: "Squad session not found." };
    }

    const { data: isAdminRow } = await supabase.rpc("is_admin");
    const isAdmin = isAdminRow === true;

    if (!isAdmin && session.initiator_id !== userId && session.recipient_id !== userId) {
      return { success: false, code: "FORBIDDEN", message: "You are not a participant of this squad session." };
    }

    const { data: messages, error } = await supabase
      .from("squad_session_messages")
      .select(
        `*,
         sender:profiles!squad_session_messages_sender_id_fkey (
           id, username, avatar_url
         )`
      )
      .eq("session_id", sessionId)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Error fetching squad session messages:", error);
      return { success: false, code: "ERROR", message: "Failed to load messages." };
    }

    return { success: true, data: (messages ?? []) as unknown as SquadSessionMessage[] };
  } catch (err) {
    if (err instanceof Error && err.message === "AUTH_REQUIRED") {
      return { success: false, code: "AUTH_REQUIRED", message: "Authentication required." };
    }
    console.error("Unexpected error fetching squad session messages:", err);
    return { success: false, code: "ERROR", message: "An unexpected error occurred." };
  }
}
