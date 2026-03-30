import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useAuth } from "@/lib/auth-context";
import { MemberAvatar } from "@/components/shared/MemberAvatar";
import { TAUNT_VOICE_OPTIONS, setTauntVoice } from "@/components/poker/TauntSystem";
import {
  User, Coins, Trophy, TrendingUp, Gamepad2,
  Zap, BookOpen, Wallet, Users, Loader2, Mic, Volume2, Check,
  Star, Shield, Crown, Clock, ChevronRight, Award, Flame, Target
} from "lucide-react";
import goldChips from "@assets/generated_images/gold_chip_stack_3d.webp";

interface PlayerStats {
  handsPlayed: number;
  potsWon: number;
  bestWinStreak: number;
  currentWinStreak: number;
  totalWinnings: number;
  vpip: number;
  pfr: number;
  showdownCount: number;
}

function AnimatedNumber({ value, duration = 800 }: { value: number; duration?: number }) {
  const [display, setDisplay] = useState(0);
  const prevRef = useRef(0);

  useEffect(() => {
    const from = prevRef.current;
    const to = value;
    prevRef.current = value;
    if (from === to) { setDisplay(to); return; }
    const startTime = performance.now();
    const diff = to - from;
    const tick = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(from + diff * eased));
      if (progress < 1) requestAnimationFrame(tick);
      else setDisplay(to);
    };
    requestAnimationFrame(tick);
  }, [value, duration]);

  return <>{display.toLocaleString()}</>;
}

function getRankTier(handsPlayed: number): { label: string; color: string; bgClass: string; borderColor: string; icon: typeof Crown; glowStyle?: { boxShadow: string } } {
  if (handsPlayed >= 1000) return { label: "Diamond", color: "text-primary", bgClass: "from-cyan-500/20 to-blue-500/20", borderColor: "border-[#c9a84c]/50", icon: Crown, glowStyle: { boxShadow: "0 0 12px rgba(201,168,76,0.35), 0 0 24px rgba(201,168,76,0.15)" } };
  if (handsPlayed >= 500) return { label: "Platinum", color: "text-gray-200", bgClass: "from-gray-300/20 to-gray-500/20", borderColor: "border-[#c9a84c]/40", icon: Crown, glowStyle: { boxShadow: "0 0 10px rgba(201,168,76,0.25), 0 0 20px rgba(201,168,76,0.10)" } };
  if (handsPlayed >= 200) return { label: "Gold", color: "text-amber-400", bgClass: "from-amber-500/20 to-yellow-500/20", borderColor: "border-amber-400/40", icon: Star };
  if (handsPlayed >= 50) return { label: "Silver", color: "text-gray-400", bgClass: "from-gray-400/20 to-gray-500/20", borderColor: "border-gray-400/30", icon: Shield };
  return { label: "Bronze", color: "text-orange-400", bgClass: "from-orange-500/20 to-amber-600/20", borderColor: "border-orange-400/30", icon: Shield };
}

function getPlayerTitle(handsPlayed: number, winRate: number): string {
  if (handsPlayed >= 5000 && winRate >= 60) return "Grandmaster";
  if (handsPlayed >= 2000 && winRate >= 50) return "Shark";
  if (handsPlayed >= 1000) return "Veteran";
  if (handsPlayed >= 500) return "Enforcer";
  if (handsPlayed >= 200) return "Grinder";
  if (handsPlayed >= 100) return "Regular";
  if (handsPlayed >= 50) return "Contender";
  if (handsPlayed >= 10) return "Rookie";
  return "Newcomer";
}

function getPlayerLevel(handsPlayed: number): number {
  if (handsPlayed >= 5000) return 50;
  if (handsPlayed >= 2000) return 40;
  if (handsPlayed >= 1000) return 30;
  if (handsPlayed >= 500) return 20;
  if (handsPlayed >= 200) return 15;
  if (handsPlayed >= 100) return 10;
  if (handsPlayed >= 50) return 5;
  if (handsPlayed >= 10) return 2;
  return 1;
}

const STAT_CARDS = [
  { key: "handsPlayed", label: "Hands Played", icon: Gamepad2, gradient: "from-primary/15 to-blue-600/15", borderColor: "border-primary/20", textColor: "text-primary", glowColor: "rgba(0,212,255,0.12)" },
  { key: "potsWon", label: "Pots Won", icon: Trophy, gradient: "from-green-500/15 to-emerald-600/15", borderColor: "border-green-500/20", textColor: "text-green-400", glowColor: "rgba(34,197,94,0.12)" },
  { key: "winRate", label: "Win Rate", icon: TrendingUp, gradient: "from-amber-500/15 to-yellow-600/15", borderColor: "border-amber-500/20", textColor: "text-amber-400", glowColor: "rgba(245,158,11,0.12)", suffix: "%" },
  { key: "bestWinStreak", label: "Best Streak", icon: Zap, gradient: "from-purple-500/15 to-violet-600/15", borderColor: "border-purple-500/20", textColor: "text-purple-400", glowColor: "rgba(168,85,247,0.12)" },
];

const BADGES = [
  { name: "First Win", img: "/attached_assets/generated_images/badges/badge_first_win.webp", glow: "#ffd700", criteria: "Win your first pot", check: (s: PlayerStats) => s.potsWon >= 1, progress: (s: PlayerStats) => ({ current: Math.min(s.potsWon, 1), max: 1 }) },
  { name: "Royal Flush", img: "/attached_assets/generated_images/badges/badge_royal_flush.webp", glow: "#dc2626", criteria: "Hit a Royal Flush", check: () => false, progress: () => ({ current: 0, max: 1 }) },
  { name: "High Roller", img: "/attached_assets/generated_images/badges/badge_high_roller.webp", glow: "#00d4ff", criteria: "Win 10,000+ chips total", check: (s: PlayerStats) => s.totalWinnings >= 10000, progress: (s: PlayerStats) => ({ current: Math.min(s.totalWinnings, 10000), max: 10000 }) },
  { name: "Bluff Master", img: "/attached_assets/generated_images/badges/badge_bluff_master.webp", glow: "#a855f7", criteria: "Win 50 pots without showdown", check: () => false, progress: () => ({ current: 0, max: 50 }) },
  { name: "Iron Player", img: "/attached_assets/generated_images/badges/badge_iron_player.webp", glow: "#6b7280", criteria: "Play 100 hands", check: (s: PlayerStats) => s.handsPlayed >= 100, progress: (s: PlayerStats) => ({ current: Math.min(s.handsPlayed, 100), max: 100 }) },
  { name: "On Fire", img: "/attached_assets/generated_images/badges/badge_streak_fire.webp", glow: "#f59e0b", criteria: "Win 5 pots in a row", check: (s: PlayerStats) => s.bestWinStreak >= 5, progress: (s: PlayerStats) => ({ current: Math.min(s.bestWinStreak, 5), max: 5 }) },
  { name: "Champion", img: "/attached_assets/generated_images/badges/badge_tournament_champ.webp", glow: "#ffd700", criteria: "Win a tournament", check: () => false, progress: () => ({ current: 0, max: 1 }) },
  { name: "Legend", img: "/attached_assets/generated_images/badges/badge_club_legend.webp", glow: "#a855f7", criteria: "Play 1,000 hands", check: (s: PlayerStats) => s.handsPlayed >= 1000, progress: (s: PlayerStats) => ({ current: Math.min(s.handsPlayed, 1000), max: 1000 }) },
];

export default function Profile() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [stats, setStats] = useState<PlayerStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [statsError, setStatsError] = useState<string | null>(null);
  const [hoveredBadge, setHoveredBadge] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/stats/me")
      .then(r => {
        if (r.status === 401) throw new Error("Session expired — please log in again");
        if (!r.ok) throw new Error("Failed to load stats");
        return r.json();
      })
      .then(data => setStats(data))
      .catch((err) => setStatsError(err.message || "Failed to load stats"))
      .finally(() => setLoading(false));
  }, []);

  const winRate = stats && stats.handsPlayed > 0
    ? Math.round((stats.potsWon / stats.handsPlayed) * 100)
    : 0;

  const rank = getRankTier(stats?.handsPlayed ?? 0);
  const RankIcon = rank.icon;
  const playerLevel = getPlayerLevel(stats?.handsPlayed ?? 0);
  const playerTitle = getPlayerTitle(stats?.handsPlayed ?? 0, winRate);

  return (
    <DashboardLayout title="Profile">
      <div className="pb-8 max-w-5xl mx-auto">
        {/* ── Hero Banner ── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden rounded-2xl mx-4 md:mx-8 mb-6"
          style={{ minHeight: 200 }}
        >
          <div className="absolute inset-0 bg-gradient-to-r from-background via-surface-high to-background" />
          <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.08] via-transparent to-purple-500/8" />
          <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-purple-500/30 to-transparent" />

          <img
            src={goldChips}
            alt="Gold chips"
            loading="lazy"
            className="absolute -top-6 -right-10 w-52 h-52 object-contain opacity-10 pointer-events-none rotate-12"
          />
          <div className="absolute -top-32 -right-32 w-80 h-80 bg-primary/5 rounded-full blur-[80px] pointer-events-none" />
          <div className="absolute -bottom-20 -left-20 w-60 h-60 bg-purple-500/5 rounded-full blur-[60px] pointer-events-none" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[200px] bg-primary/3 rounded-full blur-[100px] pointer-events-none" />

          <div className="relative z-10 flex flex-col md:flex-row items-center gap-6 p-8 md:p-10">
            <div className="relative">
              <div className="relative ring-2 ring-[#c9a84c]/30 rounded-full shadow-[0_0_16px_rgba(201,168,76,0.15)]" data-testid="img-avatar">
                <MemberAvatar
                  avatarId={user?.avatarId ?? null}
                  displayName={user?.displayName || user?.username || "Player"}
                  size="xl"
                />
                <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-green-400 border-2 border-background shadow-[0_0_8px_rgba(74,222,128,0.6)]" />
              </div>
            </div>

            <div className="flex-1 text-center md:text-left">
              <div className="flex items-center gap-3 justify-center md:justify-start">
                <h2 className="text-2xl md:text-3xl font-display font-black text-white tracking-tight" data-testid="text-username">
                  {user?.displayName || user?.username || "Player"}
                </h2>
                <span
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[0.625rem] font-bold uppercase tracking-wider bg-gradient-to-r ${rank.bgClass} ${rank.borderColor} border ${rank.color}`}
                  style={rank.glowStyle}
                >
                  <RankIcon className="w-3 h-3" />
                  {rank.label}
                </span>
              </div>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[0.625rem] font-bold uppercase tracking-widest text-amber-400/80 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/15">
                  Level {playerLevel} {playerTitle}
                </span>
              </div>
              <p className="text-sm text-gray-500 mt-1">@{user?.username}</p>
              <div className="flex items-center gap-4 mt-3 justify-center md:justify-start">
                <span className="flex items-center gap-1.5 text-sm font-bold text-primary" data-testid="text-chip-balance">
                  <Coins className="w-4 h-4" />
                  {(user?.chipBalance ?? 0).toLocaleString()} chips
                </span>
                <span className={`px-2.5 py-0.5 rounded-full text-[0.625rem] font-bold uppercase tracking-wider ${
                  user?.role === "admin"
                    ? "bg-purple-500/15 text-purple-400 border border-purple-500/20"
                    : "bg-primary/15 text-primary border border-primary/20"
                }`} data-testid="text-role">
                  {user?.role || "member"}
                </span>
              </div>
            </div>
          </div>
        </motion.div>

        <div className="px-4 md:px-8">
          {/* ── Stats Grid ── */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="mb-6"
          >
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-4 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-primary/70" />
              Your Statistics
            </h3>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : statsError ? (
              <div className="flex items-center justify-center py-12">
                <p className="text-sm text-red-400" data-testid="text-stats-error">{statsError}</p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {STAT_CARDS.map((card, i) => {
                    const Icon = card.icon;
                    const val = card.key === "winRate" ? winRate : (stats as any)?.[card.key] ?? 0;
                    return (
                      <motion.div
                        key={card.key}
                        initial={{ opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.15 + i * 0.05 }}
                        className={`relative text-center p-5 rounded-xl bg-gradient-to-br ${card.gradient} border ${card.borderColor} overflow-hidden group hover:scale-[1.02] transition-transform`}
                        data-testid={`stat-card-${card.key}`}
                      >
                        <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent pointer-events-none" />
                        <Icon className={`w-7 h-7 ${card.textColor} mx-auto mb-3 opacity-80`} />
                        <div className={`text-3xl font-black ${card.textColor} tabular-nums`}>
                          <AnimatedNumber value={val} />
                          {card.suffix || ""}
                        </div>
                        <div className="text-[0.625rem] text-gray-500 uppercase tracking-wider mt-1.5 font-semibold">{card.label}</div>
                      </motion.div>
                    );
                  })}
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
                  {[
                    { label: "Current Streak", value: stats!.currentWinStreak.toString(), color: "text-white", icon: Flame },
                    { label: "Total Winnings", value: stats!.totalWinnings.toLocaleString(), color: "text-green-400", icon: Coins },
                    { label: "VPIP", value: `${stats!.handsPlayed > 0 ? Math.round((stats!.vpip / stats!.handsPlayed) * 100) : 0}%`, color: "text-white", icon: Target },
                    { label: "PFR", value: `${stats!.handsPlayed > 0 ? Math.round((stats!.pfr / stats!.handsPlayed) * 100) : 0}%`, color: "text-white", icon: TrendingUp },
                  ].map((item) => {
                    const SubIcon = item.icon;
                    return (
                      <div key={item.label} className="flex items-center gap-3 p-3.5 rounded-lg bg-white/[0.03] border border-white/5 hover:border-white/10 transition-colors">
                        <SubIcon className="w-4 h-4 text-gray-600 shrink-0" />
                        <div className="flex-1">
                          <span className="text-[0.625rem] text-gray-500 block">{item.label}</span>
                          <span className={`text-sm font-bold ${item.color}`}>{item.value}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </motion.div>

          {/* ── Achievement Badges ── */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="glass rounded-xl p-6 border border-white/5 mb-6"
          >
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-5 flex items-center gap-2">
              <Award className="w-4 h-4 text-amber-500/70" />
              Achievements
              {stats && (
                <span className="ml-auto text-[0.625rem] text-gray-600 font-normal normal-case tracking-normal">
                  {BADGES.filter(b => b.check(stats)).length}/{BADGES.length} unlocked
                </span>
              )}
            </h3>
            <div className="grid grid-cols-4 md:grid-cols-8 gap-4">
              {BADGES.map((badge) => {
                const unlocked = stats ? badge.check(stats) : false;
                const prog = stats ? badge.progress(stats) : { current: 0, max: 1 };
                const progressPct = Math.min((prog.current / prog.max) * 100, 100);
                const isHovered = hoveredBadge === badge.name;

                return (
                  <div
                    key={badge.name}
                    className="flex flex-col items-center gap-2 group relative"
                    onMouseEnter={() => setHoveredBadge(badge.name)}
                    onMouseLeave={() => setHoveredBadge(null)}
                    data-testid={`badge-${badge.name.toLowerCase().replace(/\s/g, '-')}`}
                  >
                    <div
                      className={`relative w-16 h-16 rounded-xl overflow-hidden border-2 transition-all duration-300 ${
                        unlocked
                          ? "border-white/25 opacity-100 hover:scale-110"
                          : "border-white/5 opacity-40 grayscale hover:opacity-60"
                      }`}
                      style={unlocked ? {
                        boxShadow: `0 0 16px ${badge.glow}40, 0 0 32px ${badge.glow}15`,
                        animation: "shimmer 3s ease-in-out infinite",
                      } : {}}
                    >
                      <img src={badge.img} alt={badge.name} className="w-full h-full object-cover" loading="lazy" />
                      {unlocked && (
                        <div className="absolute inset-0 bg-gradient-to-t from-transparent via-transparent to-white/10 pointer-events-none" />
                      )}
                    </div>

                    {!unlocked && (
                      <div className="w-12 h-1 rounded-full bg-white/10 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-primary/60 to-primary/60 transition-all"
                          style={{ width: `${progressPct}%` }}
                        />
                      </div>
                    )}

                    <span className={`text-[0.5625rem] font-bold text-center leading-tight ${
                      unlocked ? "text-gray-300" : "text-gray-600"
                    }`}>
                      {badge.name}
                    </span>

                    <AnimatePresence>
                      {isHovered && (
                        <motion.div
                          initial={{ opacity: 0, y: 4, scale: 0.95 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: 4, scale: 0.95 }}
                          transition={{ duration: 0.15 }}
                          className="absolute -top-16 left-1/2 -translate-x-1/2 z-50 px-3 py-2 rounded-lg bg-surface-low border border-white/10 shadow-xl whitespace-nowrap"
                        >
                          <div className="text-[0.625rem] font-bold text-white">{badge.criteria}</div>
                          {!unlocked && (
                            <div className="text-[0.5rem] text-gray-500 mt-0.5">
                              {prog.current.toLocaleString()}/{prog.max.toLocaleString()}
                            </div>
                          )}
                          <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 rotate-45 bg-surface-low border-r border-b border-white/10" />
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>
          </motion.div>

          {/* ── Recent Sessions (placeholder) ── */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.17 }}
            className="glass rounded-xl p-6 border border-white/5 mb-6"
          >
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#c9a84c]/80 mb-4 flex items-center gap-2">
              <Clock className="w-4 h-4 text-[#c9a84c]/70" />
              Recent Sessions
            </h3>
            <div className="space-y-2">
              {[
                { time: "Today", hands: 24, result: "+1,250", positive: true },
                { time: "Yesterday", hands: 18, result: "-320", positive: false },
                { time: "2 days ago", hands: 42, result: "+3,800", positive: true },
              ].map((session, i) => (
                <div key={i} className="flex items-center gap-4 p-3.5 rounded-lg bg-white/[0.02] border border-white/5 hover:border-white/10 transition-colors" data-testid={`session-row-${i}`}>
                  <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-primary/10 to-purple-500/10 flex items-center justify-center">
                    <Gamepad2 className="w-4 h-4 text-primary/60" />
                  </div>
                  <div className="flex-1">
                    <div className="text-xs font-semibold text-white">{session.time}</div>
                    <div className="text-[0.625rem] text-gray-500">{session.hands} hands played</div>
                  </div>
                  <div className={`text-sm font-bold ${session.positive ? "text-secondary" : "text-destructive"}`}>
                    {session.result}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>

          {/* ── Taunt Voice ── */}
          <TauntVoicePicker currentVoice={user?.tauntVoice || "default"} />

          {/* ── Quick Links ── */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="grid grid-cols-2 md:grid-cols-4 gap-4"
          >
            {[
              { label: "Security", icon: Shield, color: "cyan", path: "/security", gradient: "from-primary/10 to-purple-500/10", border: "hover:border-primary/30", iconBg: "bg-primary/10" },
              { label: "Wallet", icon: Wallet, color: "cyan", path: "/wallet", gradient: "from-primary/10 to-blue-600/10", border: "hover:border-primary/30", iconBg: "bg-primary/10" },
              { label: "Transactions", icon: Coins, color: "green", path: "/wallet?tab=history", gradient: "from-green-500/10 to-emerald-600/10", border: "hover:border-green-500/30", iconBg: "bg-green-500/10" },
              { label: "Analytics", icon: BookOpen, color: "amber", path: "/analytics", gradient: "from-amber-500/10 to-yellow-600/10", border: "hover:border-amber-500/30", iconBg: "bg-amber-500/10" },
              { label: "My Club", icon: Users, color: "green", path: "/club", gradient: "from-green-500/10 to-emerald-600/10", border: "hover:border-green-500/30", iconBg: "bg-green-500/10" },
              { label: "Leaderboard", icon: Trophy, color: "purple", path: "/leaderboard", gradient: "from-purple-500/10 to-violet-600/10", border: "hover:border-purple-500/30", iconBg: "bg-purple-500/10" },
              { label: "Wardrobe", icon: User, color: "cyan", path: "/wardrobe", gradient: "from-cyan-500/10 to-blue-500/10", border: "hover:border-cyan-500/30", iconBg: "bg-cyan-500/10" },
              { label: "Premium", icon: Crown, color: "amber", path: "/premium", gradient: "from-amber-500/10 to-yellow-500/10", border: "hover:border-amber-500/30", iconBg: "bg-amber-500/10" },
            ].map((link) => {
              const LinkIcon = link.icon;
              return (
                <motion.button
                  key={link.label}
                  whileHover={{ scale: 1.03, y: -2 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => navigate(link.path)}
                  className={`relative glass rounded-xl p-5 border border-white/5 ${link.border} transition-all text-left group overflow-hidden`}
                  data-testid={`link-${link.label.toLowerCase().replace(/\s/g, '-')}`}
                >
                  <div className={`absolute inset-0 bg-gradient-to-br ${link.gradient} opacity-0 group-hover:opacity-100 transition-opacity`} />
                  <div className="relative z-10">
                    <div className={`w-10 h-10 rounded-lg ${link.iconBg} flex items-center justify-center mb-3`}>
                      <LinkIcon className={`w-5 h-5 text-${link.color}-400`} />
                    </div>
                    <span className="text-sm font-bold text-gray-300 group-hover:text-white transition-colors block">
                      {link.label}
                    </span>
                    <ChevronRight className="w-4 h-4 text-gray-600 group-hover:text-gray-400 absolute top-5 right-4 transition-colors" />
                  </div>
                </motion.button>
              );
            })}
          </motion.div>
        </div>
      </div>
    </DashboardLayout>
  );
}

function TauntVoicePicker({ currentVoice }: { currentVoice: string }) {
  const { refreshUser } = useAuth();
  const [selected, setSelected] = useState(currentVoice);
  const [saving, setSaving] = useState(false);
  const [previewPlaying, setPreviewPlaying] = useState<string | null>(null);

  const save = useCallback(async (voiceId: string) => {
    setSelected(voiceId);
    setTauntVoice(voiceId);
    setSaving(true);
    try {
      await fetch("/api/profile/avatar", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tauntVoice: voiceId }),
      });
      await refreshUser();
    } catch {}
    setSaving(false);
  }, [refreshUser]);

  const preview = useCallback((voiceId: string) => {
    setPreviewPlaying(voiceId);
    const path = `/sounds/taunts/${voiceId}/ship-it.mp3`;
    const audio = new Audio(path);
    audio.volume = 0.7;
    audio.onended = () => setPreviewPlaying(null);
    audio.onerror = () => {
      const fb = new Audio(`/sounds/taunts/ship-it.mp3`);
      fb.volume = 0.7;
      fb.onended = () => setPreviewPlaying(null);
      fb.play().catch(() => setPreviewPlaying(null));
    };
    audio.play().catch(() => setPreviewPlaying(null));
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className="glass rounded-xl p-6 border border-white/5 mb-6"
    >
      <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-4 flex items-center gap-2">
        <Mic className="w-4 h-4 text-purple-500/70" />
        Taunt Voice
      </h3>
      <p className="text-[0.625rem] text-gray-500 mb-4">
        Choose the voice your taunts play in. Default is a confident, energetic voice. Or pick one that matches your avatar.
      </p>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
        {TAUNT_VOICE_OPTIONS.map((voice) => {
          const isSelected = selected === voice.id;
          return (
            <button
              key={voice.id}
              onClick={() => save(voice.id)}
              disabled={saving}
              data-testid={`button-voice-${voice.id}`}
              className={`relative text-left p-3 rounded-lg border transition-all ${
                isSelected
                  ? "bg-purple-500/15 border-purple-500/30 shadow-[0_0_12px_rgba(168,85,247,0.15)]"
                  : "bg-white/[0.03] border-white/5 hover:border-white/15 hover:bg-white/[0.05]"
              }`}
            >
              {isSelected && (
                <div className="absolute top-1.5 right-1.5">
                  <Check className="w-3 h-3 text-purple-400" />
                </div>
              )}
              <div className="text-xs font-bold text-white mb-0.5">{voice.label}</div>
              <div className="text-[0.5rem] text-gray-500 leading-tight mb-2">{voice.description}</div>
              <button
                onClick={(e) => { e.stopPropagation(); preview(voice.id); }}
                className="flex items-center gap-1 text-[0.5625rem] text-primary hover:text-primary/80 transition-colors"
                data-testid={`button-preview-${voice.id}`}
              >
                <Volume2 className="w-2.5 h-2.5" />
                {previewPlaying === voice.id ? "Playing..." : "Preview"}
              </button>
            </button>
          );
        })}
      </div>
    </motion.div>
  );
}
