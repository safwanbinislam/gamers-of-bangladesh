import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient, requireAuthUserId } from "@/lib/supabase/server";
import { createListingSchema, listListingsQuerySchema } from "@/lib/validation/listings";

/**
 * GET /api/listings
 * List/filter listings by game, item_type, price range.
 * Defaults to status = 'active' unless the requester is the listing's own seller.
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const currentUserId = await requireAuthUserId();

    const { searchParams } = new URL(request.url);
    const queryResult = listListingsQuerySchema.safeParse(
      Object.fromEntries(searchParams.entries())
    );

    if (!queryResult.success) {
      return NextResponse.json(
        {
          success: false,
          code: "VALIDATION_ERROR",
          message: "Invalid query parameters",
          errors: queryResult.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const { game, item_type, status, min_price, max_price, seller_id, page, per_page } =
      queryResult.data;

    let query = supabase
      .from("listings")
      .select(
        `
        *,
        seller:profiles!listings_seller_id_fkey (
          id, username, avatar_url, reputation_score, total_trades
        )
      `,
        { count: "exact" }
      );

    // Default to active listings unless the requester is the seller
    if (status) {
      query = query.eq("status", status);
    } else if (seller_id === currentUserId) {
      // If filtering by own listings, show all statuses
    } else {
      query = query.eq("status", "active");
    }

    if (game) query = query.eq("game", game);
    if (item_type) query = query.eq("item_type", item_type);
    if (seller_id) query = query.eq("seller_id", seller_id);
    if (min_price) query = query.gte("price_bdt", min_price);
    if (max_price) query = query.lte("price_bdt", max_price);

    const from = (page - 1) * per_page;
    const to = from + per_page - 1;

    const { data: listings, error, count } = await query
      .order("created_at", { ascending: false })
      .range(from, to);

    if (error) {
      console.error("Error fetching listings:", error);
      return NextResponse.json(
        { success: false, code: "DATABASE_ERROR", message: "Failed to fetch listings" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        listings,
        pagination: {
          page,
          per_page,
          total: count ?? 0,
          total_pages: count ? Math.ceil(count / per_page) : 0,
        },
      },
    });
  } catch (err) {
    if (err instanceof Error && err.message === "AUTH_REQUIRED") {
      return NextResponse.json(
        { success: false, code: "AUTH_REQUIRED", message: "Authentication required" },
        { status: 401 }
      );
    }
    console.error("Unexpected error in GET /api/listings:", err);
    return NextResponse.json(
      { success: false, code: "INTERNAL_ERROR", message: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/listings
 * Create a new listing. seller_id comes from the authenticated session, never from the request body.
 */
export async function POST(request: NextRequest) {
  try {
    const sellerId = await requireAuthUserId();
    const supabase = await createServerSupabaseClient();

    const body = await request.json();
    const validationResult = createListingSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        {
          success: false,
          code: "VALIDATION_ERROR",
          message: "Invalid listing data",
          errors: validationResult.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const { game, item_type, title, description, price_bdt, screenshots } =
      validationResult.data;

    const { data: listing, error } = await supabase
      .from("listings")
      .insert({
        seller_id: sellerId,
        game,
        item_type,
        title,
        description: description ?? null,
        price_bdt,
        screenshots: screenshots ?? null,
        status: "active",
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating listing:", error);
      return NextResponse.json(
        { success: false, code: "DATABASE_ERROR", message: "Failed to create listing" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, data: listing }, { status: 201 });
  } catch (err) {
    if (err instanceof Error && err.message === "AUTH_REQUIRED") {
      return NextResponse.json(
        { success: false, code: "AUTH_REQUIRED", message: "Authentication required" },
        { status: 401 }
      );
    }
    console.error("Unexpected error in POST /api/listings:", err);
    return NextResponse.json(
      { success: false, code: "INTERNAL_ERROR", message: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}