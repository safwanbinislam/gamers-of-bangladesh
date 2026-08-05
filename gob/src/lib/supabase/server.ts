import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "./types";

export async function createServerSupabaseClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing sessions.
          }
        },
      },
    }
  );
}

/**
 * Get the authenticated user's ID from the current session.
 * Returns null if no session exists.
 */
export async function getAuthUserId(): Promise<string | null> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session?.user?.id ?? null;
}

/**
 * Get the full authenticated user object from the current session.
 * Throws if no session exists.
 */
export async function requireAuthUserId(): Promise<string> {
  const userId = await getAuthUserId();
  if (!userId) {
    throw new Error("AUTH_REQUIRED");
  }
  return userId;
}

/**
 * Set the app.current_user_id Postgres session variable so the
 * trg_escrow_status_history trigger can record who made each status change.
 * MUST be called at the start of every route handler that writes to
 * escrow_transactions, disputes, or listings.
 */
export async function setCurrentUserId(supabase: ReturnType<typeof createServerClient<Database>>, userId: string) {
  await supabase.rpc("set_app_current_user_id").maybeSingle();
}
