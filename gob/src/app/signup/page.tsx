"use client";

import { useState } from "react";
import Link from "next/link";
import { signUp } from "@/lib/actions/auth";

export default function SignUpPage() {
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true); setError(null); setSuccess(null);
    const formData = new FormData(e.currentTarget);
    const password = formData.get("password") as string;
    const confirmPassword = formData.get("confirmPassword") as string;
    if (password !== confirmPassword) { setError("Passwords do not match."); setIsLoading(false); return; }
    const result = await signUp(formData);
    if (result.success) { setSuccess(result.message); } else { setError(result.message); }
    setIsLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <div className="text-4xl mb-2">🎮</div>
          <h1 className="text-2xl font-bold text-text-primary font-display">Create Account</h1>
          <p className="text-sm text-text-secondary mt-1">Join the GOB community</p>
        </div>

        {success && <div className="bg-emerald-950/50 border border-emerald-900/50 rounded-xl p-4 text-sm text-emerald-300 text-center">{success}</div>}

        {!success && (
          <form onSubmit={handleSubmit} className="bg-dark-surface border border-dark-border rounded-xl p-6 space-y-4">
            <div>
              <label htmlFor="username" className="block text-sm font-medium text-text-secondary mb-1">Username</label>
              <input id="username" name="username" type="text" required minLength={3} maxLength={30} placeholder="gamer123"
                className="w-full rounded-lg border border-dark-border-light px-3 py-2 text-sm bg-dark-surface text-text-primary placeholder-text-muted focus:border-primary focus:ring-1 focus:ring-primary" />
            </div>
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-text-secondary mb-1">Email</label>
              <input id="email" name="email" type="email" required autoComplete="email" placeholder="you@example.com"
                className="w-full rounded-lg border border-dark-border-light px-3 py-2 text-sm bg-dark-surface text-text-primary placeholder-text-muted focus:border-primary focus:ring-1 focus:ring-primary" />
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-text-secondary mb-1">Password</label>
              <input id="password" name="password" type="password" required minLength={6} autoComplete="new-password" placeholder="At least 6 characters"
                className="w-full rounded-lg border border-dark-border-light px-3 py-2 text-sm bg-dark-surface text-text-primary placeholder-text-muted focus:border-primary focus:ring-1 focus:ring-primary" />
            </div>
            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-text-secondary mb-1">Confirm Password</label>
              <input id="confirmPassword" name="confirmPassword" type="password" required autoComplete="new-password" placeholder="Repeat your password"
                className="w-full rounded-lg border border-dark-border-light px-3 py-2 text-sm bg-dark-surface text-text-primary placeholder-text-muted focus:border-primary focus:ring-1 focus:ring-primary" />
            </div>
            {error && <div className="text-sm text-red-300 bg-red-950/50 border border-red-900/50 rounded-lg p-3">{error}</div>}
            <button type="submit" disabled={isLoading} className="w-full btn-primary py-2.5">{isLoading ? "Creating account..." : "Create Account"}</button>
          </form>
        )}

        <p className="text-center text-sm text-text-muted">
          Already have an account?{" "}
          <Link href="/login" className="text-primary-light hover:text-primary font-medium">Sign in</Link>
        </p>
      </div>
    </div>
  );
}