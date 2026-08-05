"use client";

import Link from "next/link";
import { formatBDT, getGameLabel, getTournamentStatusLabel, getTournamentStatusColor } from "@/lib/utils";

interface TournamentCardProps {
  tournament: {
    id: string;
    title: string;
    game: string;
    status: string;
    entry_fee_bdt: number;
    starts_at: string;
    max_participants: number;
    prize_split: Record<string, number> | null;
    registered_count?: number;
    paid_count?: number;
  };
}

export function TournamentCard({ tournament }: TournamentCardProps) {
  const statusColor = getTournamentStatusColor(tournament.status);
  const registeredCount = tournament.registered_count ?? 0;
  const spotsLeft = tournament.max_participants - registeredCount;
  const startDate = new Date(tournament.starts_at);
  const isRegistrationOpen = tournament.status === "registration_open";
  const isFull = spotsLeft <= 0 && isRegistrationOpen;

  return (
    <Link
      href={`/tournaments/${tournament.id}`}
      className="block bg-dark-surface border border-dark-border rounded-xl overflow-hidden hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5 transition-all"
    >
      <div className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-semibold text-sm leading-tight line-clamp-2 text-text-primary flex-1">
            {tournament.title}
          </h3>
          <span className={`shrink-0 text-xs px-2 py-0.5 rounded-full font-medium ${statusColor.bg} ${statusColor.text}`}>
            {getTournamentStatusLabel(tournament.status)}
          </span>
        </div>

        <div className="flex items-center gap-2 text-xs text-text-muted">
          <span className="bg-dark-surface-2 px-2 py-0.5 rounded text-text-secondary">
            {getGameLabel(tournament.game)}
          </span>
          <span className="text-text-muted">·</span>
          <span className="text-text-secondary">{formatBDT(tournament.entry_fee_bdt)} entry</span>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-text-muted">Participants</span>
            <span className="text-text-secondary font-medium">
              {registeredCount} / {tournament.max_participants}
            </span>
          </div>
          <div className="w-full bg-dark-surface-2 rounded-full h-1.5 overflow-hidden">
            <div
              className="bg-primary h-full rounded-full transition-all"
              style={{ width: `${Math.min(100, (registeredCount / tournament.max_participants) * 100)}%` }}
            />
          </div>
          {isRegistrationOpen && (
            <p className="text-xs text-text-muted">
              {isFull ? "Tournament is full" : `${spotsLeft} spot${spotsLeft !== 1 ? "s" : ""} left`}
            </p>
          )}
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-dark-border">
          <div className="text-xs text-text-muted">
            <span className="text-text-secondary font-medium">Starts:</span>{" "}
            {startDate.toLocaleDateString("en-BD", {
              month: "short",
              day: "numeric",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </div>
          {tournament.prize_split && Object.keys(tournament.prize_split).length > 0 && (
            <div className="text-xs text-amber-400 font-medium">🏆 Prize pool</div>
          )}
        </div>
      </div>
    </Link>
  );
}