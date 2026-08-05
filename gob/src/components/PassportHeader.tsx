import { getBadgeDisplay } from "@/lib/badges/labels";

interface PassportHeaderProps {
  username: string;
  avatarUrl: string | null;
  memberSince: string;
  phoneVerified: boolean;
}

export function PassportHeader({ username, avatarUrl, memberSince, phoneVerified }: PassportHeaderProps) {
  const verified = getBadgeDisplay("verified");

  return (
    <div className="bg-dark-surface border border-dark-border rounded-xl p-5 flex items-center gap-4">
      {/* Avatar */}
      <div className="w-16 h-16 rounded-full bg-primary-subtle text-primary-light flex items-center justify-center text-2xl font-bold shrink-0 overflow-hidden">
        {avatarUrl ? (
          <img src={avatarUrl} alt={username} className="w-full h-full object-cover" />
        ) : (
          username[0]?.toUpperCase() ?? "?"
        )}
      </div>

      {/* Name + meta */}
      <div className="min-w-0">
        <h1 className="text-xl font-bold text-text-primary font-display truncate">{username}</h1>
        <p className="text-sm text-text-muted mt-0.5">
          Member since {new Date(memberSince).toLocaleDateString("en-BD", { year: "numeric", month: "long" })}
        </p>
        {phoneVerified && (
          <span className="inline-flex items-center gap-1 mt-1.5 text-xs text-emerald-300 bg-emerald-900/30 border border-emerald-700/40 px-2 py-0.5 rounded-full">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            {verified.label}
          </span>
        )}
      </div>
    </div>
  );
}