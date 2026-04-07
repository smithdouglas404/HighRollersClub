import { useState, useEffect, useMemo } from "react";
import { GoldButton, GoldCard, SectionHeader } from "@/components/premium/PremiumComponents";
import { motion } from "framer-motion";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useAuth } from "@/lib/auth-context";
import { useClub } from "@/lib/club-context";
import {
  DollarSign, Repeat, Percent, Trophy,
  Users, Clock, Layers, FileDown,
  CheckCircle2, BarChart3, Calendar,
  Hash, TrendingUp, Award
} from "lucide-react";

/* ── Types ──────────────────────────────────────────────────────────────── */

interface PayoutEntry {
  position: number;
  percentage: number;
  chipValue: number;
}

interface TournamentAnalyticsData {
  totalBuyIn: number;
  rebuysAddons: number;
  clubRake: number;
  netPrizePool: number;
  payouts: PayoutEntry[];
  playersRemaining: number;
  totalEntries: number;
  startDate: string;
  totalHandsPlayed: number;
  averageStack: number;
  blindLevel: number;
  status: "running" | "completed" | "pending";
  tournamentName: string;
}

/* ── Placeholder Data ───────────────────────────────────────────────────── */

const PLACEHOLDER: TournamentAnalyticsData = {
  totalBuyIn: 125000,
  rebuysAddons: 34500,
  clubRake: 7975,
  netPrizePool: 151525,
  payouts: [
    { position: 1, percentage: 30, chipValue: 45457 },
    { position: 2, percentage: 20, chipValue: 30305 },
    { position: 3, percentage: 14, chipValue: 21213 },
    { position: 4, percentage: 10, chipValue: 15152 },
    { position: 5, percentage: 8, chipValue: 12122 },
    { position: 6, percentage: 6, chipValue: 9091 },
    { position: 7, percentage: 4.5, chipValue: 6818 },
    { position: 8, percentage: 3.5, chipValue: 5303 },
    { position: 9, percentage: 2.5, chipValue: 3788 },
    { position: 10, percentage: 1.5, chipValue: 2272 },
  ],
  playersRemaining: 23,
  totalEntries: 50,
  startDate: "2026-04-03T19:00:00Z",
  totalHandsPlayed: 847,
  averageStack: 54500,
  blindLevel: 12,
  status: "running",
  tournamentName: "Friday Night Championship",
};

/* ── Pie Chart Colors ───────────────────────────────────────────────────── */

const PIE_COLORS = [
  "#d4af37", "#22d3ee", "#a78bfa", "#f472b6", "#34d399",
  "#fb923c", "#60a5fa", "#e879f9", "#facc15", "#94a3b8",
];

/* ── SVG Pie Chart ──────────────────────────────────────────────────────── */

function PieChart({ payouts }: { payouts: PayoutEntry[] }) {
  const total = payouts.reduce((s, p) => s + p.percentage, 0);
  const cx = 100, cy = 100, r = 80;
  let cumulative = 0;

  const slices = payouts.map((entry, i) => {
    const startAngle = (cumulative / total) * 2 * Math.PI - Math.PI / 2;
    cumulative += entry.percentage;
    const endAngle = (cumulative / total) * 2 * Math.PI - Math.PI / 2;
    const largeArc = entry.percentage / total > 0.5 ? 1 : 0;

    const x1 = cx + r * Math.cos(startAngle);
    const y1 = cy + r * Math.sin(startAngle);
    const x2 = cx + r * Math.cos(endAngle);
    const y2 = cy + r * Math.sin(endAngle);

    const d = `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`;

    return (
      <path
        key={i}
        d={d}
        fill={PIE_COLORS[i % PIE_COLORS.length]}
        stroke="rgba(0,0,0,0.3)"
        strokeWidth="1"
        className="hover:opacity-80 transition-opacity cursor-pointer"
      />
    );
  });

  return (
    <svg viewBox="0 0 200 200" className="w-full max-w-[220px] mx-auto">
      {slices}
    </svg>
  );
}

/* ── Stat Card ──────────────────────────────────────────────────────────── */

function StatCard({ icon: Icon, label, value, accent = false }: {
  icon: any;
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-gray-900/50 backdrop-blur-xl border border-white/10 rounded-xl p-5 flex flex-col gap-2"
    >
      <div className="flex items-center gap-2 text-gray-400 text-sm">
        <Icon size={16} className={accent ? "text-[#d4af37]" : "text-gray-500"} />
        {label}
      </div>
      <span className={`text-2xl font-bold ${accent ? "text-[#d4af37]" : "text-white"}`}>
        {value}
      </span>
    </motion.div>
  );
}

/* ── Main Component ─────────────────────────────────────────────────────── */

export default function ClubTournamentAnalytics() {
  const { user } = useAuth();
  const { club } = useClub();
  const [data, setData] = useState<TournamentAnalyticsData>(PLACEHOLDER);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!club?.id) return;
    setLoading(true);
    fetch(`/api/clubs/${club.id}/quick-stats`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((stats) => {
        if (stats && stats.tournamentAnalytics) {
          setData(stats.tournamentAnalytics);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [club?.id]);

  const progressPct = data.totalEntries > 0
    ? ((data.totalEntries - data.playersRemaining) / data.totalEntries) * 100
    : 0;

  const fmt = (n: number) => n.toLocaleString("en-US");
  const fmtCurrency = (n: number) => `$${n.toLocaleString("en-US")}`;

  return (
    <DashboardLayout>
      <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 p-4 md:p-8 space-y-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col md:flex-row md:items-center justify-between gap-4"
        >
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-white flex items-center gap-3">
              <Trophy className="text-[#d4af37]" size={28} />
              Tournament Analytics
            </h1>
            <p className="text-gray-400 mt-1">{data.tournamentName}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${
              data.status === "running"
                ? "bg-green-500/20 text-green-400 border border-green-500/30"
                : data.status === "completed"
                ? "bg-gray-600/20 text-gray-300 border border-gray-500/30"
                : "bg-yellow-500/20 text-yellow-400 border border-yellow-500/30"
            }`}>
              <span className={`w-2 h-2 rounded-full ${
                data.status === "running" ? "bg-green-400 animate-pulse" :
                data.status === "completed" ? "bg-gray-400" : "bg-yellow-400"
              }`} />
              {data.status.charAt(0).toUpperCase() + data.status.slice(1)}
            </span>
          </div>
        </motion.div>

        {/* Financial Overview */}
        <section>
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <DollarSign size={18} className="text-[#d4af37]" />
            Financial Overview
          </h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard icon={DollarSign} label="Total Buy-in" value={fmtCurrency(data.totalBuyIn)} accent />
            <StatCard icon={Repeat} label="Re-buys / Add-ons" value={fmtCurrency(data.rebuysAddons)} />
            <StatCard icon={Percent} label="Club Rake" value={fmtCurrency(data.clubRake)} />
            <StatCard icon={Trophy} label="Net Prize Pool" value={fmtCurrency(data.netPrizePool)} accent />
          </div>
        </section>

        {/* Payout Table + Pie Chart */}
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Payout Table */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="lg:col-span-2 bg-gray-900/50 backdrop-blur-xl border border-white/10 rounded-xl overflow-hidden"
          >
            <div className="px-5 py-4 border-b border-white/5">
              <h3 className="text-white font-semibold flex items-center gap-2">
                <Award size={16} className="text-[#d4af37]" />
                Payout Table
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-gray-400 text-xs uppercase tracking-wider">
                    <th className="text-left px-5 py-3">Position</th>
                    <th className="text-right px-5 py-3">Percentage</th>
                    <th className="text-right px-5 py-3">Chip Value</th>
                  </tr>
                </thead>
                <tbody>
                  {data.payouts.map((p, i) => (
                    <tr
                      key={p.position}
                      className={`border-t border-white/5 ${i < 3 ? "text-[#d4af37]" : "text-gray-300"} hover:bg-white/5 transition-colors`}
                    >
                      <td className="px-5 py-3 font-medium">
                        {p.position <= 3 ? (
                          <span className="inline-flex items-center gap-1.5">
                            <Trophy size={14} className={
                              p.position === 1 ? "text-yellow-400" :
                              p.position === 2 ? "text-gray-300" : "text-amber-600"
                            } />
                            {p.position}{p.position === 1 ? "st" : p.position === 2 ? "nd" : "rd"}
                          </span>
                        ) : (
                          `${p.position}${p.position >= 10 ? "th+" : "th"}`
                        )}
                      </td>
                      <td className="px-5 py-3 text-right">{p.percentage}%</td>
                      <td className="px-5 py-3 text-right font-mono">{fmt(p.chipValue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>

          {/* Payout Distribution Pie */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="bg-gray-900/50 backdrop-blur-xl border border-white/10 rounded-xl p-5 flex flex-col"
          >
            <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
              <BarChart3 size={16} className="text-[#d4af37]" />
              Payout Distribution
            </h3>
            <div className="flex-1 flex items-center justify-center">
              <PieChart payouts={data.payouts} />
            </div>
            <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
              {data.payouts.slice(0, 6).map((p, i) => (
                <div key={i} className="flex items-center gap-1.5">
                  <span
                    className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
                    style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }}
                  />
                  <span className="text-gray-400 truncate">
                    {p.position}{p.position === 1 ? "st" : p.position === 2 ? "nd" : p.position === 3 ? "rd" : "th"} — {p.percentage}%
                  </span>
                </div>
              ))}
            </div>
          </motion.div>
        </div>

        {/* Tournament Progress */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-gray-900/50 backdrop-blur-xl border border-white/10 rounded-xl p-5"
        >
          <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
            <Users size={16} className="text-[#d4af37]" />
            Tournament Progress
          </h3>
          <div className="flex items-center justify-between text-sm text-gray-400 mb-2">
            <span>{data.playersRemaining} players remaining</span>
            <span>{data.totalEntries} total entries</span>
          </div>
          <div className="w-full h-4 bg-gray-800 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${progressPct}%` }}
              transition={{ duration: 1, ease: "easeOut" }}
              className="h-full rounded-full"
              style={{
                background: "linear-gradient(90deg, #d4af37, #f5d76e)",
              }}
            />
          </div>
          <p className="text-xs text-gray-500 mt-2">
            {Math.round(progressPct)}% of players eliminated
          </p>
        </motion.div>

        {/* Tournament Summary */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="bg-gray-900/50 backdrop-blur-xl border border-white/10 rounded-xl p-5"
        >
          <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
            <Layers size={16} className="text-[#d4af37]" />
            Tournament Summary
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Start Date</p>
              <p className="text-white font-medium flex items-center gap-1.5">
                <Calendar size={14} className="text-gray-500" />
                {new Date(data.startDate).toLocaleDateString("en-US", {
                  month: "short", day: "numeric", year: "numeric",
                })}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Total Hands Played</p>
              <p className="text-white font-medium flex items-center gap-1.5">
                <Hash size={14} className="text-gray-500" />
                {fmt(data.totalHandsPlayed)}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Average Stack</p>
              <p className="text-white font-medium flex items-center gap-1.5">
                <TrendingUp size={14} className="text-gray-500" />
                {fmt(data.averageStack)}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Blind Level</p>
              <p className="text-white font-medium flex items-center gap-1.5">
                <Clock size={14} className="text-gray-500" />
                Level {data.blindLevel}
              </p>
            </div>
          </div>
        </motion.div>

        {/* Action Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="flex flex-col sm:flex-row gap-3"
        >
          <button className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-gray-800 border border-white/10 text-white font-medium hover:bg-gray-700 transition-colors">
            <FileDown size={18} />
            Export Report
          </button>
          <button className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-[#d4af37] to-[#f5d76e] text-gray-900 font-bold hover:opacity-90 transition-opacity">
            <CheckCircle2 size={18} />
            Finalize Tournament
          </button>
        </motion.div>
      </div>
    </DashboardLayout>
  );
}
