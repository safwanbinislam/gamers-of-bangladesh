"use client";

import { useState } from "react";
import { upsertSquadPreferences } from "@/lib/actions/squadFinder";
import { showToast } from "@/components/Toast";

const WEEKDAYS = [
  { value: "sunday", label: "Sun" },
  { value: "monday", label: "Mon" },
  { value: "tuesday", label: "Tue" },
  { value: "wednesday", label: "Wed" },
  { value: "thursday", label: "Thu" },
  { value: "friday", label: "Fri" },
  { value: "saturday", label: "Sat" },
];

interface SquadPreferencesFormProps {
  game: string;
  existing: {
    rank_or_level: string | null;
    preferred_squad_size: number;
    playtime_days: string[];
    playtime_start_hour: number | null;
    playtime_end_hour: number | null;
    region: string | null;
    looking_for_note: string | null;
    is_active: boolean;
  } | null;
}

export function SquadPreferencesForm({ game, existing }: SquadPreferencesFormProps) {
  const [rankOrLevel, setRankOrLevel] = useState(existing?.rank_or_level ?? "");
  const [squadSize, setSquadSize] = useState(existing?.preferred_squad_size ?? 4);
  const [days, setDays] = useState<string[]>(existing?.playtime_days ?? []);
  const [startHour, setStartHour] = useState(existing?.playtime_start_hour != null ? String(existing.playtime_start_hour) : "");
  const [endHour, setEndHour] = useState(existing?.playtime_end_hour != null ? String(existing.playtime_end_hour) : "");
  const [region, setRegion] = useState(existing?.region ?? "");
  const [note, setNote] = useState(existing?.looking_for_note ?? "");
  const [isActive, setIsActive] = useState(existing?.is_active ?? true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  const toggleDay = (day: string) => {
    setDays((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]));
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    setFieldErrors({});

    const result = await upsertSquadPreferences({
      game,
      rank_or_level: rankOrLevel.trim() === "" ? null : rankOrLevel,
      preferred_squad_size: squadSize,
      playtime_days: days,
      playtime_start_hour: startHour === "" ? null : parseInt(startHour, 10),
      playtime_end_hour: endHour === "" ? null : parseInt(endHour, 10),
      region: region.trim() === "" ? null : region,
      looking_for_note: note.trim() === "" ? null : note,
      is_active: isActive,
    });

    setIsSubmitting(false);

    if (result.success) {
      showToast("success", "Squad preferences saved");
    } else {
      if (result.fieldErrors) setFieldErrors(result.fieldErrors);
      showToast("error", result.message ?? "Failed to save preferences");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-dark-surface border border-dark-border rounded-xl p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-text-primary">Your Preferences</h3>
        <span className="text-[10px] font-medium text-amber-300 bg-amber-900/30 border border-amber-700/40 px-2 py-0.5 rounded-full">
          Self-Reported — Not Verified
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="rank" className="block text-sm font-medium text-text-secondary mb-1">Rank / Level</label>
          <input
            id="rank"
            type="text"
            value={rankOrLevel}
            onChange={(e) => setRankOrLevel(e.target.value)}
            maxLength={50}
            placeholder="e.g. Heroic, Ace, Mythic"
            className="w-full rounded-lg border border-dark-border-light px-3 py-2 text-sm bg-dark-surface text-text-primary placeholder-text-muted focus:border-primary focus:ring-1 focus:ring-primary"
          />
          {fieldErrors.rank_or_level?.map((e) => <p key={e} className="text-sm text-red-300 mt-1">{e}</p>)}
        </div>

        <div>
          <label htmlFor="squad_size" className="block text-sm font-medium text-text-secondary mb-1">Squad Size</label>
          <select
            id="squad_size"
            value={squadSize}
            onChange={(e) => setSquadSize(parseInt(e.target.value, 10))}
            className="w-full rounded-lg border border-dark-border-light px-3 py-2 text-sm bg-dark-surface text-text-primary focus:border-primary focus:ring-1 focus:ring-primary"
          >
            {[2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
              <option key={n} value={n}>{n} players</option>
            ))}
          </select>
          {fieldErrors.preferred_squad_size?.map((e) => <p key={e} className="text-sm text-red-300 mt-1">{e}</p>)}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-text-secondary mb-1">Playtime Days</label>
        <div className="flex flex-wrap gap-1.5">
          {WEEKDAYS.map((d) => {
            const active = days.includes(d.value);
            return (
              <button
                key={d.value}
                type="button"
                onClick={() => toggleDay(d.value)}
                aria-pressed={active}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                  active ? "bg-primary text-white border-primary" : "bg-dark-surface-2 text-text-secondary border-dark-border-light hover:border-primary/40"
                }`}
              >
                {d.label}
              </button>
            );
          })}
        </div>
        {fieldErrors.playtime_days?.map((e) => <p key={e} className="text-sm text-red-300 mt-1">{e}</p>)}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="start_hour" className="block text-sm font-medium text-text-secondary mb-1">Start Hour (0–23)</label>
          <input
            id="start_hour"
            type="number"
            min="0"
            max="23"
            value={startHour}
            onChange={(e) => setStartHour(e.target.value)}
            placeholder="e.g. 18"
            className="w-full rounded-lg border border-dark-border-light px-3 py-2 text-sm bg-dark-surface text-text-primary placeholder-text-muted focus:border-primary focus:ring-1 focus:ring-primary"
          />
        </div>
        <div>
          <label htmlFor="end_hour" className="block text-sm font-medium text-text-secondary mb-1">End Hour (0–23)</label>
          <input
            id="end_hour"
            type="number"
            min="0"
            max="23"
            value={endHour}
            onChange={(e) => setEndHour(e.target.value)}
            placeholder="e.g. 22"
            className="w-full rounded-lg border border-dark-border-light px-3 py-2 text-sm bg-dark-surface text-text-primary placeholder-text-muted focus:border-primary focus:ring-1 focus:ring-primary"
          />
        </div>
      </div>
      {fieldErrors.playtime_end_hour?.map((e) => <p key={e} className="text-sm text-red-300">{e}</p>)}

      <div>
        <label htmlFor="region" className="block text-sm font-medium text-text-secondary mb-1">Region</label>
        <input
          id="region"
          type="text"
          value={region}
          onChange={(e) => setRegion(e.target.value)}
          maxLength={50}
          placeholder="e.g. Dhaka, Chattogram"
          className="w-full rounded-lg border border-dark-border-light px-3 py-2 text-sm bg-dark-surface text-text-primary placeholder-text-muted focus:border-primary focus:ring-1 focus:ring-primary"
        />
        {fieldErrors.region?.map((e) => <p key={e} className="text-sm text-red-300 mt-1">{e}</p>)}
      </div>

      <div>
        <label htmlFor="note" className="block text-sm font-medium text-text-secondary mb-1">Looking For</label>
        <textarea
          id="note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={200}
          rows={2}
          placeholder="e.g. Casual squads, ranked push, mic preferred"
          className="w-full rounded-lg border border-dark-border-light px-3 py-2 text-sm bg-dark-surface text-text-primary placeholder-text-muted focus:border-primary focus:ring-1 focus:ring-primary"
        />
        {fieldErrors.looking_for_note?.map((e) => <p key={e} className="text-sm text-red-300 mt-1">{e}</p>)}
      </div>

      <label className="flex items-center gap-2 text-sm text-text-secondary cursor-pointer">
        <input
          type="checkbox"
          checked={isActive}
          onChange={(e) => setIsActive(e.target.checked)}
          className="w-4 h-4 rounded border-dark-border-light"
        />
        Show me in match results
      </label>

      <button type="submit" disabled={isSubmitting} className="w-full btn-primary py-2.5">
        {isSubmitting ? "Saving..." : "Save Preferences"}
      </button>
    </form>
  );
}