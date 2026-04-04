import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { DashboardLayout } from "@/components/DashboardLayout";
import { MemberAvatar } from "@/components/shared/MemberAvatar";
import { Trophy, Coins, Target, TrendingUp, Loader2, Medal, Crown, Clock, Minus } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import goldChips from "@assets/generated_images/gold_chip_stack_3d.webp";

type MetricKey = "chips" | "wins" | "winRate";
type PeriodKey = "all" | "month" | "week" | "today";

const PERIODS: { key: PeriodKey; label: string }[] = [
  { key: "all", label: "All Time" },
  { key: "month", label: "This Month" },
  { key: "week", label: "This Week" },
  { key: "today", label: "Today" },
];

interface LeaderboardEntry {
  userId: string;
  username: string;
  displayName: string | null;
  avatarId: string | null;
  value: number;
}

const TABS: { key: MetricKey; label: string; icon: any; unit: string }[] = [
  { key: "chips", label: "By Chips", icon: Coins, unit: "" },
  { key: "wins", label: "By Wins", icon: Trophy, unit: " wins" },
  { key: "winRate", label: "By Win Rate", icon: TrendingUp, unit: "%" },
];

const PODIUM_COLORS = {
  1: { ring: "#d4af37", bg: "linear-gradient(135deg, rgba(212,175,55,0.25) 0%, rgba(154,123,44,0.12) 100%)", glow: "rgba(212,175,55,0.4)", label: "GOLD" },
  2: { ring: "#94a3b8", bg: "linear-gradient(135deg, rgba(148,163,184,0.20) 0%, rgba(100,116,139,0.10) 100%)", glow: "rgba(148,163,184,0.3)", label: "SILVER" },
  3: { ring: "#cd7f32", bg: "linear-gradient(135deg, rgba(205,127,50,0.20) 0%, rgba(160,100,40,0.10) 100%)", glow: "rgba(205,127,50,0.3)", label: "BRONZE" },
} as const;

function getRankStyle(rank: number) {
  if (rank === 1) return "text-amber-400 bg-amber-500/15 border-amber-500/30";
  if (rank === 2) return "text-gray-300 bg-gray-400/10 border-gray-400/20";
  if (rank === 3) return "text-orange-400 bg-orange-500/10 border-orange-500/20";
  return "text-gray-500 bg-white/5 border-white/5";
}

function getStatLabel(metric: MetricKey): string {
  if (metric === "chips") return "Total Chips";
  if (metric === "wins") return "Hands Won";
  return "Win Rate";
}

// Stagger animations for podium cards
const podiumSpring = {
  type: "spring" as const,
  stiffness: 260,
  damping: 20,
};

export default function Leaderboard() {
  const { user } = useAuth();
  const [metric, setMetric] = useState<MetricKey>("chips");
  const [period, setPeriod] = useState<PeriodKey>("all");
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setFetchError(null);
    fetch(`/api/leaderboard?metric=${metric}&period=${period}`)
      .then(r => {
        if (r.status === 401) throw new Error("Session expired -- please log in again");
        if (!r.ok) throw new Error("Failed to load leaderboard");
        return r.json();
      })
      .then(data => setEntries(data))
      .catch((err) => { setEntries([]); setFetchError(err.message || "Failed to load leaderboard"); })
      .finally(() => setLoading(false));
  }, [metric, period]);

  const top3 = entries.slice(0, 3);
  const hasTop3 = !loading && top3.length >= 3;

  return (
    <DashboardLayout title="Leaderboard">
      <div className="px-4 md:px-8 pb-8">
        {/* Header with gold chips accent */}
        <div className="relative mb-6 overflow-hidden rounded-xl border border-primary/10 p-5"
          style={{
            background: "rgba(15,15,20,0.7)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
          }}
        >
          <img
            src={goldChips}
            alt=""
            loading="lazy"
            className="absolute -right-6 -top-2 w-36 h-36 object-contain opacity-20 pointer-events-none"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-amber-500/5 to-transparent pointer-events-none" />
          <div className="relative z-10 flex items-center gap-3">
            <Medal className="w-6 h-6 text-primary drop-shadow-[0_0_8px_rgba(212,175,55,0.4)]" />
            <h2 className="text-lg font-black tracking-[0.12em] uppercase gold-text">
              Leaderboard
            </h2>
          </div>
        </div>

        {/* Tab Bar */}
        <div className="flex items-center gap-1 mb-6 p-1 rounded-xl border border-white/5 w-fit"
          style={{ background: "rgba(15,15,20,0.6)", backdropFilter: "blur(12px)" }}
        >
          {TABS.map(tab => {
            const Icon = tab.icon;
            const isActive = metric === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setMetric(tab.key)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-[0.625rem] font-bold uppercase tracking-wider transition-all ${
                  isActive
                    ? "bg-amber-500/20 text-amber-300 border border-amber-500/25 shadow-[0_0_10px_rgba(212,175,55,0.15)]"
                    : "text-gray-500 hover:text-gray-300 border border-transparent"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Period filter */}
        <div className="flex items-center gap-1 mb-8">
          <Clock className="w-3.5 h-3.5 text-gray-500 mr-1" />
          {PERIODS.map(p => (
            <button
              key={p.key}
              onClick={() => setPeriod(p.key)}
              className={`px-3 py-1.5 rounded-lg text-[0.5625rem] font-bold uppercase tracking-wider transition-all ${
                period === p.key
                  ? "bg-white/10 text-white border border-white/15"
                  : "text-gray-600 hover:text-gray-400 border border-transparent"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* ── Podium -- Top 3 ──────────────────────────────────── */}
        <AnimatePresence mode="wait">
          {hasTop3 && (
            <motion.div
              key={`podium-${metric}-${period}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-end justify-center gap-3 sm:gap-5 mb-10"
            >
              {/* Display order: #2, #1, #3 */}
              {[1, 0, 2].map((idx, displayOrder) => {
                const entry = top3[idx];
                const rank = (idx + 1) as 1 | 2 | 3;
                const isFirst = rank === 1;
                const colors = PODIUM_COLORS[rank];
                const tab = TABS.find(t => t.key === metric)!;
                const avatarSize = isFirst ? 120 : 80;

                return (
                  <motion.div
                    key={entry.userId}
                    initial={{ opacity: 0, y: 60, scale: 0.85 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ ...podiumSpring, delay: displayOrder * 0.15 }}
                    className="flex flex-col items-center"
                    style={{ marginBottom: isFirst ? 16 : 0 }}
                  >
                    {/* Card container */}
                    <div
                      className="relative flex flex-col items-center rounded-2xl px-4 sm:px-6 pt-5 pb-4 border"
                      style={{
                        background: colors.bg,
                        borderColor: `${colors.ring}30`,
                        boxShadow: `0 0 30px ${colors.glow}, 0 8px 32px rgba(0,0,0,0.4)`,
                        minWidth: isFirst ? 180 : 140,
                      }}
                    >
                      {/* Animated crown for #1 */}
                      {isFirst && (
                        <motion.div
                          initial={{ y: -20, opacity: 0, rotate: -10 }}
                          animate={{ y: 0, opacity: 1, rotate: 0 }}
                          transition={{ ...podiumSpring, delay: 0.4 }}
                          className="absolute -top-5"
                        >
                          <motion.div
                            animate={{ y: [0, -3, 0] }}
                            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                          >
                            <Crown
                              className="w-10 h-10 drop-shadow-[0_0_16px_rgba(212,175,55,0.6)]"
                              style={{ color: "#d4af37", fill: "rgba(212,175,55,0.3)" }}
                            />
                          </motion.div>
                        </motion.div>
                      )}

                      {/* Glow pulse behind avatar for #1 */}
                      {isFirst && (
                        <motion.div
                          className="absolute rounded-full"
                          style={{
                            width: avatarSize + 24,
                            height: avatarSize + 24,
                            top: isFirst ? 28 : 12,
                            background: `radial-gradient(circle, ${colors.glow} 0%, transparent 70%)`,
                          }}
                          animate={{ opacity: [0.3, 0.6, 0.3], scale: [1, 1.08, 1] }}
                          transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
                        />
                      )}

                      {/* Avatar */}
                      <div
                        className="relative rounded-full overflow-hidden border-2 z-10"
                        style={{
                          width: avatarSize,
                          height: avatarSize,
                          borderColor: colors.ring,
                          boxShadow: `0 0 24px ${colors.glow}`,
                        }}
                      >
                        <MemberAvatar
                          avatarId={entry.avatarId}
                          displayName={entry.displayName || entry.username}
                          size={isFirst ? "lg" : "md"}
                        />
                      </div>

                      {/* Rank badge */}
                      <div
                        className="absolute z-20 flex items-center justify-center w-7 h-7 rounded-full border-2 text-xs font-black"
                        style={{
                          borderColor: colors.ring,
                          background: `linear-gradient(135deg, ${colors.ring}, ${colors.ring}cc)`,
                          color: rank === 1 ? "#1a1000" : rank === 2 ? "#1a1a2a" : "#1a1000",
                          bottom: isFirst ? 88 : 72,
                          right: isFirst ? 28 : 16,
                          boxShadow: `0 0 10px ${colors.glow}`,
                        }}
                      >
                        {rank}
                      </div>

                      {/* Name */}
                      <span className="text-xs sm:text-sm font-bold text-white truncate max-w-[120px] text-center mt-3">
                        {entry.displayName || entry.username}
                      </span>

                      {/* Animated value */}
                      <motion.span
                        className="text-base sm:text-lg font-black mt-1 tabular-nums"
                        style={{ color: colors.ring }}
                        initial={{ opacity: 0, scale: 0.5 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ ...podiumSpring, delay: displayOrder * 0.15 + 0.3 }}
                      >
                        {metric === "chips" ? entry.value.toLocaleString() : entry.value}{tab.unit}
                      </motion.span>

                      {/* Secondary stat label */}
                      <span className="text-[0.5625rem] text-gray-500 mt-0.5 uppercase tracking-wider font-semibold">
                        {getStatLabel(metric)}
                      </span>
                    </div>
                  </motion.div>
                );
              })}
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Leaderboard Table ─────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: hasTop3 ? 0.5 : 0 }}
          className="rounded-xl overflow-hidden border border-amber-500/10"
          style={{
            background: "rgba(15,15,20,0.7)",
            backdropFilter: "blur(16px)",
            WebkitBackdropFilter: "blur(16px)",
          }}
        >
          {/* Gold accent line at top */}
          <div className="h-px w-full bg-gradient-to-r from-transparent via-amber-500/30 to-transparent" />

          {/* Table header */}
          <div className="hidden sm:grid grid-cols-12 gap-2 px-5 py-3 border-b border-white/5">
            <span className="col-span-1 text-[0.5625rem] font-bold uppercase tracking-wider text-gray-500">Rank</span>
            <span className="col-span-1 text-[0.5625rem] font-bold uppercase tracking-wider text-gray-500"></span>
            <span className="col-span-1 text-[0.5625rem] font-bold uppercase tracking-wider text-gray-500">Trend</span>
            <span className="col-span-3 text-[0.5625rem] font-bold uppercase tracking-wider text-gray-500">Player</span>
            <span className="col-span-3 text-[0.5625rem] font-bold uppercase tracking-wider text-gray-500">
              {metric === "chips" ? "Chips" : metric === "wins" ? "Total Wins" : "Win Rate"}
            </span>
            <span className="col-span-3 text-[0.5625rem] font-bold uppercase tracking-wider text-gray-500 text-right">Username</span>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-6 h-6 animate-spin text-amber-400" />
            </div>
          ) : fetchError ? (
            <div className="flex flex-col items-center justify-center py-16">
              <p className="text-[0.6875rem] text-red-400">{fetchError}</p>
            </div>
          ) : entries.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <Trophy className="w-8 h-8 text-gray-700 mb-2" />
              <p className="text-[0.6875rem] text-gray-600">No leaderboard data yet</p>
            </div>
          ) : (
            entries.map((entry, i) => {
              const rank = i + 1;
              const rankStyle = getRankStyle(rank);
              const tab = TABS.find(t => t.key === metric)!;
              const isCurrentUser = entry.userId === user?.id;
              const maxVal = entries[0]?.value || 1;
              const pct = Math.min(100, (entry.value / maxVal) * 100);

              return (
                <motion.div
                  key={entry.userId}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: (hasTop3 ? 0.5 : 0) + i * 0.03 }}
                  className={`relative flex flex-wrap sm:grid sm:grid-cols-12 gap-2 items-center px-5 py-3 border-b border-white/[0.03] transition-all ${
                    isCurrentUser ? "hover:bg-amber-500/[0.08]" : "hover:bg-white/[0.04]"
                  }`}
                  style={{
                    background: isCurrentUser
                      ? "linear-gradient(90deg, rgba(212,175,55,0.10), rgba(212,175,55,0.03), transparent)"
                      : rank === 1
                        ? "linear-gradient(90deg, rgba(212,175,55,0.06), transparent)"
                        : rank === 2
                          ? "linear-gradient(90deg, rgba(148,163,184,0.04), transparent)"
                          : rank === 3
                            ? "linear-gradient(90deg, rgba(205,127,50,0.04), transparent)"
                            : undefined,
                    borderLeft: isCurrentUser
                      ? "3px solid #d4af37"
                      : undefined,
                  }}
                >
                  {/* Rank */}
                  <div className="col-span-1">
                    <span className={`inline-flex items-center justify-center w-7 h-7 rounded-lg text-xs font-bold border ${rankStyle}`}>
                      {rank}
                    </span>
                  </div>

                  {/* Avatar */}
                  <div className="col-span-1">
                    <MemberAvatar
                      avatarId={entry.avatarId}
                      displayName={entry.displayName || entry.username}
                      size="sm"
                    />
                  </div>

                  {/* Rank change indicator */}
                  <div className="col-span-1 flex items-center justify-center">
                    <span className="inline-flex items-center justify-center w-5 h-5 rounded text-gray-600">
                      <Minus className="w-3 h-3" />
                    </span>
                  </div>

                  {/* Name + YOU badge */}
                  <div className="col-span-3 flex items-center gap-2">
                    <span className="text-sm font-bold text-white truncate">
                      {entry.displayName || entry.username}
                    </span>
                    {isCurrentUser && (
                      <span className="shrink-0 px-1.5 py-0.5 rounded text-[0.5rem] font-black uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/30 shadow-[0_0_8px_rgba(212,175,55,0.2)]">
                        YOU
                      </span>
                    )}
                  </div>

                  {/* Value + gradient bar */}
                  <div className="col-span-3">
                    <span className={`text-sm font-bold ${rank <= 3 ? "text-amber-400" : "text-white"}`}>
                      {metric === "chips" ? entry.value.toLocaleString() : entry.value}{tab.unit}
                    </span>
                    <div className="h-1.5 rounded-full bg-white/5 mt-1 overflow-hidden">
                      <motion.div
                        className="h-full rounded-full"
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ duration: 0.6, delay: (hasTop3 ? 0.5 : 0) + i * 0.03, ease: "easeOut" }}
                        style={{
                          background: rank === 1
                            ? "linear-gradient(90deg, #9a7b2c, #d4af37, #f0d478)"
                            : rank === 2
                              ? "linear-gradient(90deg, #64748b, #94a3b8)"
                              : rank === 3
                                ? "linear-gradient(90deg, #92400e, #cd7f32)"
                                : "linear-gradient(90deg, rgba(212,175,55,0.3), rgba(212,175,55,0.5))",
                        }}
                      />
                    </div>
                  </div>

                  {/* Username */}
                  <div className="col-span-3 text-right">
                    <span className="text-[0.625rem] text-gray-600">@{entry.username}</span>
                  </div>
                </motion.div>
              );
            })
          )}

          {/* Bottom accent */}
          <div className="h-px w-full bg-gradient-to-r from-transparent via-amber-500/20 to-transparent" />
        </motion.div>
      </div>
    </DashboardLayout>
  );
}
