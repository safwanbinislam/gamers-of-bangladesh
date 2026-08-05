import { z } from "zod/v4";

const gameTypeEnum = z.enum(["free_fire", "pubg_mobile", "mobile_legends", "other"]);
const itemTypeEnum = z.enum(["account", "skin", "uc", "diamonds", "other"]);
const listingStatusEnum = z.enum(["active", "pending_trade", "sold", "removed"]);

export const createListingSchema = z.object({
  game: gameTypeEnum,
  item_type: itemTypeEnum,
  title: z.string().min(3, "Title must be at least 3 characters").max(120, "Title must be at most 120 characters"),
  description: z.string().max(2000, "Description must be at most 2000 characters").optional().nullable(),
  price_bdt: z.number().positive("Price must be greater than 0").max(99999999, "Price must be at most 99,999,999 BDT"),
  screenshots: z.array(z.string().url("Each screenshot must be a valid URL")).max(10, "Maximum 10 screenshots").optional().nullable(),
});

export const listListingsQuerySchema = z.object({
  game: gameTypeEnum.optional(),
  item_type: itemTypeEnum.optional(),
  status: listingStatusEnum.optional(),
  min_price: z.coerce.number().positive().optional(),
  max_price: z.coerce.number().positive().optional(),
  seller_id: z.string().uuid().optional(),
  page: z.coerce.number().int().positive().default(1),
  per_page: z.coerce.number().int().positive().max(50).default(20),
});

export type CreateListingInput = z.infer<typeof createListingSchema>;
export type ListListingsQuery = z.infer<typeof listListingsQuerySchema>;