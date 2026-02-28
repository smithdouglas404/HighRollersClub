import { useState, useEffect } from "react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { Shield, Users, Trophy, Zap, Play, ChevronRight, Eye, Gamepad2, Crown, Swords } from "lucide-react";

import lionLogo from "@assets/generated_images/lion_crest_gold_emblem.webp";
import casinoBg from "@assets/generated_images/cyberpunk_casino_bg_wide.webp";
import feltImg from "@assets/generated_images/poker_table_top_cinematic.webp";
import chipStack from "@assets/generated_images/gold_chip_stack_3d.webp";

const FEATURES = [
  {
    icon: Shield,
    title: "Provably Fair",
    desc: "Every shuffle uses SHA-256 cryptographic verification with multi-party entropy. You can audit any hand.",
    accent: "#00d4ff",
  },
  {
    icon: Users,
    title: "Private Clubs",
    desc: "Create your own poker club, invite friends, run tournaments, and compete on club leaderboards.",
    accent: "#00ff9d",
  },
  {
    icon: Trophy,
    title: "Tournaments & Leagues",
    desc: "Sit & Go, custom blind structures, inter-club leagues with seasonal rankings and real competition.",
    accent: "#ffd700",
  },
  {
    icon: Zap,
    title: "Real-Time Multiplayer",
    desc: "WebSocket-powered gameplay with sub-second response. Video chat at the table. No lag, no waiting.",
    accent: "#f472b6",
  },
  {
    icon: Eye,
    title: "Live Video Tables",
    desc: "See your opponents face-to-face with built-in WebRTC video chat. Read their reactions in real time.",
    accent: "#a78bfa",
  },
  {
    icon: Swords,
    title: "Club vs Club",
    desc: "Form alliances, challenge rival clubs, and climb the league standings together as a team.",
    accent: "#fb923c",
  },
];

export default function Landing() {
  const [onlineCount, setOnlineCount] = useState(0);

  useEffect(() => {
    async function fetchStats() {
      try {
        const res = await fetch("/api/online-users");
        if (res.ok) {
          const users = await res.json();
          setOnlineCount(Array.isArray(users) ? users.length : 0);
        }
      } catch {}
    }
    fetchStats();
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-[#0a0e1a] text-white font-sans relative overflow-hidden" data-testid="landing-page">

      <div className="absolute inset-0 z-0">
        <img src={casinoBg} alt="" className="w-full h-full object-cover opacity-20" />
        <div className="absolute inset-0 bg-gradient-to-b from-[#0a0e1a]/60 via-[#0a0e1a]/80 to-[#0a0e1a]" />
      </div>

      <div className="absolute inset-0 z-[1] pointer-events-none overflow-hidden">
        <div
          className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full"
          style={{ background: "radial-gradient(circle, rgba(0,212,255,0.06) 0%, transparent 70%)" }}
        />
        <div
          className="absolute bottom-[-10%] right-[-5%] w-[500px] h-[500px] rounded-full"
          style={{ background: "radial-gradient(circle, rgba(255,215,0,0.04) 0%, transparent 70%)" }}
        />
      </div>

      <div className="relative z-10 min-h-screen flex flex-col">

        <motion.nav
          initial={{ y: -30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.5 }}
          className="flex items-center justify-between px-6 md:px-12 py-5"
        >
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 relative">
              <div className="absolute inset-[-8px] bg-amber-500/15 blur-2xl rounded-full" />
              <img
                src={lionLogo}
                alt="High Rollers Club"
                className="w-full h-full object-contain relative z-10 drop-shadow-[0_0_16px_rgba(255,215,0,0.4)]"
                data-testid="img-logo"
              />
            </div>
            <div className="flex flex-col">
              <span className="font-display font-extrabold text-base tracking-[0.2em] leading-none" style={{ color: "#d4a843" }}>
                HIGH ROLLERS
              </span>
              <span className="text-[0.6rem] text-gray-500 tracking-[0.25em] font-mono mt-0.5">CLUB</span>
            </div>
          </div>

          <div className="flex items-center gap-6">
            <Link href="/lobby">
              <span className="text-xs text-gray-400 uppercase tracking-wider font-semibold hidden md:block cursor-pointer hover:text-cyan-400 transition-colors" data-testid="link-lobby">
                Lobby
              </span>
            </Link>
            <Link href="/lobby">
              <button
                className="rounded-lg px-6 py-2.5 text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-2"
                style={{
                  background: "linear-gradient(135deg, rgba(0,212,255,0.15), rgba(0,212,255,0.05))",
                  border: "1px solid rgba(0,212,255,0.3)",
                  color: "#00d4ff",
                  boxShadow: "0 0 20px rgba(0,212,255,0.1)",
                }}
                data-testid="button-launch"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                Play Now
              </button>
            </Link>
          </div>
        </motion.nav>

        <div className="flex-1 flex items-center px-6 md:px-12 lg:px-20 py-8 md:py-16">
          <div className="w-full max-w-7xl mx-auto">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">

              <div className="space-y-8">
                <motion.div
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.7, delay: 0.15 }}
                >
                  <div className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 mb-6" style={{ background: "rgba(0,255,157,0.08)", border: "1px solid rgba(0,255,157,0.15)" }}>
                    <div className="w-2 h-2 rounded-full bg-green-400 shadow-[0_0_8px_rgba(0,255,157,0.6)]" style={{ animation: "pulse 2s ease-in-out infinite" }} />
                    <span className="text-[0.7rem] text-green-400 uppercase tracking-wider font-semibold">
                      {onlineCount > 0 ? `${onlineCount} Players Online` : "Live Now"}
                    </span>
                  </div>

                  <h1 className="text-5xl md:text-6xl lg:text-7xl font-black leading-[0.95] tracking-tight">
                    <span className="block text-white">The Future</span>
                    <span className="block text-white">of Online</span>
                    <span
                      className="block"
                      style={{
                        background: "linear-gradient(135deg, #00d4ff, #00ff9d)",
                        WebkitBackgroundClip: "text",
                        WebkitTextFillColor: "transparent",
                        filter: "drop-shadow(0 0 30px rgba(0,212,255,0.3))",
                      }}
                    >
                      Poker
                    </span>
                  </h1>
                </motion.div>

                <motion.p
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.35 }}
                  className="text-lg text-gray-400 leading-relaxed max-w-lg"
                >
                  Provably fair shuffles. Real-time multiplayer. Private clubs with video tables.
                  Every hand is cryptographically verified — no trust required.
                </motion.p>

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.5 }}
                  className="flex flex-wrap items-center gap-4 pt-2"
                >
                  <Link href="/lobby">
                    <button
                      className="group relative overflow-hidden rounded-xl px-10 py-4 font-bold text-base uppercase tracking-wider text-black transition-all hover:scale-[1.03] active:scale-[0.98]"
                      style={{
                        background: "linear-gradient(135deg, #00d4ff, #00b4d8)",
                        boxShadow: "0 0 40px rgba(0,212,255,0.25), 0 4px 20px rgba(0,0,0,0.3)",
                      }}
                      data-testid="button-play-now"
                    >
                      <div className="absolute inset-0 bg-white/0 group-hover:bg-white/15 transition-all duration-300" />
                      <div className="relative flex items-center gap-2.5">
                        <Gamepad2 className="w-5 h-5" />
                        Play Now
                        <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                      </div>
                    </button>
                  </Link>

                  <Link href="/game">
                    <button
                      className="rounded-xl px-7 py-4 text-sm font-semibold text-gray-300 hover:text-white transition-all"
                      style={{
                        background: "rgba(255,255,255,0.04)",
                        border: "1px solid rgba(255,255,255,0.08)",
                      }}
                      data-testid="button-play-offline"
                    >
                      <div className="flex items-center gap-2">
                        <Crown className="w-4 h-4 text-amber-500/70" />
                        Practice Mode
                      </div>
                    </button>
                  </Link>
                </motion.div>
              </div>

              <motion.div
                initial={{ opacity: 0, scale: 0.92 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.8, delay: 0.3 }}
                className="relative hidden lg:block"
              >
                <div
                  className="relative rounded-2xl overflow-hidden"
                  style={{
                    border: "1px solid rgba(0,212,255,0.12)",
                    boxShadow: "0 30px 80px rgba(0,0,0,0.5), 0 0 40px rgba(0,212,255,0.06)",
                  }}
                >
                  <div className="aspect-[16/10] relative">
                    <img src={feltImg} alt="Poker Table" loading="lazy" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-black/40" />

                    <img
                      src={chipStack}
                      alt=""
                      loading="lazy"
                      className="absolute bottom-8 right-8 w-24 h-24 object-contain drop-shadow-[0_8px_24px_rgba(0,0,0,0.5)]"
                    />

                    <div className="absolute top-5 left-5">
                      <div className="flex items-center gap-2 rounded-lg px-3 py-1.5" style={{ background: "rgba(0,0,0,0.6)", border: "1px solid rgba(0,212,255,0.2)" }}>
                        <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                        <span className="text-[0.7rem] text-cyan-400 font-mono font-bold uppercase tracking-wider">Live</span>
                      </div>
                    </div>

                    <div className="absolute bottom-6 left-6">
                      <div className="text-xs text-gray-400 uppercase tracking-wider font-semibold mb-1">No-Limit Hold'em</div>
                      <div className="text-2xl font-black text-white">
                        50/100 Blinds
                      </div>
                    </div>
                  </div>
                </div>

                <div
                  className="absolute -bottom-4 -right-4 rounded-xl px-5 py-3 flex items-center gap-3 z-20"
                  style={{
                    background: "rgba(10,14,26,0.9)",
                    border: "1px solid rgba(0,255,157,0.2)",
                    boxShadow: "0 8px 30px rgba(0,0,0,0.4), 0 0 20px rgba(0,255,157,0.05)",
                    backdropFilter: "blur(12px)",
                  }}
                >
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: "rgba(0,255,157,0.1)", border: "1px solid rgba(0,255,157,0.2)" }}>
                    <Shield className="w-5 h-5 text-green-400" />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-white">Provably Fair</div>
                    <div className="text-[0.65rem] text-gray-500 font-mono">SHA-256 Verified</div>
                  </div>
                </div>
              </motion.div>
            </div>
          </div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7, duration: 0.7 }}
          className="px-6 md:px-12 lg:px-20 pb-16"
        >
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-10">
              <h2 className="text-2xl md:text-3xl font-black text-white mb-3">Why High Rollers Club?</h2>
              <p className="text-sm text-gray-500 max-w-md mx-auto">Not just another poker app. Built for serious players who demand transparency and community.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {FEATURES.map((f, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.8 + i * 0.08 }}
                  className="group rounded-xl p-6 transition-all duration-300 hover:translate-y-[-2px]"
                  style={{
                    background: "rgba(255,255,255,0.02)",
                    border: "1px solid rgba(255,255,255,0.05)",
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.borderColor = `${f.accent}30`;
                    (e.currentTarget as HTMLElement).style.boxShadow = `0 8px 30px ${f.accent}08`;
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.05)";
                    (e.currentTarget as HTMLElement).style.boxShadow = "none";
                  }}
                >
                  <div
                    className="w-11 h-11 rounded-lg flex items-center justify-center mb-4"
                    style={{ background: `${f.accent}10`, border: `1px solid ${f.accent}20` }}
                  >
                    <f.icon className="w-5 h-5" style={{ color: f.accent }} />
                  </div>
                  <h3 className="text-base font-bold text-white mb-2">{f.title}</h3>
                  <p className="text-sm text-gray-400 leading-relaxed">{f.desc}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </motion.div>

        <div className="px-6 md:px-12 lg:px-20 pb-8">
          <div className="max-w-7xl mx-auto">
            <div
              className="rounded-xl p-6 flex flex-col md:flex-row items-center justify-between gap-6"
              style={{
                background: "linear-gradient(135deg, rgba(0,212,255,0.06), rgba(0,255,157,0.03))",
                border: "1px solid rgba(0,212,255,0.1)",
              }}
            >
              <div>
                <h3 className="text-xl font-bold text-white mb-1">Ready to play?</h3>
                <p className="text-sm text-gray-400">Join the table in seconds. No download required.</p>
              </div>
              <Link href="/lobby">
                <button
                  className="rounded-xl px-8 py-3.5 font-bold text-sm uppercase tracking-wider text-black shrink-0"
                  style={{
                    background: "linear-gradient(135deg, #00d4ff, #00b4d8)",
                    boxShadow: "0 0 25px rgba(0,212,255,0.2)",
                  }}
                  data-testid="button-cta-bottom"
                >
                  <div className="flex items-center gap-2">
                    <Play className="w-4 h-4 fill-current" />
                    Enter the Lobby
                  </div>
                </button>
              </Link>
            </div>
          </div>
        </div>

        <div className="px-6 md:px-12 lg:px-20 py-6 border-t border-white/[0.04]">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-2 opacity-50">
              <img src={lionLogo} alt="" className="w-5 h-5 object-contain" />
              <span className="text-[0.65rem] text-gray-500 font-semibold tracking-wider">HIGH ROLLERS CLUB</span>
            </div>
            <div className="text-[0.6rem] text-gray-600 font-mono">
              Provably Fair Texas Hold'em
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
