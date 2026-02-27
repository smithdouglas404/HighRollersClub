import { useState, useEffect } from "react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { Lock, Smartphone, Bitcoin, CreditCard, Cpu, Users, Shield, ChevronRight, Play, Zap, Trophy, Globe, LayoutGrid } from "lucide-react";

// Cinematic DALL-E 3 assets
import lionLogo from "@assets/generated_images/lion_crest_gold_emblem.png";
import serverBg from "@assets/generated_images/cinematic_server_room_bg.png";
import casinoBg from "@assets/generated_images/cyberpunk_casino_bg_wide.png";
import entropyHud from "@assets/generated_images/holographic_hud_overlay.png";
import avatar1 from "@assets/generated_images/player_seated_cyberpunk_1.png";
import avatar2 from "@assets/generated_images/player_seated_cyberpunk_2.png";
import avatar3 from "@assets/generated_images/player_seated_cyberpunk_3.png";
import feltImg from "@assets/generated_images/poker_table_top_cinematic.png";
import chipStack from "@assets/generated_images/gold_chip_stack_3d.png";

const FEATURES = [
  {
    icon: Shield,
    title: "Provably Fair",
    desc: "SHA-256 verified shuffles with multi-source entropy. Every hand auditable.",
    color: "#00d4ff",
  },
  {
    icon: Users,
    title: "Club System",
    desc: "Create or join poker clubs. Organize tournaments and climb inter-club rankings.",
    color: "#00d4ff",
  },
  {
    icon: Trophy,
    title: "Tournaments",
    desc: "Sit & Go, multi-table, and custom blind structures. Real-time leaderboards.",
    color: "#ffd700",
  },
  {
    icon: Zap,
    title: "Real-Time",
    desc: "WebSocket-powered multiplayer. Sub-second response. No lag.",
    color: "#f472b6",
  },
];

export default function Landing() {
  const [stats, setStats] = useState([
    { label: "Players Online", value: "0", icon: Globe },
    { label: "Tables Active", value: "0", icon: LayoutGrid },
    { label: "Prize Pool", value: "$0", icon: Trophy },
  ]);

  useEffect(() => {
    async function fetchStats() {
      try {
        const [usersRes, tablesRes, tournamentsRes] = await Promise.all([
          fetch("/api/online-users"),
          fetch("/api/tables"),
          fetch("/api/tournaments"),
        ]);

        const users = usersRes.ok ? await usersRes.json() : [];
        const tables = tablesRes.ok ? await tablesRes.json() : [];
        const tournaments = tournamentsRes.ok ? await tournamentsRes.json() : [];

        const playersOnline = Array.isArray(users) ? users.length : 0;
        const tablesActive = Array.isArray(tables) ? tables.length : 0;
        const totalPrizePool = Array.isArray(tournaments)
          ? tournaments.reduce((sum: number, t: any) => sum + (Number(t.prizePool) || 0), 0)
          : 0;

        setStats([
          { label: "Players Online", value: playersOnline.toLocaleString(), icon: Globe },
          { label: "Tables Active", value: tablesActive.toLocaleString(), icon: LayoutGrid },
          {
            label: "Prize Pool",
            value: totalPrizePool >= 1000
              ? `$${(totalPrizePool / 1000).toFixed(1)}K`
              : `$${totalPrizePool.toLocaleString()}`,
            icon: Trophy,
          },
        ]);
      } catch (err) {
        console.error("Failed to fetch landing stats:", err);
      }
    }

    fetchStats();
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-[#111b2a] text-white font-sans relative overflow-hidden">
      {/* ─── Background Layers ─────────────────────────── */}
      <div className="absolute inset-0 z-0">
        <img src={casinoBg} alt="" className="w-full h-full object-cover opacity-25 blur-[1px] scale-110" />
        <img src={serverBg} alt="" className="absolute inset-0 w-full h-full object-cover opacity-10 mix-blend-overlay" />
        <div className="absolute inset-0 bg-gradient-to-b from-[#111b2a]/35 via-[#111b2a]/70 to-[#111b2a]" />
      </div>


      {/* Scan lines */}
      <div
        className="absolute inset-0 z-[2] pointer-events-none"
        style={{
          background: "repeating-linear-gradient(0deg, transparent 0px, transparent 3px, rgba(0,212,255,0.012) 3px, rgba(0,212,255,0.012) 4px)",
        }}
      />

      {/* Content */}
      <div className="relative z-10 min-h-screen flex flex-col">

        {/* ─── Navbar ─────────────────────────────────────── */}
        <motion.nav
          initial={{ y: -40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.1, duration: 0.6 }}
          className="flex items-center justify-between px-6 md:px-10 py-4"
        >
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 relative">
              <div className="absolute inset-[-6px] bg-cyan-500/20 blur-xl rounded-full animate-pulse" />
              <img src={lionLogo} alt="Logo" className="w-full h-full object-contain relative z-10 drop-shadow-[0_0_12px_rgba(0,212,255,0.5)]" />
            </div>
            <div className="flex flex-col">
              <span className="font-display font-bold text-sm tracking-[0.25em] gold-text leading-none">HIGH ROLLERS</span>
              <span className="text-[0.5rem] text-gray-600 tracking-[0.3em] font-mono mt-0.5">POKER PLATFORM</span>
            </div>
          </div>

          <div className="flex items-center gap-5">
            <Link href="/lobby">
              <span className="text-[0.6875rem] text-gray-400 uppercase tracking-wider font-semibold hidden md:block cursor-pointer hover:text-cyan-400 transition-colors">Clubs</span>
            </Link>
            <span className="text-[0.6875rem] text-gray-500 uppercase tracking-wider font-semibold hidden md:block cursor-not-allowed">Leagues</span>
            <span className="text-[0.6875rem] text-gray-500 uppercase tracking-wider font-semibold hidden md:block cursor-not-allowed">Provably Fair</span>
            <Link href="/lobby">
              <button className="glass rounded-lg px-5 py-2.5 text-[0.6875rem] font-bold uppercase tracking-wider text-cyan-400 border border-cyan-500/20 hover:bg-cyan-500/10 transition-all flex items-center gap-2 shadow-[0_0_15px_rgba(0,212,255,0.08)]">
                <Play className="w-3 h-3 fill-current" />
                Launch App
              </button>
            </Link>
          </div>
        </motion.nav>

        {/* ─── Hero Section ───────────────────────────────── */}
        <div className="flex-1 flex items-center px-6 md:px-10 lg:px-16 py-8">
          <div className="w-full max-w-7xl mx-auto">
            {/* Decorative vertical line */}
            <div className="absolute left-[42%] top-0 bottom-0 w-px bg-gradient-to-b from-transparent via-amber-500/10 to-transparent -skew-x-12 hidden lg:block" />

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
              {/* Left: Hero content */}
              <div className="lg:col-span-5 space-y-7">
                <motion.div
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.7, delay: 0.2 }}
                >
                  <div className="inline-flex items-center gap-2 glass rounded-full px-4 py-1.5 mb-5 border border-green-500/15">
                    <div className="w-1.5 h-1.5 rounded-full bg-green-500 shadow-[0_0_6px_rgba(0,212,255,0.6)] animate-pulse" />
                    <span className="text-[0.625rem] text-green-400/80 uppercase tracking-wider font-semibold">Live & Provably Fair</span>
                  </div>

                  <h1 className="text-5xl lg:text-7xl font-black tracking-tight leading-[0.9] mb-4">
                    <span className="block text-white drop-shadow-[0_0_30px_rgba(255,255,255,0.08)]">Build Your</span>
                    <span className="block gold-text drop-shadow-[0_0_30px_rgba(0,212,255,0.3)]">Poker</span>
                    <span className="block text-white drop-shadow-[0_0_30px_rgba(255,255,255,0.08)]">Empire</span>
                  </h1>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.4 }}
                >
                  <p className="text-base text-gray-300 leading-relaxed">
                    Create clubs, run tournaments, and compete in
                    <span className="text-cyan-400 font-medium"> real-time multiplayer</span> poker
                    with provably fair shuffles.
                  </p>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.6 }}
                  className="flex items-center gap-4 pt-1"
                >
                  <Link href="/lobby">
                    <button
                      className="group relative overflow-hidden rounded-xl px-8 py-4 font-bold text-base uppercase tracking-wider text-black transition-all hover:scale-[1.03] active:scale-[0.98]"
                      style={{
                        background: "linear-gradient(135deg, #00d4ff, #00d4aa, #00d4ff)",
                        boxShadow: "0 0 40px rgba(0,212,255,0.3), 0 0 80px rgba(0,212,255,0.08), inset 0 1px 0 rgba(255,255,255,0.3)",
                      }}
                    >
                      <div className="absolute inset-0 bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity" />
                      <div className="relative flex items-center gap-2">
                        <Play className="w-4 h-4 fill-current" />
                        Play Now
                        <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                      </div>
                    </button>
                  </Link>
                  <Link href="/game">
                    <button className="glass rounded-xl px-6 py-3.5 text-sm font-semibold text-gray-400 hover:text-white hover:bg-white/5 transition-all border border-white/5">
                      Play Offline
                    </button>
                  </Link>
                </motion.div>

                {/* Live player count */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.8 }}
                  className="flex items-center gap-3 pt-3"
                >
                  <div className="flex -space-x-3">
                    {[avatar1, avatar2, avatar3].map((av, i) => (
                      <div
                        key={i}
                        className="w-10 h-10 rounded-full overflow-hidden border-2 border-[#141f30] shadow-lg"
                        style={{ boxShadow: "0 0 10px rgba(0,212,255,0.12)" }}
                      >
                        <img src={av} alt="" className="w-full h-full object-cover" />
                      </div>
                    ))}
                    <div className="w-10 h-10 rounded-full bg-[#111b2a] border-2 border-[#141f30] flex items-center justify-center text-[0.625rem] font-bold text-cyan-400">
                      +2k
                    </div>
                  </div>
                  <span className="text-xs text-gray-500">Playing right now</span>
                </motion.div>
              </div>

              {/* Right: Floating panels */}
              <div className="lg:col-span-7 relative h-[550px] flex items-center justify-center">

                {/* Table preview panel */}
                <motion.div
                  initial={{ opacity: 0, x: -40, y: 30 }}
                  animate={{ opacity: 1, x: 0, y: 0 }}
                  transition={{ duration: 0.8, delay: 0.4 }}
                  className="absolute left-0 lg:left-2 top-8 w-[300px] glass rounded-xl overflow-hidden transform -rotate-2 hover:scale-[1.03] hover:z-30 transition-all duration-300 z-10"
                  style={{ border: "1px solid rgba(0,212,255,0.12)", boxShadow: "0 20px 60px rgba(0,0,0,0.5), 0 0 25px rgba(0,212,255,0.04)" }}
                >
                  <div className="flex items-center justify-between p-3 border-b border-white/5">
                    <div className="flex items-center gap-2 text-cyan-400 text-[0.625rem] font-mono uppercase tracking-wider">
                      <Users className="w-3 h-3" />
                      <span>Live Table Preview</span>
                    </div>
                    <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                  </div>
                  <div className="aspect-[4/3] relative bg-[#141f30]">
                    <img src={feltImg} className="w-full h-full object-cover opacity-70" alt="Table" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/30" />
                    {/* Mini chip stack */}
                    <img src={chipStack} alt="" className="absolute bottom-4 right-4 w-14 h-14 object-contain opacity-80 drop-shadow-[0_0_10px_rgba(0,212,255,0.3)]" />
                    <div className="absolute bottom-3 left-3">
                      <div className="text-[0.5625rem] text-gray-500 uppercase tracking-wider">High Stakes NLH</div>
                      <div className="text-sm font-bold text-white">50/100 &middot; 6-Max</div>
                    </div>
                  </div>
                </motion.div>

                {/* Provably Fair panel */}
                <motion.div
                  initial={{ opacity: 0, x: 40, y: -20 }}
                  animate={{ opacity: 1, x: 0, y: 0 }}
                  transition={{ duration: 0.8, delay: 0.6 }}
                  className="absolute right-0 lg:right-2 top-12 w-[320px] glass rounded-xl overflow-hidden transform rotate-1 hover:scale-[1.03] transition-all duration-300 z-20"
                  style={{ border: "1px solid rgba(0,212,255,0.12)", boxShadow: "0 20px 60px rgba(0,0,0,0.5), 0 0 25px rgba(0,212,255,0.04)" }}
                >
                  <div className="flex items-center justify-between p-3 border-b border-white/5">
                    <div className="flex items-center gap-2 text-green-400 text-[0.625rem] font-mono uppercase tracking-wider">
                      <Lock className="w-3 h-3" />
                      <span>Multi-Source Entropy</span>
                    </div>
                    <div className="text-[0.5rem] font-mono text-green-400/50">SHA-256</div>
                  </div>
                  <div className="aspect-[16/9] relative bg-black/40">
                    <div
                      className="absolute inset-0 z-10 pointer-events-none"
                      style={{ background: "repeating-linear-gradient(0deg, transparent 0px, transparent 2px, rgba(0,212,255,0.03) 2px, rgba(0,212,255,0.03) 4px)" }}
                    />
                    <img src={entropyHud} className="w-full h-full object-cover opacity-70 mix-blend-screen" alt="Entropy" />
                    <div className="absolute top-3 right-3 flex flex-col items-end gap-1">
                      <div className="text-[0.5rem] font-mono text-green-400/60">VERIFIED ✓</div>
                      <div className="text-[0.5rem] font-mono text-green-400/40">BLOCK #892,101</div>
                    </div>
                    <div className="absolute bottom-3 left-3">
                      <div className="text-[0.5rem] text-gray-600 font-mono">Fisher-Yates + Chainlink VRF</div>
                    </div>
                  </div>
                </motion.div>

                {/* Bottom center: Shield badge */}
                <motion.div
                  initial={{ opacity: 0, scale: 0.7 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.6, delay: 0.9, type: "spring" }}
                  className="absolute bottom-0 left-1/2 lg:left-[38%] -translate-x-1/2 z-30 glass rounded-xl p-4 flex items-center gap-4"
                  style={{ border: "1px solid rgba(0,212,255,0.15)", boxShadow: "0 0 40px rgba(0,212,255,0.06), 0 20px 40px rgba(0,0,0,0.4)" }}
                >
                  <div className="relative shrink-0">
                    <div className="absolute inset-[-4px] bg-green-500 blur-xl opacity-20 animate-pulse" />
                    <div className="relative w-12 h-12 rounded-xl bg-green-500/10 border border-green-500/20 flex items-center justify-center">
                      <Shield className="w-6 h-6 text-green-400" />
                    </div>
                  </div>
                  <div>
                    <div className="text-[0.5625rem] text-gray-500 font-bold uppercase tracking-wider">Blockchain Verified</div>
                    <div className="text-base font-bold text-white leading-tight">Provably Fair</div>
                    <div className="text-[0.5625rem] text-gray-600 font-mono mt-0.5">Every shuffle. Every hand.</div>
                  </div>
                </motion.div>
              </div>
            </div>
          </div>
        </div>

        {/* ─── Features Grid ──────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.1, duration: 0.7 }}
          className="px-6 md:px-10 lg:px-16 pb-12"
        >
          <div className="max-w-7xl mx-auto">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {FEATURES.map((f, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 1.2 + i * 0.1 }}
                  className="glass rounded-xl p-5 border border-white/[0.04] hover:border-white/[0.08] transition-all group"
                >
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center mb-3 transition-all group-hover:scale-110"
                    style={{
                      background: `${f.color}10`,
                      border: `1px solid ${f.color}20`,
                      boxShadow: `0 0 20px ${f.color}08`,
                    }}
                  >
                    <f.icon className="w-5 h-5" style={{ color: f.color }} />
                  </div>
                  <h3 className="text-sm font-bold text-white mb-1">{f.title}</h3>
                  <p className="text-[0.6875rem] text-gray-400 leading-relaxed">{f.desc}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </motion.div>

        {/* ─── Stats Bar ──────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.5 }}
          className="px-6 md:px-10 lg:px-16 pb-6"
        >
          <div className="max-w-7xl mx-auto">
            <div className="glass rounded-xl p-4 flex items-center justify-around border border-white/[0.04]">
              {stats.map((s, i) => (
                <div key={i} className="flex items-center gap-3">
                  <s.icon className="w-4 h-4 text-cyan-400/60" />
                  <div>
                    <div className="text-lg font-bold text-white font-mono">{s.value}</div>
                    <div className="text-[0.5625rem] text-gray-500 uppercase tracking-wider">{s.label}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </motion.div>

        {/* ─── Footer ─────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 1.6 }}
          className="px-6 md:px-10 lg:px-16 py-5 border-t border-white/[0.03]"
        >
          <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4 opacity-50">
              <div className="flex items-center gap-1.5">
                <Smartphone className="w-3.5 h-3.5 text-gray-400" />
                <span className="text-[0.625rem] text-gray-500 font-semibold">iOS & Android</span>
              </div>
              <div className="h-3 w-px bg-gray-800" />
              <span className="text-[0.625rem] text-gray-500 font-semibold">USDT</span>
              <Bitcoin className="w-3.5 h-3.5 text-gray-400" />
              <CreditCard className="w-3.5 h-3.5 text-gray-400" />
            </div>

            <div className="flex items-center gap-2.5 opacity-50">
              <div className="text-right">
                <div className="text-[0.5rem] text-gray-600 uppercase tracking-widest">Powered By</div>
                <div className="text-[0.625rem] font-bold text-gray-400 uppercase tracking-widest">Adaptive AI</div>
              </div>
              <div className="w-7 h-7 glass rounded-lg flex items-center justify-center border border-white/5">
                <Cpu className="w-3.5 h-3.5 text-gray-500" />
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
