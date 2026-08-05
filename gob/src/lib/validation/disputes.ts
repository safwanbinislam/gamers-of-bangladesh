import { z } from "zod/v4";

const disputeStatusEnum = z.enum([
  "open",
  "under_review",
  "resolved_buyer",
  "resolved_seller",
  "resolved_split",
]);

export const createDisputeMessageSchema = z.object({
  message: z.string().min(1, "Message is required").max(2000, "Message must be at most 2000 characters"),
  attachment_url: z.string().url("Attachment must be a valid URL").optional().nullable(),
});

export const resolveDisputeSchema = z.object({
  resolution: disputeStatusEnum.refine(
    (val) => val !== "open" && val !== "under_review",
    { message: "Resolution must be one of: resolved_buyer, resolved_seller, resolved_split" }
  ),
  admin_notes: z.string().max(2000).optional().nullable(),
});

export type CreateDisputeMessageInput = z.infer<typeof createDisputeMessageSchema>;
export type ResolveDisputeInput = z.infer<typeof resolveDisputeSchema>;