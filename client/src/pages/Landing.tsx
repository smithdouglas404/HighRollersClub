import { Link } from "wouter";
import { motion } from "framer-motion";
import { Lock, Smartphone, Bitcoin, CreditCard, Cpu, Users, Shield, ChevronRight } from "lucide-react";
import { AmbientParticles } from "../components/AmbientParticles";

// Assets
import lionLogo from "@assets/generated_images/Golden_Lion_Logo_for_Poker_Table_961614b0.png";
import serverBg from "@assets/generated_images/blurred_server_room_background.png";
import entropyHud from "@assets/generated_images/holographic_network_graph_green.png";
import allianceHud from "@assets/generated_images/holographic_player_alliance_ui.png";
import avatar1 from "@assets/generated_images/cyberpunk_poker_player_avatar_1.png";
import avatar2 from "@assets/generated_images/cyberpunk_poker_player_avatar_2.png";
import avatar3 from "@assets/generated_images/cyberpunk_poker_player_avatar_3.png";

export default function Landing() {
  return (
    <div className="min-h-screen bg-[#020508] text-white font-sans relative overflow-hidden">

      {/* Background layers */}
      <div className="absolute inset-0 z-0">
        <img src={serverBg} alt="" className="w-full h-full object-cover opacity-20 blur-sm scale-110" />
        <div className="absolute inset-0 bg-gradient-to-b from-[#020508]/60 via-[#020508]/80 to-[#020508]" />
        <AmbientParticles />
      </div>

      {/* Content */}
      <div className="relative z-10 min-h-screen flex flex-col">

        {/* Navbar */}
        <motion.nav
          initial={{ y: -40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.1, duration: 0.6 }}
          className="flex items-center justify-between px-8 py-5"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 relative">
              <div className="absolute inset-0 bg-yellow-500/20 blur-xl rounded-full" />
              <img src={lionLogo} alt="Logo" className="w-full h-full object-contain relative z-10 drop-shadow-[0_0_10px_rgba(201,168,76,0.4)]" />
            </div>
            <span className="font-display font-bold text-lg tracking-[0.2em] gold-text">HIGH ROLLERS</span>
          </div>
          <div className="flex items-center gap-6">
            <span className="text-xs text-gray-500 uppercase tracking-wider font-semibold hidden md:block">Clubs</span>
            <span className="text-xs text-gray-500 uppercase tracking-wider font-semibold hidden md:block">Leagues</span>
            <span className="text-xs text-gray-500 uppercase tracking-wider font-semibold hidden md:block">Provably Fair</span>
            <Link href="/game">
              <button className="glass rounded-lg px-4 py-2 text-xs font-bold uppercase tracking-wider text-cyan-400 neon-border-cyan hover:bg-cyan-500/10 transition-all">
                Launch App
              </button>
            </Link>
          </div>
        </motion.nav>

        {/* Hero Section */}
        <div className="flex-1 flex items-center px-8 lg:px-16">
          <div className="w-full max-w-7xl mx-auto">

            {/* Decorative diagonal line */}
            <div className="absolute left-[43%] top-0 bottom-0 w-px bg-gradient-to-b from-transparent via-cyan-500/20 to-transparent -skew-x-12 hidden lg:block" />

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">

              {/* Left column - Hero text */}
              <div className="lg:col-span-5 space-y-8">
                <motion.div
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.7, delay: 0.2 }}
                >
                  {/* Badge */}
                  <div className="inline-flex items-center gap-2 glass rounded-full px-4 py-1.5 mb-6">
                    <div className="w-1.5 h-1.5 rounded-full bg-green-500 shadow-[0_0_4px_rgba(0,255,157,0.5)]" />
                    <span className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Live & Provably Fair</span>
                  </div>

                  <h1 className="text-5xl lg:text-7xl font-black tracking-tight leading-[0.9] mb-4">
                    <span className="block text-white">Build Your</span>
                    <span className="block gold-text">Poker</span>
                    <span className="block text-white">Empire</span>
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
                  <Link href="/game">
                    <button className="group relative overflow-hidden rounded-xl px-8 py-3.5 font-bold text-base uppercase tracking-wider text-black transition-all hover:scale-[1.03] active:scale-[0.98]"
                      style={{
                        background: "linear-gradient(135deg, #00ff9d, #00d4aa, #00f0ff)",
                        boxShadow: "0 0 30px rgba(0,255,157,0.3), 0 0 60px rgba(0,255,157,0.1)",
                      }}
                    >
                      <div className="absolute inset-0 bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity" />
                      <div className="relative flex items-center gap-2">
                        Play Now
                        <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                      </div>
                    </button>
                  </Link>
                  <button className="glass rounded-xl px-6 py-3.5 text-sm font-semibold text-gray-400 hover:text-white hover:bg-white/5 transition-all">
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
                      <div key={i} className="w-9 h-9 rounded-full overflow-hidden border-2 border-[#0a0f18] shadow-lg">
                        <img src={av} alt="" className="w-full h-full object-cover" />
                      </div>
                    ))}
                    <div className="w-9 h-9 rounded-full bg-[#0a1520] border-2 border-[#0a0f18] flex items-center justify-center text-[10px] font-bold text-cyan-400">
                      +2k
                    </div>
                  </div>
                  <span className="text-xs text-gray-500">Playing right now</span>
                </motion.div>
              </div>

              {/* Right column - Feature cards */}
              <div className="lg:col-span-7 relative h-[520px] flex items-center justify-center">

                {/* Card 1: Alliance UI */}
                <motion.div
                  initial={{ opacity: 0, x: -40, y: 30 }}
                  animate={{ opacity: 1, x: 0, y: 0 }}
                  transition={{ duration: 0.8, delay: 0.4 }}
                  className="absolute left-0 lg:left-5 top-10 w-[300px] glass rounded-xl overflow-hidden transform -rotate-2 hover:scale-105 hover:z-30 transition-all duration-300 z-10"
                  style={{ border: "1px solid rgba(0,240,255,0.12)" }}
                >
                  <div className="flex items-center justify-between p-3" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
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
                      <div className="px-2 py-0.5 rounded text-[9px] font-bold neon-text-cyan" style={{ background: "rgba(0,240,255,0.1)", border: "1px solid rgba(0,240,255,0.2)" }}>
                        ACTIVE
                      </div>
                    </div>
                  </div>
                </motion.div>

                {/* Card 2: Entropy HUD */}
                <motion.div
                  initial={{ opacity: 0, x: 40, y: -20 }}
                  animate={{ opacity: 1, x: 0, y: 0 }}
                  transition={{ duration: 0.8, delay: 0.6 }}
                  className="absolute right-0 lg:right-5 top-16 w-[320px] glass rounded-xl overflow-hidden transform rotate-1 hover:scale-105 transition-all duration-300 z-20 shadow-2xl"
                  style={{ border: "1px solid rgba(0,255,157,0.12)" }}
                >
                  <div className="flex items-center justify-between p-3" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                    <div className="flex items-center gap-2 text-green-400 text-[10px] font-mono uppercase tracking-wider">
                      <Lock className="w-3 h-3" />
                      <span>HIKETI-SOLRBS ENTROPY</span>
                    </div>
                    <Lock className="w-3 h-3 text-green-400/50" />
                  </div>
                  <div className="aspect-[16/9] relative bg-black/60">
                    {/* Scanlines */}
                    <div className="absolute inset-0 z-10 pointer-events-none"
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

                {/* Central feature badge */}
                <motion.div
                  initial={{ opacity: 0, scale: 0.7 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.6, delay: 0.9, type: "spring" }}
                  className="absolute bottom-5 left-1/2 lg:left-[38%] -translate-x-1/2 z-30 glass rounded-xl p-4 flex items-center gap-4"
                  style={{
                    border: "1px solid rgba(0,255,157,0.2)",
                    boxShadow: "0 0 40px rgba(0,255,157,0.08)",
                  }}
                >
                  <div className="relative shrink-0">
                    <div className="absolute inset-0 bg-green-500 blur-lg opacity-30" style={{ animation: "neonPulse 3s ease-in-out infinite" }} />
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

        {/* Footer */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 1 }}
          className="px-8 lg:px-16 py-6"
          style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}
        >
          <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
            {/* Platform icons */}
            <div className="flex items-center gap-5 opacity-50">
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

            {/* AI badge */}
            <div className="flex items-center gap-2.5 opacity-60">
              <div className="text-right">
                <div className="text-[8px] text-gray-600 uppercase tracking-widest">Powered By</div>
                <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Adaptive AI</div>
              </div>
              <div className="w-8 h-8 glass rounded-lg flex items-center justify-center">
                <Cpu className="w-4 h-4 text-gray-500" />
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
