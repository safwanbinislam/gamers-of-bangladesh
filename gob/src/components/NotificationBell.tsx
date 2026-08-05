"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";

interface NotificationBellProps {
  currentUserId: string;
}

export function NotificationBell({ currentUserId }: NotificationBellProps) {
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<
    { id: string; type: "trade" | "dispute" | "squad"; message: string; href: string; time: Date }[]
  >([]);

  useEffect(() => {
    const supabase = createBrowserSupabaseClient();

    const tradesChannel = supabase
      .channel("notification-trades")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "escrow_transactions",
          filter: `buyer_id=eq.${currentUserId}`,
        },
        (payload) => {
          const { status, id } = payload.new as { status: string; id: string };
          setNotifications((prev) => [
            {
              id: `trade-${id}-${Date.now()}`,
              type: "trade",
              message: `Trade status changed to "${status.replace(/_/g, " ")}"`,
              href: `/trades/${id}`,
              time: new Date(),
            },
            ...prev.slice(0, 9),
          ]);
          setUnreadCount((c) => c + 1);
        }
      )
      .subscribe();

    const tradesChannel2 = supabase
      .channel("notification-trades-seller")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "escrow_transactions",
          filter: `seller_id=eq.${currentUserId}`,
        },
        (payload) => {
          const { status, id } = payload.new as { status: string; id: string };
          setNotifications((prev) => [
            {
              id: `trade-${id}-${Date.now()}`,
              type: "trade",
              message: `Trade status changed to "${status.replace(/_/g, " ")}"`,
              href: `/trades/${id}`,
              time: new Date(),
            },
            ...prev.slice(0, 9),
          ]);
          setUnreadCount((c) => c + 1);
        }
      )
      .subscribe();

    // Squad-up request received (squad_sessions INSERT where I'm the recipient).
    // RLS restricts reads of squad_sessions to the two participants and
    // Realtime respects RLS, so only the recipient sees this event.
    const squadRequestChannel = supabase
      .channel("notification-squad-requests")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "squad_sessions",
          filter: `recipient_id=eq.${currentUserId}`,
        },
        (payload) => {
          const { id, game } = payload.new as { id: string; game: string };
          setNotifications((prev) => [
            {
              id: `squad-${id}-${Date.now()}`,
              type: "squad",
              message: `New squad request for ${game.replace(/_/g, " ")}`,
              href: "/squads/requests",
              time: new Date(),
            },
            ...prev.slice(0, 9),
          ]);
          setUnreadCount((c) => c + 1);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(tradesChannel);
      supabase.removeChannel(tradesChannel2);
      supabase.removeChannel(squadRequestChannel);
    };
  }, [currentUserId]);

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-text-secondary hover:text-text-primary transition-colors"
        aria-label="Notifications"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[10px] w-5 h-5 rounded-full flex items-center justify-center font-bold">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute right-0 mt-2 w-80 bg-dark-surface-2 border border-dark-border rounded-xl shadow-lg z-50 max-h-96 overflow-y-auto">
            <div className="p-3 border-b border-dark-border">
              <h4 className="font-semibold text-sm text-text-primary">Notifications</h4>
            </div>
            {notifications.length === 0 ? (
              <p className="text-sm text-text-muted text-center py-6">No notifications yet</p>
            ) : (
              notifications.map((n) => (
                <Link
                  key={n.id}
                  href={n.href}
                  onClick={() => {
                    setIsOpen(false);
                    setUnreadCount((c) => Math.max(0, c - 1));
                  }}
                  className="block px-3 py-2 hover:bg-dark-surface transition-colors"
                >
                  <p className="text-sm text-text-secondary">{n.message}</p>
                  <p className="text-xs text-text-muted mt-0.5">
                    {n.time.toLocaleTimeString("en-BD", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </Link>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}