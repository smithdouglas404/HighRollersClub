import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { DashboardLayout } from "@/components/DashboardLayout";
import { MemberAvatar } from "@/components/shared/MemberAvatar";
import { Trophy, Coins, Target, TrendingUp, Loader2, Medal } from "lucide-react";
import goldChips from "@assets/generated_images/gold_chip_stack_3d.webp";

type MetricKey = "chips" | "wins" | "winRate";

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

function getRankStyle(rank: number) {
  if (rank === 1) return "text-primary bg-primary/15 border-primary/20";
  if (rank === 2) return "text-gray-300 bg-gray-400/10 border-gray-400/20";
  if (rank === 3) return "text-orange-400 bg-orange-500/10 border-orange-500/20";
  return "text-gray-500 bg-white/5 border-white/5";
}

export default function Leaderboard() {
  const [metric, setMetric] = useState<MetricKey>("chips");
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const [fetchError, setFetchError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setFetchError(null);
    fetch(`/api/leaderboard?metric=${metric}`)
      .then(r => {
        if (r.status === 401) throw new Error("Session expired — please log in again");
        if (!r.ok) throw new Error("Failed to load leaderboard");
        return r.json();
      })
      .then(data => setEntries(data))
      .catch((err) => { setEntries([]); setFetchError(err.message || "Failed to load leaderboard"); })
      .finally(() => setLoading(false));
  }, [metric]);

  return (
    <DashboardLayout title="Leaderboard">
      <div className="px-4 md:px-8 pb-8">
        {/* Header with gold chips accent */}
        <div className="relative mb-6 overflow-hidden rounded-xl glass border border-primary/10 p-5">
          <img
            src={goldChips}
            alt="Gold chips"
            loading="lazy"
            className="absolute -right-6 -top-2 w-36 h-36 object-contain opacity-20 pointer-events-none"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-amber-500/5 to-transparent pointer-events-none" />
          <div className="relative z-10 flex items-center gap-3">
            <Medal className="w-6 h-6 text-primary drop-shadow-[0_0_8px_rgba(0,212,255,0.4)]" />
            <h2 className="text-lg font-black tracking-[0.12em] uppercase gold-text">
              Leaderboard
            </h2>
          </div>
        </div>

        {/* Tab Bar */}
        <div className="flex items-center gap-1 mb-6 p-1 glass rounded-xl border border-white/5 w-fit">
          {TABS.map(tab => {
            const Icon = tab.icon;
            const isActive = metric === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setMetric(tab.key)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-[0.625rem] font-bold uppercase tracking-wider transition-all ${
                  isActive
                    ? "bg-primary/20 text-primary border border-primary/20"
                    : "text-gray-500 hover:text-gray-300 border border-transparent"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Leaderboard Table */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass rounded-xl overflow-hidden border border-primary/10"
        >
          {/* Table header */}
          <div className="hidden sm:grid grid-cols-12 gap-2 px-5 py-3 border-b border-white/5">
            <span className="col-span-1 text-[0.5625rem] font-bold uppercase tracking-wider text-gray-500">Rank</span>
            <span className="col-span-1 text-[0.5625rem] font-bold uppercase tracking-wider text-gray-500">Avatar</span>
            <span className="col-span-4 text-[0.5625rem] font-bold uppercase tracking-wider text-gray-500">Player</span>
            <span className="col-span-3 text-[0.5625rem] font-bold uppercase tracking-wider text-gray-500">
              {metric === "chips" ? "Chips" : metric === "wins" ? "Total Wins" : "Win Rate"}
            </span>
            <span className="col-span-3 text-[0.5625rem] font-bold uppercase tracking-wider text-gray-500 text-right">Username</span>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
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

              return (
                <motion.div
                  key={entry.userId}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.03 }}
                  className="flex flex-wrap sm:grid sm:grid-cols-12 gap-2 items-center px-5 py-3 border-b border-white/[0.03] hover:bg-primary/[0.06] transition-all"
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
                  {/* Name */}
                  <div className="col-span-4">
                    <span className="text-sm font-bold text-white truncate block">
                      {entry.displayName || entry.username}
                    </span>
                  </div>
                  {/* Value */}
                  <div className="col-span-3">
                    <span className={`text-sm font-bold ${rank <= 3 ? "text-primary" : "text-white"}`}>
                      {metric === "chips" ? entry.value.toLocaleString() : entry.value}{tab.unit}
                    </span>
                  </div>
                  {/* Username */}
                  <div className="col-span-3 text-right">
                    <span className="text-[0.625rem] text-gray-600">@{entry.username}</span>
                  </div>
                </motion.div>
              );
            })
          )}
        </motion.div>
      </div>
    </DashboardLayout>
  );
}
