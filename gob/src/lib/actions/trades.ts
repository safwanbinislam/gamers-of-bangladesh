"use server";

import { createServerSupabaseClient, requireAuthUserId } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

/**
 * Server Action: Initiate a trade (buyer clicks "Start Trade").
 */
export async function initiateTrade(listingId: string) {
  try {
    const userId = await requireAuthUserId();
    const supabase = await createServerSupabaseClient();

    const { data: transactionId, error } = await supabase.rpc("create_trade_atomic", {
      p_listing_id: listingId,
      p_buyer_id: userId,
    });

    if (error) {
      if (error.message?.includes("is not available for trade")) {
        return { success: false as const, code: "LISTING_UNAVAILABLE", message: "This listing is no longer available." };
      }
      if (error.message?.includes("cannot trade their own listing")) {
        return { success: false as const, code: "SELF_TRADE", message: "You cannot trade your own listing." };
      }
      return { success: false as const, code: "ERROR", message: "Failed to initiate trade." };
    }

    revalidatePath("/marketplace");
    revalidatePath("/trades");
    return { success: true as const, data: transactionId as string };
  } catch {
    return { success: false as const, code: "AUTH_ERROR", message: "Authentication required." };
  }
}

/**
 * Server Action: Fund a trade (buyer confirms payment).
 */
export async function fundTrade(
  tradeId: string,
  paymentMethod: "bkash" | "nagad",
  paymentReferenceId: string
) {
  try {
    const supabase = await createServerSupabaseClient();
    await requireAuthUserId();

    const res = await fetch(`${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/api/trades/${tradeId}/fund`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        payment_method: paymentMethod,
        payment_reference_id: paymentReferenceId,
        idempotency_key: crypto.randomUUID(),
      }),
    });

    const result = await res.json();

    if (!result.success) {
      return { success: false as const, code: result.code ?? "ERROR", message: result.message ?? "Payment failed." };
    }

    revalidatePath(`/trades/${tradeId}`);
    revalidatePath("/trades");
    return { success: true as const, data: result.data };
  } catch {
    return { success: false as const, code: "NETWORK_ERROR", message: "Network error. Please try again." };
  }
}

/**
 * Server Action: Mark trade as delivered (seller).
 */
export async function deliverTrade(tradeId: string, proofScreenshotUrl?: string) {
  try {
    await requireAuthUserId();

    const res = await fetch(`${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/api/trades/${tradeId}/deliver`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        proof_screenshot_url: proofScreenshotUrl ?? null,
      }),
    });

    const result = await res.json();

    if (!result.success) {
      return { success: false as const, code: result.code ?? "ERROR", message: result.message ?? "Failed to mark delivery." };
    }

    revalidatePath(`/trades/${tradeId}`);
    revalidatePath("/trades");
    return { success: true as const, data: result.data };
  } catch {
    return { success: false as const, code: "NETWORK_ERROR", message: "Network error. Please try again." };
  }
}

/**
 * Server Action: Confirm trade receipt (buyer).
 */
export async function confirmTrade(tradeId: string) {
  try {
    await requireAuthUserId();

    const res = await fetch(`${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/api/trades/${tradeId}/confirm`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });

    const result = await res.json();

    if (!result.success) {
      return { success: false as const, code: result.code ?? "ERROR", message: result.message ?? "Confirmation failed." };
    }

    revalidatePath(`/trades/${tradeId}`);
    revalidatePath("/trades");
    return { success: true as const, data: result.data };
  } catch {
    return { success: false as const, code: "NETWORK_ERROR", message: "Network error. Please try again." };
  }
}

/**
 * Server Action: Open a dispute.
 */
export async function disputeTrade(tradeId: string, reason: string) {
  try {
    await requireAuthUserId();

    const res = await fetch(`${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/api/trades/${tradeId}/dispute`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason }),
    });

    const result = await res.json();

    if (!result.success) {
      return { success: false as const, code: result.code ?? "ERROR", message: result.message ?? "Failed to open dispute." };
    }

    revalidatePath(`/trades/${tradeId}`);
    revalidatePath("/trades");
    revalidatePath(`/disputes/${result.data.id}`);
    return { success: true as const, data: result.data };
  } catch {
    return { success: false as const, code: "NETWORK_ERROR", message: "Network error. Please try again." };
  }
}

/**
 * Server Action: Send a dispute message.
 */
export async function sendDisputeMessage(disputeId: string, message: string) {
  try {
    await requireAuthUserId();

    const res = await fetch(`${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/api/disputes/${disputeId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message }),
    });

    const result = await res.json();

    if (!result.success) {
      return { success: false as const, code: result.code ?? "ERROR", message: result.message ?? "Failed to send message." };
    }

    revalidatePath(`/disputes/${disputeId}`);
    return { success: true as const, data: result.data };
  } catch {
    return { success: false as const, code: "NETWORK_ERROR", message: "Network error. Please try again." };
  }
}