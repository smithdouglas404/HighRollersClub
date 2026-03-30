import { useState } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { useClub } from "@/lib/club-context";
import {
  Trophy, Plus, Users, Coins, Clock, Loader2, X, Calendar
} from "lucide-react";

export function ClubTournaments() {
  const [, navigate] = useLocation();
  const { club, clubTournaments, isAdminOrOwner, createClubTournament } = useClub();
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);

  // Form state
  const [name, setName] = useState("");
  const [buyIn, setBuyIn] = useState(100);
  const [startingChips, setStartingChips] = useState(1500);
  const [maxPlayers, setMaxPlayers] = useState(8);
  const [startAt, setStartAt] = useState("");

  const upcoming = clubTournaments.filter(t => t.status === "registering" || t.status === "pending");
  const past = clubTournaments.filter(t => t.status === "complete" || t.status === "in_progress");

  const handleCreate = async () => {
    if (creating || !name.trim()) return;
    setCreating(true);
    const ok = await createClubTournament({
      name: name.trim(),
      buyIn,
      startingChips,
      maxPlayers,
      startAt: startAt || undefined,
    });
    if (ok) {
      setShowCreate(false);
      setName("");
      setBuyIn(100);
      setStartingChips(1500);
      setMaxPlayers(8);
      setStartAt("");
    }
    setCreating(false);
  };

  const handleRegister = async (tournamentId: string) => {
    try {
      const res = await fetch(`/api/tournaments/${tournamentId}/register`, { method: "POST" });
      if (!res.ok) {
        const d = await res.json().catch(() => ({ message: "Registration failed" }));
        alert(d.message);
      }
    } catch {
      alert("Registration failed");
    }
  };

  const [starting, setStarting] = useState<string | null>(null);

  const handleStart = async (tournamentId: string) => {
    if (starting) return;
    setStarting(tournamentId);
    try {
      const res = await fetch(`/api/tournaments/${tournamentId}/start`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        alert(data.message || "Failed to start tournament");
      } else {
        navigate(`/game/${data.tables?.[0]?.tableId ?? ""}`);
      }
    } catch {
      alert("Failed to start tournament");
    } finally {
      setStarting(null);
    }
  };

  if (!club) return null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold uppercase tracking-wider text-white flex items-center gap-2">
          <Trophy className="w-4 h-4 text-cyan-400" />
          Club Tournaments
        </h3>
        {isAdminOrOwner && (
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setShowCreate(true)}
            className="px-4 py-2 rounded-lg text-[0.625rem] font-bold uppercase tracking-wider text-black flex items-center gap-1.5"
            style={{
              background: "linear-gradient(135deg, #00d4ff, #66e5ff)",
              boxShadow: "0 0 15px rgba(0,212,255,0.2)",
            }}
          >
            <Plus className="w-3 h-3" />
            Create Tournament
          </motion.button>
        )}
      </div>

      {/* Create Modal */}
      <AnimatePresence>
        {showCreate && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
            onClick={() => setShowCreate(false)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              onClick={e => e.stopPropagation()}
              className="glass rounded-2xl p-6 border border-cyan-500/20 w-full max-w-md mx-4"
              style={{ boxShadow: "0 0 40px rgba(0,212,255,0.1)" }}
            >
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-sm font-bold uppercase tracking-wider text-white">New Tournament</h3>
                <button onClick={() => setShowCreate(false)} className="p-1 hover:bg-white/5 rounded">
                  <X className="w-4 h-4 text-gray-500" />
                </button>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-[0.625rem] font-bold uppercase tracking-wider text-gray-500 block mb-1">Name</label>
                  <input
                    type="text"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="Friday Night Showdown"
                    className="w-full px-3 py-2 rounded-lg text-xs text-white placeholder-gray-600 outline-none"
                    style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[0.625rem] font-bold uppercase tracking-wider text-gray-500 block mb-1">Buy-in</label>
                    <input
                      type="number"
                      value={buyIn}
                      onChange={e => setBuyIn(+e.target.value)}
                      className="w-full px-3 py-2 rounded-lg text-xs text-white font-mono outline-none"
                      style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
                    />
                  </div>
                  <div>
                    <label className="text-[0.625rem] font-bold uppercase tracking-wider text-gray-500 block mb-1">Starting Chips</label>
                    <input
                      type="number"
                      value={startingChips}
                      onChange={e => setStartingChips(+e.target.value)}
                      className="w-full px-3 py-2 rounded-lg text-xs text-white font-mono outline-none"
                      style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[0.625rem] font-bold uppercase tracking-wider text-gray-500 block mb-1">Max Players</label>
                    <input
                      type="number"
                      value={maxPlayers}
                      onChange={e => setMaxPlayers(+e.target.value)}
                      min={2}
                      max={100}
                      className="w-full px-3 py-2 rounded-lg text-xs text-white font-mono outline-none"
                      style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
                    />
                  </div>
                  <div>
                    <label className="text-[0.625rem] font-bold uppercase tracking-wider text-gray-500 block mb-1">Start Time</label>
                    <input
                      type="datetime-local"
                      value={startAt}
                      onChange={e => setStartAt(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg text-xs text-white outline-none"
                      style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
                    />
                  </div>
                </div>
              </div>

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleCreate}
                disabled={creating || !name.trim()}
                className="w-full mt-5 py-2.5 rounded-lg text-[0.625rem] font-bold uppercase tracking-wider text-black flex items-center justify-center gap-1.5 disabled:opacity-50"
                style={{ background: "linear-gradient(135deg, #00d4ff, #66e5ff)", boxShadow: "0 0 15px rgba(0,212,255,0.2)" }}
              >
                {creating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trophy className="w-3 h-3" />}
                Create Tournament
              </motion.button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Upcoming Tournaments */}
      {upcoming.length > 0 && (
        <div>
          <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-3">Upcoming</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {upcoming.map((t, i) => (
              <motion.div
                key={t.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="rounded-xl p-4 glass"
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h5 className="text-sm font-bold text-white">{t.name}</h5>
                    <span className="inline-block mt-1 px-2 py-0.5 rounded text-[0.5625rem] font-bold uppercase tracking-wider bg-cyan-500/15 text-cyan-400 border border-cyan-500/20">
                      {t.status}
                    </span>
                  </div>
                  <Trophy className="w-5 h-5 text-cyan-400/40" />
                </div>

                <div className="space-y-1.5 text-[0.625rem] text-gray-400">
                  <div className="flex items-center gap-1.5">
                    <Coins className="w-3 h-3 text-cyan-500/60" />
                    <span>Buy-in: <strong className="text-white">{t.buyIn.toLocaleString()}</strong></span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Users className="w-3 h-3 text-cyan-500/60" />
                    <span>{t.registeredCount} / {t.maxPlayers} registered</span>
                  </div>
                  {t.startAt && (
                    <div className="flex items-center gap-1.5">
                      <Calendar className="w-3 h-3 text-cyan-500/60" />
                      <span>{new Date(t.startAt).toLocaleString()}</span>
                    </div>
                  )}
                </div>

                {/* Progress bar */}
                <div className="mt-3 h-1.5 rounded-full bg-white/5 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-cyan-400 transition-all"
                    style={{ width: `${Math.min(100, (t.registeredCount / t.maxPlayers) * 100)}%` }}
                  />
                </div>

                <div className="flex gap-2 mt-3">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => handleRegister(t.id)}
                    className="flex-1 py-2 rounded-lg text-[0.625rem] font-bold uppercase tracking-wider text-cyan-400 border border-cyan-500/20 hover:bg-cyan-500/10 transition-colors"
                  >
                    Register
                  </motion.button>
                  {isAdminOrOwner && t.registeredCount >= 2 && (
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => handleStart(t.id)}
                      disabled={starting === t.id}
                      className="flex-1 py-2 rounded-lg text-[0.625rem] font-bold uppercase tracking-wider text-black disabled:opacity-50 flex items-center justify-center gap-1"
                      style={{
                        background: "linear-gradient(135deg, #00d4ff, #66e5ff)",
                        boxShadow: "0 0 15px rgba(0,212,255,0.2)",
                      }}
                    >
                      {starting === t.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trophy className="w-3 h-3" />}
                      Start
                    </motion.button>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* Past Tournaments */}
      {past.length > 0 && (
        <div>
          <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-3">Past</h4>
          <div className="rounded-xl overflow-hidden glass">
            {past.map((t, i) => (
              <div
                key={t.id}
                className={`flex items-center justify-between px-4 py-3 ${i < past.length - 1 ? "border-b border-white/[0.04]" : ""}`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-cyan-500/10 flex items-center justify-center">
                    <Trophy className="w-4 h-4 text-cyan-400/60" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-white">{t.name}</div>
                    <div className="text-[0.5625rem] text-gray-600 flex items-center gap-2">
                      <span>{t.registeredCount} players</span>
                      <span>Prize: {t.prizePool.toLocaleString()}</span>
                    </div>
                  </div>
                </div>
                <div className="text-[0.625rem] text-gray-500">
                  {new Date(t.createdAt).toLocaleDateString()}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {clubTournaments.length === 0 && (
        <div className="text-center py-12">
          <Trophy className="w-10 h-10 text-gray-700 mx-auto mb-3" />
          <p className="text-sm text-gray-500 mb-1">No tournaments yet</p>
          <p className="text-[0.625rem] text-gray-600">
            {isAdminOrOwner ? "Create a tournament to get started!" : "The club admin hasn't created any tournaments yet."}
          </p>
        </div>
      )}
    </div>
  );
}
