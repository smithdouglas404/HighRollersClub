import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useAuth } from "@/lib/auth-context";
import { useClub } from "@/lib/club-context";
import { GoldButton, GoldCard, NumberTicker, StatCard, SectionHeader, GoldDivider } from "@/components/premium/PremiumComponents";
import {
  Users, TrendingUp, BarChart3, PieChart as PieChartIcon,
  Activity, Clock, Gamepad2, DollarSign,
  ArrowUpRight, ArrowDownRight, UserPlus, UserCheck
} from "lucide-react";

/* ── Types ──────────────────────────────────────────────────────────────── */

interface MemberStat {
  id: number;
  username: string;
  avatarUrl?: string;
  lastActive: string;
  gamesPlayed: number;
  totalWagered: number;
}

interface ActiveMembersTrend {
  date: string;
  count: number;
}

interface TableVolume {
  date: string;
  count: number;
}

interface RetentionSplit {
  newPlayers: number;
  returningPlayers: number;
}

/* ── Placeholder Data ───────────────────────────────────────────────────── */

const PLACEHOLDER_TRENDS: ActiveMembersTrend[] = [
  { date: "Mar 6", count: 18 },
  { date: "Mar 13", count: 24 },
  { date: "Mar 20", count: 22 },
  { date: "Mar 27", count: 31 },
  { date: "Apr 3", count: 28 },
  { date: "Apr 10", count: 35 },
  { date: "Apr 17", count: 42 },
];

const PLACEHOLDER_VOLUME: TableVolume[] = [
  { date: "Mon", count: 12 },
  { date: "Tue", count: 8 },
  { date: "Wed", count: 15 },
  { date: "Thu", count: 10 },
  { date: "Fri", count: 22 },
  { date: "Sat", count: 28 },
  { date: "Sun", count: 19 },
];

const PLACEHOLDER_RETENTION: RetentionSplit = {
  newPlayers: 14,
  returningPlayers: 38,
};

const PLACEHOLDER_MEMBERS: MemberStat[] = [
  { id: 1, username: "AceHigh", lastActive: "2026-04-05T02:30:00Z", gamesPlayed: 142, totalWagered: 87500 },
  { id: 2, username: "RiverKing", lastActive: "2026-04-04T22:15:00Z", gamesPlayed: 98, totalWagered: 62300 },
  { id: 3, username: "BluffMaster", lastActive: "2026-04-04T18:45:00Z", gamesPlayed: 215, totalWagered: 134200 },
  { id: 4, username: "ChipStacker", lastActive: "2026-04-03T14:20:00Z", gamesPlayed: 67, totalWagered: 41800 },
  { id: 5, username: "PocketRockets", lastActive: "2026-04-02T09:10:00Z", gamesPlayed: 183, totalWagered: 95600 },
  { id: 6, username: "NutFlush", lastActive: "2026-04-01T21:00:00Z", gamesPlayed: 54, totalWagered: 28900 },
  { id: 7, username: "AllInAndy", lastActive: "2026-03-30T16:30:00Z", gamesPlayed: 312, totalWagered: 201400 },
  { id: 8, username: "FoldEquity", lastActive: "2026-03-28T12:00:00Z", gamesPlayed: 89, totalWagered: 53200 },
];

/* ── Helpers ────────────────────────────────────────────────────────────── */

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return `${Math.floor(days / 7)}w ago`;
}

function fmt(n: number) {
  return n.toLocaleString("en-US");
}

/* ── SVG Line Chart ─────────────────────────────────────────────────────── */

function ActiveMembersChart({ data }: { data: ActiveMembersTrend[] }) {
  const W = 500, H = 200, PAD = 40;
  const chartW = W - PAD * 2, chartH = H - PAD * 2;

  const values = data.map((d) => d.count);
  const maxVal = Math.max(...values, 1);
  const minVal = 0;
  const range = maxVal - minVal || 1;

  const points = data.map((d, i) => ({
    x: PAD + (i / Math.max(data.length - 1, 1)) * chartW,
    y: PAD + chartH - ((d.count - minVal) / range) * chartH,
  }));

  const lineD = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
  const areaD = lineD +
    ` L ${points[points.length - 1].x.toFixed(1)} ${(PAD + chartH).toFixed(1)}` +
    ` L ${points[0].x.toFixed(1)} ${(PAD + chartH).toFixed(1)} Z`;

  // Y-axis ticks
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((pct) => ({
    value: Math.round(minVal + pct * range),
    y: PAD + chartH - pct * chartH,
  }));

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" preserveAspectRatio="xMidYMid meet">
      <defs>
        <linearGradient id="activeGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#d4af37" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#d4af37" stopOpacity="0.02" />
        </linearGradient>
      </defs>

      {/* Grid lines */}
      {yTicks.map((t, i) => (
        <g key={i}>
          <line x1={PAD} y1={t.y} x2={W - PAD} y2={t.y} stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
          <text x={PAD - 6} y={t.y + 4} textAnchor="end" fill="rgba(255,255,255,0.3)" fontSize="10" fontFamily="monospace">
            {t.value}
          </text>
        </g>
      ))}

      {/* Area */}
      <path d={areaD} fill="url(#activeGrad)" />

      {/* Line */}
      <path d={lineD} fill="none" stroke="#d4af37" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

      {/* Dots + labels */}
      {points.map((p, i) => (
        <g key={i}>
          <circle cx={p.x} cy={p.y} r="3.5" fill="#d4af37" stroke="#0f172a" strokeWidth="2" />
          <text x={p.x} y={PAD + chartH + 16} textAnchor="middle" fill="rgba(255,255,255,0.4)" fontSize="9">
            {data[i].date}
          </text>
        </g>
      ))}
    </svg>
  );
}

/* ── SVG Bar Chart ──────────────────────────────────────────────────────── */

function VolumeBarChart({ data }: { data: TableVolume[] }) {
  const W = 500, H = 200, PAD = 40;
  const chartW = W - PAD * 2, chartH = H - PAD * 2;

  const maxVal = Math.max(...data.map((d) => d.count), 1);
  const barW = chartW / data.length * 0.6;
  const gap = chartW / data.length;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" preserveAspectRatio="xMidYMid meet">
      <defs>
        <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#d4af37" />
          <stop offset="100%" stopColor="#b8941e" />
        </linearGradient>
      </defs>

      {/* Baseline */}
      <line x1={PAD} y1={PAD + chartH} x2={W - PAD} y2={PAD + chartH} stroke="rgba(255,255,255,0.1)" strokeWidth="1" />

      {data.map((d, i) => {
        const barH = (d.count / maxVal) * chartH;
        const x = PAD + i * gap + (gap - barW) / 2;
        const y = PAD + chartH - barH;

        return (
          <g key={i}>
            <rect
              x={x}
              y={y}
              width={barW}
              height={barH}
              rx="3"
              fill="url(#barGrad)"
              className="hover:opacity-80 transition-opacity"
            />
            <text x={x + barW / 2} y={y - 6} textAnchor="middle" fill="rgba(255,255,255,0.5)" fontSize="10" fontFamily="monospace">
              {d.count}
            </text>
            <text x={x + barW / 2} y={PAD + chartH + 16} textAnchor="middle" fill="rgba(255,255,255,0.4)" fontSize="9">
              {d.date}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/* ── SVG Donut Chart ────────────────────────────────────────────────────── */

function RetentionDonut({ data }: { data: RetentionSplit }) {
  const total = data.newPlayers + data.returningPlayers;
  const newPct = total > 0 ? data.newPlayers / total : 0;
  const retPct = total > 0 ? data.returningPlayers / total : 0;

  const cx = 80, cy = 80, r = 60, strokeW = 18;
  const circumference = 2 * Math.PI * r;
  const newLen = circumference * newPct;
  const retLen = circumference * retPct;

  return (
    <div className="flex flex-col items-center gap-4">
      <svg viewBox="0 0 160 160" className="w-full max-w-[180px]">
        {/* Returning (gold) */}
        <circle
          cx={cx} cy={cy} r={r}
          fill="none"
          stroke="#d4af37"
          strokeWidth={strokeW}
          strokeDasharray={`${retLen} ${circumference}`}
          strokeDashoffset={0}
          transform={`rotate(-90 ${cx} ${cy})`}
          strokeLinecap="round"
        />
        {/* New (lighter gold/amber) */}
        <circle
          cx={cx} cy={cy} r={r}
          fill="none"
          stroke="#f0d060"
          strokeWidth={strokeW}
          strokeDasharray={`${newLen} ${circumference}`}
          strokeDashoffset={-retLen}
          transform={`rotate(-90 ${cx} ${cy})`}
          strokeLinecap="round"
        />
        <text x={cx} y={cy - 4} textAnchor="middle" fill="white" fontSize="22" fontWeight="bold">
          {total}
        </text>
        <text x={cx} y={cy + 12} textAnchor="middle" fill="rgba(255,255,255,0.4)" fontSize="10">
          total
        </text>
      </svg>
      <div className="flex gap-6 text-xs">
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-[#f0d060]" />
          <span className="text-gray-400">New ({Math.round(newPct * 100)}%)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-[#d4af37]" />
          <span className="text-gray-400">Returning ({Math.round(retPct * 100)}%)</span>
        </div>
      </div>
    </div>
  );
}

/* ── Main Component ─────────────────────────────────────────────────────── */

export default function ClubMemberAnalytics() {
  const { user } = useAuth();
  const { club } = useClub();
  const [members, setMembers] = useState<MemberStat[]>(PLACEHOLDER_MEMBERS);
  const [trends, setTrends] = useState<ActiveMembersTrend[]>(PLACEHOLDER_TRENDS);
  const [volume, setVolume] = useState<TableVolume[]>(PLACEHOLDER_VOLUME);
  const [retention, setRetention] = useState<RetentionSplit>(PLACEHOLDER_RETENTION);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!club?.id) return;
    setLoading(true);

    Promise.all([
      fetch(`/api/clubs/${club.id}/members/stats`, { credentials: "include" }).then((r) => r.ok ? r.json() : null),
      fetch(`/api/clubs/${club.id}/quick-stats`, { credentials: "include" }).then((r) => r.ok ? r.json() : null),
    ])
      .then(([memberStats, quickStats]) => {
        if (memberStats?.members?.length) {
          setMembers(memberStats.members);
        }
        if (quickStats?.activeMembersTrend?.length) {
          setTrends(quickStats.activeMembersTrend);
        }
        if (quickStats?.tableVolume?.length) {
          setVolume(quickStats.tableVolume);
        }
        if (quickStats?.retention) {
          setRetention(quickStats.retention);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [club?.id]);

  const topStats = useMemo(() => {
    const totalGames = members.reduce((s, m) => s + m.gamesPlayed, 0);
    const totalWagered = members.reduce((s, m) => s + m.totalWagered, 0);
    const activeToday = members.filter((m) => {
      const diff = Date.now() - new Date(m.lastActive).getTime();
      return diff < 86400000;
    }).length;
    // Avg session time placeholder
    const avgSession = "24m";
    return { totalMembers: members.length, totalGames, totalWagered, activeToday, avgSession };
  }, [members]);

  return (
    <DashboardLayout>
      <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 p-4 md:p-8 space-y-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <SectionHeader icon={BarChart3} title="Club Member Analytics Dashboard" subtitle="Track member engagement and activity trends" />
        </motion.div>

        {/* ── Top Row: 4 Stat Cards ──────────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Active Members" value={topStats.totalMembers} trend="+5 this week" trendUp icon={Users} />
          <StatCard label="Table Volume" value={topStats.totalGames} trend="+12% vs last week" trendUp icon={Gamepad2} />
          <StatCard label="New Members" value={topStats.activeToday} trend="This month" trendUp icon={UserPlus} />
          <StatCard label="Avg Session Time" value={topStats.avgSession} trend="+3m vs last month" trendUp icon={Clock} />
        </div>

        {/* ── Charts Row ─────────────────────────────────────────── */}
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Active Members Trend */}
          <GoldCard glow>
            <SectionHeader icon={Activity} title="Active Members" />
            <ActiveMembersChart data={trends} />
          </GoldCard>

          {/* Table Volume */}
          <GoldCard glow>
            <SectionHeader icon={BarChart3} title="Total Table Volume" />
            <VolumeBarChart data={volume} />
          </GoldCard>

          {/* Retention Donut */}
          <GoldCard glow className="flex flex-col items-center justify-center">
            <SectionHeader icon={UserCheck} title="New vs Returning Players" className="self-start" />
            <RetentionDonut data={retention} />
          </GoldCard>
        </div>

        {/* ── Member Activity Table ──────────────────────────────── */}
        <GoldCard hover={false} padding="p-0" className="overflow-hidden">
          <div className="px-5 py-4 border-b border-white/5">
            <SectionHeader icon={Users} title="Member Activity" />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs uppercase tracking-wider border-b border-[rgba(212,175,55,0.15)]" style={{ background: "rgba(212,175,55,0.06)", color: "#d4af37" }}>
                  <th className="text-left px-4 py-3">Username</th>
                  <th className="text-left px-4 py-3">Last Active</th>
                  <th className="text-left px-4 py-3">Hands</th>
                  <th className="text-left px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {members.map((m) => {
                  const diff = Date.now() - new Date(m.lastActive).getTime();
                  const isOnline = diff < 3600000; // within 1hr
                  const isRecent = diff < 86400000; // within 24hr

                  return (
                    <tr key={m.id} className="border-b border-white/5 hover:bg-[rgba(212,175,55,0.04)] transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#d4af37] to-amber-700 flex items-center justify-center text-xs font-bold text-gray-900 flex-shrink-0">
                            {m.username.charAt(0).toUpperCase()}
                          </div>
                          <span className="text-sm text-white font-medium">{m.username}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-400">{timeAgo(m.lastActive)}</td>
                      <td className="py-3 px-4 text-sm font-bold" style={{ color: "#d4af37" }}>${fmt(m.totalWagered)}</td>
                      <td className="py-3 px-4">
                        {isOnline ? (
                          <span className="text-xs px-2 py-0.5 rounded bg-green-500/15 text-green-400 border border-green-500/20">
                            Online
                          </span>
                        ) : isRecent ? (
                          <span className="text-xs px-2 py-0.5 rounded bg-yellow-500/15 text-yellow-400 border border-yellow-500/20">
                            Recent
                          </span>
                        ) : (
                          <span className="text-xs px-2 py-0.5 rounded bg-gray-500/15 text-gray-400 border border-gray-500/20">
                            Offline
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </GoldCard>
      </div>
    </DashboardLayout>
  );
}
