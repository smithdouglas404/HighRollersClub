import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { Player } from "@/lib/poker-types";
import { EmoteBubble } from "./EmoteSystem";
import { useSoundEngine } from "@/lib/sound-context";
import { useEffect, useRef, useState, useCallback } from "react";
import { triggerChipFlight } from "./ChipAnimation";


// ─── Winner Particle Burst System ────────────────────────────────────────────
interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  alpha: number;
  life: number;
  maxLife: number;
}

const WINNER_PARTICLE_COLORS = ["#ffd700", "#c9a84c", "#f5e6a3", "#00f0ff", "#00ff9d"];

function useWinnerParticles(isWinner: boolean) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const animFrameRef = useRef<number>(0);
  const prevWinner = useRef(false);

  useEffect(() => {
    // Only fire when isWinner transitions from false to true
    if (isWinner && !prevWinner.current) {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      // Spawn 40-60 particles from the center of the canvas
      const count = 40 + Math.floor(Math.random() * 21);
      const cx = canvas.width / 2;
      const cy = canvas.height / 2;
      const particles: Particle[] = [];

      for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 1.5 + Math.random() * 3;
        const life = 1.5 + Math.random() * 0.7; // 1.5-2.2 seconds
        particles.push({
          x: cx,
          y: cy,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 1.5, // slight upward bias
          size: 2 + Math.random() * 3,
          color: WINNER_PARTICLE_COLORS[Math.floor(Math.random() * WINNER_PARTICLE_COLORS.length)],
          alpha: 1,
          life,
          maxLife: life,
        });
      }
      particlesRef.current = particles;

      let lastTime = performance.now();

      const animate = (now: number) => {
        const dt = Math.min((now - lastTime) / 1000, 0.05); // delta in seconds, capped
        lastTime = now;

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const alive: Particle[] = [];
        for (const p of particlesRef.current) {
          p.life -= dt;
          if (p.life <= 0) continue;

          // Gravity
          p.vy += 2.5 * dt;
          p.x += p.vx * 60 * dt;
          p.y += p.vy * 60 * dt;

          // Fade out based on remaining life
          p.alpha = Math.max(0, p.life / p.maxLife);

          ctx.globalAlpha = p.alpha;
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();

          alive.push(p);
        }
        ctx.globalAlpha = 1;
        particlesRef.current = alive;

        if (alive.length > 0) {
          animFrameRef.current = requestAnimationFrame(animate);
        }
      };

      animFrameRef.current = requestAnimationFrame(animate);
    }

    prevWinner.current = isWinner;

    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [isWinner]);

  return canvasRef;
}

// Seat glow color palette — each position gets a unique neon ring
const SEAT_COLORS = [
  "#00f0ff", // cyan (hero)
  "#ff3366", // red
  "#b44dff", // purple
  "#ffd700", // gold
  "#00ff9d", // green
  "#ff69b4", // pink
  "#ff8c00", // orange
  "#67e8f9", // light blue
  "#facc15", // yellow
];

function getSeatColor(seatIndex: number, isHero: boolean): string {
  if (isHero) return "#00f0ff";
  return SEAT_COLORS[seatIndex % SEAT_COLORS.length];
}

// Action badge styling map
const ACTION_BADGE_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  folded:  { bg: "bg-red-500/20",    text: "text-red-400",    border: "border-red-500/40" },
  called:  { bg: "bg-green-500/20",  text: "text-green-400",  border: "border-green-500/40" },
  checked: { bg: "bg-gray-500/20",   text: "text-gray-300",   border: "border-gray-500/40" },
  raised:  { bg: "bg-cyan-500/20",   text: "text-cyan-400",   border: "border-cyan-500/40" },
  "all-in":{ bg: "bg-amber-500/20",  text: "text-amber-400",  border: "border-amber-500/40" },
};


interface SeatProps {
  player: Player;
  position: { x: number; y: number };
  isHero?: boolean;
  isWinner?: boolean;
  seatIndex?: number;
  /** Perspective scale: 1.0 = full size (near you), 0.5 = half size (far away) */
  perspectiveScale?: number;
  /** Hide face-down cards (used in 3D mode where cards are rendered in the 3D scene) */
  hideCards?: boolean;
}

export function Seat({ player, position, isHero = false, isWinner = false, seatIndex = 0, perspectiveScale = 1, hideCards = false }: SeatProps) {
  const winnerCanvasRef = useWinnerParticles(isWinner);

  const isTurn = player.status === "thinking";
  const isFolded = player.status === "folded";
  const sound = useSoundEngine();
  const prevBetRef = useRef(player.currentBet);
  const timerTickRef = useRef<ReturnType<typeof setInterval>>(undefined);
  const seatRef = useRef<HTMLDivElement>(null);

  // Each seat gets a unique neon glow color
  const glowColor = getSeatColor(seatIndex, isHero);

  const statusLabel: Record<string, string> = {
    folded: "FOLD",
    checked: "CHECK",
    called: "CALL",
    raised: "RAISE",
    "all-in": "ALL-IN",
  };

  // Format chip count as $X,XXX
  const formatChips = (amount: number) => `$${amount.toLocaleString()}`;

  // Play chip sound and trigger chip flight when bet increases
  useEffect(() => {
    if (player.currentBet > prevBetRef.current && player.currentBet > 0) {
      sound.playChipClink();
      if (seatRef.current) {
        const rect = seatRef.current.getBoundingClientRect();
        const fromX = rect.left + rect.width / 2;
        const fromY = rect.top + rect.height / 2;
        const toX = window.innerWidth / 2;
        const toY = window.innerHeight * 0.38;
        triggerChipFlight(fromX, fromY, toX, toY, player.currentBet - prevBetRef.current);
      }
    }
    prevBetRef.current = player.currentBet;
  }, [player.currentBet, sound]);

  // Timer tick sound when it's this player's turn (hero only)
  useEffect(() => {
    if (isTurn && isHero) {
      timerTickRef.current = setInterval(() => {
        const urgency = 1 - (player.timeLeft || 100) / 100;
        sound.playTimerTick(urgency);
      }, 2000);
    }
    return () => {
      if (timerTickRef.current) clearInterval(timerTickRef.current);
    };
  }, [isTurn, isHero, player.timeLeft, sound]);

  // Parallax depth effect for hero avatar only
  const [mouseOffset, setMouseOffset] = useState({ x: 0, y: 0 });
  const avatarRef = useRef<HTMLDivElement>(null);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!avatarRef.current) return;
    const rect = avatarRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const dx = (e.clientX - centerX) / window.innerWidth;
    const dy = (e.clientY - centerY) / window.innerHeight;
    setMouseOffset({
      x: Math.max(-3, Math.min(3, dx * 6)),
      y: Math.max(-3, Math.min(3, dy * 6)),
    });
  }, []);

  useEffect(() => {
    if (!isHero || isFolded) {
      setMouseOffset({ x: 0, y: 0 });
      return;
    }
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, [isHero, isFolded, handleMouseMove]);

  const parallaxStyle = isHero && !isFolded
    ? {
        transform: `perspective(200px) translate(${mouseOffset.x}px, ${mouseOffset.y}px) rotateY(${mouseOffset.x * 1.67}deg) rotateX(${-mouseOffset.y * 1.67}deg)`,
        transition: "transform 0.15s ease-out",
      }
    : undefined;

  // Compute bet chip offset — push the bet badge toward the table center
  const betOffsetX = (50 - position.x) * 0.4; // positive = toward center
  const betOffsetY = (50 - position.y) * 0.35;

  // Build hex-to-rgba helper for glowColor
  const hexToRgba = (hex: string, alpha: number) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r},${g},${b},${alpha})`;
  };

  return (
    <div
      ref={seatRef}
      className="absolute flex flex-col items-center pointer-events-none"
      style={{
        left: `${position.x}%`,
        top: `${position.y}%`,
        transform: `translate(-50%, -50%) scale(${perspectiveScale})`,
        transformOrigin: "center center",
        zIndex: isHero ? 40 : position.y < 50 ? 10 : 30,
      }}
    >
      <div
        className={cn(
          "relative flex flex-col items-center",
          isFolded && "opacity-50 grayscale"
        )}
      >
        {/* Emote bubble */}
        <EmoteBubble playerId={player.id} />

        {/* Winner particle burst canvas */}
        <canvas
          ref={winnerCanvasRef}
          width={200}
          height={200}
          className="absolute pointer-events-none"
          style={{
            left: "50%",
            top: "50%",
            transform: "translate(-50%, -50%)",
            width: 200,
            height: 200,
            zIndex: 50,
          }}
        />

        {/* ── Action status badge (positioned ABOVE avatar) ── */}
        <AnimatePresence>
          {statusLabel[player.status] && player.status !== "waiting" && player.status !== "thinking" && (
            <motion.div
              initial={{ opacity: 0, y: 6, scale: 0.8 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -4, scale: 0.8 }}
              className={cn(
                "mb-1 px-2.5 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider z-30 border backdrop-blur-sm",
                ACTION_BADGE_STYLES[player.status]?.bg || "bg-black/40",
                ACTION_BADGE_STYLES[player.status]?.text || "text-gray-300",
                ACTION_BADGE_STYLES[player.status]?.border || "border-white/10",
              )}
            >
              {statusLabel[player.status]}
              {/* Show bet amount next to CALL/RAISE */}
              {(player.status === "called" || player.status === "raised") && player.currentBet > 0 && (
                <span className="ml-1 font-mono">{formatChips(player.currentBet)}</span>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Avatar portrait with CSS neon ring (square, ~100px, matching reference) ── */}
        <div ref={avatarRef} className="relative z-10 mb-0.5">
          {/* CSS neon glow ring — always visible, intensified on turn */}
          <div
            className="absolute -inset-[6px] z-0 rounded-xl pointer-events-none"
            style={{
              border: `2px solid ${hexToRgba(glowColor, isTurn ? 0.8 : 0.3)}`,
              boxShadow: isTurn
                ? `0 0 12px ${hexToRgba(glowColor, 0.6)}, 0 0 24px ${hexToRgba(glowColor, 0.3)}, inset 0 0 8px ${hexToRgba(glowColor, 0.2)}`
                : `0 0 6px ${hexToRgba(glowColor, 0.2)}`,
              transition: "all 0.3s ease",
              animation: isTurn ? "avatarGlowPulse 1.5s ease-in-out infinite" : "none",
            }}
          />

          {/* Active turn: pulsing outer glow */}
          {isTurn && (
            <div
              className="absolute -inset-[12px] rounded-xl"
              style={{
                boxShadow: `0 0 20px 6px ${hexToRgba(glowColor, 0.35)}`,
                animation: "avatarGlowPulse 1.5s ease-in-out infinite",
              }}
            />
          )}
          {/* Radial pulse glow behind avatar on turn */}
          {isTurn && (
            <div className="absolute -inset-6 z-0">
              <div
                className="w-full h-full rounded-xl"
                style={{
                  background: `radial-gradient(circle, ${hexToRgba(glowColor, 0.25)} 0%, transparent 70%)`,
                  animation: "neonPulse 2s ease-in-out infinite",
                }}
              />
            </div>
          )}

          {/* The avatar image / fallback — 100px square portrait to match reference */}
          {player.avatar ? (
            <img
              src={player.avatar}
              alt={player.name}
              className="w-[100px] h-[100px] rounded-xl object-cover relative z-[1]"
              style={{
                border: `2px solid ${glowColor}`,
                boxShadow: `0 0 10px ${hexToRgba(glowColor, 0.4)}, inset 0 0 6px ${hexToRgba(glowColor, 0.1)}`,
                ...parallaxStyle,
              }}
            />
          ) : (
            <div
              className="w-[100px] h-[100px] rounded-xl flex items-center justify-center text-2xl font-bold text-white/70 relative z-[1]"
              style={{
                border: `2px solid ${glowColor}`,
                boxShadow: `0 0 10px ${hexToRgba(glowColor, 0.4)}, inset 0 0 6px ${hexToRgba(glowColor, 0.1)}`,
                background: isHero
                  ? "linear-gradient(135deg, #0e7490, #164e63)"
                  : "linear-gradient(135deg, #78716c, #44403c)",
                ...parallaxStyle,
              }}
            >
              {player.name.charAt(0).toUpperCase()}
            </div>
          )}

          {/* Dealer badge — gold "D" circle, positioned top-right of avatar */}
          {player.isDealer && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="absolute -right-2 -top-2 z-30 w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-black text-black gold-gradient shadow-[0_0_8px_rgba(201,168,76,0.5)]"
            >
              D
            </motion.div>
          )}

          {/* Seat index badge — small number in bottom-left */}
          <div
            className="absolute -left-1 -bottom-1 z-30 w-5 h-5 rounded-md flex items-center justify-center text-[8px] font-bold"
            style={{
              background: hexToRgba(glowColor, 0.25),
              border: `1px solid ${hexToRgba(glowColor, 0.5)}`,
              color: glowColor,
            }}
          >
            {seatIndex + 1}
          </div>
        </div>

        {/* ── Nameplate panel (dark glass, below avatar) ── */}
        <div
          className="relative z-10 flex flex-col items-center min-w-[80px] rounded-lg overflow-hidden backdrop-blur-md"
          style={{
            background: "rgba(0,0,0,0.60)",
            borderTop: `2px solid ${glowColor}`,
            border: `1px solid rgba(255,255,255,0.06)`,
            borderTopColor: glowColor,
            borderTopWidth: "2px",
            boxShadow: `0 0 12px ${hexToRgba(glowColor, 0.08)}`,
          }}
        >
          {/* Timer arc — SVG border around the nameplate */}
          {isTurn && (
            <svg
              className="absolute -inset-[2px] w-[calc(100%+4px)] h-[calc(100%+4px)] z-20 pointer-events-none"
              viewBox="0 0 110 46"
              preserveAspectRatio="none"
            >
              <rect
                x="1" y="1" width="108" height="44" rx="8"
                fill="none"
                stroke={glowColor}
                strokeWidth="1.5"
                strokeDasharray="316"
                strokeDashoffset={316 - (316 * (player.timeLeft || 100)) / 100}
                className="transition-all duration-1000 ease-linear"
                style={{ filter: `drop-shadow(0 0 4px ${hexToRgba(glowColor, 0.6)})` }}
              />
            </svg>
          )}

          <div className="px-3 py-1.5 flex flex-col items-center gap-0">
            {/* Player name */}
            <span
              className={cn(
                "text-[10px] uppercase font-bold tracking-wider leading-tight",
                isTurn ? "text-white" : "text-gray-400"
              )}
            >
              {player.name}
            </span>

            {/* Chip count — large, gold, mono */}
            <span
              className="text-sm font-mono font-bold leading-tight"
              style={{ color: "#ffd700" }}
            >
              {formatChips(player.chips)}
            </span>
          </div>
        </div>

        {/* ── Current bet chip badge (offset toward table center) ── */}
        <AnimatePresence>
          {player.currentBet > 0 && (
            <motion.div
              initial={{ opacity: 0, scale: 0.7 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.7 }}
              className="absolute z-40 flex items-center gap-1 px-2 py-0.5 rounded-full backdrop-blur-sm"
              style={{
                left: `calc(50% + ${betOffsetX}px)`,
                top: `calc(50% + ${betOffsetY}px)`,
                transform: "translate(-50%, -50%)",
                background: "rgba(0,0,0,0.65)",
                border: "1px solid rgba(255,215,0,0.3)",
                boxShadow: "0 0 8px rgba(255,215,0,0.15)",
              }}
            >
              {/* Chip icon */}
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                <circle cx="8" cy="8" r="7" fill="#ffd700" stroke="#b8860b" strokeWidth="1.5" />
                <circle cx="8" cy="8" r="4" fill="none" stroke="#b8860b" strokeWidth="0.8" />
                <text x="8" y="10.5" textAnchor="middle" fontSize="6" fill="#8B6914" fontWeight="bold">$</text>
              </svg>
              <span className="text-[10px] font-mono font-bold text-amber-400">
                {formatChips(player.currentBet)}
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Face-down hole cards for non-hero players — hidden in 3D mode */}
      {!hideCards && !isHero && player.cards && player.cards.length > 0 && !isFolded && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, type: "spring", stiffness: 200, damping: 20 }}
          className="flex -mt-1"
        >
          {player.cards.map((_, i) => (
            <div
              key={`card-back-${i}`}
              className="rounded-md overflow-hidden"
              style={{
                width: 34,
                height: 48,
                marginLeft: i > 0 ? -10 : 0,
                transform: `rotate(${i === 0 ? -8 : 8}deg)`,
                boxShadow: "0 2px 8px rgba(0,0,0,0.6), 0 0 2px rgba(201,168,76,0.3)",
                border: "1px solid rgba(201,168,76,0.4)",
              }}
            >
              <div className="w-full h-full flex items-center justify-center"
                style={{ background: "linear-gradient(145deg, #1a1040 0%, #0d0820 40%, #1a0a30 70%, #0a0618 100%)" }}
              >
                <div className="w-4 h-4 rounded-full border border-amber-600/30"
                  style={{ background: "radial-gradient(circle, rgba(201,168,76,0.12) 0%, transparent 70%)" }}
                />
              </div>
            </div>
          ))}
        </motion.div>
      )}
    </div>
  );
}
