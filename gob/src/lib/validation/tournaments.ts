import { z } from "zod/v4";

const gameTypeEnum = z.enum(["free_fire", "pubg_mobile", "mobile_legends", "other"]);
const paymentMethodEnum = z.enum(["bkash", "nagad"]);
const tournamentStatusEnum = z.enum([
  "draft",
  "registration_open",
  "registration_closed",
  "bracket_generated",
  "in_progress",
  "completed",
  "cancelled",
]);

/**
 * Prize split must be an object whose keys are placement labels (e.g. "1st",
 * "2nd", "3rd" — matching the example in the schema's own comments/tests:
 * '{"1st":70,"2nd":30}') and whose numeric percentage values sum to exactly
 * 100. This mirrors the `validate_prize_split` Postgres function (already
 * enforced at the DB level via a CHECK constraint) so that organizers get a
 * clear, actionable validation error here instead of a raw Postgres
 * constraint-violation exception bubbling up from the insert.
 */
export const prizeSplitSchema = z
  .record(
    z.string().min(1, "Placement label cannot be empty"),
    z.number().positive("Each prize split percentage must be greater than 0").max(100)
  )
  .refine((split) => Object.keys(split).length > 0, {
    message: "Prize split must include at least one placement",
  })
  .refine(
    (split) => {
      const total = Object.values(split).reduce((sum, v) => sum + v, 0);
      // Small floating point tolerance to allow e.g. 33.33 + 33.33 + 33.34
      return Math.abs(total - 100) < 0.01;
    },
    { message: "Prize split percentages must sum to exactly 100" }
  );

export const createTournamentSchema = z.object({
  game: gameTypeEnum,
  title: z.string().min(3, "Title must be at least 3 characters").max(120, "Title must be at most 120 characters"),
  rules: z.string().max(5000, "Rules must be at most 5000 characters").optional().nullable(),
  entry_fee_bdt: z.number().nonnegative("Entry fee cannot be negative").max(999999, "Entry fee is too large"),
  /**
   * ASSUMPTION: the database schema does NOT require max_participants to be
   * a power of two. generate_bracket() has been verified (via direct
   * end-to-end testing, including an 11-player case) to correctly handle
   * any player count by distributing byes as needed. We therefore only
   * validate a sane numeric range here rather than forcing a power-of-two
   * value, which would be an unnecessary application-level restriction not
   * mirrored by the database.
   */
  max_participants: z.number().int().min(2, "A tournament needs at least 2 participant slots").max(1024),
  prize_split: prizeSplitSchema,
  platform_fee_percent: z.number().min(0).max(100).optional(),
  starts_at: z.string().datetime({ message: "starts_at must be a valid ISO 8601 datetime" }),
  registration_closes_at: z
    .string()
    .datetime({ message: "registration_closes_at must be a valid ISO 8601 datetime" })
    .optional()
    .nullable(),
});

/**
 * Mirrors fundTradeSchema (lib/validation/trades.ts): the existing payment
 * flow in this codebase has the player pay externally via the bKash/Nagad
 * app first, then submit the resulting transaction reference here for
 * verification. There is no existing usage of PaymentProvider.initiatePayment()
 * anywhere in this codebase (the trades flow doesn't call it either — see
 * app/api/trades/[id]/fund/route.ts), so we follow that same established
 * "pay externally, then verify" pattern rather than inventing a new flow
 * just for tournament registration.
 */
export const registerForTournamentSchema = z.object({
  payment_method: paymentMethodEnum,
  payment_reference_id: z.string().min(1, "Payment reference ID is required"),
  /**
   * Idempotency key to safely handle duplicate /register requests,
   * mirroring fundTradeSchema's idempotency_key.
   */
  idempotency_key: z.string().uuid("Idempotency key must be a valid UUID"),
});

export const reportMatchResultSchema = z.object({
  winner_id: z.string().uuid("winner_id must be a valid UUID"),
});

/**
 * No request body is required to close registration — the action is fully
 * determined by the tournament ID in the route path plus the caller's role.
 * This schema exists so the route can validate an (empty) body consistently
 * with every other route, and so a client accidentally sending a body with
 * unexpected extra fields is rejected rather than silently ignored.
 */
export const closeRegistrationSchema = z.object({}).strict();

export const listTournamentsQuerySchema = z.object({
  game: gameTypeEnum.optional(),
  status: tournamentStatusEnum.optional(),
  page: z.coerce.number().int().positive().default(1),
  per_page: z.coerce.number().int().positive().max(50).default(20),
});

export type CreateTournamentInput = z.infer<typeof createTournamentSchema>;
export type RegisterForTournamentInput = z.infer<typeof registerForTournamentSchema>;
export type ReportMatchResultInput = z.infer<typeof reportMatchResultSchema>;
export type ListTournamentsQuery = z.infer<typeof listTournamentsQuerySchema>;
