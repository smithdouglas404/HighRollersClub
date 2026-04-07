import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { DashboardLayout } from "@/components/DashboardLayout";
import { GoldCard, StatCard, SectionHeader, NumberTicker } from "@/components/premium/PremiumComponents";
import { PageBackground } from "@/components/shared/PageBackground";
import { useAuth } from "@/lib/auth-context";
import { useWallet } from "@/lib/wallet-context";
import {
  BarChart3, TrendingUp, Target, Gamepad2,
  Coins, Trophy, Loader2, Brain,
  ArrowUpRight, ArrowDownRight, Minus,
  Users, Activity, PieChart, Clock, FileText,
  AlertCircle, Calendar, CheckCircle2, AlertTriangle, XCircle,
  ChevronDown, ChevronUp, Zap
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

interface BreakdownGroup {
  handsPlayed: number;
  potsWon: number;
  winRate: number;
  totalChipsWon: number;
  totalChipsLost: number;
  netResult: number;
}

interface StatsBreakdown {
  byVariant: Record<string, BreakdownGroup>;
  byFormat: Record<string, BreakdownGroup>;
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

interface CoachingRecommendation {
  category: string;
  severity: "warning" | "good" | "critical";
  title: string;
  detail: string;
}

interface SessionReport {
  sessionId: string;
  handsAnalyzed: number;
  netResult: number;
  positionBreakdown: { position: string; hands: number; vpip: number; winRate: number }[];
  leaks: { description: string; chipsLost: number; frequency: number }[];
  topWinningHands: string[];
  topLosingHands: string[];
  recommendations: string[];
}

interface CoachingData {
  handsAnalyzed: number;
  overallRating: "Tight-Aggressive" | "Loose-Aggressive" | "Tight-Passive" | "Loose-Passive";
  score: number;
  recommendations: CoachingRecommendation[];
  stats: { vpip: number; pfr: number; showdownPct: number; winRate: number; handsPlayed: number };
}

interface SessionHistoryEntry {
  sessionId: string;
  tableName: string;
  startTime: string;
  endTime: string;
  handsPlayed: number;
  startingStack: number;
  endingStack: number;
  netResult: number;
  stackHistory: { handNumber: number; chips: number }[];
}

/* ── Mini Session Chart ──────────────────────────────────────────────────── */

function SessionStackChart({ stackHistory, startingStack, netResult }: {
  stackHistory: { handNumber: number; chips: number }[];
  startingStack: number;
  netResult: number;
}) {
  const W = 300;
  const H = 100;
  const PAD_X = 8;
  const PAD_Y = 8;

  const chartW = W - PAD_X * 2;
  const chartH = H - PAD_Y * 2;

  const chips = stackHistory.map(h => h.chips);
  const allValues = [...chips, startingStack];
  const min = Math.min(...allValues);
  const max = Math.max(...allValues);
  const range = max - min || 1;

  const points = chips.map((v, i) => {
    const x = PAD_X + (i / Math.max(chips.length - 1, 1)) * chartW;
    const y = PAD_Y + chartH - ((v - min) / range) * chartH;
    return { x, y };
  });

  const pathD = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");

  // Area fill
  const areaD = points.length > 1
    ? pathD +
      ` L ${points[points.length - 1].x.toFixed(1)} ${(PAD_Y + chartH).toFixed(1)}` +
      ` L ${points[0].x.toFixed(1)} ${(PAD_Y + chartH).toFixed(1)} Z`
    : "";

  const isProfit = netResult >= 0;
  const color = isProfit ? "#22c55e" : "#ef4444";
  const gradId = `sess-grad-${isProfit ? "g" : "r"}`;

  // Starting stack reference line Y
  const refY = PAD_Y + chartH - ((startingStack - min) / range) * chartH;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ maxWidth: 300, height: 100 }} preserveAspectRatio="xMidYMid meet">
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>

      {/* Starting stack reference line */}
      <line
        x1={PAD_X} y1={refY} x2={W - PAD_X} y2={refY}
        stroke="rgba(255,255,255,0.25)"
        strokeWidth="1"
        strokeDasharray="4 3"
      />
      <text x={W - PAD_X - 2} y={refY - 3} textAnchor="end" fill="rgba(255,255,255,0.35)" fontSize="7" fontFamily="monospace">
        start: {startingStack.toLocaleString()}
      </text>

      {/* Area fill */}
      {points.length > 1 && <path d={areaD} fill={`url(#${gradId})`} />}

      {/* Line */}
      {points.length > 1 && (
        <path
          d={pathD}
          fill="none"
          stroke={color}
          strokeWidth="1.5"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      )}

      {/* End dot */}
      {points.length > 0 && (
        <circle
          cx={points[points.length - 1].x}
          cy={points[points.length - 1].y}
          r="3"
          fill={color}
          stroke="rgba(0,0,0,0.5)"
          strokeWidth="1"
        />
      )}

      {/* X labels */}
      {stackHistory.length > 1 && (
        <>
          <text x={PAD_X} y={H - 1} fill="rgba(255,255,255,0.3)" fontSize="7" fontFamily="monospace">
            #{stackHistory[0].handNumber}
          </text>
          <text x={W - PAD_X} y={H - 1} fill="rgba(255,255,255,0.3)" fontSize="7" fontFamily="monospace" textAnchor="end">
            #{stackHistory[stackHistory.length - 1].handNumber}
          </text>
        </>
      )}
    </svg>
  );
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

  const [coaching, setCoaching] = useState<CoachingData | null>(null);
  const [coachingLoading, setCoachingLoading] = useState(true);
  const [expandedRec, setExpandedRec] = useState<number | null>(null);

  const [breakdown, setBreakdown] = useState<StatsBreakdown | null>(null);
  const [breakdownLoading, setBreakdownLoading] = useState(true);

  const [sessionHistory, setSessionHistory] = useState<SessionHistoryEntry[]>([]);
  const [sessionHistoryLoading, setSessionHistoryLoading] = useState(true);
  const [expandedSession, setExpandedSession] = useState<string | null>(null);

  const [sessionReport, setSessionReport] = useState<SessionReport | null>(null);
  const [sessionReportLoading, setSessionReportLoading] = useState(false);
  const [sessionReportError, setSessionReportError] = useState<string | null>(null);
  const [reportSections, setReportSections] = useState<Record<string, boolean>>({ positions: true, leaks: true, hands: true, recs: true });
  const [reportAbort, setReportAbort] = useState<AbortController | null>(null);

  const handleGenerateSessionReport = async () => {
    setSessionReportLoading(true);
    setSessionReportError(null);
    setSessionReport(null);
    const controller = new AbortController();
    setReportAbort(controller);
    const timeout = setTimeout(() => controller.abort(), 30000);
    try {
      const res = await fetch("/api/coaching/session-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        signal: controller.signal,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || "Failed to generate session report");
      }
      setSessionReport(await res.json());
    } catch (err: any) {
      if (err.name === "AbortError") {
        setSessionReportError("Report generation was cancelled or timed out (30s limit)");
      } else {
        setSessionReportError(err.message || "Failed to generate report");
      }
    } finally {
      clearTimeout(timeout);
      setSessionReportLoading(false);
      setReportAbort(null);
    }
  };

  const handleCancelReport = () => {
    if (reportAbort) reportAbort.abort();
  };

  const toggleReportSection = (key: string) => {
    setReportSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  useEffect(() => {
    async function loadSessionHistory() {
      try {
        const res = await fetch("/api/sessions/history?limit=10", { credentials: "include" });
        if (res.ok) setSessionHistory(await res.json());
      } catch {
        // silently ignore
      } finally {
        setSessionHistoryLoading(false);
      }
    }
    loadSessionHistory();
  }, []);

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

  useEffect(() => {
    async function loadBreakdown() {
      try {
        const res = await fetch("/api/stats/me/breakdown", { credentials: "include" });
        if (res.ok) setBreakdown(await res.json());
      } catch {
        // silently ignore
      } finally {
        setBreakdownLoading(false);
      }
    }
    loadBreakdown();
  }, []);

  useEffect(() => {
    async function loadCoaching() {
      try {
        const res = await fetch("/api/coaching/recommendations", { credentials: "include" });
        if (res.ok) setCoaching(await res.json());
      } catch {
        // silently ignore
      } finally {
        setCoachingLoading(false);
      }
    }
    loadCoaching();
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
            {/* Session Report (Premium) */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.01 }}
              className="rounded-xl bg-white/[0.03] backdrop-blur-xl border border-white/[0.06] overflow-hidden"
            >
              <div className="px-5 py-3.5 border-b border-[#c9a84c]/10 flex items-center gap-2">
                <FileText className="w-4 h-4 text-[#c9a84c]/80" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#c9a84c]/70">Session Report</h3>
                <span className="ml-auto text-[0.5625rem] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 font-bold border border-amber-500/30">PREMIUM</span>
              </div>
              <div className="px-5 py-4">
                {!sessionReport && !sessionReportLoading && (
                  <div className="text-center space-y-3">
                    <p className="text-xs text-gray-400">
                      Get a detailed AI analysis of your last 50 hands including positional breakdown, leak detection, and personalized recommendations.
                    </p>
                    <p className="text-[0.5625rem] text-gray-500">
                      Cost: 500 chips or free with Gold+
                    </p>
                    {sessionReportError && (
                      <div className="flex items-center gap-2 text-xs text-red-400 bg-red-500/10 rounded-lg px-3 py-2 border border-red-500/20">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                        {sessionReportError}
                      </div>
                    )}
                    <button
                      onClick={handleGenerateSessionReport}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#c9a84c]/20 text-[#c9a84c] text-xs font-bold border border-[#c9a84c]/30 hover:bg-[#c9a84c]/30 transition-colors"
                    >
                      <Brain className="w-3.5 h-3.5" />
                      Generate Session Report
                    </button>
                  </div>
                )}

                {sessionReportLoading && (
                  <div className="flex flex-col items-center gap-2 py-6">
                    <Loader2 className="w-6 h-6 animate-spin text-[#c9a84c]" />
                    <span className="text-xs text-gray-400">Analyzing your session...</span>
                    <button
                      onClick={handleCancelReport}
                      className="mt-1 px-3 py-1 rounded-lg text-[0.625rem] font-bold uppercase tracking-wider text-gray-400 bg-white/5 border border-white/10 hover:bg-white/10 hover:text-white transition-all"
                    >
                      Cancel
                    </button>
                  </div>
                )}

                {sessionReport && (
                  <div className="space-y-3">
                    {/* Summary */}
                    <div className="flex items-center gap-4 text-xs">
                      <div className="text-gray-400">
                        <span className="font-bold text-white">{sessionReport.handsAnalyzed}</span> hands analyzed
                      </div>
                      <div className={sessionReport.netResult >= 0 ? "text-green-400" : "text-red-400"}>
                        Net: <span className="font-bold">{sessionReport.netResult >= 0 ? "+" : ""}{sessionReport.netResult.toLocaleString()}</span> chips
                      </div>
                    </div>

                    {/* Positional Breakdown */}
                    <div>
                      <button onClick={() => toggleReportSection("positions")} className="w-full flex items-center justify-between py-2 text-left">
                        <span className="text-[0.5625rem] font-bold uppercase tracking-wider text-gray-400">Positional Breakdown</span>
                        {reportSections.positions ? <ChevronUp className="w-3 h-3 text-gray-500" /> : <ChevronDown className="w-3 h-3 text-gray-500" />}
                      </button>
                      {reportSections.positions && sessionReport.positionBreakdown.length > 0 && (
                        <div className="rounded-lg overflow-hidden border border-white/5">
                          <table className="w-full text-[0.5625rem]">
                            <thead>
                              <tr className="bg-white/[0.03]">
                                <th className="text-left px-3 py-1.5 text-gray-500 font-bold">Position</th>
                                <th className="text-right px-3 py-1.5 text-gray-500 font-bold">Hands</th>
                                <th className="text-right px-3 py-1.5 text-gray-500 font-bold">VPIP</th>
                                <th className="text-right px-3 py-1.5 text-gray-500 font-bold">Win%</th>
                              </tr>
                            </thead>
                            <tbody>
                              {sessionReport.positionBreakdown.map((p) => (
                                <tr key={p.position} className="border-t border-white/[0.03]">
                                  <td className="px-3 py-1.5 font-bold text-white">{p.position}</td>
                                  <td className="px-3 py-1.5 text-right text-gray-400">{p.hands}</td>
                                  <td className="px-3 py-1.5 text-right text-gray-400">{p.vpip}%</td>
                                  <td className="px-3 py-1.5 text-right" style={{ color: p.winRate >= 50 ? "#22c55e" : p.winRate >= 30 ? "#d4af37" : "#ef4444" }}>{p.winRate}%</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>

                    {/* Leaks */}
                    {sessionReport.leaks.length > 0 && (
                      <div>
                        <button onClick={() => toggleReportSection("leaks")} className="w-full flex items-center justify-between py-2 text-left">
                          <span className="text-[0.5625rem] font-bold uppercase tracking-wider text-gray-400">Leak Detection</span>
                          {reportSections.leaks ? <ChevronUp className="w-3 h-3 text-gray-500" /> : <ChevronDown className="w-3 h-3 text-gray-500" />}
                        </button>
                        {reportSections.leaks && (
                          <div className="space-y-2">
                            {sessionReport.leaks.map((leak, i) => (
                              <div key={i} className="rounded-lg px-3 py-2 bg-red-500/[0.06] border border-red-500/20">
                                <div className="flex items-start gap-2">
                                  <AlertTriangle className="w-3.5 h-3.5 text-red-400 mt-0.5 shrink-0" />
                                  <div>
                                    <div className="text-[0.5625rem] text-red-300">{leak.description}</div>
                                    <div className="text-[0.5rem] text-red-400/60 mt-0.5">-{leak.chipsLost.toLocaleString()} chips | {leak.frequency} occurrences</div>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Hand Rankings */}
                    <div>
                      <button onClick={() => toggleReportSection("hands")} className="w-full flex items-center justify-between py-2 text-left">
                        <span className="text-[0.5625rem] font-bold uppercase tracking-wider text-gray-400">Hand Rankings</span>
                        {reportSections.hands ? <ChevronUp className="w-3 h-3 text-gray-500" /> : <ChevronDown className="w-3 h-3 text-gray-500" />}
                      </button>
                      {reportSections.hands && (
                        <div className="grid grid-cols-2 gap-2">
                          {sessionReport.topWinningHands.length > 0 && (
                            <div className="rounded-lg px-3 py-2 bg-green-500/[0.06] border border-green-500/20">
                              <div className="text-[0.5rem] font-bold text-green-400/60 uppercase mb-1">Top Winners</div>
                              {sessionReport.topWinningHands.map((h, i) => (
                                <div key={i} className="text-[0.5625rem] text-green-300 font-mono">{h}</div>
                              ))}
                            </div>
                          )}
                          {sessionReport.topLosingHands.length > 0 && (
                            <div className="rounded-lg px-3 py-2 bg-red-500/[0.06] border border-red-500/20">
                              <div className="text-[0.5rem] font-bold text-red-400/60 uppercase mb-1">Top Losers</div>
                              {sessionReport.topLosingHands.map((h, i) => (
                                <div key={i} className="text-[0.5625rem] text-red-300 font-mono">{h}</div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Recommendations */}
                    <div>
                      <button onClick={() => toggleReportSection("recs")} className="w-full flex items-center justify-between py-2 text-left">
                        <span className="text-[0.5625rem] font-bold uppercase tracking-wider text-gray-400">Recommendations</span>
                        {reportSections.recs ? <ChevronUp className="w-3 h-3 text-gray-500" /> : <ChevronDown className="w-3 h-3 text-gray-500" />}
                      </button>
                      {reportSections.recs && (
                        <div className="space-y-1.5">
                          {sessionReport.recommendations.map((rec, i) => (
                            <div key={i} className="flex items-start gap-2 text-[0.5625rem] text-gray-300">
                              <CheckCircle2 className="w-3 h-3 text-[#c9a84c] mt-0.5 shrink-0" />
                              <span>{rec}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Regenerate */}
                    <button
                      onClick={handleGenerateSessionReport}
                      className="text-[0.5625rem] text-gray-500 hover:text-gray-300 transition-colors"
                    >
                      Regenerate report
                    </button>
                  </div>
                )}
              </div>
            </motion.div>

            {/* Play Style Coach */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.02 }}
              className="rounded-xl bg-white/[0.03] backdrop-blur-xl border border-white/[0.06] overflow-hidden"
            >
              <div className="px-5 py-3.5 border-b border-[#c9a84c]/10 flex items-center gap-2">
                <Zap className="w-4 h-4 text-[#c9a84c]/80" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#c9a84c]/70">Play Style Coach</h3>
              </div>
              <div className="p-5">
                {coachingLoading ? (
                  <div className="flex items-center justify-center py-10">
                    <Loader2 className="w-5 h-5 animate-spin text-primary/60" />
                    <span className="ml-2 text-xs text-gray-500">Analyzing your play style...</span>
                  </div>
                ) : !coaching ? (
                  <div className="flex flex-col items-center justify-center py-10 text-center">
                    <Brain className="w-7 h-7 text-gray-500/40 mb-2" />
                    <p className="text-xs text-gray-500">Could not load coaching data.</p>
                  </div>
                ) : coaching.stats.handsPlayed < 100 ? (
                  <div className="flex flex-col items-center justify-center py-6 text-center">
                    <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4 bg-amber-500/10 border border-amber-500/15">
                      <Gamepad2 className="w-7 h-7 text-amber-400/60" />
                    </div>
                    <h4 className="text-sm font-bold text-white/80 mb-1">Play More Hands</h4>
                    <p className="text-xs text-gray-500 max-w-xs mb-4">
                      We need at least 100 hands for meaningful recommendations. You have played {coaching.stats.handsPlayed} so far.
                    </p>
                    <div className="w-full max-w-xs">
                      <div className="flex justify-between text-[0.5625rem] text-gray-500 mb-1">
                        <span>{coaching.stats.handsPlayed} hands</span>
                        <span>100 needed</span>
                      </div>
                      <div className="h-2.5 bg-white/5 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-amber-500 to-[#d4af37] transition-all duration-500"
                          style={{ width: `${Math.min((coaching.stats.handsPlayed / 100) * 100, 100)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-5">
                    <div className="flex flex-col sm:flex-row items-center gap-5">
                      <div className={`px-5 py-3 rounded-xl text-center border ${
                        coaching.overallRating === "Tight-Aggressive"
                          ? "bg-green-500/10 border-green-500/25 text-green-400"
                          : coaching.overallRating === "Loose-Aggressive"
                          ? "bg-amber-500/10 border-amber-500/25 text-amber-400"
                          : coaching.overallRating === "Loose-Passive"
                          ? "bg-red-500/10 border-red-500/25 text-red-400"
                          : "bg-blue-500/10 border-blue-500/25 text-blue-400"
                      }`}>
                        <div className="text-[0.5625rem] uppercase tracking-wider opacity-70 mb-1">Play Style</div>
                        <div className="text-lg font-bold tracking-tight">{coaching.overallRating}</div>
                        <div className="text-[0.5625rem] opacity-60 mt-0.5">{coaching.handsAnalyzed} hands analyzed</div>
                      </div>

                      <div className="flex-1 flex flex-col items-center">
                        <div className="relative w-24 h-24">
                          <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                            <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="8" />
                            <circle
                              cx="50" cy="50" r="42" fill="none"
                              stroke={coaching.score >= 70 ? "#22c55e" : coaching.score >= 40 ? "#d4af37" : "#ef4444"}
                              strokeWidth="8"
                              strokeLinecap="round"
                              strokeDasharray={`${(coaching.score / 100) * 264} 264`}
                            />
                          </svg>
                          <div className="absolute inset-0 flex flex-col items-center justify-center">
                            <span className="text-2xl font-bold" style={{ color: coaching.score >= 70 ? "#22c55e" : coaching.score >= 40 ? "#d4af37" : "#ef4444" }}>
                              {coaching.score}
                            </span>
                            <span className="text-[0.5rem] text-gray-500 uppercase tracking-wider">Score</span>
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-center">
                        {[
                          { label: "VPIP", value: `${coaching.stats.vpip}%` },
                          { label: "PFR", value: `${coaching.stats.pfr}%` },
                          { label: "SD%", value: `${coaching.stats.showdownPct}%` },
                          { label: "Win%", value: `${coaching.stats.winRate}%` },
                        ].map((s) => (
                          <div key={s.label} className="px-3 py-2 rounded-lg bg-white/[0.03] border border-white/[0.06]">
                            <div className="text-[0.5625rem] text-gray-500 uppercase tracking-wider">{s.label}</div>
                            <div className="text-sm font-bold text-[#d4af37]">{s.value}</div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {coaching.recommendations.length > 0 && (
                      <div className="space-y-2">
                        <h4 className="text-[0.625rem] font-bold uppercase tracking-wider text-gray-400 mb-2">Recommendations</h4>
                        {coaching.recommendations.map((rec, i) => {
                          const isExpanded = expandedRec === i;
                          const severityConfig = rec.severity === "good"
                            ? { icon: CheckCircle2, bg: "bg-green-500/10", border: "border-green-500/20", text: "text-green-400", iconColor: "text-green-400" }
                            : rec.severity === "critical"
                            ? { icon: XCircle, bg: "bg-red-500/10", border: "border-red-500/20", text: "text-red-400", iconColor: "text-red-400" }
                            : { icon: AlertTriangle, bg: "bg-amber-500/10", border: "border-amber-500/20", text: "text-amber-400", iconColor: "text-amber-400" };
                          const SeverityIcon = severityConfig.icon;
                          return (
                            <motion.div
                              key={i}
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: 0.05 * i }}
                              className={`rounded-lg border ${severityConfig.border} ${severityConfig.bg} overflow-hidden cursor-pointer`}
                              onClick={() => setExpandedRec(isExpanded ? null : i)}
                            >
                              <div className="flex items-center justify-between px-4 py-3">
                                <div className="flex items-center gap-3">
                                  <SeverityIcon className={`w-4 h-4 ${severityConfig.iconColor}`} />
                                  <div>
                                    <span className="text-xs font-bold text-white/80">{rec.title}</span>
                                    <span className="ml-2 text-[0.5625rem] text-gray-500 uppercase tracking-wider">{rec.category}</span>
                                  </div>
                                </div>
                                {isExpanded
                                  ? <ChevronUp className="w-3.5 h-3.5 text-gray-500" />
                                  : <ChevronDown className="w-3.5 h-3.5 text-gray-500" />
                                }
                              </div>
                              {isExpanded && (
                                <div className="px-4 pb-3 pt-0">
                                  <p className={`text-xs leading-relaxed ${severityConfig.text} opacity-80`}>{rec.detail}</p>
                                </div>
                              )}
                            </motion.div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </motion.div>

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
                    className="rounded-xl bg-white/[0.03] backdrop-blur-xl border border-white/[0.06] p-4 relative overflow-hidden"
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
              className="rounded-xl bg-white/[0.03] backdrop-blur-xl border border-white/[0.06] overflow-hidden"
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

            {/* Performance by Game Type */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.17 }}
              className="rounded-xl bg-white/[0.03] backdrop-blur-xl border border-white/[0.06] overflow-hidden"
            >
              <div className="px-5 py-3.5 border-b border-[#c9a84c]/10 flex items-center gap-2">
                <PieChart className="w-4 h-4 text-[#c9a84c]/80" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#c9a84c]/70">Performance by Game Type</h3>
              </div>
              <div className="p-5 space-y-5">
                {breakdownLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-5 h-5 animate-spin text-primary/60" />
                    <span className="ml-2 text-xs text-gray-500">Loading breakdown...</span>
                  </div>
                ) : breakdown ? (
                  <>
                    {/* By Variant */}
                    <div>
                      <div className="text-[0.625rem] font-bold uppercase tracking-wider text-gray-400 mb-3">By Variant</div>
                      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                        {(() => {
                          const variantLabels: Record<string, string> = { nlhe: "NLHE", plo: "PLO", plo5: "PLO-5", short_deck: "Short Deck" };
                          const entries = Object.entries(breakdown.byVariant);
                          const maxHands = Math.max(...entries.map(([, g]) => g.handsPlayed), 1);
                          return entries.map(([key, g]) => {
                            const isEmpty = g.handsPlayed === 0;
                            return (
                              <div
                                key={key}
                                className={`p-3 rounded-lg border transition-colors ${
                                  isEmpty
                                    ? "bg-white/[0.02] border-white/[0.05] opacity-50"
                                    : "bg-white/[0.04] border-white/[0.08] hover:bg-white/[0.06]"
                                }`}
                              >
                                <div className="text-xs font-bold text-white/90 mb-2">{variantLabels[key] || key.toUpperCase()}</div>
                                {isEmpty ? (
                                  <div className="text-[0.5625rem] text-gray-500 italic">No hands yet</div>
                                ) : (
                                  <>
                                    <div className="text-[0.5625rem] text-gray-400 mb-1">{g.handsPlayed} hands played</div>
                                    <div className={`text-sm font-bold ${g.winRate >= 25 ? "text-green-400" : g.winRate >= 15 ? "text-amber-400" : "text-red-400"}`}>
                                      {g.winRate}% win rate
                                    </div>
                                    <div className={`text-xs font-bold mt-1 ${g.netResult >= 0 ? "text-green-400" : "text-red-400"}`}>
                                      {g.netResult >= 0 ? "+" : ""}{g.netResult.toLocaleString()} chips
                                    </div>
                                    <div className="mt-2 h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                                      <div
                                        className="h-full rounded-full bg-gradient-to-r from-[#c9a84c] to-[#d4af37]"
                                        style={{ width: `${(g.handsPlayed / maxHands) * 100}%` }}
                                      />
                                    </div>
                                  </>
                                )}
                              </div>
                            );
                          });
                        })()}
                      </div>
                    </div>

                    {/* By Format */}
                    <div>
                      <div className="text-[0.625rem] font-bold uppercase tracking-wider text-gray-400 mb-3">By Format</div>
                      <div className="grid grid-cols-3 gap-3">
                        {(() => {
                          const formatLabels: Record<string, string> = { cash: "Cash Game", sng: "SNG", tournament: "Tournament" };
                          const entries = Object.entries(breakdown.byFormat);
                          const maxHands = Math.max(...entries.map(([, g]) => g.handsPlayed), 1);
                          return entries.map(([key, g]) => {
                            const isEmpty = g.handsPlayed === 0;
                            return (
                              <div
                                key={key}
                                className={`p-3 rounded-lg border transition-colors ${
                                  isEmpty
                                    ? "bg-white/[0.02] border-white/[0.05] opacity-50"
                                    : "bg-white/[0.04] border-white/[0.08] hover:bg-white/[0.06]"
                                }`}
                              >
                                <div className="text-xs font-bold text-white/90 mb-2">{formatLabels[key] || key}</div>
                                {isEmpty ? (
                                  <div className="text-[0.5625rem] text-gray-500 italic">No hands yet</div>
                                ) : (
                                  <>
                                    <div className="text-[0.5625rem] text-gray-400 mb-1">{g.handsPlayed} hands played</div>
                                    <div className={`text-sm font-bold ${g.winRate >= 25 ? "text-green-400" : g.winRate >= 15 ? "text-amber-400" : "text-red-400"}`}>
                                      {g.winRate}% win rate
                                    </div>
                                    <div className={`text-xs font-bold mt-1 ${g.netResult >= 0 ? "text-green-400" : "text-red-400"}`}>
                                      {g.netResult >= 0 ? "+" : ""}{g.netResult.toLocaleString()} chips
                                    </div>
                                    <div className="mt-2 h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                                      <div
                                        className="h-full rounded-full bg-gradient-to-r from-[#c9a84c] to-[#d4af37]"
                                        style={{ width: `${(g.handsPlayed / maxHands) * 100}%` }}
                                      />
                                    </div>
                                  </>
                                )}
                              </div>
                            );
                          });
                        })()}
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <PieChart className="w-7 h-7 text-gray-500/40 mb-2" />
                    <p className="text-xs text-gray-500">Could not load game type breakdown</p>
                  </div>
                )}
              </div>
            </motion.div>

            {/* Advanced Stats Grid */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="rounded-xl bg-white/[0.03] backdrop-blur-xl border border-white/[0.06] overflow-hidden"
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
              className="rounded-xl bg-white/[0.03] backdrop-blur-xl border border-white/[0.06] overflow-hidden"
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
                    className="rounded-xl bg-white/[0.03] backdrop-blur-xl border border-white/[0.06] overflow-hidden"
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
                    className="rounded-xl bg-white/[0.03] backdrop-blur-xl border border-white/[0.06] overflow-hidden"
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
                  className="rounded-xl bg-white/[0.03] backdrop-blur-xl border border-white/[0.06] overflow-hidden"
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
              className="rounded-xl bg-white/[0.03] backdrop-blur-xl border border-white/[0.06] overflow-hidden"
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

            {/* ── Session History ──────────────────────────────────────────── */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="rounded-2xl bg-white/[0.03] backdrop-blur-xl border border-white/[0.06] overflow-hidden"
            >
              <div className="px-5 py-3.5 border-b border-[#c9a84c]/10 flex items-center gap-2">
                <Activity className="w-4 h-4 text-[#c9a84c]/80" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#c9a84c]/70">Session History</h3>
              </div>

              {sessionHistoryLoading ? (
                <div className="p-6 space-y-3">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="animate-pulse flex items-center gap-4">
                      <div className="h-10 w-full rounded-lg bg-white/[0.04]" />
                    </div>
                  ))}
                </div>
              ) : sessionHistory.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-3 bg-blue-500/10 border border-blue-500/15">
                    <Activity className="w-6 h-6 text-blue-400/40" />
                  </div>
                  <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-1">No Sessions Yet</h3>
                  <p className="text-xs text-muted-foreground/60 max-w-xs">
                    Play some hands to see your session history
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-white/[0.03]">
                  {sessionHistory.map((session) => {
                    const isExpanded = expandedSession === session.sessionId;
                    const isProfit = session.netResult >= 0;
                    const startDate = new Date(session.startTime);
                    const endDate = new Date(session.endTime);
                    const durationMs = endDate.getTime() - startDate.getTime();
                    const durationMin = Math.round(durationMs / 60000);
                    const durationStr = durationMin < 60
                      ? `${durationMin}m`
                      : `${Math.floor(durationMin / 60)}h ${durationMin % 60}m`;

                    return (
                      <div key={session.sessionId}>
                        <button
                          onClick={() => setExpandedSession(isExpanded ? null : session.sessionId)}
                          className="w-full px-5 py-3 flex items-center justify-between hover:bg-white/[0.02] transition-colors text-left"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div
                              className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                              style={{
                                background: isProfit ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)",
                                border: `1px solid ${isProfit ? "rgba(34,197,94,0.2)" : "rgba(239,68,68,0.2)"}`,
                              }}
                            >
                              {isProfit ? (
                                <ArrowUpRight className="w-4 h-4 text-green-400" />
                              ) : (
                                <ArrowDownRight className="w-4 h-4 text-red-400" />
                              )}
                            </div>
                            <div className="min-w-0">
                              <div className="text-xs font-bold text-white/80 truncate">
                                {session.tableName}
                              </div>
                              <div className="text-[0.5625rem] text-gray-500 flex items-center gap-2">
                                <span>{startDate.toLocaleDateString()}</span>
                                <span className="text-gray-600">|</span>
                                <span>{durationStr}</span>
                                <span className="text-gray-600">|</span>
                                <span>{session.handsPlayed} hands</span>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <span
                              className="text-sm font-bold tabular-nums"
                              style={{ color: isProfit ? "#22c55e" : "#ef4444" }}
                            >
                              {isProfit ? "+" : ""}{session.netResult.toLocaleString()}
                            </span>
                            {isExpanded ? (
                              <ChevronUp className="w-3.5 h-3.5 text-gray-500" />
                            ) : (
                              <ChevronDown className="w-3.5 h-3.5 text-gray-500" />
                            )}
                          </div>
                        </button>

                        {isExpanded && (
                          <div className="px-5 pb-4">
                            <div className="rounded-lg p-3" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)" }}>
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-[0.5625rem] text-gray-500 uppercase tracking-wider">Stack over time</span>
                                <div className="flex items-center gap-3 text-[0.5625rem] text-gray-500">
                                  <span>Start: {session.startingStack.toLocaleString()}</span>
                                  <span>End: {session.endingStack.toLocaleString()}</span>
                                </div>
                              </div>
                              <SessionStackChart
                                stackHistory={session.stackHistory}
                                startingStack={session.startingStack}
                                netResult={session.netResult}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </motion.div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
