import { notFound } from "next/navigation";
import Link from "next/link";
import { createServerSupabaseClient, requireAuthUserId } from "@/lib/supabase/server";
import { formatBDT, getGameLabel, getItemTypeLabel } from "@/lib/utils";
import { StartTradeButton } from "./StartTradeButton";

export default async function ListingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = await requireAuthUserId();
  const supabase = await createServerSupabaseClient();

  const { data: listing, error } = await supabase
    .from("listings")
    .select("*, seller:profiles!listings_seller_id_fkey (id, username, avatar_url, reputation_score, total_trades, created_at, phone_verified)")
    .eq("id", id)
    .single();

  if (error || !listing) notFound();

  const isOwnListing = listing.seller_id === userId;
  const isAvailable = listing.status === "active";

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
      <Link href="/marketplace" className="inline-flex items-center text-sm text-text-secondary hover:text-text-primary">
        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back to Marketplace
      </Link>

      <div className="bg-dark-surface border border-dark-border rounded-xl overflow-hidden">
        {listing.screenshots && listing.screenshots.length > 0 ? (
          <div className="flex gap-2 overflow-x-auto p-2">
            {listing.screenshots.map((url: string, i: number) => (
              <img key={i} src={url} alt={`Screenshot ${i + 1}`} className="w-full h-64 object-cover rounded-lg shrink-0" />
            ))}
          </div>
        ) : (
          <div className="h-48 bg-gradient-to-br from-dark-surface-2 to-dark-bg flex items-center justify-center text-text-muted">No images provided</div>
        )}
      </div>

      <div className="bg-dark-surface border border-dark-border rounded-xl p-5 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-text-primary">{listing.title}</h1>
            <div className="flex gap-2 mt-2">
              <span className="bg-dark-surface-2 text-text-secondary text-xs px-2 py-0.5 rounded-full">{getGameLabel(listing.game)}</span>
              <span className="bg-dark-surface-2 text-text-secondary text-xs px-2 py-0.5 rounded-full">{getItemTypeLabel(listing.item_type)}</span>
            </div>
          </div>
          <span className="text-2xl font-bold text-primary-light whitespace-nowrap">{formatBDT(listing.price_bdt)}</span>
        </div>

        {listing.description && <p className="text-sm text-text-secondary whitespace-pre-wrap">{listing.description}</p>}

        {listing.seller && (
          <div className="border-t border-dark-border pt-4">
            <h3 className="text-xs font-medium text-text-muted uppercase tracking-wide mb-2">Seller</h3>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary-subtle text-primary-light flex items-center justify-center font-bold text-sm">
                {listing.seller.username[0].toUpperCase()}
              </div>
              <div>
                <p className="font-medium text-text-primary">{listing.seller.username}</p>
                <div className="flex items-center gap-2 text-xs text-text-muted">
                  <span className="text-amber-400">★</span>
                  <span>{listing.seller.reputation_score.toFixed(1)}</span>
                  <span>·</span>
                  <span>{listing.seller.total_trades} trades</span>
                  {listing.seller.phone_verified && <><span>·</span><span className="text-success">📱 Verified</span></>}
                </div>
              </div>
            </div>
          </div>
        )}

        {!isOwnListing && isAvailable && <StartTradeButton listingId={listing.id} />}
        {isOwnListing && <p className="text-sm text-text-muted text-center">This is your own listing</p>}
        {!isAvailable && <p className="text-sm text-amber-300 text-center">This listing is no longer available (status: {listing.status.replace(/_/g, " ")})</p>}
      </div>
    </div>
  );
}