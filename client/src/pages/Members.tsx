import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useAuth } from "@/lib/auth-context";
import {
  Crown, Shield, User, Clock, Loader2,
  Gamepad2, Coins, Target, Users, UserPlus,
  ChevronDown, ChevronUp, ShieldCheck,
  UserX, Check, X, Send, Search,
  TrendingUp, AlertCircle
} from "lucide-react";

/* ── Types ─────────────────────────────────────────────── */

interface ClubMember {
  userId: string;
  username: string;
  displayName: string;
  avatarId: string | null;
  chipBalance: number;
  role: string;
  joinedAt: string;
}

interface ClubData {
  id: string;
  name: string;
  memberCount: number;
}

interface PlayerStats {
  handsPlayed: number;
  potsWon: number;
  bestWinStreak: number;
  currentWinStreak: number;
  totalWinnings: number;
}

interface MemberStats {
  handsPlayed: number;
  potsWon: number;
  bestWinStreak: number;
  currentWinStreak: number;
  totalWinnings: number;
  vpip: number;
  pfr: number;
  showdownCount: number;
}

interface Invitation {
  id: string;
  clubId: string;
  userId: string;
  username: string;
  displayName: string;
  type: string;
  status: string;
  createdAt: string;
}

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

/* ── Mission types ─────────────────────────────────────── */

interface MissionData {
  id: string;
  type: string;
  label: string;
  description: string | null;
  target: number;
  reward: number;
  progress: number;
  completed: boolean;
  claimed: boolean;
}

const MISSION_ICON_MAP: Record<string, any> = {
  hands_played: Gamepad2,
  pots_won: Coins,
  win_streak: Target,
  consecutive_wins: TrendingUp,
  sng_win: Clock,
  bomb_pot: Target,
  heads_up_win: Users,
};

/* ── Main Component ────────────────────────────────────── */

export default function Members() {
  const { user } = useAuth();
  const [club, setClub] = useState<ClubData | null>(null);
  const [members, setMembers] = useState<ClubMember[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<PlayerStats | null>(null);
  const [memberStatsMap, setMemberStatsMap] = useState<Record<string, MemberStats>>({});
  const [missions, setMissions] = useState<MissionData[]>([]);
  const [onlineUserIds, setOnlineUserIds] = useState<Set<string>>(new Set());

  // My role in the club
  const [myRole, setMyRole] = useState<string>("member");

  // Invite input
  const [inviteUsername, setInviteUsername] = useState("");
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteMsg, setInviteMsg] = useState<{ text: string; type: "success" | "error" } | null>(null);

  // Action feedback
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Collapsible sections
  const [showPending, setShowPending] = useState(true);

  const isAdminOrOwner = myRole === "owner" || myRole === "admin";

  /* ── Data Loading ──────────────────────────────────────── */

  const loadData = useCallback(async () => {
    try {
      const [clubsRes, statsRes, missionsRes] = await Promise.all([
        fetch("/api/clubs"),
        fetch("/api/stats/me"),
        fetch("/api/missions"),
      ]);

      if (missionsRes.ok) {
        setMissions(await missionsRes.json());
      }

      if (statsRes.ok) {
        setStats(await statsRes.json());
      }

      if (!clubsRes.ok) return;
      const clubs: ClubData[] = await clubsRes.json();
      if (clubs.length === 0) { setLoading(false); return; }

      const myClub = clubs[0];
      setClub(myClub);

      const [membersRes, invRes, memberStatsRes] = await Promise.all([
        fetch(`/api/clubs/${myClub.id}/members`),
        fetch(`/api/clubs/${myClub.id}/invitations`),
        fetch(`/api/clubs/${myClub.id}/members/stats`),
      ]);

      if (membersRes.ok) {
        const memberData: ClubMember[] = await membersRes.json();
        setMembers(memberData);
        // Determine my role
        const me = memberData.find(m => m.userId === user?.id);
        if (me) setMyRole(me.role);
      }

      if (invRes.ok) {
        const invData: Invitation[] = await invRes.json();
        setInvitations(invData.filter(inv => inv.status === "pending"));
      }

      if (memberStatsRes.ok) {
        setMemberStatsMap(await memberStatsRes.json());
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  /* ── Poll online status ─────────────────────────────────── */

  useEffect(() => {
    const fetchOnline = async () => {
      try {
        const res = await fetch("/api/online-users");
        if (res.ok) {
          const ids: string[] = await res.json();
          setOnlineUserIds(new Set(ids));
        }
      } catch {
        // silently fail
      }
    };

    fetchOnline();
    const interval = setInterval(fetchOnline, 30_000);
    return () => clearInterval(interval);
  }, []);

  /* ── Actions ───────────────────────────────────────────── */

  const handleInvite = async () => {
    if (!inviteUsername.trim() || !club) return;
    setInviteLoading(true);
    setInviteMsg(null);
    try {
      const res = await fetch(`/api/clubs/${club.id}/invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: inviteUsername.trim(), type: "invite" }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({ message: "Failed to send invite" }));
        throw new Error(data.message || "Failed to send invite");
      }
      setInviteMsg({ text: `Invite sent to "${inviteUsername.trim()}"`, type: "success" });
      setInviteUsername("");
      await loadData();
    } catch (err: any) {
      setInviteMsg({ text: err.message, type: "error" });
    } finally {
      setInviteLoading(false);
    }
  };

  const handleInvitationAction = async (invId: string, status: "accepted" | "declined") => {
    if (!club) return;
    setActionLoading(invId);
    try {
      await fetch(`/api/clubs/${club.id}/invitations/${invId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      await loadData();
    } catch {
      // silently fail
    } finally {
      setActionLoading(null);
    }
  };

  const handleRoleChange = async (memberId: string, newRole: "admin" | "member") => {
    if (!club) return;
    setActionLoading(`role-${memberId}`);
    try {
      await fetch(`/api/clubs/${club.id}/members/${memberId}/role`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: newRole }),
      });
      await loadData();
    } catch {
      // silently fail
    } finally {
      setActionLoading(null);
    }
  };

  const handleKick = async (memberId: string, displayName: string) => {
    if (!club) return;
    if (!window.confirm(`Remove ${displayName} from the club?`)) return;
    setActionLoading(`kick-${memberId}`);
    try {
      await fetch(`/api/clubs/${club.id}/members/${memberId}`, {
        method: "DELETE",
      });
      await loadData();
    } catch {
      // silently fail
    } finally {
      setActionLoading(null);
    }
  };

  /* ── Render helpers ────────────────────────────────────── */

  const sortedMembers = [...members].sort((a, b) => {
    const order: Record<string, number> = { owner: 0, admin: 1, manager: 1, member: 2 };
    return (order[a.role] ?? 3) - (order[b.role] ?? 3);
  });

  const pendingCount = invitations.length;

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
                            <div
                              className="w-11 h-11 rounded-full overflow-hidden border-2 border-white/10 flex items-center justify-center bg-gradient-to-br from-cyan-500/30 to-purple-500/30 shadow-[0_0_12px_rgba(0,200,255,0.15)]"
                              style={{ boxShadow: "0 0 15px rgba(0,240,255,0.1), 0 0 12px rgba(0,200,255,0.15)" }}
                            >
                              <span className="text-sm font-bold text-white">
                                {member.displayName.charAt(0).toUpperCase()}
                              </span>
                            </div>
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
                        {invitations.length === 0 ? (
                          <div className="px-4 pb-4 text-center">
                            <div className="py-4">
                              <Users className="w-6 h-6 text-gray-700 mx-auto mb-2" />
                              <p className="text-[10px] text-gray-600">No pending requests</p>
                            </div>
                          </div>
                        ) : (
                          <div className="px-4 pb-3 space-y-2">
                            {invitations.map((inv) => (
                              <motion.div
                                key={inv.id}
                                initial={{ opacity: 0, y: -10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                className="flex items-center gap-3 p-2.5 rounded-lg bg-white/[0.02] border border-white/[0.04]"
                              >
                                {/* Avatar */}
                                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-500/30 to-orange-500/30 flex items-center justify-center border border-white/10 shrink-0">
                                  <span className="text-[10px] font-bold text-white">
                                    {inv.displayName.charAt(0).toUpperCase()}
                                  </span>
                                </div>
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
            {missions.length === 0 ? (
              <div className="text-center py-4">
                <Target className="w-6 h-6 text-gray-700 mx-auto mb-2" />
                <p className="text-[11px] text-gray-600">No missions available</p>
              </div>
            ) : (
            <div className="grid grid-cols-3 gap-3">
              {missions.slice(0, 6).map((mission) => {
                const Icon = MISSION_ICON_MAP[mission.type] || Target;
                const progressPct = Math.min(Math.round((mission.progress / mission.target) * 100), 100);
                return (
                  <div key={mission.id} className="text-center">
                    <div className={`w-10 h-10 rounded-lg ${mission.completed ? "bg-green-500/15 border-green-500/20" : "bg-cyan-500/10 border-cyan-500/15"} border flex items-center justify-center mx-auto mb-2`}>
                      <Icon className={`w-4 h-4 ${mission.completed ? "text-green-400" : "text-cyan-400"}`} />
                    </div>
                    <div className="text-[10px] font-medium text-gray-300 mb-1">{mission.label}</div>
                    <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden mb-1">
                      <div
                        className={`h-full rounded-full transition-all ${mission.completed ? "bg-gradient-to-r from-green-500 to-emerald-400" : "bg-gradient-to-r from-cyan-500 to-green-500"}`}
                        style={{ width: `${progressPct}%` }}
                      />
                    </div>
                    <div className="text-[9px] text-gray-500">
                      {mission.progress}/{mission.target}
                      {mission.completed
                        ? mission.claimed
                          ? <span className="text-gray-500 ml-1">Claimed</span>
                          : <span className="text-green-400 ml-1">Done!</span>
                        : <span className="text-amber-400 ml-1">+{mission.reward}</span>
                      }
                    </div>
                  </div>
                );
              })}
            </div>
            )}
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
                <div className="text-lg font-bold text-cyan-400">{stats?.handsPlayed ?? 0}</div>
                <div className="text-[9px] text-gray-500 uppercase tracking-wider">Hands Played</div>
              </div>
              <div className="text-center p-3 rounded-lg bg-white/5 border border-green-500/15" style={{ boxShadow: "0 0 20px rgba(0,255,157,0.05)" }}>
                <div className="text-lg font-bold text-green-400">{stats?.potsWon ?? 0}</div>
                <div className="text-[9px] text-gray-500 uppercase tracking-wider">Pots Won</div>
              </div>
              <div className="text-center p-3 rounded-lg bg-white/5 border border-amber-500/15" style={{ boxShadow: "0 0 20px rgba(234,179,8,0.05)" }}>
                <div className="text-lg font-bold text-amber-400">{stats?.bestWinStreak ?? 0}</div>
                <div className="text-[9px] text-gray-500 uppercase tracking-wider">Best Streak</div>
              </div>
              <div className="text-center p-3 rounded-lg bg-white/5 border border-purple-500/15" style={{ boxShadow: "0 0 20px rgba(168,85,247,0.05)" }}>
                <div className="text-lg font-bold text-purple-400">{stats?.currentWinStreak ?? 0}</div>
                <div className="text-[9px] text-gray-500 uppercase tracking-wider">Current Streak</div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </DashboardLayout>
  );
}
