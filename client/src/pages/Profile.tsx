import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useLocation } from "wouter";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useAuth } from "@/lib/auth-context";
import { MemberAvatar } from "@/components/shared/MemberAvatar";
import {
  User, Coins, Trophy, TrendingUp, Gamepad2,
  Zap, BookOpen, Wallet, Users, Loader2
} from "lucide-react";
import goldChips from "@assets/generated_images/gold_chip_stack_3d.png";

interface PlayerStats {
  handsPlayed: number;
  potsWon: number;
  bestWinStreak: number;
  currentWinStreak: number;
  totalWinnings: number;
  vpip: number;
  pfr: number;
  showdownCount: number;
}

export default function Profile() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [stats, setStats] = useState<PlayerStats | null>(null);
  const [loading, setLoading] = useState(true);

  const [statsError, setStatsError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/stats/me")
      .then(r => {
        if (r.status === 401) throw new Error("Session expired — please log in again");
        if (!r.ok) throw new Error("Failed to load stats");
        return r.json();
      })
      .then(data => setStats(data))
      .catch((err) => setStatsError(err.message || "Failed to load stats"))
      .finally(() => setLoading(false));
  }, []);

  const winRate = stats && stats.handsPlayed > 0
    ? Math.round((stats.potsWon / stats.handsPlayed) * 100)
    : 0;

  return (
    <DashboardLayout title="Profile">
      <div className="px-8 pb-8 max-w-4xl mx-auto">
        {/* Profile Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass rounded-2xl p-8 border border-white/5 relative overflow-hidden mb-6"
        >
          {/* Gold chips decorative accent */}
          <img
            src={goldChips}
            alt=""
            className="absolute -top-4 -right-8 w-40 h-40 object-contain opacity-15 pointer-events-none rotate-12"
          />
          <div className="absolute -top-20 -right-20 w-60 h-60 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-purple-500/5 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 flex items-center gap-6">
            <div className="relative">
              <MemberAvatar
                avatarId={user?.avatarId ?? null}
                displayName={user?.displayName || user?.username || "Player"}
                size="lg"
              />
              <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-green-400 border-2 border-[#111b2a] shadow-[0_0_6px_rgba(74,222,128,0.6)]" />
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-bold text-white">
                {user?.displayName || user?.username || "Player"}
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">@{user?.username}</p>
              <div className="flex items-center gap-3 mt-2">
                <span className="flex items-center gap-1.5 text-xs text-amber-400 font-bold">
                  <Coins className="w-3.5 h-3.5" />
                  {(user?.chipBalance ?? 0).toLocaleString()} chips
                </span>
                <span className={`px-2 py-0.5 rounded text-[0.5625rem] font-bold uppercase tracking-wider ${
                  user?.role === "admin"
                    ? "bg-purple-500/15 text-purple-400 border border-purple-500/20"
                    : "bg-amber-500/15 text-amber-400 border border-amber-500/20"
                }`}>
                  {user?.role || "member"}
                </span>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Stats Grid */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="glass rounded-xl p-6 border border-white/5 mb-6"
        >
          <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-4 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-amber-500/70" />
            Your Statistics
          </h3>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-amber-400" />
            </div>
          ) : statsError ? (
            <div className="flex items-center justify-center py-8">
              <p className="text-sm text-red-400">{statsError}</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-4 rounded-lg bg-white/5 border border-amber-500/10">
                <Gamepad2 className="w-5 h-5 text-amber-400 mx-auto mb-2" />
                <div className="text-2xl font-bold text-amber-400">{stats?.handsPlayed ?? 0}</div>
                <div className="text-[0.5625rem] text-gray-500 uppercase tracking-wider mt-1">Hands Played</div>
              </div>
              <div className="text-center p-4 rounded-lg bg-white/5 border border-green-500/10">
                <Trophy className="w-5 h-5 text-green-400 mx-auto mb-2" />
                <div className="text-2xl font-bold text-green-400">{stats?.potsWon ?? 0}</div>
                <div className="text-[0.5625rem] text-gray-500 uppercase tracking-wider mt-1">Pots Won</div>
              </div>
              <div className="text-center p-4 rounded-lg bg-white/5 border border-amber-500/10">
                <TrendingUp className="w-5 h-5 text-amber-400 mx-auto mb-2" />
                <div className="text-2xl font-bold text-amber-400">{winRate}%</div>
                <div className="text-[0.5625rem] text-gray-500 uppercase tracking-wider mt-1">Win Rate</div>
              </div>
              <div className="text-center p-4 rounded-lg bg-white/5 border border-purple-500/10">
                <Zap className="w-5 h-5 text-purple-400 mx-auto mb-2" />
                <div className="text-2xl font-bold text-purple-400">{stats?.bestWinStreak ?? 0}</div>
                <div className="text-[0.5625rem] text-gray-500 uppercase tracking-wider mt-1">Best Streak</div>
              </div>
            </div>
          )}

          {/* Detailed Stats */}
          {!loading && stats && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
              <div className="flex items-center justify-between p-3 rounded-lg bg-white/[0.02]">
                <span className="text-[0.625rem] text-gray-500">Current Streak</span>
                <span className="text-xs font-bold text-white">{stats.currentWinStreak}</span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-white/[0.02]">
                <span className="text-[0.625rem] text-gray-500">Total Winnings</span>
                <span className="text-xs font-bold text-green-400">{stats.totalWinnings.toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-white/[0.02]">
                <span className="text-[0.625rem] text-gray-500">VPIP</span>
                <span className="text-xs font-bold text-white">
                  {stats.handsPlayed > 0 ? Math.round((stats.vpip / stats.handsPlayed) * 100) : 0}%
                </span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-white/[0.02]">
                <span className="text-[0.625rem] text-gray-500">PFR</span>
                <span className="text-xs font-bold text-white">
                  {stats.handsPlayed > 0 ? Math.round((stats.pfr / stats.handsPlayed) * 100) : 0}%
                </span>
              </div>
            </div>
          )}
        </motion.div>

        {/* Quick Links */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="grid grid-cols-2 md:grid-cols-4 gap-3"
        >
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => navigate("/wallet")}
            className="glass rounded-xl p-4 border border-white/5 hover:border-amber-500/20 transition-all text-center group"
          >
            <Wallet className="w-5 h-5 text-amber-400 mx-auto mb-2" />
            <span className="text-[0.625rem] font-bold text-gray-400 uppercase tracking-wider group-hover:text-white transition-colors">
              Wallet
            </span>
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => navigate("/analytics")}
            className="glass rounded-xl p-4 border border-white/5 hover:border-amber-500/20 transition-all text-center group"
          >
            <BookOpen className="w-5 h-5 text-amber-400 mx-auto mb-2" />
            <span className="text-[0.625rem] font-bold text-gray-400 uppercase tracking-wider group-hover:text-white transition-colors">
              Analytics
            </span>
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => navigate("/club")}
            className="glass rounded-xl p-4 border border-white/5 hover:border-green-500/20 transition-all text-center group"
          >
            <Users className="w-5 h-5 text-green-400 mx-auto mb-2" />
            <span className="text-[0.625rem] font-bold text-gray-400 uppercase tracking-wider group-hover:text-white transition-colors">
              My Club
            </span>
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => navigate("/leaderboard")}
            className="glass rounded-xl p-4 border border-white/5 hover:border-purple-500/20 transition-all text-center group"
          >
            <Trophy className="w-5 h-5 text-purple-400 mx-auto mb-2" />
            <span className="text-[0.625rem] font-bold text-gray-400 uppercase tracking-wider group-hover:text-white transition-colors">
              Leaderboard
            </span>
          </motion.button>
        </motion.div>
      </div>
    </DashboardLayout>
  );
}
