import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { DashboardLayout } from "@/components/DashboardLayout";
import { GoldCard, NumberTicker, StatCard, SectionHeader, GoldDivider } from "@/components/premium/PremiumComponents";
import { useToast } from "@/hooks/use-toast";
import {
  Trophy, Users, Layers, Coins, ArrowLeft, Loader2, Clock, RefreshCw, BarChart2, Crown,
} from "lucide-react";
import { TournamentAnalytics } from "@/components/tournament/TournamentAnalytics";

interface TournamentTableInfo {
  tableId: string;
  playerCount?: number;
  activePlayers?: number;
}

interface StandingsEntry {
  playerId: string;
  displayName?: string;
  chips: number;
  rank?: number;
  eliminated?: boolean;
}

interface TournamentStatus {
  tournamentId: string;
  status: string;
  totalPlayers?: number;
  remainingPlayers?: number;
  registrations?: number;
  maxPlayers?: number;
  prizePool?: number;
  tables: TournamentTableInfo[];
  standings: StandingsEntry[];
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  registration: { label: "Registration Open", color: "text-[#d4af37]" },
  registering: { label: "Registration Open", color: "text-[#d4af37]" },
  pending: { label: "Pending", color: "text-[#d4af37]" },
  in_progress: { label: "In Progress", color: "text-emerald-400" },
  running: { label: "Running", color: "text-emerald-400" },
  complete: { label: "Complete", color: "text-gray-400" },
  completed: { label: "Complete", color: "text-gray-400" },
  cancelled: { label: "Cancelled", color: "text-red-400" },
};

function getStatusStyle(status: string) {
  return STATUS_LABELS[status] ?? { label: status.replace(/_/g, " "), color: "text-gray-400" };
}

const POLL_INTERVAL = 10_000;

export default function TournamentDetail({ tournamentId }: { tournamentId: string }) {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [data, setData] = useState<TournamentStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchStatus = useCallback(async (showLoader = false) => {
    if (showLoader) setLoading(true);
    try {
      const res = await fetch(`/api/tournaments/${tournamentId}/status`, {
        credentials: "include",
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({ message: "Tournament not found" }));
        throw new Error(d.message);
      }
      const result: TournamentStatus = await res.json();
      setData(result);
      setError(null);
    } catch (err: any) {
      if (showLoader) {
        setError(err.message || "Failed to load tournament");
      }
    } finally {
      if (showLoader) setLoading(false);
    }
  }, [tournamentId]);

  // Initial fetch + polling
  useEffect(() => {
    fetchStatus(true);

    intervalRef.current = setInterval(() => {
      fetchStatus(false);
    }, POLL_INTERVAL);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchStatus]);

  // Stop polling when tournament is complete
  useEffect(() => {
    if (data && (data.status === "complete" || data.status === "completed" || data.status === "cancelled")) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }
  }, [data?.status]);

  const statusStyle = data ? getStatusStyle(data.status) : null;
  const playerCount = data?.totalPlayers ?? data?.registrations ?? 0;
  const remaining = data?.remainingPlayers ?? playerCount;
  const maxPlayers = data?.maxPlayers ?? 0;

  return (
    <DashboardLayout title="Tournament">
      <div className="px-4 md:px-8 pb-8">
        {/* Back button */}
        <motion.button
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          onClick={() => navigate("/tournaments")}
          className="flex items-center gap-2 mb-6 text-xs font-bold uppercase tracking-wider text-gray-500 hover:text-gray-300 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          All Tournaments
        </motion.button>

        {/* Loading */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-yellow-400 mb-3" />
            <p className="text-xs text-gray-500 tracking-wider uppercase">Loading tournament...</p>
          </div>
        )}

        {/* Error */}
        {!loading && error && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center py-20 text-center"
          >
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4 bg-red-500/10 border border-red-500/15">
              <Trophy className="w-8 h-8 text-red-400/50" />
            </div>
            <p className="text-sm font-bold text-red-400 uppercase tracking-wider mb-1">
              Failed to Load
            </p>
            <p className="text-xs text-gray-600 max-w-xs">{error}</p>
          </motion.div>
        )}

        {/* Tournament Data */}
        {!loading && !error && data && (
          <div className="space-y-6">
            {/* Header card */}
            <motion.div
              initial={{ opacity: 0, y: -16 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-xl p-6 vault-card"
            >
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 bg-[#d4af37]/15 gold-border">
                    <Trophy className="w-6 h-6 text-yellow-300 drop-shadow-[0_0_8px_rgba(201,168,76,0.5)]" />
                  </div>
                  <div>
                    <h2 className="text-lg font-black tracking-[0.14em] uppercase gold-text font-display">
                      Tournament #{data.tournamentId}
                    </h2>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`text-xs font-bold uppercase tracking-wider ${statusStyle!.color}`}>
                        {statusStyle!.label}
                      </span>
                      {data.status === "in_progress" || data.status === "running" ? (
                        <span className="flex items-center gap-1 text-[0.5625rem] text-gray-500">
                          <RefreshCw className="w-2.5 h-2.5 animate-spin" />
                          Live
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>

                {data.prizePool != null && (
                  <div className="text-right">
                    <div className="text-[0.5625rem] font-bold uppercase tracking-wider text-gray-500 mb-0.5">
                      Prize Pool
                    </div>
                    <div className="text-4xl font-black tabular-nums gold-text drop-shadow-[0_0_20px_rgba(212,175,55,0.3)]">
                      <NumberTicker value={data.prizePool} prefix="$" />
                    </div>
                  </div>
                )}
              </div>
            </motion.div>

            {/* Stats row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <StatCard
                icon={Users}
                label="Players"
                value={remaining !== playerCount
                  ? `${remaining} / ${playerCount}`
                  : `${playerCount}`}
              />
              <StatCard
                icon={Layers}
                label="Tables"
                value={`${data.tables.length}`}
              />
              <StatCard
                icon={Coins}
                label="Prize Pool"
                value={data.prizePool != null ? data.prizePool : "--"}
              />
              <StatCard
                icon={Clock}
                label="Status"
                value={statusStyle!.label}
              />
            </div>

            {/* Tables list */}
            {data.tables.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="rounded-xl overflow-hidden vault-card"
              >
                <div className="px-5 py-3.5 border-b border-white/[0.04]">
                  <h3 className="text-xs font-bold uppercase tracking-wider gold-text">
                    Active Tables
                  </h3>
                </div>
                <div className="divide-y divide-white/[0.04]">
                  {data.tables.map((table, i) => (
                    <motion.div
                      key={table.tableId}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.35 + i * 0.03 }}
                      className="flex items-center justify-between px-5 py-3 hover:bg-white/[0.02] transition-colors cursor-pointer"
                      onClick={() => navigate(`/game/${table.tableId}`)}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-purple-500/10 border border-purple-500/15 flex items-center justify-center">
                          <Layers className="w-4 h-4 text-purple-400" />
                        </div>
                        <div>
                          <div className="text-xs font-bold text-white">Table {i + 1}</div>
                          <div className="text-[0.5625rem] text-gray-500">
                            {table.playerCount ?? table.activePlayers ?? "?"} players
                          </div>
                        </div>
                      </div>
                      <span className="text-[0.5625rem] font-bold uppercase tracking-wider text-gray-600">
                        Spectate
                      </span>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Standings with Podium */}
            {data.standings.length > 0 && (() => {
              const top3 = data.standings.slice(0, 3);
              const rest = data.standings.slice(3);
              const podiumColors = [
                { border: "border-[#d4af37]", bg: "bg-[#d4af37]/10", text: "text-[#d4af37]", shadow: "shadow-[0_0_20px_rgba(212,175,55,0.3)]", label: "1st", size: "w-20 h-20" },
                { border: "border-gray-300", bg: "bg-gray-300/10", text: "text-gray-300", shadow: "shadow-[0_0_15px_rgba(192,192,192,0.2)]", label: "2nd", size: "w-16 h-16" },
                { border: "border-amber-600", bg: "bg-amber-600/10", text: "text-amber-600", shadow: "shadow-[0_0_15px_rgba(180,120,60,0.2)]", label: "3rd", size: "w-16 h-16" },
              ];
              // Display order: 2nd, 1st, 3rd
              const podiumOrder = top3.length >= 3 ? [1, 0, 2] : top3.length === 2 ? [1, 0] : [0];

              return (
                <motion.div
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                  className="space-y-4"
                >
                  {/* Podium */}
                  <GoldCard glow padding="p-6" className="overflow-hidden">
                    <SectionHeader icon={Trophy} title="Tournament Leaderboard" className="text-center mb-6" />

                    {/* Podium display */}
                    <div className="flex items-end justify-center gap-4 md:gap-8 mb-6">
                      {podiumOrder.map((idx) => {
                        if (idx >= top3.length) return null;
                        const entry = top3[idx];
                        const colors = podiumColors[idx];
                        const isFirst = idx === 0;
                        return (
                          <motion.div
                            key={entry.playerId}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.5 + idx * 0.1 }}
                            className="flex flex-col items-center"
                          >
                            {isFirst && (
                              <Crown className="w-6 h-6 text-[#d4af37] mb-1 drop-shadow-[0_0_8px_rgba(212,175,55,0.5)]" />
                            )}
                            {/* Avatar circle */}
                            <div className={`${colors.size} rounded-full ${colors.border} border-2 ${colors.bg} ${colors.shadow} flex items-center justify-center mb-2`}>
                              <span className={`text-lg font-black ${colors.text}`}>
                                {(entry.displayName || entry.playerId)[0]?.toUpperCase()}
                              </span>
                            </div>
                            {/* Rank badge */}
                            <span className={`text-[0.5rem] font-black uppercase tracking-wider ${colors.text} mb-1`}>
                              {colors.label}
                            </span>
                            {/* Name */}
                            <span className="text-xs font-bold text-white truncate max-w-[80px] text-center">
                              {entry.displayName || `Player ${entry.playerId.slice(0, 6)}`}
                            </span>
                            {/* Chips */}
                            <span className={`text-[0.625rem] font-bold tabular-nums ${colors.text} mt-0.5`}>
                              {entry.chips.toLocaleString()}
                            </span>
                            <span className="text-[0.5rem] text-gray-600">chips</span>
                          </motion.div>
                        );
                      })}
                    </div>
                  </GoldCard>

                  {/* Remaining standings table */}
                  {rest.length > 0 && (
                    <div className="vault-card overflow-hidden">
                      <div className="px-5 py-3.5 border-b border-white/[0.04]">
                        <h3 className="text-xs font-bold uppercase tracking-wider gold-text">
                          Standings
                        </h3>
                      </div>
                      {/* Table header */}
                      <div className="grid grid-cols-[3rem_1fr_auto] gap-4 px-5 py-2 border-b border-[#d4af37]/15" style={{ background: "rgba(212,175,55,0.06)" }}>
                        <span className="text-[0.5rem] font-bold uppercase tracking-wider text-[#d4af37]/70">Rank</span>
                        <span className="text-[0.5rem] font-bold uppercase tracking-wider text-[#d4af37]/70">Player</span>
                        <span className="text-[0.5rem] font-bold uppercase tracking-wider text-[#d4af37]/70 text-right">Chips</span>
                      </div>
                      <div className="divide-y divide-white/[0.04]">
                        {rest.map((entry, i) => {
                          const rank = (entry.rank ?? i + 4);
                          return (
                            <div
                              key={entry.playerId}
                              className={`grid grid-cols-[3rem_1fr_auto] gap-4 px-5 py-3 ${
                                entry.eliminated ? "opacity-50" : "hover:bg-white/[0.02]"
                              } transition-colors`}
                            >
                              <span className="text-sm font-black tabular-nums text-gray-500">
                                {rank}
                              </span>
                              <div>
                                <div className="text-xs font-bold text-white">
                                  {entry.displayName || `Player ${entry.playerId.slice(0, 6)}`}
                                </div>
                                {entry.eliminated && (
                                  <span className="text-[0.5rem] font-bold uppercase text-red-400/60">Eliminated</span>
                                )}
                              </div>
                              <div className="text-sm font-bold tabular-nums text-white text-right">
                                {entry.chips.toLocaleString()}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </motion.div>
              );
            })()}
          </div>
        )}
        {/* Tournament Analytics Section */}
        {tournamentId && (
          <div className="mt-6">
            <h2 className="text-lg font-display font-black mb-4 flex items-center gap-2 gold-text">
              <BarChart2 className="w-5 h-5 text-[#d4af37]" /> Prize Pool & Analytics
            </h2>
            <TournamentAnalytics tournamentId={tournamentId} />
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
