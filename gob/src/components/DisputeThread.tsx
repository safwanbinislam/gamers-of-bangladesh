"use client";

import { useState, useEffect, useRef } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";
import { sendDisputeMessage } from "@/lib/actions/trades";

interface Message {
  id: string; dispute_id: string; sender_id: string; message: string;
  attachment_url: string | null; created_at: string;
  sender: { id: string; username: string; avatar_url: string | null; is_admin: boolean } | null;
}

interface DisputeThreadProps {
  disputeId: string; initialMessages: Message[]; currentUserId: string;
}

export function DisputeThread({ disputeId, initialMessages, currentUserId }: DisputeThreadProps) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [newMessage, setNewMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const supabase = createBrowserSupabaseClient();
    const channel = supabase.channel(`dispute-${disputeId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "dispute_messages", filter: `dispute_id=eq.${disputeId}` },
        async (payload) => {
          const newMsg = payload.new as Message;
          if (!newMsg.sender) {
            const { data: sender } = await supabase.from("profiles").select("id, username, avatar_url, is_admin").eq("id", newMsg.sender_id).single();
            newMsg.sender = sender;
          }
          setMessages((prev) => prev.some((m) => m.id === newMsg.id) ? prev : [...prev, newMsg]);
        })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [disputeId]);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const handleSend = async () => {
    if (!newMessage.trim() || isSending) return;
    const trimmed = newMessage.trim(); setNewMessage(""); setIsSending(true);
    const optimisticId = `opt-${Date.now()}`;
    const optimisticMsg: Message = { id: optimisticId, dispute_id: disputeId, sender_id: currentUserId, message: trimmed, attachment_url: null, created_at: new Date().toISOString(), sender: { id: currentUserId, username: "You", avatar_url: null, is_admin: false } };
    setMessages((prev) => [...prev, optimisticMsg]);
    const result = await sendDisputeMessage(disputeId, trimmed);
    setIsSending(false);
    if (!result.success) { setMessages((prev) => prev.filter((m) => m.id !== optimisticId)); setNewMessage(trimmed); }
  };

  return (
    <div className="bg-dark-surface border border-dark-border rounded-xl flex flex-col h-[400px] sm:h-[500px]">
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && <p className="text-center text-text-muted text-sm py-8">No messages yet.</p>}
        {messages.map((msg) => {
          const isOwn = msg.sender_id === currentUserId;
          return (
            <div key={msg.id} className={`flex ${isOwn ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[85%] sm:max-w-[70%] rounded-xl px-3 py-2 ${isOwn ? "bg-primary text-white rounded-br-sm" : "bg-dark-surface-2 text-text-primary rounded-bl-sm"}`}>
                {!isOwn && msg.sender && <p className="text-xs font-medium text-text-muted mb-0.5">{msg.sender.is_admin ? "👑 Admin" : msg.sender.username}</p>}
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
          <input type="text" placeholder="Type a message..." value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            className="flex-1 rounded-lg border border-dark-border-light px-3 py-2 text-sm bg-dark-bg text-text-primary placeholder-text-muted focus:border-primary focus:ring-1 focus:ring-primary" />
          <button onClick={handleSend} disabled={!newMessage.trim() || isSending}
            className="bg-primary text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-primary-hover disabled:opacity-50 transition-colors">
            {isSending ? "..." : "Send"}
          </button>
        </div>
      </div>
    </div>
  );
}