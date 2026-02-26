import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useAuth } from "@/lib/auth-context";
import { useClub } from "@/lib/club-context";
import { MemberAvatar } from "@/components/shared/MemberAvatar";
import { MissionsGrid } from "@/components/shared/MissionsGrid";
import {
  Trophy, Brain, TrendingUp, CheckCircle,
  AlertTriangle, Play, Clock, Users, Zap,
  Target, Gamepad2, Coins, ChevronRight, X, Plus, Loader2,
  Settings, Bell, CalendarDays, MessageSquare, Megaphone,
  Globe, Lock, Search
} from "lucide-react";

import feltTexture from "@assets/generated_images/poker_table_top_cinematic.png";
import lionLogo from "@assets/generated_images/lion_crest_gold_emblem.png";

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
  const { club, members, announcements, events, missions, myStats, loading, createClub, isAdminOrOwner, createAnnouncement, createEvent } = useClub();

  const [creatingTable, setCreatingTable] = useState(false);

  // Announcement form state
  const [showNewAnnouncement, setShowNewAnnouncement] = useState(false);
  const [annTitle, setAnnTitle] = useState("");
  const [annContent, setAnnContent] = useState("");
  const [annPinned, setAnnPinned] = useState(false);
  const [postingAnnouncement, setPostingAnnouncement] = useState(false);

  // Event form state
  const [showNewEvent, setShowNewEvent] = useState(false);
  const [evName, setEvName] = useState("");
  const [evType, setEvType] = useState("tournament");
  const [evDescription, setEvDescription] = useState("");
  const [evStartTime, setEvStartTime] = useState("");
  const [postingEvent, setPostingEvent] = useState(false);

  // Create Club form state
  const [newClubName, setNewClubName] = useState("");
  const [newClubDescription, setNewClubDescription] = useState("");
  const [newClubIsPublic, setNewClubIsPublic] = useState(true);
  const [creatingClub, setCreatingClub] = useState(false);

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

  const handleCreateClub = async () => {
    if (creatingClub || !newClubName.trim()) return;
    setCreatingClub(true);
    try {
      await createClub({
        name: newClubName.trim(),
        description: newClubDescription.trim() || undefined,
        isPublic: newClubIsPublic,
      });
    } finally {
      setCreatingClub(false);
    }
  };

  return (
    <DashboardLayout title="Club Dashboard">
      <div className="px-8 pb-8">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-cyan-400" />
          </div>
        ) : !club ? (
          /* ─── No Club — Create Club Flow ─────────────────────────────── */
          <div className="max-w-lg mx-auto pt-8 space-y-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-xl overflow-hidden"
              style={{
                background: "linear-gradient(135deg, rgba(12,20,40,0.95) 0%, rgba(10,16,34,0.98) 100%)",
                border: "1px solid rgba(0,240,255,0.1)",
                boxShadow: "0 10px 40px rgba(0,0,0,0.3), 0 0 60px rgba(201,168,76,0.05)",
              }}
            >
              {/* Header */}
              <div className="px-6 pt-6 pb-4 text-center">
                <div className="w-16 h-16 rounded-xl bg-amber-500/15 border border-amber-500/20 flex items-center justify-center mx-auto mb-4">
                  <Trophy className="w-8 h-8 text-amber-400" />
                </div>
                <h2 className="text-lg font-bold tracking-wide gold-text mb-1">
                  Create Your Club
                </h2>
                <p className="text-[11px] text-gray-500 leading-relaxed max-w-xs mx-auto">
                  Start your own poker club, invite friends, and compete together.
                </p>
              </div>

              {/* Form */}
              <div className="px-6 pb-6 space-y-4">
                {/* Club Name */}
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5 block">
                    Club Name <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={newClubName}
                    onChange={(e) => setNewClubName(e.target.value)}
                    placeholder="Enter club name..."
                    maxLength={50}
                    className="w-full px-4 py-2.5 rounded-lg text-sm text-white placeholder-gray-600 outline-none transition-all focus:ring-1 focus:ring-cyan-500/30"
                    style={{
                      background: "rgba(255,255,255,0.04)",
                      border: "1px solid rgba(255,255,255,0.08)",
                    }}
                  />
                </div>

                {/* Description */}
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5 block">
                    Description <span className="text-gray-600">(optional)</span>
                  </label>
                  <textarea
                    value={newClubDescription}
                    onChange={(e) => setNewClubDescription(e.target.value)}
                    placeholder="What's your club about?"
                    rows={3}
                    maxLength={300}
                    className="w-full px-4 py-2.5 rounded-lg text-sm text-white placeholder-gray-600 outline-none resize-none transition-all focus:ring-1 focus:ring-cyan-500/30"
                    style={{
                      background: "rgba(255,255,255,0.04)",
                      border: "1px solid rgba(255,255,255,0.08)",
                    }}
                  />
                </div>

                {/* Public / Private Toggle */}
                <div
                  className="flex items-center justify-between p-3 rounded-lg"
                  style={{
                    background: "rgba(255,255,255,0.03)",
                    border: "1px solid rgba(255,255,255,0.06)",
                  }}
                >
                  <div className="flex items-center gap-3">
                    {newClubIsPublic ? (
                      <Globe className="w-4 h-4 text-cyan-400" />
                    ) : (
                      <Lock className="w-4 h-4 text-amber-400" />
                    )}
                    <div>
                      <div className="text-xs font-bold text-white">
                        {newClubIsPublic ? "Public Club" : "Private Club"}
                      </div>
                      <div className="text-[9px] text-gray-500">
                        {newClubIsPublic
                          ? "Anyone can find and join your club"
                          : "Members join by invitation only"}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => setNewClubIsPublic(!newClubIsPublic)}
                    className="relative w-10 h-5 rounded-full transition-colors"
                    style={{
                      background: newClubIsPublic
                        ? "linear-gradient(135deg, rgba(0,240,255,0.4), rgba(0,200,220,0.6))"
                        : "rgba(255,255,255,0.1)",
                    }}
                  >
                    <div
                      className="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all"
                      style={{
                        left: newClubIsPublic ? "calc(100% - 18px)" : "2px",
                      }}
                    />
                  </button>
                </div>

                {/* Create Button */}
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleCreateClub}
                  disabled={creatingClub || !newClubName.trim()}
                  className="w-full py-3 rounded-lg text-xs font-bold uppercase tracking-wider text-black flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{
                    background: "linear-gradient(135deg, #c9a84c, #f0d078)",
                    boxShadow: "0 0 25px rgba(201,168,76,0.3)",
                  }}
                >
                  {creatingClub ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Plus className="w-4 h-4" />
                  )}
                  Create Club
                </motion.button>

                {/* Divider */}
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.06)" }} />
                  <span className="text-[9px] text-gray-600 uppercase tracking-wider">or</span>
                  <div className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.06)" }} />
                </div>

                {/* Browse Clubs */}
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => navigate("/clubs/browse")}
                  className="w-full py-2.5 rounded-lg text-[10px] font-bold uppercase tracking-wider text-gray-400 hover:text-white transition-colors flex items-center justify-center gap-2"
                  style={{
                    background: "rgba(255,255,255,0.03)",
                    border: "1px solid rgba(255,255,255,0.08)",
                  }}
                >
                  <Search className="w-3.5 h-3.5" />
                  Browse Clubs
                </motion.button>
              </div>
            </motion.div>
          </div>
        ) : (
          /* ─── Has Club — Full Dashboard ──────────────────────────────── */
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
                      {club.name}
                    </h2>
                    <div className="flex items-center gap-3 mt-2 text-[10px] text-gray-500">
                      <span className="flex items-center gap-1">
                        <Users className="w-3 h-3" /> {club.memberCount} members
                      </span>
                      <span>|</span>
                      <span>{members.filter(m => m.role === "owner").map(m => m.displayName).join(", ") || "—"} (Owner)</span>
                    </div>
                  </div>
                  <div className="flex flex-col gap-2 shrink-0">
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
                    {members.slice(0, 4).map((m) => (
                      <div key={m.userId} className="flex flex-col items-center">
                        <MemberAvatar
                          avatarId={m.avatarId}
                          displayName={m.displayName}
                          size="sm"
                        />
                        <span className="text-[8px] text-gray-500 mt-1 truncate max-w-[60px]">{m.displayName}</span>
                      </div>
                    ))}
                  </div>

                  <div className="absolute bottom-2 left-3 text-[9px] text-gray-500 font-mono">
                    {club.name} | {members.length} Members
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
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] text-gray-600">{announcements.length} posts</span>
                    {isAdminOrOwner && (
                      <button
                        onClick={() => setShowNewAnnouncement(!showNewAnnouncement)}
                        className="text-[9px] font-bold uppercase tracking-wider text-cyan-400 hover:text-cyan-300 transition-colors flex items-center gap-1"
                      >
                        <Plus className="w-3 h-3" />
                        New Post
                      </button>
                    )}
                  </div>
                </div>
                {showNewAnnouncement && (
                  <div className="px-5 py-4 border-b border-white/5 space-y-3">
                    <input
                      type="text"
                      value={annTitle}
                      onChange={(e) => setAnnTitle(e.target.value)}
                      placeholder="Announcement title..."
                      className="w-full px-3 py-2 rounded-lg text-xs text-white placeholder-gray-600 outline-none"
                      style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
                    />
                    <textarea
                      value={annContent}
                      onChange={(e) => setAnnContent(e.target.value)}
                      placeholder="Announcement content..."
                      rows={3}
                      className="w-full px-3 py-2 rounded-lg text-xs text-white placeholder-gray-600 outline-none resize-none"
                      style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
                    />
                    <div className="flex items-center justify-between">
                      <label className="flex items-center gap-2 text-[10px] text-gray-400 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={annPinned}
                          onChange={(e) => setAnnPinned(e.target.checked)}
                          className="rounded"
                        />
                        Pin to top
                      </label>
                      <div className="flex gap-2">
                        <button
                          onClick={() => { setShowNewAnnouncement(false); setAnnTitle(""); setAnnContent(""); setAnnPinned(false); }}
                          className="px-3 py-1.5 rounded-lg text-[10px] font-bold text-gray-400 border border-white/10"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={async () => {
                            if (!annTitle.trim() || !annContent.trim()) return;
                            setPostingAnnouncement(true);
                            const ok = await createAnnouncement({ title: annTitle.trim(), content: annContent.trim(), pinned: annPinned });
                            setPostingAnnouncement(false);
                            if (ok) { setShowNewAnnouncement(false); setAnnTitle(""); setAnnContent(""); setAnnPinned(false); }
                          }}
                          disabled={postingAnnouncement || !annTitle.trim() || !annContent.trim()}
                          className="px-4 py-1.5 rounded-lg text-[10px] font-bold text-black disabled:opacity-50"
                          style={{ background: "linear-gradient(135deg, #c9a84c, #e8c566)" }}
                        >
                          {postingAnnouncement ? <Loader2 className="w-3 h-3 animate-spin" /> : "Post"}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
                {announcements.length === 0 && !showNewAnnouncement ? (
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
              {(events.length > 0 || isAdminOrOwner) && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.25 }}
                  className="glass rounded-xl border border-white/5 overflow-hidden"
                >
                  <div className="px-5 py-3 border-b border-white/5 flex items-center justify-between">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 flex items-center gap-2">
                      <CalendarDays className="w-3.5 h-3.5 text-amber-400" />
                      Upcoming Events
                    </h3>
                    {isAdminOrOwner && (
                      <button
                        onClick={() => setShowNewEvent(!showNewEvent)}
                        className="text-[9px] font-bold uppercase tracking-wider text-amber-400 hover:text-amber-300 transition-colors flex items-center gap-1"
                      >
                        <Plus className="w-3 h-3" />
                        Schedule Event
                      </button>
                    )}
                  </div>
                  {showNewEvent && (
                    <div className="px-5 py-4 border-b border-white/5 space-y-3">
                      <input
                        type="text"
                        value={evName}
                        onChange={(e) => setEvName(e.target.value)}
                        placeholder="Event name..."
                        className="w-full px-3 py-2 rounded-lg text-xs text-white placeholder-gray-600 outline-none"
                        style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
                      />
                      <select
                        value={evType}
                        onChange={(e) => setEvType(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg text-xs text-white outline-none"
                        style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
                      >
                        <option value="tournament">Tournament</option>
                        <option value="cash_game">Cash Game</option>
                        <option value="sit_n_go">Sit & Go</option>
                        <option value="special">Special Event</option>
                      </select>
                      <textarea
                        value={evDescription}
                        onChange={(e) => setEvDescription(e.target.value)}
                        placeholder="Description (optional)..."
                        rows={2}
                        className="w-full px-3 py-2 rounded-lg text-xs text-white placeholder-gray-600 outline-none resize-none"
                        style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
                      />
                      <input
                        type="datetime-local"
                        value={evStartTime}
                        onChange={(e) => setEvStartTime(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg text-xs text-white outline-none"
                        style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
                      />
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => { setShowNewEvent(false); setEvName(""); setEvDescription(""); setEvStartTime(""); }}
                          className="px-3 py-1.5 rounded-lg text-[10px] font-bold text-gray-400 border border-white/10"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={async () => {
                            if (!evName.trim()) return;
                            setPostingEvent(true);
                            const ok = await createEvent({
                              name: evName.trim(),
                              eventType: evType,
                              description: evDescription.trim() || undefined,
                              startTime: evStartTime || undefined,
                            });
                            setPostingEvent(false);
                            if (ok) { setShowNewEvent(false); setEvName(""); setEvDescription(""); setEvStartTime(""); }
                          }}
                          disabled={postingEvent || !evName.trim()}
                          className="px-4 py-1.5 rounded-lg text-[10px] font-bold text-black disabled:opacity-50"
                          style={{ background: "linear-gradient(135deg, #c9a84c, #e8c566)" }}
                        >
                          {postingEvent ? <Loader2 className="w-3 h-3 animate-spin" /> : "Schedule"}
                        </button>
                      </div>
                    </div>
                  )}
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
                <MissionsGrid
                  missions={missions}
                  showHeader
                  completedCount={missions.filter(m => m.completed).length}
                />
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
                    <span className="text-xs font-bold text-green-400">{club.memberCount}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-gray-500">Club Name</span>
                    <span className="text-xs font-bold text-cyan-400">{club.name}</span>
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
