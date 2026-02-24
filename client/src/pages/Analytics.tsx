import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useAuth } from "@/lib/auth-context";
import {
  BarChart3, TrendingUp, Target, Gamepad2,
  Coins, Zap, Trophy, Loader2, Brain,
  ArrowUpRight, ArrowDownRight, Minus
} from "lucide-react";

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

interface WalletBalance {
  balance: number;
}

export default function Analytics() {
  const { user } = useAuth();
  const [stats, setStats] = useState<PlayerStats | null>(null);
  const [balance, setBalance] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const [statsRes, balanceRes] = await Promise.all([
          fetch("/api/stats/me"),
          fetch("/api/wallet/balance"),
        ]);
        if (statsRes.ok) setStats(await statsRes.json());
        if (balanceRes.ok) {
          const data: WalletBalance = await balanceRes.json();
          setBalance(data.balance);
        }
      } catch {
        // silently fail
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const winRate = stats && stats.handsPlayed > 0
    ? Math.round((stats.potsWon / stats.handsPlayed) * 100)
    : 0;

  const vpipPct = stats?.vpip ?? 0;
  const pfrPct = stats?.pfr ?? 0;

  const statCards = [
    {
      label: "Hands Played",
      value: stats?.handsPlayed ?? 0,
      icon: Gamepad2,
      color: "cyan",
      gradient: "from-cyan-500/20 to-blue-500/20",
      border: "border-cyan-500/20",
      textColor: "text-cyan-400",
    },
    {
      label: "Pots Won",
      value: stats?.potsWon ?? 0,
      icon: Trophy,
      color: "green",
      gradient: "from-green-500/20 to-emerald-500/20",
      border: "border-green-500/20",
      textColor: "text-green-400",
    },
    {
      label: "Win Rate",
      value: `${winRate}%`,
      icon: Target,
      color: "amber",
      gradient: "from-amber-500/20 to-orange-500/20",
      border: "border-amber-500/20",
      textColor: "text-amber-400",
    },
    {
      label: "Balance",
      value: balance.toLocaleString(),
      icon: Coins,
      color: "purple",
      gradient: "from-purple-500/20 to-pink-500/20",
      border: "border-purple-500/20",
      textColor: "text-purple-400",
    },
  ];

  const advancedStats = [
    { label: "VPIP", value: `${vpipPct}%`, desc: "Voluntarily Put $ In Pot", trend: vpipPct > 30 ? "high" : vpipPct > 15 ? "normal" : "low" },
    { label: "PFR", value: `${pfrPct}%`, desc: "Pre-Flop Raise %", trend: pfrPct > 25 ? "high" : pfrPct > 10 ? "normal" : "low" },
    { label: "Best Streak", value: stats?.bestWinStreak ?? 0, desc: "Consecutive wins", trend: "normal" },
    { label: "Current Streak", value: stats?.currentWinStreak ?? 0, desc: "Active win streak", trend: (stats?.currentWinStreak ?? 0) > 0 ? "high" : "normal" },
    { label: "Showdowns", value: stats?.showdownCount ?? 0, desc: "Hands to showdown", trend: "normal" },
    { label: "Total Winnings", value: (stats?.totalWinnings ?? 0).toLocaleString(), desc: "Lifetime chip profit", trend: (stats?.totalWinnings ?? 0) > 0 ? "high" : (stats?.totalWinnings ?? 0) < 0 ? "low" : "normal" },
  ];

  const getTrendIcon = (trend: string) => {
    if (trend === "high") return <ArrowUpRight className="w-3 h-3 text-green-400" />;
    if (trend === "low") return <ArrowDownRight className="w-3 h-3 text-red-400" />;
    return <Minus className="w-3 h-3 text-gray-500" />;
  };

  return (
    <DashboardLayout title="Analytics">
      <div className="px-8 pb-8">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-cyan-400" />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Top Stat Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {statCards.map((card, i) => {
                const Icon = card.icon;
                return (
                  <motion.div
                    key={card.label}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className={`rounded-xl p-4 border ${card.border} relative overflow-hidden`}
                    style={{
                      background: "linear-gradient(135deg, rgba(8,16,24,0.95) 0%, rgba(4,10,16,0.98) 100%)",
                      boxShadow: "0 10px 40px rgba(0,0,0,0.3)",
                    }}
                  >
                    <div className={`absolute top-0 right-0 w-20 h-20 bg-gradient-to-br ${card.gradient} blur-3xl rounded-full opacity-30`} />
                    <div className="relative">
                      <div className={`w-9 h-9 rounded-lg bg-gradient-to-br ${card.gradient} border ${card.border} flex items-center justify-center mb-3`}>
                        <Icon className={`w-4.5 h-4.5 ${card.textColor}`} />
                      </div>
                      <div className={`text-2xl font-bold ${card.textColor} tracking-tight`}>
                        {card.value}
                      </div>
                      <div className="text-[9px] text-gray-500 uppercase tracking-wider mt-0.5">
                        {card.label}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>

            {/* Advanced Stats Grid */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="rounded-xl overflow-hidden"
              style={{
                background: "linear-gradient(135deg, rgba(8,16,24,0.95) 0%, rgba(4,10,16,0.98) 100%)",
                border: "1px solid rgba(0,240,255,0.1)",
                boxShadow: "0 10px 40px rgba(0,0,0,0.3)",
              }}
            >
              <div className="px-5 py-3.5 border-b border-white/[0.04] flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-cyan-400" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400">Detailed Statistics</h3>
              </div>
              <div className="grid grid-cols-2 lg:grid-cols-3 divide-x divide-y divide-white/[0.03]">
                {advancedStats.map((stat, i) => (
                  <motion.div
                    key={stat.label}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.3 + i * 0.05 }}
                    className="p-4 hover:bg-white/[0.02] transition-colors"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                        {stat.label}
                      </span>
                      {getTrendIcon(stat.trend)}
                    </div>
                    <div className="text-xl font-bold text-white tracking-tight">
                      {stat.value}
                    </div>
                    <div className="text-[9px] text-gray-600 mt-0.5">
                      {stat.desc}
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>

            {/* Play Style Assessment */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="rounded-xl overflow-hidden"
              style={{
                background: "linear-gradient(135deg, rgba(120,80,220,0.08) 0%, rgba(8,16,24,0.95) 100%)",
                border: "1px solid rgba(120,80,220,0.15)",
                boxShadow: "0 10px 40px rgba(0,0,0,0.3)",
              }}
            >
              <div className="px-5 py-3.5 border-b border-white/[0.04] flex items-center gap-2">
                <Brain className="w-4 h-4 text-purple-400" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400">Play Style Assessment</h3>
              </div>
              <div className="p-5">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Aggression */}
                  <div className="p-3 rounded-lg bg-white/[0.02] border border-white/[0.04]">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-2">Aggression</div>
                    <div className="h-2 bg-white/5 rounded-full overflow-hidden mb-1.5">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-green-500 to-red-500"
                        style={{ width: `${Math.min(pfrPct * 3, 100)}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-[9px]">
                      <span className="text-green-400">Passive</span>
                      <span className="text-red-400">Aggressive</span>
                    </div>
                  </div>

                  {/* Tightness */}
                  <div className="p-3 rounded-lg bg-white/[0.02] border border-white/[0.04]">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-2">Hand Selection</div>
                    <div className="h-2 bg-white/5 rounded-full overflow-hidden mb-1.5">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-amber-500"
                        style={{ width: `${Math.min(vpipPct * 2.5, 100)}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-[9px]">
                      <span className="text-cyan-400">Tight</span>
                      <span className="text-amber-400">Loose</span>
                    </div>
                  </div>

                  {/* Overall */}
                  <div className="p-3 rounded-lg bg-white/[0.02] border border-white/[0.04]">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-2">Play Type</div>
                    <div className="text-lg font-bold tracking-tight mt-1" style={{
                      color: vpipPct <= 20 && pfrPct <= 15 ? "#00f0ff"
                        : vpipPct <= 20 && pfrPct > 15 ? "#ff6060"
                        : vpipPct > 20 && pfrPct <= 15 ? "#ffa500"
                        : "#00ff9d"
                    }}>
                      {vpipPct <= 20 && pfrPct <= 15 ? "Tight-Passive (Rock)"
                        : vpipPct <= 20 && pfrPct > 15 ? "Tight-Aggressive (TAG)"
                        : vpipPct > 20 && pfrPct <= 15 ? "Loose-Passive (Calling Station)"
                        : "Loose-Aggressive (LAG)"}
                    </div>
                    <div className="text-[9px] text-gray-600 mt-1">Based on VPIP & PFR</div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
