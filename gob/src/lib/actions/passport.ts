"use server";

import { createServerSupabaseClient, requireAuthUserId } from "@/lib/supabase/server";
import { upsertGameStatSchema } from "@/lib/validation/playerGameStats";
import type { Json } from "@/lib/supabase/types";
import { revalidatePath } from "next/cache";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type GetPlayerPassportResult =
  | { success: true; data: Record<string, unknown> }
  | { success: false; code: string; message: string };

export type UpsertGameStatResult =
  | { success: true; data: unknown }
  | { success: false; code: string; message: string; fieldErrors?: Record<string, string[]> };

export type DeleteGameStatResult =
  | { success: true }
  | { success: false; code: string; message: string };

// ---------------------------------------------------------------------------
// getPlayerPassport
// ---------------------------------------------------------------------------

/**
 * Server Action: Fetch a player's full passport (public profile + tournament
 * summary + badges + self-reported game stats).
 *
 * Queries the database view `player_passport_view` which already does all the
 * heavy aggregation.  No auth required — this is a public profile feature.
 *
 * The action is intentionally kept as a server function (not a Route Handler)
 * to follow this project's established pattern: server actions call Supabase
 * directly rather than fetching internal API routes.  See the prior cleanup
 * of `app/api/tournaments/*` and `app/api/matches/*` for context.
 *
 * For a public profile page, a server component should call this directly
 * without a client wrapper.  For a client component, use it as a server
 * action triggered by a ``useActionState`` or manual ``fetch``-equivalent.
 */
export async function getPlayerPassport(playerId: string): Promise<GetPlayerPassportResult> {
  try {
    const supabase = await createServerSupabaseClient();

    const { data, error } = await supabase
      .from("player_passport_view")
      .select("*")
      .eq("id", playerId)
      .maybeSingle();

    if (error) {
      console.error("Error fetching player passport:", error);
      return { success: false, code: "DATABASE_ERROR", message: "Failed to fetch player passport" };
    }

    if (!data) {
      return { success: false, code: "NOT_FOUND", message: "Player not found" };
    }

    return { success: true, data: data as Record<string, unknown> };
  } catch (err) {
    console.error("Unexpected error fetching player passport:", err);
    return { success: false, code: "ERROR", message: "An unexpected error occurred" };
  }
}

// ---------------------------------------------------------------------------
// upsertGameStat
// ---------------------------------------------------------------------------

/**
 * Server Action: Create or update the authenticated user's self-reported game
 * stat entry for a given game.
 *
 * The `player_id` is always derived from the authenticated session — never
 * trusted from client input.  This uses a genuine upsert on the
 * `(player_id, game)` unique constraint so the same player can only have one
 * stat entry per game.
 */
export async function upsertGameStat(input: {
  game: string;
  in_game_name: string;
  rank_or_level?: string | null;
  stats?: Record<string, unknown> | null;
}): Promise<UpsertGameStatResult> {
  try {
    const playerId = await requireAuthUserId();
    const supabase = await createServerSupabaseClient();

    // === VALIDATION ===
    const validationResult = upsertGameStatSchema.safeParse(input);
    if (!validationResult.success) {
      return {
        success: false,
        code: "VALIDATION_ERROR",
        message: "Please fix the errors below",
        fieldErrors: validationResult.error.flatten().fieldErrors,
      };
    }

    const validated = validationResult.data;

    // === UPSERT on (player_id, game) unique constraint ===
    // `validated.stats` is a `Record<string, unknown>` from zod. The zod schema
    // already runtime-validated it is a plain object, which is fully compatible
    // with Supabase's `Json` type, so this type assertion is safe.
    const statsJson: Json | null = validated.stats ? (validated.stats as Json) : null;

    const { data: stat, error } = await supabase
      .from("player_game_stats")
      .upsert(
        {
          player_id: playerId,
          game: validated.game,
          in_game_name: validated.in_game_name,
          rank_or_level: validated.rank_or_level ?? null,
          stats: statsJson,
          is_verified: false, // always false for now; future verification mechanism
        },
        {
          onConflict: "player_id, game",
          ignoreDuplicates: false,
        }
      )
      .select()
      .single();

    if (error) {
      console.error("Error upserting game stat:", error);
      return { success: false, code: "DATABASE_ERROR", message: "Failed to save game stats" };
    }

    revalidatePath(`/players/${playerId}`);
    return { success: true, data: stat };
  } catch (err) {
    if (err instanceof Error && err.message === "AUTH_REQUIRED") {
      return { success: false, code: "AUTH_REQUIRED", message: "Authentication required" };
    }
    console.error("Unexpected error upserting game stat:", err);
    return { success: false, code: "ERROR", message: "An unexpected error occurred" };
  }
}

// ---------------------------------------------------------------------------
// deleteGameStat
// ---------------------------------------------------------------------------

/**
 * Server Action: Delete the authenticated user's self-reported game stat entry
 * for a specific game.
 */
export async function deleteGameStat(game: string): Promise<DeleteGameStatResult> {
  try {
    const playerId = await requireAuthUserId();
    const supabase = await createServerSupabaseClient();

    const gameType = game as "free_fire" | "pubg_mobile" | "mobile_legends" | "other";

    const { error } = await supabase
      .from("player_game_stats")
      .delete()
      .eq("player_id", playerId)
      .eq("game", gameType);

    if (error) {
      console.error("Error deleting game stat:", error);
      return { success: false, code: "DATABASE_ERROR", message: "Failed to delete game stats" };
    }

    revalidatePath(`/players/${playerId}`);
    return { success: true };
  } catch (err) {
    if (err instanceof Error && err.message === "AUTH_REQUIRED") {
      return { success: false, code: "AUTH_REQUIRED", message: "Authentication required" };
    }
    console.error("Unexpected error deleting game stat:", err);
    return { success: false, code: "ERROR", message: "An unexpected error occurred" };
  }
}