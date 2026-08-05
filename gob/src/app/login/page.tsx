"use client";

import { useState } from "react";
import Link from "next/link";
import { signIn } from "@/lib/actions/auth";

export default function LoginPage() {
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    const formData = new FormData(e.currentTarget);
    const result = await signIn(formData);
    if (!result.success) { setError(result.message); setIsLoading(false); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <div className="text-4xl mb-2">🎮</div>
          <h1 className="text-2xl font-bold text-text-primary font-display">Welcome to GOB</h1>
          <p className="text-sm text-text-secondary mt-1">Sign in to your account</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-dark-surface border border-dark-border rounded-xl p-6 space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-text-secondary mb-1">Email</label>
            <input id="email" name="email" type="email" required autoComplete="email" placeholder="you@example.com"
              className="w-full rounded-lg border border-dark-border-light px-3 py-2 text-sm bg-dark-surface text-text-primary placeholder-text-muted focus:border-primary focus:ring-1 focus:ring-primary" />
          </div>
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-text-secondary mb-1">Password</label>
            <input id="password" name="password" type="password" required autoComplete="current-password" placeholder="••••••••"
              className="w-full rounded-lg border border-dark-border-light px-3 py-2 text-sm bg-dark-surface text-text-primary placeholder-text-muted focus:border-primary focus:ring-1 focus:ring-primary" />
          </div>
          {error && <div className="text-sm text-red-300 bg-red-950/50 border border-red-900/50 rounded-lg p-3">{error}</div>}
          <button type="submit" disabled={isLoading} className="w-full btn-primary py-2.5">{isLoading ? "Signing in..." : "Sign In"}</button>
        </form>

        <p className="text-center text-sm text-text-muted">
          Don't have an account?{" "}
          <Link href="/signup" className="text-primary-light hover:text-primary font-medium">Sign up</Link>
        </p>
      </div>
    </div>
  );
}