import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth-context";
import { useClub } from "@/lib/club-context";
import {
  Swords, Shield, Crown, Users, ChevronLeft, Trash2,
  Edit2, UserPlus, Loader2, X, Check, LogOut,
} from "lucide-react";

interface AllianceClub {
  id: string;
  name: string;
  ownerId: string | null;
  memberCount: number;
}

interface AllianceDetail {
  id: string;
  name: string;
  clubIds: string[];
  clubs: AllianceClub[];
  createdAt: string;
}

interface MyClub {
  id: string;
  name: string;
  memberCount: number;
  ownerId: string;
}

export default function AllianceDetail({ allianceId }: { allianceId: string }) {
  const { user } = useAuth();
  const { allClubs: contextClubs } = useClub();
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const [alliance, setAlliance] = useState<AllianceDetail | null>(null);
  const myClubs: MyClub[] = contextClubs.map(c => ({ id: c.id, name: c.name, memberCount: c.memberCount, ownerId: c.ownerId }));
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const allianceRes = await fetch(`/api/alliances/${allianceId}`);
      if (!allianceRes.ok) {
        if (allianceRes.status === 404) {
          toast({ title: "Alliance not found", variant: "destructive" });
          navigate("/leagues");
          return;
        }
        throw new Error("Failed to load alliance");
      }
      const allianceData = await allianceRes.json();
      setAlliance(allianceData);
      setEditName(allianceData.name);
    } catch (err: any) {
      toast({ title: "Failed to load data", description: err?.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [allianceId, navigate, toast]);

  useEffect(() => { loadData(); }, [loadData]);

  // Check if user is a leader of the founding club
  const foundingClubId = alliance?.clubIds?.[0];
  const isFoundingLeader = myClubs.some(c => c.id === foundingClubId && c.ownerId === user?.id);

  // Find user's clubs that are not in any alliance (for join)
  const [eligibleClubs, setEligibleClubs] = useState<MyClub[]>([]);
  const [selectedJoinClub, setSelectedJoinClub] = useState("");

  useEffect(() => {
    if (!myClubs.length || !alliance) return;
    const allianceClubIds = new Set(alliance.clubIds);
    // Check each club if it's already in an alliance
    const checkEligibility = async () => {
      const candidates = myClubs.filter(c => !allianceClubIds.has(c.id));
      const results = await Promise.all(
        candidates.map(async (club) => {
          try {
            const res = await fetch(`/api/clubs/${club.id}/alliance`);
            if (res.ok) {
              const data = await res.json();
              return data ? null : club;
            }
          } catch {
            // skip
          }
          return null;
        })
      );
      setEligibleClubs(results.filter(Boolean) as MyClub[]);
    };
    checkEligibility();
  }, [myClubs, alliance]);

  const handleSaveName = async () => {
    if (!editName.trim() || editName === alliance?.name) {
      setEditing(false);
      return;
    }
    setActionLoading(true);
    try {
      const res = await fetch(`/api/alliances/${allianceId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editName.trim() }),
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

  const handleJoin = async () => {
    if (!selectedJoinClub) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/alliances/${allianceId}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clubId: selectedJoinClub }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: "Join failed" }));
        throw new Error(err.message);
      }
      toast({ title: "Club joined the alliance!" });
      setSelectedJoinClub("");
      await loadData();
    } catch (err: any) {
      toast({ title: "Failed to join", description: err?.message, variant: "destructive" });
    } finally {
      setActionLoading(false);
    }
  };

  const handleRemoveClub = async (clubId: string) => {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/alliances/${allianceId}/remove-club`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clubId }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: "Remove failed" }));
        throw new Error(err.message);
      }
      toast({ title: "Club removed from alliance" });
      await loadData();
    } catch (err: any) {
      toast({ title: "Failed to remove club", description: err?.message, variant: "destructive" });
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async () => {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/alliances/${allianceId}`, { method: "DELETE" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: "Delete failed" }));
        throw new Error(err.message);
      }
      toast({ title: "Alliance deleted" });
      navigate("/leagues");
    } catch (err: any) {
      toast({ title: "Failed to delete", description: err?.message, variant: "destructive" });
    } finally {
      setActionLoading(false);
      setConfirmDelete(false);
    }
  };

  // Check if user is a leader of any club in the alliance (for leave/remove own club)
  const myClubInAlliance = myClubs.find(c => alliance?.clubIds?.includes(c.id) && c.id !== foundingClubId);

  return (
    <DashboardLayout title="Alliance Details">
      <div className="px-8 pb-8">
        {/* Back button */}
        <button
          onClick={() => navigate("/leagues")}
          className="flex items-center gap-1.5 text-[0.625rem] font-bold uppercase tracking-wider text-gray-500 hover:text-amber-400 transition-colors mb-6"
        >
          <ChevronLeft className="w-3.5 h-3.5" /> Back to Leagues
        </button>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-amber-400" />
          </div>
        ) : !alliance ? (
          <div className="text-center py-20 text-gray-500">Alliance not found</div>
        ) : (
          <div className="space-y-6">
            {/* Header */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-xl p-6"
              style={{
                background: "linear-gradient(135deg, rgba(20,31,40,0.90) 0%, rgba(16,24,36,0.95) 100%)",
                border: "1px solid rgba(212,168,67,0.1)",
                boxShadow: "0 10px 40px rgba(0,0,0,0.3)",
              }}
            >
              <div className="flex items-start gap-4">
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-amber-500/20 to-purple-500/20 border border-amber-500/20 flex items-center justify-center shrink-0">
                  <Swords className="w-7 h-7 text-amber-400" />
                </div>
                <div className="flex-1 min-w-0">
                  {editing ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="flex-1 bg-white/5 border border-amber-500/30 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-amber-500/20"
                        autoFocus
                      />
                      <button
                        onClick={handleSaveName}
                        disabled={actionLoading}
                        className="p-1.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 transition-colors"
                      >
                        <Check className="w-4 h-4 text-amber-400" />
                      </button>
                      <button
                        onClick={() => { setEditing(false); setEditName(alliance.name); }}
                        className="p-1.5 rounded-lg hover:bg-white/5 transition-colors"
                      >
                        <X className="w-4 h-4 text-gray-500" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <h1 className="text-lg font-bold text-white tracking-wide">{alliance.name}</h1>
                      {isFoundingLeader && (
                        <button
                          onClick={() => setEditing(true)}
                          className="p-1 rounded hover:bg-white/5 transition-colors"
                        >
                          <Edit2 className="w-3.5 h-3.5 text-gray-500" />
                        </button>
                      )}
                    </div>
                  )}
                  <div className="flex items-center gap-4 mt-1.5 text-[0.625rem] text-gray-500">
                    <span className="flex items-center gap-1">
                      <Shield className="w-3 h-3" /> {alliance.clubs.length} clubs
                    </span>
                    <span className="flex items-center gap-1">
                      <Users className="w-3 h-3" /> {alliance.clubs.reduce((sum, c) => sum + c.memberCount, 0)} total members
                    </span>
                    <span>Created {new Date(alliance.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
                <span className={`text-[0.5rem] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${
                  alliance.clubs.length >= 2
                    ? "text-green-400 bg-green-500/10 border-green-500/20"
                    : "text-amber-400 bg-amber-500/10 border-amber-500/20"
                }`}>
                  {alliance.clubs.length >= 2 ? "Active" : "Forming"}
                </span>
              </div>
            </motion.div>

            {/* Member Clubs */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
              className="rounded-xl overflow-hidden"
              style={{
                background: "linear-gradient(135deg, rgba(20,31,40,0.90) 0%, rgba(16,24,36,0.95) 100%)",
                border: "1px solid rgba(212,168,67,0.1)",
                boxShadow: "0 10px 40px rgba(0,0,0,0.3)",
              }}
            >
              <div className="px-5 py-3 border-b border-white/[0.04]">
                <h2 className="text-[0.625rem] font-bold uppercase tracking-wider text-gray-400">Member Clubs</h2>
              </div>
              <div className="p-4 space-y-2">
                {alliance.clubs.map((club, ci) => (
                  <div
                    key={club.id}
                    className="flex items-center gap-3 p-3 rounded-lg bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.06] transition-colors"
                  >
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                      ci === 0 ? "bg-amber-500/15 border border-amber-500/20" : "bg-amber-500/10 border border-amber-500/15"
                    }`}>
                      {ci === 0 ? (
                        <Crown className="w-4 h-4 text-amber-400" />
                      ) : (
                        <Shield className="w-4 h-4 text-amber-400" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold text-white truncate">{club.name}</div>
                      <div className="text-[0.5625rem] text-gray-500">
                        {club.memberCount} members {ci === 0 && "· Founding Club"}
                      </div>
                    </div>
                    {isFoundingLeader && ci > 0 && (
                      <button
                        onClick={() => handleRemoveClub(club.id)}
                        disabled={actionLoading}
                        className="p-1.5 rounded-lg hover:bg-red-500/10 transition-colors group"
                        title="Remove from alliance"
                      >
                        <X className="w-3.5 h-3.5 text-gray-600 group-hover:text-red-400" />
                      </button>
                    )}
                  </div>
                ))}

                {/* Leave alliance (for non-founding club leaders) */}
                {myClubInAlliance && (
                  <button
                    onClick={() => handleRemoveClub(myClubInAlliance.id)}
                    disabled={actionLoading}
                    className="w-full flex items-center justify-center gap-1.5 p-2.5 rounded-lg text-[0.625rem] font-bold uppercase tracking-wider text-red-400 hover:bg-red-500/10 border border-red-500/10 hover:border-red-500/20 transition-all mt-2"
                  >
                    <LogOut className="w-3.5 h-3.5" /> Leave Alliance
                  </button>
                )}
              </div>
            </motion.div>

            {/* Join Section */}
            {eligibleClubs.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="rounded-xl p-5"
                style={{
                  background: "linear-gradient(135deg, rgba(20,31,40,0.90) 0%, rgba(16,24,36,0.95) 100%)",
                  border: "1px solid rgba(212,168,67,0.1)",
                  boxShadow: "0 10px 40px rgba(0,0,0,0.3)",
                }}
              >
                <h2 className="text-[0.625rem] font-bold uppercase tracking-wider text-gray-400 mb-3">Join This Alliance</h2>
                <div className="flex items-center gap-3">
                  <select
                    value={selectedJoinClub}
                    onChange={(e) => setSelectedJoinClub(e.target.value)}
                    className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-xs text-white focus:outline-none focus:border-amber-500/30 focus:ring-1 focus:ring-amber-500/20 transition-all [color-scheme:dark]"
                  >
                    <option value="">Select your club...</option>
                    {eligibleClubs.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                  <button
                    onClick={handleJoin}
                    disabled={actionLoading || !selectedJoinClub}
                    className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-[0.625rem] font-bold uppercase tracking-wider text-black disabled:opacity-40 shadow-[0_0_20px_rgba(201,168,76,0.3)]"
                    style={{ background: "linear-gradient(135deg, #c9a84c, #f0d078)" }}
                  >
                    <UserPlus className="w-3.5 h-3.5" /> Join
                  </button>
                </div>
              </motion.div>
            )}

            {/* Management (founding leader only) */}
            {isFoundingLeader && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
                className="rounded-xl p-5"
                style={{
                  background: "linear-gradient(135deg, rgba(20,31,40,0.90) 0%, rgba(16,24,36,0.95) 100%)",
                  border: "1px solid rgba(239,68,68,0.1)",
                }}
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
                    <Trash2 className="w-3.5 h-3.5" /> Delete Alliance
                  </button>
                )}
              </motion.div>
            )}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
