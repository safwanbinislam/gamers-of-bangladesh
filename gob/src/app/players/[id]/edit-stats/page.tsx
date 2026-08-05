import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { getPlayerPassport } from "@/lib/actions/passport";
import { requireAuthUserId } from "@/lib/supabase/server";
import { EditStatsClient } from "./EditStatsClient";
import type { PlayerPassport } from "@/lib/passport/types";

export default async function EditStatsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  // Server-side ownership check: only the authenticated owner may edit.
  let currentUserId: string;
  try {
    currentUserId = await requireAuthUserId();
  } catch {
    redirect("/login");
  }

  if (currentUserId !== id) {
    redirect(`/players/${id}`);
  }

  const result = await getPlayerPassport(id);
  if (!result.success) {
    notFound();
  }

  const passport = result.data as unknown as PlayerPassport;

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      <Link
        href={`/players/${id}`}
        className="inline-flex items-center text-sm text-text-secondary hover:text-text-primary"
      >
        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back to My Passport
      </Link>

      <div>
        <h1 className="text-2xl font-bold text-text-primary font-display">Edit My Stats</h1>
        <p className="text-sm text-text-secondary mt-1">
          Add or update your self-reported in-game stats. These are shown on your public passport.
        </p>
      </div>

      <EditStatsClient playerId={id} gameStats={passport.game_stats} />
    </div>
  );
}