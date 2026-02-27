import { motion, AnimatePresence } from "framer-motion";
import { Trophy, Sparkles, Crown } from "lucide-react";
import { PlayerResult } from "@/lib/hand-evaluator";
import { Player } from "@/lib/poker-types";
import { Card } from "./Card";
import { useEffect, useRef } from "react";
import { useSoundEngine } from "@/lib/sound-context";

interface ShowdownOverlayProps {
  visible: boolean;
  results: PlayerResult[];
  players: Player[];
  pot: number;
}

// Enhanced confetti with multiple burst waves and shimmer particles
function Confetti({ active }: { active: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!active) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    interface Particle {
      x: number; y: number; vx: number; vy: number;
      size: number; color: string; rotation: number; rotSpeed: number;
      life: number; maxLife: number; type: "confetti" | "spark" | "ring";
    }

    const particles: Particle[] = [];
    const colors = ["#ffd700", "#f5e6a3", "#e8c566", "#ffffff", "#d4a843", "#fff8dc", "#25a065", "#1b7a4a"];

    // Wave 1: Big burst from center
    for (let i = 0; i < 150; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 10 + 4;
      particles.push({
        x: canvas.width / 2,
        y: canvas.height / 2 - 50,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 5,
        size: Math.random() * 7 + 2,
        color: colors[Math.floor(Math.random() * colors.length)],
        rotation: Math.random() * 360,
        rotSpeed: (Math.random() - 0.5) * 12,
        life: 0,
        maxLife: Math.random() * 100 + 50,
        type: "confetti",
      });
    }

    // Wave 2: Sparkle shimmer (delayed)
    for (let i = 0; i < 60; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 3 + 1;
      particles.push({
        x: canvas.width / 2 + (Math.random() - 0.5) * 300,
        y: canvas.height / 2 - 80 + (Math.random() - 0.5) * 100,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 2,
        size: Math.random() * 3 + 1,
        color: colors[Math.floor(Math.random() * 3)], // Gold palette
        rotation: 0,
        rotSpeed: 0,
        life: -20 - Math.random() * 30, // Delayed start
        maxLife: Math.random() * 60 + 40,
        type: "spark",
      });
    }

    // Wave 3: Expanding rings
    for (let i = 0; i < 3; i++) {
      particles.push({
        x: canvas.width / 2,
        y: canvas.height / 2 - 40,
        vx: 0, vy: 0,
        size: 0,
        color: "#ffd700",
        rotation: 0, rotSpeed: 0,
        life: -i * 15,
        maxLife: 60,
        type: "ring",
      });
    }

    let frame: number;
    function animate() {
      ctx!.clearRect(0, 0, canvas!.width, canvas!.height);

      let alive = false;
      for (const p of particles) {
        p.life++;
        if (p.life < 0) { alive = true; continue; }
        if (p.life >= p.maxLife) continue;
        alive = true;
        const alpha = 1 - p.life / p.maxLife;

        if (p.type === "ring") {
          p.size += 4;
          ctx!.strokeStyle = p.color;
          ctx!.globalAlpha = alpha * 0.3;
          ctx!.lineWidth = 2;
          ctx!.beginPath();
          ctx!.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx!.stroke();
        } else if (p.type === "spark") {
          ctx!.globalAlpha = alpha * (0.5 + 0.5 * Math.sin(p.life * 0.3));
          ctx!.fillStyle = p.color;
          ctx!.beginPath();
          // Star shape
          const spikes = 4;
          for (let s = 0; s < spikes * 2; s++) {
            const r = s % 2 === 0 ? p.size * 2 : p.size * 0.5;
            const a = (s * Math.PI) / spikes;
            const sx = p.x + Math.cos(a) * r;
            const sy = p.y + Math.sin(a) * r;
            s === 0 ? ctx!.moveTo(sx, sy) : ctx!.lineTo(sx, sy);
          }
          ctx!.closePath();
          ctx!.fill();
          p.x += p.vx;
          p.y += p.vy;
          p.vy += 0.02;
        } else {
          // Confetti
          p.x += p.vx;
          p.y += p.vy;
          p.vy += 0.18;
          p.vx *= 0.99;
          p.rotation += p.rotSpeed;
          ctx!.save();
          ctx!.translate(p.x, p.y);
          ctx!.rotate((p.rotation * Math.PI) / 180);
          ctx!.fillStyle = p.color;
          ctx!.globalAlpha = alpha;
          ctx!.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
          ctx!.restore();
        }
      }
      ctx!.globalAlpha = 1;

      if (alive) {
        frame = requestAnimationFrame(animate);
      }
    }
    animate();
    return () => cancelAnimationFrame(frame);
  }, [active]);

  if (!active) return null;
  return <canvas ref={canvasRef} className="absolute inset-0 z-50 pointer-events-none" />;
}

export function ShowdownOverlay({ visible, results, players, pot }: ShowdownOverlayProps) {
  const winners = results.filter(r => r.isWinner);
  const winnerIds = winners.map(w => w.playerId);
  const sound = useSoundEngine();
  const soundPlayedRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Play showdown sequence: phase reveal → fanfare → chip slide (pot awarded) → win celebration
  useEffect(() => {
    if (visible && !soundPlayedRef.current) {
      soundPlayedRef.current = true;
      sound.playPhaseReveal();
      timerRef.current = setTimeout(() => {
        sound.playShowdownFanfare();
        timerRef.current = setTimeout(() => {
          sound.playChipSlide(); // Pot pushed to winner
          timerRef.current = setTimeout(() => {
            sound.playWinCelebration();
          }, 400);
        }, 600);
      }, 300);
    }
    if (!visible) {
      soundPlayedRef.current = false;
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [visible, sound]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5 }}
          className="fixed inset-0 z-[100] flex items-center justify-center"
        >
          {/* Backdrop with dramatic vignette */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6 }}
            className="absolute inset-0 backdrop-blur-sm"
            style={{
              background: "radial-gradient(ellipse at center, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0.85) 70%, rgba(0,0,0,0.95) 100%)",
            }}
          />

          {/* Spotlight beam effect */}
          <motion.div
            initial={{ opacity: 0, scale: 0.3 }}
            animate={{ opacity: 0.15, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="absolute pointer-events-none"
            style={{
              width: "600px",
              height: "600px",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              background: "radial-gradient(circle, rgba(255,215,0,0.3) 0%, rgba(255,215,0,0.05) 40%, transparent 70%)",
            }}
          />

          {/* Confetti */}
          <Confetti active={visible} />

          {/* Content */}
          <motion.div
            initial={{ scale: 0.7, y: 40 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.7, y: 40 }}
            transition={{ type: "spring", stiffness: 180, damping: 18 }}
            className="relative z-50 w-full max-w-2xl px-6"
          >
            {/* Winner announcement */}
            <motion.div
              initial={{ y: -30, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.2, type: "spring", stiffness: 200, damping: 20 }}
              className="text-center mb-6"
            >
              {/* Crown icon for dramatic effect */}
              <motion.div
                initial={{ scale: 0, rotate: -20 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ delay: 0.4, type: "spring", stiffness: 300, damping: 15 }}
                className="flex justify-center mb-2"
              >
                <Crown className="w-10 h-10 text-yellow-400 drop-shadow-[0_0_20px_rgba(255,215,0,0.6)]" />
              </motion.div>

              <div className="inline-flex items-center gap-2 mb-3">
                <Sparkles className="w-5 h-5 text-yellow-400" />
                <motion.span
                  initial={{ letterSpacing: "0.1em" }}
                  animate={{ letterSpacing: "0.5em" }}
                  transition={{ delay: 0.3, duration: 0.8 }}
                  className="font-display text-xs text-yellow-500/70 uppercase"
                >
                  Showdown
                </motion.span>
                <Sparkles className="w-5 h-5 text-yellow-400" />
              </div>

              {/* Winner name(s) with dramatic scale-in */}
              <motion.div
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.35, type: "spring", stiffness: 200, damping: 15 }}
                className="flex items-center justify-center gap-3 mb-3"
              >
                <Trophy className="w-9 h-9 text-yellow-400 drop-shadow-[0_0_15px_rgba(255,215,0,0.6)]" />
                <h2
                  className="text-4xl font-black tracking-tight"
                  style={{
                    background: "linear-gradient(135deg, #ffd700, #f5e6a3, #d4a843)",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                    filter: "drop-shadow(0 0 20px rgba(255,215,0,0.4))",
                  }}
                >
                  {winners.map(w => players.find(p => p.id === w.playerId)?.name).join(" & ")}
                </h2>
                <Trophy className="w-9 h-9 text-yellow-400 drop-shadow-[0_0_15px_rgba(255,215,0,0.6)]" />
              </motion.div>

              {/* Winning hand with glow */}
              <motion.div
                initial={{ scale: 0, rotateX: 90 }}
                animate={{ scale: 1, rotateX: 0 }}
                transition={{ delay: 0.5, type: "spring", stiffness: 250, damping: 18 }}
                className="inline-block glass rounded-xl px-6 py-2.5 neon-border-gold"
                style={{
                  boxShadow: "0 0 30px rgba(255,215,0,0.2), 0 0 60px rgba(255,215,0,0.08)",
                }}
              >
                <span className="text-xl font-bold neon-text-gold">{winners[0]?.hand.description}</span>
              </motion.div>

              {/* Pot won with counter animation effect */}
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.7, type: "spring" }}
                className="mt-3"
              >
                <span className="text-gray-500 text-sm">Wins </span>
                <motion.span
                  initial={{ scale: 1.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.8, type: "spring", stiffness: 300 }}
                  className="font-bold font-mono text-xl"
                  style={{ color: "#ffd700", textShadow: "0 0 20px rgba(255,215,0,0.4)" }}
                >
                  ${pot.toLocaleString()}
                </motion.span>
              </motion.div>
            </motion.div>

            {/* All player hands — staggered card reveal */}
            <motion.div
              initial={{ y: 30, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.6 }}
              className="grid grid-cols-3 gap-3"
            >
              {results.map((result, i) => {
                const player = players.find(p => p.id === result.playerId);
                if (!player || !player.cards) return null;
                const isWinner = winnerIds.includes(result.playerId);

                return (
                  <motion.div
                    key={result.playerId}
                    initial={{ opacity: 0, y: 20, scale: 0.9 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ delay: 0.7 + i * 0.12, type: "spring", stiffness: 200, damping: 20 }}
                    className={`glass rounded-xl p-3 transition-all ${
                      isWinner ? "neon-border-gold" : "opacity-50"
                    }`}
                    style={isWinner ? {
                      boxShadow: "0 0 25px rgba(255,215,0,0.2), 0 0 50px rgba(255,215,0,0.06)",
                      background: "rgba(255,215,0,0.03)",
                    } : undefined}
                  >
                    {/* Player info row */}
                    <div className="flex items-center gap-2 mb-2">
                      <div className={`w-8 h-8 rounded-full overflow-hidden border ${isWinner ? "border-yellow-500/50" : "border-white/10"}`}>
                        {player.avatar ? (
                          <img src={player.avatar} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full bg-gray-700 flex items-center justify-center text-xs font-bold text-white/60">
                            {player.name.charAt(0)}
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[0.6875rem] font-bold text-white truncate">{player.name}</div>
                        <div className={`text-[0.5625rem] font-mono ${isWinner ? "neon-text-gold" : "text-gray-500"}`}>
                          {result.hand.description}
                        </div>
                      </div>
                      {isWinner && (
                        <motion.div
                          initial={{ rotate: -30, scale: 0 }}
                          animate={{ rotate: 0, scale: 1 }}
                          transition={{ delay: 0.9 + i * 0.1, type: "spring" }}
                        >
                          <Trophy className="w-5 h-5 text-yellow-400 shrink-0 drop-shadow-[0_0_8px_rgba(255,215,0,0.5)]" />
                        </motion.div>
                      )}
                    </div>

                    {/* Cards with staggered flip reveal */}
                    <div className="flex gap-1.5 justify-center">
                      <Card card={{ ...player.cards[0], hidden: false }} size="sm" delay={0.8 + i * 0.12} />
                      <Card card={{ ...player.cards[1], hidden: false }} size="sm" delay={0.95 + i * 0.12} />
                    </div>
                  </motion.div>
                );
              })}
            </motion.div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
