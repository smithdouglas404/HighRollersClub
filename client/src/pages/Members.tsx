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
  AlertCircle, Filter, Bell, CalendarDays,
  TrendingUp, TrendingDown, Trophy, Wifi,
  MoreVertical, ShieldPlus, ShieldMinus
} from "lucide-react";

function RoleLabel({ role }: { role: string }) {
  const colorMap: Record<string, string> = {
    owner: "text-primary",
    admin: "text-primary",
    member: "text-gray-400",
  };
  const color = colorMap[role] || colorMap.member;
  return (
    <span className={`text-[0.6875rem] font-bold capitalize ${color}`}>
      {role}:
    </span>
  );
}

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

const PODIUM_STYLES: Record<number, { bg: string; border: string; glow: string; iconColor: string; label: string }> = {
  0: {
    bg: "linear-gradient(135deg, rgba(255,215,0,0.12) 0%, rgba(255,180,0,0.06) 100%)",
    border: "1px solid rgba(255,215,0,0.3)",
    glow: "0 0 20px rgba(255,215,0,0.15), inset 0 1px 0 rgba(255,215,0,0.15)",
    iconColor: "text-yellow-400",
    label: "1st",
  },
  1: {
    bg: "linear-gradient(135deg, rgba(192,192,192,0.10) 0%, rgba(160,160,180,0.05) 100%)",
    border: "1px solid rgba(192,192,192,0.25)",
    glow: "0 0 16px rgba(192,192,192,0.1), inset 0 1px 0 rgba(192,192,192,0.12)",
    iconColor: "text-gray-300",
    label: "2nd",
  },
  2: {
    bg: "linear-gradient(135deg, rgba(205,127,50,0.10) 0%, rgba(180,100,30,0.05) 100%)",
    border: "1px solid rgba(205,127,50,0.25)",
    glow: "0 0 16px rgba(205,127,50,0.1), inset 0 1px 0 rgba(205,127,50,0.12)",
    iconColor: "text-amber-500",
    label: "3rd",
  },
};

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
    reload,
    sendInvite,
    handleInvitation,
    changeRole,
    kickMember,
  } = useClub();

  const [inviteUsername, setInviteUsername] = useState("");
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteMsg, setInviteMsg] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [showPending, setShowPending] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | "owner" | "admin" | "member">("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "online" | "offline">("all");
  const [editingRole, setEditingRole] = useState<string | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  const pendingInvitations = invitations.filter(inv => inv.status === "pending");

  const onlineCount = useMemo(() => {
    return members.filter(m => onlineUserIds.has(m.userId)).length;
  }, [members, onlineUserIds]);

  const top3ByChips = useMemo(() => {
    const sorted = [...members].sort((a, b) => b.chipBalance - a.chipBalance);
    return new Map(sorted.slice(0, 3).map((m, i) => [m.userId, i]));
  }, [members]);

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

  const claimMission = async (missionId: string): Promise<boolean> => {
    try {
      const res = await fetch(`/api/missions/${missionId}/claim`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({ message: "Failed to claim mission" }));
        throw new Error(data.message);
      }
      const data = await res.json();
      toast({ title: "Reward Claimed!", description: `+${data.reward} chips added to your balance` });
      await reload();
      return true;
    } catch (err: any) {
      toast({ title: "Claim Failed", description: err.message || "Could not claim mission reward", variant: "destructive" });
      return false;
    }
  };

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

  return (
    <DashboardLayout title="Members">
      <div className="px-4 md:px-8 pb-8">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : members.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4 bg-primary/10 border border-primary/15">
              <Users className="w-7 h-7 text-primary/40" />
            </div>
            <h3 data-testid="text-no-members" className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-1">No Members Yet</h3>
            <p className="text-xs text-muted-foreground/60 max-w-xs">
              {club ? "This club doesn't have any members yet. Invite friends to join!" : "Join or create a club to see members here."}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

            <div className="lg:col-span-2 space-y-4">
              <div className="flex items-center gap-3 mb-1 flex-wrap">
                <h2 className="text-sm font-black uppercase tracking-[0.15em] text-white font-display">Members</h2>
                <span data-testid="badge-member-count" className="px-2.5 py-0.5 rounded-full text-[0.625rem] font-bold bg-primary/15 text-primary border border-primary/20">
                  {members.length}
                </span>
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex items-center gap-1.5 px-3 py-1 rounded-full border bg-secondary/10 border-secondary/25"
                >
                  <Wifi className="w-3 h-3 text-green-400" />
                  <span data-testid="badge-online-count" className="text-[0.625rem] font-bold text-green-400">{onlineCount} Online Now</span>
                </motion.div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
                  <input
                    data-testid="input-search-members"
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search members..."
                    aria-label="Search members"
                    className="w-full bg-white/5 border border-white/10 rounded-full pl-9 pr-4 py-2.5 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/15 transition-all"
                  />
                </div>
                <div className="flex items-center gap-1.5">
                  {(["all", "owner", "admin", "member"] as const).map(role => (
                    <motion.button
                      key={role}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      data-testid={`filter-role-${role}`}
                      onClick={() => setRoleFilter(role)}
                      className={`px-3 py-1.5 rounded-full text-[0.5625rem] font-bold uppercase tracking-wider transition-all border ${
                        roleFilter === role
                          ? "bg-primary/20 border-primary/30 text-primary shadow-[0_0_10px_hsl(var(--primary)/0.15)]"
                          : "border-white/8 text-gray-500 hover:text-gray-300 hover:border-white/15 hover:bg-white/[0.03]"
                      }`}
                    >
                      {role === "all" ? "All Roles" : role}
                    </motion.button>
                  ))}
                </div>
                <div className="flex items-center gap-1.5">
                  {(["all", "online", "offline"] as const).map(status => (
                    <motion.button
                      key={status}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      data-testid={`filter-status-${status}`}
                      onClick={() => setStatusFilter(status)}
                      className={`px-3 py-1.5 rounded-full text-[0.5625rem] font-bold uppercase tracking-wider transition-all border ${
                        statusFilter === status
                          ? status === "online"
                            ? "bg-green-500/20 border-green-500/30 text-green-400 shadow-[0_0_10px_rgba(34,197,94,0.15)]"
                            : "bg-primary/20 border-primary/30 text-primary shadow-[0_0_10px_hsl(var(--primary)/0.15)]"
                          : "border-white/8 text-gray-500 hover:text-gray-300 hover:border-white/15 hover:bg-white/[0.03]"
                      }`}
                    >
                      {status === "all" ? "All" : status}
                    </motion.button>
                  ))}
                </div>
                <span className="text-[0.5625rem] text-gray-600 ml-auto">
                  {sortedMembers.length}/{members.length} shown
                </span>
              </div>

              <div
                className="rounded-xl overflow-hidden bg-surface-high/50 backdrop-blur-xl border border-primary/15"
              >
                <div className="hidden md:grid grid-cols-12 gap-2 px-6 py-3.5 border-b border-primary/10">
                  <span className="col-span-5 text-[0.625rem] font-bold uppercase tracking-[0.15em] text-gray-400">Name / Role</span>
                  <span className="col-span-2 text-[0.625rem] font-bold uppercase tracking-[0.15em] text-gray-400">Status</span>
                  <span className="col-span-3 text-[0.625rem] font-bold uppercase tracking-[0.15em] text-gray-400">Stats</span>
                  <span className="col-span-2 text-[0.625rem] font-bold uppercase tracking-[0.15em] text-gray-400 text-right">Actions</span>
                </div>
                {/* Mobile-only card header */}
                <div className="md:hidden px-4 py-2.5 border-b border-primary/10">
                  <span className="text-[0.625rem] font-bold uppercase tracking-[0.15em] text-gray-400">{sortedMembers.length} Members</span>
                </div>

                {sortedMembers.length === 0 && (searchQuery || roleFilter !== "all" || statusFilter !== "all") && (
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4 bg-primary/10 border border-primary/15">
                      <Users className="w-7 h-7 text-primary/40" />
                    </div>
                    <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-1">No Members Found</h3>
                    <p className="text-xs text-muted-foreground/60 max-w-xs">No members match your current filters. Try adjusting your search or filter criteria.</p>
                  </div>
                )}

                {sortedMembers.map((member, i) => {
                  const isMe = member.userId === user?.id;
                  const canManage = isAdminOrOwner && !isMe && member.role !== "owner";
                  const ms = memberStatsMap[member.userId];
                  const hands = ms?.handsPlayed ?? 0;
                  const wins = ms?.potsWon ?? 0;
                  const winRate = hands > 0 ? Math.round((wins / hands) * 100) : 0;
                  const isOnline = onlineUserIds.has(member.userId);
                  const podiumRank = top3ByChips.get(member.userId);
                  const podiumStyle = podiumRank !== undefined ? PODIUM_STYLES[podiumRank] : null;
                  const trendUp = winRate >= 50;

                  return (
                    <motion.div
                      key={member.userId}
                      data-testid={`row-member-${member.userId}`}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.04 }}
                      className={`md:grid md:grid-cols-12 gap-3 items-start md:items-center px-4 md:px-6 py-4 md:py-6 border-b border-white/[0.04] hover:bg-primary/[0.06] transition-all duration-200 group ${
                        podiumStyle ? "relative" : ""
                      } md:flex-none flex flex-col rounded-xl md:rounded-none m-2 md:m-0 bg-white/[0.02] md:bg-transparent border md:border-0 md:border-b border-white/[0.06]`}
                      style={podiumStyle ? {
                        background: podiumStyle.bg,
                        borderBottom: podiumStyle.border,
                        boxShadow: podiumStyle.glow,
                      } : undefined}
                    >
                      <div className="col-span-5 flex items-center gap-4">
                        <div className="relative shrink-0">
                          {podiumStyle && (
                            <div className="absolute -top-3 -left-1 z-10">
                              <Crown className={`w-5 h-5 ${podiumStyle.iconColor} drop-shadow-lg`} />
                            </div>
                          )}
                          <MemberAvatar
                            avatarId={member.avatarId}
                            displayName={member.displayName}
                            size="xl"
                          />
                          <span
                            className={`absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full border-2 border-background ${
                              isOnline
                                ? "bg-green-400 shadow-[0_0_8px_rgba(74,222,128,0.7)]"
                                : "bg-gray-600"
                            }`}
                          />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <RoleLabel role={member.role} />
                            {podiumStyle && (
                              <span className={`text-[0.5rem] font-black uppercase ${podiumStyle.iconColor} bg-white/5 px-1.5 py-0.5 rounded`}>
                                {PODIUM_STYLES[podiumRank!].label}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-base font-bold text-white truncate">
                              {member.displayName}
                            </span>
                            {isMe && (
                              <span className="text-[0.5rem] text-primary font-bold uppercase bg-primary/10 px-1.5 py-0.5 rounded">You</span>
                            )}
                          </div>
                        </div>
                      </div>

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

                      <div className="col-span-3">
                        <div className="flex items-center gap-1.5">
                          <span data-testid={`text-chips-${member.userId}`} className="text-lg font-bold text-white">
                            {member.chipBalance >= 1000
                              ? `${(member.chipBalance / 1000).toFixed(1)}k`
                              : member.chipBalance.toLocaleString()}
                          </span>
                          <span className="text-xs text-gray-500 font-medium">$</span>
                          {hands > 0 && (
                            <span className={`flex items-center gap-0.5 text-[0.5625rem] font-bold ${trendUp ? "text-green-400" : "text-red-400"}`}>
                              {trendUp ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                            </span>
                          )}
                        </div>
                        <div className="text-[0.625rem] text-gray-500 mt-0.5">
                          {hands} hands | {winRate}% WR
                        </div>
                      </div>

                      <div className="col-span-2 flex items-center justify-end gap-1.5">
                        {canManage && (
                          <div className="relative">
                            <motion.button
                              whileHover={{ scale: 1.1 }}
                              whileTap={{ scale: 0.9 }}
                              data-testid={`button-menu-${member.userId}`}
                              onClick={() => setOpenMenuId(openMenuId === member.userId ? null : member.userId)}
                              className="p-2 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 hover:border-primary/30 transition-all"
                              title="Member actions"
                            >
                              <MoreVertical className="w-4 h-4 text-gray-400" />
                            </motion.button>
                            <AnimatePresence>
                              {openMenuId === member.userId && (
                                <>
                                  {/* Backdrop to close menu */}
                                  <div
                                    className="fixed inset-0 z-10"
                                    onClick={() => setOpenMenuId(null)}
                                  />
                                  <motion.div
                                    initial={{ opacity: 0, y: -5, scale: 0.95 }}
                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                    exit={{ opacity: 0, y: -5, scale: 0.95 }}
                                    className="absolute right-0 top-full mt-1.5 z-20 glass rounded-xl border border-white/10 overflow-hidden min-w-[160px] shadow-lg shadow-black/30"
                                  >
                                    {member.role !== "admin" && (
                                      <button
                                        data-testid={`button-promote-${member.userId}`}
                                        onClick={() => { handleRoleChange(member.userId, "admin"); setOpenMenuId(null); }}
                                        disabled={actionLoading === `role-${member.userId}`}
                                        className="w-full px-4 py-2.5 text-left text-[0.6875rem] font-semibold text-primary hover:bg-primary/10 transition-colors flex items-center gap-2.5 disabled:opacity-50"
                                      >
                                        {actionLoading === `role-${member.userId}` ? (
                                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                        ) : (
                                          <ShieldPlus className="w-3.5 h-3.5" />
                                        )}
                                        Promote to Admin
                                      </button>
                                    )}
                                    {member.role === "admin" && (
                                      <button
                                        data-testid={`button-demote-${member.userId}`}
                                        onClick={() => { handleRoleChange(member.userId, "member"); setOpenMenuId(null); }}
                                        disabled={actionLoading === `role-${member.userId}`}
                                        className="w-full px-4 py-2.5 text-left text-[0.6875rem] font-semibold text-amber-400 hover:bg-amber-500/10 transition-colors flex items-center gap-2.5 disabled:opacity-50"
                                      >
                                        {actionLoading === `role-${member.userId}` ? (
                                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                        ) : (
                                          <ShieldMinus className="w-3.5 h-3.5" />
                                        )}
                                        Demote to Member
                                      </button>
                                    )}
                                    <div className="h-px bg-white/[0.06] mx-2" />
                                    <button
                                      data-testid={`button-kick-${member.userId}`}
                                      onClick={() => { handleKick(member.userId, member.displayName); setOpenMenuId(null); }}
                                      disabled={actionLoading === `kick-${member.userId}`}
                                      className="w-full px-4 py-2.5 text-left text-[0.6875rem] font-semibold text-red-400 hover:bg-red-500/10 transition-colors flex items-center gap-2.5 disabled:opacity-50"
                                    >
                                      {actionLoading === `kick-${member.userId}` ? (
                                        <Loader2 className="w-3.5 h-3.5 animate-spin text-red-400" />
                                      ) : (
                                        <UserX className="w-3.5 h-3.5" />
                                      )}
                                      Kick from Club
                                    </button>
                                  </motion.div>
                                </>
                              )}
                            </AnimatePresence>
                          </div>
                        )}
                        {!canManage && !isMe && (
                          <span className="text-[0.5625rem] text-gray-600 font-bold uppercase tracking-wider">--</span>
                        )}
                        {isMe && (
                          <span className="text-[0.5625rem] text-primary/60 font-bold uppercase tracking-wider">--</span>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>

            <div className="space-y-4">

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="rounded-xl overflow-hidden bg-surface-high/50 backdrop-blur-xl border border-primary/15"
              >
                <div
                  className="px-4 py-3.5 flex items-center justify-between bg-primary/10 border-b border-primary/15"
                >
                  <h3 className="text-xs font-bold uppercase tracking-wider text-white flex items-center gap-2">
                    <span className="w-1 h-4 rounded-full bg-gradient-to-b from-primary to-purple-500" />
                    Club & Alliance News
                  </h3>
                  <div className="relative">
                    <Bell className="w-4 h-4 text-primary" />
                    {announcements.length > 0 && (
                      <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-red-500 text-white text-[0.5rem] font-bold flex items-center justify-center animate-pulse">
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
                        <div className="text-[0.625rem] font-bold text-primary mb-0.5">{a.title}</div>
                        <p className="text-[0.6875rem] text-gray-400 line-clamp-2">{a.content}</p>
                        <span className="text-[0.5625rem] text-gray-600 mt-1 block">{formatTimeAgo(a.createdAt)}</span>
                      </div>
                    ))
                  )}
                </div>
              </motion.div>

              {isAdminOrOwner && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.35 }}
                  className="rounded-xl overflow-hidden bg-surface-high/50 backdrop-blur-xl border border-primary/15"
                >
                  <button
                    data-testid="button-toggle-pending"
                    onClick={() => setShowPending(!showPending)}
                    className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/[0.02] transition-colors"
                  >
                    <h3 className="text-xs font-bold uppercase tracking-wider text-gray-300 flex items-center gap-2">
                      Pending Join Requests
                      {pendingCount > 0 && (
                        <span className="bg-primary/20 text-primary text-[0.5625rem] font-bold px-1.5 py-0.5 rounded-full border border-primary/30">
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
                                    data-testid={`button-approve-${inv.id}`}
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
                                    data-testid={`button-decline-${inv.id}`}
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

              {isAdminOrOwner && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                  className="rounded-xl overflow-hidden bg-surface-high/50 backdrop-blur-xl border border-primary/15"
                  role="dialog"
                  aria-modal="true"
                  aria-label="Invite member"
                >
                  <div
                    className="px-4 py-3.5 bg-primary/10 border-b border-primary/15"
                  >
                    <h3 className="text-xs font-bold uppercase tracking-wider text-white flex items-center gap-2">
                      <UserPlus className="w-4 h-4 text-primary" />
                      Invite Player
                    </h3>
                    <p className="text-[0.5625rem] text-gray-500 mt-0.5">Send an invite to grow your club</p>
                  </div>
                  <div className="p-4">
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-600" />
                        <input
                          data-testid="input-invite-username"
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
                          className="w-full bg-white/5 border border-white/10 rounded-lg pl-8 pr-3 py-2.5 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-primary/30 focus:ring-2 focus:ring-primary/15 transition-all"
                        />
                      </div>
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        data-testid="button-send-invite"
                        onClick={handleInvite}
                        disabled={inviteLoading || !inviteUsername.trim()}
                        className={`px-5 py-2.5 rounded-lg font-bold text-xs transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2 ${inviteUsername.trim() ? "bg-primary text-black" : "bg-primary/15 text-primary"}`}
                      >
                        {inviteLoading ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Send className="w-3.5 h-3.5" />
                        )}
                        Invite
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
                  </div>
                </motion.div>
              )}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="rounded-xl p-5 bg-surface-high/50 backdrop-blur-xl border border-primary/15"
          >
            <h3 className="text-xs font-bold uppercase tracking-wider text-primary/80 mb-4 flex items-center gap-2">
              <span className="w-0.5 h-3.5 bg-primary/60 rounded-full" />
              Daily Missions
            </h3>
            <MissionsGrid missions={missions} onClaim={claimMission} />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="rounded-xl p-5 bg-surface-high/50 backdrop-blur-xl border border-primary/15"
          >
            <h3 className="text-xs font-bold uppercase tracking-wider text-primary/80 mb-4 flex items-center gap-2">
              <span className="w-0.5 h-3.5 bg-primary/60 rounded-full" />
              <CalendarDays className="w-3.5 h-3.5 text-primary" />
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
                      data-testid={`button-remind-${ev.id}`}
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
