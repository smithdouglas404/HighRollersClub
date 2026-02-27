import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { Player } from "@/lib/poker-types";
import { EmoteBubble } from "./EmoteSystem";
import { TauntBubble } from "./TauntSystem";
import { useSoundEngine } from "@/lib/sound-context";
import { useGameUI } from "@/lib/game-ui-context";
import { useEffect, useRef, useState, useCallback } from "react";
import { triggerChipFlight } from "./ChipAnimation";
import { AvatarStatusRing } from "./AvatarStatusRing";
import { TimerRing } from "./TimerRing";
import { VideoThumbnail } from "./VideoOverlay";
import { useTimerCountdown } from "@/hooks/useTimerCountdown";
import type { AvatarOption } from "./AvatarSelect";
import type { OpponentHudStats } from "@/lib/useOpponentStats";


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

const WINNER_PARTICLE_COLORS = ["#ffd700", "#c9a84c", "#f5e6a3", "#f0d478", "#e8c566"];

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

// Seat glow color palette — each position gets a unique neon ring (vivid & bright)
const SEAT_COLORS = [
  "#d4a843", // gold (hero)
  "#e74c3c", // crimson red
  "#a855f7", // purple
  "#25a065", // emerald
  "#f0d478", // light gold
  "#e67e22", // warm orange
  "#3498db", // steel blue
  "#2ecc71", // green
  "#c0392b", // deep red
];

function getSeatColor(seatIndex: number, isHero: boolean): string {
  if (isHero) return "#d4a843";
  return SEAT_COLORS[seatIndex % SEAT_COLORS.length];
}

// Action badge styling map — standardized opacities: bg /30, border /50, glow 0.20
const ACTION_BADGE_STYLES: Record<string, { bg: string; text: string; border: string; glow?: string }> = {
  folded:  { bg: "bg-red-500/30",    text: "text-red-400",    border: "border-red-500/50",   glow: "rgba(239,68,68,0.20)" },
  called:  { bg: "bg-green-500/30",  text: "text-green-400",  border: "border-green-500/50", glow: "rgba(34,197,94,0.20)" },
  checked: { bg: "bg-gray-500/30",   text: "text-gray-300",   border: "border-gray-500/50",  glow: "rgba(156,163,175,0.20)" },
  raised:  { bg: "bg-amber-500/30",  text: "text-amber-400",  border: "border-amber-500/50", glow: "rgba(212,168,67,0.20)" },
  "all-in":{ bg: "bg-amber-500/30",  text: "text-amber-400",  border: "border-amber-500/50", glow: "rgba(245,158,11,0.20)" },
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
  hudStats?: OpponentHudStats;
  avatarTier?: AvatarOption["tier"];
  winStreak?: number;
  /** Whether to show video thumbnail for this player */
  showVideo?: boolean;
  /** Number of cards to visually show (0, 1, or 2) during dealing animation */
  dealCardCount?: number;
  /** Server turn deadline for timer (multiplayer) */
  turnDeadline?: number;
  /** Server turn timer duration in seconds */
  turnTimerDuration?: number;
}

export function Seat({ player, position, isHero = false, isWinner = false, seatIndex = 0, perspectiveScale = 1, hideCards = false, hudStats, avatarTier, winStreak = 0, showVideo = false, dealCardCount, turnDeadline, turnTimerDuration = 30 }: SeatProps) {
  const { compactMode } = useGameUI();
  const winnerCanvasRef = useWinnerParticles(isWinner && !compactMode);

  const isTurn = player.status === "thinking";
  const isFolded = player.status === "folded";
  const sound = useSoundEngine();
  const prevBetRef = useRef(player.currentBet);
  const timerTickRef = useRef<ReturnType<typeof setInterval>>(undefined);
  const seatRef = useRef<HTMLDivElement>(null);

  // Smooth timer countdown
  const timer = useTimerCountdown(
    turnDeadline,
    turnTimerDuration,
    player.timeBankSeconds ?? 30,
    isTurn,
    player.timeLeft,
  );

  // Avatar expression reactions
  const prevStatusRef = useRef(player.status);
  const [reactionStyle, setReactionStyle] = useState<React.CSSProperties | undefined>(undefined);

  useEffect(() => {
    const prev = prevStatusRef.current;
    const curr = player.status;
    prevStatusRef.current = curr;
    if (prev === curr) return;

    if (curr === "raised" && player.currentBet > 0) {
      setReactionStyle({ transform: "scale(1.08) translateY(-4px)", transition: "transform 0.3s ease-out" });
      const t = setTimeout(() => setReactionStyle(undefined), 600);
      return () => clearTimeout(t);
    } else if (curr === "folded") {
      setReactionStyle({ animation: "avatarShake 0.4s ease-in-out" });
      const t = setTimeout(() => setReactionStyle(undefined), 400);
      return () => clearTimeout(t);
    } else if (curr === "all-in") {
      setReactionStyle({ animation: "avatarAllInPulse 1.5s ease-in-out infinite" });
      // Clean up infinite animation when status changes away from all-in
      return () => setReactionStyle(undefined);
    } else {
      setReactionStyle(undefined);
    }
  }, [player.status, player.currentBet]);

  // Winner glow reaction
  useEffect(() => {
    if (isWinner) {
      setReactionStyle({ filter: "brightness(1.3) saturate(1.5)", boxShadow: "0 0 20px rgba(255,215,0,0.5)", transition: "all 0.5s ease" });
      const t = setTimeout(() => setReactionStyle(undefined), 2000);
      return () => clearTimeout(t);
    }
  }, [isWinner]);

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
      sound.playChipClinkAt(position.x, perspectiveScale);
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

  // Timer tick sound — only plays when running low (≤50%), rate intensifies as time runs out
  // >50%: silent, 25-50%: every 2s, 10-25%: every 1s, <10%: every 500ms
  useEffect(() => {
    if (!isTurn || !isHero || timer.percent > 50) {
      if (timerTickRef.current) clearInterval(timerTickRef.current);
      timerTickRef.current = undefined;
      return;
    }

    const getInterval = () => {
      const pct = timer.percent;
      if (pct > 25) return 2000;
      if (pct > 10) return 1000;
      return 500;
    };

    let currentInterval = getInterval();
    const tick = () => {
      const urgency = 1 - timer.percent / 100;
      sound.playTimerTick(urgency);
      const newInterval = getInterval();
      if (newInterval !== currentInterval) {
        currentInterval = newInterval;
        if (timerTickRef.current) clearInterval(timerTickRef.current);
        timerTickRef.current = setInterval(tick, currentInterval);
      }
    };

    // Play first tick immediately when crossing the 50% threshold
    sound.playTimerTick(1 - timer.percent / 100);
    timerTickRef.current = setInterval(tick, currentInterval);

    return () => {
      if (timerTickRef.current) clearInterval(timerTickRef.current);
      timerTickRef.current = undefined;
    };
  }, [isTurn, isHero, timer.percent > 50, timer.percent > 25, timer.percent > 10, sound]);

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
    if (!isHero || isFolded || compactMode) {
      setMouseOffset({ x: 0, y: 0 });
      return;
    }
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, [isHero, isFolded, handleMouseMove, compactMode]);

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
        {/* Taunt bubble (above emotes) */}
        <TauntBubble playerId={player.id} />
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
              initial={{ opacity: 0, y: 8, scale: 0.7 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.7 }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
              className={cn(
                "mb-1.5 px-3 py-1 rounded-lg text-[0.6875rem] font-black uppercase tracking-wider z-30 border backdrop-blur-md",
                ACTION_BADGE_STYLES[player.status]?.bg || "bg-black/40",
                ACTION_BADGE_STYLES[player.status]?.text || "text-gray-300",
                ACTION_BADGE_STYLES[player.status]?.border || "border-white/10",
              )}
              style={{
                boxShadow: ACTION_BADGE_STYLES[player.status]?.glow
                  ? `0 0 14px ${ACTION_BADGE_STYLES[player.status].glow}`
                  : undefined,
              }}
            >
              {statusLabel[player.status]}
              {/* Show bet amount next to CALL/RAISE */}
              {(player.status === "called" || player.status === "raised") && player.currentBet > 0 && (
                <span className="ml-1.5 font-mono text-[0.625rem]">{formatChips(player.currentBet)}</span>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Avatar portrait with CSS neon ring (square, ~100px, matching reference) ── */}
        <div ref={avatarRef} className="relative z-10 mb-0.5">
          {/* Video thumbnail overlay */}
          {showVideo && <VideoThumbnail userId={player.id} isLocal={isHero} size={48} />}
          {/* Avatar Status Ring — tier/streak/classification */}
          {avatarTier && avatarTier !== "common" && (
            <AvatarStatusRing
              tier={avatarTier}
              winStreak={winStreak}
              vpipPercent={hudStats ? Math.round((hudStats.vpipCount / Math.max(1, hudStats.handsPlayed)) * 100) : undefined}
              size={100}
              isActive={isTurn}
            />
          )}
          {/* CSS neon glow ring — always visible, intensified on turn */}
          <div
            className="absolute -inset-[6px] z-0 rounded-xl pointer-events-none"
            style={{
              border: `2px solid ${hexToRgba(glowColor, isTurn ? 1.0 : 0.5)}`,
              boxShadow: isTurn
                ? `0 0 16px ${hexToRgba(glowColor, 0.7)}, 0 0 32px ${hexToRgba(glowColor, 0.4)}, inset 0 0 10px ${hexToRgba(glowColor, 0.25)}`
                : `0 0 8px ${hexToRgba(glowColor, 0.35)}`,
              transition: "all 0.3s ease",
              animation: isTurn && !compactMode ? "avatarGlowPulse 1.5s ease-in-out infinite" : "none",
            }}
          />

          {/* Active turn: pulsing outer glow (merged single layer) */}
          {isTurn && !compactMode && (
            <div
              className="absolute -inset-[14px] rounded-xl"
              style={{
                boxShadow: `0 0 28px 8px ${hexToRgba(glowColor, 0.45)}`,
                animation: "avatarGlowPulse 1.5s ease-in-out infinite",
              }}
            />
          )}

          {/* Circular countdown timer ring around avatar */}
          {isTurn && (
            <TimerRing
              percent={timer.percent}
              secondsLeft={timer.secondsLeft}
              size={110}
              strokeWidth={4}
              inTimeBank={timer.inTimeBank}
              timeBankRemaining={timer.timeBankRemaining}
              isHero={isHero}
            />
          )}

          {/* The avatar image / fallback */}
          {player.avatar ? (
            <img
              src={player.avatar}
              alt={player.name}
              className={`rounded-xl object-cover relative z-[1] avatar-size`}
              style={{
                border: `2px solid ${glowColor}`,
                boxShadow: `0 0 10px ${hexToRgba(glowColor, 0.4)}, inset 0 0 6px ${hexToRgba(glowColor, 0.1)}`,
                ...parallaxStyle,
                ...reactionStyle,
              }}
            />
          ) : (
            <div
              className={`rounded-xl flex items-center justify-center text-2xl font-bold text-white/70 relative z-[1] avatar-size`}
              style={{
                border: `2px solid ${glowColor}`,
                boxShadow: `0 0 10px ${hexToRgba(glowColor, 0.4)}, inset 0 0 6px ${hexToRgba(glowColor, 0.1)}`,
                background: isHero
                  ? "linear-gradient(135deg, #0e7490, #164e63)"
                  : "linear-gradient(135deg, #78716c, #44403c)",
                ...parallaxStyle,
                ...reactionStyle,
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
              className="absolute -right-2 -top-2 z-30 w-6 h-6 rounded-full flex items-center justify-center text-[0.5625rem] font-black text-black gold-gradient shadow-[0_0_8px_rgba(201,168,76,0.5)]"
            >
              D
            </motion.div>
          )}

          {/* Seat index badge — small number in bottom-left */}
          <div
            className="absolute -left-1 -bottom-1 z-30 w-5 h-5 rounded-md flex items-center justify-center text-[0.5625rem] font-bold"
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
          className="relative z-10 flex flex-col items-center nameplate-responsive rounded-lg overflow-hidden backdrop-blur-md"
          style={{
            background: "linear-gradient(180deg, rgba(8,12,24,0.80) 0%, rgba(4,8,16,0.85) 100%)",
            border: `1px solid rgba(255,255,255,0.08)`,
            borderTopColor: glowColor,
            borderTopWidth: "3px",
            borderTopStyle: "solid",
            boxShadow: `0 0 16px ${hexToRgba(glowColor, 0.12)}, 0 2px 8px rgba(0,0,0,0.4)`,
          }}
        >
          {/* Timer arc removed — circular TimerRing is rendered around avatar above */}

          <div className="px-3 py-1.5 flex flex-col items-center gap-0">
            {/* Player name */}
            <span
              className={cn(
                "text-[0.625rem] uppercase font-bold tracking-wider leading-tight",
                isTurn ? "text-white" : "text-gray-400"
              )}
            >
              {player.name}
            </span>

            {/* Chip count — large, gold, mono */}
            <span
              className="text-sm font-mono font-bold leading-tight"
              style={{ color: "#ffd700", textShadow: "0 0 8px rgba(255,215,0,0.3)" }}
            >
              {formatChips(player.chips)}
            </span>
          </div>
        </div>

        {/* ── Opponent HUD stats ── */}
        {hudStats && hudStats.handsPlayed > 0 && (
          <div
            className="relative z-10 flex items-center gap-1.5 px-2 py-0.5 rounded-b-md"
            style={{
              background: "rgba(0,0,0,0.70)",
              border: "1px solid rgba(255,255,255,0.06)",
              borderTop: "none",
              fontSize: perspectiveScale < 0.7 ? "11px" : "10px",
              transform: perspectiveScale < 0.7 ? `scale(${1 / perspectiveScale * 0.8})` : undefined,
              transformOrigin: "top center",
            }}
          >
            <HudStat
              label="V"
              value={Math.round((hudStats.vpipCount / hudStats.handsPlayed) * 100)}
              good={[20, 35]}
            />
            <span className="text-gray-600">/</span>
            <HudStat
              label="P"
              value={Math.round((hudStats.pfrCount / hudStats.handsPlayed) * 100)}
              good={[15, 25]}
            />
            <span className="text-gray-600">/</span>
            <HudStat
              label="A"
              value={hudStats.passiveActions > 0
                ? Math.round((hudStats.aggressiveActions / hudStats.passiveActions) * 10) / 10
                : hudStats.aggressiveActions > 0 ? 99 : 0}
              good={[1.0, 3.0]}
              isFloat
            />
            <span className="text-gray-600 font-mono">({hudStats.handsPlayed})</span>
          </div>
        )}

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
              <span className="text-[0.625rem] font-mono font-bold text-amber-400">
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
          {player.cards.filter((_, i) => dealCardCount === undefined || i < dealCardCount).map((_, i) => (
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

// Color-coded HUD stat value
function HudStat({ label, value, good, isFloat }: { label: string; value: number; good: [number, number]; isFloat?: boolean }) {
  const display = isFloat ? value.toFixed(1) : `${value}`;
  let color = "text-yellow-400"; // default: outside range
  if (value >= good[0] && value <= good[1]) {
    color = "text-green-400";
  } else if (value > good[1]) {
    color = "text-red-400";
  }

  return (
    <span className="font-mono font-bold">
      <span className="text-gray-400">{label}:</span>
      <span className={`${color} ml-0.5`}>{display}</span>
    </span>
  );
}
