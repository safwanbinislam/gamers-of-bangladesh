import { Suspense } from "react";
import Link from "next/link";
import { createServerSupabaseClient, requireAuthUserId } from "@/lib/supabase/server";
import { ListingFilters } from "@/components/ListingFilters";
import { ListingCard } from "@/components/ListingCard";

async function ListingsGrid({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const supabase = await createServerSupabaseClient();
  const currentUserId = await requireAuthUserId();
  const params = await searchParams;

  const game = params.game;
  const itemType = params.item_type;
  const minPrice = params.min_price;
  const maxPrice = params.max_price;
  const page = parseInt(params.page ?? "1", 10);
  const perPage = 20;

  let query = supabase
    .from("listings")
    .select(
      `*, seller:profiles!listings_seller_id_fkey (id, username, avatar_url, reputation_score, total_trades)`,
      { count: "exact" }
    )
    .eq("status", "active")
    .order("created_at", { ascending: false });

  if (game) query = query.eq("game", game as "free_fire" | "pubg_mobile" | "mobile_legends" | "other");
  if (itemType) query = query.eq("item_type", itemType as "account" | "skin" | "uc" | "diamonds" | "other");
  if (minPrice) query = query.gte("price_bdt", parseFloat(minPrice));
  if (maxPrice) query = query.lte("price_bdt", parseFloat(maxPrice));

  const from = (page - 1) * perPage;
  const to = from + perPage - 1;

  const { data: listings, count } = await query.range(from, to);

  if (!listings || listings.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-5xl mb-4">📦</div>
        <h3 className="font-semibold text-text-primary text-lg">No listings found</h3>
        <p className="text-text-muted text-sm mt-1">No listings match your filters. Try adjusting them.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {listings.map((listing) => (
          <ListingCard key={listing.id} listing={listing as unknown as Parameters<typeof ListingCard>[0]["listing"]} />
        ))}
      </div>

      {count && count > perPage && (
        <div className="flex justify-center gap-2 pt-4">
          {page > 1 && (
            <a href={`/marketplace?${new URLSearchParams({ ...params, page: String(page - 1) })}`}
               className="btn-ghost text-sm px-4 py-2">
              Previous
            </a>
          )}
          {count > page * perPage && (
            <a href={`/marketplace?${new URLSearchParams({ ...params, page: String(page + 1) })}`}
               className="btn-ghost text-sm px-4 py-2">
              Next
            </a>
          )}
        </div>
      )}
    </div>
  );
}

function ListingsGridSkeleton() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="bg-dark-surface border border-dark-border rounded-xl overflow-hidden animate-pulse">
          <div className="aspect-[16/9] bg-dark-surface-2" />
          <div className="p-3 space-y-2">
            <div className="h-4 bg-dark-surface-2 rounded w-3/4" />
            <div className="h-5 bg-dark-surface-2 rounded w-1/2" />
            <div className="h-3 bg-dark-surface-2 rounded w-1/3" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default async function MarketplacePage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary font-display">Marketplace</h1>
          <p className="text-sm text-text-secondary mt-1">Browse and trade in-game items safely with escrow</p>
        </div>
        <Link href="/marketplace/create" className="btn-primary shrink-0 inline-flex items-center gap-1.5 px-4 py-2 text-sm">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Sell an Item
        </Link>
      </div>

      <Suspense fallback={<div className="bg-dark-surface border border-dark-border rounded-xl p-4 h-32 animate-pulse" />}>
        <ListingFilters />
      </Suspense>

      <Suspense fallback={<ListingsGridSkeleton />}>
        <ListingsGrid searchParams={searchParams} />
      </Suspense>
    </div>
  );
}