import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { DashboardLayout } from "@/components/DashboardLayout";
import { PageBackground } from "@/components/shared/PageBackground";
import { useAuth } from "@/lib/auth-context";
import { useWallet } from "@/lib/wallet-context";
import {
  BarChart3, TrendingUp, Target, Gamepad2,
  Coins, Trophy, Loader2, Brain,
  ArrowUpRight, ArrowDownRight, Minus,
  Users, Activity, PieChart, Clock, FileText,
  AlertCircle, Calendar
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

interface AnalysisEntry {
  id: number;
  handId: string;
  result: string;
  createdAt: string;
}

interface SessionEntry {
  tableId: string;
  netResult: number;
  sessionStart: string;
  sessionEnd: string;
  handsPlayed: number;
}

interface ClubActivityEntry {
  type: string;
  description: string;
  timestamp: string;
  clubId: string;
}

interface TableVolumeEntry {
  date: string;
  count: number;
}

interface RetentionData {
  active7d: number;
  active30d: number;
  total: number;
  newThisWeek: number;
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
          <stop offset="0%" stopColor={isPositive ? "#d4af37" : "#ff3366"} stopOpacity="0.4" />
          <stop offset="100%" stopColor={isPositive ? "#d4af37" : "#ff3366"} stopOpacity="0.02" />
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
          stroke={isPositive ? "#d4af37" : "#ff3366"}
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      )}

      {/* Data point dots with tooltips */}
      {points.map((p, i) => (
        <circle
          key={i}
          cx={p.x}
          cy={p.y}
          r={i === points.length - 1 ? 4 : 2.5}
          fill={isPositive ? "#d4af37" : "#ff3366"}
          stroke={i === points.length - 1 ? "rgba(10,16,34,0.8)" : "none"}
          strokeWidth={i === points.length - 1 ? 2 : 0}
          opacity={i === points.length - 1 ? 1 : 0}
          className="hover:opacity-100 hover:r-4 transition-opacity cursor-pointer"
          style={{ pointerEvents: "all" }}
        >
          <title>{data[i]} chips</title>
        </circle>
      ))}{points.length > 0 && (
        <circle
          cx={points[points.length - 1].x}
          cy={points[points.length - 1].y}
          r="4"
          fill={isPositive ? "#d4af37" : "#ff3366"}
          stroke="rgba(10,16,34,0.8)"
          strokeWidth="2"
        >
          <title>{final} chips</title>
        </circle>
      )}

      {/* X-axis labels */}
      <text x={PAD_X} y={H - 2} fill="rgba(255,255,255,0.3)" fontSize="9" fontFamily="monospace">Hand 1</text>
      <text x={W - PAD_X} y={H - 2} fill="rgba(255,255,255,0.3)" fontSize="9" fontFamily="monospace" textAnchor="end">Hand {data.length}</text>
    </svg>
  );
}

/* ── (Coming Soon placeholder removed — real analytics below) ─────────── */

/* ── Period filter helper ─────────────────────────────────────────────────── */

function getPeriodCutoff(period: string): Date | null {
  if (period === "all") return null;
  const now = new Date();
  switch (period) {
    case "7days": return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    case "30days": return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    case "3months": return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    default: return null;
  }
}

/* ── Main Component ───────────────────────────────────────────────────────── */

export default function Analytics() {
  const { user } = useAuth();
  const { balance } = useWallet();
  const [stats, setStats] = useState<PlayerStats | null>(null);
  const [handHistory, setHandHistory] = useState<HandEntry[]>([]);
  const [sessions, setSessions] = useState<SessionEntry[]>([]);
  const [analyses, setAnalyses] = useState<AnalysisEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const [chartPeriod, setChartPeriod] = useState("all");
  const [loadError, setLoadError] = useState<string | null>(null);

  const [clubActivity, setClubActivity] = useState<ClubActivityEntry[]>([]);
  const [tableVolume, setTableVolume] = useState<TableVolumeEntry[]>([]);
  const [retention, setRetention] = useState<RetentionData | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);
  const [analyticsError, setAnalyticsError] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      try {
        const [statsRes, handsRes, sessionsRes, analysesRes] = await Promise.all([
          fetch("/api/stats/me"),
          user?.id ? fetch(`/api/players/${user.id}/hands?limit=200`) : Promise.resolve(null),
          fetch("/api/wallet/sessions?limit=50").catch(() => null),
          fetch("/api/analyses", { credentials: "include" }).catch(() => null),
        ]);
        if (statsRes.status === 401) {
          setLoadError("Session expired — please log in again");
          return;
        }
        if (statsRes.ok) setStats(await statsRes.json());
        else setLoadError("Failed to load stats");
        if (handsRes?.ok) setHandHistory(await handsRes.json());
        if (sessionsRes?.ok) setSessions(await sessionsRes.json());
        if (analysesRes?.ok) {
          setAnalyses(await analysesRes.json());
        }
      } catch (err: any) {
        setLoadError(err.message || "Failed to load analytics data");
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [user?.id]);

  useEffect(() => {
    async function loadAnalytics() {
      try {
        const [activityRes, volumeRes, retentionRes] = await Promise.all([
          fetch("/api/analytics/club-activity", { credentials: "include" }).catch(() => null),
          fetch("/api/analytics/table-volume", { credentials: "include" }).catch(() => null),
          fetch("/api/analytics/retention", { credentials: "include" }).catch(() => null),
        ]);
        if (activityRes?.ok) setClubActivity(await activityRes.json());
        if (volumeRes?.ok) setTableVolume(await volumeRes.json());
        if (retentionRes?.ok) setRetention(await retentionRes.json());
      } catch (err: any) {
        setAnalyticsError(err.message || "Failed to load club analytics");
      } finally {
        setAnalyticsLoading(false);
      }
    }
    loadAnalytics();
  }, []);

  const winRate = stats && stats.handsPlayed > 0
    ? Math.round((stats.potsWon / stats.handsPlayed) * 100)
    : 0;

  const vpipPct = stats && stats.handsPlayed > 0
    ? Math.round((stats.vpip / stats.handsPlayed) * 100)
    : 0;
  const pfrPct = stats && stats.handsPlayed > 0
    ? Math.round((stats.pfr / stats.handsPlayed) * 100)
    : 0;

  // Filter sessions by selected time period
  const filteredSessions = useMemo(() => {
    const cutoff = getPeriodCutoff(chartPeriod);
    if (!cutoff) return sessions;
    return sessions.filter(s => new Date(s.sessionEnd) >= cutoff);
  }, [sessions, chartPeriod]);

  // Compute cumulative winnings from session data when available, else fall back to hand history
  const cumulativeWinnings = useMemo(() => {
    if (filteredSessions.length > 0) {
      // Sort sessions chronologically (oldest first)
      const sorted = [...filteredSessions].sort(
        (a, b) => new Date(a.sessionStart).getTime() - new Date(b.sessionStart).getTime()
      );
      let running = 0;
      return sorted.map(s => {
        running += s.netResult;
        return running;
      });
    }
    // Fallback: use hand history (no date filtering possible here)
    if (handHistory.length === 0) return [];
    const reversed = [...handHistory].reverse();
    let running = 0;
    return reversed.map(h => {
      running += h.netResult;
      return running;
    });
  }, [filteredSessions, handHistory]);

  // Compute table volume summary stats
  const volumeStats = useMemo(() => {
    if (tableVolume.length === 0) return { thisWeek: 0, thisMonth: 0, totalTables: 0 };
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    let thisWeek = 0;
    let thisMonth = 0;
    for (const entry of tableVolume) {
      thisMonth += entry.count;
      if (new Date(entry.date) >= weekAgo) thisWeek += entry.count;
    }
    return { thisWeek, thisMonth, totalTables: thisMonth };
  }, [tableVolume]);

  const statCards = [
    {
      label: "Hands Played",
      value: stats?.handsPlayed ?? 0,
      icon: Gamepad2,
      color: "amber",
      gradient: "from-amber-500/20 to-blue-500/20",
      border: "border-primary/20",
      textColor: "text-primary",
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
      border: "border-primary/20",
      textColor: "text-primary",
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
      <PageBackground image="/images/generated/analytics-bg.png" />
      <div className="relative z-10 px-8 pb-8">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
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
                    className="rounded-xl p-4 relative overflow-hidden"
                    style={{
                      background: "rgba(15,15,20,0.7)",
                      backdropFilter: "blur(12px)",
                      WebkitBackdropFilter: "blur(12px)",
                      border: "1px solid rgba(212,175,55,0.12)",
                    }}
                  >
                    <div className={`absolute top-0 right-0 w-20 h-20 bg-gradient-to-br ${card.gradient} blur-3xl rounded-full opacity-30`} />
                    <div className="relative">
                      <div className={`w-9 h-9 rounded-lg bg-gradient-to-br ${card.gradient} border ${card.border} flex items-center justify-center mb-3`}>
                        <Icon className={`w-5 h-5 ${card.textColor}`} />
                      </div>
                      <div className="text-2xl font-bold tracking-tight" style={{ color: "#d4af37" }}>
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
                background: "rgba(15,15,20,0.7)",
                backdropFilter: "blur(12px)",
                WebkitBackdropFilter: "blur(12px)",
                border: "1px solid rgba(212,175,55,0.12)",
              }}
            >
              <div className="px-5 py-3.5 border-b border-[#c9a84c]/10 flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-[#c9a84c]/80" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[#c9a84c]/70">Winnings Over Time</h3>
                </div>
                <div className="flex items-center gap-1">
                  {["7 Days", "30 Days", "3 Months", "All Time"].map((label) => {
                    const key = label === "All Time" ? "all" : label.toLowerCase().replace(/\s/g, "");
                    return (
                      <button
                        key={key}
                        onClick={() => setChartPeriod(key)}
                        className={`px-2.5 py-1 rounded-full text-[0.5625rem] font-bold uppercase tracking-wider transition-all ${
                          chartPeriod === key
                            ? "bg-[#c9a84c]/15 text-[#c9a84c] border border-[#c9a84c]/30"
                            : "text-gray-500 border border-transparent hover:text-gray-400"
                        }`}
                      >
                        {label}
                      </button>
                    );
                  })}
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
                  <div className="h-[200px] rounded-lg border border-white/[0.04] bg-white/[0.01] p-1">
                    <WinningsChart data={cumulativeWinnings} />
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4 bg-primary/10 border border-primary/15">
                      <TrendingUp className="w-7 h-7 text-primary/40" />
                    </div>
                    <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-1">No Hand Data Yet</h3>
                    <p className="text-xs text-muted-foreground/60 max-w-xs">Play some hands to see your winnings chart and track your progress over time.</p>
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
                background: "rgba(15,15,20,0.7)",
                backdropFilter: "blur(12px)",
                WebkitBackdropFilter: "blur(12px)",
                border: "1px solid rgba(212,175,55,0.12)",
              }}
            >
              <div className="px-5 py-3.5 border-b border-[#c9a84c]/10 flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-[#c9a84c]/80" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#c9a84c]/70">Detailed Statistics</h3>
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
                    <div className="text-xl font-bold tracking-tight" style={{ color: "#d4af37" }}>
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
                background: "rgba(15,15,20,0.7)",
                backdropFilter: "blur(12px)",
                WebkitBackdropFilter: "blur(12px)",
                border: "1px solid rgba(212,175,55,0.12)",
              }}
            >
              <div className="px-5 py-3.5 border-b border-[#c9a84c]/10 flex items-center gap-2">
                <Brain className="w-4 h-4 text-[#c9a84c]/80" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#c9a84c]/70">Play Style Assessment</h3>
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
                      <span className="text-primary">Tight</span>
                      <span className="text-primary">Loose</span>
                    </div>
                  </div>

                  {/* Overall */}
                  <div className="p-3 rounded-lg bg-white/8 border border-white/15">
                    <div className="text-[0.625rem] font-bold uppercase tracking-wider text-gray-400 mb-2">Play Type</div>
                    <div className="text-lg font-bold tracking-tight mt-1" style={{
                      color: vpipPct <= 20 && pfrPct <= 15 ? "#d4af37"
                        : vpipPct <= 20 && pfrPct > 15 ? "#ff6060"
                        : vpipPct > 20 && pfrPct <= 15 ? "#ffa500"
                        : "#d4af37"
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

            {/* ── Club Analytics ── */}
            {analyticsLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-5 h-5 animate-spin text-primary/60" />
                <span className="ml-2 text-xs text-gray-500">Loading club analytics...</span>
              </div>
            ) : analyticsError ? (
              <div className="flex items-center justify-center py-8 gap-2">
                <AlertCircle className="w-4 h-4 text-red-400" />
                <span className="text-xs text-red-400">{analyticsError}</span>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Player Retention Stats */}
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.45 }}
                    className="rounded-xl overflow-hidden"
                    style={{
                      background: "rgba(15,15,20,0.7)",
                      backdropFilter: "blur(12px)",
                      WebkitBackdropFilter: "blur(12px)",
                      border: "1px solid rgba(212,175,55,0.12)",
                    }}
                  >
                    <div className="px-5 py-3.5 border-b border-[#c9a84c]/10 flex items-center gap-2">
                      <PieChart className="w-4 h-4 text-[#c9a84c]/80" />
                      <h3 className="text-xs font-bold uppercase tracking-wider text-[#c9a84c]/70">Player Retention</h3>
                    </div>
                    {retention ? (
                      <div className="grid grid-cols-2 gap-px bg-white/[0.03]">
                        {[
                          { label: "Active (7d)", value: retention.active7d, color: "text-green-400" },
                          { label: "Active (30d)", value: retention.active30d, color: "text-blue-400" },
                          { label: "Total Players", value: retention.total, color: "text-[#d4af37]" },
                          { label: "New This Week", value: retention.newThisWeek, color: "text-purple-400" },
                        ].map((item) => (
                          <div key={item.label} className="p-4 bg-[rgba(15,15,20,0.7)] hover:bg-white/[0.02] transition-colors">
                            <div className="text-[0.625rem] font-bold uppercase tracking-wider text-gray-400 mb-1">{item.label}</div>
                            <div className={`text-2xl font-bold tracking-tight ${item.color}`}>{item.value}</div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center py-12 text-center">
                        <Users className="w-7 h-7 text-gray-500/40 mb-2" />
                        <p className="text-xs text-gray-500">No retention data available</p>
                      </div>
                    )}
                  </motion.div>

                  {/* Table Volume */}
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 }}
                    className="rounded-xl overflow-hidden"
                    style={{
                      background: "rgba(15,15,20,0.7)",
                      backdropFilter: "blur(12px)",
                      WebkitBackdropFilter: "blur(12px)",
                      border: "1px solid rgba(212,175,55,0.12)",
                    }}
                  >
                    <div className="px-5 py-3.5 border-b border-[#c9a84c]/10 flex items-center gap-2">
                      <Activity className="w-4 h-4 text-[#c9a84c]/80" />
                      <h3 className="text-xs font-bold uppercase tracking-wider text-[#c9a84c]/70">Table Volume</h3>
                    </div>
                    <div className="p-5">
                      <div className="grid grid-cols-3 gap-4 mb-4">
                        {[
                          { label: "This Week", value: volumeStats.thisWeek, icon: Calendar },
                          { label: "This Month", value: volumeStats.thisMonth, icon: BarChart3 },
                          { label: "Avg / Day", value: tableVolume.length > 0 ? (volumeStats.thisMonth / Math.min(tableVolume.length, 30)).toFixed(1) : "0", icon: Activity },
                        ].map((item) => (
                          <div key={item.label} className="text-center p-3 rounded-lg bg-white/[0.03] border border-white/[0.06]">
                            <item.icon className="w-4 h-4 text-[#c9a84c]/60 mx-auto mb-1.5" />
                            <div className="text-xl font-bold tracking-tight text-[#d4af37]">{item.value}</div>
                            <div className="text-[0.5625rem] text-gray-500 uppercase tracking-wider mt-0.5">{item.label}</div>
                          </div>
                        ))}
                      </div>
                      {tableVolume.length > 0 && (
                        <div className="text-[0.5625rem] text-gray-500 text-center">
                          Showing last 30 days of table creation data
                        </div>
                      )}
                    </div>
                  </motion.div>
                </div>

                {/* Recent Club Activity */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.55 }}
                  className="rounded-xl overflow-hidden"
                  style={{
                    background: "rgba(15,15,20,0.7)",
                    backdropFilter: "blur(12px)",
                    WebkitBackdropFilter: "blur(12px)",
                    border: "1px solid rgba(212,175,55,0.12)",
                  }}
                >
                  <div className="px-5 py-3.5 border-b border-[#c9a84c]/10 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-[#c9a84c]/80" />
                      <h3 className="text-xs font-bold uppercase tracking-wider text-[#c9a84c]/70">Recent Club Activity</h3>
                    </div>
                    {clubActivity.length > 0 && (
                      <span className="text-[0.5625rem] text-gray-500 uppercase tracking-wider">{clubActivity.length} items</span>
                    )}
                  </div>
                  {clubActivity.length > 0 ? (
                    <div className="divide-y divide-white/[0.03]">
                      {clubActivity.map((item, i) => (
                        <div key={i} className="px-5 py-3 hover:bg-white/[0.02] transition-colors flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                              item.type === "member_join" ? "bg-green-500/10 border border-green-500/20" :
                              item.type === "announcement" ? "bg-blue-500/10 border border-blue-500/20" :
                              "bg-primary/10 border border-primary/20"
                            }`}>
                              {item.type === "member_join" ? <Users className="w-3.5 h-3.5 text-green-400" /> :
                               item.type === "announcement" ? <FileText className="w-3.5 h-3.5 text-blue-400" /> :
                               <Activity className="w-3.5 h-3.5 text-[#d4af37]" />}
                            </div>
                            <div>
                              <p className="text-xs text-white/80">{item.description}</p>
                              <p className="text-[0.5625rem] text-gray-500 capitalize">{item.type.replace(/_/g, " ")}</p>
                            </div>
                          </div>
                          <span className="text-[0.5625rem] text-gray-500 whitespace-nowrap ml-4">
                            {new Date(item.timestamp).toLocaleDateString()}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <Clock className="w-7 h-7 text-gray-500/40 mb-2" />
                      <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-1">No Club Activity</h3>
                      <p className="text-xs text-muted-foreground/60 max-w-xs">Join a club to see recent activity here.</p>
                    </div>
                  )}
                </motion.div>
              </>
            )}

            {/* ── Past AI Analyses ── */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.65 }}
              className="rounded-xl overflow-hidden"
              style={{
                background: "rgba(15,15,20,0.7)",
                backdropFilter: "blur(12px)",
                WebkitBackdropFilter: "blur(12px)",
                border: "1px solid rgba(212,175,55,0.12)",
              }}
            >
              <div className="px-5 py-3.5 border-b border-[#c9a84c]/10 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Brain className="w-4 h-4 text-[#c9a84c]/80" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[#c9a84c]/70">Past AI Analyses</h3>
                </div>
                {analyses.length > 0 && (
                  <span className="text-[0.5625rem] text-gray-500 uppercase tracking-wider">{analyses.length} analyses</span>
                )}
              </div>
              {analyses.length > 0 ? (
                <div className="divide-y divide-white/[0.03]">
                  {analyses.slice(0, 20).map((analysis) => (
                    <div key={analysis.id} className="px-5 py-3 hover:bg-white/[0.02] transition-colors">
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <FileText className="w-3 h-3 text-purple-400/60" />
                          <span className="text-xs font-bold text-white/80">
                            Hand {analysis.handId?.slice(0, 8) ?? "—"}
                          </span>
                        </div>
                        <span className="text-[0.5625rem] text-gray-500">
                          {analysis.createdAt ? new Date(analysis.createdAt).toLocaleDateString() : "—"}
                        </span>
                      </div>
                      <p className="text-[0.6875rem] text-gray-400 leading-relaxed line-clamp-2">
                        {analysis.result || "No summary available"}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-3 bg-purple-500/10 border border-purple-500/15">
                    <Brain className="w-6 h-6 text-purple-400/40" />
                  </div>
                  <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-1">No AI Analyses Yet</h3>
                  <p className="text-xs text-muted-foreground/60 max-w-xs">
                    Use the AI analysis feature during hand review to get strategic insights on your play.
                  </p>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
