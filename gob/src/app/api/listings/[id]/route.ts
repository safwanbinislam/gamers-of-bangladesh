import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient, requireAuthUserId } from "@/lib/supabase/server";

/**
 * GET /api/listings/[id]
 * Single listing detail with seller's public profile info joined in.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await requireAuthUserId();
    const supabase = await createServerSupabaseClient();

    const { data: listing, error } = await supabase
      .from("listings")
      .select(
        `
        *,
        seller:profiles!listings_seller_id_fkey (
          id, username, avatar_url, reputation_score, total_trades, created_at
        )
      `
      )
      .eq("id", id)
      .single();

    if (error || !listing) {
      if (error?.code === "PGRST116") {
        return NextResponse.json(
          { success: false, code: "NOT_FOUND", message: "Listing not found" },
          { status: 404 }
        );
      }
      console.error("Error fetching listing:", error);
      return NextResponse.json(
        { success: false, code: "DATABASE_ERROR", message: "Failed to fetch listing" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, data: listing });
  } catch (err) {
    if (err instanceof Error && err.message === "AUTH_REQUIRED") {
      return NextResponse.json(
        { success: false, code: "AUTH_REQUIRED", message: "Authentication required" },
        { status: 401 }
      );
    }
    console.error("Unexpected error in GET /api/listings/[id]:", err);
    return NextResponse.json(
      { success: false, code: "INTERNAL_ERROR", message: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}