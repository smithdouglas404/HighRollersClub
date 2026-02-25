import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useAuth } from "@/lib/auth-context";
import {
  Trophy, Brain, TrendingUp, CheckCircle,
  AlertTriangle, Play, Clock, Users, Zap,
  Target, Gamepad2, Coins, ChevronRight, X, Plus, Loader2,
  Settings, Bell, CalendarDays, MessageSquare, Megaphone
} from "lucide-react";

import feltTexture from "@assets/generated_images/poker_table_top_cinematic.png";
import lionLogo from "@assets/generated_images/lion_crest_gold_emblem.png";

interface MissionData {
  id: string;
  type: string;
  label: string;
  description: string | null;
  target: number;
  reward: number;
  progress: number;
  completed: boolean;
  claimed: boolean;
}

const MISSION_ICON_MAP: Record<string, any> = {
  hands_played: Gamepad2,
  pots_won: Coins,
  win_streak: Target,
  consecutive_wins: Zap,
  sng_win: Trophy,
  bomb_pot: Target,
  heads_up_win: Users,
};

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

interface Announcement {
  id: string;
  authorId: string;
  title: string;
  content: string;
  pinned: boolean;
  createdAt: string;
}

interface ClubEvent {
  id: string;
  eventType: string;
  tableId: string | null;
  name: string;
  description: string | null;
  startTime: string;
  createdAt: string;
}

// AI Analysis Modal - fetches real data from /api/analyses
interface AnalysisResult {
  rating: "OPTIMAL" | "SUBOPTIMAL";
  overallScore: number;
  evByAction: { action: string; ev: number }[];
  leaks: string[];
  recommendations: string[];
}

interface HandAnalysis {
  id: string;
  holeCards: any[];
  communityCards: any[] | null;
  pot: number;
  position: string | null;
  analysis: AnalysisResult;
  createdAt: string;
}

function AIAnalysisPanel({ onClose }: { onClose: () => void }) {
  const [analyses, setAnalyses] = useState<HandAnalysis[]>([]);
  const [loadingAnalyses, setLoadingAnalyses] = useState(true);

  useEffect(() => {
    async function fetchAnalyses() {
      try {
        const res = await fetch("/api/analyses");
        if (res.ok) {
          setAnalyses(await res.json());
        }
      } catch {} finally {
        setLoadingAnalyses(false);
      }
    }
    fetchAnalyses();
  }, []);

  const latest = analyses[0]; // Most recent analysis (API returns sorted by createdAt desc)
  const analysis = latest?.analysis;

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
          background: "linear-gradient(135deg, rgba(12,20,40,0.98) 0%, rgba(10,16,34,0.99) 100%)",
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
              <p className="text-[9px] text-gray-500">
                {analyses.length > 0
                  ? `${analyses.length} analysis${analyses.length !== 1 ? "es" : ""} saved`
                  : "No analyses yet"}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/5 transition-colors">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {loadingAnalyses ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-purple-400" />
            </div>
          ) : !analysis ? (
            <div className="text-center py-6">
              <Brain className="w-10 h-10 text-gray-700 mx-auto mb-3" />
              <p className="text-sm font-semibold text-gray-400 mb-1">No analyses yet</p>
              <p className="text-[11px] text-gray-600 leading-relaxed max-w-xs mx-auto">
                Play a hand and use the AI analysis feature during gameplay to see your results here.
              </p>
            </div>
          ) : (
            <>
              {/* Rating */}
              <div
                className="flex items-center gap-3 p-3 rounded-xl"
                style={{
                  background: analysis.rating === "OPTIMAL" ? "rgba(0,255,157,0.05)" : "rgba(255,165,0,0.05)",
                  border: `1px solid ${analysis.rating === "OPTIMAL" ? "rgba(0,255,157,0.1)" : "rgba(255,165,0,0.1)"}`,
                }}
              >
                {analysis.rating === "OPTIMAL" ? (
                  <CheckCircle className="w-6 h-6 text-green-400 shrink-0" />
                ) : (
                  <AlertTriangle className="w-6 h-6 text-amber-400 shrink-0" />
                )}
                <div>
                  <div className="text-[10px] text-gray-500 uppercase tracking-wider">Last Hand Rating</div>
                  <div className={`text-lg font-black uppercase tracking-wider ${analysis.rating === "OPTIMAL" ? "text-green-400" : "text-amber-400"}`}>
                    {analysis.rating}
                  </div>
                  <div className="text-[9px] text-gray-600">
                    Score: {analysis.overallScore}/100
                  </div>
                </div>
              </div>

              {/* EV by Action */}
              <div className="space-y-2.5">
                {analysis.evByAction.map((item) => {
                  const isPositive = item.ev >= 0;
                  return (
                    <div
                      key={item.action}
                      className="flex items-start gap-3 p-3 rounded-lg"
                      style={{
                        background: isPositive ? "rgba(0,255,157,0.03)" : "rgba(255,60,60,0.03)",
                        border: "1px solid rgba(255,255,255,0.04)",
                      }}
                    >
                      <div
                        className={`w-7 h-7 rounded ${isPositive ? "bg-green-500/15 border-green-500/20" : "bg-red-500/15 border-red-500/20"} border flex items-center justify-center shrink-0 mt-0.5`}
                      >
                        {isPositive ? (
                          <CheckCircle className="w-3.5 h-3.5 text-green-400" />
                        ) : (
                          <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
                        )}
                      </div>
                      <div>
                        <div className="text-xs font-semibold text-white">{item.action}</div>
                        <div className="text-[10px] text-gray-500 mt-0.5">
                          Expected Value: <span className={isPositive ? "text-green-400" : "text-red-400"}>
                            {isPositive ? "+" : ""}{item.ev} BB
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Leaks */}
              {analysis.leaks.length > 0 && (
                <div className="p-3 rounded-xl" style={{ background: "rgba(255,165,0,0.04)", border: "1px solid rgba(255,165,0,0.1)" }}>
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className="w-4 h-4 text-amber-400" />
                    <span className="text-xs font-bold text-amber-300 uppercase tracking-wider">Leak Detection</span>
                  </div>
                  {analysis.leaks.map((leak, i) => (
                    <p key={i} className="text-[11px] text-gray-400 leading-relaxed">
                      {leak}
                    </p>
                  ))}
                </div>
              )}

              {/* Recommendations */}
              {analysis.recommendations.length > 0 && (
                <div className="p-3 rounded-xl" style={{ background: "rgba(0,240,255,0.04)", border: "1px solid rgba(0,240,255,0.1)" }}>
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingUp className="w-4 h-4 text-cyan-400" />
                    <span className="text-xs font-bold text-cyan-300 uppercase tracking-wider">Recommendations</span>
                  </div>
                  {analysis.recommendations.map((rec, i) => (
                    <p key={i} className="text-[11px] text-gray-400 leading-relaxed">
                      {rec}
                    </p>
                  ))}
                </div>
              )}

              <div className="text-[9px] text-gray-600 text-center">
                Analyzed {new Date(latest.createdAt).toLocaleDateString()} at {new Date(latest.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </div>
            </>
          )}

          <button
            onClick={onClose}
            className="w-full py-2.5 rounded-lg text-[10px] font-bold uppercase tracking-wider text-gray-400 hover:text-white transition-colors"
            style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
          >
            Close
          </button>
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
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [events, setEvents] = useState<ClubEvent[]>([]);
  const [missions, setMissions] = useState<MissionData[]>([]);

  // Fetch first club the user might belong to (or first club available)
  useEffect(() => {
    async function loadClub() {
      try {
        const [res, statsRes, missionsRes] = await Promise.all([
          fetch("/api/clubs"),
          fetch("/api/stats/me"),
          fetch("/api/missions"),
        ]);

        if (missionsRes.ok) {
          setMissions(await missionsRes.json());
        }

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

        // Fetch members, announcements, events in parallel
        const [membersRes, announcementsRes, eventsRes] = await Promise.all([
          fetch(`/api/clubs/${myClub.id}/members`),
          fetch(`/api/clubs/${myClub.id}/announcements`).catch(() => null),
          fetch(`/api/clubs/${myClub.id}/events`).catch(() => null),
        ]);
        if (membersRes.ok) {
          setMembers(await membersRes.json());
        }
        if (announcementsRes?.ok) {
          setAnnouncements(await announcementsRes.json());
        }
        if (eventsRes?.ok) {
          setEvents(await eventsRes.json());
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
    <DashboardLayout title="Club Dashboard">
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
                  background: "linear-gradient(135deg, rgba(12,20,40,0.95) 0%, rgba(10,16,34,0.98) 100%)",
                  border: "1px solid rgba(0,240,255,0.1)",
                  boxShadow: "0 10px 40px rgba(0,0,0,0.3)",
                }}
              >
                <div className="flex items-start gap-4 p-5">
                  <div className="w-14 h-14 rounded-xl bg-amber-500/15 border border-amber-500/20 flex items-center justify-center shrink-0">
                    <Trophy className="w-7 h-7 text-amber-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h2 className="text-base font-bold tracking-wide gold-text">
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
                      <>
                        <motion.button
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={handleCreateTable}
                          disabled={creatingTable}
                          className="px-5 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider text-black flex items-center gap-1.5 disabled:opacity-50"
                          style={{
                            background: "linear-gradient(135deg, #c9a84c, #f0d078)",
                            boxShadow: "0 0 20px rgba(201,168,76,0.3)",
                          }}
                        >
                          {creatingTable ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
                          Create Table
                        </motion.button>
                        <div className="flex gap-1.5">
                          <button
                            onClick={() => navigate("/club/settings")}
                            className="flex-1 glass rounded-lg px-3 py-1.5 text-[9px] font-bold uppercase tracking-wider text-gray-400 hover:text-white border border-white/5 hover:border-white/15 transition-all flex items-center justify-center gap-1"
                          >
                            <Settings className="w-3 h-3" />
                            Settings
                          </button>
                          <button
                            onClick={() => navigate("/club/invitations")}
                            className="flex-1 glass rounded-lg px-3 py-1.5 text-[9px] font-bold uppercase tracking-wider text-gray-400 hover:text-white border border-white/5 hover:border-white/15 transition-all flex items-center justify-center gap-1"
                          >
                            <Bell className="w-3 h-3" />
                            Invites
                          </button>
                        </div>
                      </>
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

              {/* Club & Alliance News */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="glass rounded-xl border border-white/5 overflow-hidden"
              >
                <div className="px-5 py-3 border-b border-white/5 flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 flex items-center gap-2">
                    <Megaphone className="w-3.5 h-3.5 text-cyan-400" />
                    Club News
                  </h3>
                  <span className="text-[9px] text-gray-600">{announcements.length} posts</span>
                </div>
                {announcements.length === 0 ? (
                  <div className="py-6 text-center">
                    <MessageSquare className="w-6 h-6 text-gray-700 mx-auto mb-2" />
                    <p className="text-[11px] text-gray-600">No announcements yet</p>
                  </div>
                ) : (
                  <div className="divide-y divide-white/[0.03]">
                    {announcements.slice(0, 5).map((a) => (
                      <div key={a.id} className="px-5 py-3 hover:bg-white/[0.02] transition-colors">
                        <div className="flex items-center gap-2 mb-1">
                          {a.pinned && <span className="text-[8px] text-amber-400 font-bold uppercase">Pinned</span>}
                          <span className="text-xs font-bold text-white">{a.title}</span>
                        </div>
                        <p className="text-[11px] text-gray-500 line-clamp-2">{a.content}</p>
                        <span className="text-[9px] text-gray-600 mt-1 block">
                          {new Date(a.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </motion.div>

              {/* Upcoming Events */}
              {events.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.25 }}
                  className="glass rounded-xl border border-white/5 overflow-hidden"
                >
                  <div className="px-5 py-3 border-b border-white/5">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 flex items-center gap-2">
                      <CalendarDays className="w-3.5 h-3.5 text-amber-400" />
                      Upcoming Events
                    </h3>
                  </div>
                  <div className="divide-y divide-white/[0.03]">
                    {events.slice(0, 4).map((ev) => (
                      <div key={ev.id} className="flex items-center justify-between px-5 py-3 hover:bg-white/[0.02] transition-colors">
                        <div>
                          <div className="text-xs font-bold text-white">{ev.name}</div>
                          <div className="text-[10px] text-gray-500">{ev.description || ev.eventType}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-[10px] font-mono text-cyan-400">
                            {new Date(ev.startTime).toLocaleDateString()}
                          </div>
                          <div className="text-[9px] text-gray-600">
                            {new Date(ev.startTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}

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
                    {missions.filter(m => m.completed).length}/{missions.length} Complete
                  </span>
                </div>
                {missions.length === 0 ? (
                  <div className="text-center py-4">
                    <Target className="w-6 h-6 text-gray-700 mx-auto mb-2" />
                    <p className="text-[11px] text-gray-600">No missions available</p>
                  </div>
                ) : (
                <div className="grid grid-cols-3 gap-4">
                  {missions.slice(0, 6).map((mission) => {
                    const Icon = MISSION_ICON_MAP[mission.type] || Target;
                    const progressPct = Math.min(Math.round((mission.progress / mission.target) * 100), 100);
                    return (
                      <div key={mission.id} className="text-center">
                        <div className={`w-10 h-10 rounded-lg ${mission.completed ? "bg-green-500/15 border-green-500/20" : "bg-cyan-500/10 border-cyan-500/15"} border flex items-center justify-center mx-auto mb-2`}>
                          <Icon className={`w-4 h-4 ${mission.completed ? "text-green-400" : "text-cyan-400"}`} />
                        </div>
                        <div className="text-[10px] font-medium text-gray-300 mb-1">{mission.label}</div>
                        <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden mb-1">
                          <div
                            className={`h-full rounded-full transition-all ${mission.completed ? "bg-gradient-to-r from-green-500 to-emerald-400" : "bg-gradient-to-r from-cyan-500 to-green-500"}`}
                            style={{ width: `${progressPct}%` }}
                          />
                        </div>
                        <div className="text-[9px] text-gray-500">
                          {mission.progress}/{mission.target}
                          {mission.completed
                            ? mission.claimed
                              ? <span className="text-gray-500 ml-1">Claimed</span>
                              : <span className="text-green-400 ml-1">Done!</span>
                            : <span className="text-amber-400 ml-1">+{mission.reward}</span>
                          }
                        </div>
                      </div>
                    );
                  })}
                </div>
                )}
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
                    <span className="text-[9px] text-purple-400/70">View your latest analysis</span>
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

              {/* Tournaments */}
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
                  <span className="text-[8px] font-bold uppercase tracking-wider text-green-400 bg-green-500/10 px-2 py-0.5 rounded border border-green-500/20">
                    Live
                  </span>
                </div>
                <div className="px-4 py-3 space-y-2">
                  <button
                    onClick={() => navigate("/lobby")}
                    className="w-full flex items-center gap-3 p-2.5 rounded-lg hover:bg-white/[0.03] transition-colors text-left"
                  >
                    <div className="w-8 h-8 rounded-lg bg-amber-500/15 border border-amber-500/20 flex items-center justify-center shrink-0">
                      <Clock className="w-4 h-4 text-amber-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[11px] font-bold text-white">Sit & Go</div>
                      <div className="text-[9px] text-gray-500">6-max, 500 buy-in</div>
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 text-gray-600" />
                  </button>
                  <button
                    onClick={() => navigate("/lobby")}
                    className="w-full flex items-center gap-3 p-2.5 rounded-lg hover:bg-white/[0.03] transition-colors text-left"
                  >
                    <div className="w-8 h-8 rounded-lg bg-purple-500/15 border border-purple-500/20 flex items-center justify-center shrink-0">
                      <Trophy className="w-4 h-4 text-purple-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[11px] font-bold text-white">Heads Up</div>
                      <div className="text-[9px] text-gray-500">1v1 duel</div>
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 text-gray-600" />
                  </button>
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
