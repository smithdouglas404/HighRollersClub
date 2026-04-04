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
  Users, Activity, PieChart, Clock, FileText
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

/* ── Active Members Line Chart (S39) ─────────────────────────────────────── */

function ActiveMembersChart({ data, labels }: { data: number[]; labels: string[] }) {
  const W = 600;
  const H = 200;
  const PAD_X = 40;
  const PAD_Y = 20;

  const chartW = W - PAD_X * 2;
  const chartH = H - PAD_Y * 2;

  const min = Math.min(...data) * 0.9;
  const max = Math.max(...data) * 1.05;
  const range = max - min || 1;

  const points = data.map((v, i) => {
    const x = PAD_X + (i / Math.max(data.length - 1, 1)) * chartW;
    const y = PAD_Y + chartH - ((v - min) / range) * chartH;
    return { x, y };
  });

  const pathD = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
  const areaD = pathD +
    ` L ${points[points.length - 1].x.toFixed(1)} ${(PAD_Y + chartH).toFixed(1)}` +
    ` L ${points[0].x.toFixed(1)} ${(PAD_Y + chartH).toFixed(1)} Z`;

  const yLabels = [max, (max + min) / 2, min].map(v => Math.round(v));

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-full" preserveAspectRatio="xMidYMid meet">
      <defs>
        <linearGradient id="membersGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#a78bfa" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#a78bfa" stopOpacity="0.02" />
        </linearGradient>
      </defs>

      {/* Grid lines */}
      {yLabels.map((v) => {
        const y = PAD_Y + chartH - ((v - min) / range) * chartH;
        return (
          <g key={v}>
            <line x1={PAD_X} y1={y} x2={W - PAD_X} y2={y} stroke="rgba(255,255,255,0.06)" strokeDasharray="4 4" />
            <text x={PAD_X - 6} y={y + 3} textAnchor="end" fill="rgba(255,255,255,0.3)" fontSize="9" fontFamily="monospace">
              {v}
            </text>
          </g>
        );
      })}

      {/* Area fill */}
      <path d={areaD} fill="url(#membersGrad)" />

      {/* Line */}
      <path d={pathD} fill="none" stroke="#a78bfa" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />

      {/* Data points */}
      {points.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r="3.5" fill="#a78bfa" stroke="rgba(10,16,34,0.8)" strokeWidth="2" />
      ))}

      {/* X-axis labels */}
      {labels.map((label, i) => {
        const x = PAD_X + (i / Math.max(labels.length - 1, 1)) * chartW;
        return (
          <text key={i} x={x} y={H - 2} fill="rgba(255,255,255,0.3)" fontSize="9" fontFamily="monospace" textAnchor="middle">
            {label}
          </text>
        );
      })}
    </svg>
  );
}

/* ── Table Volume Bar Chart (S40) ────────────────────────────────────────── */

function TableVolumeChart({ data, labels }: { data: number[]; labels: string[] }) {
  const W = 600;
  const H = 200;
  const PAD_X = 44;
  const PAD_Y = 16;
  const PAD_BOTTOM = 24;

  const chartW = W - PAD_X * 2;
  const chartH = H - PAD_Y - PAD_BOTTOM;

  const max = Math.max(...data) * 1.1;
  const barWidth = chartW / data.length * 0.55;
  const barGap = chartW / data.length;

  const yLabels = [max, max * 0.5, 0].map(v => Math.round(v));

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-full" preserveAspectRatio="xMidYMid meet">
      <defs>
        <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#d4af37" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#d4af37" stopOpacity="0.3" />
        </linearGradient>
      </defs>

      {/* Grid lines */}
      {yLabels.map((v) => {
        const y = PAD_Y + chartH - (v / max) * chartH;
        return (
          <g key={v}>
            <line x1={PAD_X} y1={y} x2={W - PAD_X} y2={y} stroke="rgba(255,255,255,0.06)" strokeDasharray="4 4" />
            <text x={PAD_X - 6} y={y + 3} textAnchor="end" fill="rgba(255,255,255,0.3)" fontSize="9" fontFamily="monospace">
              {v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v}
            </text>
          </g>
        );
      })}

      {/* Bars */}
      {data.map((v, i) => {
        const barH = (v / max) * chartH;
        const x = PAD_X + i * barGap + (barGap - barWidth) / 2;
        const y = PAD_Y + chartH - barH;
        return (
          <g key={i}>
            <rect x={x} y={y} width={barWidth} height={barH} fill="url(#barGrad)" rx="3" />
            {/* Bar glow */}
            <rect x={x} y={y} width={barWidth} height={barH} fill="none" stroke="rgba(212,175,55,0.25)" strokeWidth="1" rx="3" />
            {/* Value on top */}
            <text x={x + barWidth / 2} y={y - 5} fill="rgba(255,255,255,0.5)" fontSize="8" fontFamily="monospace" textAnchor="middle">
              {v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v}
            </text>
          </g>
        );
      })}

      {/* X-axis labels */}
      {labels.map((label, i) => {
        const x = PAD_X + i * barGap + barGap / 2;
        return (
          <text key={i} x={x} y={H - 4} fill="rgba(255,255,255,0.35)" fontSize="9" fontFamily="monospace" textAnchor="middle">
            {label}
          </text>
        );
      })}
    </svg>
  );
}

/* ── Donut Chart (S41) ───────────────────────────────────────────────────── */

function RetentionDonut({ segments }: { segments: { label: string; value: number; color: string }[] }) {
  const total = segments.reduce((s, seg) => s + seg.value, 0);
  const R = 70;
  const STROKE = 22;
  const circumference = 2 * Math.PI * R;
  const CX = 100;
  const CY = 100;

  let cumulativeOffset = 0;

  return (
    <svg viewBox="0 0 200 200" className="w-full h-full" preserveAspectRatio="xMidYMid meet">
      {/* Background ring */}
      <circle cx={CX} cy={CY} r={R} fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth={STROKE} />

      {/* Segments */}
      {segments.map((seg, i) => {
        const fraction = seg.value / total;
        const dashLength = fraction * circumference;
        const gapLength = circumference - dashLength;
        const offset = -cumulativeOffset * circumference / total;
        cumulativeOffset += seg.value;
        return (
          <circle
            key={i}
            cx={CX}
            cy={CY}
            r={R}
            fill="none"
            stroke={seg.color}
            strokeWidth={STROKE}
            strokeDasharray={`${dashLength} ${gapLength}`}
            strokeDashoffset={-offset + circumference * 0.25}
            strokeLinecap="butt"
            style={{ transition: "stroke-dasharray 0.6s ease" }}
          />
        );
      })}

      {/* Center text */}
      <text x={CX} y={CY - 6} textAnchor="middle" fill="rgba(255,255,255,0.9)" fontSize="18" fontWeight="700" fontFamily="'Space Grotesk', sans-serif">
        {total}%
      </text>
      <text x={CX} y={CY + 10} textAnchor="middle" fill="rgba(255,255,255,0.35)" fontSize="8" fontFamily="monospace" style={{ textTransform: "uppercase" }} letterSpacing="0.1em">
        RETENTION
      </text>
    </svg>
  );
}

/* ── Mock Data ───────────────────────────────────────────────────────────── */

const MOCK_ACTIVE_MEMBERS = [42, 38, 51, 47, 55, 49, 62];
const MOCK_ACTIVE_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const MOCK_TABLE_VOLUME = [1200, 1850, 2100, 1780, 2450, 2900];
const MOCK_VOLUME_LABELS = ["Oct", "Nov", "Dec", "Jan", "Feb", "Mar"];

const MOCK_RETENTION_SEGMENTS = [
  { label: "Returning", value: 57, color: "#d4af37" },
  { label: "New", value: 33, color: "#c9a84c" },
  { label: "Inactive", value: 10, color: "rgba(255,255,255,0.15)" },
];

const MOCK_RECENT_ACTIVITY = [
  { name: "AceKing_77", lastActive: "2 hours ago", gamesPlayed: 48, totalStakes: 12400 },
  { name: "RiverRat_Pro", lastActive: "5 hours ago", gamesPlayed: 35, totalStakes: 8750 },
  { name: "BluffMaster", lastActive: "1 day ago", gamesPlayed: 62, totalStakes: 21300 },
  { name: "NitQueen", lastActive: "1 day ago", gamesPlayed: 27, totalStakes: 5400 },
  { name: "PokerShark99", lastActive: "2 days ago", gamesPlayed: 91, totalStakes: 34200 },
  { name: "FishOnTilt", lastActive: "3 days ago", gamesPlayed: 19, totalStakes: 3800 },
  { name: "SetMiner_X", lastActive: "4 days ago", gamesPlayed: 44, totalStakes: 15600 },
];

/* ── Main Component ───────────────────────────────────────────────────────── */

export default function Analytics() {
  const { user } = useAuth();
  const { balance } = useWallet();
  const [stats, setStats] = useState<PlayerStats | null>(null);
  const [handHistory, setHandHistory] = useState<HandEntry[]>([]);
  const [analyses, setAnalyses] = useState<AnalysisEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const [chartPeriod, setChartPeriod] = useState("all");
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      try {
        const [statsRes, handsRes, analysesRes] = await Promise.all([
          fetch("/api/stats/me"),
          user?.id ? fetch(`/api/players/${user.id}/hands?limit=200`) : Promise.resolve(null),
          fetch("/api/analyses", { credentials: "include" }).catch(() => null),
        ]);
        if (statsRes.status === 401) {
          setLoadError("Session expired — please log in again");
          return;
        }
        if (statsRes.ok) setStats(await statsRes.json());
        else setLoadError("Failed to load stats");
        if (handsRes?.ok) setHandHistory(await handsRes.json());
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

            {/* ── S39 & S40: Active Members + Table Volume (side by side) ── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* S39: Active Members Line Chart */}
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
                <div className="px-5 py-3.5 border-b border-[#c9a84c]/10 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-[#c9a84c]/80" />
                    <h3 className="text-xs font-bold uppercase tracking-wider text-[#c9a84c]/70">Active Members</h3>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-green-500/10 border border-green-500/20">
                      <ArrowUpRight className="w-3 h-3 text-green-400" />
                    </span>
                    <span className="text-xs font-bold text-green-400">+26%</span>
                  </div>
                </div>
                <div className="p-4">
                  <div className="h-[200px] rounded-lg border border-white/[0.04] bg-white/[0.01] p-1">
                    <ActiveMembersChart data={MOCK_ACTIVE_MEMBERS} labels={MOCK_ACTIVE_LABELS} />
                  </div>
                  <div className="flex items-center justify-between mt-3 px-1">
                    <div>
                      <div className="text-xl font-bold text-purple-400 tracking-tight">62</div>
                      <div className="text-[0.5625rem] text-gray-500 uppercase tracking-wider">Today</div>
                    </div>
                    <div className="text-right">
                      <div className="text-xl font-bold text-white/60 tracking-tight">49</div>
                      <div className="text-[0.5625rem] text-gray-500 uppercase tracking-wider">7-Day Avg</div>
                    </div>
                  </div>
                </div>
              </motion.div>

              {/* S40: Table Volume Bar Chart */}
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
                <div className="px-5 py-3.5 border-b border-[#c9a84c]/10 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Activity className="w-4 h-4 text-[#c9a84c]/80" />
                    <h3 className="text-xs font-bold uppercase tracking-wider text-[#c9a84c]/70">Table Volume</h3>
                  </div>
                  <span className="text-[0.5625rem] text-gray-500 uppercase tracking-wider">Last 6 Months</span>
                </div>
                <div className="p-4">
                  <div className="h-[200px] rounded-lg border border-white/[0.04] bg-white/[0.01] p-1">
                    <TableVolumeChart data={MOCK_TABLE_VOLUME} labels={MOCK_VOLUME_LABELS} />
                  </div>
                  <div className="flex items-center justify-between mt-3 px-1">
                    <div>
                      <div className="text-xl font-bold text-primary tracking-tight">2,900</div>
                      <div className="text-[0.5625rem] text-gray-500 uppercase tracking-wider">This Month</div>
                    </div>
                    <div className="text-right">
                      <div className="text-xl font-bold text-white/60 tracking-tight">12,280</div>
                      <div className="text-[0.5625rem] text-gray-500 uppercase tracking-wider">6-Mo Total</div>
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>

            {/* ── S41: New vs Returning Players Donut Chart ── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
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
                <div className="px-5 py-3.5 border-b border-[#c9a84c]/10 flex items-center gap-2">
                  <PieChart className="w-4 h-4 text-[#c9a84c]/80" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[#c9a84c]/70">Player Retention</h3>
                </div>
                <div className="p-4 flex flex-col items-center">
                  <div className="w-[180px] h-[180px]">
                    <RetentionDonut segments={MOCK_RETENTION_SEGMENTS} />
                  </div>
                  <div className="flex items-center gap-5 mt-4">
                    {MOCK_RETENTION_SEGMENTS.map((seg) => (
                      <div key={seg.label} className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: seg.color }} />
                        <span className="text-[0.625rem] text-gray-400">
                          {seg.label} <span className="font-bold text-white/80">{seg.value}%</span>
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>

              {/* ── S42: Recent Activity Table ── */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 }}
                className="lg:col-span-2 rounded-xl overflow-hidden"
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
                    <h3 className="text-xs font-bold uppercase tracking-wider text-[#c9a84c]/70">Recent Activity</h3>
                  </div>
                  <span className="text-[0.5625rem] text-gray-500 uppercase tracking-wider">{MOCK_RECENT_ACTIVITY.length} Members</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-white/[0.04]">
                        <th className="px-5 py-2.5 text-[0.5625rem] font-bold uppercase tracking-wider text-gray-500">Player</th>
                        <th className="px-5 py-2.5 text-[0.5625rem] font-bold uppercase tracking-wider text-gray-500">Last Active</th>
                        <th className="px-5 py-2.5 text-[0.5625rem] font-bold uppercase tracking-wider text-gray-500 text-right">Games</th>
                        <th className="px-5 py-2.5 text-[0.5625rem] font-bold uppercase tracking-wider text-gray-500 text-right">Total Stakes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {MOCK_RECENT_ACTIVITY.map((row, i) => (
                        <motion.tr
                          key={row.name}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.65 + i * 0.04 }}
                          className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors"
                        >
                          <td className="px-5 py-2.5">
                            <div className="flex items-center gap-2.5">
                              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-primary/20 to-purple-500/20 border border-white/[0.08] flex items-center justify-center">
                                <span className="text-[0.5625rem] font-bold text-primary">{row.name.charAt(0)}</span>
                              </div>
                              <span className="text-sm font-medium text-white/90">{row.name}</span>
                            </div>
                          </td>
                          <td className="px-5 py-2.5">
                            <span className="text-xs text-gray-400">{row.lastActive}</span>
                          </td>
                          <td className="px-5 py-2.5 text-right">
                            <span className="text-sm font-bold text-white/80">{row.gamesPlayed}</span>
                          </td>
                          <td className="px-5 py-2.5 text-right">
                            <span className="text-sm font-bold text-primary">{row.totalStakes.toLocaleString()}</span>
                          </td>
                        </motion.tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </motion.div>
            </div>

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
