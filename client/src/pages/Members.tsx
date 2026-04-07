import { useState, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { DashboardLayout } from "@/components/DashboardLayout";
import { GoldButton, GoldCard, NumberTicker, SectionHeader } from "@/components/premium/PremiumComponents";
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
  MoreVertical, ShieldPlus, ShieldMinus,
  Swords, ChevronLeft, ChevronRight,
} from "lucide-react";

interface H2HData {
  opponentId: string;
  opponentName: string;
  handsPlayedTogether: number;
  userWins: number;
  opponentWins: number;
  splitPots: number;
  userNetChips: number;
  lastPlayed: string | null;
}

function H2HPanel({ data, loading }: { data: H2HData | null; loading: boolean }) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="w-4 h-4 animate-spin text-primary" />
      </div>
    );
  }
  if (!data) return null;

  const totalDecided = data.userWins + data.opponentWins;
  const userPct = totalDecided > 0 ? Math.round((data.userWins / totalDecided) * 100) : 50;
  const oppPct = 100 - userPct;

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.2 }}
      className="overflow-hidden"
    >
      <div className="px-4 md:px-6 py-3 bg-white/[0.02] border-t border-white/[0.04]">
        <div className="text-[0.6875rem] font-bold text-gray-300 mb-2">
          You vs {data.opponentName}
        </div>

        {data.handsPlayedTogether === 0 ? (
          <p className="text-[0.625rem] text-gray-500">No shared hands yet.</p>
        ) : (
          <div className="space-y-2">
            <div>
              <div className="flex justify-between text-[0.5625rem] font-bold mb-1">
                <span className="text-green-400">{data.userWins}W</span>
                {data.splitPots > 0 && <span className="text-gray-500">{data.splitPots} splits</span>}
                <span className="text-red-400">{data.opponentWins}W</span>
              </div>
              <div className="flex h-2 rounded-full overflow-hidden bg-white/5">
                <div className="bg-green-500 transition-all" style={{ width: `${userPct}%` }} />
                <div className="bg-red-500 transition-all" style={{ width: `${oppPct}%` }} />
              </div>
            </div>
            <div className="flex items-center gap-4 text-[0.625rem]">
              <span className="text-gray-500">{data.handsPlayedTogether} hands together</span>
              <span className={`font-bold ${data.userNetChips >= 0 ? "text-green-400" : "text-red-400"}`}>
                {data.userNetChips >= 0 ? "+" : ""}{data.userNetChips.toLocaleString()} chips
              </span>
              {data.lastPlayed && (
                <span className="text-gray-600 ml-auto">
                  Last: {new Date(data.lastPlayed).toLocaleDateString()}
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </motion.div>
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

const ITEMS_PER_PAGE = 8;

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
  const [h2hOpenId, setH2hOpenId] = useState<string | null>(null);
  const [h2hData, setH2hData] = useState<Record<string, H2HData>>({});
  const [h2hLoading, setH2hLoading] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  const toggleH2H = useCallback(async (memberId: string) => {
    if (h2hOpenId === memberId) {
      setH2hOpenId(null);
      return;
    }
    setH2hOpenId(memberId);
    if (h2hData[memberId]) return;
    setH2hLoading(memberId);
    try {
      const res = await fetch(`/api/stats/head-to-head/${memberId}`, { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setH2hData(prev => ({ ...prev, [memberId]: data }));
      }
    } catch {}
    setH2hLoading(null);
  }, [h2hOpenId, h2hData]);

  const pendingInvitations = invitations.filter(inv => inv.status === "pending");

  const onlineCount = useMemo(() => {
    return members.filter(m => onlineUserIds.has(m.userId)).length;
  }, [members, onlineUserIds]);

  const totalBankroll = useMemo(() => {
    return members.reduce((sum, m) => sum + m.chipBalance, 0);
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

  const totalPages = Math.max(1, Math.ceil(sortedMembers.length / ITEMS_PER_PAGE));
  const paginatedMembers = sortedMembers.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  const pendingCount = pendingInvitations.length;

  return (
    <DashboardLayout title="Members">
      <div className="px-4 md:px-8 pb-8">

        {/* Top Header Bar */}
        <div
          className="vault-card px-6 py-3 mb-6 flex items-center justify-between flex-wrap gap-3"
        >
          <div />
          <div className="text-center">
            <span className="text-sm font-bold text-gray-400 uppercase tracking-wider">Total Club Bankroll: </span>
            <span className="text-sm font-black gold-text"><NumberTicker value={totalBankroll} prefix="$" /></span>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-gray-400">Online Members:</span>
              <span className="text-sm font-black text-white">{onlineCount}/{members.length}</span>
            </div>
            {myRole && (
              <span
                className="px-3 py-1 rounded-full text-[0.625rem] font-black uppercase tracking-wider gold-btn"
              >
                {myRole === "owner" ? "Club Owner" : myRole === "admin" ? "Admin" : "Member"}
              </span>
            )}
          </div>
        </div>

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
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">

            {/* Main table area - 3 columns wide */}
            <div className="lg:col-span-3 space-y-4">
              <h2 className="text-lg font-black uppercase tracking-[0.1em] gold-text border-b border-[rgba(212,175,55,0.2)] pb-2">
                Member Management
              </h2>

              {/* Table */}
              <div className="vault-card overflow-hidden">
                {/* Table Header */}
                <div
                  className="hidden md:grid grid-cols-12 gap-2 px-6 py-3"
                  style={{ borderBottom: "1px solid rgba(212,175,55,0.15)" }}
                >
                  <span className="col-span-1 text-[0.625rem] font-bold uppercase tracking-[0.15em] text-[#d4af37]">Avatar</span>
                  <span className="col-span-3 text-[0.625rem] font-bold uppercase tracking-[0.15em] text-[#d4af37]">Member Name</span>
                  <span className="col-span-2 text-[0.625rem] font-bold uppercase tracking-[0.15em] text-[#d4af37]">Join Date</span>
                  <span className="col-span-3 text-[0.625rem] font-bold uppercase tracking-[0.15em] text-[#d4af37]">Total Contribution</span>
                  <span className="col-span-3 text-[0.625rem] font-bold uppercase tracking-[0.15em] text-[#d4af37] text-right">Action</span>
                </div>

                {/* Mobile header */}
                <div className="md:hidden px-4 py-2.5 border-b border-primary/10">
                  <span className="text-[0.625rem] font-bold uppercase tracking-[0.15em] text-gray-400">{sortedMembers.length} Members</span>
                </div>

                {sortedMembers.length === 0 && (searchQuery || roleFilter !== "all" || statusFilter !== "all") && (
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4 bg-primary/10 border border-primary/15">
                      <Users className="w-7 h-7 text-primary/40" />
                    </div>
                    <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-1">No Members Found</h3>
                    <p className="text-xs text-muted-foreground/60 max-w-xs">No members match your current filters.</p>
                  </div>
                )}

                {paginatedMembers.map((member, i) => {
                  const isMe = member.userId === user?.id;
                  const canManage = isAdminOrOwner && !isMe && member.role !== "owner";
                  const ms = memberStatsMap[member.userId];
                  const isOnline = onlineUserIds.has(member.userId);
                  const joinDate = member.joinedAt
                    ? new Date(member.joinedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                    : "N/A";

                  return (
                    <motion.div
                      key={member.userId}
                      data-testid={`row-member-${member.userId}`}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.03 }}
                      className="md:grid md:grid-cols-12 gap-2 items-center px-4 md:px-6 py-3 border-b border-white/[0.04] hover:bg-[rgba(212,175,55,0.04)] transition-all duration-200 flex flex-col md:flex-row"
                    >
                      {/* Avatar */}
                      <div className="col-span-1 flex items-center justify-center">
                        <div className="relative shrink-0">
                          <MemberAvatar
                            avatarId={member.avatarId}
                            displayName={member.displayName}
                            size="lg"
                          />
                          <span
                            className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-background ${
                              isOnline
                                ? "bg-green-400 shadow-[0_0_6px_rgba(74,222,128,0.7)]"
                                : "bg-gray-600"
                            }`}
                          />
                        </div>
                      </div>

                      {/* Member Name */}
                      <div className="col-span-3 min-w-0">
                        <span className="text-sm font-bold text-white truncate block">
                          {member.displayName}
                        </span>
                        {isMe && (
                          <span className="text-[0.5rem] text-primary font-bold uppercase bg-primary/10 px-1.5 py-0.5 rounded">You</span>
                        )}
                      </div>

                      {/* Join Date */}
                      <div className="col-span-2">
                        <span className="text-xs text-gray-400">{joinDate}</span>
                      </div>

                      {/* Total Contribution (chip balance) */}
                      <div className="col-span-3">
                        <span data-testid={`text-chips-${member.userId}`} className="text-sm font-bold text-white">
                          ${member.chipBalance.toLocaleString()}
                        </span>
                      </div>

                      {/* Action buttons */}
                      <div className="col-span-3 flex items-center justify-end gap-2">
                        {canManage && (
                          <>
                            <GoldButton
                              onClick={() => setOpenMenuId(openMenuId === member.userId ? null : member.userId)}
                              className="px-3 py-1.5 text-[0.625rem]"
                            >
                              Edit
                            </GoldButton>
                            <GoldButton
                              onClick={() => { handleKick(member.userId, member.displayName); }}
                              disabled={actionLoading === `kick-${member.userId}`}
                              className="px-3 py-1.5 text-[0.625rem]"
                            >
                              {actionLoading === `kick-${member.userId}` ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : "Kick"}
                            </GoldButton>
                            {member.role !== "admin" ? (
                              <GoldButton
                                onClick={() => { handleRoleChange(member.userId, "admin"); }}
                                disabled={actionLoading === `role-${member.userId}`}
                                className="px-3 py-1.5 text-[0.625rem]"
                              >
                                {actionLoading === `role-${member.userId}` ? (
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                ) : "Promote"}
                              </GoldButton>
                            ) : (
                              <GoldButton
                                onClick={() => { handleRoleChange(member.userId, "member"); }}
                                disabled={actionLoading === `role-${member.userId}`}
                                className="px-3 py-1.5 text-[0.625rem]"
                              >
                                {actionLoading === `role-${member.userId}` ? (
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                ) : "Demote"}
                              </GoldButton>
                            )}
                          </>
                        )}
                        {!canManage && !isMe && (
                          <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => toggleH2H(member.userId)}
                            className="px-3 py-1.5 rounded-md text-[0.625rem] font-bold uppercase tracking-wider gold-btn cursor-pointer"
                            title="Head-to-Head"
                          >
                            <span className="flex items-center gap-1">
                              <Swords className="w-3 h-3" />
                              H2H
                            </span>
                          </motion.button>
                        )}
                        {isMe && (
                          <span className="text-[0.5625rem] text-primary/60 font-bold uppercase tracking-wider">--</span>
                        )}
                      </div>

                      {/* H2H expandable panel */}
                      {!isMe && (
                        <AnimatePresence>
                          {h2hOpenId === member.userId && (
                            <div className="col-span-12">
                              <H2HPanel data={h2hData[member.userId] ?? null} loading={h2hLoading === member.userId} />
                            </div>
                          )}
                        </AnimatePresence>
                      )}
                    </motion.div>
                  );
                })}

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-center gap-2 py-4" style={{ borderTop: "1px solid rgba(212,175,55,0.1)" }}>
                    {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => i + 1).map(page => (
                      <motion.button
                        key={page}
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => setCurrentPage(page)}
                        className={`w-8 h-8 rounded-md text-xs font-bold transition-all cursor-pointer ${
                          currentPage === page
                            ? "gold-btn text-black"
                            : "bg-white/5 text-gray-400 border border-white/10 hover:border-[#d4af37]/30"
                        }`}
                      >
                        {page}
                      </motion.button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Right sidebar - Quick Stats */}
            <div className="space-y-4">

              {/* Quick Stats card */}
              <GoldCard glow padding="p-0" className="overflow-hidden">
                <div
                  className="px-4 py-3"
                  style={{
                    background: "rgba(212,175,55,0.08)",
                    borderBottom: "1px solid rgba(212,175,55,0.15)",
                  }}
                >
                  <SectionHeader icon={Trophy} title="Quick Stats" className="mb-0" />
                </div>

                <div className="p-4 space-y-4">
                  {/* Most Active Table */}
                  <div>
                    <div className="text-[0.625rem] font-bold uppercase tracking-wider text-[#d4af37] mb-1">
                      Most Active Table
                    </div>
                    <div className="text-xs font-bold text-white">
                      High Stakes Poker - Table 1
                    </div>
                    <div className="text-[0.625rem] text-gray-500">
                      ($500/$1k BB)
                    </div>
                  </div>

                  <div className="h-px bg-white/[0.06]" />

                  {/* Top Performing Tournament */}
                  <div>
                    <div className="text-[0.625rem] font-bold uppercase tracking-wider text-[#d4af37] mb-1">
                      Top Performing Tournament
                    </div>
                    <div className="text-xs font-bold text-white">
                      Gold Cup Championship
                    </div>
                    <div className="text-[0.625rem] text-gray-500">
                      (Prize Pool: $1M)
                    </div>
                  </div>
                </div>
              </GoldCard>

              {/* Invite Player (admin only) */}
              {isAdminOrOwner && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                  className="vault-card overflow-hidden"
                  role="dialog"
                  aria-modal="true"
                  aria-label="Invite member"
                >
                  <div
                    className="px-4 py-3"
                    style={{
                      background: "rgba(212,175,55,0.08)",
                      borderBottom: "1px solid rgba(212,175,55,0.15)",
                    }}
                  >
                    <h3 className="text-xs font-bold uppercase tracking-wider text-white flex items-center gap-2">
                      <UserPlus className="w-4 h-4 text-primary" />
                      Invite Player
                    </h3>
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
                        className="px-4 py-2.5 rounded-lg font-bold text-xs transition-all disabled:opacity-40 disabled:cursor-not-allowed gold-btn cursor-pointer flex items-center gap-2"
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

              {/* Pending Requests (admin only) */}
              {isAdminOrOwner && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.35 }}
                  className="vault-card overflow-hidden"
                >
                  <button
                    data-testid="button-toggle-pending"
                    onClick={() => setShowPending(!showPending)}
                    className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/[0.02] transition-colors"
                  >
                    <h3 className="text-xs font-bold uppercase tracking-wider text-gray-300 flex items-center gap-2">
                      Pending Requests
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
                                    className="px-3 py-1.5 rounded-lg gold-btn text-[0.625rem] font-bold uppercase tracking-wider disabled:opacity-50 cursor-pointer"
                                    title="Approve"
                                  >
                                    {actionLoading === inv.id ? (
                                      <Loader2 className="w-3 h-3 animate-spin" />
                                    ) : "OK"}
                                  </motion.button>
                                  <motion.button
                                    whileHover={{ scale: 1.05 }}
                                    whileTap={{ scale: 0.95 }}
                                    data-testid={`button-decline-${inv.id}`}
                                    onClick={() => handleInvitationAction(inv.id, "declined")}
                                    disabled={actionLoading === inv.id}
                                    className="px-3 py-1.5 rounded-lg bg-red-500/80 hover:bg-red-500 text-white transition-colors disabled:opacity-50 text-[0.625rem] font-bold uppercase tracking-wider cursor-pointer"
                                    title="Decline"
                                  >
                                    No
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
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
