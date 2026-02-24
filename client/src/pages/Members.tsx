import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useAuth } from "@/lib/auth-context";
import {
  Crown, Shield, User, Circle, Clock, Loader2,
  Gamepad2, Coins, Target, Users
} from "lucide-react";

interface ClubMember {
  userId: string;
  username: string;
  displayName: string;
  avatarId: string | null;
  chipBalance: number;
  role: string;
  joinedAt: string;
}

interface ClubData {
  id: string;
  name: string;
  memberCount: number;
}

interface PlayerStats {
  handsPlayed: number;
  potsWon: number;
  bestWinStreak: number;
  currentWinStreak: number;
  totalWinnings: number;
}

function RoleBadge({ role }: { role: string }) {
  const config: Record<string, { color: string; icon: any; bg: string }> = {
    owner: { color: "text-amber-400", icon: Crown, bg: "bg-amber-500/10 border-amber-500/20" },
    manager: { color: "text-cyan-400", icon: Shield, bg: "bg-cyan-500/10 border-cyan-500/20" },
    member: { color: "text-gray-400", icon: User, bg: "bg-gray-500/10 border-gray-500/20" },
  };
  const c = config[role] || config.member;
  const Icon = c.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${c.color} ${c.bg} border`}>
      <Icon className="w-2.5 h-2.5" />
      {role}
    </span>
  );
}

const MISSION_DEFS = [
  { id: "1", icon: Gamepad2, label: "Play Hands", target: 50, statKey: "handsPlayed" as const, reward: 200 },
  { id: "2", icon: Coins, label: "Win Pots", target: 20, statKey: "potsWon" as const, reward: 500 },
  { id: "3", icon: Target, label: "Win Streak", target: 5, statKey: "bestWinStreak" as const, reward: 750 },
];

export default function Members() {
  const { user } = useAuth();
  const [club, setClub] = useState<ClubData | null>(null);
  const [members, setMembers] = useState<ClubMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<PlayerStats | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const [clubsRes, statsRes] = await Promise.all([
          fetch("/api/clubs"),
          fetch("/api/stats/me"),
        ]);

        if (statsRes.ok) {
          setStats(await statsRes.json());
        }

        if (!clubsRes.ok) return;
        const clubs: ClubData[] = await clubsRes.json();
        if (clubs.length === 0) { setLoading(false); return; }

        const myClub = clubs[0];
        setClub(myClub);

        const membersRes = await fetch(`/api/clubs/${myClub.id}/members`);
        if (membersRes.ok) {
          setMembers(await membersRes.json());
        }
      } catch {} finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return (
    <DashboardLayout title="Members">
      <div className="px-8 pb-8">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-cyan-400" />
          </div>
        ) : members.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Users className="w-12 h-12 text-gray-700 mb-4" />
            <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-1">No Members Yet</h3>
            <p className="text-xs text-gray-600 max-w-xs">
              {club ? "This club doesn't have any members yet. Invite friends to join!" : "Join or create a club to see members here."}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Members List (2 columns) */}
            <div className="lg:col-span-2">
              <div
                className="glass rounded-xl overflow-hidden border border-cyan-500/10"
                style={{ boxShadow: "0 0 30px rgba(0,240,255,0.03)" }}
              >
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-3 border-b border-white/5">
                  <div className="grid grid-cols-4 gap-4 flex-1 text-[9px] font-bold uppercase tracking-wider text-gray-500">
                    <span>Name / Role</span>
                    <span>Joined</span>
                    <span>Balance</span>
                    <span></span>
                  </div>
                </div>

                {/* Member rows */}
                {members.map((member, i) => (
                  <motion.div
                    key={member.userId}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.1 }}
                    className="flex items-center px-5 py-4 border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors"
                  >
                    <div className="grid grid-cols-4 gap-4 flex-1 items-center">
                      {/* Avatar + Name */}
                      <div className="flex items-center gap-3">
                        <div className="relative">
                          <div
                            className="w-12 h-12 rounded-full overflow-hidden border-2 border-white/10 flex items-center justify-center bg-gradient-to-br from-cyan-500/30 to-purple-500/30"
                            style={{ boxShadow: "0 0 15px rgba(0,240,255,0.1)" }}
                          >
                            <span className="text-sm font-bold text-white">
                              {member.displayName.charAt(0).toUpperCase()}
                            </span>
                          </div>
                        </div>
                        <div>
                          <div className="text-sm font-semibold text-white">{member.displayName}</div>
                          <RoleBadge role={member.role} />
                        </div>
                      </div>

                      {/* Joined date */}
                      <div className="flex items-center gap-2">
                        <Clock className="w-3 h-3 text-gray-600" />
                        <span className="text-xs text-gray-500">
                          {new Date(member.joinedAt).toLocaleDateString()}
                        </span>
                      </div>

                      {/* Balance */}
                      <div className="flex items-center gap-1">
                        <span className="text-sm font-bold text-white">
                          {(member.chipBalance / 1000).toFixed(1)}k
                        </span>
                        <span className="text-xs text-gray-500">chips</span>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center justify-end">
                        {member.userId === user?.id && (
                          <span className="text-[9px] text-cyan-400 font-bold uppercase">You</span>
                        )}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>

            {/* Right Panel */}
            <div className="space-y-4">
              {/* Club Info */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="glass rounded-xl p-4 border border-white/5"
              >
                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3">
                  Club Info
                </h3>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-gray-500">Club Name</span>
                    <span className="text-xs font-bold text-cyan-400">{club?.name || "\u2014"}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-gray-500">Total Members</span>
                    <span className="text-xs font-bold text-green-400">{members.length}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-gray-500">Owners</span>
                    <span className="text-xs font-bold text-amber-400">
                      {members.filter(m => m.role === "owner").length}
                    </span>
                  </div>
                </div>
              </motion.div>
            </div>
          </div>
        )}

        {/* Bottom Widgets */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
          {/* Daily Missions — Real Stats */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="glass rounded-xl p-5 border border-white/5"
          >
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-4">
              Daily Missions
            </h3>
            <div className="grid grid-cols-3 gap-3">
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

          {/* Your Stats */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="glass rounded-xl p-5 border border-white/5"
          >
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-4">
              Your Stats
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="text-center p-3 rounded-lg" style={{ background: "rgba(0,240,255,0.03)", border: "1px solid rgba(0,240,255,0.08)" }}>
                <div className="text-lg font-bold text-cyan-400">{stats?.handsPlayed ?? 0}</div>
                <div className="text-[9px] text-gray-500 uppercase tracking-wider">Hands Played</div>
              </div>
              <div className="text-center p-3 rounded-lg" style={{ background: "rgba(0,255,157,0.03)", border: "1px solid rgba(0,255,157,0.08)" }}>
                <div className="text-lg font-bold text-green-400">{stats?.potsWon ?? 0}</div>
                <div className="text-[9px] text-gray-500 uppercase tracking-wider">Pots Won</div>
              </div>
              <div className="text-center p-3 rounded-lg" style={{ background: "rgba(234,179,8,0.03)", border: "1px solid rgba(234,179,8,0.08)" }}>
                <div className="text-lg font-bold text-amber-400">{stats?.bestWinStreak ?? 0}</div>
                <div className="text-[9px] text-gray-500 uppercase tracking-wider">Best Streak</div>
              </div>
              <div className="text-center p-3 rounded-lg" style={{ background: "rgba(168,85,247,0.03)", border: "1px solid rgba(168,85,247,0.08)" }}>
                <div className="text-lg font-bold text-purple-400">{stats?.currentWinStreak ?? 0}</div>
                <div className="text-[9px] text-gray-500 uppercase tracking-wider">Current Streak</div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </DashboardLayout>
  );
}
