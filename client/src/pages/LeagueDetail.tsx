import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { DashboardLayout } from "@/components/DashboardLayout";
import { GoldButton, GoldCard, SectionHeader, NumberTicker } from "@/components/premium/PremiumComponents";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth-context";
import {
  Trophy, Calendar, ArrowLeft, Trash2, Edit2, Medal,
  Loader2, X, Check, Plus, TrendingUp, Save, Flag,
} from "lucide-react";

interface StandingsEntry {
  clubId: string;
  clubName?: string;
  points: number;
  wins: number;
  losses: number;
}

interface LeagueSeasonData {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  standings: StandingsEntry[] | null;
  createdAt: string;
}

interface ClubData {
  id: string;
  name: string;
  memberCount: number;
  ownerId: string;
}

export default function LeagueDetail({ seasonId }: { seasonId: string }) {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const [season, setSeason] = useState<LeagueSeasonData | null>(null);
  const [clubs, setClubs] = useState<ClubData[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  // Editing
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editStart, setEditStart] = useState("");
  const [editEnd, setEditEnd] = useState("");

  // Standings editor
  const [editingStandings, setEditingStandings] = useState(false);
  const [standingsData, setStandingsData] = useState<StandingsEntry[]>([]);
  const [addClubId, setAddClubId] = useState("");

  // Delete confirm
  const [confirmDelete, setConfirmDelete] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [seasonRes, clubsRes] = await Promise.all([
        fetch(`/api/leagues/${seasonId}`),
        fetch("/api/clubs"),
      ]);
      if (!seasonRes.ok) {
        if (seasonRes.status === 404) {
          toast({ title: "League season not found", variant: "destructive" });
          navigate("/leagues");
          return;
        }
        throw new Error("Failed to load league");
      }
      const seasonData = await seasonRes.json();
      setSeason(seasonData);
      setEditName(seasonData.name);
      setEditStart(new Date(seasonData.startDate).toISOString().split("T")[0]);
      setEditEnd(new Date(seasonData.endDate).toISOString().split("T")[0]);
      setStandingsData(seasonData.standings || []);
      if (clubsRes.ok) setClubs(await clubsRes.json());
    } catch (err: any) {
      toast({ title: "Failed to load data", description: err?.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [seasonId, navigate, toast]);

  useEffect(() => { loadData(); }, [loadData]);

  const getSeasonStatus = (s: LeagueSeasonData) => {
    const now = new Date();
    const start = new Date(s.startDate);
    const end = new Date(s.endDate);
    if (now < start) return { label: "Upcoming", color: "text-primary", bg: "bg-primary/10 border-primary/20" };
    if (now > end) return { label: "Completed", color: "text-gray-400", bg: "bg-gray-500/10 border-gray-500/20" };
    return { label: "Active", color: "text-green-400", bg: "bg-green-500/10 border-green-500/20" };
  };

  const clubMap = new Map(clubs.map(c => [c.id, c]));
  // All clubs for the "add club" dropdown (exclude clubs already in standings)
  const standingsClubIds = new Set(standingsData.map(s => s.clubId));

  const handleSaveDetails = async () => {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/leagues/${seasonId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editName.trim(),
          startDate: editStart,
          endDate: editEnd,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: "Update failed" }));
        throw new Error(err.message);
      }
      setEditing(false);
      await loadData();
    } catch (err: any) {
      toast({ title: "Failed to update", description: err?.message, variant: "destructive" });
    } finally {
      setActionLoading(false);
    }
  };

  const handleSaveStandings = async () => {
    setActionLoading(true);
    try {
      // Enrich with club names
      const enriched = standingsData.map(s => ({
        ...s,
        clubName: clubMap.get(s.clubId)?.name || s.clubName || "Unknown",
      }));
      const res = await fetch(`/api/leagues/${seasonId}/standings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ standings: enriched }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: "Update failed" }));
        throw new Error(err.message);
      }
      toast({ title: "Standings updated" });
      setEditingStandings(false);
      await loadData();
    } catch (err: any) {
      toast({ title: "Failed to save standings", description: err?.message, variant: "destructive" });
    } finally {
      setActionLoading(false);
    }
  };

  const handleAddClub = () => {
    if (!addClubId) return;
    const club = clubMap.get(addClubId);
    setStandingsData([...standingsData, {
      clubId: addClubId,
      clubName: club?.name || "Unknown",
      points: 0,
      wins: 0,
      losses: 0,
    }]);
    setAddClubId("");
  };

  const handleRemoveFromStandings = (clubId: string) => {
    setStandingsData(standingsData.filter(s => s.clubId !== clubId));
  };

  const updateStandingsEntry = (clubId: string, field: keyof StandingsEntry, value: number) => {
    setStandingsData(standingsData.map(s =>
      s.clubId === clubId ? { ...s, [field]: value } : s
    ));
  };

  const handleCompleteSeason = async () => {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/leagues/${seasonId}/complete`, { method: "POST" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: "Failed to complete" }));
        throw new Error(err.message);
      }
      toast({ title: "Season marked as completed" });
      await loadData();
    } catch (err: any) {
      toast({ title: "Failed to complete season", description: err?.message, variant: "destructive" });
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async () => {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/leagues/${seasonId}`, { method: "DELETE" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: "Delete failed" }));
        throw new Error(err.message);
      }
      toast({ title: "League season deleted" });
      navigate("/leagues");
    } catch (err: any) {
      toast({ title: "Failed to delete", description: err?.message, variant: "destructive" });
    } finally {
      setActionLoading(false);
      setConfirmDelete(false);
    }
  };

  const status = season ? getSeasonStatus(season) : null;
  const isActive = status?.label === "Active";
  const sortedStandings = [...(season?.standings || [])].sort((a, b) => b.points - a.points);
  const medalColors = ["text-primary", "text-gray-300", "text-primary/60"];

  return (
    <DashboardLayout title="League Details">
      <div className="px-8 pb-8">
        <div className="mb-6">
          <button onClick={() => navigate("/leagues")} className="p-2 rounded-lg hover:bg-white/5 transition-colors border border-white/[0.06]" aria-label="Back to leagues">
            <ArrowLeft className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : !season ? (
          <div className="text-center py-20 text-gray-500">League season not found</div>
        ) : (
          <div className="space-y-6">
            {/* Header */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-xl p-6 bg-[#1a1610]/80 backdrop-blur-xl border border-primary/15"
            >
              {editing ? (
                <div className="space-y-4">
                  <div>
                    <label className="text-[0.625rem] font-bold uppercase tracking-wider text-primary mb-1.5 block">Name</label>
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-xs text-white focus:outline-none focus:border-primary/30 focus:ring-1 focus:ring-amber-500/20 transition-all"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[0.625rem] font-bold uppercase tracking-wider text-primary mb-1.5 block">Start Date</label>
                      <input
                        type="date"
                        value={editStart}
                        onChange={(e) => setEditStart(e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-xs text-white focus:outline-none focus:border-primary/30 focus:ring-1 focus:ring-amber-500/20 transition-all [color-scheme:dark]"
                      />
                    </div>
                    <div>
                      <label className="text-[0.625rem] font-bold uppercase tracking-wider text-primary mb-1.5 block">End Date</label>
                      <input
                        type="date"
                        value={editEnd}
                        onChange={(e) => setEditEnd(e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-xs text-white focus:outline-none focus:border-primary/30 focus:ring-1 focus:ring-amber-500/20 transition-all [color-scheme:dark]"
                      />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <GoldButton
                      onClick={handleSaveDetails}
                      disabled={actionLoading}
                    >
                      {actionLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3.5 h-3.5" />} Save
                    </GoldButton>
                    <button
                      onClick={() => setEditing(false)}
                      className="px-4 py-2 rounded-lg text-[0.625rem] font-bold uppercase tracking-wider text-gray-400 hover:text-white transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-4">
                  <div className="w-14 h-14 rounded-xl bg-primary/15 border border-primary/20 flex items-center justify-center shrink-0">
                    <Trophy className="w-7 h-7 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h1 className="text-lg font-bold font-display text-white tracking-wide">{season.name}</h1>
                      <button
                        onClick={() => setEditing(true)}
                        className="p-1 rounded hover:bg-white/5 transition-colors"
                      >
                        <Edit2 className="w-3.5 h-3.5 text-gray-500" />
                      </button>
                    </div>
                    <div className="flex items-center gap-2 mt-1.5 text-[0.625rem] text-gray-500">
                      <Calendar className="w-3 h-3" />
                      {new Date(season.startDate).toLocaleDateString()} — {new Date(season.endDate).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {status && (
                      <span className={`text-[0.5rem] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${status.bg} ${status.color}`}>
                        {status.label}
                      </span>
                    )}
                    {isActive && (
                      <button
                        onClick={handleCompleteSeason}
                        disabled={actionLoading}
                        className="flex items-center gap-1 px-3 py-1 rounded-lg text-[0.5625rem] font-bold uppercase tracking-wider text-primary bg-primary/10 hover:bg-primary/20 border border-primary/20 transition-colors"
                      >
                        <Flag className="w-3 h-3" /> Complete
                      </button>
                    )}
                  </div>
                </div>
              )}
            </motion.div>

            {/* Standings */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
              className="rounded-xl overflow-hidden bg-[#1a1610]/80 backdrop-blur-xl border border-primary/15"
            >
              <div className="px-5 py-3 border-b border-white/[0.04] flex items-center justify-between">
                <h2 className="text-[0.625rem] font-bold uppercase tracking-wider text-gray-400">Standings</h2>
                {!editingStandings ? (
                  <button
                    onClick={() => { setEditingStandings(true); setStandingsData(season.standings || []); }}
                    className="flex items-center gap-1 px-3 py-1 rounded-lg text-[0.5625rem] font-bold uppercase tracking-wider text-primary hover:bg-primary/10 transition-colors"
                  >
                    <Edit2 className="w-3 h-3" /> Edit
                  </button>
                ) : (
                  <div className="flex gap-2">
                    <GoldButton
                      onClick={handleSaveStandings}
                      disabled={actionLoading}
                    >
                      {actionLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />} Save
                    </GoldButton>
                    <button
                      onClick={() => { setEditingStandings(false); setStandingsData(season.standings || []); }}
                      className="px-3 py-1 rounded-lg text-[0.5625rem] font-bold uppercase tracking-wider text-gray-400 hover:text-white transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>

              {editingStandings ? (
                <div className="p-4 space-y-3">
                  {/* Add club */}
                  <div className="flex items-center gap-2">
                    <select
                      value={addClubId}
                      onChange={(e) => setAddClubId(e.target.value)}
                      className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-primary/30 transition-all [color-scheme:dark]"
                    >
                      <option value="">Add a club...</option>
                      {clubs.filter(c => !standingsClubIds.has(c.id)).map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                    <button
                      onClick={handleAddClub}
                      disabled={!addClubId}
                      className="p-2 rounded-lg bg-primary/15 hover:bg-primary/25 disabled:opacity-40 transition-colors"
                    >
                      <Plus className="w-4 h-4 text-primary" />
                    </button>
                  </div>

                  {/* Editable standings rows */}
                  {standingsData.length > 0 && (
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 px-3 py-1 text-[0.5625rem] font-bold uppercase tracking-wider text-gray-500">
                        <span className="flex-1">Club</span>
                        <span className="w-16 text-center">Points</span>
                        <span className="w-14 text-center">Wins</span>
                        <span className="w-14 text-center">Losses</span>
                        <span className="w-8" />
                      </div>
                      {standingsData.map(entry => {
                        const club = clubMap.get(entry.clubId);
                        return (
                          <div key={entry.clubId} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/[0.02] border border-white/[0.04]">
                            <span className="flex-1 text-xs font-semibold text-white truncate">
                              {entry.clubName || club?.name || entry.clubId.slice(0, 8)}
                            </span>
                            <input
                              type="number"
                              value={entry.points}
                              onChange={(e) => updateStandingsEntry(entry.clubId, "points", parseInt(e.target.value) || 0)}
                              className="w-16 bg-white/5 border border-white/10 rounded px-2 py-1 text-xs text-primary font-mono text-center focus:outline-none focus:border-primary/30"
                            />
                            <input
                              type="number"
                              value={entry.wins}
                              onChange={(e) => updateStandingsEntry(entry.clubId, "wins", parseInt(e.target.value) || 0)}
                              className="w-14 bg-white/5 border border-white/10 rounded px-2 py-1 text-xs text-green-400 font-mono text-center focus:outline-none focus:border-primary/30"
                            />
                            <input
                              type="number"
                              value={entry.losses}
                              onChange={(e) => updateStandingsEntry(entry.clubId, "losses", parseInt(e.target.value) || 0)}
                              className="w-14 bg-white/5 border border-white/10 rounded px-2 py-1 text-xs text-destructive font-mono text-center focus:outline-none focus:border-primary/30"
                            />
                            <button
                              onClick={() => handleRemoveFromStandings(entry.clubId)}
                              className="p-1 rounded hover:bg-red-500/10 transition-colors"
                            >
                              <X className="w-3.5 h-3.5 text-gray-600 hover:text-red-400" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {standingsData.length === 0 && (
                    <div className="text-center py-6 text-[0.6875rem] text-gray-600">
                      No clubs in standings. Use the dropdown above to add clubs.
                    </div>
                  )}
                </div>
              ) : (
                <>
                  {sortedStandings.length > 0 ? (
                    <div className="px-5 py-3">
                      <div className="flex items-center gap-4 px-3 py-2 text-[0.5625rem] font-bold uppercase tracking-wider text-gray-500 border-b border-white/[0.04]">
                        <span className="w-8 text-center">#</span>
                        <span className="flex-1">Club</span>
                        <span className="w-14 text-center">Points</span>
                        <span className="w-10 text-center">W</span>
                        <span className="w-10 text-center">L</span>
                      </div>
                      {sortedStandings.map((entry, rank) => {
                        const club = clubMap.get(entry.clubId);
                        const podiumBorder = rank === 0
                          ? "border-[#c9a84c]/50 bg-[#c9a84c]/[0.04]"
                          : rank === 1
                          ? "border-gray-300/30 bg-gray-300/[0.03]"
                          : rank === 2
                          ? "border-[#cd7f32]/30 bg-[#cd7f32]/[0.03]"
                          : "border-white/[0.02]";
                        return (
                          <div
                            key={entry.clubId}
                            className={`flex items-center gap-4 px-3 py-2.5 hover:bg-white/[0.06] transition-colors rounded-lg ${
                              `border ${podiumBorder}`
                            }`}
                          >
                            <span className="w-8 text-center">
                              {rank < 3 ? (
                                <Medal className={`w-4 h-4 mx-auto ${medalColors[rank]}`} />
                              ) : (
                                <span className="text-xs font-bold text-gray-500">{rank + 1}</span>
                              )}
                            </span>
                            <div className="flex-1 flex items-center gap-2.5 min-w-0">
                              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-amber-500/20 to-primary/20 border border-white/10 flex items-center justify-center shrink-0">
                                <span className="text-[0.625rem] font-bold text-white">
                                  {(entry.clubName || club?.name || "?").charAt(0).toUpperCase()}
                                </span>
                              </div>
                              <span className="text-xs font-semibold text-white truncate">
                                {entry.clubName || club?.name || entry.clubId.slice(0, 8)}
                              </span>
                            </div>
                            <span className="w-14 text-center text-xs font-bold text-primary">{entry.points}</span>
                            <span className="w-10 text-center text-xs font-medium text-green-400">{entry.wins}</span>
                            <span className="w-10 text-center text-xs font-medium text-destructive">{entry.losses}</span>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="px-5 py-8 text-center">
                      <TrendingUp className="w-6 h-6 text-gray-700 mx-auto mb-2" />
                      <p className="text-[0.6875rem] text-gray-600">No standings yet. Click Edit to add clubs and scores.</p>
                    </div>
                  )}
                </>
              )}
            </motion.div>

            {/* Danger Zone */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="rounded-xl p-5 bg-[#1a1610]/80 backdrop-blur-xl border border-red-500/10"
            >
              <h2 className="text-[0.625rem] font-bold uppercase tracking-wider text-gray-400 mb-3">Danger Zone</h2>
              {confirmDelete ? (
                <div className="flex items-center gap-3">
                  <span className="text-xs text-red-400">Are you sure? This cannot be undone.</span>
                  <button
                    onClick={handleDelete}
                    disabled={actionLoading}
                    className="px-3 py-1.5 rounded-lg text-[0.625rem] font-bold uppercase tracking-wider text-white bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 transition-colors"
                  >
                    {actionLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : "Confirm Delete"}
                  </button>
                  <button
                    onClick={() => setConfirmDelete(false)}
                    className="px-3 py-1.5 rounded-lg text-[0.625rem] font-bold uppercase tracking-wider text-gray-400 hover:text-white transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmDelete(true)}
                  className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-[0.625rem] font-bold uppercase tracking-wider text-red-400 hover:bg-red-500/10 border border-red-500/15 hover:border-red-500/25 transition-all"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Delete Season
                </button>
              )}
            </motion.div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
