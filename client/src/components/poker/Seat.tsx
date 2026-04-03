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
import { useAnimatedCounter } from "@/hooks/useAnimatedCounter";
import { StickyNote } from "lucide-react";
import { AVATAR_OPTIONS, type AvatarOption } from "./AvatarSelect";
import type { OpponentHudStats } from "@/lib/useOpponentStats";

const NOTE_COLORS = ["gray", "red", "yellow", "green", "blue", "purple"] as const;

function PlayerNoteIcon({ playerId }: { playerId: string }) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [color, setColor] = useState<string>("gray");
  const [hasNote, setHasNote] = useState(false);
  const [saving, setSaving] = useState(false);
  const popRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch(`/api/player-notes/${playerId}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data) {
          setNote(data.note);
          setColor(data.color || "gray");
          setHasNote(true);
        }
      })
      .catch(() => {});
  }, [playerId]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (popRef.current && !popRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const handleSave = async () => {
    if (!note.trim()) {
      await fetch(`/api/player-notes/${playerId}`, { method: "DELETE" }).catch(() => {});
      setHasNote(false);
      setOpen(false);
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/player-notes/${playerId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: note.trim(), color }),
      });
      if (res.ok) {
        setHasNote(true);
        setOpen(false);
      }
    } catch {}
    setSaving(false);
  };

  const noteColor = color === "red" ? "#ef4444" : color === "yellow" ? "#eab308" : color === "green" ? "#22c55e"
    : color === "blue" ? "#3b82f6" : color === "purple" ? "#a855f7" : "#9ca3af";

  return (
    <div className="relative" ref={popRef}>
      <button
        onClick={(e) => { e.stopPropagation(); setOpen(!open); }}
        className="p-0.5 rounded hover:bg-white/10 transition-colors"
        title="Player note"
      >
        <StickyNote className="w-3 h-3" style={{ color: hasNote ? noteColor : "rgba(255,255,255,0.25)" }} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: -4 }}
            className="absolute z-50 bottom-full mb-1 left-1/2 -translate-x-1/2 w-48 rounded-lg p-2 space-y-1.5"
            style={{
              background: "rgba(8,12,24,0.95)",
              border: "1px solid rgba(255,255,255,0.12)",
              boxShadow: "0 4px 20px rgba(0,0,0,0.6)",
              backdropFilter: "blur(12px)",
            }}
            onClick={e => e.stopPropagation()}
          >
            <textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="Add note..."
              maxLength={500}
              rows={2}
              className="w-full text-[0.625rem] text-white placeholder-gray-600 rounded px-2 py-1 resize-none outline-none"
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}
              autoFocus
            />
            <div className="flex items-center gap-1">
              {NOTE_COLORS.map(c => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className={`w-4 h-4 rounded-full border-2 transition-all ${color === c ? "border-white scale-110" : "border-transparent"}`}
                  style={{
                    background: c === "red" ? "#ef4444" : c === "yellow" ? "#eab308" : c === "green" ? "#22c55e"
                      : c === "blue" ? "#3b82f6" : c === "purple" ? "#a855f7" : "#6b7280",
                  }}
                />
              ))}
              <button
                onClick={handleSave}
                disabled={saving}
                className="ml-auto px-2 py-0.5 rounded text-[0.5625rem] font-bold uppercase bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30 transition-colors disabled:opacity-50"
              >
                {saving ? "..." : "Save"}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}


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

const WINNER_PARTICLE_COLORS = ["#ffd700", "#f5e6a3", "#e8c566", "#fff8dc", "#d4a843"];

function useWinnerParticles(isWinner: boolean) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const animFrameRef = useRef<number>(0);
  const prevWinner = useRef(false);

  useEffect(() => {
    if (isWinner && !prevWinner.current) {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const count = 40 + Math.floor(Math.random() * 21);
      const cx = canvas.width / 2;
      const cy = canvas.height / 2;
      const particles: Particle[] = [];

      for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 1.5 + Math.random() * 3;
        const life = 1.5 + Math.random() * 0.7;
        particles.push({
          x: cx, y: cy,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 1.5,
          size: 2 + Math.random() * 3,
          color: WINNER_PARTICLE_COLORS[Math.floor(Math.random() * WINNER_PARTICLE_COLORS.length)],
          alpha: 1, life, maxLife: life,
        });
      }
      particlesRef.current = particles;

      let lastTime = performance.now();
      const animate = (now: number) => {
        const dt = Math.min((now - lastTime) / 1000, 0.05);
        lastTime = now;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        const alive: Particle[] = [];
        for (const p of particlesRef.current) {
          p.life -= dt;
          if (p.life <= 0) continue;
          p.vy += 2.5 * dt;
          p.x += p.vx * 60 * dt;
          p.y += p.vy * 60 * dt;
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
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [isWinner]);

  return canvasRef;
}

const ACTION_BADGE_STYLES: Record<string, { bg: string; text: string; border: string; glow?: string }> = {
  folded:  { bg: "bg-red-500/30",    text: "text-red-400",    border: "border-red-500/50",   glow: "rgba(239,68,68,0.20)" },
  called:  { bg: "bg-green-500/30",  text: "text-green-400",  border: "border-green-500/50", glow: "rgba(34,197,94,0.20)" },
  checked: { bg: "bg-gray-500/30",   text: "text-gray-300",   border: "border-gray-500/50",  glow: "rgba(156,163,175,0.20)" },
  raised:  { bg: "bg-cyan-500/30",   text: "text-cyan-400",   border: "border-cyan-500/50",  glow: "rgba(0,212,255,0.20)" },
  "all-in":{ bg: "bg-amber-500/30",  text: "text-amber-400",  border: "border-amber-500/50", glow: "rgba(245,158,11,0.20)" },
};

function formatChips(amount: number): string {
  if (amount >= 1_000_000) return `${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `${(amount / 1_000).toFixed(1)}k`;
  return `$${amount.toLocaleString()}`;
}

interface SeatProps {
  player: Player;
  position: { x: number; y: number };
  isHero?: boolean;
  isWinner?: boolean;
  seatIndex?: number;
  perspectiveScale?: number;
  hideCards?: boolean;
  hudStats?: OpponentHudStats;
  avatarTier?: AvatarOption["tier"];
  winStreak?: number;
  showVideo?: boolean;
  dealCardCount?: number;
  turnDeadline?: number;
  turnTimerDuration?: number;
  onPlayerClick?: (player: Player) => void;
}

export function Seat({ player, position, isHero = false, isWinner = false, seatIndex = 0, perspectiveScale = 1, hideCards = false, hudStats, avatarTier, winStreak = 0, showVideo = false, dealCardCount, turnDeadline, turnTimerDuration = 30, onPlayerClick }: SeatProps) {
  const { compactMode } = useGameUI();
  const winnerCanvasRef = useWinnerParticles(isWinner && !compactMode);

  const avatarOption = player.avatar ? AVATAR_OPTIONS.find(a => a.image === player.avatar) : undefined;
  const fullBodyImage = avatarOption?.fullBodyImage;

  const isTurn = player.status === "thinking";
  const isFolded = player.status === "folded";
  const sound = useSoundEngine();
  const prevBetRef = useRef(0);
  const timerTickRef = useRef<ReturnType<typeof setInterval>>(undefined);
  const seatRef = useRef<HTMLDivElement>(null);

  const { value: animatedChips, animating: chipsAnimating, delta: chipsDelta } = useAnimatedCounter(player.chips, 400);

  const timer = useTimerCountdown(
    turnDeadline,
    turnTimerDuration,
    player.timeBankSeconds ?? 30,
    isTurn,
    player.timeLeft,
  );

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
      setReactionStyle({ filter: "brightness(1.2)", boxShadow: "0 0 20px rgba(245,158,11,0.4)" });
      return () => setReactionStyle(undefined);
    } else {
      setReactionStyle(undefined);
    }
  }, [player.status, player.currentBet]);

  useEffect(() => {
    if (isWinner) {
      setReactionStyle({ filter: "brightness(1.3) saturate(1.5)", boxShadow: "0 0 20px rgba(255,215,0,0.5)", transition: "all 0.5s ease" });
      const t = setTimeout(() => setReactionStyle(undefined), 2000);
      return () => clearTimeout(t);
    }
  }, [isWinner]);

  const statusLabel: Record<string, string> = {
    folded: "FOLD",
    checked: "CHECK",
    called: "CALL",
    raised: "RAISE",
    "all-in": "ALL-IN",
  };

  useEffect(() => {
    if (player.currentBet > prevBetRef.current && player.currentBet > 0) {
      sound.playChipClinkAt(position.x, perspectiveScale);
      if (seatRef.current) {
        const rect = seatRef.current.getBoundingClientRect();
        const fromX = rect.left + rect.width / 2;
        const fromY = rect.top + rect.height / 2;
        const potRef = (window as any).__potRef?.current as HTMLDivElement | null;
        let toX: number, toY: number;
        if (potRef) {
          const potRect = potRef.getBoundingClientRect();
          toX = potRect.left + potRect.width / 2;
          toY = potRect.top + potRect.height / 2;
        } else {
          toX = window.innerWidth / 2;
          toY = window.innerHeight * 0.38;
        }
        triggerChipFlight(fromX, fromY, toX, toY, player.currentBet - prevBetRef.current);
      }
    }
    prevBetRef.current = player.currentBet;
  }, [player.currentBet, sound]);

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
    sound.playTimerTick(1 - timer.percent / 100);
    timerTickRef.current = setInterval(tick, currentInterval);
    return () => {
      if (timerTickRef.current) clearInterval(timerTickRef.current);
      timerTickRef.current = undefined;
    };
  }, [isTurn, isHero, timer.percent > 50, timer.percent > 25, timer.percent > 10, sound]);

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

  const hasCards = !hideCards && player.cards && player.cards.length > 0 && !isFolded;
  const showFaceDown = hasCards && !isHero;

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
          isFolded && "opacity-50 grayscale",
          (player.isSittingOut || player.status === "sitting-out") && !isFolded && "opacity-50"
        )}
      >
        <TauntBubble playerId={player.id} />
        <EmoteBubble playerId={player.id} />

        <canvas
          ref={winnerCanvasRef}
          width={200}
          height={200}
          className="absolute pointer-events-none"
          style={{ left: "50%", top: "50%", transform: "translate(-50%, -50%)", width: 200, height: 200, zIndex: 50 }}
        />

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
              {(player.status === "called" || player.status === "raised") && player.currentBet > 0 && (
                <span className="ml-1.5 font-mono text-[0.625rem]">${player.currentBet.toLocaleString()}</span>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Stitch-poker portrait card ── */}
        <div ref={avatarRef} className="relative z-10">
          {showVideo && <VideoThumbnail userId={player.id} isLocal={isHero} size={48} />}
          {avatarTier && avatarTier !== "common" && (
            <AvatarStatusRing
              tier={avatarTier}
              winStreak={winStreak}
              vpipPercent={hudStats ? Math.round((hudStats.vpipCount / Math.max(1, hudStats.handsPlayed)) * 100) : undefined}
              size={160}
              isActive={isTurn}
            />
          )}

          <div
            className={cn("relative w-[150px]", isWinner && "ring-2 ring-[#d4af37] rounded-xl")}
            style={isWinner ? { boxShadow: "0 0 25px rgba(212,175,55,0.5)" } : {}}
          >
            {player.isDealer && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="absolute -top-2 -right-2 z-40 w-6 h-6 rounded-full bg-white flex items-center justify-center shadow-lg"
                style={{ border: "2px solid #d4af37" }}
              >
                <span className="text-[10px] font-black text-gray-900">D</span>
              </motion.div>
            )}

            <div className="relative w-full h-[140px] overflow-visible" style={{ ...reactionStyle }}>
              {player.avatar ? (
                <img
                  src={fullBodyImage || player.avatar}
                  alt={player.name}
                  className={cn(
                    "absolute inset-0 w-full h-full object-cover object-top rounded-t-xl",
                    isFolded && "opacity-40 grayscale"
                  )}
                />
              ) : (
                <div
                  className={cn(
                    "absolute inset-0 w-full h-full flex items-center justify-center text-2xl font-black text-white/70 rounded-t-xl",
                    isFolded && "opacity-40 grayscale"
                  )}
                  style={{
                    background: isHero
                      ? "linear-gradient(135deg, #0e7490, #164e63)"
                      : "linear-gradient(135deg, #78716c, #44403c)",
                  }}
                >
                  {player.name.charAt(0).toUpperCase()}
                </div>
              )}
              <div className="absolute inset-0 rounded-t-xl" style={{
                background: "linear-gradient(180deg, transparent 30%, rgba(10,10,12,0.8) 100%)",
              }} />

              {isTurn && (
                <div className="absolute inset-0 rounded-t-xl pointer-events-none" style={{
                  boxShadow: "inset 0 0 20px rgba(0,243,255,0.3), 0 0 20px rgba(0,243,255,0.3)",
                  border: "2px solid rgba(0,243,255,0.5)",
                  animation: "seatTurnPulse 2s ease-in-out infinite",
                }} />
              )}

              {showFaceDown && (
                <div className="absolute left-1/2 -translate-x-1/2 flex z-20" style={{ bottom: "-4px" }}>
                  {player.cards!.filter((_, i) => dealCardCount === undefined || i < dealCardCount).map((_, ci) => (
                    <div key={ci} className="w-[46px] h-[64px] rounded-md" style={{
                      background: "linear-gradient(135deg, #1e3a5f, #0d1b2a)",
                      border: "2px solid rgba(0,243,255,0.3)",
                      transform: ci === 0 ? "rotate(-10deg) translateX(6px)" : "rotate(10deg) translateX(-6px)",
                      boxShadow: "0 4px 20px rgba(0,0,0,0.8)",
                    }}>
                      <div className="w-full h-full rounded-md flex items-center justify-center" style={{
                        background: "repeating-linear-gradient(45deg, transparent, transparent 4px, rgba(0,243,255,0.08) 4px, rgba(0,243,255,0.08) 8px)",
                      }}>
                        <div className="w-7 h-9 rounded border-2 border-[#00f3ff]/30 bg-[#00f3ff]/10 flex items-center justify-center">
                          <span className="text-[#00f3ff]/40 text-[14px] font-black">H</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="relative z-30 w-full rounded-b-xl px-3 py-2 mt-0" style={{
              background: "rgba(15,15,20,0.92)",
              backdropFilter: "blur(12px)",
            }}>
              <div className="flex items-baseline gap-1.5">
                <span className="text-white/60 text-[12px] whitespace-nowrap" style={{ fontFamily: "system-ui, -apple-system, sans-serif" }}>
                  {seatIndex + 1}:
                </span>
                <span className="text-white font-extrabold text-[12px] uppercase truncate" style={{ fontFamily: "system-ui, -apple-system, sans-serif" }}>
                  {player.name}
                </span>
              </div>
              <div className="flex items-center justify-between mt-1">
                <span className="text-white/80 text-[12px]" style={{ fontFamily: "system-ui, -apple-system, sans-serif" }}>
                  STACK: <span className="text-white font-bold">${animatedChips.toLocaleString()}</span>
                </span>
                {player.currentBet > 0 && !isFolded && (
                  <span className="text-[#d4af37] text-[12px] font-bold" style={{ fontFamily: "system-ui, -apple-system, sans-serif" }}>
                    ${player.currentBet.toLocaleString()}
                  </span>
                )}
                {isFolded && (
                  <span className="text-red-400 text-[10px] font-bold uppercase">Fold</span>
                )}
              </div>
              {isWinner && (
                <div className="mt-1 text-center">
                  <span className="text-[#d4af37] text-[10px] font-black uppercase tracking-wider animate-pulse">WINNER</span>
                </div>
              )}
            </div>

            {player.currentBet > 0 && !isFolded && (
              <div className="absolute z-40" style={{ left: "50%", bottom: "-12px", transform: "translateX(-50%)" }}>
                <div className="flex items-center gap-0.5">
                  <div className="w-4 h-4 rounded-full border-2 border-[#d4af37] bg-[#1a1a12]" style={{ boxShadow: "0 0 6px rgba(212,175,55,0.4)" }} />
                  <div className="w-4 h-4 rounded-full border-2 border-[#d4af37] bg-[#1a1a12] -ml-1.5" style={{ boxShadow: "0 0 6px rgba(212,175,55,0.4)" }} />
                </div>
              </div>
            )}

            {(player.isSittingOut || player.status === "sitting-out") && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-40 px-2 py-0.5 rounded text-[0.625rem] font-black uppercase tracking-wider text-orange-300 bg-black/80 border border-orange-500/50"
                style={{ boxShadow: "0 0 12px rgba(249,115,22,0.3)" }}
              >
                AWAY
              </motion.div>
            )}
          </div>

          {isTurn && (
            <TimerRing
              percent={timer.percent}
              secondsLeft={timer.secondsLeft}
              size={170}
              strokeWidth={4}
              inTimeBank={timer.inTimeBank}
              timeBankRemaining={timer.timeBankRemaining}
              isHero={isHero}
            />
          )}
        </div>

        {hudStats && hudStats.handsPlayed > 0 && (
          <div
            className="relative z-10 flex items-center gap-1.5 px-2 py-0.5 rounded-b-md -mt-0.5"
            style={{
              background: "rgba(0,0,0,0.70)",
              border: "1px solid rgba(255,255,255,0.06)",
              borderTop: "none",
              fontSize: "0.625rem",
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
      </div>
    </div>
  );
}

function HudStat({ label, value, good, isFloat }: { label: string; value: number; good: [number, number]; isFloat?: boolean }) {
  const display = isFloat ? value.toFixed(1) : `${value}`;
  let color = "text-yellow-400";
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
