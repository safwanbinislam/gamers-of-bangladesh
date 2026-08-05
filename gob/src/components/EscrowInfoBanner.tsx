"use client";

import { useState, useEffect } from "react";

export function EscrowInfoBanner() {
  const [isVisible, setIsVisible] = useState(false);
  useEffect(() => {
    const dismissed = localStorage.getItem("escrow-banner-dismissed");
    if (!dismissed) setIsVisible(true);
  }, []);

  const dismiss = () => {
    setIsVisible(false);
    localStorage.setItem("escrow-banner-dismissed", "true");
  };

  if (!isVisible) return null;

  return (
    <div className="bg-primary-subtle/30 border border-primary/30 rounded-xl p-4 relative">
      <button onClick={dismiss} className="absolute top-2 right-2 text-text-muted hover:text-text-primary" aria-label="Dismiss">
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
      <h3 className="font-semibold text-text-primary text-sm mb-2">🔒 How Escrow Works</h3>
      <ol className="text-sm text-text-secondary space-y-1.5 list-decimal list-inside">
        <li>You pay the amount — funds are held safely by us</li>
        <li>The seller delivers the item (account, skin, UC, etc.)</li>
        <li>You confirm you received it — funds are released to the seller</li>
        <li>If something goes wrong, open a dispute and an admin will help</li>
      </ol>
      <p className="text-xs text-text-muted mt-2">Funds are automatically released to the seller 48 hours after delivery if you don't confirm.</p>
    </div>
  );
}