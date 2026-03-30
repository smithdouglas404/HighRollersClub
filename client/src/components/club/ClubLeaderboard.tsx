import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { MemberAvatar } from "@/components/shared/MemberAvatar";
import { Trophy, Coins, Target, TrendingUp, Loader2, Medal, Gamepad2 } from "lucide-react";

type MetricKey = "chips" | "wins" | "winRate" | "handsPlayed" | "tournamentsWon";

interface LeaderboardEntry {
  userId: string;
  username: string;
  displayName: string | null;
  avatarId: string | null;
  value: number;
}

const TABS: { key: MetricKey; label: string; icon: any; unit: string }[] = [
  { key: "chips", label: "Chips", icon: Coins, unit: "" },
  { key: "wins", label: "Wins", icon: Trophy, unit: "" },
  { key: "winRate", label: "Win %", icon: TrendingUp, unit: "%" },
  { key: "handsPlayed", label: "Hands", icon: Gamepad2, unit: "" },
  { key: "tournamentsWon", label: "Tourneys", icon: Medal, unit: "" },
];

function getRankStyle(rank: number) {
  if (rank === 1) return "text-cyan-400 bg-cyan-500/15 border-cyan-500/20";
  if (rank === 2) return "text-gray-300 bg-gray-400/10 border-gray-400/20";
  if (rank === 3) return "text-orange-400 bg-orange-500/10 border-orange-500/20";
  return "text-gray-500 bg-white/5 border-white/5";
}

export function ClubLeaderboard({ clubId }: { clubId: string }) {
  const [metric, setMetric] = useState<MetricKey>("chips");
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/clubs/${clubId}/leaderboard?metric=${metric}`)
      .then(r => r.ok ? r.json() : [])
      .then(data => setEntries(data))
      .catch(() => setEntries([]))
      .finally(() => setLoading(false));
  }, [clubId, metric]);

  return (
    <div className="space-y-4">
      {/* Metric Tabs */}
      <div className="flex items-center gap-1 p-1 glass rounded-xl border border-white/5 w-fit">
        {TABS.map(tab => {
          const Icon = tab.icon;
          const isActive = metric === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setMetric(tab.key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[0.625rem] font-bold uppercase tracking-wider transition-all ${
                isActive
                  ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/20"
                  : "text-gray-500 hover:text-gray-300 border border-transparent"
              }`}
            >
              <Icon className="w-3 h-3" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Leaderboard Table */}
      <div
        className="rounded-xl overflow-hidden glass"
      >
        {/* Header row */}
        <div className="grid grid-cols-12 gap-2 px-5 py-2.5 border-b border-white/5">
          <span className="col-span-1 text-[0.5625rem] font-bold uppercase tracking-wider text-gray-500">#</span>
          <span className="col-span-1 text-[0.5625rem] font-bold uppercase tracking-wider text-gray-500">Av</span>
          <span className="col-span-5 text-[0.5625rem] font-bold uppercase tracking-wider text-gray-500">Player</span>
          <span className="col-span-5 text-[0.5625rem] font-bold uppercase tracking-wider text-gray-500 text-right">
            {TABS.find(t => t.key === metric)?.label}
          </span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-5 h-5 animate-spin text-cyan-400" />
          </div>
        ) : entries.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12">
            <Trophy className="w-8 h-8 text-gray-700 mb-2" />
            <p className="text-[0.6875rem] text-gray-600">No data yet</p>
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
                className="grid grid-cols-12 gap-2 items-center px-5 py-2.5 border-b border-white/[0.03] hover:bg-cyan-500/[0.06] transition-all"
              >
                {/* Rank */}
                <div className="col-span-1">
                  <span className={`inline-flex items-center justify-center w-6 h-6 rounded-md text-[0.625rem] font-bold border ${rankStyle}`}>
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
                <div className="col-span-5 min-w-0">
                  <span className="text-xs font-bold text-white truncate block">
                    {entry.displayName || entry.username}
                  </span>
                  <span className="text-[0.5625rem] text-gray-600 truncate block">@{entry.username}</span>
                </div>
                {/* Value */}
                <div className="col-span-5 text-right">
                  <span className={`text-sm font-bold font-mono ${rank <= 3 ? "text-cyan-400" : "text-white"}`}>
                    {metric === "chips" ? entry.value.toLocaleString() : entry.value}{tab.unit}
                  </span>
                </div>
              </motion.div>
            );
          })
        )}
      </div>
    </div>
  );
}
