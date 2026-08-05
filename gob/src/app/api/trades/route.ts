import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient, requireAuthUserId } from "@/lib/supabase/server";
import { initiateTradeSchema } from "@/lib/validation/trades";

/**
 * POST /api/trades
 * Buyer initiates a trade. Calls the create_trade_atomic RPC function
 * which creates the escrow_transactions row AND updates the listing to
 * pending_trade in a single database transaction (avoiding race conditions).
 */
export async function POST(request: NextRequest) {
  try {
    const buyerId = await requireAuthUserId();
    const supabase = await createServerSupabaseClient();

    const body = await request.json();
    const validationResult = initiateTradeSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        {
          success: false,
          code: "VALIDATION_ERROR",
          message: "Invalid request data",
          errors: validationResult.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const { listing_id } = validationResult.data;

    // Call the Postgres RPC function — this is atomic and handles:
    // 1. Locking the listing row
    // 2. Validating listing exists and is active
    // 3. Preventing self-trading (buyer cannot be the seller)
    // 4. Creating the escrow_transactions row
    // 5. Updating listing status to 'pending_trade'
    const { data: transactionId, error } = await supabase.rpc(
      "create_trade_atomic",
      {
        p_listing_id: listing_id,
        p_buyer_id: buyerId,
      }
    );

    if (error) {
      // Map Postgres error codes to user-friendly messages
      if (error.message?.includes("is not available for trade")) {
        return NextResponse.json(
          {
            success: false,
            code: "LISTING_UNAVAILABLE",
            message: "This listing is no longer available for trade",
          },
          { status: 409 }
        );
      }
      if (error.message?.includes("cannot trade their own listing")) {
        return NextResponse.json(
          {
            success: false,
            code: "SELF_TRADE",
            message: "You cannot trade your own listing",
          },
          { status: 400 }
        );
      }
      console.error("Error initiating trade:", error);
      return NextResponse.json(
        { success: false, code: "DATABASE_ERROR", message: "Failed to initiate trade" },
        { status: 500 }
      );
    }

    // Fetch the created transaction to return full details
    const { data: transaction, error: fetchError } = await supabase
      .from("escrow_transactions")
      .select("*")
      .eq("id", transactionId)
      .single();

    if (fetchError) {
      console.error("Error fetching created transaction:", fetchError);
      return NextResponse.json(
        { success: true, data: { id: transactionId } },
        { status: 201 }
      );
    }

    return NextResponse.json({ success: true, data: transaction }, { status: 201 });
  } catch (err) {
    if (err instanceof Error && err.message === "AUTH_REQUIRED") {
      return NextResponse.json(
        { success: false, code: "AUTH_REQUIRED", message: "Authentication required" },
        { status: 401 }
      );
    }
    console.error("Unexpected error in POST /api/trades:", err);
    return NextResponse.json(
      { success: false, code: "INTERNAL_ERROR", message: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}