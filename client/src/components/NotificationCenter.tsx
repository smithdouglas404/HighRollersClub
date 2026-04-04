import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import {
  Bell, Megaphone, Trophy, BarChart3, Users, Swords, X, CheckCheck,
} from "lucide-react";

interface Notification {
  id: string;
  userId: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  metadata: any;
  createdAt: string;
}

const TYPE_CONFIG: Record<string, { icon: typeof Bell; color: string; bgColor: string; borderColor: string }> = {
  tournament_starting: { icon: Trophy, color: "text-purple-400", bgColor: "bg-purple-500/15", borderColor: "border-purple-500/20" },
  leaderboard_change: { icon: BarChart3, color: "text-cyan-400", bgColor: "bg-cyan-500/15", borderColor: "border-cyan-500/20" },
  club_announcement: { icon: Megaphone, color: "text-amber-400", bgColor: "bg-amber-500/15", borderColor: "border-amber-500/20" },
  friend_playing: { icon: Users, color: "text-green-400", bgColor: "bg-green-500/15", borderColor: "border-green-500/20" },
  challenge_complete: { icon: Swords, color: "text-rose-400", bgColor: "bg-rose-500/15", borderColor: "border-rose-500/20" },
};

function formatTimeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

async function apiFetch<T>(url: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(url, { credentials: "include", ...opts });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export function NotificationCenter() {
  const [isOpen, setIsOpen] = useState(false);
  const [items, setItems] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [, navigate] = useLocation();

  // Fetch unread count
  const fetchUnreadCount = useCallback(async () => {
    try {
      const data = await apiFetch<{ count: number }>("/api/notifications/unread-count");
      setUnreadCount(data.count);
    } catch (_) { /* ignore auth errors when logged out */ }
  }, []);

  // Fetch full notification list
  const fetchNotifications = useCallback(async () => {
    try {
      const data = await apiFetch<Notification[]>("/api/notifications?limit=20");
      setItems(data);
      setUnreadCount(data.filter(n => !n.read).length);
    } catch (_) { /* ignore */ }
  }, []);

  // Poll unread count every 30s
  useEffect(() => {
    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 30000);
    return () => clearInterval(interval);
  }, [fetchUnreadCount]);

  // Fetch full list when dropdown opens
  useEffect(() => {
    if (isOpen) fetchNotifications();
  }, [isOpen, fetchNotifications]);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClick);
      return () => document.removeEventListener("mousedown", handleClick);
    }
  }, [isOpen]);

  const markAllRead = async () => {
    try {
      await apiFetch("/api/notifications/read-all", { method: "POST" });
      setItems(prev => prev.map(n => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch (_) { /* ignore */ }
  };

  const markOneRead = async (notif: Notification) => {
    if (!notif.read) {
      try {
        await apiFetch(`/api/notifications/${notif.id}/read`, { method: "POST" });
        setItems(prev => prev.map(n => n.id === notif.id ? { ...n, read: true } : n));
        setUnreadCount(prev => Math.max(0, prev - 1));
      } catch (_) { /* ignore */ }
    }
    // Navigate based on type
    if (notif.type === "club_announcement" && notif.metadata?.clubId) {
      navigate(`/lobby`);
      setIsOpen(false);
    } else if (notif.type === "tournament_starting" && notif.metadata?.tournamentId) {
      navigate(`/tournaments`);
      setIsOpen(false);
    } else {
      setIsOpen(false);
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Button */}
      <motion.button
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-lg glass border border-white/5 hover:border-amber-500/20 transition-all"
      >
        <Bell className={`w-4 h-4 ${unreadCount > 0 ? "text-amber-400" : "text-gray-400"}`} />
        {unreadCount > 0 && (
          <span
            className="absolute -top-1 -right-1 min-w-[16px] h-4 px-0.5 rounded-full text-white text-[0.5rem] font-bold flex items-center justify-center"
            style={{
              background: "linear-gradient(135deg, #e53e3e, #d4af37)",
              boxShadow: "0 0 8px rgba(212,175,55,0.5)",
            }}
          >
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </motion.button>

      {/* Dropdown */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            className="absolute right-0 top-full mt-2 w-[340px] glass rounded-xl border border-white/10 overflow-hidden z-50"
            style={{ boxShadow: "0 10px 40px rgba(0,0,0,0.5)" }}
          >
            {/* Header */}
            <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-white">
                Notifications
                {unreadCount > 0 && (
                  <span className="ml-2 text-[0.5625rem] font-normal text-amber-400/80">
                    {unreadCount} new
                  </span>
                )}
              </h3>
              <div className="flex items-center gap-1">
                {unreadCount > 0 && (
                  <button
                    onClick={markAllRead}
                    className="flex items-center gap-1 px-2 py-1 text-[0.5625rem] text-amber-400 hover:text-amber-300 hover:bg-white/5 rounded transition-colors"
                    title="Mark all read"
                  >
                    <CheckCheck className="w-3 h-3" />
                    Mark all read
                  </button>
                )}
                <button onClick={() => setIsOpen(false)} className="p-1 hover:bg-white/5 rounded transition-colors">
                  <X className="w-3.5 h-3.5 text-gray-500" />
                </button>
              </div>
            </div>

            {/* Notification list */}
            <div className="max-h-80 overflow-y-auto divide-y divide-white/[0.03]">
              {items.length === 0 ? (
                <div className="py-10 text-center">
                  <Bell className="w-6 h-6 text-gray-700 mx-auto mb-2" />
                  <p className="text-[0.6875rem] text-gray-600">No notifications yet</p>
                </div>
              ) : (
                items.map((notif) => {
                  const cfg = TYPE_CONFIG[notif.type] || TYPE_CONFIG.club_announcement;
                  const Icon = cfg.icon;
                  return (
                    <button
                      key={notif.id}
                      onClick={() => markOneRead(notif)}
                      className={`w-full text-left px-4 py-3 flex items-start gap-3 transition-colors cursor-pointer ${
                        notif.read
                          ? "hover:bg-white/[0.02] opacity-60"
                          : "hover:bg-white/[0.04] bg-white/[0.015]"
                      }`}
                    >
                      <div className={`w-7 h-7 rounded-lg ${cfg.bgColor} border ${cfg.borderColor} flex items-center justify-center shrink-0 mt-0.5`}>
                        <Icon className={`w-3.5 h-3.5 ${cfg.color}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className={`text-[0.6875rem] font-medium truncate ${notif.read ? "text-gray-400" : "text-white"}`}>
                            {notif.title}
                          </p>
                          {!notif.read && (
                            <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: "linear-gradient(135deg, #d4af37, #e53e3e)" }} />
                          )}
                        </div>
                        <p className="text-[0.625rem] text-gray-500 line-clamp-2 mt-0.5">{notif.message}</p>
                        <p className="text-[0.5625rem] text-gray-600 mt-1">{formatTimeAgo(notif.createdAt)}</p>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
