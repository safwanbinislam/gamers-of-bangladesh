import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Middleware that protects /api/trades, /api/disputes, and /api/admin routes.
 * Checks for a valid Supabase session and returns 401 JSON if missing.
 */
export async function middleware(request: NextRequest) {
  // Skip auth check for webhooks — they use signature verification instead
  if (request.nextUrl.pathname.startsWith("/api/webhooks")) {
    return NextResponse.next();
  }

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isProtectedRoute =
    request.nextUrl.pathname.startsWith("/api/trades") ||
    request.nextUrl.pathname.startsWith("/api/disputes") ||
    request.nextUrl.pathname.startsWith("/api/admin");

  if (isProtectedRoute && !user) {
    return NextResponse.json(
      {
        success: false,
        code: "AUTH_REQUIRED",
        message: "Authentication is required to access this resource",
      },
      { status: 401 }
    );
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/api/trades/:path*",
    "/api/disputes/:path*",
    "/api/admin/:path*",
    "/api/webhooks/:path*",
  ],
};