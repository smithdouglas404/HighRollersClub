import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { Link } from "wouter";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useAuth } from "@/lib/auth-context";
import {
  Crown, Star, Shield, Zap, Trophy, Gift, ChevronRight,
  Flame, Target, Lock, Award, Gem, Diamond, Loader2,
} from "lucide-react";

// ─── Loyalty Levels (Rookie → Immortal) ──────────────────────────────────────
const LOYALTY_LEVELS = [
  { name: "Rookie", minHRP: 0, icon: Shield, color: "text-gray-400", bg: "bg-gray-500/10", border: "border-gray-500/20", perks: ["Access to free card backs", "Daily login bonus"] },
  { name: "Amateur", minHRP: 500, icon: Shield, color: "text-green-400", bg: "bg-green-500/10", border: "border-green-500/20", perks: ["Unlock basic profile frames", "+5% daily bonus"] },
  { name: "Grinder", minHRP: 1500, icon: Star, color: "text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/20", perks: ["Unlock seat effects", "+10% daily bonus", "Custom card backs"] },
  { name: "Contender", minHRP: 3000, icon: Star, color: "text-cyan-400", bg: "bg-cyan-500/10", border: "border-cyan-500/20", perks: ["Priority table seating", "+15% daily bonus", "Win celebration effects"] },
  { name: "Shark", minHRP: 5000, icon: Trophy, color: "text-purple-400", bg: "bg-purple-500/10", border: "border-purple-500/20", perks: ["Exclusive shop discounts", "+20% daily bonus", "Entrance animations"] },
  { name: "Ace", minHRP: 10000, icon: Crown, color: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/20", perks: ["VIP table access", "+30% daily bonus", "Animated card backs"] },
  { name: "High Roller", minHRP: 20000, icon: Crown, color: "text-orange-400", bg: "bg-orange-500/10", border: "border-orange-500/20", perks: ["Exclusive tournaments", "+40% daily bonus", "Legendary items access"] },
  { name: "Legend", minHRP: 40000, icon: Gem, color: "text-red-400", bg: "bg-red-500/10", border: "border-red-500/20", perks: ["Custom table themes", "+50% daily bonus", "Exclusive emotes"] },
  { name: "Titan", minHRP: 75000, icon: Diamond, color: "text-pink-400", bg: "bg-pink-500/10", border: "border-pink-500/20", perks: ["Mythic items access", "+75% daily bonus", "Personal dealer name"] },
  { name: "Immortal", minHRP: 150000, icon: Flame, color: "text-yellow-300", bg: "bg-yellow-500/10", border: "border-yellow-500/20", perks: ["All perks unlocked", "+100% daily bonus", "Immortal badge & aura", "Exclusive Immortal card back"] },
];

function getLoyaltyLevel(hrp: number) {
  let idx = 0;
  for (let i = LOYALTY_LEVELS.length - 1; i >= 0; i--) {
    if (hrp >= LOYALTY_LEVELS[i].minHRP) { idx = i; break; }
  }
  const current = LOYALTY_LEVELS[idx];
  const next = idx < LOYALTY_LEVELS.length - 1 ? LOYALTY_LEVELS[idx + 1] : null;
  return { idx, current, next };
}

// ─── Animated Number ─────────────────────────────────────────────────────────
function AnimatedNumber({ value, duration = 1200 }: { value: number; duration?: number }) {
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

// ─── Types ───────────────────────────────────────────────────────────────────
interface LoyaltyStatus {
  hrp: number;
  level: number;
  levelName: string;
  streakDays: number[];
  multiplier: number;
  subscriptionTier: string;
}

interface HRPHistoryEntry {
  id: string;
  description: string;
  amount: number;
  createdAt: string;
}

export default function LoyaltyDashboard() {
  const { user } = useAuth();
  const [status, setStatus] = useState<LoyaltyStatus | null>(null);
  const [history, setHistory] = useState<HRPHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        const [statusRes, historyRes] = await Promise.all([
          fetch("/api/loyalty/status"),
          fetch("/api/loyalty/history"),
        ]);

        if (statusRes.ok) {
          setStatus(await statusRes.json());
        } else {
          // Fallback demo data when API not yet wired
          setStatus({
            hrp: 2847,
            level: 4,
            levelName: "Shark",
            streakDays: [1, 1, 1, 1, 0, 0, 0],
            multiplier: 2.0,
            subscriptionTier: "Gold",
          });
        }

        if (historyRes.ok) {
          const data = await historyRes.json();
          setHistory(Array.isArray(data) ? data : data.entries || []);
        } else {
          setHistory([
            { id: "1", description: "Played hand", amount: 1, createdAt: new Date().toISOString() },
            { id: "2", description: "Won pot", amount: 2, createdAt: new Date().toISOString() },
            { id: "3", description: "Daily login bonus", amount: 10, createdAt: new Date().toISOString() },
            { id: "4", description: "Tournament entry", amount: 5, createdAt: new Date().toISOString() },
            { id: "5", description: "Won pot", amount: 2, createdAt: new Date().toISOString() },
            { id: "6", description: "Played hand", amount: 1, createdAt: new Date().toISOString() },
            { id: "7", description: "Streak bonus (3 days)", amount: 15, createdAt: new Date().toISOString() },
            { id: "8", description: "Won pot", amount: 2, createdAt: new Date().toISOString() },
            { id: "9", description: "Played hand", amount: 1, createdAt: new Date().toISOString() },
            { id: "10", description: "Won tournament", amount: 25, createdAt: new Date().toISOString() },
          ]);
        }
      } catch {
        // Fallback
        setStatus({
          hrp: 2847,
          level: 4,
          levelName: "Shark",
          streakDays: [1, 1, 1, 1, 0, 0, 0],
          multiplier: 2.0,
          subscriptionTier: "Gold",
        });
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  if (loading) {
    return (
      <DashboardLayout title="Loyalty Program">
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
        </div>
      </DashboardLayout>
    );
  }

  const hrp = status?.hrp ?? 0;
  const { idx: levelIdx, current: currentLevel, next: nextLevel } = getLoyaltyLevel(hrp);
  const streakDays = status?.streakDays ?? [0, 0, 0, 0, 0, 0, 0];
  const multiplier = status?.multiplier ?? 1.0;
  const subscriptionTier = status?.subscriptionTier ?? "Free";
  const progressToNext = nextLevel ? ((hrp - currentLevel.minHRP) / (nextLevel.minHRP - currentLevel.minHRP)) * 100 : 100;
  const LevelIcon = currentLevel.icon;
  const dayLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  return (
    <DashboardLayout title="Loyalty Program">
      <div className="max-w-5xl mx-auto px-4 md:px-8 pb-12 space-y-6">

        {/* ── Hero: HRP Total + Level Badge ── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative rounded-2xl overflow-hidden"
          style={{
            background: "linear-gradient(135deg, rgba(15,15,20,0.95) 0%, rgba(25,20,10,0.95) 50%, rgba(15,15,20,0.95) 100%)",
            border: "1px solid rgba(212,175,55,0.2)",
            boxShadow: "0 0 40px rgba(212,175,55,0.08), inset 0 1px 0 rgba(255,255,255,0.05)",
          }}
        >
          <div className="absolute inset-0 bg-gradient-to-r from-amber-500/5 via-transparent to-amber-500/5" />
          <div className="relative z-10 p-6 md:p-8">
            <div className="flex flex-col md:flex-row items-center gap-6">
              {/* HRP Count */}
              <div className="text-center md:text-left flex-1">
                <div className="text-[0.625rem] uppercase tracking-[0.2em] text-gray-400 mb-1">
                  High Roller Points
                </div>
                <motion.div
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ duration: 0.6, ease: "easeOut" }}
                  className="text-5xl md:text-6xl font-black tabular-nums"
                  style={{
                    background: "linear-gradient(180deg, #f5e6a3 0%, #d4af37 60%, #c9a84c 100%)",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                    backgroundClip: "text",
                    filter: "drop-shadow(0 0 20px rgba(212,175,55,0.3))",
                  }}
                >
                  <AnimatedNumber value={hrp} />
                </motion.div>
                <div className="text-xs text-gray-500 mt-1">HRP</div>
              </div>

              {/* Level Badge */}
              <div className="flex flex-col items-center gap-2">
                <div
                  className={`w-20 h-20 rounded-2xl ${currentLevel.bg} ${currentLevel.border} border-2 flex items-center justify-center`}
                  style={{ boxShadow: `0 0 24px ${currentLevel.color.includes("amber") ? "rgba(212,175,55,0.3)" : currentLevel.color.includes("purple") ? "rgba(168,85,247,0.3)" : "rgba(100,100,100,0.2)"}` }}
                >
                  <LevelIcon className={`w-10 h-10 ${currentLevel.color}`} />
                </div>
                <div className={`text-sm font-black uppercase tracking-wider ${currentLevel.color}`}>
                  {currentLevel.name}
                </div>
                <div className="text-[0.5rem] text-gray-500">Level {levelIdx + 1} of {LOYALTY_LEVELS.length}</div>
              </div>

              {/* Multiplier */}
              {multiplier > 1 && (
                <div className="text-center">
                  <div className="text-[0.625rem] uppercase tracking-[0.15em] text-gray-400 mb-1">
                    HRP Multiplier
                  </div>
                  <div className="text-2xl font-black text-amber-400" style={{ textShadow: "0 0 12px rgba(212,175,55,0.4)" }}>
                    {multiplier}x
                  </div>
                  <div className="text-[0.5rem] text-amber-500/70 font-bold uppercase tracking-wider">
                    {subscriptionTier} Bonus
                  </div>
                </div>
              )}
            </div>

            {/* Progress Bar */}
            {nextLevel && (
              <div className="mt-6">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-[0.625rem] text-gray-400">Progress to <span className={nextLevel.color + " font-bold"}>{nextLevel.name}</span></span>
                  <span className="text-[0.625rem] text-gray-500 tabular-nums">
                    {hrp.toLocaleString()} / {nextLevel.minHRP.toLocaleString()} HRP
                  </span>
                </div>
                <div className="h-3 rounded-full bg-white/5 border border-white/10 overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min(progressToNext, 100)}%` }}
                    transition={{ duration: 1, ease: "easeOut", delay: 0.3 }}
                    className="h-full rounded-full relative"
                    style={{
                      background: "linear-gradient(90deg, #c9a84c, #f5e6a3, #d4af37)",
                      boxShadow: "0 0 12px rgba(212,175,55,0.4)",
                    }}
                  >
                    <div className="absolute inset-0 bg-gradient-to-b from-white/20 to-transparent rounded-full" />
                  </motion.div>
                </div>
                <div className="text-[0.5rem] text-gray-500 mt-1">
                  {(nextLevel.minHRP - hrp).toLocaleString()} HRP to go
                </div>
              </div>
            )}
          </div>
        </motion.div>

        {/* ── 7-Day Streak Tracker ── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="rounded-xl p-5"
          style={{
            background: "rgba(15,15,20,0.8)",
            backdropFilter: "blur(12px)",
            border: "1px solid rgba(212,175,55,0.12)",
          }}
        >
          <div className="flex items-center gap-2 mb-4">
            <Flame className="w-4 h-4 text-orange-400" />
            <span className="text-xs font-bold uppercase tracking-wider text-white">7-Day Streak</span>
            <span className="text-[0.5rem] text-gray-500 ml-auto">
              {streakDays.filter(d => d).length} / 7 days
            </span>
          </div>
          <div className="flex justify-between gap-2">
            {dayLabels.map((day, i) => {
              const active = streakDays[i] === 1;
              return (
                <div key={day} className="flex flex-col items-center gap-1.5">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.15 + i * 0.05 }}
                    className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all ${
                      active
                        ? "bg-amber-500/20 border-amber-400/50"
                        : "bg-white/5 border-white/10"
                    }`}
                    style={active ? { boxShadow: "0 0 12px rgba(212,175,55,0.3)" } : {}}
                  >
                    {active ? (
                      <Flame className="w-5 h-5 text-amber-400" />
                    ) : (
                      <div className="w-3 h-3 rounded-full bg-white/10" />
                    )}
                  </motion.div>
                  <span className={`text-[0.5rem] font-medium ${active ? "text-amber-400" : "text-gray-600"}`}>
                    {day}
                  </span>
                </div>
              );
            })}
          </div>
        </motion.div>

        {/* ── Recent HRP Earnings ── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="rounded-xl p-5"
          style={{
            background: "rgba(15,15,20,0.8)",
            backdropFilter: "blur(12px)",
            border: "1px solid rgba(212,175,55,0.12)",
          }}
        >
          <div className="flex items-center gap-2 mb-4">
            <Zap className="w-4 h-4 text-primary" />
            <span className="text-xs font-bold uppercase tracking-wider text-white">Recent HRP Earnings</span>
          </div>
          <div className="space-y-2">
            {history.slice(0, 10).map((entry, i) => (
              <motion.div
                key={entry.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.05 * i }}
                className="flex items-center justify-between py-2 px-3 rounded-lg bg-white/[0.02] border border-white/[0.04] hover:bg-white/[0.04] transition-colors"
              >
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-amber-500/10 flex items-center justify-center">
                    <Zap className="w-3 h-3 text-amber-400" />
                  </div>
                  <span className="text-xs text-gray-300">{entry.description}</span>
                </div>
                <span className="text-xs font-bold text-amber-400 tabular-nums">
                  +{entry.amount} HRP
                </span>
              </motion.div>
            ))}
            {history.length === 0 && (
              <div className="text-center py-6 text-xs text-gray-500">
                No HRP earnings yet. Start playing to earn points!
              </div>
            )}
          </div>
        </motion.div>

        {/* ── All 10 Loyalty Levels ── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="rounded-xl p-5"
          style={{
            background: "rgba(15,15,20,0.8)",
            backdropFilter: "blur(12px)",
            border: "1px solid rgba(212,175,55,0.12)",
          }}
        >
          <div className="flex items-center gap-2 mb-5">
            <Award className="w-4 h-4 text-primary" />
            <span className="text-xs font-bold uppercase tracking-wider text-white">All Loyalty Levels</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {LOYALTY_LEVELS.map((level, i) => {
              const unlocked = hrp >= level.minHRP;
              const isCurrent = i === levelIdx;
              const Icon = level.icon;
              return (
                <motion.div
                  key={level.name}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.05 * i }}
                  className={`relative rounded-xl p-4 border transition-all ${
                    isCurrent
                      ? `${level.border} border-2`
                      : unlocked
                        ? "border-white/10"
                        : "border-white/5 opacity-60"
                  }`}
                  style={{
                    background: isCurrent
                      ? "rgba(212,175,55,0.06)"
                      : "rgba(15,15,20,0.5)",
                    boxShadow: isCurrent ? "0 0 20px rgba(212,175,55,0.1)" : "none",
                  }}
                >
                  {isCurrent && (
                    <div className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/30">
                      <span className="text-[0.5rem] font-bold text-amber-400 uppercase tracking-wider">Current</span>
                    </div>
                  )}
                  <div className="flex items-start gap-3">
                    <div className={`w-10 h-10 rounded-lg ${level.bg} ${level.border} border flex items-center justify-center shrink-0`}>
                      {unlocked ? (
                        <Icon className={`w-5 h-5 ${level.color}`} />
                      ) : (
                        <Lock className="w-4 h-4 text-gray-600" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`text-sm font-bold ${unlocked ? level.color : "text-gray-600"}`}>
                          {level.name}
                        </span>
                        <span className="text-[0.5rem] text-gray-500">
                          {level.minHRP > 0 ? `${level.minHRP.toLocaleString()} HRP` : "Starting Level"}
                        </span>
                      </div>
                      <div className="mt-1.5 space-y-0.5">
                        {level.perks.map((perk) => (
                          <div key={perk} className="flex items-center gap-1.5">
                            <div className={`w-1 h-1 rounded-full ${unlocked ? "bg-amber-400" : "bg-gray-700"}`} />
                            <span className={`text-[0.5625rem] ${unlocked ? "text-gray-400" : "text-gray-600"}`}>
                              {perk}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </motion.div>

        {/* ── Earn HRP Section ── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="rounded-xl p-5"
          style={{
            background: "rgba(15,15,20,0.8)",
            backdropFilter: "blur(12px)",
            border: "1px solid rgba(212,175,55,0.12)",
          }}
        >
          <div className="flex items-center gap-2 mb-4">
            <Gift className="w-4 h-4 text-primary" />
            <span className="text-xs font-bold uppercase tracking-wider text-white">How to Earn HRP</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {[
              { icon: Target, label: "Play Hands", desc: "+1 HRP per hand played", color: "text-blue-400" },
              { icon: Trophy, label: "Win Pots", desc: "+2 HRP per pot won", color: "text-green-400" },
              { icon: Flame, label: "Daily Login", desc: "+10 HRP daily login bonus", color: "text-orange-400" },
              { icon: Crown, label: "Tournaments", desc: "+5-50 HRP for tournament play", color: "text-purple-400" },
              { icon: Zap, label: "Win Streaks", desc: "+5 HRP per 3-hand streak", color: "text-cyan-400" },
              { icon: Star, label: "Streak Bonus", desc: "7-day streak = +100 HRP bonus", color: "text-amber-400" },
            ].map((item) => {
              const ItemIcon = item.icon;
              return (
                <div
                  key={item.label}
                  className="flex items-center gap-3 p-3 rounded-lg bg-white/[0.02] border border-white/[0.04]"
                >
                  <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center shrink-0">
                    <ItemIcon className={`w-4 h-4 ${item.color}`} />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-white">{item.label}</div>
                    <div className="text-[0.5625rem] text-gray-500">{item.desc}</div>
                  </div>
                </div>
              );
            })}
          </div>
          {multiplier > 1 && (
            <div className="mt-4 p-3 rounded-lg bg-amber-500/5 border border-amber-500/15">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-amber-400" />
                <span className="text-xs text-amber-300">
                  Your <span className="font-bold">{subscriptionTier}</span> subscription gives you a <span className="font-bold">{multiplier}x HRP multiplier</span> on all earnings!
                </span>
              </div>
            </div>
          )}
        </motion.div>

      </div>
    </DashboardLayout>
  );
}
