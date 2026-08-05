import { Suspense } from "react";
import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { TournamentFilters } from "@/components/TournamentFilters";
import { TournamentCard } from "@/components/TournamentCard";

async function TournamentsGrid({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const supabase = await createServerSupabaseClient();
  const params = await searchParams;

  const game = params.game;
  const status = params.status;
  const page = parseInt(params.page ?? "1", 10);
  const perPage = 20;

  let query = supabase
    .from("tournaments")
    .select("*", { count: "exact" })
    .order("starts_at", { ascending: true });

  if (game) query = query.eq("game", game as "free_fire" | "pubg_mobile" | "mobile_legends" | "other");
  if (status) query = query.eq("status", status as "draft" | "registration_open" | "registration_closed" | "bracket_generated" | "in_progress" | "completed" | "cancelled");

  const from = (page - 1) * perPage;
  const to = from + perPage - 1;

  const { data: tournaments, count } = await query.range(from, to);

  if (!tournaments || tournaments.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-5xl mb-4">🏆</div>
        <h3 className="font-semibold text-text-primary text-lg">No tournaments found</h3>
        <p className="text-text-muted text-sm mt-1">No tournaments match your filters. Try adjusting them.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {tournaments.map((tournament) => (
          <TournamentCard key={tournament.id} tournament={tournament as any} />
        ))}
      </div>

      {count && count > perPage && (
        <div className="flex justify-center gap-2 pt-4">
          {page > 1 && (
            <a href={`/tournaments?${new URLSearchParams({ ...params, page: String(page - 1) })}`}
               className="btn-ghost text-sm px-4 py-2">
              Previous
            </a>
          )}
          {count > page * perPage && (
            <a href={`/tournaments?${new URLSearchParams({ ...params, page: String(page + 1) })}`}
               className="btn-ghost text-sm px-4 py-2">
              Next
            </a>
          )}
        </div>
      )}
    </div>
  );
}

function TournamentsGridSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="bg-dark-surface border border-dark-border rounded-xl overflow-hidden animate-pulse">
          <div className="p-4 space-y-3">
            <div className="h-4 bg-dark-surface-2 rounded w-3/4" />
            <div className="h-3 bg-dark-surface-2 rounded w-1/2" />
            <div className="h-2 bg-dark-surface-2 rounded w-full" />
            <div className="h-3 bg-dark-surface-2 rounded w-1/3" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default async function TournamentsPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary font-display">Tournaments</h1>
          <p className="text-sm text-text-secondary mt-1">Compete in esports tournaments and win prizes</p>
        </div>
        <Link href="/tournaments/create" className="btn-primary shrink-0 inline-flex items-center gap-1.5 px-4 py-2 text-sm">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Create Tournament
        </Link>
      </div>

      <Suspense fallback={<div className="bg-dark-surface border border-dark-border rounded-xl p-4 h-32 animate-pulse" />}>
        <TournamentFilters />
      </Suspense>

      <Suspense fallback={<TournamentsGridSkeleton />}>
        <TournamentsGrid searchParams={searchParams} />
      </Suspense>
    </div>
  );
}