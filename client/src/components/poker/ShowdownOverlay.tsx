import { motion, AnimatePresence } from "framer-motion";
import { Trophy, Sparkles } from "lucide-react";
import { PlayerResult } from "@/lib/hand-evaluator";
import { Player } from "@/lib/poker-types";
import { Card } from "./Card";
import { useEffect, useRef } from "react";

interface ShowdownOverlayProps {
  visible: boolean;
  results: PlayerResult[];
  players: Player[];
  pot: number;
}

// Gold confetti particle system
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
      life: number; maxLife: number;
    }

    const particles: Particle[] = [];
    const colors = ["#ffd700", "#c9a84c", "#f5e6a3", "#00f0ff", "#00ff9d", "#ffffff", "#b44dff"];

    // Burst from center
    for (let i = 0; i < 120; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 8 + 3;
      particles.push({
        x: canvas.width / 2,
        y: canvas.height / 2 - 50,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 4,
        size: Math.random() * 6 + 2,
        color: colors[Math.floor(Math.random() * colors.length)],
        rotation: Math.random() * 360,
        rotSpeed: (Math.random() - 0.5) * 10,
        life: 0,
        maxLife: Math.random() * 80 + 40,
      });
    }

    let frame: number;
    function animate() {
      ctx!.clearRect(0, 0, canvas!.width, canvas!.height);

      let alive = false;
      for (const p of particles) {
        p.life++;
        if (p.life >= p.maxLife) continue;
        alive = true;

        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.15; // gravity
        p.vx *= 0.99;
        p.rotation += p.rotSpeed;

        const alpha = 1 - p.life / p.maxLife;
        ctx!.save();
        ctx!.translate(p.x, p.y);
        ctx!.rotate((p.rotation * Math.PI) / 180);
        ctx!.fillStyle = p.color;
        ctx!.globalAlpha = alpha;
        ctx!.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
        ctx!.restore();
      }

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

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4 }}
          className="fixed inset-0 z-[100] flex items-center justify-center"
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

          {/* Confetti */}
          <Confetti active={visible} />

          {/* Content */}
          <motion.div
            initial={{ scale: 0.8, y: 30 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.8, y: 30 }}
            transition={{ type: "spring", stiffness: 200, damping: 20 }}
            className="relative z-50 w-full max-w-2xl px-6"
          >
            {/* Winner announcement */}
            <motion.div
              initial={{ y: -20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="text-center mb-6"
            >
              <div className="inline-flex items-center gap-2 mb-3">
                <Sparkles className="w-5 h-5 text-yellow-400" />
                <span className="font-display text-xs tracking-[0.3em] text-yellow-500/70 uppercase">Showdown</span>
                <Sparkles className="w-5 h-5 text-yellow-400" />
              </div>

              {/* Winner name(s) */}
              <div className="flex items-center justify-center gap-3 mb-2">
                <Trophy className="w-8 h-8 text-yellow-400 drop-shadow-[0_0_10px_rgba(255,215,0,0.5)]" />
                <h2 className="text-3xl font-black gold-text tracking-tight">
                  {winners.map(w => players.find(p => p.id === w.playerId)?.name).join(" & ")}
                </h2>
                <Trophy className="w-8 h-8 text-yellow-400 drop-shadow-[0_0_10px_rgba(255,215,0,0.5)]" />
              </div>

              {/* Winning hand */}
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.5, type: "spring" }}
                className="inline-block glass rounded-xl px-6 py-2 neon-border-gold"
              >
                <span className="text-lg font-bold neon-text-gold">{winners[0]?.hand.description}</span>
              </motion.div>

              {/* Pot won */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.7 }}
                className="mt-3 text-sm text-gray-400"
              >
                Wins <span className="neon-text-green font-bold font-mono">${pot.toLocaleString()}</span>
              </motion.div>
            </motion.div>

            {/* All player hands */}
            <motion.div
              initial={{ y: 20, opacity: 0 }}
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
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.7 + i * 0.1 }}
                    className={`glass rounded-xl p-3 transition-all ${
                      isWinner ? "neon-border-gold" : "opacity-60"
                    }`}
                    style={isWinner ? { boxShadow: "0 0 20px rgba(255,215,0,0.15)" } : undefined}
                  >
                    {/* Player info row */}
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-8 h-8 rounded-full overflow-hidden border border-white/10">
                        {player.avatar && <img src={player.avatar} alt="" className="w-full h-full object-cover" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[11px] font-bold text-white truncate">{player.name}</div>
                        <div className={`text-[9px] font-mono ${isWinner ? "neon-text-gold" : "text-gray-500"}`}>
                          {result.hand.description}
                        </div>
                      </div>
                      {isWinner && <Trophy className="w-4 h-4 text-yellow-400 shrink-0" />}
                    </div>

                    {/* Cards */}
                    <div className="flex gap-1 justify-center">
                      <Card card={{ ...player.cards[0], hidden: false }} size="sm" delay={0.8 + i * 0.1} />
                      <Card card={{ ...player.cards[1], hidden: false }} size="sm" delay={0.9 + i * 0.1} />
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
