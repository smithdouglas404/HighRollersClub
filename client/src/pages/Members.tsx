import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useAuth } from "@/lib/auth-context";
import {
  Crown, Shield, User, Circle, Clock, Bell,
  CheckCircle, XCircle, Gamepad2, Coins, Target
} from "lucide-react";

import avatar1 from "@assets/generated_images/player_seated_cyberpunk_1.png";
import avatar2 from "@assets/generated_images/player_seated_cyberpunk_2.png";
import avatar3 from "@assets/generated_images/player_seated_cyberpunk_3.png";
import avatar4 from "@assets/generated_images/player_seated_cyberpunk_4.png";

// Mock members data (will be replaced with API)
const MEMBERS = [
  { id: "1", name: "TheonBess", role: "Owner", status: "Online", balance: 48200, avatar: avatar1 },
  { id: "2", name: "CardQueen", role: "Manager", balance: 292400, status: "Online", avatar: avatar2 },
  { id: "3", name: "Bank-StatesHarry", role: "Member", balance: 33000, status: "Offline", avatar: avatar3 },
  { id: "4", name: "NeonViper", role: "Member", balance: 15800, status: "Online", avatar: avatar4 },
];

const PENDING_REQUESTS = [
  { id: "5", name: "PlayerX Teddler", avatar: avatar4, message: "Request to Join" },
];

const DAILY_MISSIONS = [
  { id: "1", icon: Gamepad2, label: "Play Hands", target: 50, current: 23, reward: 200 },
  { id: "2", icon: Coins, label: "20 and Cuts", target: 20, current: 8, reward: 500 },
  { id: "3", icon: Target, label: "30 and Cuts", target: 30, current: 12, reward: 750 },
];

function RoleBadge({ role }: { role: string }) {
  const config: Record<string, { color: string; icon: any; bg: string }> = {
    Owner: { color: "text-amber-400", icon: Crown, bg: "bg-amber-500/10 border-amber-500/20" },
    Manager: { color: "text-cyan-400", icon: Shield, bg: "bg-cyan-500/10 border-cyan-500/20" },
    Member: { color: "text-gray-400", icon: User, bg: "bg-gray-500/10 border-gray-500/20" },
  };
  const c = config[role] || config.Member;
  const Icon = c.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${c.color} ${c.bg} border`}>
      <Icon className="w-2.5 h-2.5" />
      {role}
    </span>
  );
}

export default function Members() {
  return (
    <DashboardLayout title="Members">
      <div className="px-8 pb-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* ─── Members List (2 columns) ─────────────────────── */}
          <div className="lg:col-span-2">
            <div
              className="glass rounded-xl overflow-hidden border border-cyan-500/10"
              style={{ boxShadow: "0 0 30px rgba(0,240,255,0.03)" }}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-3 border-b border-white/5">
                <div className="grid grid-cols-4 gap-4 flex-1 text-[9px] font-bold uppercase tracking-wider text-gray-500">
                  <span>Name / Role</span>
                  <span>Status</span>
                  <span>Stats</span>
                  <span></span>
                </div>
              </div>

              {/* Member rows */}
              {MEMBERS.map((member, i) => (
                <motion.div
                  key={member.id}
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
                          className="w-12 h-12 rounded-full overflow-hidden border-2 border-white/10"
                          style={{ boxShadow: "0 0 15px rgba(0,240,255,0.1)" }}
                        >
                          <img src={member.avatar} alt={member.name} className="w-full h-full object-cover" />
                        </div>
                        <div className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-[#0a0f18] ${
                          member.status === "Online" ? "bg-green-500 shadow-[0_0_6px_rgba(0,255,157,0.5)]" : "bg-gray-600"
                        }`} />
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-white">{member.name}</div>
                        <RoleBadge role={member.role} />
                      </div>
                    </div>

                    {/* Status */}
                    <div className="flex items-center gap-2">
                      <Circle className={`w-2 h-2 fill-current ${
                        member.status === "Online" ? "text-green-500" : "text-gray-600"
                      }`} />
                      <span className={`text-xs ${
                        member.status === "Online" ? "text-green-400" : "text-gray-500"
                      }`}>
                        {member.status}
                      </span>
                    </div>

                    {/* Balance */}
                    <div className="flex items-center gap-1">
                      <span className="text-sm font-bold text-white">
                        {(member.balance / 1000).toFixed(1)}k
                      </span>
                      <span className="text-xs text-gray-500">$</span>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center justify-end">
                      <button className="text-[9px] text-gray-600 hover:text-gray-400 transition-colors">
                        VIEW
                      </button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>

          {/* ─── Right Panel ─────────────────────────────────── */}
          <div className="space-y-4">
            {/* Club & Alliance News */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="glass rounded-xl p-4 border border-white/5"
            >
              <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3">
                Club & Alliance News
              </h3>
              <div className="space-y-2">
                <div className="text-[11px] text-gray-500 leading-relaxed">
                  High Rollers Club <span className="text-cyan-400">welcomed</span> Club Alliance
                  PigsnX TudDst tournament starting soon!
                  Check it out in <span className="text-cyan-400">email</span> and <span className="text-cyan-400">weekly redacted</span>
                </div>
              </div>
            </motion.div>

            {/* Pending Join Requests */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="glass rounded-xl p-4 border border-white/5"
            >
              <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3">
                Pending Join Requests
              </h3>
              {PENDING_REQUESTS.map((req) => (
                <div key={req.id} className="flex items-center gap-3 mb-3">
                  <div className="w-9 h-9 rounded-full overflow-hidden border border-white/10">
                    <img src={req.avatar} alt={req.name} className="w-full h-full object-cover" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium text-white truncate">{req.name}</div>
                    <div className="text-[9px] text-gray-500">{req.message}</div>
                  </div>
                </div>
              ))}
              <div className="flex gap-2">
                <button className="flex-1 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider text-green-400 bg-green-500/15 border border-green-500/20 hover:bg-green-500/25 transition-colors">
                  Approve
                </button>
                <button className="flex-1 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider text-red-400 bg-red-500/15 border border-red-500/20 hover:bg-red-500/25 transition-colors">
                  Decline
                </button>
              </div>
            </motion.div>
          </div>
        </div>

        {/* ─── Bottom Widgets ──────────────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
          {/* Daily Missions */}
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
              {DAILY_MISSIONS.map((mission) => {
                const Icon = mission.icon;
                const progress = Math.round((mission.current / mission.target) * 100);
                return (
                  <div key={mission.id} className="text-center">
                    <div className="w-10 h-10 rounded-lg bg-cyan-500/10 border border-cyan-500/15 flex items-center justify-center mx-auto mb-2">
                      <Icon className="w-4 h-4 text-cyan-400" />
                    </div>
                    <div className="text-[10px] font-medium text-gray-300 mb-1">{mission.label}</div>
                    <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden mb-1">
                      <div
                        className="h-full bg-gradient-to-r from-cyan-500 to-green-500 rounded-full transition-all"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                    <div className="text-[9px] text-gray-500">
                      {mission.current}/{mission.target}
                      <span className="text-amber-400 ml-1">+{mission.reward}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>

          {/* Upcoming Private Games */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="glass rounded-xl p-5 border border-white/5"
          >
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-4">
              Upcoming Private Games
            </h3>
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Clock className="w-3.5 h-3.5 text-cyan-400" />
                  <span className="text-sm font-bold text-white">Tonight @ 9 PM EST</span>
                </div>
                <div className="text-[10px] text-gray-500">2/4 No Limit Hold'em</div>
              </div>
              <button
                className="px-4 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider text-black"
                style={{
                  background: "linear-gradient(135deg, #00ff9d, #00d4aa)",
                  boxShadow: "0 0 15px rgba(0,255,157,0.2)",
                }}
              >
                Remind Me
              </button>
            </div>
          </motion.div>
        </div>
      </div>
    </DashboardLayout>
  );
}
