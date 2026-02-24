import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useAuth } from "@/lib/auth-context";
import {
  Trophy, Brain, TrendingUp, CheckCircle,
  AlertTriangle, Play, Clock, Users, Zap,
  Target, Gamepad2, Coins, ChevronRight, X, Plus, Loader2
} from "lucide-react";

import feltTexture from "@assets/generated_images/poker_table_top_cinematic.png";
import lionLogo from "@assets/generated_images/lion_crest_gold_emblem.png";

const MISSION_DEFS = [
  { id: "1", icon: Gamepad2, label: "Play 50 Hands", target: 50, statKey: "handsPlayed" as const, reward: 200 },
  { id: "2", icon: Coins, label: "Win 20 Pots", target: 20, statKey: "potsWon" as const, reward: 500 },
  { id: "3", icon: Target, label: "Win Streak 5", target: 5, statKey: "bestWinStreak" as const, reward: 750 },
];

interface PlayerStats {
  handsPlayed: number;
  potsWon: number;
  bestWinStreak: number;
  currentWinStreak: number;
  totalWinnings: number;
}

interface ClubData {
  id: string;
  name: string;
  description: string | null;
  ownerId: string;
  memberCount: number;
  createdAt: string;
}

interface ClubMember {
  userId: string;
  username: string;
  displayName: string;
  avatarId: string | null;
  role: string;
  joinedAt: string;
}

// AI Analysis Modal
function AIAnalysisPanel({ onClose }: { onClose: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div
        className="relative w-full max-w-md rounded-2xl overflow-hidden"
        style={{
          background: "linear-gradient(135deg, rgba(8,16,24,0.98) 0%, rgba(4,10,16,0.99) 100%)",
          border: "1px solid rgba(0,240,255,0.1)",
          boxShadow: "0 25px 80px rgba(0,0,0,0.5), 0 0 40px rgba(0,240,255,0.05)",
        }}
      >
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-purple-500/15 border border-purple-500/20 flex items-center justify-center">
              <Brain className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white tracking-wider uppercase">AI Hand Analysis</h3>
              <p className="text-[9px] text-gray-500">Powered by Neural Engine v2.1</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/5 transition-colors">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="flex items-center gap-3 p-3 rounded-xl" style={{ background: "rgba(0,255,157,0.05)", border: "1px solid rgba(0,255,157,0.1)" }}>
            <CheckCircle className="w-6 h-6 text-green-400 shrink-0" />
            <div>
              <div className="text-[10px] text-gray-500 uppercase tracking-wider">Your Play Indicator</div>
              <div className="text-lg font-black text-green-400 uppercase tracking-wider">OPTIMAL</div>
            </div>
          </div>

          <div className="space-y-2.5">
            <div className="flex items-start gap-3 p-3 rounded-lg" style={{ background: "rgba(0,255,157,0.03)", border: "1px solid rgba(255,255,255,0.04)" }}>
              <div className="w-7 h-7 rounded bg-green-500/15 border border-green-500/20 flex items-center justify-center shrink-0 mt-0.5">
                <CheckCircle className="w-3.5 h-3.5 text-green-400" />
              </div>
              <div>
                <div className="text-xs font-semibold text-white">Optimal (FOLD)</div>
                <div className="text-[10px] text-gray-500 mt-0.5">
                  Expected Value: <span className="text-green-400">+12.5% Pot</span>
                </div>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 rounded-lg" style={{ background: "rgba(255,60,60,0.03)", border: "1px solid rgba(255,255,255,0.04)" }}>
              <div className="w-7 h-7 rounded bg-red-500/15 border border-red-500/20 flex items-center justify-center shrink-0 mt-0.5">
                <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
              </div>
              <div>
                <div className="text-xs font-semibold text-white">CALL:</div>
                <div className="text-[10px] text-gray-500 mt-0.5 space-y-0.5">
                  <div>Expected Value: <span className="text-red-400">-8.2% Pot</span></div>
                  <div>Fold/Hold Error: <span className="text-red-400">(Major Error)</span></div>
                </div>
              </div>
            </div>
          </div>

          <div className="p-3 rounded-xl" style={{ background: "rgba(255,165,0,0.04)", border: "1px solid rgba(255,165,0,0.1)" }}>
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              <span className="text-xs font-bold text-amber-300 uppercase tracking-wider">Leak Detection</span>
            </div>
            <p className="text-[11px] text-gray-400 leading-relaxed">
              AI detected tendency: You overbluff.
              You over-fold to river bets. This
              leak costs roughly bb <span className="text-amber-400">~1,588/100 hands</span>.
            </p>
          </div>

          <div className="flex gap-2">
            <button className="flex-1 py-2.5 rounded-lg text-[10px] font-bold uppercase tracking-wider text-gray-400 hover:text-white transition-colors"
              style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
              Run More Drills
            </button>
            <button
              className="flex-1 py-2.5 rounded-lg text-[10px] font-bold uppercase tracking-wider text-black"
              style={{
                background: "linear-gradient(135deg, #00ff9d, #00d4aa)",
                boxShadow: "0 0 15px rgba(0,255,157,0.2)",
              }}
            >
              Save Analysis
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export default function ClubDashboard() {
  const [showAI, setShowAI] = useState(false);
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [club, setClub] = useState<ClubData | null>(null);
  const [members, setMembers] = useState<ClubMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [creatingTable, setCreatingTable] = useState(false);
  const [stats, setStats] = useState<PlayerStats | null>(null);

  // Fetch first club the user might belong to (or first club available)
  useEffect(() => {
    async function loadClub() {
      try {
        const [res, statsRes] = await Promise.all([
          fetch("/api/clubs"),
          fetch("/api/stats/me"),
        ]);

        if (statsRes.ok) {
          setStats(await statsRes.json());
        }

        if (!res.ok) return;
        const clubs: ClubData[] = await res.json();
        if (clubs.length === 0) {
          setLoading(false);
          return;
        }
        const myClub = clubs[0]; // Use first club
        setClub(myClub);

        // Fetch members
        const membersRes = await fetch(`/api/clubs/${myClub.id}/members`);
        if (membersRes.ok) {
          setMembers(await membersRes.json());
        }
      } catch {} finally {
        setLoading(false);
      }
    }
    loadClub();
  }, []);

  const handleCreateTable = async () => {
    if (creatingTable || !club) return;
    setCreatingTable(true);
    try {
      const res = await fetch("/api/tables", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: `${club.name} Table`,
          smallBlind: 5,
          bigBlind: 10,
          minBuyIn: 200,
          maxBuyIn: 2000,
          maxPlayers: 6,
          clubId: club.id,
        }),
      });
      if (res.ok) {
        const table = await res.json();
        navigate(`/game/${table.id}`);
      }
    } catch {} finally {
      setCreatingTable(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="px-8 pb-8">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-cyan-400" />
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* ─── Main Content (2 cols) ──────────────────────── */}
            <div className="lg:col-span-2 space-y-6">

              {/* Club Header */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-xl overflow-hidden relative"
                style={{
                  background: "linear-gradient(135deg, rgba(8,16,24,0.95) 0%, rgba(4,10,16,0.98) 100%)",
                  border: "1px solid rgba(0,240,255,0.1)",
                  boxShadow: "0 10px 40px rgba(0,0,0,0.3)",
                }}
              >
                <div className="flex items-start gap-4 p-5">
                  <div className="w-14 h-14 rounded-xl bg-amber-500/15 border border-amber-500/20 flex items-center justify-center shrink-0">
                    <Trophy className="w-7 h-7 text-amber-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h2 className="text-base font-bold text-white tracking-wide">
                      {club?.name || "No Club Yet"}
                    </h2>
                    {club ? (
                      <div className="flex items-center gap-3 mt-2 text-[10px] text-gray-500">
                        <span className="flex items-center gap-1">
                          <Users className="w-3 h-3" /> {club.memberCount} members
                        </span>
                        <span>|</span>
                        <span>{members.filter(m => m.role === "owner").map(m => m.displayName).join(", ") || "—"} (Owner)</span>
                      </div>
                    ) : (
                      <p className="text-xs text-gray-500 mt-1">Join or create a club to get started</p>
                    )}
                  </div>
                  <div className="flex flex-col gap-2 shrink-0">
                    {club && (
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={handleCreateTable}
                        disabled={creatingTable}
                        className="px-5 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider text-black flex items-center gap-1.5 disabled:opacity-50"
                        style={{
                          background: "linear-gradient(135deg, #00ff9d, #00d4aa)",
                          boxShadow: "0 0 15px rgba(0,255,157,0.2)",
                        }}
                      >
                        {creatingTable ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
                        Create Table
                      </motion.button>
                    )}
                  </div>
                </div>
              </motion.div>

              {/* Mini Table Preview */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="relative rounded-xl overflow-hidden"
                style={{
                  border: "1px solid rgba(255,255,255,0.05)",
                  boxShadow: "0 10px 40px rgba(0,0,0,0.3)",
                }}
              >
                <div className="aspect-[2.2/1] relative">
                  <div className="absolute inset-0" style={{ backgroundImage: `url(${feltTexture})`, backgroundSize: "cover" }} />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/30" />
                  <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_40%,rgba(0,0,0,0.5)_100%)]" />

                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-20 h-20 opacity-20">
                    <img src={lionLogo} alt="" className="w-full h-full object-contain" />
                  </div>

                  {/* Real members preview */}
                  <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-12">
                    {members.slice(0, 4).map((m, i) => (
                      <div key={m.userId} className="flex flex-col items-center">
                        <div
                          className="w-10 h-10 rounded-full overflow-hidden border-2 flex items-center justify-center bg-gradient-to-br from-cyan-500/30 to-purple-500/30"
                          style={{
                            borderColor: i === 0 ? "rgba(0,240,255,0.4)" : "rgba(255,255,255,0.1)",
                            boxShadow: i === 0 ? "0 0 12px rgba(0,240,255,0.2)" : "none",
                          }}
                        >
                          <span className="text-[10px] font-bold text-white">
                            {m.displayName.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <span className="text-[8px] text-gray-500 mt-1 truncate max-w-[60px]">{m.displayName}</span>
                      </div>
                    ))}
                  </div>

                  <div className="absolute bottom-2 left-3 text-[9px] text-gray-500 font-mono">
                    {club?.name || "No active tables"} | {members.length} Members
                  </div>
                </div>
              </motion.div>

              {/* Daily Missions */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="glass rounded-xl p-5 border border-white/5"
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400">
                    Daily Missions
                  </h3>
                  <span className="text-[9px] text-cyan-400 font-bold uppercase tracking-wider">
                    {MISSION_DEFS.filter(m => stats && stats[m.statKey] >= m.target).length}/{MISSION_DEFS.length} Complete
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  {MISSION_DEFS.map((mission) => {
                    const Icon = mission.icon;
                    const current = stats ? stats[mission.statKey] : 0;
                    const progress = Math.min(Math.round((current / mission.target) * 100), 100);
                    const completed = current >= mission.target;
                    return (
                      <div key={mission.id} className="text-center">
                        <div className={`w-10 h-10 rounded-lg ${completed ? "bg-green-500/15 border-green-500/20" : "bg-cyan-500/10 border-cyan-500/15"} border flex items-center justify-center mx-auto mb-2`}>
                          <Icon className={`w-4 h-4 ${completed ? "text-green-400" : "text-cyan-400"}`} />
                        </div>
                        <div className="text-[10px] font-medium text-gray-300 mb-1">{mission.label}</div>
                        <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden mb-1">
                          <div
                            className={`h-full rounded-full transition-all ${completed ? "bg-gradient-to-r from-green-500 to-emerald-400" : "bg-gradient-to-r from-cyan-500 to-green-500"}`}
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                        <div className="text-[9px] text-gray-500">
                          {Math.min(current, mission.target)}/{mission.target}
                          {completed
                            ? <span className="text-green-400 ml-1">Done!</span>
                            : <span className="text-amber-400 ml-1">+{mission.reward}</span>
                          }
                        </div>
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            </div>

            {/* ─── Right Panel ──────────────────────────────────── */}
            <div className="space-y-4">
              {/* AI Hand Analysis Button */}
              <motion.button
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 }}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setShowAI(true)}
                className="w-full text-left rounded-xl p-4 transition-all relative overflow-hidden group"
                style={{
                  background: "linear-gradient(135deg, rgba(120,80,220,0.12) 0%, rgba(80,40,180,0.08) 100%)",
                  border: "1px solid rgba(120,80,220,0.2)",
                  boxShadow: "0 0 25px rgba(120,80,220,0.06)",
                }}
              >
                <div className="absolute top-0 right-0 w-24 h-24 bg-purple-500/10 blur-3xl rounded-full" />
                <div className="relative">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-9 h-9 rounded-lg bg-purple-500/20 border border-purple-500/25 flex items-center justify-center">
                      <Brain className="w-5 h-5 text-purple-400" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-white uppercase tracking-wider">AI Hand Analysis</div>
                      <div className="text-[9px] text-gray-500">Analyze your play in real-time</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mt-3">
                    <div className="flex-1 h-1 bg-purple-500/15 rounded-full overflow-hidden">
                      <div className="h-full w-[72%] bg-gradient-to-r from-purple-500 to-cyan-500 rounded-full" />
                    </div>
                    <span className="text-[9px] text-purple-400 font-bold">72% EV</span>
                  </div>
                </div>
                <ChevronRight className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600 group-hover:text-purple-400 transition-colors" />
              </motion.button>

              {/* Quick Actions */}
              <div className="grid grid-cols-2 gap-2">
                <motion.button
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  onClick={() => navigate("/game")}
                  className="glass rounded-xl p-3 border border-white/5 hover:border-cyan-500/20 transition-all text-center group"
                >
                  <Play className="w-5 h-5 text-cyan-400 mx-auto mb-1.5" />
                  <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider group-hover:text-white transition-colors">
                    Quick Play
                  </span>
                </motion.button>
                <motion.button
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.35 }}
                  className="glass rounded-xl p-3 border border-white/5 hover:border-amber-500/20 transition-all text-center group"
                >
                  <Trophy className="w-5 h-5 text-amber-400 mx-auto mb-1.5" />
                  <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider group-hover:text-white transition-colors">
                    Tournaments
                  </span>
                </motion.button>
              </div>

              {/* Tournaments — Coming Soon */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="glass rounded-xl border border-white/5 overflow-hidden"
              >
                <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400">
                    Tournaments
                  </h3>
                  <span className="text-[8px] font-bold uppercase tracking-wider text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                    Coming Soon
                  </span>
                </div>
                <div className="px-4 py-6 text-center">
                  <Trophy className="w-8 h-8 text-gray-700 mx-auto mb-2" />
                  <p className="text-[11px] text-gray-600">Tournament support is being built.</p>
                </div>
              </motion.div>

              {/* Club Stats — Real Data */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="glass rounded-xl p-4 border border-white/5"
              >
                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3">
                  Club Overview
                </h3>
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-gray-500">Total Members</span>
                    <span className="text-xs font-bold text-green-400">{club?.memberCount ?? 0}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-gray-500">Club Name</span>
                    <span className="text-xs font-bold text-cyan-400">{club?.name || "—"}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-gray-500">Your Balance</span>
                    <span className="text-xs font-bold text-amber-400">{user?.chipBalance?.toLocaleString() ?? 0}</span>
                  </div>
                </div>
              </motion.div>
            </div>
          </div>
        )}
      </div>

      <AnimatePresence>
        {showAI && <AIAnalysisPanel onClose={() => setShowAI(false)} />}
      </AnimatePresence>
    </DashboardLayout>
  );
}
