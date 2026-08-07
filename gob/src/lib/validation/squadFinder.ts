import { z } from "zod/v4";

/**
 * Reuses the existing game_type enum from the database schema.
 * Mirrors the pattern in lib/validation/tournaments.ts and
 * lib/validation/playerGameStats.ts.
 */
const gameTypeEnum = z.enum(["free_fire", "pubg_mobile", "mobile_legends", "other"]);

/**
 * Valid playtime day names. Stored as lowercase text[] in the DB.
 * The schema stores whatever the app sends, but we constrain to
 * the standard weekdays for consistency.
 */
const weekdayEnum = z.enum([
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
]);

/**
 * Zod schema for upserting (creating or updating) a player's squad
 * matchmaking preferences for a single game.
 *
 * - `game`: must match the PostgreSQL game_type enum
 * - `rank_or_level`: optional self-reported free text (e.g. "Diamond", "Heroic")
 * - `preferred_squad_size`: 2–10 (matches the DB CHECK constraint)
 * - `playtime_days`: array of weekday names (optional, defaults to [])
 * - `playtime_start_hour`/`playtime_end_hour`: optional 0–23; if both set,
 *   start must be <= end (matches the DB CHECK constraint)
 * - `region`: optional free text, e.g. "Dhaka", "Chattogram"
 * - `looking_for_note`: optional free text
 * - `is_active`: whether the player wants to be shown in match results
 *
 * `player_id` is intentionally NOT accepted from the client — it is always
 * derived from the authenticated session in the server action.
 */
export const upsertSquadPreferencesSchema = z
  .object({
    game: gameTypeEnum,
    rank_or_level: z
      .string()
      .max(50, "Rank/level must be at most 50 characters")
      .trim()
      .optional()
      .nullable()
      .default(null),
    preferred_squad_size: z
      .number()
      .int("Squad size must be a whole number")
      .min(2, "Squad size must be between 2 and 10")
      .max(10, "Squad size must be between 2 and 10")
      .default(4),
    playtime_days: z
      .array(weekdayEnum)
      .default([]),
    playtime_start_hour: z
      .number()
      .int("Start hour must be a whole number")
      .min(0, "Start hour must be between 0 and 23")
      .max(23, "Start hour must be between 0 and 23")
      .optional()
      .nullable()
      .default(null),
    playtime_end_hour: z
      .number()
      .int("End hour must be a whole number")
      .min(0, "End hour must be between 0 and 23")
      .max(23, "End hour must be between 0 and 23")
      .optional()
      .nullable()
      .default(null),
    region: z
      .string()
      .max(50, "Region must be at most 50 characters")
      .trim()
      .optional()
      .nullable()
      .default(null),
    looking_for_note: z
      .string()
      .max(200, "Note must be at most 200 characters")
      .trim()
      .optional()
      .nullable()
      .default(null),
    is_active: z.boolean().default(true),
  })
  .refine(
    (data) => {
      // If both hours are set, start must be <= end (DB CHECK constraint).
      if (
        data.playtime_start_hour != null &&
        data.playtime_end_hour != null &&
        data.playtime_start_hour > data.playtime_end_hour
      ) {
        return false;
      }
      return true;
    },
    {
      message: "Playtime start hour must be before or equal to end hour",
      path: ["playtime_end_hour"],
    }
  );

export type UpsertSquadPreferencesInput = z.infer<typeof upsertSquadPreferencesSchema>;

/**
 * Zod schema for requesting a squad session with another player.
 *
 * - `recipient_id`: uuid of the player being asked to squad up
 * - `game`: must match the PostgreSQL game_type enum
 * - `scheduled_at`: optional ISO datetime for when they plan to play
 */
export const requestSquadSessionSchema = z.object({
  recipient_id: z.string().uuid("Recipient must be a valid user ID"),
  game: gameTypeEnum,
  scheduled_at: z.string().datetime().optional().nullable().default(null),
});

export type RequestSquadSessionInput = z.infer<typeof requestSquadSessionSchema>;

/**
 * Zod schema for cancelling an outgoing squad request.
 *
 * Only the initiator may cancel, and only while the session is still
 * `requested` — enforced by `cancel_squad_session` RPC. Here we only
 * validate the input shape (session_id must be a uuid).
 */
export const cancelSquadSessionSchema = z.object({
  session_id: z.string().uuid("Session must be a valid ID"),
});

export type CancelSquadSessionInput = z.infer<typeof cancelSquadSessionSchema>;

/**
 * Zod schema for marking an accepted squad session as completed.
 *
 * Only a participant may complete, and only when status is `accepted` —
 * enforced by `complete_squad_session` RPC. Here we only validate the
 * input shape (session_id must be a uuid).
 */
export const completeSquadSessionSchema = z.object({
  session_id: z.string().uuid("Session must be a valid ID"),
});

export type CompleteSquadSessionInput = z.infer<typeof completeSquadSessionSchema>;

/**
 * Zod schema for sending a squad session chat message.
 *
 * - `session_id`: uuid of the session the message belongs to
 * - `message`: at most 1000 characters, trimmed, and must be non-empty after
 *   trimming. The DB enforces the 1000-char limit via a CHECK constraint and
 *   the participant/status rules via the `validate_squad_session_message`
 *   BEFORE INSERT trigger — here we only validate input shape and length.
 *
 * `sender_id` is intentionally NOT accepted from the client — it is always
 * derived from the authenticated session in the server action.
 */
export const sendSquadSessionMessageSchema = z.object({
  session_id: z.string().uuid("Session must be a valid ID"),
  message: z
    .string()
    .max(1000, "Message must be at most 1000 characters")
    .transform((value) => value.trim())
    .refine((value) => value.length > 0, { message: "Message is required" }),
});

export type SendSquadSessionMessageInput = z.infer<typeof sendSquadSessionMessageSchema>;

