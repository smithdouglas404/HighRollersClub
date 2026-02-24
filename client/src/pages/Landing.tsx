import { Link } from "wouter";
import { motion } from "framer-motion";
import { Lock, Smartphone, Bitcoin, CreditCard, Cpu, Users, Shield, ChevronRight, Play } from "lucide-react";
import { MatrixRain } from "../components/MatrixRain";

// Assets
import lionLogo from "@assets/generated_images/Golden_Lion_Logo_for_Poker_Table_961614b0.png";
import serverBg from "@assets/generated_images/blurred_server_room_background.png";
import entropyHud from "@assets/generated_images/holographic_network_graph_green.png";
import allianceHud from "@assets/generated_images/holographic_player_alliance_ui.png";
import avatar1 from "@assets/generated_images/cyberpunk_poker_player_avatar_1.png";
import avatar2 from "@assets/generated_images/cyberpunk_poker_player_avatar_2.png";
import avatar3 from "@assets/generated_images/cyberpunk_poker_player_avatar_3.png";
import feltTexture from "@assets/generated_images/Dark_Teal_Poker_Felt_Texture_83ec2760.png";

export default function Landing() {
  return (
    <div className="min-h-screen bg-[#020508] text-white font-sans relative overflow-hidden">
      {/* Background layers */}
      <div className="absolute inset-0 z-0">
        <img src={serverBg} alt="" className="w-full h-full object-cover opacity-25 blur-[1px] scale-110" />
        <div className="absolute inset-0 bg-gradient-to-b from-[#020508]/50 via-[#020508]/70 to-[#020508]" />
      </div>

      {/* Matrix rain on edges */}
      <MatrixRain
        side="both"
        color="#00ff9d"
        opacity={0.15}
        density={0.4}
        speed={1.2}
        className="absolute inset-0 z-[1]"
      />

      {/* Decorative scan line */}
      <div
        className="absolute inset-0 z-[2] pointer-events-none"
        style={{
          background: "repeating-linear-gradient(0deg, transparent 0px, transparent 3px, rgba(0,255,157,0.015) 3px, rgba(0,255,157,0.015) 4px)",
        }}
      />

      {/* Content */}
      <div className="relative z-10 min-h-screen flex flex-col">
        {/* ─── Navbar ─────────────────────────────────────── */}
        <motion.nav
          initial={{ y: -40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.1, duration: 0.6 }}
          className="flex items-center justify-between px-8 py-5"
        >
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 relative">
              <div className="absolute inset-[-4px] bg-amber-500/20 blur-xl rounded-full animate-pulse" />
              <img
                src={lionLogo}
                alt="Logo"
                className="w-full h-full object-contain relative z-10 drop-shadow-[0_0_15px_rgba(201,168,76,0.5)]"
              />
            </div>
            <span className="font-display font-bold text-lg tracking-[0.2em] gold-text">HIGH ROLLERS</span>
          </div>
          <div className="flex items-center gap-6">
            <Link href="/lobby">
              <span className="text-xs text-gray-400 uppercase tracking-wider font-semibold hidden md:block cursor-pointer hover:text-cyan-400 transition-colors">Clubs</span>
            </Link>
            <span className="text-xs text-gray-500 uppercase tracking-wider font-semibold hidden md:block">Leagues</span>
            <span className="text-xs text-gray-500 uppercase tracking-wider font-semibold hidden md:block">Provably Fair</span>
            <Link href="/lobby">
              <button className="glass rounded-lg px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-cyan-400 neon-border-cyan hover:bg-cyan-500/10 transition-all flex items-center gap-2">
                <Play className="w-3 h-3 fill-current" />
                Launch App
              </button>
            </Link>
          </div>
        </motion.nav>

        {/* ─── Hero Section ─────────────────────────────── */}
        <div className="flex-1 flex items-center px-8 lg:px-16">
          <div className="w-full max-w-7xl mx-auto">
            {/* Decorative line */}
            <div className="absolute left-[43%] top-0 bottom-0 w-px bg-gradient-to-b from-transparent via-cyan-500/15 to-transparent -skew-x-12 hidden lg:block" />

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
              {/* Left: Hero text + CTA */}
              <div className="lg:col-span-5 space-y-8">
                <motion.div
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.7, delay: 0.2 }}
                >
                  <div className="inline-flex items-center gap-2 glass rounded-full px-4 py-1.5 mb-6 border border-green-500/20">
                    <div className="w-1.5 h-1.5 rounded-full bg-green-500 shadow-[0_0_6px_rgba(0,255,157,0.6)] animate-pulse" />
                    <span className="text-[10px] text-green-400/80 uppercase tracking-wider font-semibold">Live & Provably Fair</span>
                  </div>

                  <h1 className="text-5xl lg:text-7xl font-black tracking-tight leading-[0.9] mb-4">
                    <span className="block text-white drop-shadow-[0_0_30px_rgba(255,255,255,0.1)]">Build Your</span>
                    <span className="block gold-text drop-shadow-[0_0_30px_rgba(201,168,76,0.3)]">Poker</span>
                    <span className="block text-white drop-shadow-[0_0_30px_rgba(255,255,255,0.1)]">Empire</span>
                  </h1>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.4 }}
                  className="space-y-1"
                >
                  <p className="text-base text-gray-300 leading-relaxed">Advanced Clubs & Leagues.</p>
                  <p className="text-base text-gray-500 leading-relaxed">Inter-Club Alliances. Real-Time Glory.</p>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.6 }}
                  className="flex items-center gap-4 pt-2"
                >
                  <Link href="/lobby">
                    <button
                      className="group relative overflow-hidden rounded-xl px-8 py-4 font-bold text-base uppercase tracking-wider text-black transition-all hover:scale-[1.03] active:scale-[0.98]"
                      style={{
                        background: "linear-gradient(135deg, #00ff9d, #00d4aa, #00f0ff)",
                        boxShadow: "0 0 40px rgba(0,255,157,0.35), 0 0 80px rgba(0,255,157,0.1), inset 0 1px 0 rgba(255,255,255,0.3)",
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
                  <button className="glass rounded-xl px-6 py-3.5 text-sm font-semibold text-gray-400 hover:text-white hover:bg-white/5 transition-all border border-white/5">
                    Learn More
                  </button>
                </motion.div>

                {/* Player avatars row */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.8 }}
                  className="flex items-center gap-3 pt-4"
                >
                  <div className="flex -space-x-3">
                    {[avatar1, avatar2, avatar3].map((av, i) => (
                      <div
                        key={i}
                        className="w-10 h-10 rounded-full overflow-hidden border-2 border-[#0a0f18] shadow-lg"
                        style={{ boxShadow: "0 0 10px rgba(0,240,255,0.15)" }}
                      >
                        <img src={av} alt="" className="w-full h-full object-cover" />
                      </div>
                    ))}
                    <div className="w-10 h-10 rounded-full bg-[#0a1520] border-2 border-[#0a0f18] flex items-center justify-center text-[10px] font-bold text-cyan-400">
                      +2k
                    </div>
                  </div>
                  <span className="text-xs text-gray-500">Playing right now</span>
                </motion.div>
              </div>

              {/* Right: Floating glassmorphic panels */}
              <div className="lg:col-span-7 relative h-[520px] flex items-center justify-center">
                {/* Panel 1: Alliance/Table preview */}
                <motion.div
                  initial={{ opacity: 0, x: -40, y: 30 }}
                  animate={{ opacity: 1, x: 0, y: 0 }}
                  transition={{ duration: 0.8, delay: 0.4 }}
                  className="absolute left-0 lg:left-5 top-10 w-[300px] glass rounded-xl overflow-hidden transform -rotate-2 hover:scale-105 hover:z-30 transition-all duration-300 z-10"
                  style={{
                    border: "1px solid rgba(0,240,255,0.15)",
                    boxShadow: "0 20px 60px rgba(0,0,0,0.5), 0 0 30px rgba(0,240,255,0.05)",
                  }}
                >
                  <div className="flex items-center justify-between p-3 border-b border-white/5">
                    <div className="flex items-center gap-2 text-cyan-400 text-[10px] font-mono uppercase tracking-wider">
                      <Users className="w-3 h-3" />
                      <span>Club Alliance Network</span>
                    </div>
                    <div className="flex gap-1">
                      {[0, 1, 2].map(i => <div key={i} className="w-1 h-1 bg-cyan-500/50 rounded-full" />)}
                    </div>
                  </div>
                  <div className="aspect-[4/3] relative">
                    <img src={allianceHud} className="w-full h-full object-cover opacity-85" alt="Alliance" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                    <div className="absolute bottom-3 left-3 right-3 flex justify-between items-end">
                      <div>
                        <div className="text-[9px] text-gray-500 uppercase tracking-wider">Total Members</div>
                        <div className="text-lg font-bold text-white">2,849</div>
                      </div>
                      <div className="px-2 py-0.5 rounded text-[9px] font-bold text-cyan-400 bg-cyan-500/10 border border-cyan-500/20">
                        ACTIVE
                      </div>
                    </div>
                  </div>
                </motion.div>

                {/* Panel 2: Entropy/Provably Fair */}
                <motion.div
                  initial={{ opacity: 0, x: 40, y: -20 }}
                  animate={{ opacity: 1, x: 0, y: 0 }}
                  transition={{ duration: 0.8, delay: 0.6 }}
                  className="absolute right-0 lg:right-5 top-16 w-[320px] glass rounded-xl overflow-hidden transform rotate-1 hover:scale-105 transition-all duration-300 z-20 shadow-2xl"
                  style={{
                    border: "1px solid rgba(0,255,157,0.15)",
                    boxShadow: "0 20px 60px rgba(0,0,0,0.5), 0 0 30px rgba(0,255,157,0.05)",
                  }}
                >
                  <div className="flex items-center justify-between p-3 border-b border-white/5">
                    <div className="flex items-center gap-2 text-green-400 text-[10px] font-mono uppercase tracking-wider">
                      <Lock className="w-3 h-3" />
                      <span>MULTI-SOURCE ENTROPY</span>
                    </div>
                    <Lock className="w-3 h-3 text-green-400/50" />
                  </div>
                  <div className="aspect-[16/9] relative bg-black/60">
                    <div
                      className="absolute inset-0 z-10 pointer-events-none"
                      style={{
                        background: "repeating-linear-gradient(0deg, transparent 0px, transparent 2px, rgba(0,255,157,0.03) 2px, rgba(0,255,157,0.03) 4px)",
                      }}
                    />
                    <img src={entropyHud} className="w-full h-full object-cover opacity-75 mix-blend-screen" alt="Entropy" />
                    <div className="absolute top-3 right-3 flex flex-col items-end gap-0.5">
                      <div className="text-[8px] font-mono text-green-400/60">SHA-256 VERIFIED</div>
                      <div className="text-[8px] font-mono text-green-400/60">BLOCK #892101</div>
                    </div>
                  </div>
                </motion.div>

                {/* Central: Provably Fair badge */}
                <motion.div
                  initial={{ opacity: 0, scale: 0.7 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.6, delay: 0.9, type: "spring" }}
                  className="absolute bottom-5 left-1/2 lg:left-[38%] -translate-x-1/2 z-30 glass rounded-xl p-4 flex items-center gap-4"
                  style={{
                    border: "1px solid rgba(0,255,157,0.2)",
                    boxShadow: "0 0 50px rgba(0,255,157,0.08), 0 20px 40px rgba(0,0,0,0.4)",
                  }}
                >
                  <div className="relative shrink-0">
                    <div className="absolute inset-[-4px] bg-green-500 blur-xl opacity-25 animate-pulse" />
                    <div className="relative w-12 h-12 rounded-xl bg-green-500/10 border border-green-500/20 flex items-center justify-center">
                      <Shield className="w-6 h-6 text-green-400" />
                    </div>
                  </div>
                  <div>
                    <div className="text-[9px] text-gray-500 font-bold uppercase tracking-wider">Multi-Source Entropy</div>
                    <div className="text-base font-bold text-white leading-tight uppercase tracking-tight">Provably Fair</div>
                    <div className="text-[9px] text-gray-600 font-mono mt-0.5">Fisher-Yates + Blockchain-Seeded</div>
                  </div>
                </motion.div>
              </div>
            </div>
          </div>
        </div>

        {/* ─── Footer / Platform Bar ────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 1 }}
          className="px-8 lg:px-16 py-5 border-t border-white/[0.03]"
        >
          <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-5 opacity-60">
              <div className="flex items-center gap-1.5">
                <svg className="w-4 h-4 fill-current text-gray-400" viewBox="0 0 24 24"><path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-.98-.5-2.08-.52-3.08.06-1.2.6-2.15.54-3.08-.4C4.2 16.46 2.9 11.1 5.3 7.28c1.1-1.8 3.04-2.7 4.43-2.6 1.22.1 2.2.75 2.9.75.7 0 2.08-.8 3.34-.7 1.4.1 2.68.66 3.5 1.77-3.1 1.8-2.5 6.12.5 7.37-.67 1.76-1.6 3.5-2.92 6.4zm-4.6-17.2c.7-1 1.27-2.3 1.1-3.48-1.2.1-2.7 1.05-3.3 2.1-.5.8-.9 2.03.1 3.07.95.15 1.62-.7 2.1-1.7z" /></svg>
                <span className="text-[10px] text-gray-500 font-semibold">iOS</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Smartphone className="w-4 h-4 text-gray-400" />
                <span className="text-[10px] text-gray-500 font-semibold">Android</span>
              </div>
              <div className="h-3 w-px bg-gray-800" />
              <span className="text-[10px] text-gray-500 font-semibold">USDT</span>
              <Bitcoin className="w-4 h-4 text-gray-400" />
              <CreditCard className="w-4 h-4 text-gray-400" />
            </div>

            <div className="flex items-center gap-2.5 opacity-60">
              <div className="text-right">
                <div className="text-[8px] text-gray-600 uppercase tracking-widest">Powered By</div>
                <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Adaptive AI</div>
              </div>
              <div className="w-8 h-8 glass rounded-lg flex items-center justify-center border border-white/5">
                <Cpu className="w-4 h-4 text-gray-500" />
              </div>
            </div>
          </div>
        </motion.div>

        {/* Diamond sparkle */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.4 }}
          transition={{ delay: 1.2 }}
          className="absolute bottom-8 right-8 z-20"
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M10 0L12 8L20 10L12 12L10 20L8 12L0 10L8 8L10 0Z" fill="white" opacity="0.6" />
          </svg>
        </motion.div>
      </div>
    </div>
  );
}
