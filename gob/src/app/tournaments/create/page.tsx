"use client";

import { useState } from "react";
import Link from "next/link";
import { createTournament } from "@/lib/actions/tournaments";
import { PrizeSplitInput, type PrizeEntry } from "@/components/PrizeSplitInput";

const GAMES = [
  { value: "free_fire", label: "Free Fire" },
  { value: "pubg_mobile", label: "PUBG Mobile" },
  { value: "mobile_legends", label: "Mobile Legends" },
  { value: "other", label: "Other" },
];

export default function CreateTournamentPage() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [prizeEntries, setPrizeEntries] = useState<PrizeEntry[]>([
    { id: "init-1", label: "1st", percent: 70 },
    { id: "init-2", label: "2nd", percent: 30 },
  ]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    setFieldErrors({});

    const formData = new FormData(e.currentTarget);

    // Append prize split fields
    prizeEntries.forEach((entry) => {
      formData.append(`prize_split_${entry.label}`, String(entry.percent));
    });

    const result = await createTournament(formData);
    if (!result.success) {
      setIsSubmitting(false);
      setError(result.message);
      if (result.fieldErrors) setFieldErrors(result.fieldErrors);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      <Link href="/tournaments" className="inline-flex items-center text-sm text-text-secondary hover:text-text-primary">
        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back to Tournaments
      </Link>

      <div>
        <h1 className="text-2xl font-bold text-text-primary font-display">Create Tournament</h1>
        <p className="text-sm text-text-secondary mt-1">Set up a new tournament for players to join</p>
      </div>

      <form onSubmit={handleSubmit} className="bg-dark-surface border border-dark-border rounded-xl p-6 space-y-5">
        {/* Game */}
        <div>
          <label htmlFor="game" className="block text-sm font-medium text-text-secondary mb-1">Game <span className="text-red-400">*</span></label>
          <select id="game" name="game" required className="w-full rounded-lg border border-dark-border-light px-3 py-2 text-sm bg-dark-surface text-text-primary focus:border-primary focus:ring-1 focus:ring-primary">
            <option value="" disabled>Select a game</option>
            {GAMES.map((g) => <option key={g.value} value={g.value}>{g.label}</option>)}
          </select>
          {fieldErrors.game?.map((e) => <p key={e} className="text-sm text-red-300 mt-1">{e}</p>)}
        </div>

        {/* Title */}
        <div>
          <label htmlFor="title" className="block text-sm font-medium text-text-secondary mb-1">Title <span className="text-red-400">*</span></label>
          <input id="title" name="title" type="text" required minLength={3} maxLength={120} placeholder="e.g. Free Fire Pro League Season 5" className="w-full rounded-lg border border-dark-border-light px-3 py-2 text-sm bg-dark-surface text-text-primary placeholder-text-muted focus:border-primary focus:ring-1 focus:ring-primary" />
          {fieldErrors.title?.map((e) => <p key={e} className="text-sm text-red-300 mt-1">{e}</p>)}
        </div>

        {/* Rules */}
        <div>
          <label htmlFor="rules" className="block text-sm font-medium text-text-secondary mb-1">Rules</label>
          <textarea id="rules" name="rules" rows={4} maxLength={5000} placeholder="Tournament rules, format, restrictions..." className="w-full rounded-lg border border-dark-border-light px-3 py-2 text-sm bg-dark-surface text-text-primary placeholder-text-muted focus:border-primary focus:ring-1 focus:ring-primary" />
          {fieldErrors.rules?.map((e) => <p key={e} className="text-sm text-red-300 mt-1">{e}</p>)}
        </div>

        {/* Entry Fee + Max Participants */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="entry_fee_bdt" className="block text-sm font-medium text-text-secondary mb-1">Entry Fee (BDT) <span className="text-red-400">*</span></label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted text-sm font-medium">৳</span>
              <input id="entry_fee_bdt" name="entry_fee_bdt" type="number" required min={0} max={999999} step={1} placeholder="500" className="w-full rounded-lg border border-dark-border-light pl-8 pr-3 py-2 text-sm bg-dark-surface text-text-primary placeholder-text-muted focus:border-primary focus:ring-1 focus:ring-primary" />
            </div>
            {fieldErrors.entry_fee_bdt?.map((e) => <p key={e} className="text-sm text-red-300 mt-1">{e}</p>)}
          </div>

          <div>
            <label htmlFor="max_participants" className="block text-sm font-medium text-text-secondary mb-1">Max Participants <span className="text-red-400">*</span></label>
            <input id="max_participants" name="max_participants" type="number" required min={2} max={1024} step={1} placeholder="64" className="w-full rounded-lg border border-dark-border-light px-3 py-2 text-sm bg-dark-surface text-text-primary placeholder-text-muted focus:border-primary focus:ring-1 focus:ring-primary" />
            {fieldErrors.max_participants?.map((e) => <p key={e} className="text-sm text-red-300 mt-1">{e}</p>)}
          </div>
        </div>

        {/* Start + Registration Close */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="starts_at" className="block text-sm font-medium text-text-secondary mb-1">Starts At <span className="text-red-400">*</span></label>
            <input id="starts_at" name="starts_at" type="datetime-local" required className="w-full rounded-lg border border-dark-border-light px-3 py-2 text-sm bg-dark-surface text-text-primary focus:border-primary focus:ring-1 focus:ring-primary" />
            {fieldErrors.starts_at?.map((e) => <p key={e} className="text-sm text-red-300 mt-1">{e}</p>)}
          </div>

          <div>
            <label htmlFor="registration_closes_at" className="block text-sm font-medium text-text-secondary mb-1">Registration Closes At</label>
            <input id="registration_closes_at" name="registration_closes_at" type="datetime-local" className="w-full rounded-lg border border-dark-border-light px-3 py-2 text-sm bg-dark-surface text-text-primary focus:border-primary focus:ring-1 focus:ring-primary" />
            {fieldErrors.registration_closes_at?.map((e) => <p key={e} className="text-sm text-red-300 mt-1">{e}</p>)}
          </div>
        </div>

        {/* Prize Split */}
        <div>
          <label className="block text-sm font-medium text-text-secondary mb-2">Prize Split (%) <span className="text-red-400">*</span></label>
          <PrizeSplitInput value={prizeEntries} onChange={setPrizeEntries} />
          {fieldErrors.prize_split?.map((e) => <p key={e} className="text-sm text-red-300 mt-1">{e}</p>)}
        </div>

        {/* Platform Fee */}
        <div>
          <label htmlFor="platform_fee_percent" className="block text-sm font-medium text-text-secondary mb-1">Platform Fee (%)</label>
          <input id="platform_fee_percent" name="platform_fee_percent" type="number" min={0} max={100} step={1} placeholder="0" className="w-full rounded-lg border border-dark-border-light px-3 py-2 text-sm bg-dark-surface text-text-primary placeholder-text-muted focus:border-primary focus:ring-1 focus:ring-primary" />
          {fieldErrors.platform_fee_percent?.map((e) => <p key={e} className="text-sm text-red-300 mt-1">{e}</p>)}
        </div>

        {error && <div className="text-sm text-red-300 bg-red-950/50 border border-red-900/50 rounded-lg p-3">{error}</div>}

        <button type="submit" disabled={isSubmitting} className="w-full btn-primary py-3">
          {isSubmitting ? "Creating Tournament..." : "Create Tournament"}
        </button>
      </form>
    </div>
  );
}