import { z } from "zod/v4";

export const createReviewSchema = z.object({
  transaction_id: z.string().uuid("Invalid transaction ID"),
  rating: z.number().int().min(1, "Rating must be at least 1").max(5, "Rating must be at most 5"),
  comment: z.string().max(1000, "Comment must be at most 1000 characters").optional().nullable(),
});

export type CreateReviewInput = z.infer<typeof createReviewSchema>;