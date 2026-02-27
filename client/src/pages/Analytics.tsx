import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useAuth } from "@/lib/auth-context";
import { useWallet } from "@/lib/wallet-context";
import {
  BarChart3, TrendingUp, Target, Gamepad2,
  Coins, Trophy, Loader2, Brain,
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

interface HandEntry {
  netResult: number;
}

/* ── SVG Line Chart ───────────────────────────────────────────────────────── */

function WinningsChart({ data }: { data: number[] }) {
  const W = 600;
  const H = 200;
  const PAD_X = 40;
  const PAD_Y = 20;

  const chartW = W - PAD_X * 2;
  const chartH = H - PAD_Y * 2;

  const min = Math.min(...data, 0);
  const max = Math.max(...data, 0);
  const range = max - min || 1;

  const points = data.map((v, i) => {
    const x = PAD_X + (i / Math.max(data.length - 1, 1)) * chartW;
    const y = PAD_Y + chartH - ((v - min) / range) * chartH;
    return { x, y };
  });

  const pathD = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");

  // Area fill path
  const areaD = pathD +
    ` L ${points[points.length - 1].x.toFixed(1)} ${(PAD_Y + chartH).toFixed(1)}` +
    ` L ${points[0].x.toFixed(1)} ${(PAD_Y + chartH).toFixed(1)} Z`;

  // Zero line Y
  const zeroY = PAD_Y + chartH - ((0 - min) / range) * chartH;

  // Y-axis labels
  const yLabels = [max, max * 0.5, 0, min * 0.5, min].filter((v, i, arr) =>
    arr.indexOf(v) === i
  );

  const final = data[data.length - 1] ?? 0;
  const isPositive = final >= 0;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-full" preserveAspectRatio="xMidYMid meet">
      <defs>
        <linearGradient id="lineGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={isPositive ? "#00d4ff" : "#ff3366"} stopOpacity="0.4" />
          <stop offset="100%" stopColor={isPositive ? "#00d4ff" : "#ff3366"} stopOpacity="0.02" />
        </linearGradient>
      </defs>

      {/* Grid lines */}
      {yLabels.map((v) => {
        const y = PAD_Y + chartH - ((v - min) / range) * chartH;
        return (
          <g key={v}>
            <line x1={PAD_X} y1={y} x2={W - PAD_X} y2={y} stroke="rgba(255,255,255,0.06)" strokeDasharray="4 4" />
            <text x={PAD_X - 6} y={y + 3} textAnchor="end" fill="rgba(255,255,255,0.3)" fontSize="9" fontFamily="monospace">
              {v >= 1000 || v <= -1000 ? `${(v / 1000).toFixed(1)}k` : v.toFixed(0)}
            </text>
          </g>
        );
      })}

      {/* Zero line */}
      <line x1={PAD_X} y1={zeroY} x2={W - PAD_X} y2={zeroY} stroke="rgba(255,255,255,0.15)" strokeWidth="1" />

      {/* Area fill */}
      {data.length > 1 && <path d={areaD} fill="url(#lineGrad)" />}

      {/* Line */}
      {data.length > 1 && (
        <path
          d={pathD}
          fill="none"
          stroke={isPositive ? "#00d4ff" : "#ff3366"}
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      )}

      {/* End dot */}
      {points.length > 0 && (
        <circle
          cx={points[points.length - 1].x}
          cy={points[points.length - 1].y}
          r="4"
          fill={isPositive ? "#00d4ff" : "#ff3366"}
          stroke="rgba(10,16,34,0.8)"
          strokeWidth="2"
        />
      )}

      {/* X-axis labels */}
      <text x={PAD_X} y={H - 2} fill="rgba(255,255,255,0.3)" fontSize="9" fontFamily="monospace">Hand 1</text>
      <text x={W - PAD_X} y={H - 2} fill="rgba(255,255,255,0.3)" fontSize="9" fontFamily="monospace" textAnchor="end">Hand {data.length}</text>
    </svg>
  );
}

/* ── Main Component ───────────────────────────────────────────────────────── */

export default function Analytics() {
  const { user } = useAuth();
  const { balance } = useWallet();
  const [stats, setStats] = useState<PlayerStats | null>(null);
  const [handHistory, setHandHistory] = useState<HandEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      try {
        const [statsRes, handsRes] = await Promise.all([
          fetch("/api/stats/me"),
          user?.id ? fetch(`/api/players/${user.id}/hands?limit=200`) : Promise.resolve(null),
        ]);
        if (statsRes.status === 401) {
          setLoadError("Session expired — please log in again");
          return;
        }
        if (statsRes.ok) setStats(await statsRes.json());
        else setLoadError("Failed to load stats");
        if (handsRes?.ok) setHandHistory(await handsRes.json());
      } catch (err: any) {
        setLoadError(err.message || "Failed to load analytics data");
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [user?.id]);

  const winRate = stats && stats.handsPlayed > 0
    ? Math.round((stats.potsWon / stats.handsPlayed) * 100)
    : 0;

  const vpipPct = stats && stats.handsPlayed > 0
    ? Math.round((stats.vpip / stats.handsPlayed) * 100)
    : 0;
  const pfrPct = stats && stats.handsPlayed > 0
    ? Math.round((stats.pfr / stats.handsPlayed) * 100)
    : 0;

  // Compute cumulative winnings from hand history (reverse since API returns newest first)
  const cumulativeWinnings = useMemo(() => {
    if (handHistory.length === 0) return [];
    const reversed = [...handHistory].reverse();
    let running = 0;
    return reversed.map(h => {
      running += h.netResult;
      return running;
    });
  }, [handHistory]);

  const statCards = [
    {
      label: "Hands Played",
      value: stats?.handsPlayed ?? 0,
      icon: Gamepad2,
      color: "amber",
      gradient: "from-amber-500/20 to-blue-500/20",
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
      border: "border-cyan-500/20",
      textColor: "text-cyan-400",
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
    if (trend === "high") return (
      <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-green-500/10 border border-green-500/20">
        <ArrowUpRight className="w-3 h-3 text-green-400" />
      </span>
    );
    if (trend === "low") return (
      <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-red-500/10 border border-red-500/20">
        <ArrowDownRight className="w-3 h-3 text-red-400" />
      </span>
    );
    return (
      <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-gray-500/10 border border-gray-500/20">
        <Minus className="w-3 h-3 text-gray-500" />
      </span>
    );
  };

  return (
    <DashboardLayout title="Analytics">
      <div className="px-8 pb-8">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-cyan-400" />
          </div>
        ) : loadError ? (
          <div className="flex flex-col items-center justify-center py-20">
            <p className="text-sm text-red-400">{loadError}</p>
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
                      background: "linear-gradient(135deg, rgba(20,31,40,0.90) 0%, rgba(16,24,36,0.95) 100%)",
                      boxShadow: "0 10px 40px rgba(0,0,0,0.3)",
                    }}
                  >
                    <div className={`absolute top-0 right-0 w-20 h-20 bg-gradient-to-br ${card.gradient} blur-3xl rounded-full opacity-30`} />
                    <div className="relative">
                      <div className={`w-9 h-9 rounded-lg bg-gradient-to-br ${card.gradient} border ${card.border} flex items-center justify-center mb-3`}>
                        <Icon className={`w-5 h-5 ${card.textColor}`} />
                      </div>
                      <div className={`text-2xl font-bold ${card.textColor} tracking-tight`}>
                        {card.value}
                      </div>
                      <div className="text-[0.5625rem] text-gray-500 uppercase tracking-wider mt-0.5">
                        {card.label}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>

            {/* Winnings Over Time Chart */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="rounded-xl overflow-hidden"
              style={{
                background: "linear-gradient(135deg, rgba(20,31,40,0.90) 0%, rgba(16,24,36,0.95) 100%)",
                border: "1px solid rgba(0,212,255,0.1)",
                boxShadow: "0 10px 40px rgba(0,0,0,0.3)",
              }}
            >
              <div className="px-5 py-3.5 border-b border-white/[0.04] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-cyan-400" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-cyan-400/70">Winnings Over Time</h3>
                </div>
                {cumulativeWinnings.length > 0 && (
                  <span className={`text-xs font-bold ${
                    cumulativeWinnings[cumulativeWinnings.length - 1] >= 0 ? "text-green-400" : "text-red-400"
                  }`}>
                    {cumulativeWinnings[cumulativeWinnings.length - 1] >= 0 ? "+" : ""}
                    {cumulativeWinnings[cumulativeWinnings.length - 1].toLocaleString()} chips
                  </span>
                )}
              </div>
              <div className="p-4">
                {cumulativeWinnings.length >= 2 ? (
                  <div className="h-[200px]">
                    <WinningsChart data={cumulativeWinnings} />
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-10 text-center">
                    <TrendingUp className="w-8 h-8 text-gray-700 mb-3" />
                    <p className="text-xs text-gray-500 font-medium">Not enough hand data yet</p>
                    <p className="text-[0.625rem] text-gray-600 mt-1">Play some hands to see your winnings chart</p>
                  </div>
                )}
              </div>
            </motion.div>

            {/* Advanced Stats Grid */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="rounded-xl overflow-hidden"
              style={{
                background: "linear-gradient(135deg, rgba(20,31,40,0.90) 0%, rgba(16,24,36,0.95) 100%)",
                border: "1px solid rgba(0,212,255,0.1)",
                boxShadow: "0 10px 40px rgba(0,0,0,0.3)",
              }}
            >
              <div className="px-5 py-3.5 border-b border-white/[0.04] flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-cyan-400" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-cyan-400/70">Detailed Statistics</h3>
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
                      <span className="text-[0.625rem] font-bold uppercase tracking-wider text-gray-400">
                        {stat.label}
                      </span>
                      {getTrendIcon(stat.trend)}
                    </div>
                    <div className="text-xl font-bold text-white tracking-tight">
                      {stat.value}
                    </div>
                    <div className="text-[0.5625rem] text-gray-500 mt-0.5">
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
                background: "linear-gradient(135deg, rgba(120,80,220,0.08) 0%, rgba(20,31,40,0.90) 100%)",
                border: "1px solid rgba(120,80,220,0.15)",
                boxShadow: "0 10px 40px rgba(0,0,0,0.3)",
              }}
            >
              <div className="px-5 py-3.5 border-b border-white/[0.04] flex items-center gap-2">
                <Brain className="w-4 h-4 text-purple-400" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-cyan-400/70">Play Style Assessment</h3>
              </div>
              <div className="p-5">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Aggression */}
                  <div className="p-3 rounded-lg bg-white/8 border border-white/15">
                    <div className="text-[0.625rem] font-bold uppercase tracking-wider text-gray-400 mb-2">Aggression</div>
                    <div className="h-2 bg-white/5 rounded-full overflow-hidden mb-1.5">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-green-500 to-red-500"
                        style={{ width: `${Math.min(pfrPct * 3, 100)}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-[0.5625rem]">
                      <span className="text-green-400">Passive</span>
                      <span className="text-red-400">Aggressive</span>
                    </div>
                  </div>

                  {/* Tightness */}
                  <div className="p-3 rounded-lg bg-white/8 border border-white/15">
                    <div className="text-[0.625rem] font-bold uppercase tracking-wider text-gray-400 mb-2">Hand Selection</div>
                    <div className="h-2 bg-white/5 rounded-full overflow-hidden mb-1.5">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-amber-500 to-amber-500"
                        style={{ width: `${Math.min(vpipPct * 2.5, 100)}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-[0.5625rem]">
                      <span className="text-cyan-400">Tight</span>
                      <span className="text-cyan-400">Loose</span>
                    </div>
                  </div>

                  {/* Overall */}
                  <div className="p-3 rounded-lg bg-white/8 border border-white/15">
                    <div className="text-[0.625rem] font-bold uppercase tracking-wider text-gray-400 mb-2">Play Type</div>
                    <div className="text-lg font-bold tracking-tight mt-1" style={{
                      color: vpipPct <= 20 && pfrPct <= 15 ? "#00d4ff"
                        : vpipPct <= 20 && pfrPct > 15 ? "#ff6060"
                        : vpipPct > 20 && pfrPct <= 15 ? "#ffa500"
                        : "#00d4ff"
                    }}>
                      {vpipPct <= 20 && pfrPct <= 15 ? "Tight-Passive (Rock)"
                        : vpipPct <= 20 && pfrPct > 15 ? "Tight-Aggressive (TAG)"
                        : vpipPct > 20 && pfrPct <= 15 ? "Loose-Passive (Calling Station)"
                        : "Loose-Aggressive (LAG)"}
                    </div>
                    <div className="text-[0.5625rem] text-gray-500 mt-1">Based on VPIP & PFR</div>
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
