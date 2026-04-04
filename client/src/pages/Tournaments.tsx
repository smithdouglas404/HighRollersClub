import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link, useLocation } from "wouter";
import { DashboardLayout } from "@/components/DashboardLayout";
import { PageBackground } from "@/components/shared/PageBackground";
import { Trophy, Clock, Users, Flame, Plus, Gamepad2, Timer } from "lucide-react";

interface Tournament {
  id: number;
  name: string;
  gameFormat: string;
  pokerVariant?: string;
  status: string;
  scheduledStartTime?: string;
  prizePool?: number;
  buyInAmount: number;
  startingChips?: number;
  maxPlayers: number;
  registeredPlayers?: number;
  blindSchedule?: string;
  clubId?: number;
  clubName?: string;
}

const VARIANT_LABELS: Record<string, string> = {
  nlhe: "NLHE",
  plo: "PLO",
  plo5: "PLO5",
  short_deck: "Short Deck",
  "short-deck": "Short Deck",
  shortdeck: "Short Deck",
};

function getVariantLabel(variant?: string): string {
  if (!variant) return "NLHE";
  return VARIANT_LABELS[variant.toLowerCase()] || variant.toUpperCase();
}

function formatStartTime(iso?: string): string {
  if (!iso) return "TBD";
  const date = new Date(iso);
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function calculatePrizePool(t: Tournament): number {
  return t.prizePool || t.buyInAmount * t.maxPlayers;
}

/** Live countdown that ticks every second */
function useCountdown(iso?: string): string | null {
  const calc = useCallback(() => {
    if (!iso) return null;
    const ms = new Date(iso).getTime() - Date.now();
    if (ms <= 0) return null;
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    const s = Math.floor((ms % 60000) / 1000);
    if (h > 24) {
      const d = Math.floor(h / 24);
      return `${d}d ${h % 24}h`;
    }
    return `${h}h ${m}m ${s}s`;
  }, [iso]);

  const [display, setDisplay] = useState(calc);
  useEffect(() => {
    if (!iso) return;
    setDisplay(calc());
    const id = setInterval(() => setDisplay(calc()), 1000);
    return () => clearInterval(id);
  }, [iso, calc]);
  return display;
}

function CountdownBadge({ iso }: { iso?: string }) {
  const text = useCountdown(iso);
  if (!text) return null;
  return (
    <span className="inline-flex items-center gap-1 text-[0.5625rem] font-bold text-amber-400 tabular-nums">
      <Timer className="w-3 h-3" />
      {text}
    </span>
  );
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.07,
    },
  },
};

const cardVariants = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: "easeOut" as const },
  },
};

export default function Tournaments() {
  const [, navigate] = useLocation();
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<"all" | "upcoming" | "running" | "completed">("all");

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch("/api/tournaments")
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load tournaments");
        return res.json();
      })
      .then((data) => setTournaments(data))
      .catch((err) => {
        setTournaments([]);
        setError(err.message || "Something went wrong");
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <DashboardLayout title="Tournaments">
      <PageBackground image="/images/generated/tournament-center-bg.png" />
      <div className="relative z-10 px-4 md:px-8 pb-8">
        {/* ── Header ─────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="relative mb-8 overflow-hidden rounded-xl p-6 bg-surface-high/50 backdrop-blur-xl border border-yellow-500/20"
        >
          {/* Decorative gold glow */}
          <div className="absolute -top-12 -right-12 w-48 h-48 rounded-full opacity-10 pointer-events-none bg-gradient-radial from-yellow-300 to-transparent" />

          <div className="relative z-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-4">
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 bg-yellow-500/15 border border-yellow-500/20"
              >
                <Trophy className="w-6 h-6 text-yellow-300 drop-shadow-[0_0_8px_rgba(201,168,76,0.5)]" />
              </div>
              <div>
                <h2
                  className="text-lg font-black tracking-[0.14em] uppercase gold-text font-display"
                >
                  TOURNAMENTS
                </h2>
                <p className="text-xs text-gray-400 mt-0.5">
                  High stakes scheduled events. Compete for massive prize pools.
                </p>
              </div>
            </div>

            <Link href="/tournaments/new">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-[0.625rem] font-bold uppercase tracking-wider shrink-0 bg-gradient-to-r from-yellow-600 to-yellow-400 text-black shadow-[0_0_20px_rgba(212,175,55,0.3)]"
              >
                <Plus className="w-3.5 h-3.5" />
                Create Tournament
              </motion.button>
            </Link>
          </div>
        </motion.div>

        {/* ── Status Filter Tabs ─────────────────────────────────── */}
        <div className="flex items-center gap-2 mb-6">
          {(["all", "upcoming", "running", "completed"] as const).map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`px-4 py-1.5 rounded-full text-[0.625rem] font-bold uppercase tracking-wider transition-all ${
                statusFilter === status
                  ? "bg-yellow-500/15 text-yellow-300 border border-yellow-500/30 shadow-[0_0_10px_rgba(212,175,55,0.15)]"
                  : "text-gray-500 border border-white/[0.06] hover:text-gray-300 hover:border-white/15"
              }`}
            >
              {status === "all" ? "All" : status.charAt(0).toUpperCase() + status.slice(1)}
            </button>
          ))}
        </div>

        {/* ── Loading State ──────────────────────────────────────── */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-yellow-500/40 border-t-transparent rounded-full animate-spin mb-3" />
            <p className="text-xs text-gray-500 tracking-wider uppercase">Loading tournaments...</p>
          </div>
        )}

        {/* ── Error State ────────────────────────────────────────── */}
        {!loading && error && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center py-20 text-center"
          >
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4 bg-red-500/10 border border-red-500/15"
            >
              <Trophy className="w-8 h-8 text-red-400/50" />
            </div>
            <p className="text-sm font-bold text-red-400 uppercase tracking-wider mb-1">
              Failed to Load
            </p>
            <p className="text-xs text-gray-600 max-w-xs">{error}</p>
          </motion.div>
        )}

        {/* ── Empty State ────────────────────────────────────────── */}
        {!loading && !error && tournaments.length === 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center py-20 text-center"
          >
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4 bg-yellow-500/10 border border-yellow-500/15"
            >
              <Trophy className="w-8 h-8 text-yellow-400/60" />
            </div>
            <h3
              className="text-sm font-bold uppercase tracking-wider mb-1 gold-text"
            >
              No Tournaments
            </h3>
            <p className="text-xs text-gray-600 max-w-xs">
              No tournaments are scheduled right now. Create one to get started.
            </p>
          </motion.div>
        )}

        {/* ── Tournament Cards ───────────────────────────────────── */}
        {!loading && !error && tournaments.length > 0 && (() => {
          const filtered = tournaments.filter((t) => {
            if (statusFilter === "all") return true;
            if (statusFilter === "upcoming") return t.status === "registration" || t.status === "upcoming";
            if (statusFilter === "running") return t.status === "running" || t.status === "in_progress";
            if (statusFilter === "completed") return t.status === "completed" || t.status === "finished";
            return true;
          });

          if (filtered.length === 0) {
            return (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col items-center justify-center py-16 text-center"
              >
                <Trophy className="w-8 h-8 text-gray-700 mb-2" />
                <p className="text-xs text-gray-600">
                  No {statusFilter} tournaments found.
                </p>
              </motion.div>
            );
          }

          return (
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="flex flex-col gap-4"
            key={statusFilter}
          >
            {filtered.map((tournament) => {
              const prizePool = calculatePrizePool(tournament);
              const isRegOpen = tournament.status === "registration";
              const registered = tournament.registeredPlayers ?? 0;

              return (
                <motion.div
                  key={tournament.id}
                  variants={cardVariants}
                  whileHover={{ scale: 1.005, y: -2 }}
                  className="rounded-xl overflow-hidden transition-all cursor-pointer card-hover"
                  style={{
                    background: "rgba(15,15,20,0.7)",
                    backdropFilter: "blur(12px)",
                    WebkitBackdropFilter: "blur(12px)",
                    border: "1px solid rgba(212,175,55,0.12)",
                  }}
                  onClick={() => navigate(`/tournaments/${tournament.id}`)}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center gap-4 p-5">
                    {/* Left section: Badges + Name + Time */}
                    <div className="flex-1 min-w-0">
                      {/* Badges row */}
                      <div className="flex items-center gap-2 mb-2">
                        {/* Game variant badge */}
                        <span
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[0.5rem] font-bold uppercase tracking-wider bg-yellow-500/10 border border-yellow-500/20 text-yellow-300"
                        >
                          <Gamepad2 className="w-3 h-3" />
                          {getVariantLabel(tournament.pokerVariant)}
                        </span>

                        {/* Registration status badge */}
                        {isRegOpen && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[0.5rem] font-bold uppercase tracking-wider bg-emerald-500/15 text-emerald-400 border border-emerald-500/20" style={{ boxShadow: "0 0 8px rgba(16,185,129,0.15)" }}>
                            <Flame className="w-3 h-3" />
                            REG OPEN
                          </span>
                        )}

                        {!isRegOpen && tournament.status && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[0.5rem] font-bold uppercase tracking-wider bg-white/5 text-gray-400 border border-white/[0.06]">
                            {tournament.status.replace(/_/g, " ")}
                          </span>
                        )}

                        {/* GTD badge */}
                        {(tournament.prizePool ?? 0) > 0 && (tournament.status === "registration" || tournament.status === "upcoming") && (
                          <span className="px-1.5 py-0.5 rounded text-[0.4375rem] font-bold uppercase bg-amber-500/15 text-amber-400 border border-amber-500/20">GTD</span>
                        )}
                      </div>

                      {/* Tournament name */}
                      <h3 className="text-base sm:text-lg font-bold text-white tracking-wide truncate">
                        {tournament.name}
                      </h3>

                      {/* Start time + live countdown */}
                      <div className="flex items-center gap-2 mt-1.5 text-[0.6875rem] text-gray-500">
                        <Clock className="w-3.5 h-3.5" />
                        <span>{formatStartTime(tournament.scheduledStartTime)}</span>
                        {(tournament.status === "registration" || tournament.status === "upcoming") && (
                          <CountdownBadge iso={tournament.scheduledStartTime} />
                        )}
                      </div>
                    </div>

                    {/* Middle section: Prize Pool */}
                    <div className="sm:text-center shrink-0 sm:px-6">
                      <div className="text-[0.5625rem] font-bold uppercase tracking-wider text-gray-500 mb-0.5">
                        Prize Pool
                      </div>
                      <div
                        className="text-2xl sm:text-3xl font-black tabular-nums gold-text"
                      >
                        {prizePool.toLocaleString()}
                      </div>
                      <div className="text-[0.5625rem] text-gray-600 mt-0.5">
                        Buy-in: {tournament.buyInAmount.toLocaleString()} chips
                      </div>
                    </div>

                    {/* Right section: Players + Register */}
                    <div className="flex sm:flex-col items-center sm:items-end gap-3 sm:gap-2 shrink-0">
                      {/* Registered players */}
                      <div className="flex items-center gap-1.5 text-xs text-gray-400">
                        <Users className="w-3.5 h-3.5" />
                        <span className="tabular-nums font-semibold">
                          {registered}
                          <span className="text-gray-600"> / {tournament.maxPlayers}</span>
                        </span>
                      </div>

                      {/* Register button */}
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/tournaments/${tournament.id}`);
                        }}
                        className={`px-5 py-2 rounded-lg text-[0.625rem] font-bold uppercase tracking-wider ${
                          isRegOpen
                            ? "bg-gradient-to-r from-yellow-600 to-yellow-400 text-black shadow-[0_0_20px_rgba(212,175,55,0.3)]"
                            : "bg-yellow-500/20 text-yellow-300"
                        }`}
                      >
                        Register
                      </motion.button>
                    </div>
                  </div>

                  {/* Registration progress bar */}
                  <div className="mx-5 mb-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[0.5rem] font-bold uppercase tracking-wider text-gray-600">
                        Registration
                      </span>
                      <span className="text-[0.5rem] font-bold tabular-nums text-gray-500">
                        {registered}/{tournament.maxPlayers} ({Math.round((registered / tournament.maxPlayers) * 100)}%)
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                      <motion.div
                        className="h-full rounded-full"
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.min((registered / tournament.maxPlayers) * 100, 100)}%` }}
                        transition={{ duration: 0.8, ease: "easeOut" }}
                        style={{
                          background: registered >= tournament.maxPlayers
                            ? "linear-gradient(90deg, #dc2626, #ef4444)"
                            : registered >= tournament.maxPlayers * 0.8
                              ? "linear-gradient(90deg, #d97706, #f59e0b)"
                              : "linear-gradient(90deg, rgba(212,175,55,0.6), rgba(212,175,55,0.9))",
                        }}
                      />
                    </div>
                  </div>

                  {/* Subtle bottom gold accent line */}
                  <div
                    className="h-px w-full bg-gradient-to-r from-transparent via-yellow-500/15 to-transparent"
                  />
                </motion.div>
              );
            })}
          </motion.div>
          );
        })()}
      </div>
    </DashboardLayout>
  );
}
