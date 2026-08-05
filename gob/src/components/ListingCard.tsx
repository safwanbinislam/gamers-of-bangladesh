"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatBDT, getGameLabel, getItemTypeLabel, getStatusColor, getStatusLabel } from "@/lib/utils";

interface ListingCardProps {
  listing: {
    id: string;
    title: string;
    price_bdt: number;
    game: string;
    item_type: string;
    status: string;
    screenshots: string[] | null;
    seller: {
      id: string;
      username: string;
      reputation_score: number;
      total_trades: number;
      avatar_url: string | null;
    } | null;
  };
}

export function ListingCard({ listing }: ListingCardProps) {
  const router = useRouter();
  const statusColor = getStatusColor(listing.status);
  const thumbnail = listing.screenshots?.[0] ?? null;

  const goToSeller = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (listing.seller) router.push(`/players/${listing.seller.id}`);
  };

  return (
    <Link
      href={`/marketplace/${listing.id}`}
      className="block bg-dark-surface border border-dark-border rounded-xl overflow-hidden hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5 transition-all"
    >
      {/* Thumbnail */}
      <div className="aspect-[16/9] bg-gradient-to-br from-dark-surface-2 to-dark-bg relative">
        {thumbnail ? (
          <img
            src={thumbnail}
            alt={listing.title}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="flex items-center justify-center h-full text-text-muted text-sm">
            No image
          </div>
        )}
        {/* Game badge */}
        <span className="absolute top-2 left-2 bg-black/70 text-text-secondary text-xs px-2 py-0.5 rounded-full">
          {getGameLabel(listing.game)}
        </span>
        {/* Status badge */}
        <span className={`absolute top-2 right-2 ${statusColor.bg} ${statusColor.text} text-xs px-2 py-0.5 rounded-full font-medium`}>
          {getStatusLabel(listing.status)}
        </span>
      </div>

      {/* Details */}
      <div className="p-3 space-y-2">
        <h3 className="font-semibold text-sm leading-tight line-clamp-2 text-text-primary">{listing.title}</h3>
        <p className="text-lg font-bold text-primary-light">{formatBDT(listing.price_bdt)}</p>
        <div className="flex items-center gap-2 text-xs text-text-muted">
          <span className="bg-dark-surface-2 px-2 py-0.5 rounded text-text-secondary">{getItemTypeLabel(listing.item_type)}</span>
          {listing.seller && (
            <span className="flex items-center gap-1">
              <span className="w-4 h-4 rounded-full bg-primary-subtle text-primary-light flex items-center justify-center text-[10px] font-bold">
                {listing.seller.username[0].toUpperCase()}
              </span>
              <span
                role="link"
                tabIndex={0}
                onClick={goToSeller}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    e.stopPropagation();
                    if (listing.seller) router.push(`/players/${listing.seller.id}`);
                  }
                }}
                className="truncate max-w-[80px] text-text-secondary hover:text-primary-light transition-colors cursor-pointer"
              >
                {listing.seller.username}
              </span>
              <span className="text-amber-400">★</span>
              <span className="text-text-muted">{listing.seller.reputation_score.toFixed(1)}</span>
              <span className="text-text-muted">({listing.seller.total_trades})</span>
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}