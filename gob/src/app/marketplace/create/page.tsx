"use client";

import { useState } from "react";
import Link from "next/link";
import { ImageUploader } from "@/components/ImageUploader";
import { createListing } from "@/lib/actions/listings";

const GAMES = [
  { value: "", label: "Select a game" },
  { value: "free_fire", label: "Free Fire" },
  { value: "pubg_mobile", label: "PUBG Mobile" },
  { value: "mobile_legends", label: "Mobile Legends" },
  { value: "other", label: "Other" },
];

const ITEM_TYPES = [
  { value: "", label: "Select type" },
  { value: "account", label: "Account" },
  { value: "skin", label: "Skin" },
  { value: "uc", label: "UC" },
  { value: "diamonds", label: "Diamonds" },
  { value: "other", label: "Other" },
];

export default function CreateListingPage() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [screenshotFiles, setScreenshotFiles] = useState<File[]>([]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    setFieldErrors({});

    const formData = new FormData(e.currentTarget);
    for (const file of screenshotFiles) {
      formData.append("screenshots", file);
    }

    const result = await createListing(formData);
    if (!result.success) {
      setIsSubmitting(false);
      setError(result.message);
      if (result.fieldErrors) setFieldErrors(result.fieldErrors);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      <Link href="/marketplace" className="inline-flex items-center text-sm text-text-secondary hover:text-text-primary">
        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back to Marketplace
      </Link>

      <div>
        <h1 className="text-2xl font-bold text-text-primary font-display">Sell an Item</h1>
        <p className="text-sm text-text-secondary mt-1">Create a new listing to sell in-game items</p>
      </div>

      <form onSubmit={handleSubmit} className="bg-dark-surface border border-dark-border rounded-xl p-6 space-y-5">
        <div>
          <label htmlFor="game" className="block text-sm font-medium text-text-secondary mb-1">Game <span className="text-red-400">*</span></label>
          <select id="game" name="game" required defaultValue="" className="w-full rounded-lg border border-dark-border-light px-3 py-2 text-sm bg-dark-surface text-text-primary focus:border-primary focus:ring-1 focus:ring-primary">
            {GAMES.map((g) => <option key={g.value} value={g.value} disabled={g.value === ""}>{g.label}</option>)}
          </select>
          {fieldErrors.game?.map((e) => <p key={e} className="text-sm text-red-300 mt-1">{e}</p>)}
        </div>

        <div>
          <label htmlFor="item_type" className="block text-sm font-medium text-text-secondary mb-1">Item Type <span className="text-red-400">*</span></label>
          <select id="item_type" name="item_type" required defaultValue="" className="w-full rounded-lg border border-dark-border-light px-3 py-2 text-sm bg-dark-surface text-text-primary focus:border-primary focus:ring-1 focus:ring-primary">
            {ITEM_TYPES.map((t) => <option key={t.value} value={t.value} disabled={t.value === ""}>{t.label}</option>)}
          </select>
          {fieldErrors.item_type?.map((e) => <p key={e} className="text-sm text-red-300 mt-1">{e}</p>)}
        </div>

        <div>
          <label htmlFor="title" className="block text-sm font-medium text-text-secondary mb-1">Title <span className="text-red-400">*</span></label>
          <input id="title" name="title" type="text" required minLength={3} maxLength={120} placeholder="e.g. Maxed Free Fire account" className="w-full rounded-lg border border-dark-border-light px-3 py-2 text-sm bg-dark-surface text-text-primary placeholder-text-muted focus:border-primary focus:ring-1 focus:ring-primary" />
          {fieldErrors.title?.map((e) => <p key={e} className="text-sm text-red-300 mt-1">{e}</p>)}
        </div>

        <div>
          <label htmlFor="description" className="block text-sm font-medium text-text-secondary mb-1">Description</label>
          <textarea id="description" name="description" rows={4} maxLength={2000} placeholder="Describe what you're selling in detail." className="w-full rounded-lg border border-dark-border-light px-3 py-2 text-sm bg-dark-surface text-text-primary placeholder-text-muted focus:border-primary focus:ring-1 focus:ring-primary" />
        </div>

        <div>
          <label htmlFor="price_bdt" className="block text-sm font-medium text-text-secondary mb-1">Price (BDT) <span className="text-red-400">*</span></label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted text-sm font-medium">৳</span>
            <input id="price_bdt" name="price_bdt" type="number" required min={1} max={99999999} step={1} placeholder="1500" className="w-full rounded-lg border border-dark-border-light pl-8 pr-3 py-2 text-sm bg-dark-surface text-text-primary placeholder-text-muted focus:border-primary focus:ring-1 focus:ring-primary" />
          </div>
          {fieldErrors.price_bdt?.map((e) => <p key={e} className="text-sm text-red-300 mt-1">{e}</p>)}
        </div>

        <ImageUploader files={screenshotFiles} onChange={setScreenshotFiles} maxFiles={5} maxFileSizeMB={5} />

        {error && <div className="text-sm text-red-300 bg-red-950/50 border border-red-900/50 rounded-lg p-3">{error}</div>}

        <button type="submit" disabled={isSubmitting} className="w-full btn-primary py-3">
          {isSubmitting ? "Creating listing..." : "Create Listing"}
        </button>
      </form>
    </div>
  );
}