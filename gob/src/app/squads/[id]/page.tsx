import { notFound } from "next/navigation";
import Link from "next/link";
import { createServerSupabaseClient, requireAuthUserId } from "@/lib/supabase/server";
import { SquadSessionDetail } from "./SquadSessionDetail";

export default async function SquadSessionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = await requireAuthUserId();
  const supabase = await createServerSupabaseClient();

  const { data: session, error } = await supabase
    .from("squad_sessions")
    .select(
      `*, initiator:profiles!squad_sessions_initiator_id_fkey (id, username, avatar_url, reputation_score),
       recipient:profiles!squad_sessions_recipient_id_fkey (id, username, avatar_url, reputation_score)`
    )
    .eq("id", id)
    .single();

  if (error || !session) notFound();

  // RLS already restricts reads to participants + admin, but double-check
  // server-side (defense in depth) before rendering.
  const isParticipant = session.initiator_id === userId || session.recipient_id === userId;
  const { data: isAdmin } = await supabase.rpc("is_admin");
  if (!isParticipant && !isAdmin) notFound();

  // Fetch the current user's feedback for this session (if any).
  const { data: myFeedback } = await supabase
    .from("squad_session_feedback")
    .select("*")
    .eq("session_id", id)
    .eq("reporter_id", userId)
    .maybeSingle();

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
      <Link href="/squads/requests" className="inline-flex items-center text-sm text-text-secondary hover:text-text-primary">
        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back to Squad Requests
      </Link>

      <SquadSessionDetail
        session={session as unknown as Parameters<typeof SquadSessionDetail>[0]["session"]}
        currentUserId={userId}
        myFeedback={myFeedback ?? null}
      />
    </div>
  );
}