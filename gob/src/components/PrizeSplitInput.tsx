"use client";

import { useState, useCallback } from "react";

interface PrizeEntry {
  id: string;
  label: string;
  percent: number;
}

interface PrizeSplitInputProps {
  value: PrizeEntry[];
  onChange: (entries: PrizeEntry[]) => void;
}

const LABEL_SUGGESTIONS = ["1st", "2nd", "3rd", "4th", "5th", "6th", "7th", "8th"];

export function PrizeSplitInput({ value, onChange }: PrizeSplitInputProps) {
  const [localEntries, setLocalEntries] = useState<PrizeEntry[]>(
    value.length > 0
      ? value
      : [
          { id: "init-1", label: "1st", percent: 70 },
          { id: "init-2", label: "2nd", percent: 30 },
        ]
  );

  const total = localEntries.reduce((sum, e) => sum + e.percent, 0);
  const isValid = Math.abs(total - 100) < 0.01 && localEntries.length > 0;

  const updateEntries = useCallback(
    (entries: PrizeEntry[]) => {
      setLocalEntries(entries);
      onChange(entries);
    },
    [onChange]
  );

  const addEntry = () => {
    const usedLabels = localEntries.map((e) => e.label);
    const nextLabel = LABEL_SUGGESTIONS.find((l) => !usedLabels.includes(l)) ?? `${localEntries.length + 1}th`;
    updateEntries([...localEntries, { id: crypto.randomUUID(), label: nextLabel, percent: 0 }]);
  };

  const removeEntry = (id: string) => {
    if (localEntries.length <= 2) return; // Keep at least 2 placements
    updateEntries(localEntries.filter((e) => e.id !== id));
  };

  const updateEntry = (id: string, field: "label" | "percent", val: string | number) => {
    updateEntries(
      localEntries.map((e) =>
        e.id === id
          ? { ...e, [field]: field === "percent" ? Math.max(0, Math.min(100, Number(val))) : String(val) }
          : e
      )
    );
  };

  return (
    <div className="space-y-2">
      <p className="text-xs text-text-muted">
        Prize split determines how the prize pool is distributed. Must sum to exactly 100%.
      </p>

      <div className="space-y-2">
        {localEntries.map((entry, idx) => (
          <div key={entry.id} className="flex items-center gap-2">
            <span className="text-xs text-text-muted w-5 shrink-0">#{idx + 1}</span>
            <input
              type="text"
              value={entry.label}
              onChange={(e) => updateEntry(entry.id, "label", e.target.value)}
              placeholder="Placement"
              className="w-20 rounded-lg border border-dark-border-light px-2 py-1.5 text-sm bg-dark-surface text-text-primary placeholder-text-muted focus:border-primary focus:ring-1 focus:ring-primary"
            />
            <div className="relative flex-1">
              <input
                type="number"
                value={entry.percent || ""}
                onChange={(e) => updateEntry(entry.id, "percent", e.target.value === "" ? 0 : parseFloat(e.target.value))}
                min={0}
                max={100}
                step={0.1}
                placeholder="%"
                className="w-full rounded-lg border border-dark-border-light pl-3 pr-7 py-1.5 text-sm bg-dark-surface text-text-primary placeholder-text-muted focus:border-primary focus:ring-1 focus:ring-primary"
              />
              <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted text-xs">%</span>
            </div>
            {localEntries.length > 2 && (
              <button
                type="button"
                onClick={() => removeEntry(entry.id)}
                className="text-red-400 hover:text-red-300 p-1 shrink-0"
                aria-label="Remove placement"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between gap-2">
        <button type="button" onClick={addEntry} className="text-xs text-primary-light hover:text-primary font-medium">
          + Add placement
        </button>
        <div className="flex items-center gap-1.5">
          <div
            className={`h-1.5 w-24 rounded-full ${
              Math.abs(total - 100) < 0.01 ? "bg-success" : total > 100 ? "bg-red-500" : "bg-amber-500"
            }`}
          />
          <span
            className={`text-xs font-medium ${
              Math.abs(total - 100) < 0.01
                ? "text-success"
                : total > 100
                ? "text-red-300"
                : "text-amber-300"
            }`}
          >
            {total.toFixed(1)}%
          </span>
        </div>
      </div>

      {!isValid && localEntries.length > 0 && (
        <p className="text-xs text-red-300">
          Prize split must sum to exactly 100% (currently {total.toFixed(1)}%)
        </p>
      )}
    </div>
  );
}

export type { PrizeEntry };