import { z } from "zod/v4";

/**
 * Reuses the existing game_type enum from the database schema.
 * Mirrors the pattern in lib/validation/tournaments.ts.
 */
const gameTypeEnum = z.enum(["free_fire", "pubg_mobile", "mobile_legends", "other"]);

/**
 * Zod schema for upserting a self-reported game stat entry.
 *
 * - `game`: must match the PostgreSQL game_type enum
 * - `in_game_name`: 2–32 characters, trimmed
 * - `rank_or_level`: optional free-text (max ~50 chars), e.g. "Heroic", "Ace", "Mythic"
 * - `stats`: optional JSON object — intentionally loosely validated since this
 *   is explicitly unverified self-reported data whose shape varies by game
 *   (e.g. {"kd_ratio": 3.2, "matches_played": 500}). We only validate that
 *   it's a plain object, not null, not an array, not a primitive.
 *
 * The `player_id` is intentionally NOT accepted from the client — it is always
 * derived from the authenticated session in the server action.
 */
export const upsertGameStatSchema = z.object({
  game: gameTypeEnum,
  in_game_name: z
    .string()
    .min(2, "In-game name must be at least 2 characters")
    .max(32, "In-game name must be at most 32 characters")
    .trim(),
  rank_or_level: z
    .string()
    .max(50, "Rank/level must be at most 50 characters")
    .trim()
    .optional()
    .nullable()
    .default(null),
  stats: z
    .record(z.string(), z.unknown())
    .optional()
    .nullable()
    .default(null),
});

export type UpsertGameStatInput = z.infer<typeof upsertGameStatSchema>;