import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useClub } from "@/lib/club-context";
import { GoldButton, GoldCard, NumberTicker, StatCard, SectionHeader, GoldDivider } from "@/components/premium/PremiumComponents";
import {
  Trophy, Users, Flame, Loader2, Medal, Crown,
  BarChart3, TrendingUp, Swords, Target
} from "lucide-react";
import { cn } from "@/lib/utils";

type SortKey = "hands" | "winRate" | "active" | "tournaments";

const SORT_TABS: { key: SortKey; label: string; icon: any }[] = [
  { key: "hands", label: "By Hands", icon: BarChart3 },
  { key: "winRate", label: "By Win Rate", icon: TrendingUp },
  { key: "active", label: "By Active Players", icon: Users },
  { key: "tournaments", label: "By Tournaments", icon: Trophy },
];

interface ClubRanking {
  clubId: string;
  clubName: string;
  memberCount: number;
  activePlayers7d: number;
  totalHandsPlayed: number;
  combinedWinRate: number;
  totalChipsWon: number;
  tournamentWins: number;
  rank: number;
}

const PODIUM_STYLES = {
  1: {
    ring: "#d4af37",
    bg: "linear-gradient(135deg, rgba(212,175,55,0.25) 0%, rgba(154,123,44,0.12) 100%)",
    glow: "rgba(212,175,55,0.4)",
    label: "1ST",
    icon: Crown,
  },
  2: {
    ring: "#94a3b8",
    bg: "linear-gradient(135deg, rgba(148,163,184,0.20) 0%, rgba(100,116,139,0.10) 100%)",
    glow: "rgba(148,163,184,0.3)",
    label: "2ND",
    icon: Medal,
  },
  3: {
    ring: "#cd7f32",
    bg: "linear-gradient(135deg, rgba(205,127,50,0.20) 0%, rgba(160,100,40,0.10) 100%)",
    glow: "rgba(205,127,50,0.3)",
    label: "3RD",
    icon: Medal,
  },
} as const;

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

function getSortValue(club: ClubRanking, sortKey: SortKey): number {
  switch (sortKey) {
    case "hands": return club.totalHandsPlayed;
    case "winRate": return club.combinedWinRate;
    case "active": return club.activePlayers7d;
    case "tournaments": return club.tournamentWins;
  }
}

export default function ClubRankings() {
  const { allClubs } = useClub();
  const [rankings, setRankings] = useState<ClubRanking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("hands");

  const myClubIds = new Set(allClubs.map(c => c.id));

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch("/api/clubs/rankings")
      .then(r => {
        if (!r.ok) throw new Error("Failed to load club rankings");
        return r.json();
      })
      .then(data => setRankings(data))
      .catch(err => { setRankings([]); setError(err.message); })
      .finally(() => setLoading(false));
  }, []);

  // Re-sort locally based on selected tab
  const sorted = [...rankings].sort((a, b) => getSortValue(b, sortKey) - getSortValue(a, sortKey))
    .map((r, i) => ({ ...r, rank: i + 1 }));

  const top3 = sorted.slice(0, 3);
  const rest = sorted.slice(3);
  const maxHands = sorted.length > 0 ? getSortValue(sorted[0], sortKey) : 1;

  return (
    <DashboardLayout title="Club Rankings">
      <div className="px-4 md:px-8 pb-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative mb-6 overflow-hidden rounded-xl border border-primary/10 p-5"
          style={{
            background: "rgba(15,15,20,0.7)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
          }}
        >
          <div className="absolute -right-6 -top-6 w-32 h-32 opacity-10 pointer-events-none">
            <Trophy className="w-full h-full text-primary" />
          </div>
          <div className="relative">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-primary/10 border border-primary/20">
                <Trophy className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl md:text-3xl font-display font-bold"
                  style={{
                    background: "linear-gradient(135deg, #d4af37, #f5e6a3, #b8960c)",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                  }}
                >
                  Club Rankings
                </h1>
                <p className="text-muted-foreground text-sm">See how clubs stack up against each other</p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Sort Tabs */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2 scrollbar-hide">
          {SORT_TABS.map(tab => {
            const Icon = tab.icon;
            const active = sortKey === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setSortKey(tab.key)}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold uppercase tracking-wider whitespace-nowrap transition-all duration-200",
                  active
                    ? "border border-[#d4af37]/40 text-[#d4af37]"
                    : "bg-white/[0.03] text-muted-foreground border border-white/[0.06] hover:bg-white/[0.06] hover:text-foreground"
                )}
                style={active ? { background: "rgba(212,175,55,0.12)", boxShadow: "0 0 12px rgba(212,175,55,0.15)" } : undefined}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Loading State */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
            <Loader2 className="w-8 h-8 animate-spin mb-3 text-primary" />
            <p className="text-sm">Loading club rankings...</p>
          </div>
        )}

        {/* Error State */}
        {!loading && error && (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
            <Swords className="w-10 h-10 mb-3 opacity-40" />
            <p className="text-sm">{error}</p>
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && rankings.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
            <Trophy className="w-12 h-12 mb-3 opacity-30" />
            <p className="text-lg font-display font-bold mb-1">No clubs yet</p>
            <p className="text-sm">Create or join a club to start competing!</p>
          </div>
        )}

        {/* Podium - Top 3 */}
        {!loading && !error && sorted.length > 0 && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
              {/* Render in order: 2nd, 1st, 3rd on desktop for podium effect */}
              {[1, 0, 2].map((idx) => {
                const club = top3[idx];
                if (!club) return <div key={idx} />;
                const style = PODIUM_STYLES[(club.rank as 1 | 2 | 3)] || PODIUM_STYLES[3];
                const PodiumIcon = style.icon;
                const isMyClub = myClubIds.has(club.clubId);
                return (
                  <motion.div
                    key={club.clubId}
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    whileHover={{ scale: 1.02, y: -4 }}
                    transition={{ delay: 0.1 + idx * 0.1, type: "spring", stiffness: 260, damping: 20 }}
                    className={cn(
                      "relative rounded-xl p-5 border-2 overflow-hidden",
                      club.rank === 1 && "md:order-2 md:-mt-4",
                      club.rank === 2 && "md:order-1",
                      club.rank === 3 && "md:order-3",
                      isMyClub && "ring-2 ring-primary/50"
                    )}
                    style={{
                      background: style.bg,
                      borderColor: style.ring,
                      boxShadow: `0 0 ${club.rank === 1 ? "40px" : "25px"} ${style.glow}, inset 0 1px 0 ${style.ring}22`,
                    }}
                  >
                    {isMyClub && (
                      <div className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-primary/20 text-primary text-[10px] font-bold uppercase tracking-wider border border-primary/30">
                        Your Club
                      </div>
                    )}
                    <div className="flex flex-col items-center text-center">
                      {/* Rank badge */}
                      <div
                        className="w-14 h-14 rounded-full flex items-center justify-center mb-3 border-2"
                        style={{
                          borderColor: style.ring,
                          background: `${style.ring}22`,
                          boxShadow: `0 0 20px ${style.glow}`,
                        }}
                      >
                        <PodiumIcon className="w-6 h-6" style={{ color: style.ring }} />
                      </div>
                      <span className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: style.ring }}>
                        {style.label}
                      </span>
                      <h3 className="text-lg font-display font-bold text-white mb-1 truncate max-w-full">
                        {club.clubName}
                      </h3>
                      <div className="text-2xl font-display font-bold mb-2" style={{ color: style.ring }}>
                        {formatNumber(getSortValue(club, sortKey))}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Users className="w-3 h-3" />
                          {club.memberCount}
                        </span>
                        <span className="flex items-center gap-1">
                          <Flame className="w-3 h-3 text-secondary" />
                          {club.activePlayers7d} active
                        </span>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>

            {/* Full Table */}
            <div
              className="rounded-xl border border-white/[0.06] overflow-hidden"
              style={{ background: "rgba(15,15,20,0.6)", backdropFilter: "blur(12px)" }}
            >
              {/* Table Header */}
              <div className="grid grid-cols-[3rem_1fr_4.5rem_4.5rem_5.5rem_4.5rem_5.5rem_4.5rem] gap-2 px-4 py-3 text-[10px] font-bold uppercase tracking-widest border-b border-[rgba(212,175,55,0.15)]" style={{ color: "#d4af37", background: "rgba(212,175,55,0.06)" }}>
                <span>#</span>
                <span>Club</span>
                <span className="text-right">Members</span>
                <span className="text-right">Active</span>
                <span className="text-right">Hands</span>
                <span className="text-right">Win %</span>
                <span className="text-right">Chips Won</span>
                <span className="text-right">Tourney W</span>
              </div>

              {/* Table Rows */}
              <AnimatePresence mode="popLayout">
                {sorted.map((club, i) => {
                  const isMyClub = myClubIds.has(club.clubId);
                  const barWidth = maxHands > 0
                    ? Math.max(2, (getSortValue(club, sortKey) / maxHands) * 100)
                    : 0;
                  return (
                    <motion.div
                      key={club.clubId}
                      layout
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className={cn(
                        "grid grid-cols-[3rem_1fr_4.5rem_4.5rem_5.5rem_4.5rem_5.5rem_4.5rem] gap-2 px-4 py-3 text-sm items-center relative transition-colors",
                        i % 2 === 0 ? "bg-transparent" : "bg-white/[0.015]",
                        isMyClub && "bg-primary/[0.06] border-l-2 border-l-primary",
                        "hover:bg-white/[0.04]"
                      )}
                    >
                      {/* Progress bar background */}
                      <div
                        className="absolute inset-y-0 left-0 opacity-[0.04] pointer-events-none"
                        style={{
                          width: `${barWidth}%`,
                          background: isMyClub
                            ? "linear-gradient(90deg, rgba(212,175,55,0.6), rgba(212,175,55,0.1))"
                            : "linear-gradient(90deg, rgba(148,163,184,0.4), rgba(148,163,184,0.05))",
                        }}
                      />

                      {/* Rank */}
                      <span className={cn(
                        "font-display font-bold relative",
                        club.rank === 1 && "text-amber-400",
                        club.rank === 2 && "text-gray-300",
                        club.rank === 3 && "text-orange-400",
                        club.rank > 3 && "text-muted-foreground"
                      )}>
                        {club.rank}
                      </span>

                      {/* Club Name */}
                      <span className={cn(
                        "font-bold truncate relative",
                        isMyClub ? "text-primary" : "text-white"
                      )}>
                        {club.clubName}
                        {isMyClub && (
                          <span className="ml-2 text-[9px] font-bold uppercase tracking-wider text-primary/70 bg-primary/10 px-1.5 py-0.5 rounded-full">
                            You
                          </span>
                        )}
                      </span>

                      {/* Members */}
                      <span className="text-right text-muted-foreground relative">{club.memberCount}</span>

                      {/* Active 7d */}
                      <span className="text-right relative">
                        <span className={cn(
                          "text-sm",
                          club.activePlayers7d > 0 ? "text-secondary" : "text-muted-foreground/50"
                        )}>
                          {club.activePlayers7d}
                        </span>
                      </span>

                      {/* Hands Played */}
                      <span className="text-right text-foreground font-medium relative">
                        {formatNumber(club.totalHandsPlayed)}
                      </span>

                      {/* Win Rate */}
                      <span className="text-right relative">
                        <span className={cn(
                          club.combinedWinRate >= 25 ? "text-secondary" : "text-muted-foreground"
                        )}>
                          {club.combinedWinRate}%
                        </span>
                      </span>

                      {/* Chips Won */}
                      <span className="text-right text-foreground font-medium relative">
                        {formatNumber(club.totalChipsWon)}
                      </span>

                      {/* Tournament Wins */}
                      <span className="text-right relative">
                        <span className={cn(
                          "font-bold",
                          club.tournamentWins > 0 ? "text-amber-400" : "text-muted-foreground/40"
                        )}>
                          {club.tournamentWins}
                        </span>
                      </span>
                    </motion.div>
                  );
                })}
              </AnimatePresence>

              {/* Empty bottom */}
              {sorted.length === 0 && !loading && (
                <div className="py-12 text-center text-muted-foreground text-sm">
                  No clubs to display.
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
