import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient, requireAuthUserId } from "@/lib/supabase/server";
import { createDisputeMessageSchema } from "@/lib/validation/disputes";

/**
 * GET /api/disputes/[id]/messages
 * Fetch the message thread for a dispute. Only participants/admin can view.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const userId = await requireAuthUserId();
    const supabase = await createServerSupabaseClient();

    // Fetch the dispute to verify access
    const { data: dispute, error: disputeError } = await supabase
      .from("disputes")
      .select("*, escrow_transactions!disputes_transaction_id_fkey(buyer_id, seller_id)")
      .eq("id", id)
      .single();

    if (disputeError || !dispute) {
      return NextResponse.json(
        { success: false, code: "NOT_FOUND", message: "Dispute not found" },
        { status: 404 }
      );
    }

    const transaction = dispute.escrow_transactions as unknown as {
      buyer_id: string;
      seller_id: string;
    };

    const isParticipant =
      transaction.buyer_id === userId ||
      transaction.seller_id === userId ||
      dispute.raised_by === userId;

    const { data: isAdmin } = await supabase.rpc("is_admin");

    if (!isParticipant && !isAdmin) {
      return NextResponse.json(
        {
          success: false,
          code: "FORBIDDEN",
          message: "You do not have access to this dispute thread",
        },
        { status: 403 }
      );
    }

    // Fetch messages with sender info
    const { data: messages, error: messagesError } = await supabase
      .from("dispute_messages")
      .select(
        `
        *,
        sender:profiles!dispute_messages_sender_id_fkey (
          id, username, avatar_url, is_admin
        )
      `
      )
      .eq("dispute_id", id)
      .order("created_at", { ascending: true });

    if (messagesError) {
      console.error("Error fetching dispute messages:", messagesError);
      return NextResponse.json(
        { success: false, code: "DATABASE_ERROR", message: "Failed to fetch messages" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, data: messages ?? [] });
  } catch (err) {
    if (err instanceof Error && err.message === "AUTH_REQUIRED") {
      return NextResponse.json(
        { success: false, code: "AUTH_REQUIRED", message: "Authentication required" },
        { status: 401 }
      );
    }
    console.error("Unexpected error in GET /api/disputes/[id]/messages:", err);
    return NextResponse.json(
      { success: false, code: "INTERNAL_ERROR", message: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/disputes/[id]/messages
 * Add a new message to the dispute thread.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const userId = await requireAuthUserId();
    const supabase = await createServerSupabaseClient();

    const body = await request.json();
    const validationResult = createDisputeMessageSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        {
          success: false,
          code: "VALIDATION_ERROR",
          message: "Invalid message data",
          errors: validationResult.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const { message, attachment_url } = validationResult.data;

    // Verify the user is a participant in this dispute
    const { data: dispute, error: disputeError } = await supabase
      .from("disputes")
      .select("*, escrow_transactions!disputes_transaction_id_fkey(buyer_id, seller_id)")
      .eq("id", id)
      .single();

    if (disputeError || !dispute) {
      return NextResponse.json(
        { success: false, code: "NOT_FOUND", message: "Dispute not found" },
        { status: 404 }
      );
    }

    // Don't allow messages on resolved disputes
    if (
      dispute.status === "resolved_buyer" ||
      dispute.status === "resolved_seller" ||
      dispute.status === "resolved_split"
    ) {
      return NextResponse.json(
        {
          success: false,
          code: "DISPUTE_RESOLVED",
          message: "This dispute has been resolved. No further messages can be added.",
        },
        { status: 400 }
      );
    }

    const transaction = dispute.escrow_transactions as unknown as {
      buyer_id: string;
      seller_id: string;
    };

    const isParticipant =
      transaction.buyer_id === userId ||
      transaction.seller_id === userId ||
      dispute.raised_by === userId;

    const { data: isAdmin } = await supabase.rpc("is_admin");

    if (!isParticipant && !isAdmin) {
      return NextResponse.json(
        {
          success: false,
          code: "FORBIDDEN",
          message: "You do not have access to this dispute thread",
        },
        { status: 403 }
      );
    }

    // Insert the message
    const { data: newMessage, error: insertError } = await supabase
      .from("dispute_messages")
      .insert({
        dispute_id: id,
        sender_id: userId,
        message,
        attachment_url: attachment_url ?? null,
      })
      .select(
        `
        *,
        sender:profiles!dispute_messages_sender_id_fkey (
          id, username, avatar_url, is_admin
        )
      `
      )
      .single();

    if (insertError) {
      console.error("Error creating dispute message:", insertError);
      return NextResponse.json(
        { success: false, code: "DATABASE_ERROR", message: "Failed to send message" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, data: newMessage }, { status: 201 });
  } catch (err) {
    if (err instanceof Error && err.message === "AUTH_REQUIRED") {
      return NextResponse.json(
        { success: false, code: "AUTH_REQUIRED", message: "Authentication required" },
        { status: 401 }
      );
    }
    console.error("Unexpected error in POST /api/disputes/[id]/messages:", err);
    return NextResponse.json(
      { success: false, code: "INTERNAL_ERROR", message: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}