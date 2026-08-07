"use client";

import { useState, useEffect, useRef } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";
import { sendSquadSessionMessage } from "@/lib/actions/squadFinder";
import type { SquadSessionMessage } from "@/lib/actions/squadFinder";

interface SquadSessionChatProps {
  sessionId: string;
  status: string;
  initialMessages: SquadSessionMessage[];
  currentUserId: string;
}

/**
 * Squad session chat between two matched players.
 *
 * Direct structural mirror of DisputeThread — same realtime subscription
 * (channel per session, INSERT on squad_session_messages filtered to this
 * session), same optimistic send/reconcile flow, same dark-theme classes.
 *
 * Gating:
 *  - Before the request is accepted (status 'requested'/'declined'/'cancelled')
 *    we render a locked notice instead of the chat — there is nothing to
 *    coordinate yet, and the DB trigger rejects messages anyway.
 *  - When the session is 'completed' history stays visible but the input is
 *    read-only with a subtle "session completed" note (session is over).
 */
export function SquadSessionChat({ sessionId, status, initialMessages, currentUserId }: SquadSessionChatProps) {
  const [messages, setMessages] = useState<SquadSessionMessage[]>(initialMessages);
  const [newMessage, setNewMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const canChat = status === "accepted" || status === "completed";
  const isCompleted = status === "completed";

  useEffect(() => {
    if (!canChat) return;
    const supabase = createBrowserSupabaseClient();
    const channel = supabase
      .channel(`squad-session-${sessionId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "squad_session_messages", filter: `session_id=eq.${sessionId}` },
        async (payload) => {
          const newMsg = payload.new as SquadSessionMessage;
          // Realtime rows don't include the embedded sender — fetch it lazily,
          // the same way DisputeThread does.
          if (!newMsg.sender) {
            const { data: sender } = await supabase
              .from("profiles")
              .select("id, username, avatar_url")
              .eq("id", newMsg.sender_id)
              .single();
            newMsg.sender = sender;
          }
          setMessages((prev) => (prev.some((m) => m.id === newMsg.id) ? prev : [...prev, newMsg]));
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [sessionId, canChat]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    if (!newMessage.trim() || isSending || !canChat || isCompleted) return;
    const trimmed = newMessage.trim();
    setNewMessage("");
    setIsSending(true);
    const optimisticId = `opt-${Date.now()}`;
    const optimisticMsg: SquadSessionMessage = {
      id: optimisticId,
      session_id: sessionId,
      sender_id: currentUserId,
      message: trimmed,
      created_at: new Date().toISOString(),
      sender: { id: currentUserId, username: "You", avatar_url: null },
    };
    setMessages((prev) => [...prev, optimisticMsg]);
    const result = await sendSquadSessionMessage({ session_id: sessionId, message: trimmed });
    setIsSending(false);
    if (!result.success) {
      setMessages((prev) => prev.filter((m) => m.id !== optimisticId));
      setNewMessage(trimmed);
    }
  };

  if (!canChat) {
    return (
      <div className="bg-dark-surface border border-dark-border rounded-xl p-5 text-center">
        <p className="text-sm text-text-muted">🔒 Chat opens once the request is accepted</p>
      </div>
    );
  }

  return (
    <div className="bg-dark-surface border border-dark-border rounded-xl flex flex-col h-[400px] sm:h-[500px]">
      <div className="flex items-center justify-between px-4 pt-3 pb-1">
        <h2 className="text-sm font-semibold text-text-primary">Session Chat</h2>
        {isCompleted && <span className="text-[11px] text-text-muted">Session completed — read-only</span>}
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <p className="text-center text-text-muted text-sm py-8">No messages yet. Say hi to your teammate!</p>
        )}
        {messages.map((msg) => {
          const isOwn = msg.sender_id === currentUserId;
          return (
            <div key={msg.id} className={`flex ${isOwn ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[85%] sm:max-w-[70%] rounded-xl px-3 py-2 ${
                  isOwn ? "bg-primary text-white rounded-br-sm" : "bg-dark-surface-2 text-text-primary rounded-bl-sm"
                }`}
              >
                {!isOwn && msg.sender && (
                  <p className="text-xs font-medium text-text-muted mb-0.5">{msg.sender.username}</p>
                )}
                <p className="text-sm whitespace-pre-wrap">{msg.message}</p>
                <p className={`text-[10px] mt-1 ${isOwn ? "text-white/60" : "text-text-muted"}`}>
                  {new Date(msg.created_at).toLocaleTimeString("en-BD", { hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>
      <div className="border-t border-dark-border p-3">
        <div className="flex gap-2">
          <input
            type="text"
            placeholder={isCompleted ? "Session completed" : "Type a message..."}
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            disabled={isCompleted}
            className="flex-1 rounded-lg border border-dark-border-light px-3 py-2 text-sm bg-dark-bg text-text-primary placeholder-text-muted focus:border-primary focus:ring-1 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed"
          />
          <button
            onClick={handleSend}
            disabled={!newMessage.trim() || isSending || isCompleted}
            className="bg-primary text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-primary-hover disabled:opacity-50 transition-colors"
          >
            {isSending ? "..." : "Send"}
          </button>
        </div>
      </div>
    </div>
  );
}
