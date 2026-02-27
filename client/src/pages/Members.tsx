import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useAuth } from "@/lib/auth-context";
import { useClub } from "@/lib/club-context";
import { useToast } from "@/hooks/use-toast";
import { MemberAvatar } from "@/components/shared/MemberAvatar";
import { MissionsGrid } from "@/components/shared/MissionsGrid";
import {
  Crown, Shield, User, Loader2,
  Coins, Users, UserPlus,
  ChevronDown, ChevronUp, ShieldCheck,
  UserX, Check, X, Send, Search,
  AlertCircle, Filter, Bell, CalendarDays
} from "lucide-react";

/* ── Role Label (mockup-style prefix text) ─────────────── */

function RoleLabel({ role }: { role: string }) {
  const colorMap: Record<string, string> = {
    owner: "text-amber-400",
    admin: "text-amber-400",
    member: "text-gray-400",
  };
  const color = colorMap[role] || colorMap.member;
  return (
    <span className={`text-[0.6875rem] font-bold capitalize ${color}`}>
      {role}:
    </span>
  );
}

/* ── Time ago helper ─────────────────────────────────── */

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

function formatEventTime(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", {
    month: "short", day: "numeric", hour: "numeric", minute: "2-digit"
  });
}

/* ── Main Component ────────────────────────────────────── */

export default function Members() {
  const { user } = useAuth();
  const { toast } = useToast();
  const {
    club,
    members,
    invitations,
    announcements,
    events,
    memberStatsMap,
    missions,
    onlineUserIds,
    myRole,
    isAdminOrOwner,
    loading,
    sendInvite,
    handleInvitation,
    changeRole,
    kickMember,
  } = useClub();

  // Invite input
  const [inviteUsername, setInviteUsername] = useState("");
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteMsg, setInviteMsg] = useState<{ text: string; type: "success" | "error" } | null>(null);

  // Action feedback
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Collapsible sections
  const [showPending, setShowPending] = useState(true);

  // Search and filter
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | "owner" | "admin" | "member">("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "online" | "offline">("all");

  // Role editing
  const [editingRole, setEditingRole] = useState<string | null>(null);

  // Filter pending invitations locally
  const pendingInvitations = invitations.filter(inv => inv.status === "pending");

  /* ── Actions ───────────────────────────────────────────── */

  const handleInvite = async () => {
    if (!inviteUsername.trim() || !club) return;
    setInviteLoading(true);
    setInviteMsg(null);
    try {
      const success = await sendInvite(inviteUsername.trim());
      if (success) {
        setInviteMsg({ text: `Invite sent to "${inviteUsername.trim()}"`, type: "success" });
        setInviteUsername("");
      } else {
        setInviteMsg({ text: "Failed to send invite", type: "error" });
      }
    } catch (err: any) {
      setInviteMsg({ text: err.message || "Failed to send invite", type: "error" });
    }
    setInviteLoading(false);
  };

  const handleInvitationAction = async (invId: string, status: "accepted" | "declined") => {
    setActionLoading(invId);
    await handleInvitation(invId, status);
    setActionLoading(null);
  };

  const handleRoleChange = async (memberId: string, newRole: "admin" | "member") => {
    setActionLoading(`role-${memberId}`);
    await changeRole(memberId, newRole);
    setActionLoading(null);
    setEditingRole(null);
  };

  const handleKick = async (memberId: string, displayName: string) => {
    if (!window.confirm(`Remove ${displayName} from the club?`)) return;
    setActionLoading(`kick-${memberId}`);
    await kickMember(memberId);
    setActionLoading(null);
  };

  const handleRemindMe = (eventId: string, eventName: string) => {
    const key = `remind_${eventId}`;
    localStorage.setItem(key, "true");
    toast({ title: "Reminder Set", description: `You'll be reminded about "${eventName}"` });
  };

  /* ── Render helpers ────────────────────────────────────── */

  const sortedMembers = useMemo(() => {
    let filtered = [...members];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(m =>
        m.displayName.toLowerCase().includes(q) || m.username.toLowerCase().includes(q)
      );
    }

    if (roleFilter !== "all") {
      filtered = filtered.filter(m => m.role === roleFilter);
    }

    if (statusFilter === "online") {
      filtered = filtered.filter(m => onlineUserIds.has(m.userId));
    } else if (statusFilter === "offline") {
      filtered = filtered.filter(m => !onlineUserIds.has(m.userId));
    }

    filtered.sort((a, b) => {
      const order: Record<string, number> = { owner: 0, admin: 1, member: 2 };
      return (order[a.role] ?? 3) - (order[b.role] ?? 3);
    });

    return filtered;
  }, [members, searchQuery, roleFilter, statusFilter, onlineUserIds]);

  const pendingCount = pendingInvitations.length;

  /* ── Component ─────────────────────────────────────────── */

  return (
    <DashboardLayout title="Members">
      <div className="px-8 pb-8">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-amber-400" />
          </div>
        ) : members.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Users className="w-12 h-12 text-gray-700 mb-4" />
            <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-1">No Members Yet</h3>
            <p className="text-xs text-gray-600 max-w-xs">
              {club ? "This club doesn't have any members yet. Invite friends to join!" : "Join or create a club to see members here."}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

            {/* ═══ Members List (2 columns) ═══ */}
            <div className="lg:col-span-2 space-y-4">
              {/* Header with count */}
              <div className="flex items-center gap-3 mb-1">
                <h2 className="text-sm font-black uppercase tracking-[0.15em] text-white">Members</h2>
                <span className="px-2.5 py-0.5 rounded-full text-[0.625rem] font-bold bg-amber-500/15 text-amber-400 border border-amber-500/20">
                  {members.length}
                </span>
              </div>

              {/* Search & Filter Bar */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-600" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search members..."
                    className="w-full bg-white/5 border border-white/10 rounded-lg pl-9 pr-3 py-2 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-amber-500/30 focus:ring-1 focus:ring-amber-500/20 transition-all"
                  />
                </div>
                <div className="flex items-center gap-1">
                  {(["all", "owner", "admin", "member"] as const).map(role => (
                    <button
                      key={role}
                      onClick={() => setRoleFilter(role)}
                      className={`px-2.5 py-1.5 rounded-lg text-[0.5625rem] font-bold uppercase tracking-wider transition-all border ${
                        roleFilter === role
                          ? "bg-amber-500/15 border-amber-500/25 text-amber-400"
                          : "border-white/5 text-gray-600 hover:text-gray-400 hover:border-white/10"
                      }`}
                    >
                      {role === "all" ? "All Roles" : role}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-1">
                  {(["all", "online", "offline"] as const).map(status => (
                    <button
                      key={status}
                      onClick={() => setStatusFilter(status)}
                      className={`px-2.5 py-1.5 rounded-lg text-[0.5625rem] font-bold uppercase tracking-wider transition-all border ${
                        statusFilter === status
                          ? status === "online"
                            ? "bg-green-500/15 border-green-500/25 text-green-400"
                            : "bg-amber-500/15 border-amber-500/25 text-amber-400"
                          : "border-white/5 text-gray-600 hover:text-gray-400 hover:border-white/10"
                      }`}
                    >
                      {status === "all" ? "All" : status}
                    </button>
                  ))}
                </div>
                <span className="text-[0.5625rem] text-gray-600 ml-auto">
                  {sortedMembers.length}/{members.length} shown
                </span>
              </div>

              <div
                className="rounded-xl overflow-hidden"
                style={{
                  background: "rgba(20,31,40,0.65)",
                  backdropFilter: "blur(16px)",
                  border: "1px solid rgba(212,168,67,0.15)",
                  boxShadow: "0 0 40px rgba(212,168,67,0.06), inset 0 1px 0 rgba(212,168,67,0.08)",
                }}
              >
                {/* Table Header — 3 columns matching mockup */}
                <div className="grid grid-cols-12 gap-2 px-6 py-3.5 border-b border-amber-500/10">
                  <span className="col-span-5 text-[0.625rem] font-bold uppercase tracking-[0.15em] text-gray-400">Name / Role</span>
                  <span className="col-span-2 text-[0.625rem] font-bold uppercase tracking-[0.15em] text-gray-400">Status</span>
                  <span className="col-span-3 text-[0.625rem] font-bold uppercase tracking-[0.15em] text-gray-400">Stats</span>
                  <span className="col-span-2 text-[0.625rem] font-bold uppercase tracking-[0.15em] text-gray-400 text-right">Actions</span>
                </div>

                {/* Empty state */}
                {sortedMembers.length === 0 && (searchQuery || roleFilter !== "all" || statusFilter !== "all") && (
                  <div className="flex flex-col items-center justify-center py-10 text-center">
                    <Search className="w-6 h-6 text-gray-700 mb-2" />
                    <p className="text-[0.6875rem] text-gray-600">No members match your filters</p>
                  </div>
                )}

                {/* Member rows */}
                {sortedMembers.map((member, i) => {
                  const isMe = member.userId === user?.id;
                  const canManage = isAdminOrOwner && !isMe && member.role !== "owner";
                  const ms = memberStatsMap[member.userId];
                  const hands = ms?.handsPlayed ?? 0;
                  const wins = ms?.potsWon ?? 0;
                  const winRate = hands > 0 ? Math.round((wins / hands) * 100) : 0;
                  const isOnline = onlineUserIds.has(member.userId);

                  return (
                    <motion.div
                      key={member.userId}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.04 }}
                      className="grid grid-cols-12 gap-3 items-center px-6 py-5 border-b border-white/[0.04] hover:bg-amber-500/[0.06] transition-all duration-200 group"
                    >
                      {/* Column 1: Avatar + Name + Role */}
                      <div className="col-span-5 flex items-center gap-4">
                        <div className="relative shrink-0">
                          <MemberAvatar
                            avatarId={member.avatarId}
                            displayName={member.displayName}
                            size="xl"
                          />
                          <span
                            className={`absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full border-2 border-[#111b2a] ${
                              isOnline
                                ? "bg-green-400 shadow-[0_0_8px_rgba(74,222,128,0.7)]"
                                : "bg-gray-600"
                            }`}
                          />
                        </div>
                        <div className="min-w-0">
                          <RoleLabel role={member.role} />
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-base font-bold text-white truncate">
                              {member.displayName}
                            </span>
                            {isMe && (
                              <span className="text-[0.5rem] text-amber-400 font-bold uppercase bg-amber-500/10 px-1.5 py-0.5 rounded">You</span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Column 2: Status */}
                      <div className="col-span-2 flex items-center gap-2">
                        <span
                          className={`w-2.5 h-2.5 rounded-full ${
                            isOnline ? "bg-green-400 shadow-[0_0_8px_rgba(74,222,128,0.6)]" : "bg-gray-600"
                          }`}
                        />
                        <span className={`text-sm font-medium ${isOnline ? "text-green-400" : "text-gray-500"}`}>
                          {isOnline ? "Online" : "Offline"}
                        </span>
                      </div>

                      {/* Column 3: Stats */}
                      <div className="col-span-3">
                        <div className="flex items-center gap-1.5">
                          <span className="text-lg font-bold text-white">
                            {member.chipBalance >= 1000
                              ? `${(member.chipBalance / 1000).toFixed(1)}k`
                              : member.chipBalance.toLocaleString()}
                          </span>
                          <span className="text-xs text-gray-500 font-medium">$</span>
                        </div>
                        <div className="text-[0.625rem] text-gray-500 mt-0.5">
                          {hands} hands | {winRate}% WR
                        </div>
                      </div>

                      {/* Column 4: Actions */}
                      <div className="col-span-2 flex items-center justify-end gap-1.5">
                        {canManage && (
                          <>
                            {/* Set Role / Edit Role */}
                            <div className="relative">
                              <motion.button
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={() => setEditingRole(editingRole === member.userId ? null : member.userId)}
                                disabled={actionLoading === `role-${member.userId}`}
                                className="px-2 py-1 rounded-lg text-[0.5625rem] font-bold uppercase tracking-wider bg-amber-500/10 border border-amber-500/20 text-amber-400 hover:bg-amber-500/20 transition-colors disabled:opacity-50"
                              >
                                {actionLoading === `role-${member.userId}` ? (
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                ) : member.role === "member" ? "Set Role" : "Edit Role"}
                              </motion.button>
                              {/* Role dropdown */}
                              <AnimatePresence>
                                {editingRole === member.userId && (
                                  <motion.div
                                    initial={{ opacity: 0, y: -5, scale: 0.95 }}
                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                    exit={{ opacity: 0, y: -5, scale: 0.95 }}
                                    className="absolute right-0 top-full mt-1 z-20 glass rounded-lg border border-white/10 overflow-hidden min-w-[100px]"
                                  >
                                    {member.role !== "admin" && (
                                      <button
                                        onClick={() => handleRoleChange(member.userId, "admin")}
                                        className="w-full px-3 py-2 text-left text-[0.625rem] font-bold text-amber-400 hover:bg-amber-500/10 transition-colors flex items-center gap-1.5"
                                      >
                                        <ChevronUp className="w-3 h-3" /> Promote
                                      </button>
                                    )}
                                    {member.role === "admin" && (
                                      <button
                                        onClick={() => handleRoleChange(member.userId, "member")}
                                        className="w-full px-3 py-2 text-left text-[0.625rem] font-bold text-amber-400 hover:bg-amber-500/10 transition-colors flex items-center gap-1.5"
                                      >
                                        <ChevronDown className="w-3 h-3" /> Demote
                                      </button>
                                    )}
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </div>

                            {/* Remove */}
                            <motion.button
                              whileHover={{ scale: 1.1 }}
                              whileTap={{ scale: 0.9 }}
                              onClick={() => handleKick(member.userId, member.displayName)}
                              disabled={actionLoading === `kick-${member.userId}`}
                              className="p-1.5 rounded-lg bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 transition-colors disabled:opacity-50"
                              title="Remove from Club"
                            >
                              {actionLoading === `kick-${member.userId}` ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin text-red-400" />
                              ) : (
                                <UserX className="w-3.5 h-3.5 text-red-400" />
                              )}
                            </motion.button>
                          </>
                        )}
                        {!canManage && !isMe && (
                          <span className="text-[0.5625rem] text-gray-600 font-bold uppercase tracking-wider">--</span>
                        )}
                        {isMe && (
                          <span className="text-[0.5625rem] text-amber-400/60 font-bold uppercase tracking-wider">--</span>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>

            {/* ═══ Right Panel ═══ */}
            <div className="space-y-4">

              {/* ── Club & Alliance News ── */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="rounded-xl overflow-hidden"
                style={{
                  background: "rgba(20,31,40,0.65)",
                  backdropFilter: "blur(16px)",
                  border: "1px solid rgba(212,168,67,0.12)",
                  boxShadow: "0 0 25px rgba(212,168,67,0.04)",
                }}
              >
                <div className="px-4 py-3 border-b border-amber-500/10 flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-white">
                    Club & Alliance News
                  </h3>
                  <div className="relative">
                    <Bell className="w-4 h-4 text-amber-400" />
                    {announcements.length > 0 && (
                      <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-red-500 text-white text-[0.5rem] font-bold flex items-center justify-center">
                        {announcements.length}
                      </span>
                    )}
                  </div>
                </div>
                <div className="divide-y divide-white/[0.03] max-h-48 overflow-y-auto">
                  {announcements.length === 0 ? (
                    <div className="py-6 text-center">
                      <Bell className="w-5 h-5 text-gray-700 mx-auto mb-2" />
                      <p className="text-[0.625rem] text-gray-600">No news yet</p>
                    </div>
                  ) : (
                    announcements.slice(0, 5).map(a => (
                      <div key={a.id} className="px-4 py-3 hover:bg-white/[0.02] transition-colors">
                        <div className="text-[0.625rem] font-bold text-amber-400 mb-0.5">{a.title}</div>
                        <p className="text-[0.6875rem] text-gray-400 line-clamp-2">{a.content}</p>
                        <span className="text-[0.5625rem] text-gray-600 mt-1 block">{formatTimeAgo(a.createdAt)}</span>
                      </div>
                    ))
                  )}
                </div>
              </motion.div>

              {/* ── Pending Join Requests ── */}
              {isAdminOrOwner && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.35 }}
                  className="rounded-xl overflow-hidden"
                  style={{
                    background: "rgba(20,31,40,0.65)",
                    backdropFilter: "blur(16px)",
                    border: "1px solid rgba(212,168,67,0.12)",
                    boxShadow: "0 0 25px rgba(212,168,67,0.04)",
                  }}
                >
                  <button
                    onClick={() => setShowPending(!showPending)}
                    className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/[0.02] transition-colors"
                  >
                    <h3 className="text-xs font-bold uppercase tracking-wider text-gray-300 flex items-center gap-2">
                      Pending Join Requests
                      {pendingCount > 0 && (
                        <span className="bg-amber-500/20 text-amber-400 text-[0.5625rem] font-bold px-1.5 py-0.5 rounded-full border border-amber-500/30">
                          {pendingCount}
                        </span>
                      )}
                    </h3>
                    {showPending ? (
                      <ChevronUp className="w-4 h-4 text-gray-600" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-gray-600" />
                    )}
                  </button>

                  <AnimatePresence>
                    {showPending && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        {pendingInvitations.length === 0 ? (
                          <div className="px-4 pb-4 text-center">
                            <div className="py-4">
                              <Users className="w-6 h-6 text-gray-700 mx-auto mb-2" />
                              <p className="text-[0.625rem] text-gray-600">No pending requests</p>
                            </div>
                          </div>
                        ) : (
                          <div className="px-4 pb-3 space-y-2">
                            {pendingInvitations.map((inv) => (
                              <motion.div
                                key={inv.id}
                                initial={{ opacity: 0, y: -10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                className="flex items-center gap-3 p-2.5 rounded-lg bg-white/[0.02] border border-white/[0.04]"
                              >
                                <MemberAvatar avatarId={inv.avatarId ?? null} displayName={inv.displayName} size="sm" />
                                <div className="flex-1 min-w-0">
                                  <div className="text-xs font-semibold text-white truncate">{inv.displayName}</div>
                                  <div className="text-[0.5625rem] text-gray-500">
                                    {inv.type === "request" ? "Request to Join" : "Pending Invite"}
                                  </div>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                  <motion.button
                                    whileHover={{ scale: 1.05 }}
                                    whileTap={{ scale: 0.95 }}
                                    onClick={() => handleInvitationAction(inv.id, "accepted")}
                                    disabled={actionLoading === inv.id}
                                    className="px-4 py-1.5 rounded-lg bg-green-500/80 hover:bg-green-500 text-white transition-colors disabled:opacity-50 text-[0.625rem] font-bold uppercase tracking-wider"
                                    title="Approve"
                                  >
                                    {actionLoading === inv.id ? (
                                      <Loader2 className="w-3 h-3 animate-spin" />
                                    ) : "APPROVE"}
                                  </motion.button>
                                  <motion.button
                                    whileHover={{ scale: 1.05 }}
                                    whileTap={{ scale: 0.95 }}
                                    onClick={() => handleInvitationAction(inv.id, "declined")}
                                    disabled={actionLoading === inv.id}
                                    className="px-4 py-1.5 rounded-lg bg-red-500/80 hover:bg-red-500 text-white transition-colors disabled:opacity-50 text-[0.625rem] font-bold uppercase tracking-wider"
                                    title="Decline"
                                  >
                                    DECLINE
                                  </motion.button>
                                </div>
                              </motion.div>
                            ))}
                          </div>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              )}

              {/* ── Invite by Username ── */}
              {isAdminOrOwner && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                  className="rounded-xl p-4"
                  style={{
                    background: "rgba(20,31,40,0.65)",
                    backdropFilter: "blur(16px)",
                    border: "1px solid rgba(212,168,67,0.12)",
                    boxShadow: "0 0 25px rgba(212,168,67,0.04)",
                  }}
                >
                  <h3 className="text-xs font-bold uppercase tracking-wider text-amber-400/80 mb-3 flex items-center gap-2">
                    <span className="w-0.5 h-3.5 bg-amber-400/60 rounded-full" />
                    <UserPlus className="w-3.5 h-3.5 text-amber-400" />
                    Invite Player
                  </h3>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-600" />
                      <input
                        type="text"
                        value={inviteUsername}
                        onChange={(e) => {
                          setInviteUsername(e.target.value);
                          setInviteMsg(null);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleInvite();
                        }}
                        placeholder="Enter username..."
                        className="w-full bg-white/5 border border-white/10 rounded-lg pl-8 pr-3 py-2 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-amber-500/30 focus:ring-1 focus:ring-amber-500/20 transition-all"
                      />
                    </div>
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={handleInvite}
                      disabled={inviteLoading || !inviteUsername.trim()}
                      className="px-3 py-2 rounded-lg bg-amber-500/15 border border-amber-500/25 text-amber-400 hover:bg-amber-500/25 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
                    >
                      {inviteLoading ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Send className="w-3.5 h-3.5" />
                      )}
                      <span className="text-xs font-medium">Invite</span>
                    </motion.button>
                  </div>
                  <AnimatePresence>
                    {inviteMsg && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className={`mt-2 flex items-center gap-1.5 text-[0.625rem] font-medium ${
                          inviteMsg.type === "success" ? "text-green-400" : "text-red-400"
                        }`}
                      >
                        {inviteMsg.type === "success" ? (
                          <Check className="w-3 h-3" />
                        ) : (
                          <AlertCircle className="w-3 h-3" />
                        )}
                        {inviteMsg.text}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              )}
            </div>
          </div>
        )}

        {/* ═══ Bottom Widgets ═══ */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
          {/* Daily Missions */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="rounded-xl p-5"
            style={{
              background: "rgba(20,31,40,0.65)",
              backdropFilter: "blur(16px)",
              border: "1px solid rgba(212,168,67,0.12)",
              boxShadow: "0 0 25px rgba(212,168,67,0.04)",
            }}
          >
            <h3 className="text-xs font-bold uppercase tracking-wider text-amber-400/80 mb-4 flex items-center gap-2">
              <span className="w-0.5 h-3.5 bg-amber-400/60 rounded-full" />
              Daily Missions
            </h3>
            <MissionsGrid missions={missions} />
          </motion.div>

          {/* Upcoming Private Games */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="rounded-xl p-5"
            style={{
              background: "rgba(20,31,40,0.65)",
              backdropFilter: "blur(16px)",
              border: "1px solid rgba(212,168,67,0.12)",
              boxShadow: "0 0 25px rgba(212,168,67,0.04)",
            }}
          >
            <h3 className="text-xs font-bold uppercase tracking-wider text-amber-400/80 mb-4 flex items-center gap-2">
              <span className="w-0.5 h-3.5 bg-amber-400/60 rounded-full" />
              <CalendarDays className="w-3.5 h-3.5 text-amber-400" />
              Upcoming Private Games
            </h3>
            {events.length === 0 ? (
              <div className="text-center py-4">
                <CalendarDays className="w-6 h-6 text-gray-700 mx-auto mb-2" />
                <p className="text-[0.6875rem] text-gray-600">No upcoming games scheduled</p>
              </div>
            ) : (
              <div className="space-y-3">
                {events.slice(0, 4).map(ev => (
                  <div key={ev.id} className="flex items-center justify-between p-3 rounded-lg bg-white/[0.02] border border-white/[0.04]">
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-bold text-white truncate">{ev.name}</div>
                      <div className="text-[0.625rem] text-gray-500 mt-0.5">
                        {formatEventTime(ev.startTime)} | {ev.eventType}
                      </div>
                    </div>
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => handleRemindMe(ev.id, ev.name)}
                      className={`px-5 py-2 rounded-lg text-[0.625rem] font-bold uppercase tracking-wider transition-all shrink-0 ml-3 ${
                        localStorage.getItem(`remind_${ev.id}`)
                          ? "bg-green-500/20 text-green-400 border border-green-500/20"
                          : "bg-green-500 text-white hover:bg-green-400 shadow-[0_0_15px_rgba(34,197,94,0.3)]"
                      }`}
                    >
                      {localStorage.getItem(`remind_${ev.id}`) ? "REMINDED" : "REMIND ME"}
                    </motion.button>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        </div>
      </div>
    </DashboardLayout>
  );
}
