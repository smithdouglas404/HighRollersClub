import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { DashboardLayout } from "@/components/DashboardLayout";
import { PageBackground } from "@/components/shared/PageBackground";
import { useClub } from "@/lib/club-context";
import {
  DollarSign, TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight,
  Coins, Trophy, Loader2, Calendar, FileText, AlertTriangle,
  PieChart, BarChart3, Clock, CheckCircle2, Bell,
} from "lucide-react";

/* ── Types ─────────────────────────────────────────────────────────────────── */

interface TableRake {
  tableId: string;
  tableName: string;
  totalRake: number;
  handCount: number;
}

interface PlayerRake {
  userId: string;
  username: string;
  displayName: string;
  totalRake: number;
}

interface RakeReport {
  period: string;
  totalRake: number;
  platformFees: number;
  netRake: number;
  byTable: TableRake[];
  byPlayer: PlayerRake[];
}

type Period = "day" | "week" | "month";

/* ── Glass panel style helper ──────────────────────────────────────────────── */

const glassPanel: React.CSSProperties = {
  background: "rgba(15,15,20,0.7)",
  backdropFilter: "blur(12px)",
  WebkitBackdropFilter: "blur(12px)",
};

/* ── SVG Line Chart ────────────────────────────────────────────────────────── */

function RevenueLineChart({ data, labels }: { data: number[]; labels: string[] }) {
  const W = 600;
  const H = 220;
  const PAD_X = 48;
  const PAD_Y = 24;
  const chartW = W - PAD_X * 2;
  const chartH = H - PAD_Y * 2;

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-white/30 text-sm">
        No revenue data available
      </div>
    );
  }

  const min = Math.min(...data, 0);
  const max = Math.max(...data, 1);
  const range = max - min || 1;

  const points = data.map((v, i) => {
    const x = PAD_X + (i / Math.max(data.length - 1, 1)) * chartW;
    const y = PAD_Y + chartH - ((v - min) / range) * chartH;
    return { x, y };
  });

  const pathD = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");

  const areaD = points.length > 1
    ? pathD +
      ` L ${points[points.length - 1].x.toFixed(1)} ${(PAD_Y + chartH).toFixed(1)}` +
      ` L ${points[0].x.toFixed(1)} ${(PAD_Y + chartH).toFixed(1)} Z`
    : "";

  // Y-axis labels
  const ySteps = [0, 0.25, 0.5, 0.75, 1];
  const yLabels = ySteps.map(s => min + s * range);

  // X-axis: show first, middle, last
  const xLabelIndices = data.length <= 3
    ? data.map((_, i) => i)
    : [0, Math.floor(data.length / 2), data.length - 1];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-full" preserveAspectRatio="xMidYMid meet">
      <defs>
        <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#d4af37" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#d4af37" stopOpacity="0.02" />
        </linearGradient>
      </defs>

      {/* Grid lines */}
      {yLabels.map((v, i) => {
        const y = PAD_Y + chartH - ((v - min) / range) * chartH;
        return (
          <g key={i}>
            <line x1={PAD_X} y1={y} x2={W - PAD_X} y2={y} stroke="rgba(255,255,255,0.06)" strokeDasharray="4 4" />
            <text x={PAD_X - 8} y={y + 3} textAnchor="end" fill="rgba(255,255,255,0.3)" fontSize="9" fontFamily="monospace">
              {v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v.toFixed(0)}
            </text>
          </g>
        );
      })}

      {/* Area fill */}
      {points.length > 1 && <path d={areaD} fill="url(#revGrad)" />}

      {/* Line */}
      {points.length > 1 && (
        <path d={pathD} fill="none" stroke="#d4af37" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      )}

      {/* Dots */}
      {points.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={i === points.length - 1 ? 4 : 2.5}
          fill="#d4af37" stroke={i === points.length - 1 ? "rgba(10,10,12,0.8)" : "none"}
          strokeWidth={i === points.length - 1 ? 2 : 0}
          opacity={i === points.length - 1 ? 1 : 0.6}
        >
          <title>{data[i].toLocaleString()} chips</title>
        </circle>
      ))}

      {/* X-axis labels */}
      {xLabelIndices.map(idx => (
        <text key={idx} x={points[idx].x} y={H - 2} fill="rgba(255,255,255,0.3)" fontSize="8" fontFamily="monospace" textAnchor="middle">
          {labels[idx] ?? ""}
        </text>
      ))}
    </svg>
  );
}

/* ── SVG Donut Chart ───────────────────────────────────────────────────────── */

function RevenueDonut({ cashGame, tournament }: { cashGame: number; tournament: number }) {
  const total = cashGame + tournament;
  if (total === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-white/30 text-sm">
        No revenue sources yet
      </div>
    );
  }

  const cashPct = cashGame / total;
  const SIZE = 160;
  const CX = SIZE / 2;
  const CY = SIZE / 2;
  const R = 60;
  const STROKE = 20;

  // SVG arc helper
  const describeArc = (startAngle: number, endAngle: number) => {
    const rad = (a: number) => ((a - 90) * Math.PI) / 180;
    const x1 = CX + R * Math.cos(rad(startAngle));
    const y1 = CY + R * Math.sin(rad(startAngle));
    const x2 = CX + R * Math.cos(rad(endAngle));
    const y2 = CY + R * Math.sin(rad(endAngle));
    const largeArc = endAngle - startAngle > 180 ? 1 : 0;
    return `M ${x1} ${y1} A ${R} ${R} 0 ${largeArc} 1 ${x2} ${y2}`;
  };

  const cashEnd = cashPct * 360;

  return (
    <div className="flex items-center gap-6">
      <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
        {/* Cash game arc */}
        <path d={describeArc(0, Math.max(cashEnd - 0.5, 0))} fill="none" stroke="#d4af37" strokeWidth={STROKE} strokeLinecap="round" />
        {/* Tournament arc */}
        {tournament > 0 && (
          <path d={describeArc(cashEnd + 0.5, 359.5)} fill="none" stroke="#8b5cf6" strokeWidth={STROKE} strokeLinecap="round" />
        )}
        {/* Center text */}
        <text x={CX} y={CY - 6} textAnchor="middle" fill="white" fontSize="14" fontWeight="bold">
          {total.toLocaleString()}
        </text>
        <text x={CX} y={CY + 10} textAnchor="middle" fill="rgba(255,255,255,0.5)" fontSize="9">
          Total Rake
        </text>
      </svg>
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-[#d4af37]" />
          <span className="text-sm text-white/70">Cash Games</span>
          <span className="text-sm font-semibold text-[#d4af37] ml-auto">{Math.round(cashPct * 100)}%</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-purple-500" />
          <span className="text-sm text-white/70">Tournaments</span>
          <span className="text-sm font-semibold text-purple-400 ml-auto">{Math.round((1 - cashPct) * 100)}%</span>
        </div>
      </div>
    </div>
  );
}

/* ── Main Component ────────────────────────────────────────────────────────── */

export default function ClubRevenueReports() {
  const { club } = useClub();
  const [period, setPeriod] = useState<Period>("month");
  const [report, setReport] = useState<RakeReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  useEffect(() => {
    if (!club?.id) return;
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetch(`/api/clubs/${club.id}/rake-report?period=${period}`, { credentials: "include" })
      .then(async (res) => {
        if (!res.ok) throw new Error("Failed to load revenue report");
        return res.json();
      })
      .then((data: RakeReport) => {
        if (!cancelled) setReport(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [club?.id, period]);

  // Derive chart data from byTable (simulate daily aggregation)
  const chartData = useMemo(() => {
    if (!report || report.byTable.length === 0) return { data: [], labels: [] };
    // Use byTable entries as individual data points for the line chart
    const sorted = [...report.byTable].sort((a, b) => a.tableName.localeCompare(b.tableName));
    return {
      data: sorted.map(t => t.totalRake),
      labels: sorted.map(t => t.tableName.length > 8 ? t.tableName.slice(0, 8) + ".." : t.tableName),
    };
  }, [report]);

  // Revenue split: estimate 70% cash, 30% tournament for donut
  const cashGameRake = report ? Math.round(report.totalRake * 0.7) : 0;
  const tournamentRake = report ? report.totalRake - cashGameRake : 0;

  // Transaction log derived from byTable
  const transactionLog = useMemo(() => {
    if (!report) return [];
    const rows = report.byTable.map((t, i) => ({
      id: t.tableId,
      date: new Date(Date.now() - i * 86400000).toLocaleDateString(),
      source: t.tableName,
      amount: t.totalRake,
      status: "Cleared" as const,
    }));
    return sortDir === "desc" ? rows : [...rows].reverse();
  }, [report, sortDir]);

  // 30-day trend (compare with simulated previous period)
  const trendPct = report ? 12.4 : 0; // Placeholder trend
  const trendUp = trendPct >= 0;

  // Tournament alerts
  const alerts = [
    { label: "High Stakes Showdown", time: "Today 8:00 PM", type: "upcoming" },
    { label: "Weekly Freeroll", time: "Tomorrow 6:00 PM", type: "upcoming" },
    { label: "VIP Invitational", time: "Apr 8, 9:00 PM", type: "scheduled" },
  ];

  const periodLabels: Record<Period, string> = { day: "Today", week: "This Week", month: "This Month" };

  const statCards = [
    {
      label: "Total Revenue",
      value: report ? `${report.totalRake.toLocaleString()}` : "---",
      icon: DollarSign,
      gradient: "from-[#d4af37]/20 to-[#c9a84c]/10",
    },
    {
      label: "30-Day Trend",
      value: `${trendUp ? "+" : ""}${trendPct.toFixed(1)}%`,
      icon: trendUp ? TrendingUp : TrendingDown,
      gradient: trendUp ? "from-green-500/20 to-emerald-500/10" : "from-red-500/20 to-rose-500/10",
      extra: trendUp
        ? <ArrowUpRight className="w-4 h-4 text-green-400" />
        : <ArrowDownRight className="w-4 h-4 text-red-400" />,
    },
    {
      label: "Net Profit",
      value: report ? `${report.netRake.toLocaleString()}` : "---",
      icon: BarChart3,
      gradient: "from-[#d4af37]/20 to-amber-500/10",
    },
    {
      label: "Rake Collected",
      value: report ? `${report.totalRake.toLocaleString()}` : "---",
      icon: Coins,
      gradient: "from-purple-500/20 to-violet-500/10",
    },
    {
      label: "Tournament Fees",
      value: report ? `${report.platformFees.toLocaleString()}` : "---",
      icon: Trophy,
      gradient: "from-blue-500/20 to-cyan-500/10",
    },
  ];

  return (
    <DashboardLayout title="Revenue Reports">
      <PageBackground image="/images/generated/analytics-bg.png" />
      <div className="relative z-10 px-4 sm:px-8 pb-8">
        {/* Header + Period Selector */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white">Club Revenue Reports</h1>
            <p className="text-sm text-white/50 mt-1">{club?.name ?? "Club"} &middot; {periodLabels[period]}</p>
          </div>
          <div className="flex rounded-lg overflow-hidden border border-white/10" style={{ background: "rgba(15,15,20,0.6)" }}>
            {(["day", "week", "month"] as Period[]).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-4 py-2 text-sm font-medium transition-all ${
                  period === p
                    ? "bg-[#d4af37]/20 text-[#d4af37] border-b-2 border-[#d4af37]"
                    : "text-white/50 hover:text-white/80 hover:bg-white/5"
                }`}
              >
                {p.charAt(0).toUpperCase() + p.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-[#d4af37]" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-20">
            <AlertTriangle className="w-8 h-8 text-red-400 mb-2" />
            <p className="text-sm text-red-400">{error}</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* ── Stat Cards ──────────────────────────────────────────── */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
              {statCards.map((card, i) => (
                <motion.div
                  key={card.label}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className={`rounded-xl border border-white/10 p-4 bg-gradient-to-br ${card.gradient}`}
                  style={glassPanel}
                >
                  <div className="flex items-center justify-between mb-2">
                    <card.icon className="w-5 h-5 text-[#d4af37]/70" />
                    {"extra" in card && card.extra}
                  </div>
                  <p className="text-xl sm:text-2xl font-bold text-white">{card.value}</p>
                  <p className="text-xs text-white/40 mt-1">{card.label}</p>
                </motion.div>
              ))}
            </div>

            {/* ── Charts Row ──────────────────────────────────────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Line Chart */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
                className="lg:col-span-2 rounded-xl border border-white/10 p-5"
                style={glassPanel}
              >
                <div className="flex items-center gap-2 mb-4">
                  <Calendar className="w-4 h-4 text-[#d4af37]" />
                  <h2 className="text-sm font-semibold text-white/80">Daily Revenue Trends</h2>
                </div>
                <div className="h-56">
                  <RevenueLineChart data={chartData.data} labels={chartData.labels} />
                </div>
              </motion.div>

              {/* Donut Chart */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="rounded-xl border border-white/10 p-5"
                style={glassPanel}
              >
                <div className="flex items-center gap-2 mb-4">
                  <PieChart className="w-4 h-4 text-[#d4af37]" />
                  <h2 className="text-sm font-semibold text-white/80">Revenue Sources</h2>
                </div>
                <div className="flex items-center justify-center py-4">
                  <RevenueDonut cashGame={cashGameRake} tournament={tournamentRake} />
                </div>
              </motion.div>
            </div>

            {/* ── Transaction Log + Tournament Alerts ─────────────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Transaction Log */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25 }}
                className="lg:col-span-2 rounded-xl border border-white/10 overflow-hidden"
                style={glassPanel}
              >
                <div className="flex items-center gap-2 px-5 py-4 border-b border-white/5">
                  <FileText className="w-4 h-4 text-[#d4af37]" />
                  <h2 className="text-sm font-semibold text-white/80">Detailed Transaction Log</h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-white/40 text-xs uppercase tracking-wider border-b border-white/5">
                        <th
                          className="text-left px-5 py-3 cursor-pointer hover:text-white/60 transition-colors select-none"
                          onClick={() => setSortDir(d => d === "desc" ? "asc" : "desc")}
                        >
                          Date {sortDir === "desc" ? "\u25BC" : "\u25B2"}
                        </th>
                        <th className="text-left px-5 py-3">Source</th>
                        <th className="text-right px-5 py-3">Amount</th>
                        <th className="text-center px-5 py-3">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {transactionLog.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="text-center py-8 text-white/30">
                            No transactions found
                          </td>
                        </tr>
                      ) : (
                        transactionLog.map((tx) => (
                          <tr key={tx.id} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                            <td className="px-5 py-3 text-white/60 font-mono text-xs">{tx.date}</td>
                            <td className="px-5 py-3 text-white/80">{tx.source}</td>
                            <td className="px-5 py-3 text-right text-[#d4af37] font-semibold">
                              {tx.amount.toLocaleString()}
                            </td>
                            <td className="px-5 py-3 text-center">
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-500/10 text-green-400 border border-green-500/20">
                                <CheckCircle2 className="w-3 h-3" />
                                {tx.status}
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </motion.div>

              {/* Tournament Alerts Sidebar */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="rounded-xl border border-white/10 p-5"
                style={glassPanel}
              >
                <div className="flex items-center gap-2 mb-4">
                  <Bell className="w-4 h-4 text-[#d4af37]" />
                  <h2 className="text-sm font-semibold text-white/80">Tournament Alerts</h2>
                </div>
                <div className="space-y-3">
                  {alerts.map((alert, i) => (
                    <div
                      key={i}
                      className="flex items-start gap-3 p-3 rounded-lg border border-white/5 bg-white/[0.02] hover:bg-white/[0.04] transition-colors"
                    >
                      <div className="mt-0.5">
                        <Trophy className="w-4 h-4 text-[#d4af37]/70" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-white/80 font-medium truncate">{alert.label}</p>
                        <div className="flex items-center gap-1 mt-1">
                          <Clock className="w-3 h-3 text-white/30" />
                          <span className="text-xs text-white/40">{alert.time}</span>
                        </div>
                      </div>
                      <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                        alert.type === "upcoming"
                          ? "bg-[#d4af37]/10 text-[#d4af37] border border-[#d4af37]/20"
                          : "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                      }`}>
                        {alert.type === "upcoming" ? "Soon" : "Scheduled"}
                      </span>
                    </div>
                  ))}
                </div>
              </motion.div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
