"use server";

import { createServerSupabaseClient, requireAuthUserId } from "@/lib/supabase/server";
import { createListingSchema } from "@/lib/validation/listings";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export type CreateListingResult =
  | { success: true; listingId: string }
  | { success: false; code: string; message: string; fieldErrors?: Record<string, string[]> };

/**
 * Server Action: Create a new listing.
 * Handles image upload to Supabase Storage, then creates the listing row.
 */
export async function createListing(formData: FormData): Promise<CreateListingResult> {
  try {
    const userId = await requireAuthUserId();

    // 1. Parse form fields
    const game = formData.get("game") as string;
    const item_type = formData.get("item_type") as string;
    const title = formData.get("title") as string;
    const description = formData.get("description") as string | null;
    const priceBdt = formData.get("price_bdt") ? parseFloat(formData.get("price_bdt") as string) : undefined;

    // Validate with zod
    const validationResult = createListingSchema.safeParse({
      game,
      item_type,
      title,
      description: description || null,
      price_bdt: priceBdt,
      screenshots: null, // We'll upload images server-side
    });

    if (!validationResult.success) {
      return {
        success: false,
        code: "VALIDATION_ERROR",
        message: "Please fix the errors below",
        fieldErrors: validationResult.error.flatten().fieldErrors,
      };
    }

    const supabase = await createServerSupabaseClient();
    const screenshotUrls: string[] = [];

    // 2. Upload each image to the listing-images bucket
    const imageEntries = Array.from(formData.entries()).filter(([key]) => key.startsWith("screenshots_"));
    // Also check for "screenshots" key (single or multiple)
    const imageFiles = formData.getAll("screenshots").filter((f): f is File => f instanceof File && f.size > 0);

    const allImageFiles = [
      ...imageEntries.map(([_, v]) => v).filter((v): v is File => v instanceof File && v.size > 0),
      ...imageFiles,
    ];

    for (const file of allImageFiles) {
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
      const fileName = `${userId}/${crypto.randomUUID()}.${ext}`;

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("listing-images")
        .upload(fileName, file, {
          contentType: file.type,
          upsert: false,
        });

      if (uploadError) {
        console.error("Image upload error:", uploadError);
        return { success: false, code: "UPLOAD_ERROR", message: `Failed to upload "${file.name}": ${uploadError.message}` };
      }

      // Get the public URL
      const { data: { publicUrl } } = supabase.storage
        .from("listing-images")
        .getPublicUrl(fileName);

      screenshotUrls.push(publicUrl);
    }

    // 3. Create the listing
    const { data: listing, error: insertError } = await supabase
      .from("listings")
      .insert({
        seller_id: userId,
        game: validationResult.data.game,
        item_type: validationResult.data.item_type,
        title: validationResult.data.title,
        description: validationResult.data.description ?? null,
        price_bdt: validationResult.data.price_bdt,
        screenshots: screenshotUrls.length > 0 ? screenshotUrls : null,
        status: "active",
      })
      .select("id")
      .single();

    if (insertError) {
      console.error("Listing create error:", insertError);
      return { success: false, code: "DATABASE_ERROR", message: "Failed to create listing" };
    }

    revalidatePath("/marketplace");
    redirect(`/marketplace/${listing.id}`);
  } catch (err) {
    if (err instanceof Error && err.message === "AUTH_REQUIRED") {
      return { success: false, code: "AUTH_REQUIRED", message: "Authentication required" };
    }
    // If it's a redirect, rethrow it (Next.js uses redirect internally)
    if (err instanceof Error && (err as any).digest?.startsWith("NEXT_REDIRECT")) {
      throw err;
    }
    console.error("Unexpected error creating listing:", err);
    return { success: false, code: "ERROR", message: "An unexpected error occurred" };
  }
}