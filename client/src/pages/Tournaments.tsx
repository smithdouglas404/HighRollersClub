import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Link, useLocation } from "wouter";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Trophy, Clock, Users, Flame, Plus, Gamepad2 } from "lucide-react";

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
    transition: { duration: 0.4, ease: "easeOut" },
  },
};

export default function Tournaments() {
  const [, navigate] = useLocation();
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
      <div className="px-4 md:px-8 pb-8">
        {/* ── Header ─────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="relative mb-8 overflow-hidden rounded-xl p-6"
          style={{
            background:
              "linear-gradient(135deg, rgba(201,168,76,0.08) 0%, rgba(20,31,40,0.90) 40%, rgba(16,24,36,0.95) 100%)",
            border: "1px solid rgba(201,168,76,0.15)",
            boxShadow: "0 10px 40px rgba(0,0,0,0.3), 0 0 60px rgba(201,168,76,0.04)",
          }}
        >
          {/* Decorative gold glow */}
          <div className="absolute -top-12 -right-12 w-48 h-48 rounded-full opacity-10 pointer-events-none" style={{ background: "radial-gradient(circle, #f0d48a 0%, transparent 70%)" }} />

          <div className="relative z-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-4">
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
                style={{
                  background: "linear-gradient(135deg, rgba(201,168,76,0.20), rgba(240,212,138,0.10))",
                  border: "1px solid rgba(201,168,76,0.25)",
                }}
              >
                <Trophy className="w-6 h-6 drop-shadow-[0_0_8px_rgba(201,168,76,0.5)]" style={{ color: "#f0d48a" }} />
              </div>
              <div>
                <h2
                  className="text-lg font-black tracking-[0.14em] uppercase"
                  style={{
                    background: "linear-gradient(135deg, #c9a84c, #f0d48a)",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                  }}
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
                className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-[0.625rem] font-bold uppercase tracking-wider text-black shrink-0"
                style={{
                  background: "linear-gradient(135deg, #c9a84c, #f0d48a)",
                  boxShadow: "0 0 20px rgba(201,168,76,0.3)",
                }}
              >
                <Plus className="w-3.5 h-3.5" />
                Create Tournament
              </motion.button>
            </Link>
          </div>
        </motion.div>

        {/* ── Loading State ──────────────────────────────────────── */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin mb-3" style={{ borderColor: "rgba(201,168,76,0.4)", borderTopColor: "transparent" }} />
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
              className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
              style={{
                background: "rgba(239,68,68,0.08)",
                border: "1px solid rgba(239,68,68,0.15)",
              }}
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
              className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
              style={{
                background: "rgba(201,168,76,0.08)",
                border: "1px solid rgba(201,168,76,0.15)",
              }}
            >
              <Trophy className="w-8 h-8" style={{ color: "rgba(201,168,76,0.4)" }} />
            </div>
            <h3
              className="text-sm font-bold uppercase tracking-wider mb-1"
              style={{
                background: "linear-gradient(135deg, #c9a84c, #f0d48a)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              No Tournaments
            </h3>
            <p className="text-xs text-gray-600 max-w-xs">
              No tournaments are scheduled right now. Create one to get started.
            </p>
          </motion.div>
        )}

        {/* ── Tournament Cards ───────────────────────────────────── */}
        {!loading && !error && tournaments.length > 0 && (
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="flex flex-col gap-4"
          >
            {tournaments.map((tournament) => {
              const prizePool = calculatePrizePool(tournament);
              const isRegOpen = tournament.status === "registration";
              const registered = tournament.registeredPlayers ?? 0;

              return (
                <motion.div
                  key={tournament.id}
                  variants={cardVariants}
                  whileHover={{ scale: 1.005, y: -2 }}
                  className="rounded-xl overflow-hidden transition-all cursor-pointer"
                  style={{
                    background: "rgba(255,255,255,0.03)",
                    border: "1px solid rgba(255,255,255,0.05)",
                    boxShadow:
                      "0 8px 32px rgba(0,0,0,0.25), 0 0 0 0.5px rgba(201,168,76,0.06) inset",
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
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[0.5rem] font-bold uppercase tracking-wider"
                          style={{
                            background: "rgba(201,168,76,0.12)",
                            border: "1px solid rgba(201,168,76,0.20)",
                            color: "#f0d48a",
                          }}
                        >
                          <Gamepad2 className="w-3 h-3" />
                          {getVariantLabel(tournament.pokerVariant)}
                        </span>

                        {/* Registration status badge */}
                        {isRegOpen && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[0.5rem] font-bold uppercase tracking-wider bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
                            <Flame className="w-3 h-3" />
                            REG OPEN
                          </span>
                        )}

                        {!isRegOpen && tournament.status && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[0.5rem] font-bold uppercase tracking-wider bg-white/5 text-gray-400 border border-white/10">
                            {tournament.status.replace(/_/g, " ")}
                          </span>
                        )}
                      </div>

                      {/* Tournament name */}
                      <h3 className="text-base sm:text-lg font-bold text-white tracking-wide truncate">
                        {tournament.name}
                      </h3>

                      {/* Start time */}
                      <div className="flex items-center gap-1.5 mt-1.5 text-[0.6875rem] text-gray-500">
                        <Clock className="w-3.5 h-3.5" />
                        <span>{formatStartTime(tournament.scheduledStartTime)}</span>
                      </div>
                    </div>

                    {/* Middle section: Prize Pool */}
                    <div className="sm:text-center shrink-0 sm:px-6">
                      <div className="text-[0.5625rem] font-bold uppercase tracking-wider text-gray-500 mb-0.5">
                        Prize Pool
                      </div>
                      <div
                        className="text-2xl sm:text-3xl font-black tabular-nums"
                        style={{
                          background: "linear-gradient(135deg, #c9a84c, #f0d48a)",
                          WebkitBackgroundClip: "text",
                          WebkitTextFillColor: "transparent",
                          filter: "drop-shadow(0 0 12px rgba(201,168,76,0.2))",
                        }}
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
                        className="px-5 py-2 rounded-lg text-[0.625rem] font-bold uppercase tracking-wider text-black"
                        style={{
                          background: isRegOpen
                            ? "linear-gradient(135deg, #c9a84c, #f0d48a)"
                            : "linear-gradient(135deg, rgba(201,168,76,0.3), rgba(240,212,138,0.2))",
                          boxShadow: isRegOpen
                            ? "0 0 16px rgba(201,168,76,0.25)"
                            : "none",
                          color: isRegOpen ? "#000" : "rgba(201,168,76,0.6)",
                        }}
                      >
                        Register
                      </motion.button>
                    </div>
                  </div>

                  {/* Subtle bottom gold accent line */}
                  <div
                    className="h-px w-full"
                    style={{
                      background:
                        "linear-gradient(to right, transparent, rgba(201,168,76,0.15) 30%, rgba(201,168,76,0.15) 70%, transparent)",
                    }}
                  />
                </motion.div>
              );
            })}
          </motion.div>
        )}
      </div>
    </DashboardLayout>
  );
}
