import { useState, useEffect } from "react";
import { Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
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
    accent: "#d4af37",
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

const SPLASH_IMAGES = [
  casinoBg,
  "/attached_assets/generated_images/splash/splash_poker_cinematic.webp",
  "/attached_assets/generated_images/splash/splash_tournament.webp",
  "/attached_assets/generated_images/splash/splash_high_stakes.webp",
];

export default function Landing() {
  const [onlineCount, setOnlineCount] = useState(0);
  const [splashIdx, setSplashIdx] = useState(0);

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

  useEffect(() => {
    const timer = setInterval(() => setSplashIdx(prev => (prev + 1) % SPLASH_IMAGES.length), 6000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="min-h-screen bg-background text-white font-sans relative overflow-hidden" data-testid="landing-page">

      <div className="absolute inset-0 z-0">
        {/* Static cyberpunk casino background */}
        <img
          src={casinoBg}
          alt=""
          className="absolute inset-0 w-full h-full object-cover opacity-30"
        />
        {/* Cycling splash overlay */}
        <AnimatePresence mode="wait">
          <motion.img
            key={splashIdx}
            src={SPLASH_IMAGES[splashIdx]}
            alt=""
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.15 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.2 }}
            className="absolute inset-0 w-full h-full object-cover"
          />
        </AnimatePresence>
        <div className="absolute inset-0 bg-gradient-to-b from-background/50 via-background/75 to-background" />
      </div>

      <div className="absolute inset-0 z-[1] pointer-events-none overflow-hidden">
        <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full bg-primary/[0.06] blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-5%] w-[500px] h-[500px] rounded-full bg-amber-500/[0.04] blur-[120px]" />
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
              <span className="font-display font-extrabold text-base tracking-[0.2em] leading-none gold-text">
                HIGH ROLLERS
              </span>
              <span className="text-[0.6rem] text-gray-500 tracking-[0.25em] font-mono mt-0.5">CLUB</span>
            </div>
          </div>

          <div className="flex items-center gap-6">
            <Link href="/lobby">
              <span className="text-xs text-gray-400 uppercase tracking-wider font-semibold hidden md:block cursor-pointer hover:text-primary transition-colors" data-testid="link-lobby">
                Lobby
              </span>
            </Link>
            <Link href="/lobby">
              <button
                className="rounded-lg px-6 py-2.5 text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-2 bg-primary/10 border border-primary/30 text-primary"
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
                  <div className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 mb-6 bg-green-500/[0.08] border border-green-500/15">
                    <div className="w-2 h-2 rounded-full bg-green-400 shadow-[0_0_8px_rgba(0,255,157,0.6)] animate-pulse" />
                    <span className="text-[0.7rem] text-green-400 uppercase tracking-wider font-semibold">
                      {onlineCount > 0 ? `${onlineCount} Players Online` : "Live Now"}
                    </span>
                  </div>

                  <h1 className="text-5xl md:text-6xl lg:text-7xl font-display font-black leading-[0.95] tracking-tight">
                    <span className="block text-white">The Future</span>
                    <span className="block text-white">of Online</span>
                    <span className="block text-transparent bg-clip-text gradient-primary neon-text-glow">
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
                    <motion.button
                      animate={{ boxShadow: ["0 0 20px rgba(212,175,55,0.2)", "0 0 40px rgba(212,175,55,0.4)", "0 0 20px rgba(212,175,55,0.2)"] }}
                      transition={{ duration: 2, repeat: Infinity }}
                      className="group relative overflow-hidden rounded-xl px-8 py-4 font-bold text-base uppercase tracking-wider gradient-primary text-black transition-all hover:scale-[1.03] active:scale-[0.98]"
                      data-testid="button-play-now"
                    >
                      <div className="absolute inset-0 bg-white/0 group-hover:bg-white/15 transition-all duration-300" />
                      <div className="relative flex items-center gap-2">
                        <Gamepad2 className="w-5 h-5" />
                        Play Now
                        <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                      </div>
                    </motion.button>
                  </Link>

                  <Link href="/game">
                    <button
                      className="glass rounded-xl px-6 py-3.5 text-sm font-semibold text-gray-400 hover:text-white hover:bg-white/5 transition-all border border-white/5"
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
                  className="relative rounded-2xl overflow-hidden border border-primary/15"
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
                      <div className="flex items-center gap-2 rounded-lg px-3 py-1.5 bg-black/60 border border-primary/20">
                        <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                        <span className="text-[0.7rem] text-primary font-mono font-bold uppercase tracking-wider">Live</span>
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
                  className="absolute -bottom-4 -right-4 rounded-xl px-5 py-3 flex items-center gap-3 z-20 bg-background/90 border border-green-500/20 backdrop-blur-xl"
                >
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-green-500/10 border border-green-500/20">
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
              <h2 className="text-2xl md:text-3xl font-display font-black text-white mb-3">Why High Rollers Club?</h2>
              <p className="text-sm text-gray-500 max-w-md mx-auto">Not just another poker app. Built for serious players who demand transparency and community.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {FEATURES.map((f, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.8 + i * 0.08 }}
                  className="group rounded-xl p-6 transition-all duration-300 hover:translate-y-[-2px] bg-white/[0.03] border border-white/[0.06] hover:border-white/10"
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
              className="rounded-xl p-6 flex flex-col md:flex-row items-center justify-between gap-6 bg-primary/[0.06] border border-primary/10"
            >
              <div>
                <h3 className="text-xl font-bold text-white mb-1">Ready to play?</h3>
                <p className="text-sm text-gray-400">Join the table in seconds. No download required.</p>
              </div>
              <Link href="/lobby">
                <button
                  className="rounded-xl px-8 py-3.5 font-bold text-sm uppercase tracking-wider gradient-primary text-black shrink-0"
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

        <footer className="border-t border-white/[0.06] bg-surface-lowest/80 py-8 px-4 md:px-8">
          <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              <span className="font-display font-bold gold-text tracking-wider">HIGH ROLLERS</span>
              <span>&copy; 2026</span>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                {[
                  { letter: "T", label: "Twitter" },
                  { letter: "D", label: "Discord" },
                  { letter: "X", label: "X" },
                ].map((social) => (
                  <a
                    key={social.letter}
                    href="#"
                    aria-label={social.label}
                    className="w-8 h-8 rounded-full bg-white/5 border border-white/[0.08] flex items-center justify-center text-[0.625rem] text-gray-500 hover:text-primary hover:border-primary/30 transition-all"
                  >
                    {social.letter}
                  </a>
                ))}
              </div>
              <div className="flex items-center gap-6">
                <a href="#" className="hover:text-primary transition-colors">Terms</a>
                <a href="#" className="hover:text-primary transition-colors">Privacy</a>
                <a href="#" className="hover:text-primary transition-colors">Support</a>
              </div>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
