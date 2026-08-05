import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { headers } from "next/headers";

/**
 * POST /api/auth/signout
 * Sign out the current user and redirect to login.
 */
export async function POST() {
  const supabase = await createServerSupabaseClient();
  await supabase.auth.signOut();

  const reqHeaders = await headers();
  const origin = reqHeaders.get("origin") ?? "http://localhost:3000";
  return NextResponse.redirect(new URL("/login", origin));
}
