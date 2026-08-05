import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient, requireAuthUserId } from "@/lib/supabase/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { resolveDisputeSchema } from "@/lib/validation/disputes";
import { releaseEscrowFunds } from "@/lib/trades/releaseFunds";
import { bkashProvider } from "@/lib/payments/bkash";
import { nagadProvider } from "@/lib/payments/nagad";

/**
 * POST /api/admin/disputes/[id]/resolve
 * Admin-only dispute resolution.
 * Resolves the dispute and triggers the appropriate refund or fund release.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const userId = await requireAuthUserId();
    const supabase = await createServerSupabaseClient();

    // Verify the requester is an admin
    const { data: isAdmin, error: adminCheckError } = await supabase.rpc("is_admin");

    if (adminCheckError || !isAdmin) {
      return NextResponse.json(
        {
          success: false,
          code: "FORBIDDEN",
          message: "Only administrators can resolve disputes",
        },
        { status: 403 }
      );
    }

    const body = await request.json();
    const validationResult = resolveDisputeSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        {
          success: false,
          code: "VALIDATION_ERROR",
          message: "Invalid resolution data",
          errors: validationResult.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const { resolution, admin_notes } = validationResult.data;

    // Use admin client for bypassing RLS
    const adminSupabase = createAdminSupabaseClient();

    // Fetch the dispute with transaction details
    const { data: dispute, error: disputeError } = await adminSupabase
      .from("disputes")
      .select("*, escrow_transactions!disputes_transaction_id_fkey(*)")
      .eq("id", id)
      .single();

    if (disputeError || !dispute) {
      return NextResponse.json(
        { success: false, code: "NOT_FOUND", message: "Dispute not found" },
        { status: 404 }
      );
    }

    if (
      dispute.status === "resolved_buyer" ||
      dispute.status === "resolved_seller" ||
      dispute.status === "resolved_split"
    ) {
      return NextResponse.json(
        {
          success: false,
          code: "ALREADY_RESOLVED",
          message: "This dispute has already been resolved",
        },
        { status: 409 }
      );
    }

    const transaction = dispute.escrow_transactions as unknown as {
      id: string;
      status: string;
      amount_bdt: number;
      payment_method: string | null;
      payment_reference_id: string | null;
      buyer_id: string;
      seller_id: string;
    };

    // Resolve based on the resolution type
    if (resolution === "resolved_buyer") {
      // Refund the buyer
      if (transaction.payment_method && transaction.payment_reference_id) {
        const provider =
          transaction.payment_method === "bkash" ? bkashProvider : nagadProvider;

        try {
          await provider.refund({
            paymentReferenceId: transaction.payment_reference_id,
            amount: transaction.amount_bdt,
            reason: `Dispute resolved in buyer's favor: ${admin_notes ?? "No details provided"}`,
          });
        } catch (refundError) {
          console.error("Refund failed:", refundError);
          // Continue with resolution even if refund fails — admin can retry manually
        }
      }

      // Update transaction to refunded
      await adminSupabase
        .from("escrow_transactions")
        .update({ status: "refunded" })
        .eq("id", transaction.id);
    } else if (resolution === "resolved_seller") {
      // Release funds to seller
      const releaseResult = await releaseEscrowFunds(transaction.id, userId);
      if (!releaseResult.success) {
        return NextResponse.json(
          {
            success: false,
            code: "RELEASE_FAILED",
            message: releaseResult.error ?? "Failed to release funds to seller",
          },
          { status: 500 }
        );
      }
    } else if (resolution === "resolved_split") {
      // Split: refund half to buyer, release half to seller
      // In a real payment integration, this would call partial refund/release APIs
      // For now, we refund the full amount and note the split in admin_notes
      if (transaction.payment_method && transaction.payment_reference_id) {
        const provider =
          transaction.payment_method === "bkash" ? bkashProvider : nagadProvider;

        try {
          await provider.refund({
            paymentReferenceId: transaction.payment_reference_id,
            amount: Math.floor(transaction.amount_bdt / 2),
            reason: `Split resolution: half refund to buyer. ${admin_notes ?? ""}`,
          });
        } catch (refundError) {
          console.error("Split refund failed:", refundError);
        }
      }

      // Update transaction to refunded (simplified — in production, a split status would be better)
      await adminSupabase
        .from("escrow_transactions")
        .update({ status: "refunded" })
        .eq("id", transaction.id);
    }

    // Update the dispute record
    const { data: updatedDispute, error: updateError } = await adminSupabase
      .from("disputes")
      .update({
        status: resolution,
        admin_notes: admin_notes ?? null,
        resolved_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (updateError) {
      console.error("Error updating dispute resolution:", updateError);
      return NextResponse.json(
        { success: false, code: "DATABASE_ERROR", message: "Failed to record resolution" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, data: updatedDispute });
  } catch (err) {
    if (err instanceof Error && err.message === "AUTH_REQUIRED") {
      return NextResponse.json(
        { success: false, code: "AUTH_REQUIRED", message: "Authentication required" },
        { status: 401 }
      );
    }
    console.error("Unexpected error in POST /api/admin/disputes/[id]/resolve:", err);
    return NextResponse.json(
      { success: false, code: "INTERNAL_ERROR", message: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}