import { useState, useEffect, useRef } from "react";
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
  Shield, Medal, Gamepad2, Activity,
  Layers, Wifi, Image, Megaphone, LayoutDashboard
} from "lucide-react";
import { ClubTournaments } from "@/components/club/ClubTournaments";
import { ClubLeaderboard } from "@/components/club/ClubLeaderboard";
import pokerTableImg from "@assets/generated_images/poker_table_perspective.webp";

const CIRCUIT_SVG = `url("data:image/svg+xml,%3Csvg width='200' height='200' xmlns='http://www.w3.org/2000/svg'%3E%3Cdefs%3E%3Cstyle%3Eline%7Bstroke:%23d4a843;stroke-width:0.5;opacity:0.15%7Dcircle%7Bfill:%23d4a843;opacity:0.2%7D%3C/style%3E%3C/defs%3E%3Cline x1='20' y1='0' x2='20' y2='60'/%3E%3Cline x1='20' y1='60' x2='80' y2='60'/%3E%3Cline x1='80' y1='60' x2='80' y2='120'/%3E%3Cline x1='80' y1='120' x2='140' y2='120'/%3E%3Cline x1='140' y1='120' x2='140' y2='180'/%3E%3Cline x1='140' y1='180' x2='200' y2='180'/%3E%3Cline x1='60' y1='0' x2='60' y2='40'/%3E%3Cline x1='60' y1='40' x2='120' y2='40'/%3E%3Cline x1='120' y1='40' x2='120' y2='100'/%3E%3Cline x1='160' y1='0' x2='160' y2='30'/%3E%3Cline x1='160' y1='30' x2='200' y2='30'/%3E%3Cline x1='0' y1='140' x2='40' y2='140'/%3E%3Cline x1='40' y1='140' x2='40' y2='200'/%3E%3Ccircle cx='20' cy='60' r='2'/%3E%3Ccircle cx='80' cy='60' r='2'/%3E%3Ccircle cx='80' cy='120' r='2'/%3E%3Ccircle cx='140' cy='120' r='2'/%3E%3Ccircle cx='60' cy='40' r='2'/%3E%3Ccircle cx='120' cy='40' r='2'/%3E%3Ccircle cx='160' cy='30' r='2'/%3E%3Ccircle cx='40' cy='140' r='2'/%3E%3C/svg%3E")`;

export const CLUB_LOGO_OPTIONS = [
  { id: "lions", label: "Lions", url: "/attached_assets/generated_images/clubs/club_lions.webp" },
  { id: "sharks", label: "Sharks", url: "/attached_assets/generated_images/clubs/club_sharks.webp" },
  { id: "eagles", label: "Eagles", url: "/attached_assets/generated_images/clubs/club_eagles.webp" },
  { id: "dragons", label: "Dragons", url: "/attached_assets/generated_images/clubs/club_dragons.webp" },
  { id: "wolves", label: "Wolves", url: "/attached_assets/generated_images/clubs/club_wolves.webp" },
  { id: "aces", label: "Aces", url: "/attached_assets/generated_images/clubs/club_aces.webp" },
];

function AnimatedNumber({ value, className }: { value: number; className?: string }) {
  const [display, setDisplay] = useState(0);
  const ref = useRef<number | null>(null);
  useEffect(() => {
    const start = ref.current ?? 0;
    const diff = value - start;
    if (diff === 0) { setDisplay(value); return; }
    const duration = 600;
    const startTime = performance.now();
    const tick = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(start + diff * eased);
      setDisplay(current);
      if (progress < 1) requestAnimationFrame(tick);
      else ref.current = value;
    };
    requestAnimationFrame(tick);
    return () => { ref.current = value; };
  }, [value]);
  return <span className={className}>{display.toLocaleString()}</span>;
}

export default function ClubDashboard() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const {
    club, members, invitations,
    memberStatsMap, onlineUserIds, loading,
    createClub, isAdminOrOwner, handleInvitation,
    clubTournaments,
  } = useClub();

  const [activeTab, setActiveTab] = useState<"overview" | "members" | "tournaments" | "leaderboard">("overview");
  const [creatingTable, setCreatingTable] = useState(false);
  const [clubTables, setClubTables] = useState<any[]>([]);
  const [clubTablesLoading, setClubTablesLoading] = useState(false);
  const [clubActivity, setClubActivity] = useState<any[]>([]);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [alliance, setAlliance] = useState<{ id: string; name: string; clubIds: string[] } | null>(null);

  useEffect(() => {
    if (!club) return;
    fetch(`/api/clubs/${club.id}/alliance`)
      .then(r => r.ok ? r.json() : null)
      .then((data) => setAlliance(data || null))
      .catch(() => setAlliance(null));
  }, [club]);

  // Fetch active tables for this club
  useEffect(() => {
    if (!club) return;
    setClubTablesLoading(true);
    fetch("/api/tables", { credentials: "include" })
      .then(r => r.ok ? r.json() : [])
      .then((tables: any[]) => {
        setClubTables(tables.filter((t: any) => t.clubId === club.id));
      })
      .catch(() => setClubTables([]))
      .finally(() => setClubTablesLoading(false));
  }, [club]);

  // Fetch recent activity (announcements + events, combined into a feed)
  useEffect(() => {
    if (!club) return;
    Promise.all([
      fetch(`/api/clubs/${club.id}/announcements`).then(r => r.ok ? r.json() : []).catch(() => []),
      fetch(`/api/clubs/${club.id}/events`).then(r => r.ok ? r.json() : []).catch(() => []),
    ]).then(([announcements, events]) => {
      const items: any[] = [];
      (announcements || []).forEach((a: any) => {
        items.push({
          id: `ann-${a.id}`,
          type: "announcement",
          user: a.authorName || "Admin",
          action: a.title || a.content,
          timestamp: a.createdAt,
        });
      });
      (events || []).forEach((e: any) => {
        items.push({
          id: `evt-${e.id}`,
          type: e.eventType === "tournament" ? "game" : "game",
          user: e.name,
          action: e.description || e.eventType,
          timestamp: e.startTime || e.createdAt,
        });
      });
      // Also generate join events from members (sorted by joinedAt)
      const recentMembers = [...members]
        .filter(m => m.joinedAt)
        .sort((a, b) => new Date(b.joinedAt!).getTime() - new Date(a.joinedAt!).getTime())
        .slice(0, 5);
      recentMembers.forEach(m => {
        items.push({
          id: `join-${m.userId}`,
          type: "join",
          user: m.displayName,
          action: "joined the club",
          timestamp: m.joinedAt,
        });
      });
      // Sort by timestamp descending
      items.sort((a, b) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime());
      setClubActivity(items.slice(0, 15));
    });
  }, [club, members]);

  const [newClubName, setNewClubName] = useState("");
  const [newClubDescription, setNewClubDescription] = useState("");
  const [newClubIsPublic, setNewClubIsPublic] = useState(true);
  const [selectedLogo, setSelectedLogo] = useState<string | null>(null);
  const [creatingClub, setCreatingClub] = useState(false);

  const pendingInvitations = invitations.filter(inv => inv.status === "pending");
  const onlineCount = members.filter(m => onlineUserIds.has(m.userId)).length;
  const totalChips = members.reduce((sum, m) => sum + m.chipBalance, 0);
  const totalHands = Object.values(memberStatsMap).reduce((sum, s) => sum + (s?.handsPlayed ?? 0), 0);

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

  const clubLogo = club ? CLUB_LOGO_OPTIONS.find(l => l.id === (club as any).logoId) : null;

  const tabs = [
    { key: "overview" as const, label: "Overview", icon: LayoutDashboard, count: null },
    { key: "members" as const, label: "Members", icon: Users, count: members.length },
    { key: "tournaments" as const, label: "Tournaments", icon: Trophy, count: clubTournaments.length },
    { key: "leaderboard" as const, label: "Leaderboard", icon: Medal, count: null },
  ];

  const statsCards = [
    {
      label: "Total Members",
      value: club?.memberCount ?? members.length,
      icon: Users,
      gradient: "from-cyan-500/20 to-cyan-600/5",
      borderColor: "border-cyan-500/20",
      iconColor: "text-cyan-400",
      glowColor: "rgba(0,212,255,0.08)",
    },
    {
      label: "Online Now",
      value: onlineCount,
      icon: Wifi,
      gradient: "from-green-500/20 to-green-600/5",
      borderColor: "border-green-500/20",
      iconColor: "text-green-400",
      glowColor: "rgba(34,197,94,0.08)",
    },
    {
      label: "Hands Played",
      value: totalHands,
      icon: Gamepad2,
      gradient: "from-amber-500/20 to-amber-600/5",
      borderColor: "border-amber-500/20",
      iconColor: "text-amber-400",
      glowColor: "rgba(245,158,11,0.08)",
    },
    {
      label: "Total Chips",
      value: totalChips,
      icon: Coins,
      gradient: "from-purple-500/20 to-purple-600/5",
      borderColor: "border-purple-500/20",
      iconColor: "text-purple-400",
      glowColor: "rgba(168,85,247,0.08)",
    },
  ];

  return (
    <DashboardLayout title="Club Dashboard">
      <div className="px-8 pb-8 relative">
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <img
            src={pokerTableImg}
            alt=""
            loading="lazy"
            className="w-full h-64 object-cover opacity-15 blur-[1px]"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#111b2a]/80 to-[#111b2a]" />
        </div>
        <div
          className="absolute inset-0 pointer-events-none opacity-[0.07]"
          style={{ backgroundImage: CIRCUIT_SVG, backgroundSize: "200px 200px" }}
        />

        <div className="relative z-10">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-6 h-6 animate-spin text-cyan-400" />
            </div>
          ) : !club ? (
            <div className="max-w-lg mx-auto py-12">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-2xl p-8 border border-white/5"
                style={{
                  background: "rgba(20,31,40,0.75)",
                  backdropFilter: "blur(20px)",
                  boxShadow: "0 0 60px rgba(0,212,255,0.06)",
                }}
              >
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-purple-500/20 border border-cyan-500/20 flex items-center justify-center mx-auto mb-6" style={{ boxShadow: "0 0 30px rgba(0,212,255,0.15)" }}>
                  <Trophy className="w-10 h-10 text-cyan-400" />
                </div>
                <h3 className="text-xl font-black text-white mb-1.5 text-center tracking-wide">Create Your Club</h3>
                <p className="text-xs text-gray-500 mb-8 text-center">Start your own poker club and invite friends to play</p>

                <div className="space-y-4 text-left">
                  <div className="relative">
                    <input
                      data-testid="input-club-name"
                      type="text"
                      value={newClubName}
                      onChange={(e) => setNewClubName(e.target.value)}
                      placeholder=" "
                      className="peer w-full px-4 pt-5 pb-2 rounded-xl text-sm text-white outline-none transition-all focus:ring-1 focus:ring-cyan-500/40"
                      style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
                    />
                    <label className="absolute left-4 top-2 text-[0.5625rem] font-bold uppercase tracking-wider text-gray-500 pointer-events-none transition-all peer-placeholder-shown:top-3.5 peer-placeholder-shown:text-xs peer-placeholder-shown:font-normal peer-placeholder-shown:normal-case peer-placeholder-shown:tracking-normal peer-focus:top-2 peer-focus:text-[0.5625rem] peer-focus:font-bold peer-focus:uppercase peer-focus:tracking-wider peer-focus:text-cyan-400">
                      Club Name
                    </label>
                  </div>

                  <div className="relative">
                    <textarea
                      data-testid="input-club-description"
                      value={newClubDescription}
                      onChange={(e) => setNewClubDescription(e.target.value)}
                      placeholder=" "
                      rows={2}
                      className="peer w-full px-4 pt-5 pb-2 rounded-xl text-sm text-white outline-none resize-none transition-all focus:ring-1 focus:ring-cyan-500/40"
                      style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
                    />
                    <label className="absolute left-4 top-2 text-[0.5625rem] font-bold uppercase tracking-wider text-gray-500 pointer-events-none transition-all peer-placeholder-shown:top-3.5 peer-placeholder-shown:text-xs peer-placeholder-shown:font-normal peer-placeholder-shown:normal-case peer-placeholder-shown:tracking-normal peer-focus:top-2 peer-focus:text-[0.5625rem] peer-focus:font-bold peer-focus:uppercase peer-focus:tracking-wider peer-focus:text-cyan-400">
                      Description (optional)
                    </label>
                  </div>

                  <div>
                    <label className="text-[0.5625rem] font-bold uppercase tracking-wider text-gray-500 block mb-2.5 flex items-center gap-1.5">
                      <Image className="w-3 h-3" /> Club Logo
                    </label>
                    <div className="grid grid-cols-6 gap-2">
                      {CLUB_LOGO_OPTIONS.map(logo => (
                        <motion.button
                          key={logo.id}
                          whileHover={{ scale: 1.08 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => setSelectedLogo(logo.id === selectedLogo ? null : logo.id)}
                          data-testid={`logo-option-${logo.id}`}
                          className={`relative rounded-xl overflow-hidden aspect-square transition-all ${
                            selectedLogo === logo.id
                              ? "ring-2 ring-cyan-400 ring-offset-2 ring-offset-[#111b2a]"
                              : "ring-1 ring-white/10 hover:ring-white/25"
                          }`}
                        >
                          <img src={logo.url} alt={logo.label} className="w-full h-full object-cover" />
                          {selectedLogo === logo.id && (
                            <div className="absolute inset-0 bg-cyan-500/20 flex items-center justify-center">
                              <Check className="w-5 h-5 text-cyan-400 drop-shadow-lg" />
                            </div>
                          )}
                        </motion.button>
                      ))}
                    </div>
                    {selectedLogo && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        className="mt-3 flex items-center gap-3 p-3 rounded-xl"
                        style={{ background: "rgba(0,212,255,0.05)", border: "1px solid rgba(0,212,255,0.1)" }}
                      >
                        <img
                          src={CLUB_LOGO_OPTIONS.find(l => l.id === selectedLogo)?.url}
                          alt=""
                          className="w-12 h-12 rounded-lg object-cover"
                        />
                        <div>
                          <div className="text-xs font-bold text-white">{CLUB_LOGO_OPTIONS.find(l => l.id === selectedLogo)?.label}</div>
                          <div className="text-[0.5625rem] text-gray-500">Selected logo</div>
                        </div>
                      </motion.div>
                    )}
                  </div>

                  <label className="flex items-center gap-2.5 text-xs text-gray-400 cursor-pointer p-3 rounded-xl hover:bg-white/[0.02] transition-colors" style={{ border: "1px solid rgba(255,255,255,0.05)" }}>
                    <input
                      data-testid="checkbox-public"
                      type="checkbox"
                      checked={newClubIsPublic}
                      onChange={(e) => setNewClubIsPublic(e.target.checked)}
                      className="rounded accent-cyan-500"
                    />
                    <div>
                      <span className="font-medium text-white block text-xs">Public Club</span>
                      <span className="text-[0.5625rem] text-gray-600">Anyone can find & request to join</span>
                    </div>
                  </label>
                </div>

                {createError && (
                  <div className="mt-4 flex items-center gap-2 text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
                    <X className="w-3.5 h-3.5 shrink-0" />
                    {createError}
                  </div>
                )}

                <motion.button
                  data-testid="button-create-club"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleCreateClub}
                  disabled={creatingClub || !newClubName.trim()}
                  className="w-full mt-6 py-3 rounded-xl text-xs font-bold uppercase tracking-wider text-black flex items-center justify-center gap-2 disabled:opacity-50"
                  style={{ background: "linear-gradient(135deg, #00d4ff, #f0d078)", boxShadow: "0 0 25px rgba(0,212,255,0.25)" }}
                >
                  {creatingClub ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  Create Club
                </motion.button>

                <div className="flex items-center gap-3 mt-5">
                  <div className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.06)" }} />
                  <span className="text-[0.625rem] text-gray-600 uppercase tracking-wider">or</span>
                  <div className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.06)" }} />
                </div>

                <motion.button
                  data-testid="button-browse-clubs"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => navigate("/clubs/browse")}
                  className="w-full mt-5 py-3 rounded-xl text-xs font-bold uppercase tracking-wider text-gray-400 hover:text-white transition-colors flex items-center justify-center gap-2"
                  style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}
                >
                  <Search className="w-4 h-4" />
                  Browse Clubs
                </motion.button>
              </motion.div>
            </div>
          ) : (
            <>
              {/* ── Club Header with Logo ── */}
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="relative rounded-2xl p-6 mb-6 overflow-hidden"
                style={{
                  background: "linear-gradient(135deg, rgba(20,31,40,0.85), rgba(15,25,35,0.95))",
                  border: "1px solid rgba(0,212,255,0.15)",
                  boxShadow: "0 0 50px rgba(0,212,255,0.08)",
                }}
              >
                <div className="absolute inset-0 pointer-events-none opacity-[0.04]" style={{ backgroundImage: CIRCUIT_SVG, backgroundSize: "150px 150px" }} />
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-cyan-500 via-purple-500 to-amber-500 opacity-60" />

                <div className="relative flex items-center gap-6">
                  <div className="shrink-0">
                    {clubLogo ? (
                      <motion.div
                        whileHover={{ scale: 1.05 }}
                        className="w-20 h-20 rounded-2xl overflow-hidden border-2 border-cyan-500/30"
                        style={{ boxShadow: "0 0 30px rgba(0,212,255,0.2)" }}
                      >
                        <img src={clubLogo.url} alt={club.name} className="w-full h-full object-cover" />
                      </motion.div>
                    ) : (
                      <div
                        className="w-20 h-20 rounded-2xl flex items-center justify-center text-3xl font-black text-cyan-400 border-2 border-cyan-500/30"
                        style={{ background: "linear-gradient(135deg, rgba(0,212,255,0.15), rgba(0,212,255,0.05))", boxShadow: "0 0 30px rgba(0,212,255,0.15)" }}
                      >
                        {club.name.charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1">
                      <h2
                        data-testid="text-club-name"
                        className="text-2xl font-black tracking-wide text-white truncate"
                        style={{ textShadow: "0 0 20px rgba(0,212,255,0.2)" }}
                      >
                        {club.name}
                      </h2>
                      <Crown className="w-6 h-6 text-amber-400 shrink-0 drop-shadow-[0_0_8px_rgba(245,158,11,0.5)]" />
                    </div>
                    <div className="flex items-center gap-4 flex-wrap">
                      <motion.div
                        initial={{ scale: 0.9 }}
                        animate={{ scale: 1 }}
                        className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold"
                        style={{ background: "rgba(0,212,255,0.12)", border: "1px solid rgba(0,212,255,0.2)" }}
                      >
                        <Users className="w-3.5 h-3.5 text-cyan-400" />
                        <AnimatedNumber value={members.length} className="text-cyan-400" />
                        <span className="text-cyan-400/70">members</span>
                      </motion.div>
                      <div className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold" style={{ background: "rgba(34,197,94,0.12)", border: "1px solid rgba(34,197,94,0.2)" }}>
                        <span className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-green-400" />
                        </span>
                        <span className="text-green-400">{onlineCount} online</span>
                      </div>
                      {club.isPublic ? (
                        <span className="px-2.5 py-0.5 rounded-full text-[0.5625rem] font-bold uppercase tracking-wider bg-green-500/10 text-green-400 border border-green-500/20">Public</span>
                      ) : (
                        <span className="px-2.5 py-0.5 rounded-full text-[0.5625rem] font-bold uppercase tracking-wider bg-amber-500/10 text-amber-400 border border-amber-500/20">Private</span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <motion.button
                      data-testid="button-create-table"
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={handleCreateTable}
                      disabled={creatingTable}
                      className="px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider text-black flex items-center gap-2 disabled:opacity-50"
                      style={{
                        background: "linear-gradient(135deg, #00d4ff, #f0d078)",
                        boxShadow: "0 0 25px rgba(0,212,255,0.3)",
                      }}
                    >
                      {creatingTable ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                      Create Table
                    </motion.button>
                    <button
                      data-testid="button-club-settings"
                      onClick={() => navigate("/club/settings")}
                      className="p-2.5 rounded-xl border border-white/10 hover:border-cyan-500/30 transition-all"
                      style={{ background: "rgba(255,255,255,0.03)" }}
                    >
                      <Settings className="w-5 h-5 text-gray-400 hover:text-cyan-400 transition-colors" />
                    </button>
                  </div>
                </div>
              </motion.div>

              {/* ── Stats Overview Row ── */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
                {statsCards.map((stat, i) => {
                  const Icon = stat.icon;
                  return (
                    <motion.div
                      key={stat.label}
                      initial={{ opacity: 0, y: 15 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.1 + i * 0.05 }}
                      data-testid={`stat-card-${stat.label.toLowerCase().replace(/\s+/g, '-')}`}
                      className={`relative rounded-xl p-4 border ${stat.borderColor} bg-gradient-to-br ${stat.gradient} overflow-hidden`}
                      style={{ boxShadow: `0 0 30px ${stat.glowColor}` }}
                    >
                      <div className="absolute top-3 right-3 opacity-20">
                        <Icon className={`w-8 h-8 ${stat.iconColor}`} />
                      </div>
                      <div className="text-[0.5625rem] font-bold uppercase tracking-wider text-gray-500 mb-1">{stat.label}</div>
                      <AnimatedNumber value={stat.value} className={`text-xl font-black ${stat.iconColor}`} />
                    </motion.div>
                  );
                })}
              </div>

              {/* ── Alliance Info Card ── */}
              {alliance && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="mb-6 rounded-xl p-4 flex items-center gap-4"
                  style={{
                    background: "linear-gradient(135deg, rgba(168,85,247,0.1), rgba(139,92,246,0.05))",
                    border: "1px solid rgba(168,85,247,0.2)",
                    boxShadow: "0 0 30px rgba(168,85,247,0.06)",
                  }}
                >
                  <div className="w-10 h-10 rounded-xl bg-purple-500/15 border border-purple-500/20 flex items-center justify-center shrink-0">
                    <Shield className="w-5 h-5 text-purple-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-bold text-white">{alliance.name}</div>
                    <div className="text-[0.5625rem] text-gray-500">{(alliance.clubIds as string[]).length} clubs in alliance</div>
                  </div>
                  <motion.button
                    data-testid="button-view-alliance"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => navigate(`/alliances/${alliance.id}`)}
                    className="px-4 py-2 rounded-lg text-[0.625rem] font-bold uppercase tracking-wider text-purple-400 border border-purple-500/20 hover:bg-purple-500/10 transition-colors shrink-0"
                  >
                    View Alliance
                  </motion.button>
                </motion.div>
              )}

              {/* ── Tab Navigation with Animated Underline ── */}
              <div className="relative flex items-center gap-1 mb-6 p-1 rounded-xl border border-white/5" style={{ background: "rgba(20,31,40,0.65)", backdropFilter: "blur(16px)" }}>
                {tabs.map(tab => {
                  const Icon = tab.icon;
                  const isActive = activeTab === tab.key;
                  return (
                    <button
                      key={tab.key}
                      data-testid={`tab-${tab.key}`}
                      onClick={() => setActiveTab(tab.key)}
                      className={`relative flex items-center gap-2 px-5 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${
                        isActive
                          ? "text-cyan-400"
                          : "text-gray-500 hover:text-gray-300"
                      }`}
                    >
                      {isActive && (
                        <motion.div
                          layoutId="activeTabBg"
                          className="absolute inset-0 rounded-lg bg-cyan-500/15 border border-cyan-500/20"
                          transition={{ type: "spring", bounce: 0.15, duration: 0.4 }}
                          style={{ boxShadow: "0 0 15px rgba(0,212,255,0.1)" }}
                        />
                      )}
                      <span className="relative flex items-center gap-2">
                        <Icon className="w-4 h-4" />
                        {tab.label}
                        {tab.count !== null && tab.count > 0 && (
                          <span className={`text-[0.5625rem] font-bold px-1.5 py-0.5 rounded-full ${
                            isActive
                              ? "bg-cyan-500/25 text-cyan-400"
                              : "bg-white/5 text-gray-500"
                          }`}>
                            {tab.count}
                          </span>
                        )}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* ── Overview Tab Content ── */}
              {activeTab === "overview" && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Left side: Club Tables (2/3 width) */}
                  <div className="lg:col-span-2">
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="rounded-xl overflow-hidden"
                      style={{
                        background: "rgba(20,31,40,0.65)",
                        backdropFilter: "blur(16px)",
                        border: "1px solid rgba(0,212,255,0.20)",
                        boxShadow: "0 0 40px rgba(0,212,255,0.06), inset 0 1px 0 rgba(0,212,255,0.08)",
                      }}
                    >
                      <div
                        className="px-6 py-3 border-b border-cyan-500/25 flex items-center justify-between"
                        style={{
                          background: "linear-gradient(90deg, rgba(0,212,255,0.18), rgba(180,140,50,0.06))",
                          boxShadow: "inset 0 -1px 0 rgba(0,212,255,0.15)",
                        }}
                      >
                        <h3
                          className="text-sm font-black uppercase tracking-[0.15em] text-cyan-400"
                          style={{ textShadow: "0 0 15px rgba(0,212,255,0.4)" }}
                        >
                          Club Tables
                        </h3>
                        <motion.button
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={handleCreateTable}
                          disabled={creatingTable}
                          className="px-4 py-1.5 rounded-lg text-[0.625rem] font-bold uppercase tracking-wider text-black flex items-center gap-1.5 disabled:opacity-50"
                          style={{
                            background: "linear-gradient(135deg, #00d4ff, #f0d078)",
                            boxShadow: "0 0 15px rgba(0,212,255,0.25)",
                          }}
                        >
                          {creatingTable ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                          Create Table
                        </motion.button>
                      </div>

                      <div className="p-4">
                        {clubTablesLoading ? (
                          <div className="flex items-center justify-center py-12">
                            <Loader2 className="w-5 h-5 animate-spin text-cyan-400" />
                          </div>
                        ) : clubTables.length === 0 ? (
                          <div className="py-12 text-center">
                            <div
                              className="w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center"
                              style={{ background: "rgba(0,212,255,0.08)", border: "1px solid rgba(0,212,255,0.15)" }}
                            >
                              <Layers className="w-7 h-7 text-gray-600" />
                            </div>
                            <p className="text-sm font-bold text-gray-500 mb-1">No active tables</p>
                            <p className="text-[0.625rem] text-gray-600">Create a table to start playing with your club members</p>
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {clubTables.map((table: any, i: number) => {
                              const isLive = table.status === "playing";
                              return (
                                <motion.div
                                  key={table.id}
                                  initial={{ opacity: 0, y: 10 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  transition={{ delay: i * 0.06 }}
                                  className="rounded-xl p-4 border border-white/[0.06] hover:border-cyan-500/20 transition-all group"
                                  style={{
                                    background: "rgba(255,255,255,0.02)",
                                    boxShadow: "0 0 20px rgba(0,0,0,0.1)",
                                  }}
                                >
                                  <div className="flex items-start justify-between mb-3">
                                    <div className="min-w-0 flex-1">
                                      <h4 className="text-sm font-bold text-white truncate mb-1">{table.name}</h4>
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <span
                                          className="px-2 py-0.5 rounded-md text-[0.5625rem] font-bold uppercase tracking-wider bg-purple-500/15 text-purple-400 border border-purple-500/20"
                                        >
                                          {table.gameFormat || "cash"}
                                        </span>
                                        <span className="text-[0.625rem] text-gray-500">
                                          {table.smallBlind}/{table.bigBlind}
                                        </span>
                                      </div>
                                    </div>
                                    <span
                                      className={`shrink-0 ml-2 px-2.5 py-1 rounded-md text-[0.5625rem] font-bold uppercase tracking-wider border ${
                                        isLive
                                          ? "bg-green-500/15 text-green-400 border-green-500/20"
                                          : "bg-gray-500/10 text-gray-500 border-gray-500/20"
                                      }`}
                                    >
                                      {isLive ? "LIVE" : "WAITING"}
                                    </span>
                                  </div>
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-1.5 text-[0.625rem] text-gray-500">
                                      <Users className="w-3.5 h-3.5" />
                                      <span>{table.playerCount ?? 0}/{table.maxPlayers ?? 6} players</span>
                                    </div>
                                    <motion.button
                                      whileHover={{ scale: 1.05 }}
                                      whileTap={{ scale: 0.95 }}
                                      onClick={() => navigate(`/game/${table.id}`)}
                                      className="px-4 py-1.5 rounded-lg text-[0.5625rem] font-bold uppercase tracking-wider text-cyan-400 border border-cyan-500/25 hover:bg-cyan-500/10 transition-colors"
                                    >
                                      Join
                                    </motion.button>
                                  </div>
                                </motion.div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </motion.div>
                  </div>

                  {/* Right side: Recent Activity (1/3 width) */}
                  <div>
                    <motion.div
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.15 }}
                      className="rounded-xl overflow-hidden"
                      style={{
                        background: "rgba(20,31,40,0.65)",
                        backdropFilter: "blur(16px)",
                        border: "1px solid rgba(0,212,255,0.12)",
                        boxShadow: "0 0 25px rgba(0,212,255,0.04)",
                      }}
                    >
                      <div className="px-4 py-3 border-b border-cyan-500/10">
                        <h3 className="text-xs font-bold uppercase tracking-[0.12em] text-white flex items-center gap-2">
                          <Activity className="w-3.5 h-3.5 text-cyan-400" /> Recent Activity
                        </h3>
                      </div>

                      {clubActivity.length === 0 ? (
                        <div className="py-10 text-center">
                          <Activity className="w-6 h-6 text-gray-700 mx-auto mb-2" />
                          <p className="text-[0.625rem] text-gray-600">No recent activity</p>
                        </div>
                      ) : (
                        <div className="divide-y divide-white/[0.04]">
                          {clubActivity.map((item: any, i: number) => {
                            const isJoin = item.type === "join";
                            const isGame = item.type === "game";
                            const isAnnouncement = item.type === "announcement";

                            const accentColor = isJoin
                              ? "text-green-400"
                              : isGame
                                ? "text-cyan-400"
                                : "text-amber-400";
                            const accentBg = isJoin
                              ? "bg-green-500/12 border-green-500/20"
                              : isGame
                                ? "bg-cyan-500/12 border-cyan-500/20"
                                : "bg-amber-500/12 border-amber-500/20";
                            const IconComponent = isJoin
                              ? Users
                              : isGame
                                ? Gamepad2
                                : Megaphone;

                            const timeStr = item.timestamp
                              ? new Date(item.timestamp).toLocaleDateString(undefined, {
                                  month: "short",
                                  day: "numeric",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })
                              : "";

                            return (
                              <motion.div
                                key={item.id}
                                initial={{ opacity: 0, x: -8 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: 0.1 + i * 0.04 }}
                                className="flex items-start gap-3 px-4 py-3 hover:bg-white/[0.02] transition-colors"
                              >
                                <div
                                  className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border ${accentBg}`}
                                >
                                  <IconComponent className={`w-4 h-4 ${accentColor}`} />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs text-white leading-snug">
                                    <span className="font-bold">{item.user}</span>{" "}
                                    <span className="text-gray-400">{item.action}</span>
                                  </p>
                                  {timeStr && (
                                    <p className="text-[0.5625rem] text-gray-600 mt-0.5">{timeStr}</p>
                                  )}
                                </div>
                              </motion.div>
                            );
                          })}
                        </div>
                      )}
                    </motion.div>
                  </div>
                </div>
              )}

              {activeTab === "tournaments" && <ClubTournaments />}

              {activeTab === "leaderboard" && club && <ClubLeaderboard clubId={club.id} />}

              {activeTab === "members" && <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2">
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="rounded-xl overflow-hidden"
                    style={{
                      background: "rgba(20,31,40,0.65)",
                      backdropFilter: "blur(16px)",
                      border: "1px solid rgba(0,212,255,0.20)",
                      boxShadow: "0 0 40px rgba(0,212,255,0.06), inset 0 1px 0 rgba(0,212,255,0.08)",
                    }}
                  >
                    <div
                      className="px-6 py-3 border-b border-cyan-500/25"
                      style={{
                        background: "linear-gradient(90deg, rgba(0,212,255,0.18), rgba(180,140,50,0.06))",
                        boxShadow: "inset 0 -1px 0 rgba(0,212,255,0.15)",
                      }}
                    >
                      <h3
                        className="text-sm font-black uppercase tracking-[0.15em] text-cyan-400"
                        style={{ textShadow: "0 0 15px rgba(0,212,255,0.4)" }}
                      >
                        Member List
                      </h3>
                    </div>

                    <div className="grid grid-cols-12 gap-3 px-6 py-3 border-b border-white/5">
                      <span className="col-span-1 text-[0.5625rem] font-bold uppercase tracking-[0.15em] text-gray-400">Avatar</span>
                      <span className="col-span-3 text-[0.5625rem] font-bold uppercase tracking-[0.15em] text-gray-400">Name</span>
                      <span className="col-span-3 text-[0.5625rem] font-bold uppercase tracking-[0.15em] text-gray-400">Chips</span>
                      <span className="col-span-3 text-[0.5625rem] font-bold uppercase tracking-[0.15em] text-gray-400">Hands Played</span>
                      <span className="col-span-2 text-[0.5625rem] font-bold uppercase tracking-[0.15em] text-gray-400">Status</span>
                    </div>

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
                            data-testid={`row-member-${member.userId}`}
                            className="grid grid-cols-12 gap-3 items-center px-6 py-4 border-b border-white/[0.04] hover:bg-cyan-500/[0.06] transition-all"
                          >
                            <div className="col-span-1 flex justify-center">
                              <MemberAvatar
                                avatarId={member.avatarId}
                                displayName={member.displayName}
                                size="lg"
                              />
                            </div>
                            <div className="col-span-3 min-w-0">
                              <span className="text-sm font-bold text-white truncate block">
                                {member.displayName}
                              </span>
                              <span className="text-[0.5625rem] text-gray-600 truncate block">@{member.username}</span>
                            </div>
                            <div className="col-span-3 flex items-center gap-1.5">
                              <Coins className="w-4 h-4 text-cyan-400" />
                              <span className="text-base font-bold text-white">
                                {member.chipBalance.toLocaleString()}
                              </span>
                            </div>
                            <div className="col-span-3 text-base font-medium text-gray-300">
                              {ms?.handsPlayed ?? 0}
                            </div>
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

                <div className="space-y-4">
                  <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.2 }}
                    className="rounded-xl overflow-hidden"
                    style={{
                      background: "rgba(20,31,40,0.65)",
                      backdropFilter: "blur(16px)",
                      border: "1px solid rgba(0,212,255,0.12)",
                      boxShadow: "0 0 25px rgba(0,212,255,0.04)",
                    }}
                  >
                    <div className="px-4 py-3 border-b border-cyan-500/10">
                      <h3 className="text-xs font-bold uppercase tracking-[0.12em] text-white flex items-center gap-2">
                        Pending Join Requests
                        {pendingInvitations.length > 0 && (
                          <span className="bg-cyan-500/20 text-cyan-400 text-[0.5625rem] font-bold px-1.5 py-0.5 rounded-full border border-cyan-500/30">
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
                                data-testid={`button-approve-${inv.id}`}
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
                                data-testid={`button-decline-${inv.id}`}
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

                  {!alliance && (
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.25 }}
                      className="rounded-xl overflow-hidden"
                      style={{
                        background: "rgba(20,31,40,0.65)",
                        backdropFilter: "blur(16px)",
                        border: "1px solid rgba(168,85,247,0.12)",
                        boxShadow: "0 0 25px rgba(168,85,247,0.04)",
                      }}
                    >
                      <div className="px-4 py-3 border-b border-purple-500/10">
                        <h3 className="text-xs font-bold uppercase tracking-[0.12em] text-white flex items-center gap-2">
                          <Shield className="w-3.5 h-3.5 text-purple-400" /> Alliance
                        </h3>
                      </div>
                      <div className="p-4 text-center">
                        <p className="text-[0.625rem] text-gray-600 mb-3">Not part of any alliance</p>
                        <motion.button
                          data-testid="button-browse-alliances"
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => navigate("/leagues?tab=alliances")}
                          className="w-full py-2 rounded-lg text-[0.625rem] font-bold uppercase tracking-wider text-purple-400 border border-purple-500/20 hover:bg-purple-500/10 transition-colors"
                        >
                          Browse Alliances
                        </motion.button>
                      </div>
                    </motion.div>
                  )}

                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="rounded-xl p-4"
                    style={{
                      background: "rgba(20,31,40,0.65)",
                      backdropFilter: "blur(16px)",
                      border: "1px solid rgba(0,212,255,0.12)",
                      boxShadow: "0 0 25px rgba(0,212,255,0.04)",
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
                        <span className="text-xs font-bold text-cyan-400">{onlineCount}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[0.625rem] text-gray-500 flex items-center gap-1.5">
                          <Coins className="w-3 h-3" /> Your Balance
                        </span>
                        <span className="text-xs font-bold text-cyan-400">
                          {user?.chipBalance?.toLocaleString() ?? 0}
                        </span>
                      </div>
                    </div>
                  </motion.div>
                </div>
              </div>}
            </>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}