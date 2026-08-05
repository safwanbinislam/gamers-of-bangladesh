"use server";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function signUp(formData: FormData) {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const username = formData.get("username") as string;

  if (!email || !password || !username) {
    return { success: false, message: "All fields are required." };
  }

  if (password.length < 6) {
    return { success: false, message: "Password must be at least 6 characters." };
  }

  const supabase = await createServerSupabaseClient();

  // Sign up with Supabase Auth. The profile row is created automatically by the
  // public.handle_new_user() trigger on auth.users (see
  // supabase/migrations/20260805202000_handle_new_user_trigger.sql) — no manual
  // insert needed here. If the username violates the unique constraint, the
  // whole signup fails atomically (no orphaned auth user without a profile).
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { username },
    },
  });

  if (authError) {
    return { success: false, message: authError.message };
  }

  if (!authData.user?.id) {
    return { success: false, message: "Failed to create account." };
  }

  // The session may already be set if email confirmation is disabled.
  // Try to get the session and redirect to marketplace.
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (session) {
    revalidatePath("/marketplace");
    redirect("/marketplace");
  }

  return { success: true, message: "Account created! Check your email to confirm your account." };
}

export async function signIn(formData: FormData) {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  if (!email || !password) {
    return { success: false, message: "Email and password are required." };
  }

  const supabase = await createServerSupabaseClient();

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return { success: false, message: error.message };
  }

  const userId = data.user?.id;
  if (!userId) {
    return { success: false, message: "Failed to sign in." };
  }

  // Verify a profile row exists for this user. Orphaned auth users (created
  // before the handle_new_user trigger shipped) have no profile; auto-create
  // one here so the user never lands in a broken state. Idempotent + race-safe:
  // ignoreDuplicates maps to INSERT ... ON CONFLICT (id) DO NOTHING, so an
  // existing profile is never touched.
  const { data: existingProfile } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", userId)
    .maybeSingle();

  if (!existingProfile) {
    const metadata = data.user.user_metadata as Record<string, unknown> | undefined;
    const metadataUsername =
      typeof metadata?.username === "string" && metadata.username.trim() !== ""
        ? metadata.username.trim()
        : null;

    const { error: profileError } = await supabase
      .from("profiles")
      .upsert(
        {
          id: userId,
          username: metadataUsername ?? `player_${userId.replace(/-/g, "")}`,
        },
        { onConflict: "id", ignoreDuplicates: true }
      );

    if (profileError) {
      console.error("Profile auto-creation error:", profileError);
      return {
        success: false,
        message: "Failed to verify your account. Please try again.",
      };
    }
  }

  revalidatePath("/marketplace");
  redirect("/marketplace");
}

export async function signOut() {
  const supabase = await createServerSupabaseClient();
  await supabase.auth.signOut();
  revalidatePath("/");
  redirect("/login");
}