import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useAuth } from "@/lib/auth-context";
import { useClub } from "@/lib/club-context";
import { MemberAvatar } from "@/components/shared/MemberAvatar";
import {
  Trophy, Crown, TrendingUp,
  Users, Coins, Plus, Loader2,
  Settings, Search, Check, X,
  Shield
} from "lucide-react";
import pokerTableImg from "@assets/generated_images/poker_table_perspective.png";

/* ── Circuit Board SVG Pattern ────────────────────────── */
const CIRCUIT_SVG = `url("data:image/svg+xml,%3Csvg width='200' height='200' xmlns='http://www.w3.org/2000/svg'%3E%3Cdefs%3E%3Cstyle%3Eline%7Bstroke:%23d4a843;stroke-width:0.5;opacity:0.15%7Dcircle%7Bfill:%23d4a843;opacity:0.2%7D%3C/style%3E%3C/defs%3E%3Cline x1='20' y1='0' x2='20' y2='60'/%3E%3Cline x1='20' y1='60' x2='80' y2='60'/%3E%3Cline x1='80' y1='60' x2='80' y2='120'/%3E%3Cline x1='80' y1='120' x2='140' y2='120'/%3E%3Cline x1='140' y1='120' x2='140' y2='180'/%3E%3Cline x1='140' y1='180' x2='200' y2='180'/%3E%3Cline x1='60' y1='0' x2='60' y2='40'/%3E%3Cline x1='60' y1='40' x2='120' y2='40'/%3E%3Cline x1='120' y1='40' x2='120' y2='100'/%3E%3Cline x1='160' y1='0' x2='160' y2='30'/%3E%3Cline x1='160' y1='30' x2='200' y2='30'/%3E%3Cline x1='0' y1='140' x2='40' y2='140'/%3E%3Cline x1='40' y1='140' x2='40' y2='200'/%3E%3Ccircle cx='20' cy='60' r='2'/%3E%3Ccircle cx='80' cy='60' r='2'/%3E%3Ccircle cx='80' cy='120' r='2'/%3E%3Ccircle cx='140' cy='120' r='2'/%3E%3Ccircle cx='60' cy='40' r='2'/%3E%3Ccircle cx='120' cy='40' r='2'/%3E%3Ccircle cx='160' cy='30' r='2'/%3E%3Ccircle cx='40' cy='140' r='2'/%3E%3C/svg%3E")`;

export default function ClubDashboard() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const {
    club, members, invitations,
    memberStatsMap, onlineUserIds, loading,
    createClub, isAdminOrOwner, handleInvitation,
  } = useClub();

  const [creatingTable, setCreatingTable] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [alliance, setAlliance] = useState<{ id: string; name: string; clubIds: string[] } | null>(null);

  // Fetch club's alliance using the specific endpoint
  useEffect(() => {
    if (!club) return;
    fetch(`/api/clubs/${club.id}/alliance`)
      .then(r => r.ok ? r.json() : null)
      .then((data) => setAlliance(data || null))
      .catch(() => setAlliance(null));
  }, [club]);

  // Create Club form state
  const [newClubName, setNewClubName] = useState("");
  const [newClubDescription, setNewClubDescription] = useState("");
  const [newClubIsPublic, setNewClubIsPublic] = useState(true);
  const [creatingClub, setCreatingClub] = useState(false);

  const pendingInvitations = invitations.filter(inv => inv.status === "pending");

  const handleCreateTable = async () => {
    if (creatingTable || !club) return;
    setCreatingTable(true);
    try {
      const res = await fetch("/api/tables", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: `${club.name} Table`,
          smallBlind: 5,
          bigBlind: 10,
          minBuyIn: 200,
          maxBuyIn: 2000,
          maxPlayers: 6,
          clubId: club.id,
        }),
      });
      if (res.ok) {
        const table = await res.json();
        navigate(`/game/${table.id}`);
      }
    } catch {} finally {
      setCreatingTable(false);
    }
  };

  const [createError, setCreateError] = useState("");

  const handleCreateClub = async () => {
    if (creatingClub || !newClubName.trim()) return;
    setCreatingClub(true);
    setCreateError("");
    try {
      const result = await createClub({
        name: newClubName.trim(),
        description: newClubDescription.trim() || undefined,
        isPublic: newClubIsPublic,
      });
      if (!result) {
        setCreateError("Failed to create club. Please try again.");
      }
    } catch (err: any) {
      setCreateError(err.message || "Failed to create club");
    } finally {
      setCreatingClub(false);
    }
  };

  const handleInvitationAction = async (invId: string, status: "accepted" | "declined") => {
    setActionLoading(invId);
    await handleInvitation(invId, status);
    setActionLoading(null);
  };

  return (
    <DashboardLayout title="Club Dashboard">
      <div className="px-8 pb-8 relative">
        {/* Casino table background */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <img
            src={pokerTableImg}
            alt=""
            className="w-full h-64 object-cover opacity-15 blur-[1px]"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#111b2a]/80 to-[#111b2a]" />
        </div>
        {/* Circuit board background overlay */}
        <div
          className="absolute inset-0 pointer-events-none opacity-[0.07]"
          style={{ backgroundImage: CIRCUIT_SVG, backgroundSize: "200px 200px" }}
        />

        <div className="relative z-10">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-6 h-6 animate-spin text-amber-400" />
            </div>
          ) : !club ? (
            /* ─── No Club — Create or Browse ──────────────────────── */
            <div className="max-w-md mx-auto py-12">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="glass rounded-2xl p-8 border border-white/5 text-center"
              >
                <div className="w-16 h-16 rounded-2xl bg-amber-500/15 border border-amber-500/20 flex items-center justify-center mx-auto mb-5">
                  <Trophy className="w-8 h-8 text-amber-400" />
                </div>
                <h3 className="text-lg font-bold text-white mb-1.5">Create Your Club</h3>
                <p className="text-xs text-gray-500 mb-6">Start your own poker club and invite friends to play</p>

                <div className="space-y-3 text-left">
                  <input
                    type="text"
                    value={newClubName}
                    onChange={(e) => setNewClubName(e.target.value)}
                    placeholder="Club name"
                    className="w-full px-4 py-2.5 rounded-lg text-xs text-white placeholder-gray-600 outline-none"
                    style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
                  />
                  <textarea
                    value={newClubDescription}
                    onChange={(e) => setNewClubDescription(e.target.value)}
                    placeholder="Description (optional)"
                    rows={2}
                    className="w-full px-4 py-2.5 rounded-lg text-xs text-white placeholder-gray-600 outline-none resize-none"
                    style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
                  />
                  <label className="flex items-center gap-2 text-[0.625rem] text-gray-400 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newClubIsPublic}
                      onChange={(e) => setNewClubIsPublic(e.target.checked)}
                      className="rounded"
                    />
                    Public Club (anyone can find & request to join)
                  </label>
                </div>

                {createError && (
                  <div className="mt-3 flex items-center gap-2 text-[0.625rem] text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                    <X className="w-3 h-3 shrink-0" />
                    {createError}
                  </div>
                )}

                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleCreateClub}
                  disabled={creatingClub || !newClubName.trim()}
                  className="w-full mt-5 py-2.5 rounded-lg text-[0.625rem] font-bold uppercase tracking-wider text-black flex items-center justify-center gap-1.5 disabled:opacity-50"
                  style={{ background: "linear-gradient(135deg, #c9a84c, #f0d078)", boxShadow: "0 0 20px rgba(201,168,76,0.2)" }}
                >
                  {creatingClub ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
                  Create Club
                </motion.button>

                <div className="flex items-center gap-3 mt-4">
                  <div className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.06)" }} />
                  <span className="text-[0.5625rem] text-gray-600 uppercase tracking-wider">or</span>
                  <div className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.06)" }} />
                </div>

                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => navigate("/clubs/browse")}
                  className="w-full mt-4 py-2.5 rounded-lg text-[0.625rem] font-bold uppercase tracking-wider text-gray-400 hover:text-white transition-colors flex items-center justify-center gap-2"
                  style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}
                >
                  <Search className="w-3.5 h-3.5" />
                  Browse Clubs
                </motion.button>
              </motion.div>
            </div>
          ) : (
            /* ─── Has Club — Club Manager Dashboard ──────────────── */
            <>
              {/* ── CLUB MANAGER Header ── */}
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center justify-between mb-8"
              >
                <div className="flex-1" />
                <div className="flex items-center gap-3">
                  <Crown className="w-8 h-8 text-amber-400 drop-shadow-[0_0_12px_rgba(201,168,76,0.5)]" />
                  <div className="text-center">
                    <h2
                      className="text-2xl font-black tracking-[0.2em] uppercase gold-text"
                      style={{ textShadow: "0 0 20px rgba(201,168,76,0.3)" }}
                    >
                      CLUB MANAGER
                    </h2>
                    <div className="text-[0.625rem] text-gray-500 mt-0.5 tracking-wider">
                      {club.name} | {members.length} members
                    </div>
                  </div>
                </div>
                <div className="flex-1 flex justify-end">
                  <div className="flex items-center gap-2">
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={handleCreateTable}
                      disabled={creatingTable}
                      className="px-5 py-2 rounded-lg text-[0.625rem] font-bold uppercase tracking-wider text-black flex items-center gap-1.5 disabled:opacity-50"
                      style={{
                        background: "linear-gradient(135deg, #c9a84c, #f0d078)",
                        boxShadow: "0 0 20px rgba(201,168,76,0.3)",
                      }}
                    >
                      {creatingTable ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
                      Create Table
                    </motion.button>
                    <button
                      onClick={() => navigate("/club/settings")}
                      className="p-2.5 rounded-lg border border-white/10 hover:border-amber-500/30 transition-all"
                      style={{ background: "rgba(255,255,255,0.03)" }}
                    >
                      <Settings className="w-5 h-5 text-gray-400 hover:text-amber-400 transition-colors" />
                    </button>
                  </div>
                </div>
              </motion.div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* ─── Main Content: Member List Table (2 cols) ─── */}
                <div className="lg:col-span-2">
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="rounded-xl overflow-hidden"
                    style={{
                      background: "rgba(20,31,40,0.65)",
                      backdropFilter: "blur(16px)",
                      border: "1px solid rgba(212,168,67,0.20)",
                      boxShadow: "0 0 40px rgba(212,168,67,0.06), inset 0 1px 0 rgba(212,168,67,0.08)",
                    }}
                  >
                    {/* Gold header bar */}
                    <div
                      className="px-6 py-3 border-b border-amber-500/25"
                      style={{
                        background: "linear-gradient(90deg, rgba(212,168,67,0.18), rgba(180,140,50,0.06))",
                        boxShadow: "inset 0 -1px 0 rgba(212,168,67,0.15)",
                      }}
                    >
                      <h3
                        className="text-sm font-black uppercase tracking-[0.15em] text-amber-400"
                        style={{ textShadow: "0 0 15px rgba(212,168,67,0.4)" }}
                      >
                        Member List
                      </h3>
                    </div>

                    {/* Table header */}
                    <div className="grid grid-cols-12 gap-3 px-6 py-3 border-b border-white/5">
                      <span className="col-span-1 text-[0.5625rem] font-bold uppercase tracking-[0.15em] text-gray-400">Avatar</span>
                      <span className="col-span-3 text-[0.5625rem] font-bold uppercase tracking-[0.15em] text-gray-400">Name</span>
                      <span className="col-span-3 text-[0.5625rem] font-bold uppercase tracking-[0.15em] text-gray-400">Chips</span>
                      <span className="col-span-3 text-[0.5625rem] font-bold uppercase tracking-[0.15em] text-gray-400">Hands Played</span>
                      <span className="col-span-2 text-[0.5625rem] font-bold uppercase tracking-[0.15em] text-gray-400">Status</span>
                    </div>

                    {/* Member rows */}
                    {members.length === 0 ? (
                      <div className="py-10 text-center">
                        <Users className="w-8 h-8 text-gray-700 mx-auto mb-2" />
                        <p className="text-[0.6875rem] text-gray-600">No members yet</p>
                      </div>
                    ) : (
                      members.map((member, i) => {
                        const ms = memberStatsMap[member.userId];
                        const isOnline = onlineUserIds.has(member.userId);
                        const status = isOnline ? "Active" : member.role === "owner" ? "VIP" : "Offline";
                        const statusColor = isOnline
                          ? "text-green-400 bg-green-500/15 border-green-500/20"
                          : status === "VIP"
                            ? "text-purple-400 bg-purple-500/15 border-purple-500/20"
                            : "text-gray-500 bg-gray-500/10 border-gray-500/20";

                        return (
                          <motion.div
                            key={member.userId}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: i * 0.04 }}
                            className="grid grid-cols-12 gap-3 items-center px-6 py-4 border-b border-white/[0.04] hover:bg-amber-500/[0.06] transition-all"
                          >
                            {/* Avatar */}
                            <div className="col-span-1 flex justify-center">
                              <MemberAvatar
                                avatarId={member.avatarId}
                                displayName={member.displayName}
                                size="lg"
                              />
                            </div>
                            {/* Name */}
                            <div className="col-span-3 min-w-0">
                              <span className="text-sm font-bold text-white truncate block">
                                {member.displayName}
                              </span>
                              <span className="text-[0.5625rem] text-gray-600 truncate block">@{member.username}</span>
                            </div>
                            {/* Chips */}
                            <div className="col-span-3 flex items-center gap-1.5">
                              <Coins className="w-4 h-4 text-amber-400" />
                              <span className="text-base font-bold text-white">
                                {member.chipBalance.toLocaleString()}
                              </span>
                            </div>
                            {/* Hands Played */}
                            <div className="col-span-3 text-base font-medium text-gray-300">
                              {ms?.handsPlayed ?? 0}
                            </div>
                            {/* Status */}
                            <div className="col-span-2">
                              <span className={`inline-block px-3 py-1.5 rounded-md text-[0.625rem] font-bold uppercase tracking-wider border ${statusColor}`}>
                                {status}
                              </span>
                            </div>
                          </motion.div>
                        );
                      })
                    )}
                  </motion.div>
                </div>

                {/* ─── Right Panel: Pending Join Requests ─── */}
                <div className="space-y-4">
                  <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.2 }}
                    className="rounded-xl overflow-hidden"
                    style={{
                      background: "rgba(20,31,40,0.65)",
                      backdropFilter: "blur(16px)",
                      border: "1px solid rgba(212,168,67,0.12)",
                      boxShadow: "0 0 25px rgba(212,168,67,0.04)",
                    }}
                  >
                    <div className="px-4 py-3 border-b border-amber-500/10">
                      <h3 className="text-xs font-bold uppercase tracking-[0.12em] text-white flex items-center gap-2">
                        Pending Join Requests
                        {pendingInvitations.length > 0 && (
                          <span className="bg-amber-500/20 text-amber-400 text-[0.5625rem] font-bold px-1.5 py-0.5 rounded-full border border-amber-500/30">
                            {pendingInvitations.length}
                          </span>
                        )}
                      </h3>
                    </div>
                    {pendingInvitations.length === 0 ? (
                      <div className="py-8 text-center">
                        <Users className="w-6 h-6 text-gray-700 mx-auto mb-2" />
                        <p className="text-[0.625rem] text-gray-600">No pending requests</p>
                      </div>
                    ) : (
                      <div className="p-4 space-y-3">
                        {pendingInvitations.map(inv => (
                          <motion.div
                            key={inv.id}
                            initial={{ opacity: 0, y: -5 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="space-y-2"
                          >
                            <div className="flex items-center gap-3">
                              <MemberAvatar avatarId={inv.avatarId ?? null} displayName={inv.displayName} size="sm" />
                              <div className="flex-1 min-w-0">
                                <div className="text-xs font-bold text-white truncate">{inv.displayName}</div>
                                <div className="text-[0.5625rem] text-gray-500">
                                  {inv.type === "request" ? "Request to Join" : "Pending Invite"}
                                </div>
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <motion.button
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={() => handleInvitationAction(inv.id, "accepted")}
                                disabled={actionLoading === inv.id}
                                className="flex-1 py-1.5 rounded-lg bg-green-500/80 text-white text-[0.5625rem] font-bold uppercase flex items-center justify-center gap-1 hover:bg-green-500 transition-colors disabled:opacity-50"
                              >
                                {actionLoading === inv.id ? (
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                ) : (
                                  <><Check className="w-3 h-3" /> Approve</>
                                )}
                              </motion.button>
                              <motion.button
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={() => handleInvitationAction(inv.id, "declined")}
                                disabled={actionLoading === inv.id}
                                className="flex-1 py-1.5 rounded-lg bg-red-500/80 text-white text-[0.5625rem] font-bold uppercase flex items-center justify-center gap-1 hover:bg-red-500 transition-colors disabled:opacity-50"
                              >
                                <X className="w-3 h-3" /> Decline
                              </motion.button>
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    )}
                  </motion.div>

                  {/* Alliance Info */}
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.25 }}
                    className="rounded-xl overflow-hidden"
                    style={{
                      background: "rgba(20,31,40,0.65)",
                      backdropFilter: "blur(16px)",
                      border: "1px solid rgba(212,168,67,0.12)",
                      boxShadow: "0 0 25px rgba(212,168,67,0.04)",
                    }}
                  >
                    <div className="px-4 py-3 border-b border-amber-500/10">
                      <h3 className="text-xs font-bold uppercase tracking-[0.12em] text-white flex items-center gap-2">
                        <Shield className="w-3.5 h-3.5 text-purple-400" /> Alliance
                      </h3>
                    </div>
                    {alliance ? (
                      <div className="p-4">
                        <div className="text-sm font-bold text-white mb-1">{alliance.name}</div>
                        <div className="text-[0.625rem] text-gray-500 mb-3">
                          {(alliance.clubIds as string[]).length} clubs
                        </div>
                        <motion.button
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => navigate(`/alliances/${alliance.id}`)}
                          className="w-full py-2 rounded-lg text-[0.625rem] font-bold uppercase tracking-wider text-purple-400 border border-purple-500/20 hover:bg-purple-500/10 transition-colors"
                        >
                          View Alliance
                        </motion.button>
                      </div>
                    ) : (
                      <div className="p-4 text-center">
                        <p className="text-[0.625rem] text-gray-600 mb-3">Not part of any alliance</p>
                        <motion.button
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => navigate("/leagues?tab=alliances")}
                          className="w-full py-2 rounded-lg text-[0.625rem] font-bold uppercase tracking-wider text-amber-400 border border-amber-500/20 hover:bg-amber-500/10 transition-colors"
                        >
                          Browse Alliances
                        </motion.button>
                      </div>
                    )}
                  </motion.div>

                  {/* Quick Stats */}
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="rounded-xl p-4"
                    style={{
                      background: "rgba(20,31,40,0.65)",
                      backdropFilter: "blur(16px)",
                      border: "1px solid rgba(212,168,67,0.12)",
                      boxShadow: "0 0 25px rgba(212,168,67,0.04)",
                    }}
                  >
                    <h3 className="text-xs font-bold uppercase tracking-[0.12em] text-white mb-3">
                      Club Overview
                    </h3>
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[0.625rem] text-gray-500 flex items-center gap-1.5">
                          <Users className="w-3 h-3" /> Members
                        </span>
                        <span className="text-xs font-bold text-green-400">{club.memberCount}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[0.625rem] text-gray-500 flex items-center gap-1.5">
                          <TrendingUp className="w-3 h-3" /> Online Now
                        </span>
                        <span className="text-xs font-bold text-amber-400">
                          {members.filter(m => onlineUserIds.has(m.userId)).length}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[0.625rem] text-gray-500 flex items-center gap-1.5">
                          <Coins className="w-3 h-3" /> Your Balance
                        </span>
                        <span className="text-xs font-bold text-amber-400">
                          {user?.chipBalance?.toLocaleString() ?? 0}
                        </span>
                      </div>
                    </div>
                  </motion.div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
