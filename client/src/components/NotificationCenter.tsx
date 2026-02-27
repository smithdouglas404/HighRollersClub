import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useClub } from "@/lib/club-context";
import { Bell, Megaphone, CalendarDays, UserPlus, X } from "lucide-react";

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

export function NotificationCenter() {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Hook called unconditionally (ClubProvider wraps entire app)
  const { announcements, events, invitations } = useClub();

  const pendingInvitations = (invitations || []).filter((inv) => inv.status === "pending");
  const recentAnnouncements = announcements || [];
  const upcomingEvents = events || [];

  const totalCount = recentAnnouncements.length + upcomingEvents.length + pendingInvitations.length;

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

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Button */}
      <motion.button
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-lg glass border border-white/5 hover:border-cyan-500/20 transition-all"
      >
        <Bell className="w-4 h-4 text-gray-400" />
        {totalCount > 0 && (
          <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-white text-[0.5rem] font-bold flex items-center justify-center">
            {totalCount > 9 ? "9+" : totalCount}
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
            className="absolute right-0 top-full mt-2 w-80 glass rounded-xl border border-white/10 overflow-hidden z-50"
            style={{ boxShadow: "0 10px 40px rgba(0,0,0,0.5)" }}
          >
            <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-white">Notifications</h3>
              <button onClick={() => setIsOpen(false)} className="p-1 hover:bg-white/5 rounded transition-colors">
                <X className="w-3.5 h-3.5 text-gray-500" />
              </button>
            </div>

            <div className="max-h-80 overflow-y-auto divide-y divide-white/[0.03]">
              {totalCount === 0 ? (
                <div className="py-8 text-center">
                  <Bell className="w-6 h-6 text-gray-700 mx-auto mb-2" />
                  <p className="text-[0.6875rem] text-gray-600">No notifications</p>
                </div>
              ) : (
                <>
                  {/* Pending Join Requests */}
                  {pendingInvitations.map((inv) => (
                    <div key={`inv-${inv.id}`} className="px-4 py-3 hover:bg-white/[0.02] transition-colors flex items-start gap-3">
                      <div className="w-7 h-7 rounded-lg bg-green-500/15 border border-green-500/20 flex items-center justify-center shrink-0 mt-0.5">
                        <UserPlus className="w-3.5 h-3.5 text-green-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[0.6875rem] text-white font-medium">{inv.displayName} wants to join</p>
                        <p className="text-[0.5625rem] text-gray-600 mt-0.5">{formatTimeAgo(inv.createdAt)}</p>
                      </div>
                    </div>
                  ))}

                  {/* Announcements */}
                  {recentAnnouncements.slice(0, 5).map((a) => (
                    <div key={`ann-${a.id}`} className="px-4 py-3 hover:bg-white/[0.02] transition-colors flex items-start gap-3">
                      <div className="w-7 h-7 rounded-lg bg-cyan-500/15 border border-cyan-500/20 flex items-center justify-center shrink-0 mt-0.5">
                        <Megaphone className="w-3.5 h-3.5 text-cyan-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[0.6875rem] text-white font-medium truncate">{a.title}</p>
                        <p className="text-[0.625rem] text-gray-500 line-clamp-1">{a.content}</p>
                        <p className="text-[0.5625rem] text-gray-600 mt-0.5">{formatTimeAgo(a.createdAt)}</p>
                      </div>
                    </div>
                  ))}

                  {/* Upcoming Events */}
                  {upcomingEvents.slice(0, 3).map((ev) => (
                    <div key={`ev-${ev.id}`} className="px-4 py-3 hover:bg-white/[0.02] transition-colors flex items-start gap-3">
                      <div className="w-7 h-7 rounded-lg bg-cyan-500/15 border border-cyan-500/20 flex items-center justify-center shrink-0 mt-0.5">
                        <CalendarDays className="w-3.5 h-3.5 text-cyan-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[0.6875rem] text-white font-medium truncate">{ev.name}</p>
                        <p className="text-[0.625rem] text-gray-500">
                          {new Date(ev.startTime).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                        </p>
                        <p className="text-[0.5625rem] text-gray-600 mt-0.5">{ev.eventType}</p>
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
