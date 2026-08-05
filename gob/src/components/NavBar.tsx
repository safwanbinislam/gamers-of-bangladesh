import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { NotificationBell } from "./NotificationBell";

export async function NavBar() {
  let userId: string | null = null;

  try {
    const supabase = await createServerSupabaseClient();
    const { data: { session } } = await supabase.auth.getSession();
    userId = session?.user?.id ?? null;
  } catch {
    // No session available
  }

  return (
    <nav className="sticky top-0 z-30 bg-dark-surface border-b border-dark-border">
      <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
        {/* Logo */}
        <Link href={userId ? "/marketplace" : "/login"} className="flex items-center gap-2 font-bold text-lg text-primary font-display">
          <span>🎮</span>
          <span className="hidden sm:inline">GOB</span>
          <span className="hidden sm:inline text-xs text-text-muted font-normal">Gamers of Bangladesh</span>
        </Link>

        {/* Nav links */}
        <div className="flex items-center gap-1 sm:gap-2">
          {userId ? (
            <>
              <NavLink href="/" label="Home" />
              <NavLink href="/marketplace" label="Marketplace" />
              <NavLink href="/tournaments" label="Tournaments" />
              <NavLink href="/trades" label="Trades" />
              <NavLink href="/squads" label="Squads" />
              <NavLink href={`/players/${userId}`} label="My Passport" />
              <Link
                href="/marketplace/create"
                className="btn-primary text-sm px-3 py-1.5"
              >
                + Sell
              </Link>
              <NotificationBell currentUserId={userId} />
              <form action="/api/auth/signout" method="POST" className="inline">
                <button
                  type="submit"
                  className="px-3 py-1.5 text-sm font-medium text-text-muted hover:text-text-primary hover:bg-dark-surface-2 rounded-lg transition-colors"
                >
                  Sign Out
                </button>
              </form>
            </>
          ) : (
            <>
              <NavLink href="/login" label="Sign In" />
              <Link
                href="/signup"
                className="btn-primary text-sm px-4 py-1.5"
              >
                Sign Up
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}

function NavLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="px-3 py-1.5 text-sm font-medium text-text-secondary hover:text-text-primary hover:bg-dark-surface-2 rounded-lg transition-colors"
    >
      {label}
    </Link>
  );
}
