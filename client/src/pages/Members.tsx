import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useAuth } from "@/lib/auth-context";
import { useClub } from "@/lib/club-context";
import { MemberAvatar } from "@/components/shared/MemberAvatar";
import { MissionsGrid } from "@/components/shared/MissionsGrid";
import {
  Crown, Shield, User, Clock, Loader2,
  Gamepad2, Coins, Target, Users, UserPlus,
  ChevronDown, ChevronUp, ShieldCheck,
  UserX, Check, X, Send, Search,
  TrendingUp, AlertCircle, Filter
} from "lucide-react";

/* ── Role Badge ────────────────────────────────────────── */

function RoleBadge({ role }: { role: string }) {
  const config: Record<string, { color: string; icon: any; bg: string }> = {
    owner: { color: "text-amber-400", icon: Crown, bg: "bg-amber-500/10 border-amber-500/20" },
    admin: { color: "text-cyan-400", icon: ShieldCheck, bg: "bg-cyan-500/10 border-cyan-500/20" },
    manager: { color: "text-cyan-400", icon: Shield, bg: "bg-cyan-500/10 border-cyan-500/20" },
    member: { color: "text-gray-400", icon: User, bg: "bg-gray-500/10 border-gray-500/20" },
  };
  const c = config[role] || config.member;
  const Icon = c.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${c.color} ${c.bg} border`}>
      <Icon className="w-2.5 h-2.5" />
      {role}
    </span>
  );
}

/* ── "Member since" helper ─────────────────────────────── */

function formatMemberSince(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays < 1) return "Joined today";
  if (diffDays === 1) return "Joined yesterday";
  if (diffDays < 30) return `Member for ${diffDays}d`;
  if (diffDays < 365) return `Member for ${Math.floor(diffDays / 30)}mo`;
  return `Member for ${Math.floor(diffDays / 365)}y`;
}

/* ── Main Component ────────────────────────────────────── */

export default function Members() {
  const { user } = useAuth();
  const {
    club,
    members,
    invitations,
    memberStatsMap,
    myStats,
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

  // Filter pending invitations locally
  const pendingInvitations = invitations.filter(inv => inv.status === "pending");

  /* ── Actions ───────────────────────────────────────────── */

  const handleInvite = async () => {
    if (!inviteUsername.trim() || !club) return;
    setInviteLoading(true);
    setInviteMsg(null);
    const success = await sendInvite(inviteUsername.trim());
    if (success) {
      setInviteMsg({ text: `Invite sent to "${inviteUsername.trim()}"`, type: "success" });
      setInviteUsername("");
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
  };

  const handleKick = async (memberId: string, displayName: string) => {
    if (!window.confirm(`Remove ${displayName} from the club?`)) return;
    setActionLoading(`kick-${memberId}`);
    await kickMember(memberId);
    setActionLoading(null);
  };

  /* ── Render helpers ────────────────────────────────────── */

  const sortedMembers = useMemo(() => {
    let filtered = [...members];

    // Search by name or username
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(m =>
        m.displayName.toLowerCase().includes(q) || m.username.toLowerCase().includes(q)
      );
    }

    // Filter by role
    if (roleFilter !== "all") {
      filtered = filtered.filter(m => m.role === roleFilter);
    }

    // Filter by online status
    if (statusFilter === "online") {
      filtered = filtered.filter(m => onlineUserIds.has(m.userId));
    } else if (statusFilter === "offline") {
      filtered = filtered.filter(m => !onlineUserIds.has(m.userId));
    }

    // Sort by role hierarchy
    filtered.sort((a, b) => {
      const order: Record<string, number> = { owner: 0, admin: 1, manager: 1, member: 2 };
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
            <Loader2 className="w-6 h-6 animate-spin text-cyan-400" />
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
              {/* Search & Filter Bar */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-600" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search members..."
                    className="w-full bg-white/5 border border-white/10 rounded-lg pl-9 pr-3 py-2 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-cyan-500/30 focus:ring-1 focus:ring-cyan-500/20 transition-all"
                  />
                </div>
                {/* Role Filter */}
                <div className="flex items-center gap-1">
                  {(["all", "owner", "admin", "member"] as const).map(role => (
                    <button
                      key={role}
                      onClick={() => setRoleFilter(role)}
                      className={`px-2.5 py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-wider transition-all border ${
                        roleFilter === role
                          ? "bg-cyan-500/15 border-cyan-500/25 text-cyan-400"
                          : "border-white/5 text-gray-600 hover:text-gray-400 hover:border-white/10"
                      }`}
                    >
                      {role === "all" ? "All Roles" : role}
                    </button>
                  ))}
                </div>
                {/* Online/Offline Filter */}
                <div className="flex items-center gap-1">
                  {(["all", "online", "offline"] as const).map(status => (
                    <button
                      key={status}
                      onClick={() => setStatusFilter(status)}
                      className={`px-2.5 py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-wider transition-all border ${
                        statusFilter === status
                          ? status === "online"
                            ? "bg-green-500/15 border-green-500/25 text-green-400"
                            : "bg-cyan-500/15 border-cyan-500/25 text-cyan-400"
                          : "border-white/5 text-gray-600 hover:text-gray-400 hover:border-white/10"
                      }`}
                    >
                      {status === "all" ? "All" : status}
                    </button>
                  ))}
                </div>
                {/* Result count */}
                <span className="text-[9px] text-gray-600 ml-auto">
                  {sortedMembers.length}/{members.length} shown
                </span>
              </div>

              <div
                className="glass rounded-xl overflow-hidden border border-cyan-500/10"
                style={{ boxShadow: "0 0 30px rgba(0,240,255,0.03)" }}
              >
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-3 border-b border-white/5">
                  <div className="grid grid-cols-5 gap-4 flex-1 text-[9px] font-bold uppercase tracking-wider text-gray-500">
                    <span className="col-span-1">Name / Role</span>
                    <span>Joined</span>
                    <span>Stats</span>
                    <span>Balance</span>
                    <span className="text-right">Actions</span>
                  </div>
                </div>

                {/* Member rows */}
                {sortedMembers.length === 0 && (searchQuery || roleFilter !== "all" || statusFilter !== "all") && (
                  <div className="flex flex-col items-center justify-center py-10 text-center">
                    <Search className="w-6 h-6 text-gray-700 mb-2" />
                    <p className="text-[11px] text-gray-600">No members match your filters</p>
                  </div>
                )}
                {sortedMembers.map((member, i) => {
                  const isMe = member.userId === user?.id;
                  const canManage = isAdminOrOwner && !isMe && member.role !== "owner";

                  return (
                    <motion.div
                      key={member.userId}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className="flex items-center px-5 py-4 border-b border-white/[0.03] hover:bg-white/[0.06] transition-all duration-200 group"
                    >
                      <div className="grid grid-cols-5 gap-4 flex-1 items-center">
                        {/* Avatar + Name + Role */}
                        <div className="flex items-center gap-3 col-span-1">
                          <div className="relative">
                            <MemberAvatar
                              avatarId={member.avatarId}
                              displayName={member.displayName}
                              size="md"
                            />
                            {/* Online status dot */}
                            <span
                              className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-[#0a0a1a] ${
                                onlineUserIds.has(member.userId)
                                  ? "bg-green-400 shadow-[0_0_6px_rgba(74,222,128,0.6)] animate-pulse"
                                  : "bg-gray-600"
                              }`}
                            />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="text-sm font-semibold text-white truncate">
                                {member.displayName}
                              </span>
                              {isMe && (
                                <span className="text-[8px] text-cyan-400 font-bold uppercase bg-cyan-500/10 px-1.5 py-0.5 rounded">You</span>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] text-gray-600 truncate">@{member.username}</span>
                              <span className={`text-[9px] font-medium ${
                                onlineUserIds.has(member.userId) ? "text-green-400" : "text-gray-600"
                              }`}>
                                {onlineUserIds.has(member.userId) ? "Online" : "Offline"}
                              </span>
                            </div>
                            <RoleBadge role={member.role} />
                          </div>
                        </div>

                        {/* Member Since */}
                        <div className="flex items-center gap-2">
                          <Clock className="w-3 h-3 text-gray-600" />
                          <span className="text-xs text-gray-500">
                            {formatMemberSince(member.joinedAt)}
                          </span>
                        </div>

                        {/* Inline Stats */}
                        <div className="flex flex-col gap-0.5">
                          {(() => {
                            const ms = memberStatsMap[member.userId];
                            const hands = ms?.handsPlayed ?? 0;
                            const wins = ms?.potsWon ?? 0;
                            const winRate = hands > 0 ? Math.round((wins / hands) * 100) : 0;
                            return (
                              <>
                                <div className="flex items-center gap-1.5">
                                  <Gamepad2 className="w-3 h-3 text-gray-600" />
                                  <span className="text-[10px] text-gray-400">
                                    {hands} hands
                                  </span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                  <TrendingUp className="w-3 h-3 text-gray-600" />
                                  <span className="text-[10px] text-gray-400">
                                    {winRate}% win rate
                                  </span>
                                </div>
                              </>
                            );
                          })()}
                        </div>

                        {/* Balance */}
                        <div className="flex items-center gap-1">
                          <Coins className="w-3.5 h-3.5 text-amber-500/60" />
                          <span className="text-sm font-bold text-white">
                            {member.chipBalance >= 1000
                              ? `${(member.chipBalance / 1000).toFixed(1)}k`
                              : member.chipBalance.toLocaleString()}
                          </span>
                          <span className="text-[9px] text-gray-600">$</span>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center justify-end gap-1">
                          {canManage && (
                            <>
                              {/* Promote / Demote */}
                              {member.role === "member" ? (
                                <motion.button
                                  whileHover={{ scale: 1.1 }}
                                  whileTap={{ scale: 0.9 }}
                                  onClick={() => handleRoleChange(member.userId, "admin")}
                                  disabled={actionLoading === `role-${member.userId}`}
                                  className="p-1.5 rounded-lg bg-cyan-500/10 border border-cyan-500/20 hover:bg-cyan-500/20 transition-colors group/btn disabled:opacity-50"
                                  title="Promote to Admin"
                                >
                                  {actionLoading === `role-${member.userId}` ? (
                                    <Loader2 className="w-3.5 h-3.5 animate-spin text-cyan-400" />
                                  ) : (
                                    <ChevronUp className="w-3.5 h-3.5 text-cyan-400" />
                                  )}
                                </motion.button>
                              ) : member.role === "admin" ? (
                                <motion.button
                                  whileHover={{ scale: 1.1 }}
                                  whileTap={{ scale: 0.9 }}
                                  onClick={() => handleRoleChange(member.userId, "member")}
                                  disabled={actionLoading === `role-${member.userId}`}
                                  className="p-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 hover:bg-amber-500/20 transition-colors disabled:opacity-50"
                                  title="Demote to Member"
                                >
                                  {actionLoading === `role-${member.userId}` ? (
                                    <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-400" />
                                  ) : (
                                    <ChevronDown className="w-3.5 h-3.5 text-amber-400" />
                                  )}
                                </motion.button>
                              ) : null}

                              {/* Kick */}
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
                          {isMe && !canManage && (
                            <span className="text-[9px] text-cyan-400/60 font-bold uppercase tracking-wider">--</span>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>

            {/* ═══ Right Panel ═══ */}
            <div className="space-y-4">

              {/* ── Club Info ── */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="glass rounded-xl p-4 border border-white/5"
              >
                <h3 className="text-xs font-bold uppercase tracking-wider text-cyan-400/80 mb-3 flex items-center gap-2">
                  <span className="w-0.5 h-3.5 bg-cyan-400/60 rounded-full" />
                  Club Info
                </h3>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-gray-500">Club Name</span>
                    <span className="text-xs font-bold text-cyan-400">{club?.name || "\u2014"}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-gray-500">Total Members</span>
                    <span className="text-xs font-bold text-green-400">{members.length}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-gray-500">Pending Invites</span>
                    <span className="text-xs font-bold text-amber-400">{pendingCount}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-gray-500">Owners</span>
                    <span className="text-xs font-bold text-amber-400">
                      {members.filter(m => m.role === "owner").length}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-gray-500">Admins</span>
                    <span className="text-xs font-bold text-cyan-400">
                      {members.filter(m => m.role === "admin" || m.role === "manager").length}
                    </span>
                  </div>
                </div>
              </motion.div>

              {/* ── Invite by Username ── */}
              {isAdminOrOwner && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.35 }}
                  className="glass rounded-xl p-4 border border-white/5"
                >
                  <h3 className="text-xs font-bold uppercase tracking-wider text-cyan-400/80 mb-3 flex items-center gap-2">
                    <span className="w-0.5 h-3.5 bg-cyan-400/60 rounded-full" />
                    <UserPlus className="w-3.5 h-3.5 text-cyan-400" />
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
                        className="w-full bg-white/5 border border-white/10 rounded-lg pl-8 pr-3 py-2 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-cyan-500/30 focus:ring-1 focus:ring-cyan-500/20 transition-all"
                      />
                    </div>
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={handleInvite}
                      disabled={inviteLoading || !inviteUsername.trim()}
                      className="px-3 py-2 rounded-lg bg-cyan-500/15 border border-cyan-500/25 text-cyan-400 hover:bg-cyan-500/25 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
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
                        className={`mt-2 flex items-center gap-1.5 text-[10px] font-medium ${
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

              {/* ── Pending Join Requests ── */}
              {isAdminOrOwner && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                  className="glass rounded-xl border border-white/5 overflow-hidden"
                >
                  <button
                    onClick={() => setShowPending(!showPending)}
                    className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/[0.02] transition-colors"
                  >
                    <h3 className="text-xs font-bold uppercase tracking-wider text-cyan-400/80 flex items-center gap-2">
                      <span className="w-0.5 h-3.5 bg-cyan-400/60 rounded-full" />
                      <Clock className="w-3.5 h-3.5 text-amber-400" />
                      Pending Join Requests
                      {pendingCount > 0 && (
                        <span className="bg-amber-500/20 text-amber-400 text-[9px] font-bold px-1.5 py-0.5 rounded-full border border-amber-500/30">
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
                              <p className="text-[10px] text-gray-600">No pending requests</p>
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
                                {/* Avatar */}
                                <MemberAvatar
                                  avatarId={null}
                                  displayName={inv.displayName}
                                  size="sm"
                                />
                                {/* Info */}
                                <div className="flex-1 min-w-0">
                                  <div className="text-xs font-semibold text-white truncate">{inv.displayName}</div>
                                  <div className="text-[9px] text-gray-500">
                                    {inv.type === "request" ? "Request to Join" : "Pending Invite"}
                                  </div>
                                </div>
                                {/* Approve / Decline */}
                                <div className="flex items-center gap-1.5 shrink-0">
                                  <motion.button
                                    whileHover={{ scale: 1.15 }}
                                    whileTap={{ scale: 0.85 }}
                                    onClick={() => handleInvitationAction(inv.id, "accepted")}
                                    disabled={actionLoading === inv.id}
                                    className="p-1.5 rounded-md bg-green-500/15 border border-green-500/25 hover:bg-green-500/25 transition-colors disabled:opacity-50"
                                    title="Approve"
                                  >
                                    {actionLoading === inv.id ? (
                                      <Loader2 className="w-3 h-3 animate-spin text-green-400" />
                                    ) : (
                                      <Check className="w-3 h-3 text-green-400" />
                                    )}
                                  </motion.button>
                                  <motion.button
                                    whileHover={{ scale: 1.15 }}
                                    whileTap={{ scale: 0.85 }}
                                    onClick={() => handleInvitationAction(inv.id, "declined")}
                                    disabled={actionLoading === inv.id}
                                    className="p-1.5 rounded-md bg-red-500/15 border border-red-500/25 hover:bg-red-500/25 transition-colors disabled:opacity-50"
                                    title="Decline"
                                  >
                                    <X className="w-3 h-3 text-red-400" />
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

              {/* ── Your Role ── */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.45 }}
                className="glass rounded-xl p-4 border border-white/5"
              >
                <h3 className="text-xs font-bold uppercase tracking-wider text-cyan-400/80 mb-3 flex items-center gap-2">
                  <span className="w-0.5 h-3.5 bg-cyan-400/60 rounded-full" />
                  Your Role
                </h3>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-cyan-500/20 to-purple-500/20 flex items-center justify-center border border-white/10">
                    {myRole === "owner" ? (
                      <Crown className="w-5 h-5 text-amber-400" />
                    ) : myRole === "admin" ? (
                      <ShieldCheck className="w-5 h-5 text-cyan-400" />
                    ) : (
                      <User className="w-5 h-5 text-gray-400" />
                    )}
                  </div>
                  <div>
                    <RoleBadge role={myRole} />
                    <div className="text-[10px] text-gray-500 mt-1">
                      {myRole === "owner"
                        ? "Full control over club settings and members"
                        : myRole === "admin"
                          ? "Can manage members and approve requests"
                          : "Standard club member"}
                    </div>
                  </div>
                </div>
              </motion.div>
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
            className="glass rounded-xl p-5 border border-white/5"
          >
            <h3 className="text-xs font-bold uppercase tracking-wider text-cyan-400/80 mb-4 flex items-center gap-2">
              <span className="w-0.5 h-3.5 bg-cyan-400/60 rounded-full" />
              Daily Missions
            </h3>
            <MissionsGrid missions={missions} />
          </motion.div>

          {/* Your Stats */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="glass rounded-xl p-5 border border-white/5"
          >
            <h3 className="text-xs font-bold uppercase tracking-wider text-cyan-400/80 mb-4 flex items-center gap-2">
              <span className="w-0.5 h-3.5 bg-cyan-400/60 rounded-full" />
              Your Stats
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="text-center p-3 rounded-lg bg-white/5 border border-cyan-500/15" style={{ boxShadow: "0 0 20px rgba(0,240,255,0.05)" }}>
                <div className="text-lg font-bold text-cyan-400">{myStats?.handsPlayed ?? 0}</div>
                <div className="text-[9px] text-gray-500 uppercase tracking-wider">Hands Played</div>
              </div>
              <div className="text-center p-3 rounded-lg bg-white/5 border border-green-500/15" style={{ boxShadow: "0 0 20px rgba(0,255,157,0.05)" }}>
                <div className="text-lg font-bold text-green-400">{myStats?.potsWon ?? 0}</div>
                <div className="text-[9px] text-gray-500 uppercase tracking-wider">Pots Won</div>
              </div>
              <div className="text-center p-3 rounded-lg bg-white/5 border border-amber-500/15" style={{ boxShadow: "0 0 20px rgba(234,179,8,0.05)" }}>
                <div className="text-lg font-bold text-amber-400">{myStats?.bestWinStreak ?? 0}</div>
                <div className="text-[9px] text-gray-500 uppercase tracking-wider">Best Streak</div>
              </div>
              <div className="text-center p-3 rounded-lg bg-white/5 border border-purple-500/15" style={{ boxShadow: "0 0 20px rgba(168,85,247,0.05)" }}>
                <div className="text-lg font-bold text-purple-400">{myStats?.currentWinStreak ?? 0}</div>
                <div className="text-[9px] text-gray-500 uppercase tracking-wider">Current Streak</div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </DashboardLayout>
  );
}
