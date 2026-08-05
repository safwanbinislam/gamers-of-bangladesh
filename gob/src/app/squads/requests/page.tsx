import { Suspense } from "react";
import Link from "next/link";
import { createServerSupabaseClient, requireAuthUserId } from "@/lib/supabase/server";
import { SquadRequestsList } from "./SquadRequestsList";

async function RequestsContent() {
  const userId = await requireAuthUserId();
  const supabase = await createServerSupabaseClient();

  // Sessions where the user is a participant (initiator or recipient).
  // RLS restricts reads to participants + admin, so this is safe.
  const { data: sessions } = await supabase
    .from("squad_sessions")
    .select(
      `*, initiator:profiles!squad_sessions_initiator_id_fkey (id, username, avatar_url, reputation_score),
       recipient:profiles!squad_sessions_recipient_id_fkey (id, username, avatar_url, reputation_score)`
    )
    .or(`initiator_id.eq.${userId},recipient_id.eq.${userId}`)
    .order("created_at", { ascending: false });

  return <SquadRequestsList sessions={sessions ?? []} currentUserId={userId} />;
}

function RequestsSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="bg-dark-surface border border-dark-border rounded-xl p-4 animate-pulse space-y-2">
          <div className="h-4 bg-dark-surface-2 rounded w-1/2" />
          <div className="h-3 bg-dark-surface-2 rounded w-2/3" />
        </div>
      ))}
    </div>
  );
}

export default function SquadRequestsPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
      <div>
        <Link href="/squads" className="inline-flex items-center text-sm text-text-secondary hover:text-text-primary">
          <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Squad Finder
        </Link>
        <h1 className="text-2xl font-bold text-text-primary font-display mt-2">Squad Requests</h1>
        <p className="text-sm text-text-secondary mt-1">Incoming and outgoing squad-up requests</p>
      </div>

      <Suspense fallback={<RequestsSkeleton />}>
        <RequestsContent />
      </Suspense>
    </div>
  );
}