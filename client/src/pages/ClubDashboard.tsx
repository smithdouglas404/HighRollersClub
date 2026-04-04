import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { DashboardLayout } from "@/components/DashboardLayout";
import { PageBackground } from "@/components/shared/PageBackground";
import { useAuth } from "@/lib/auth-context";
import { useClub } from "@/lib/club-context";
import { MemberAvatar } from "@/components/shared/MemberAvatar";
import {
  Trophy, Crown, TrendingUp,
  Users, Coins, Plus, Loader2,
  Settings, Search, Check, X,
  Shield, Medal, Gamepad2, Activity,
  Layers, Wifi, Image, Megaphone, LayoutDashboard,
  Target, Clock, CheckCircle2, Sparkles
} from "lucide-react";
import { ClubTournaments } from "@/components/club/ClubTournaments";
import { ClubChatSidebar } from "@/components/shared/ClubChatSidebar";
import { ClubLeaderboard } from "@/components/club/ClubLeaderboard";
import { cn } from "@/lib/utils";
import { NeonButton } from "@/components/ui/neon";


export const CLUB_LOGO_OPTIONS = [
  { id: "lions", label: "Lions", url: "/clubs/club_lions.webp" },
  { id: "sharks", label: "Sharks", url: "/clubs/club_sharks.webp" },
  { id: "eagles", label: "Eagles", url: "/clubs/club_eagles.webp" },
  { id: "dragons", label: "Dragons", url: "/clubs/club_dragons.webp" },
  { id: "wolves", label: "Wolves", url: "/clubs/club_wolves.webp" },
  { id: "aces", label: "Aces", url: "/clubs/club_aces.webp" },
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
  const [clubChallenges, setClubChallenges] = useState<any[]>([]);
  const [challengesLoading, setChallengesLoading] = useState(false);
  const [generatingChallenges, setGeneratingChallenges] = useState(false);

  // Quick Stats state
  interface QuickStats {
    mostActiveTable: { name: string; playerCount: number } | null;
    topWinnerThisWeek: { displayName: string; amount: number } | null;
    biggestPotToday: { amount: number; winnerName: string } | null;
  }
  const [quickStats, setQuickStats] = useState<QuickStats | null>(null);
  const [quickStatsLoading, setQuickStatsLoading] = useState(false);

  // Fetch quick stats on mount and auto-refresh every 60s
  useEffect(() => {
    if (!club) return;
    let cancelled = false;
    const fetchQuickStats = () => {
      setQuickStatsLoading((prev) => quickStats === null ? true : prev);
      fetch(`/api/clubs/${club.id}/quick-stats`, { credentials: "include" })
        .then(r => r.ok ? r.json() : null)
        .then((data) => { if (!cancelled && data) setQuickStats(data); })
        .catch(() => {})
        .finally(() => { if (!cancelled) setQuickStatsLoading(false); });
    };
    fetchQuickStats();
    const interval = setInterval(fetchQuickStats, 60_000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [club]);

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

  // Fetch club challenges
  useEffect(() => {
    if (!club) return;
    setChallengesLoading(true);
    fetch(`/api/clubs/${club.id}/challenges`, { credentials: "include" })
      .then(r => r.ok ? r.json() : [])
      .then(setClubChallenges)
      .catch(() => setClubChallenges([]))
      .finally(() => setChallengesLoading(false));
  }, [club]);

  const handleGenerateChallenges = async () => {
    if (generatingChallenges || !club) return;
    setGeneratingChallenges(true);
    try {
      const res = await fetch(`/api/clubs/${club.id}/challenges/generate`, {
        method: "POST",
        credentials: "include",
      });
      if (res.ok) {
        const newChallenges = await res.json();
        setClubChallenges(prev => [...newChallenges, ...prev]);
      }
    } catch {} finally {
      setGeneratingChallenges(false);
    }
  };

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
      const logoUrl = selectedLogo ? CLUB_LOGO_OPTIONS.find(l => l.id === selectedLogo)?.url : undefined;
      const result = await createClub({
        name: newClubName.trim(),
        description: newClubDescription.trim() || undefined,
        isPublic: newClubIsPublic,
        logoUrl,
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
    { label: "Members", value: club?.memberCount ?? members.length, icon: Users, color: "text-[#c9a84c]" },
    { label: "Online Now", value: onlineCount, icon: Wifi, color: "text-[#c9a84c]" },
    { label: "Hands Played", value: totalHands, icon: Gamepad2, color: "text-[#c9a84c]" },
    { label: "Total Chips", value: totalChips, icon: Coins, color: "text-[#c9a84c]" },
  ];

  return (
    <DashboardLayout title="Club Dashboard">
      <PageBackground image="/images/generated/club-dashboard-bg.png" />
      <div className="px-4 md:px-8 pb-8 relative z-10">

        <div className="relative z-10">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : !club ? (
            <div className="max-w-lg mx-auto py-12">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="glass-card p-8"
              >
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary/20 to-purple-500/20 border border-primary/20 flex items-center justify-center mx-auto mb-6 shadow-[0_0_30px_rgba(129,236,255,0.15)]">
                  <Trophy className="w-10 h-10 text-primary" />
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
                      className="peer w-full px-4 pt-5 pb-2 rounded-md text-sm text-foreground outline-none transition-all focus:border-primary/30 bg-surface-highest/50 border border-white/[0.06]"
                    />
                    <label className="absolute left-4 top-2 text-[0.5625rem] font-bold uppercase tracking-wider text-gray-500 pointer-events-none transition-all peer-placeholder-shown:top-3.5 peer-placeholder-shown:text-xs peer-placeholder-shown:font-normal peer-placeholder-shown:normal-case peer-placeholder-shown:tracking-normal peer-focus:top-2 peer-focus:text-[0.5625rem] peer-focus:font-bold peer-focus:uppercase peer-focus:tracking-wider peer-focus:text-primary">
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
                      className="peer w-full px-4 pt-5 pb-2 rounded-xl text-sm text-white outline-none resize-none transition-all focus:ring-1 focus:ring-amber-500/40"
                      style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
                    />
                    <label className="absolute left-4 top-2 text-[0.5625rem] font-bold uppercase tracking-wider text-gray-500 pointer-events-none transition-all peer-placeholder-shown:top-3.5 peer-placeholder-shown:text-xs peer-placeholder-shown:font-normal peer-placeholder-shown:normal-case peer-placeholder-shown:tracking-normal peer-focus:top-2 peer-focus:text-[0.5625rem] peer-focus:font-bold peer-focus:uppercase peer-focus:tracking-wider peer-focus:text-primary">
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
                              ? "ring-2 ring-amber-400 ring-offset-2 ring-offset-[#111b2a]"
                              : "ring-1 ring-white/10 hover:ring-white/25"
                          }`}
                        >
                          <img src={logo.url} alt={logo.label} className="w-full h-full object-cover" />
                          {selectedLogo === logo.id && (
                            <div className="absolute inset-0 bg-amber-500/20 flex items-center justify-center">
                              <Check className="w-5 h-5 text-primary drop-shadow-lg" />
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
                        style={{ background: "rgba(212,175,55,0.05)", border: "1px solid rgba(212,175,55,0.1)" }}
                      >
                        <img
                          src={CLUB_LOGO_OPTIONS.find(l => l.id === selectedLogo)?.url}
                          alt={`${CLUB_LOGO_OPTIONS.find(l => l.id === selectedLogo)?.label ?? "Selected"} club logo preview`}
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
                      className="rounded accent-amber-500"
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
                    <span className="flex-1">{createError}</span>
                    <button
                      data-testid="button-retry-create-club"
                      onClick={handleCreateClub}
                      disabled={creatingClub}
                      className="shrink-0 px-3 py-1 rounded-md text-[0.625rem] font-bold uppercase tracking-wider text-red-400 border border-red-500/30 hover:bg-red-500/15 transition-colors disabled:opacity-50"
                    >
                      Retry
                    </button>
                  </div>
                )}

                <motion.button
                  data-testid="button-create-club"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleCreateClub}
                  disabled={creatingClub || !newClubName.trim()}
                  className="w-full mt-6 py-3 rounded-md text-xs font-bold uppercase tracking-wider gradient-primary text-primary-foreground flex items-center justify-center gap-2 disabled:opacity-50 shadow-[0_0_25px_rgba(129,236,255,0.25)]"
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
                  className="w-full mt-5 py-3 rounded-xl text-xs font-bold uppercase tracking-wider text-gray-400 hover:text-white transition-colors flex items-center justify-center gap-2 bg-surface-high/30 border border-white/[0.06]"
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
                className="relative rounded-md p-6 mb-6 overflow-hidden"
                style={{ background: "rgba(15,15,20,0.7)", backdropFilter: "blur(12px)", border: "1px solid rgba(255,255,255,0.06)" }}
              >
                <div className="absolute top-0 left-0 right-0 h-1 gradient-primary opacity-60" />

                <div className="relative flex items-center gap-6">
                  <div className="shrink-0">
                    {clubLogo ? (
                      <motion.div
                        whileHover={{ scale: 1.05 }}
                        className="w-20 h-20 rounded-2xl overflow-hidden border-2 border-primary/30 shadow-[0_0_30px_rgba(129,236,255,0.2)]"
                      >
                        <img src={clubLogo.url} alt={club.name} className="w-full h-full object-cover" />
                      </motion.div>
                    ) : (
                      <div
                        className="w-20 h-20 rounded-2xl flex items-center justify-center text-3xl font-black text-primary border-2 border-primary/30 bg-gradient-to-br from-primary/15 to-primary/5 shadow-[0_0_30px_rgba(129,236,255,0.15)]"
                      >
                        {club.name.charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1">
                      <h2
                        data-testid="text-club-name"
                        className="text-2xl font-display font-bold tracking-wide truncate"
                        style={{
                          background: "linear-gradient(180deg, #f5e6a3 0%, #d4af37 60%, #c9a84c 100%)",
                          WebkitBackgroundClip: "text",
                          WebkitTextFillColor: "transparent",
                          backgroundClip: "text",
                        }}
                      >
                        {club.name}
                      </h2>
                      <Crown className="w-6 h-6 text-amber-400 shrink-0 drop-shadow-[0_0_8px_rgba(245,158,11,0.5)]" />
                    </div>
                    <div className="flex items-center gap-4 flex-wrap">
                      <motion.div
                        initial={{ scale: 0.9 }}
                        animate={{ scale: 1 }}
                        className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-primary/10 border border-primary/20"
                      >
                        <Users className="w-3.5 h-3.5 text-primary" />
                        <AnimatedNumber value={members.length} className="text-primary" />
                        <span className="text-primary/70">members</span>
                      </motion.div>
                      <div className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-secondary/10 border border-secondary/20">
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
                    <NeonButton
                      data-testid="button-create-table"
                      onClick={handleCreateTable}
                      disabled={creatingTable}
                      size="sm"
                      className="gap-2"
                    >
                      {creatingTable ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                      Create Table
                    </NeonButton>
                    <NeonButton
                      variant="secondary"
                      size="icon"
                      data-testid="button-club-settings"
                      onClick={() => navigate("/club/settings")}
                    >
                      <Settings className="w-5 h-5" />
                    </NeonButton>
                  </div>
                </div>
              </motion.div>

              {/* ── Stats Overview Row ── */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
                {statsCards.map((stat, i) => {
                  const Icon = stat.icon;
                  return (
                    <div
                      key={stat.label}
                      data-testid={`stat-card-${stat.label.toLowerCase().replace(/\s+/g, '-')}`}
                      className="stats-card rounded-md p-4 hover:border-[#c9a84c]/40 hover:shadow-[0_0_15px_rgba(212,175,55,0.1)] transition-all duration-200 relative overflow-hidden"
                      style={{
                        background: "rgba(15,15,20,0.7)",
                        backdropFilter: "blur(16px)",
                        border: "1px solid rgba(212,175,55,0.12)",
                      }}
                    >
                      {/* Gold top-line accent */}
                      <div className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: "linear-gradient(90deg, transparent, #d4af37, transparent)" }} />
                      <div className="flex items-center gap-2 mb-1">
                        <Icon className={cn("w-4 h-4", stat.color)} />
                        <span className="text-[10px] text-muted-foreground uppercase tracking-widest">{stat.label}</span>
                      </div>
                      <p className="font-display font-bold text-white text-lg">
                        <AnimatedNumber value={stat.value} />
                      </p>
                    </div>
                  );
                })}
              </div>

              {/* ── Alliance Info Card ── */}
              {alliance && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="mb-6 rounded-md p-4 flex items-center gap-4 bg-purple-500/10 border border-purple-500/20"
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
              <div className="flex gap-1 mb-6 bg-surface-low/30 rounded-md p-1 border border-white/[0.04]">
                {tabs.map(tab => {
                  const Icon = tab.icon;
                  const isActive = activeTab === tab.key;
                  return (
                    <button
                      key={tab.key}
                      data-testid={`tab-${tab.key}`}
                      onClick={() => setActiveTab(tab.key)}
                      className={cn(
                        "flex-1 py-2 rounded-md text-xs font-bold uppercase tracking-wider transition-all capitalize flex items-center justify-center gap-2",
                        isActive
                          ? "border border-[#d4af37]/30"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                      style={isActive ? { background: "rgba(212,175,55,0.1)", color: "#d4af37", borderBottom: "2px solid #d4af37" } : undefined}
                    >
                      <Icon className="w-4 h-4" />
                      {tab.label}
                      {tab.count !== null && tab.count > 0 && (
                        <span className={cn(
                          "text-[0.5625rem] font-bold px-1.5 py-0.5 rounded-full",
                          isActive ? "bg-[#d4af37]/20 text-[#d4af37]" : "bg-white/5 text-muted-foreground"
                        )}>
                          {tab.count}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* ── Overview Tab Content ── */}
              {activeTab === "overview" && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Left side: Club Tables (2/3 width) */}
                  <div className="lg:col-span-2">
                    <div className="rounded-md overflow-hidden" style={{ background: "rgba(15,15,20,0.7)", backdropFilter: "blur(12px)", border: "1px solid rgba(255,255,255,0.06)" }}>
                      <div className="px-5 py-3 border-b border-white/[0.05] flex items-center justify-between">
                        <h3 className="font-display font-bold text-white text-lg flex items-center gap-2">
                          <Layers className="w-4 h-4 text-primary" /> Club Tables
                        </h3>
                        <NeonButton size="sm" onClick={handleCreateTable} disabled={creatingTable} className="gap-1.5">
                          {creatingTable ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                          Create Table
                        </NeonButton>
                      </div>

                      <div className="p-4">
                        {clubTablesLoading ? (
                          <div className="flex items-center justify-center py-12">
                            <Loader2 className="w-5 h-5 animate-spin text-primary" />
                          </div>
                        ) : clubTables.length === 0 ? (
                          <div className="py-12 text-center">
                            <div className="w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center bg-primary/[0.08] border border-primary/15">

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
                                  className="rounded-md overflow-hidden border border-white/[0.06] hover:border-primary/20 transition-all group bg-surface-high/30"
                                >
                                  {/* Mini table felt preview */}
                                  <div className="relative h-14 bg-gradient-to-b from-emerald-900/30 to-emerald-950/20 flex items-center justify-center overflow-hidden">
                                    <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(5,46,22,0.4)_0%,transparent_70%)]" />
                                    {/* Miniature table oval */}
                                    <div className={cn(
                                      "w-20 h-8 rounded-[50%] border-2 relative",
                                      isLive
                                        ? "bg-emerald-800/50 border-emerald-600/40 shadow-[0_0_12px_rgba(16,185,129,0.2)]"
                                        : "bg-emerald-900/30 border-emerald-700/20"
                                    )}>
                                      <div className="absolute inset-1 rounded-[50%] border border-emerald-500/10" />
                                    </div>
                                    {/* Player dots around the table */}
                                    {Array.from({ length: Math.min(table.playerCount ?? 0, table.maxPlayers ?? 6) }).map((_: unknown, pi: number) => {
                                      const angle = (pi / (table.maxPlayers ?? 6)) * Math.PI * 2 - Math.PI / 2;
                                      const rx = 44;
                                      const ry = 16;
                                      return (
                                        <div
                                          key={pi}
                                          className="absolute w-2 h-2 rounded-full bg-primary/60 border border-primary/40"
                                          style={{
                                            left: `calc(50% + ${Math.cos(angle) * rx}px - 4px)`,
                                            top: `calc(50% + ${Math.sin(angle) * ry}px - 4px)`,
                                          }}
                                        />
                                      );
                                    })}
                                    {isLive && (
                                      <div className="absolute top-1.5 right-2">
                                        <span className="relative flex h-2 w-2">
                                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                                          <span className="relative inline-flex rounded-full h-2 w-2 bg-green-400" />
                                        </span>
                                      </div>
                                    )}
                                  </div>

                                  <div className="p-4">
                                    <div className="flex items-start justify-between mb-3">
                                      <div className="min-w-0 flex-1">
                                        <h4 className="text-sm font-bold text-white truncate mb-1">{table.name}</h4>
                                        <div className="flex items-center gap-2 flex-wrap">
                                          <span
                                            className="px-2 py-0.5 rounded-full text-[0.5625rem] font-bold uppercase tracking-wider bg-purple-500/15 text-purple-400 border border-purple-500/20"
                                          >
                                            {table.gameFormat || "cash"}
                                          </span>
                                          <span className="text-[0.625rem] text-gray-500">
                                            {table.smallBlind}/{table.bigBlind}
                                          </span>
                                        </div>
                                      </div>
                                      <span
                                        className={`shrink-0 ml-2 px-2.5 py-1 rounded-full text-[0.5625rem] font-bold uppercase tracking-wider border ${
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
                                        <span className="font-bold">{table.playerCount ?? 0}/{table.maxPlayers ?? 6} players</span>
                                      </div>
                                      <motion.button
                                        whileHover={{ scale: 1.05 }}
                                        whileTap={{ scale: 0.95 }}
                                        onClick={() => navigate(`/game/${table.id}`)}
                                        className="px-4 py-1.5 rounded-md text-[0.5625rem] font-bold uppercase tracking-wider text-primary border border-primary/25 hover:bg-primary/10 transition-colors"
                                      >
                                        Join
                                      </motion.button>
                                    </div>
                                  </div>
                                </motion.div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right side: Quick Stats + Recent Activity (1/3 width) */}
                  <div className="space-y-6">
                    {/* Quick Stats */}
                    <div>
                      <h3 className="font-display font-bold text-white text-lg flex items-center gap-2 mb-3">
                        <TrendingUp className="w-4 h-4 text-primary" /> Quick Stats
                      </h3>
                      <div className="rounded-md divide-y divide-white/[0.04]" style={{ background: "rgba(15,15,20,0.7)", backdropFilter: "blur(12px)", border: "1px solid rgba(255,255,255,0.06)" }}>
                        {quickStatsLoading ? (
                          [0, 1, 2].map((i) => (
                            <div key={i} className="flex items-center gap-3 px-4 py-3 animate-pulse">
                              <div className="w-8 h-8 rounded-lg bg-white/[0.06]" />
                              <div className="flex-1 space-y-1.5">
                                <div className="h-2 w-20 rounded bg-white/[0.06]" />
                                <div className="h-3 w-28 rounded bg-white/[0.08]" />
                              </div>
                            </div>
                          ))
                        ) : (
                          [
                            {
                              label: "Most Active Table",
                              value: quickStats?.mostActiveTable
                                ? `${quickStats.mostActiveTable.name} (${quickStats.mostActiveTable.playerCount} players)`
                                : null,
                              icon: Layers,
                            },
                            {
                              label: "Top Winner This Week",
                              value: quickStats?.topWinnerThisWeek
                                ? `${quickStats.topWinnerThisWeek.displayName} +${quickStats.topWinnerThisWeek.amount.toLocaleString()}`
                                : null,
                              icon: Trophy,
                            },
                            {
                              label: "Biggest Pot Today",
                              value: quickStats?.biggestPotToday
                                ? `${quickStats.biggestPotToday.amount.toLocaleString()} chips (${quickStats.biggestPotToday.winnerName})`
                                : null,
                              icon: Coins,
                            },
                          ].map((stat) => {
                            const Icon = stat.icon;
                            return (
                              <div key={stat.label} className="flex items-center gap-3 px-4 py-3">
                                <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 bg-primary/[0.08] border border-primary/15">
                                  <Icon className="w-4 h-4 text-primary" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-[0.5625rem] text-gray-500 uppercase tracking-wider font-bold">{stat.label}</p>
                                  <p className={cn("text-xs font-bold truncate", stat.value ? "text-white" : "text-gray-600")}>
                                    {stat.value ?? "No activity yet"}
                                  </p>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>

                    {/* Recent Activity */}
                    <div className="space-y-4">
                      <h3 className="font-display font-bold text-white text-lg flex items-center gap-2">
                        <Activity className="w-4 h-4 text-primary" /> Recent Activity
                      </h3>
                      <div className="rounded-md divide-y divide-white/[0.04]" style={{ background: "rgba(15,15,20,0.7)", backdropFilter: "blur(12px)", border: "1px solid rgba(255,255,255,0.06)" }}>

                      {clubActivity.length === 0 ? (
                        <div className="py-10 px-4 text-center">
                          <img src="/empty/empty_no_clubs.webp" alt="" className="w-48 h-32 object-cover rounded-xl opacity-60 mb-4 mx-auto" />
                          <div className="w-12 h-12 rounded-2xl mx-auto mb-3 flex items-center justify-center bg-primary/[0.08] border border-primary/15">
                            <Activity className="w-6 h-6 text-gray-600" />
                          </div>
                          <p className="text-sm font-bold text-gray-500 mb-1">No recent activity</p>
                          <p className="text-[0.625rem] text-gray-600">Announcements, events, and member joins will appear here</p>
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
                                ? "text-primary"
                                : "text-amber-400";
                            const accentBg = isJoin
                              ? "bg-green-500/12 border-green-500/20"
                              : isGame
                                ? "bg-amber-500/12 border-amber-500/20"
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
                      </div>
                    </div>

                    {/* Tournament Alerts */}
                    <div className="space-y-4">
                      <h3 className="font-display font-bold text-white text-lg flex items-center gap-2">
                        <Trophy className="w-4 h-4 text-amber-400" /> Tournament Alerts
                      </h3>
                      <div className="rounded-md divide-y divide-white/[0.04]" style={{ background: "rgba(15,15,20,0.7)", backdropFilter: "blur(12px)", border: "1px solid rgba(255,255,255,0.06)" }}>
                        {[
                          { id: 1, text: "Final Table starting in 5 min", time: "Just now", color: "text-red-400", bg: "bg-red-500/12 border-red-500/20", icon: Activity },
                          { id: 2, text: "New tournament registration open", time: "10 min ago", color: "text-green-400", bg: "bg-green-500/12 border-green-500/20", icon: Trophy },
                          { id: 3, text: "Sunday Special begins at 8 PM", time: "1 hr ago", color: "text-amber-400", bg: "bg-amber-500/12 border-amber-500/20", icon: Medal },
                        ].map((alert, i) => {
                          const AlertIcon = alert.icon;
                          return (
                            <motion.div
                              key={alert.id}
                              initial={{ opacity: 0, x: -8 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: 0.2 + i * 0.06 }}
                              className="flex items-start gap-3 px-4 py-3"
                            >
                              <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border ${alert.bg}`}>
                                <AlertIcon className={`w-4 h-4 ${alert.color}`} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs text-white leading-snug font-medium">{alert.text}</p>
                                <p className="text-[0.5625rem] text-gray-600 mt-0.5">{alert.time}</p>
                              </div>
                            </motion.div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Club Challenges */}
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="font-display font-bold text-white text-lg flex items-center gap-2">
                          <Target className="w-4 h-4 text-purple-400" /> Club Challenges
                        </h3>
                        {isAdminOrOwner && (
                          <button
                            onClick={handleGenerateChallenges}
                            disabled={generatingChallenges}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider bg-purple-500/15 border border-purple-500/25 text-purple-300 hover:bg-purple-500/25 transition-colors disabled:opacity-50"
                          >
                            {generatingChallenges ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                            Generate New
                          </button>
                        )}
                      </div>
                      {challengesLoading ? (
                        <div className="flex justify-center py-8">
                          <Loader2 className="w-5 h-5 animate-spin text-gray-500" />
                        </div>
                      ) : clubChallenges.length === 0 ? (
                        <div className="rounded-md py-8 text-center" style={{ background: "rgba(15,15,20,0.7)", backdropFilter: "blur(12px)", border: "1px solid rgba(255,255,255,0.06)" }}>
                          <Target className="w-8 h-8 text-gray-600 mx-auto mb-2" />
                          <p className="text-xs text-gray-500 font-medium">No active challenges</p>
                          <p className="text-[0.5625rem] text-gray-600 mt-0.5">
                            {isAdminOrOwner ? "Click \"Generate New\" to create weekly challenges" : "Admin can generate new challenges"}
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {clubChallenges.map((ch: any, i: number) => {
                            const isCompleted = !!ch.completedAt;
                            const progress = Math.min(ch.currentValue / ch.targetValue, 1);
                            const pct = Math.round(progress * 100);
                            // Time remaining
                            const expiresMs = new Date(ch.expiresAt).getTime() - Date.now();
                            const days = Math.floor(expiresMs / (1000 * 60 * 60 * 24));
                            const hours = Math.floor((expiresMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                            const timeLeft = expiresMs > 0 ? `${days}d ${hours}h left` : "Expired";

                            return (
                              <motion.div
                                key={ch.id}
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: i * 0.06 }}
                                className="rounded-md px-4 py-3"
                                style={{ background: "rgba(15,15,20,0.7)", backdropFilter: "blur(12px)", border: isCompleted ? "1px solid rgba(34,197,94,0.2)" : "1px solid rgba(255,255,255,0.06)" }}
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                      <p className="text-sm font-bold text-white truncate">{ch.title}</p>
                                      {isCompleted && (
                                        <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-green-500/15 border border-green-500/25 text-[9px] font-bold uppercase tracking-wider text-green-400">
                                          <CheckCircle2 className="w-2.5 h-2.5" /> Claimed
                                        </span>
                                      )}
                                    </div>
                                    <p className="text-[0.5625rem] text-gray-500 mt-0.5">{ch.description}</p>
                                  </div>
                                  <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 shrink-0">
                                    <Coins className="w-3 h-3 text-amber-400" />
                                    <span className="text-[10px] font-bold text-amber-400">{ch.rewardChips.toLocaleString()}</span>
                                  </div>
                                </div>
                                <div className="mt-2.5">
                                  <div className="flex items-center justify-between mb-1">
                                    <span className="text-[10px] text-gray-400 font-medium">
                                      {ch.currentValue.toLocaleString()} / {ch.targetValue.toLocaleString()}
                                    </span>
                                    <span className="text-[10px] text-gray-500 flex items-center gap-1">
                                      {isCompleted ? (
                                        <span className="text-green-400 font-bold">Complete</span>
                                      ) : (
                                        <><Clock className="w-2.5 h-2.5" /> {timeLeft}</>
                                      )}
                                    </span>
                                  </div>
                                  <div className="w-full h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                                    <motion.div
                                      initial={{ width: 0 }}
                                      animate={{ width: `${pct}%` }}
                                      transition={{ duration: 0.8, ease: "easeOut", delay: i * 0.1 }}
                                      className={cn(
                                        "h-full rounded-full",
                                        isCompleted ? "bg-green-500" : "bg-gradient-to-r from-purple-500 to-purple-400"
                                      )}
                                    />
                                  </div>
                                  <div className="text-right mt-0.5">
                                    <span className="text-[9px] font-bold text-gray-500">{pct}%</span>
                                  </div>
                                </div>
                              </motion.div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Club Chat */}
                    <ClubChatSidebar clubName={club?.name} className="mt-4" />
                  </div>
                </div>
              )}

              {activeTab === "tournaments" && <ClubTournaments />}

              {activeTab === "leaderboard" && club && <ClubLeaderboard clubId={club.id} />}

              {activeTab === "members" && <div>
                <div className="rounded-md overflow-hidden" style={{ background: "rgba(15,15,20,0.7)", backdropFilter: "blur(12px)", border: "1px solid rgba(255,255,255,0.06)" }}>
                    <div className="hidden sm:grid grid-cols-[1fr_100px_100px_80px] gap-4 px-4 py-2 border-b border-white/[0.04] text-[10px] text-muted-foreground uppercase tracking-widest font-bold">
                      <span>Player</span>
                      <span>Chips</span>
                      <span>Hands</span>
                      <span>Status</span>
                    </div>

                    {members.length === 0 ? (
                      <div className="py-12 text-center">
                        <div className="w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center bg-primary/[0.08] border border-primary/15">
                          <Users className="w-7 h-7 text-gray-600" />
                        </div>
                        <p className="text-sm font-bold text-gray-500 mb-1">No members yet</p>
                        <p className="text-[0.625rem] text-gray-600">Invite friends to join your club and start playing together</p>
                      </div>
                    ) : (
                      members.map((member, i) => {
                        const ms = memberStatsMap[member.userId];
                        const isOnline = onlineUserIds.has(member.userId);
                        const status = isOnline ? "Active" : member.role === "owner" ? "VIP" : "Offline";
                        const statusColor = isOnline
                          ? "bg-secondary/10 text-secondary"
                          : status === "VIP"
                            ? "bg-primary/10 text-primary"
                            : "bg-white/5 text-muted-foreground";

                        return (
                          <motion.div
                            key={member.userId}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: i * 0.03 }}
                            data-testid={`row-member-${member.userId}`}
                            className="flex flex-col sm:grid sm:grid-cols-[1fr_100px_100px_80px] gap-2 sm:gap-4 px-4 py-3 items-start sm:items-center border-b border-white/[0.02] last:border-0 hover:bg-white/[0.02] transition-colors"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <MemberAvatar
                                avatarId={member.avatarId}
                                displayName={member.displayName}
                                size="sm"
                              />
                              <div className="min-w-0">
                                <p className="font-bold text-white text-sm truncate">{member.displayName}</p>
                                <p className="text-[10px] text-muted-foreground truncate">@{member.username}</p>
                              </div>
                            </div>
                            <span className="text-sm font-display font-bold text-secondary">
                              {member.chipBalance.toLocaleString()}
                            </span>
                            <span className="text-sm text-muted-foreground">
                              {ms?.handsPlayed ?? 0}
                            </span>
                            <span className={cn("text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full", statusColor)}>
                              {status}
                            </span>
                          </motion.div>
                        );
                      })
                    )}
                </div>

                {/* Pending Join Requests */}
                {pendingInvitations.length > 0 && (
                  <div className="mt-6 bg-surface-high/50 backdrop-blur-xl rounded-md border border-white/[0.06] p-4">
                    <h3 className="font-display font-bold text-white text-sm mb-3">
                      Pending Requests ({pendingInvitations.length})
                    </h3>
                    <div className="space-y-3">
                      {pendingInvitations.map(inv => (
                        <div key={inv.id} className="flex items-center gap-3">
                          <MemberAvatar avatarId={inv.avatarId ?? null} displayName={inv.displayName} size="sm" />
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-bold text-white truncate">{inv.displayName}</div>
                            <div className="text-[10px] text-muted-foreground">
                              {inv.type === "request" ? "Request to Join" : "Pending Invite"}
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <NeonButton
                              variant="success"
                              size="sm"
                              onClick={() => handleInvitationAction(inv.id, "accepted")}
                              disabled={actionLoading === inv.id}
                              data-testid={`button-approve-${inv.id}`}
                              className="gap-1"
                            >
                              {actionLoading === inv.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <><Check className="w-3 h-3" /> Approve</>}
                            </NeonButton>
                            <NeonButton
                              variant="destructive"
                              size="sm"
                              onClick={() => handleInvitationAction(inv.id, "declined")}
                              disabled={actionLoading === inv.id}
                              data-testid={`button-decline-${inv.id}`}
                              className="gap-1"
                            >
                              <X className="w-3 h-3" /> Decline
                            </NeonButton>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>}
            </>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}