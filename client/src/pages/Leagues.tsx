import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/hooks/use-toast";
import {
  Swords, Trophy, Users, Crown, Shield, Plus,
  Loader2, Calendar, TrendingUp, Medal, ChevronRight,
  X, Check, Star, Zap
} from "lucide-react";

interface ClubAlliance {
  id: string;
  name: string;
  clubIds: string[];
  createdAt: string;
}

interface LeagueSeason {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  standings: { clubId: string; clubName?: string; points: number; wins: number; losses: number }[] | null;
  createdAt: string;
}

interface ClubData {
  id: string;
  name: string;
  memberCount: number;
  ownerId: string;
}

export default function Leagues() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [alliances, setAlliances] = useState<ClubAlliance[]>([]);
  const [seasons, setSeasons] = useState<LeagueSeason[]>([]);
  const [clubs, setClubs] = useState<ClubData[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"alliances" | "leagues">("alliances");

  // Create alliance modal
  const [showCreate, setShowCreate] = useState(false);
  const [createType, setCreateType] = useState<"alliance" | "league">("alliance");
  const [createName, setCreateName] = useState("");
  const [createLoading, setCreateLoading] = useState(false);
  const [selectedClubId, setSelectedClubId] = useState("");

  // League form extras
  const [leagueStart, setLeagueStart] = useState("");
  const [leagueEnd, setLeagueEnd] = useState("");

  const loadData = useCallback(async () => {
    try {
      const [allianceRes, leagueRes, clubsRes] = await Promise.all([
        fetch("/api/alliances"),
        fetch("/api/leagues"),
        fetch("/api/clubs"),
      ]);
      if (allianceRes.ok) setAlliances(await allianceRes.json());
      if (leagueRes.ok) setSeasons(await leagueRes.json());
      if (clubsRes.ok) setClubs(await clubsRes.json());
    } catch (err: any) {
      toast({ title: "Failed to load data", description: err?.message || "Something went wrong", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { loadData(); }, [loadData]);

  const clubMap = new Map(clubs.map(c => [c.id, c]));

  const handleCreate = async () => {
    if (!createName.trim()) return;
    setCreateLoading(true);
    try {
      if (createType === "alliance") {
        if (!selectedClubId) return;
        const res = await fetch("/api/alliances", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: createName.trim(), clubId: selectedClubId }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({ message: "Failed to create alliance" }));
          throw new Error(err.message);
        }
      } else {
        if (!leagueStart || !leagueEnd) return;
        const res = await fetch("/api/leagues", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: createName.trim(),
            startDate: leagueStart,
            endDate: leagueEnd,
          }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({ message: "Failed to create league" }));
          throw new Error(err.message);
        }
      }
      setShowCreate(false);
      setCreateName("");
      setSelectedClubId("");
      setLeagueStart("");
      setLeagueEnd("");
      await loadData();
    } catch (err: any) {
      toast({ title: `Failed to create ${createType}`, description: err?.message || "Something went wrong", variant: "destructive" });
    } finally {
      setCreateLoading(false);
    }
  };

  const tabs = [
    { id: "alliances" as const, label: "Alliances", icon: Swords, count: alliances.length },
    { id: "leagues" as const, label: "League Seasons", icon: Trophy, count: seasons.length },
  ];

  const getSeasonStatus = (s: LeagueSeason) => {
    const now = new Date();
    const start = new Date(s.startDate);
    const end = new Date(s.endDate);
    if (now < start) return { label: "Upcoming", color: "text-amber-400", bg: "bg-amber-500/10 border-amber-500/20" };
    if (now > end) return { label: "Completed", color: "text-gray-400", bg: "bg-gray-500/10 border-gray-500/20" };
    return { label: "Active", color: "text-green-400", bg: "bg-green-500/10 border-green-500/20" };
  };

  return (
    <DashboardLayout title="League & Alliances">
      <div className="px-8 pb-8">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-cyan-400" />
          </div>
        ) : (
          <>
            {/* Tab Bar */}
            <div className="flex items-center gap-2 mb-6">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <motion.button
                    key={tab.id}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all border ${
                      isActive
                        ? "bg-cyan-500/15 text-cyan-400 border-cyan-500/20 shadow-[0_0_15px_rgba(0,240,255,0.05)]"
                        : "text-gray-500 hover:text-gray-300 border-white/5 hover:border-white/10 bg-white/[0.02]"
                    }`}
                  >
                    <Icon className={`w-4 h-4 ${isActive ? "text-cyan-400" : "text-gray-600"}`} />
                    {tab.label}
                    {tab.count > 0 && (
                      <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${
                        isActive ? "bg-cyan-500/20 text-cyan-400" : "bg-white/5 text-gray-500"
                      }`}>
                        {tab.count}
                      </span>
                    )}
                  </motion.button>
                );
              })}
              <div className="flex-1" />
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => {
                  setCreateType(activeTab === "alliances" ? "alliance" : "league");
                  setShowCreate(true);
                }}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-[10px] font-bold uppercase tracking-wider text-black shadow-[0_0_20px_rgba(201,168,76,0.3)]"
                style={{
                  background: "linear-gradient(135deg, #c9a84c, #f0d078)",
                }}
              >
                <Plus className="w-3.5 h-3.5" />
                Create {activeTab === "alliances" ? "Alliance" : "Season"}
              </motion.button>
            </div>

            {/* Alliances Tab */}
            {activeTab === "alliances" && (
              <div className="space-y-4">
                {alliances.length === 0 ? (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex flex-col items-center justify-center py-16 text-center"
                  >
                    <div className="w-16 h-16 rounded-2xl bg-cyan-500/10 border border-cyan-500/15 flex items-center justify-center mb-4">
                      <Swords className="w-8 h-8 text-cyan-400/50" />
                    </div>
                    <h3 className="text-sm font-bold text-cyan-400 uppercase tracking-wider mb-1">No Alliances Yet</h3>
                    <p className="text-xs text-gray-600 max-w-xs">
                      Create an alliance to unite clubs and compete together in leagues.
                    </p>
                  </motion.div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {alliances.map((alliance, i) => {
                      const allianceClubs = (alliance.clubIds as string[]).map(id => clubMap.get(id)).filter(Boolean) as ClubData[];
                      const totalMembers = allianceClubs.reduce((sum, c) => sum + c.memberCount, 0);
                      return (
                        <motion.div
                          key={alliance.id}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: i * 0.05 }}
                          onClick={() => navigate(`/alliances/${alliance.id}`)}
                          className="rounded-xl overflow-hidden cursor-pointer hover:border-cyan-500/25 transition-all"
                          style={{
                            background: "linear-gradient(135deg, rgba(12,20,40,0.95) 0%, rgba(10,16,34,0.98) 100%)",
                            border: "1px solid rgba(0,240,255,0.1)",
                            boxShadow: "0 10px 40px rgba(0,0,0,0.3)",
                          }}
                        >
                          <div className="p-5">
                            <div className="flex items-start gap-3 mb-4">
                              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-cyan-500/20 to-purple-500/20 border border-cyan-500/20 flex items-center justify-center shrink-0">
                                <Swords className="w-5 h-5 text-cyan-400" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <h3 className="text-sm font-bold text-white tracking-wide">{alliance.name}</h3>
                                <div className="flex items-center gap-3 mt-1 text-[10px] text-gray-500">
                                  <span className="flex items-center gap-1">
                                    <Shield className="w-3 h-3" /> {allianceClubs.length} clubs
                                  </span>
                                  <span className="flex items-center gap-1">
                                    <Users className="w-3 h-3" /> {totalMembers} members
                                  </span>
                                </div>
                              </div>
                              <span className={`text-[8px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${
                                allianceClubs.length >= 2
                                  ? "text-green-400 bg-green-500/10 border-green-500/20"
                                  : "text-amber-400 bg-amber-500/10 border-amber-500/20"
                              }`}>
                                {allianceClubs.length >= 2 ? "Active" : "Forming"}
                              </span>
                            </div>

                            {/* Club members of alliance */}
                            <div className="space-y-2">
                              {allianceClubs.map((club, ci) => (
                                <div
                                  key={club.id}
                                  className="flex items-center gap-3 p-2.5 rounded-lg bg-white/5 border border-white/10"
                                >
                                  <div className="w-8 h-8 rounded-lg bg-amber-500/15 border border-amber-500/20 flex items-center justify-center shrink-0">
                                    {ci === 0 ? (
                                      <Crown className="w-4 h-4 text-amber-400" />
                                    ) : (
                                      <Shield className="w-4 h-4 text-cyan-400" />
                                    )}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="text-xs font-semibold text-white truncate">{club.name}</div>
                                    <div className="text-[9px] text-gray-500">{club.memberCount} members</div>
                                  </div>
                                  <ChevronRight className="w-3.5 h-3.5 text-gray-600" />
                                </div>
                              ))}
                            </div>

                            <div className="mt-3 pt-3 border-t border-white/[0.04] flex items-center justify-between">
                              <span className="text-[9px] text-gray-600">
                                Created {new Date(alliance.createdAt).toLocaleDateString()}
                              </span>
                            </div>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Leagues Tab */}
            {activeTab === "leagues" && (
              <div className="space-y-4">
                {seasons.length === 0 ? (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex flex-col items-center justify-center py-16 text-center"
                  >
                    <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/15 flex items-center justify-center mb-4">
                      <Trophy className="w-8 h-8 text-amber-400/50" />
                    </div>
                    <h3 className="text-sm font-bold text-cyan-400 uppercase tracking-wider mb-1">No League Seasons</h3>
                    <p className="text-xs text-gray-600 max-w-xs">
                      Create a league season to track inter-club competition and rankings.
                    </p>
                  </motion.div>
                ) : (
                  seasons.map((season, i) => {
                    const status = getSeasonStatus(season);
                    const standings = (season.standings as any[] || []).sort((a: any, b: any) => b.points - a.points);
                    return (
                      <motion.div
                        key={season.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.05 }}
                        onClick={() => navigate(`/leagues/${season.id}`)}
                        className="rounded-xl overflow-hidden cursor-pointer hover:border-cyan-500/25 transition-all"
                        style={{
                          background: "linear-gradient(135deg, rgba(12,20,40,0.95) 0%, rgba(10,16,34,0.98) 100%)",
                          border: "1px solid rgba(0,240,255,0.1)",
                          boxShadow: "0 10px 40px rgba(0,0,0,0.3)",
                        }}
                      >
                        {/* Season Header */}
                        <div className="px-5 py-4 border-b border-white/[0.04] flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/20 flex items-center justify-center">
                              <Trophy className="w-5 h-5 text-amber-400" />
                            </div>
                            <div>
                              <h3 className="text-sm font-bold text-white tracking-wide">{season.name}</h3>
                              <div className="flex items-center gap-2 mt-0.5 text-[10px] text-gray-500">
                                <Calendar className="w-3 h-3" />
                                {new Date(season.startDate).toLocaleDateString()} — {new Date(season.endDate).toLocaleDateString()}
                              </div>
                            </div>
                          </div>
                          <span className={`text-[8px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${status.bg} ${status.color}`}>
                            {status.label}
                          </span>
                        </div>

                        {/* Standings Table */}
                        {standings.length > 0 ? (
                          <div className="px-5 py-3">
                            <div className="flex items-center gap-4 px-3 py-2 text-[9px] font-bold uppercase tracking-wider text-gray-500 border-b border-white/[0.04]">
                              <span className="w-8 text-center">#</span>
                              <span className="flex-1">Club</span>
                              <span className="w-14 text-center">Points</span>
                              <span className="w-10 text-center">W</span>
                              <span className="w-10 text-center">L</span>
                            </div>
                            {standings.map((entry: any, rank: number) => {
                              const club = clubMap.get(entry.clubId);
                              const medalColors = ["text-amber-400", "text-gray-300", "text-amber-600"];
                              return (
                                <div
                                  key={entry.clubId}
                                  className="flex items-center gap-4 px-3 py-2.5 hover:bg-white/[0.06] transition-colors border-b border-white/[0.02]"
                                >
                                  <span className="w-8 text-center">
                                    {rank < 3 ? (
                                      <Medal className={`w-4 h-4 mx-auto ${medalColors[rank]}`} />
                                    ) : (
                                      <span className="text-xs font-bold text-gray-500">{rank + 1}</span>
                                    )}
                                  </span>
                                  <div className="flex-1 flex items-center gap-2.5 min-w-0">
                                    <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-cyan-500/20 to-purple-500/20 border border-white/10 flex items-center justify-center shrink-0">
                                      <span className="text-[10px] font-bold text-white">
                                        {(entry.clubName || club?.name || "?").charAt(0).toUpperCase()}
                                      </span>
                                    </div>
                                    <span className="text-xs font-semibold text-white truncate">
                                      {entry.clubName || club?.name || entry.clubId.slice(0, 8)}
                                    </span>
                                  </div>
                                  <span className="w-14 text-center text-xs font-bold text-cyan-400">{entry.points}</span>
                                  <span className="w-10 text-center text-xs font-medium text-green-400">{entry.wins}</span>
                                  <span className="w-10 text-center text-xs font-medium text-red-400">{entry.losses}</span>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="px-5 py-6 text-center">
                            <TrendingUp className="w-6 h-6 text-gray-700 mx-auto mb-2" />
                            <p className="text-[11px] text-gray-600">No standings yet — games will populate rankings</p>
                          </div>
                        )}
                      </motion.div>
                    );
                  })
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Create Modal */}
      <AnimatePresence>
        {showCreate && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center px-4"
          >
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowCreate(false)} />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-md rounded-2xl overflow-hidden"
              style={{
                background: "linear-gradient(135deg, rgba(12,20,40,0.98) 0%, rgba(10,16,34,0.99) 100%)",
                border: "1px solid rgba(0,240,255,0.1)",
                boxShadow: "0 25px 80px rgba(0,0,0,0.5), 0 0 40px rgba(0,240,255,0.05)",
              }}
            >
              <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-cyan-500/15 border border-cyan-500/20 flex items-center justify-center">
                    {createType === "alliance" ? (
                      <Swords className="w-5 h-5 text-cyan-400" />
                    ) : (
                      <Trophy className="w-5 h-5 text-amber-400" />
                    )}
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white tracking-wider uppercase">
                      Create {createType === "alliance" ? "Alliance" : "League Season"}
                    </h3>
                    <p className="text-[9px] text-gray-500">
                      {createType === "alliance" ? "Unite clubs under one banner" : "Start a new competitive season"}
                    </p>
                  </div>
                </div>
                <button onClick={() => setShowCreate(false)} className="p-1.5 rounded-lg hover:bg-white/5 transition-colors">
                  <X className="w-4 h-4 text-gray-500" />
                </button>
              </div>

              <div className="p-5 space-y-4">
                {/* Type toggle */}
                <div className="flex gap-2">
                  {(["alliance", "league"] as const).map((type) => (
                    <button
                      key={type}
                      onClick={() => setCreateType(type)}
                      className={`flex-1 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all border ${
                        createType === type
                          ? "bg-cyan-500/15 text-cyan-400 border-cyan-500/20"
                          : "text-gray-500 border-white/5 hover:border-white/10"
                      }`}
                    >
                      {type === "alliance" ? "Alliance" : "League Season"}
                    </button>
                  ))}
                </div>

                {/* Name */}
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-cyan-400 mb-1.5 block">Name</label>
                  <input
                    type="text"
                    value={createName}
                    onChange={(e) => setCreateName(e.target.value)}
                    placeholder={createType === "alliance" ? "Alliance name..." : "Season name..."}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-cyan-500/30 focus:ring-1 focus:ring-cyan-500/20 transition-all"
                  />
                </div>

                {/* Alliance-specific: club picker */}
                {createType === "alliance" && (
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-wider text-cyan-400 mb-1.5 block">Founding Club</label>
                    <select
                      value={selectedClubId}
                      onChange={(e) => setSelectedClubId(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-xs text-white focus:outline-none focus:border-cyan-500/30 focus:ring-1 focus:ring-cyan-500/20 transition-all [color-scheme:dark]"
                    >
                      <option value="">Select a club...</option>
                      {clubs.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                )}

                {/* League-specific: date range */}
                {createType === "league" && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] font-bold uppercase tracking-wider text-cyan-400 mb-1.5 block">Start Date</label>
                      <input
                        type="date"
                        value={leagueStart}
                        onChange={(e) => setLeagueStart(e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-xs text-white focus:outline-none focus:border-cyan-500/30 focus:ring-1 focus:ring-cyan-500/20 transition-all [color-scheme:dark]"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold uppercase tracking-wider text-cyan-400 mb-1.5 block">End Date</label>
                      <input
                        type="date"
                        value={leagueEnd}
                        onChange={(e) => setLeagueEnd(e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-xs text-white focus:outline-none focus:border-cyan-500/30 focus:ring-1 focus:ring-cyan-500/20 transition-all [color-scheme:dark]"
                      />
                    </div>
                  </div>
                )}

                {/* Submit */}
                <div className="flex gap-2 pt-2">
                  <button
                    onClick={() => setShowCreate(false)}
                    className="flex-1 py-2.5 rounded-lg text-[10px] font-bold uppercase tracking-wider text-gray-400 hover:text-white transition-colors"
                    style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCreate}
                    disabled={createLoading || !createName.trim() || (createType === "alliance" && !selectedClubId) || (createType === "league" && (!leagueStart || !leagueEnd))}
                    className="flex-1 py-2.5 rounded-lg text-[10px] font-bold uppercase tracking-wider text-black disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1.5 shadow-[0_0_20px_rgba(201,168,76,0.3)]"
                    style={{
                      background: "linear-gradient(135deg, #c9a84c, #f0d078)",
                    }}
                  >
                    {createLoading ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Check className="w-3.5 h-3.5" />
                    )}
                    Create
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </DashboardLayout>
  );
}
