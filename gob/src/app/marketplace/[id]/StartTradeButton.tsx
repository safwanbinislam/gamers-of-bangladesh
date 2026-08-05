"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { initiateTrade } from "@/lib/actions/trades";

interface StartTradeButtonProps {
  listingId: string;
}

export function StartTradeButton({ listingId }: StartTradeButtonProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClick = async () => {
    setIsLoading(true);
    setError(null);
    const result = await initiateTrade(listingId);
    if (result.success) {
      router.push(`/trades/${result.data}`);
    } else {
      setError(result.message ?? "Something went wrong.");
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-2">
      <button onClick={handleClick} disabled={isLoading} className="w-full btn-primary py-3 text-lg font-bold">
        {isLoading ? "Starting Trade..." : "Start Trade"}
      </button>
      {error && <p className="text-sm text-red-300 text-center">{error}</p>}
    </div>
  );
}