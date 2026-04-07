import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { DashboardLayout } from "@/components/DashboardLayout";
import { PageBackground } from "@/components/shared/PageBackground";
import { useAuth } from "@/lib/auth-context";
import {
  Star, Trophy, Gift, Clock, Copy, Check, Loader2,
  ChevronRight, Lock, Sparkles, Medal, Crown, Gem,
  Calendar, Users, Target, Zap, Shield, Award,
import { GoldButton, GoldCard, SectionHeader, GoldDivider } from "@/components/premium/PremiumComponents";
} from "lucide-react";
import { GoldButton, GoldCard, NumberTicker, SectionHeader, GoldDivider, SpotlightCard } from "@/components/premium/PremiumComponents";

// ─── Loyalty Level Definitions (mirror server) ─────────────────────────────
const LOYALTY_LEVELS = [
  { level: 1, name: "Rookie", hrpRequired: 0, badge: "bronze-chip", color: "text-gray-400", glow: "rgba(156,163,175,0.3)" },
  { level: 2, name: "Regular", hrpRequired: 500, badge: "silver-chip", color: "text-gray-300", glow: "rgba(209,213,219,0.3)" },
  { level: 3, name: "Grinder", hrpRequired: 2000, badge: "gold-chip", color: "text-yellow-400", glow: "rgba(250,204,21,0.3)" },
  { level: 4, name: "Shark", hrpRequired: 5000, badge: "platinum-chip", color: "text-cyan-400", glow: "rgba(34,211,238,0.3)" },
  { level: 5, name: "High Roller", hrpRequired: 15000, badge: "diamond-chip", color: "text-blue-400", glow: "rgba(96,165,250,0.3)" },
  { level: 6, name: "VIP", hrpRequired: 35000, badge: "ruby-chip", color: "text-red-400", glow: "rgba(248,113,113,0.3)" },
  { level: 7, name: "Elite", hrpRequired: 75000, badge: "sapphire-chip", color: "text-indigo-400", glow: "rgba(129,140,248,0.3)" },
  { level: 8, name: "Legend", hrpRequired: 150000, badge: "emerald-chip", color: "text-emerald-400", glow: "rgba(52,211,153,0.3)" },
  { level: 9, name: "Icon", hrpRequired: 300000, badge: "obsidian-chip", color: "text-purple-400", glow: "rgba(192,132,252,0.3)" },
  { level: 10, name: "Immortal", hrpRequired: 500000, badge: "holographic-chip", color: "text-amber-300", glow: "rgba(252,211,77,0.5)" },
];

const LEVEL_ICONS = [Shield, Shield, Target, Zap, Star, Crown, Gem, Medal, Award, Sparkles];

const ACHIEVEMENT_TABS = ["All", "Poker", "Tournament", "Collection"];

const DAILY_REWARDS = [
  { day: 1, chips: 500, hrp: 25 },
  { day: 2, chips: 750, hrp: 25 },
  { day: 3, chips: 1000, hrp: 50 },
  { day: 4, chips: 1250, hrp: 50 },
  { day: 5, chips: 1500, hrp: 75 },
  { day: 6, chips: 2000, hrp: 75 },
  { day: 7, chips: 3000, hrp: 150 },
];

function formatNum(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return n.toLocaleString();
}

export default function Loyalty() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"levels" | "achievements" | "daily" | "referral">("levels");
  const [achievementFilter, setAchievementFilter] = useState("All");
  const [copied, setCopied] = useState(false);

  const { data: profile, isLoading } = useQuery<any>({
    queryKey: ["/api/loyalty/profile"],
    enabled: !!user,
  });

  const { data: achievements } = useQuery<any[]>({
    queryKey: ["/api/loyalty/achievements"],
    enabled: !!user && activeTab === "achievements",
  });

  const { data: hrpHistory } = useQuery<any[]>({
    queryKey: ["/api/loyalty/hrp-history"],
    enabled: !!user,
  });

  const { data: referralData } = useQuery<any>({
    queryKey: ["/api/loyalty/referral-code"],
    enabled: !!user && activeTab === "referral",
  });

  const claimDailyMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/loyalty/daily-login", { method: "POST", credentials: "include" });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message || "Failed");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/loyalty/profile"] });
    },
  });

  const claimAchievementMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/loyalty/achievements/${id}/claim`, { method: "POST", credentials: "include" });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message || "Failed");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/loyalty/profile"] });
      queryClient.invalidateQueries({ queryKey: ["/api/loyalty/achievements"] });
    },
  });

  const currentLevel = profile?.level || 1;
  const currentLevelDef = LOYALTY_LEVELS[currentLevel - 1] || LOYALTY_LEVELS[0];
  const nextLevelDef = currentLevel < 10 ? LOYALTY_LEVELS[currentLevel] : null;
  const totalHrp = profile?.points || 0;
  const progressPercent = profile?.progressPercent || 0;
  const multiplier = profile?.multiplier || 1.0;

  const copyReferralCode = () => {
    if (referralData?.code) {
      navigator.clipboard.writeText(referralData.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const filteredAchievements = (achievements || []).filter((a: any) =>
    achievementFilter === "All" || a.category === achievementFilter.toLowerCase()
  ).sort((a: any, b: any) => {
    if (a.unlockedAt && !a.claimedAt && !(b.unlockedAt && !b.claimedAt)) return -1;
    if (b.unlockedAt && !b.claimedAt && !(a.unlockedAt && !a.claimedAt)) return 1;
    const aPct = a.requirementValue > 0 ? (a.progress || 0) / a.requirementValue : 0;
    const bPct = b.requirementValue > 0 ? (b.progress || 0) / b.requirementValue : 0;
    return bPct - aPct;
  });

  return (
    <DashboardLayout title="Loyalty Program">
      <PageBackground image="/images/generated/profile-bg.png" />
      <div className="relative z-10 pb-8 max-w-5xl mx-auto">
        {/* ── Hero Section ── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl p-6 mb-6"
          style={{
            background: "linear-gradient(135deg, rgba(15,15,20,0.8) 0%, rgba(30,20,10,0.6) 100%)",
            border: "1px solid rgba(212,175,55,0.2)",
            boxShadow: `0 0 40px ${currentLevelDef.glow}`,
          }}
        >
          <div className="flex flex-col md:flex-row items-center gap-6">
            {/* Level Badge */}
            <div className="relative">
              <div
                className="w-24 h-24 rounded-2xl flex items-center justify-center"
                style={{
                  background: `linear-gradient(135deg, rgba(212,175,55,0.25), rgba(243,226,173,0.1), rgba(212,175,55,0.15))`,
                  border: "2px solid rgba(212,175,55,0.4)",
                  boxShadow: `0 0 40px rgba(212,175,55,0.3), 0 0 80px rgba(212,175,55,0.1)`,
                }}
              >
                {(() => { const Icon = LEVEL_ICONS[currentLevel - 1] || Star; return <Icon className={`w-12 h-12 ${currentLevelDef.color}`} />; })()}
              </div>
              <div className="absolute -bottom-2 -right-2 px-2 py-0.5 rounded-full text-[0.625rem] font-black bg-black/80 border border-primary/30 text-primary">
                LVL {currentLevel}
              </div>
            </div>

            {/* Info */}
            <div className="flex-1 text-center md:text-left">
              <h1 className={`text-2xl font-black ${currentLevelDef.color}`}>
                {currentLevelDef.name}
              </h1>
              <div className="flex items-center justify-center md:justify-start gap-3 mt-2">
                <span className="text-3xl font-black" style={{ color: "#d4af37" }}>
                  <NumberTicker value={totalHrp} className="text-3xl font-black" />
                </span>
                <span className="text-sm text-gray-400 font-medium">HRP</span>
                {multiplier > 1 && (
                  <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-primary/15 text-primary border border-primary/20">
                    {multiplier}x Multiplier
                  </span>
                )}
              </div>

              {/* Progress Bar */}
              {nextLevelDef && (
                <div className="mt-3">
                  <div className="flex justify-between text-xs text-gray-500 mb-1">
                    <span>Level {currentLevel}</span>
                    <span>{formatNum(totalHrp)} / {formatNum(nextLevelDef.hrpRequired)} HRP</span>
                    <span>Level {currentLevel + 1}</span>
                  </div>
                  <div className="h-3 rounded-full bg-white/5 overflow-hidden border border-white/10">
                    <motion.div
                      className="h-full rounded-full"
                      style={{ background: "linear-gradient(90deg, #8a6914, #c9a227, #f3e2ad, #d4af37, #8a6914)" }}
                      initial={{ width: 0 }}
                      animate={{ width: `${progressPercent}%` }}
                      transition={{ duration: 1, ease: "easeOut" }}
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1 text-center">
                    {formatNum((nextLevelDef.hrpRequired || 0) - totalHrp)} HRP to <span className={LOYALTY_LEVELS[currentLevel]?.color}>{nextLevelDef.name}</span>
                  </p>
                </div>
              )}
              {!nextLevelDef && (
                <p className="text-sm text-amber-400 mt-2 font-medium">Maximum level reached!</p>
              )}
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-2 gap-3">
              <div className="text-center px-4 py-2 rounded-lg bg-white/5 border border-white/10">
                <p className="text-lg font-black text-green-400">{profile?.dailyStreak || 0}</p>
                <p className="text-[0.625rem] text-gray-500 uppercase tracking-wider">Day Streak</p>
              </div>
              <div className="text-center px-4 py-2 rounded-lg bg-white/5 border border-white/10">
                <p className="text-lg font-black text-purple-400">{profile?.achievements?.filter((a: any) => a.claimedAt)?.length || 0}</p>
                <p className="text-[0.625rem] text-gray-500 uppercase tracking-wider">Badges</p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* ── Tab Navigation ── */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          {([
            { key: "levels", icon: Star, label: "Levels" },
            { key: "achievements", icon: Trophy, label: "Achievements" },
            { key: "daily", icon: Calendar, label: "Daily Rewards" },
            { key: "referral", icon: Users, label: "Referrals" },
          ] as const).map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all whitespace-nowrap ${
                activeTab === tab.key
                  ? "bg-primary/20 text-primary border border-primary/30"
                  : "bg-white/5 text-gray-400 border border-white/10 hover:bg-white/10"
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* ── Levels Tab ── */}
        {activeTab === "levels" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
            {LOYALTY_LEVELS.map((lvl, i) => {
              const isUnlocked = currentLevel >= lvl.level;
              const isCurrent = currentLevel === lvl.level;
              const Icon = LEVEL_ICONS[i];
              return (
                <GoldCard
                  key={lvl.level}
                  className={`flex items-center gap-4 ${isCurrent ? "" : ""}`}
                  glow={isCurrent}
                  hover={isUnlocked}
                  padding="p-4"
                >
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
                    style={{
                      background: isUnlocked ? `linear-gradient(135deg, rgba(212,175,55,0.2), rgba(212,175,55,0.05))` : "rgba(255,255,255,0.03)",
                      border: `1px solid ${isUnlocked ? "rgba(212,175,55,0.3)" : "rgba(255,255,255,0.1)"}`,
                    }}
                  >
                    {isUnlocked ? <Icon className={`w-6 h-6 ${lvl.color}`} /> : <Lock className="w-5 h-5 text-gray-600" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`font-bold ${isUnlocked ? lvl.color : "text-gray-600"}`}>
                        Level {lvl.level} — {lvl.name}
                      </span>
                      {isCurrent && (
                        <span className="text-[0.5625rem] px-2 py-0.5 rounded-full bg-primary/20 text-primary font-bold border border-primary/30">
                          CURRENT
                        </span>
                      )}
                      {isUnlocked && !isCurrent && (
                        <Check className="w-4 h-4 text-green-400" />
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {formatNum(lvl.hrpRequired)} HRP required
                    </p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-600 shrink-0" />
                </GoldCard>
              );
            })}
          </motion.div>
        )}

        {/* ── Achievements Tab ── */}
        {activeTab === "achievements" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            {/* Filter Tabs */}
            <div className="flex gap-2 mb-4">
              {ACHIEVEMENT_TABS.map(tab => (
                <button
                  key={tab}
                  onClick={() => setAchievementFilter(tab)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    achievementFilter === tab
                      ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                      : "bg-white/5 text-gray-400 border border-white/10 hover:bg-white/10"
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>

            {/* Achievement Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {filteredAchievements.map((ach: any) => {
                const pct = ach.requirementValue > 0 ? Math.min(((ach.progress || 0) / ach.requirementValue) * 100, 100) : 0;
                const isUnlocked = !!ach.unlockedAt;
                const isClaimed = !!ach.claimedAt;
                return (
                  <SpotlightCard
                    key={ach.id || ach.key}
                    className="p-4"
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center shrink-0 border border-white/10">
                        {isClaimed ? <Check className="w-5 h-5 text-green-400" /> : isUnlocked ? <Sparkles className="w-5 h-5 text-amber-400" /> : <Trophy className="w-5 h-5 text-gray-600" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className={`font-bold text-sm ${isClaimed ? "text-green-400" : isUnlocked ? "text-amber-400" : "text-gray-300"}`}>
                          {ach.name}
                        </h4>
                        <p className="text-xs text-gray-500 mt-0.5">{ach.description}</p>

                        {/* Progress Bar */}
                        <div className="mt-2">
                          <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all duration-500"
                              style={{
                                width: `${pct}%`,
                                background: isClaimed ? "#34d399" : isUnlocked ? "#d4af37" : "rgba(255,255,255,0.2)",
                              }}
                            />
                          </div>
                          <div className="flex justify-between mt-1">
                            <span className="text-[0.625rem] text-gray-500">
                              {formatNum(ach.progress || 0)} / {formatNum(ach.requirementValue)}
                            </span>
                            <span className="text-[0.625rem] text-gray-500">
                              +{ach.hrpReward} HRP {ach.chipReward > 0 && `+ ${formatNum(ach.chipReward)} chips`}
                            </span>
                          </div>
                        </div>

                        {/* Claim Button */}
                        {isUnlocked && !isClaimed && (
                          <GoldButton
                            onClick={() => claimAchievementMutation.mutate(ach.id)}
                            disabled={claimAchievementMutation.isPending}
                            className="mt-2 !px-3 !py-1 !text-xs"
                          >
                            {claimAchievementMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : "Claim Reward"}
                          </GoldButton>
                        )}
                      </div>
                    </div>
                  </SpotlightCard>
                );
              })}
              {filteredAchievements.length === 0 && (
                <div className="col-span-2 text-center py-12 text-gray-500">
                  <Trophy className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p>No achievements in this category yet</p>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* ── Daily Rewards Tab ── */}
        {activeTab === "daily" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <div className="rounded-xl p-5 mb-4" style={{ background: "rgba(15,15,20,0.5)", border: "1px solid rgba(255,255,255,0.08)" }}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-gray-300 uppercase tracking-wider flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-primary/70" /> 7-Day Login Cycle
                </h3>
                <span className="text-xs text-gray-500">
                  Streak: <span className="text-green-400 font-bold">{profile?.dailyStreak || 0} days</span>
                  {(profile?.dailyStreak || 0) >= 7 && (
                    <span className="ml-2 text-amber-400">({Math.min(Math.floor((profile?.dailyStreak || 0) / 7) + 1, 4) * 0.5 + 0.5}x bonus)</span>
                  )}
                </span>
              </div>

              <div className="grid grid-cols-7 gap-2">
                {DAILY_REWARDS.map((reward, i) => {
                  const dayNum = i + 1;
                  const streak = profile?.dailyStreak || 0;
                  const currentDay = (streak % 7) + 1;
                  const isPast = dayNum < currentDay;
                  const isCurrent = dayNum === currentDay;
                  const canClaim = isCurrent && !profile?.claimedToday;

                  return (
                    <GoldCard
                      key={dayNum}
                      className={`text-center ${isCurrent ? "" : ""}`}
                      glow={isCurrent}
                      hover
                      padding="p-3"
                    >
                      <p className="text-[0.625rem] text-gray-500 uppercase font-bold mb-1">Day {dayNum}</p>
                      {isPast ? (
                        <Check className="w-5 h-5 text-green-400 mx-auto" />
                      ) : (
                        <Gift className={`w-5 h-5 mx-auto ${isCurrent ? "text-primary" : "text-gray-600"}`} />
                      )}
                      <p className="text-xs font-bold mt-1" style={{ color: "#d4af37" }}>{formatNum(reward.chips)}</p>
                      <p className="text-[0.5625rem] text-gray-500">+{reward.hrp} HRP</p>

                      {canClaim && (
                        <GoldButton
                          onClick={() => claimDailyMutation.mutate()}
                          disabled={claimDailyMutation.isPending}
                          fullWidth
                          className="mt-1.5 !px-2 !py-1 !text-[0.625rem]"
                        >
                          {claimDailyMutation.isPending ? "..." : "Claim"}
                        </GoldButton>
                      )}
                    </GoldCard>
                  );
                })}
              </div>
            </div>

            {/* HRP History */}
            <div className="rounded-xl p-5" style={{ background: "rgba(15,15,20,0.5)", border: "1px solid rgba(255,255,255,0.08)" }}>
              <h3 className="text-sm font-bold text-gray-300 uppercase tracking-wider mb-4 flex items-center gap-2">
                <Clock className="w-4 h-4 text-primary/70" /> Recent HRP Activity
              </h3>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {(hrpHistory || []).slice(0, 20).map((entry: any, i: number) => (
                  <div key={i} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                    <div className="flex items-center gap-2">
                      <Zap className="w-3.5 h-3.5 text-amber-400" />
                      <span className="text-xs text-gray-400">{entry.description}</span>
                    </div>
                    <span className={`text-xs font-bold ${entry.amount > 0 ? "text-green-400" : "text-red-400"}`}>
                      {entry.amount > 0 ? "+" : ""}{entry.amount} HRP
                    </span>
                  </div>
                ))}
                {(!hrpHistory || hrpHistory.length === 0) && (
                  <p className="text-sm text-gray-500 text-center py-4">Play hands to earn HRP!</p>
                )}
              </div>
            </div>
          </motion.div>
        )}

        {/* ── Referral Tab ── */}
        {activeTab === "referral" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <div className="rounded-xl p-6" style={{ background: "rgba(15,15,20,0.5)", border: "1px solid rgba(255,255,255,0.08)" }}>
              <h3 className="text-lg font-bold text-gray-200 mb-2 flex items-center gap-2">
                <Users className="w-5 h-5 text-primary" /> Invite Friends, Earn Rewards
              </h3>
              <p className="text-sm text-gray-500 mb-6">
                Share your referral code. When friends sign up and play, you both earn HRP and chips.
              </p>

              {/* Referral Code */}
              <div className="flex items-center gap-3 mb-6">
                <div className="flex-1 px-4 py-3 rounded-xl bg-black/30 border border-white/10 font-mono text-lg text-center tracking-widest text-primary">
                  {referralData?.code || "Loading..."}
                </div>
                <button
                  onClick={copyReferralCode}
                  className="px-4 py-3 rounded-xl bg-primary/20 text-primary border border-primary/30 hover:bg-primary/30 transition-all"
                >
                  {copied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                </button>
              </div>

              {/* Milestones */}
              <h4 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-3">Referral Milestones</h4>
              <div className="space-y-3">
                {[
                  { milestone: "Friend signs up", referrerReward: "100 HRP", friendReward: "100 HRP + Welcome Pack" },
                  { milestone: "Friend plays 100 hands", referrerReward: "500 HRP + 2,000 chips", friendReward: "1,000 chips" },
                  { milestone: "Friend makes first deposit", referrerReward: "1,000 HRP + 5,000 chips", friendReward: "2,500 chips" },
                  { milestone: "Friend reaches Loyalty Level 3", referrerReward: "2,000 HRP + Exclusive Avatar", friendReward: "—" },
                ].map((m, i) => (
                  <div key={i} className="flex items-center gap-4 p-3 rounded-lg bg-white/3 border border-white/5">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 border border-primary/20">
                      <span className="text-xs font-bold text-primary">{i + 1}</span>
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-300">{m.milestone}</p>
                      <div className="flex gap-4 mt-0.5">
                        <span className="text-[0.625rem] text-green-400">You get: {m.referrerReward}</span>
                        <span className="text-[0.625rem] text-blue-400">Friend gets: {m.friendReward}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Referral Stats */}
              {referralData?.totalReferred > 0 && (
                <div className="mt-6 grid grid-cols-3 gap-3">
                  <div className="text-center p-3 rounded-lg bg-white/5 border border-white/10">
                    <p className="text-xl font-black text-primary">{referralData.totalReferred}</p>
                    <p className="text-[0.625rem] text-gray-500 uppercase">Friends Referred</p>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-white/5 border border-white/10">
                    <p className="text-xl font-black text-green-400">{formatNum(referralData.totalHrpEarned || 0)}</p>
                    <p className="text-[0.625rem] text-gray-500 uppercase">HRP Earned</p>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-white/5 border border-white/10">
                    <p className="text-xl font-black text-amber-400">{formatNum(referralData.totalChipsEarned || 0)}</p>
                    <p className="text-[0.625rem] text-gray-500 uppercase">Chips Earned</p>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </div>
    </DashboardLayout>
  );
}
