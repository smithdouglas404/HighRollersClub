import { useState, useEffect } from "react";
import { motion, useMotionValue, useTransform, animate } from "framer-motion";
import { cn } from "@/lib/utils";
import { CardType, Suit } from "@/lib/poker-types";
import { useGameUI } from "@/lib/game-ui-context";
import { useSoundEngine } from "@/lib/sound-context";

interface CardProps {
  card?: CardType;
  className?: string;
  size?: "sm" | "md" | "lg" | "xl" | "2xl" | "3xl";
  delay?: number;
  isHero?: boolean;
  dealFrom?: { x: number; y: number };
  onDealt?: () => void;
  /** Render face-down initially; when set to false, card flips to reveal face */
  faceDown?: boolean;
  /** Delay before flip animation starts (used with faceDown) */
  flipDelay?: number;
}

const suitSymbols: Record<Suit, string> = {
  hearts: "\u2665",
  diamonds: "\u2666",
  clubs: "\u2663",
  spades: "\u2660",
};

const suitColors: Record<Suit, { css: string; glow: string }> = {
  hearts:   { css: "#ef4444", glow: "rgba(239,68,68,0.5)" },
  diamonds: { css: "#ef4444", glow: "rgba(239,68,68,0.5)" },
  clubs:    { css: "#1e293b", glow: "rgba(30,41,59,0.4)" },
  spades:   { css: "#1e293b", glow: "rgba(30,41,59,0.4)" },
};

const sizeConfig = {
  sm:    { w: "w-[52px]",   h: "h-[72px]",   wPx: 52,  hPx: 72  },
  md:    { w: "w-[72px]",   h: "h-[100px]",  wPx: 72,  hPx: 100 },
  lg:    { w: "w-[84px]",   h: "h-[118px]",  wPx: 84,  hPx: 118 },
  xl:    { w: "w-[95px]",   h: "h-[136px]",  wPx: 95,  hPx: 136 },
  "2xl": { w: "w-[110px]",  h: "h-[156px]",  wPx: 110, hPx: 156 },
  "3xl": { w: "w-[140px]",  h: "h-[200px]",  wPx: 140, hPx: 200 },
};

/* ── Standard playing card pip positions [x%, y%, inverted?] ── */
type PipPos = [number, number, boolean?];

const pipLayouts: Record<string, PipPos[]> = {
  "2":  [[50, 25], [50, 75, true]],
  "3":  [[50, 25], [50, 50], [50, 75, true]],
  "4":  [[33, 25], [67, 25], [33, 75, true], [67, 75, true]],
  "5":  [[33, 25], [67, 25], [50, 50], [33, 75, true], [67, 75, true]],
  "6":  [[33, 25], [67, 25], [33, 50], [67, 50], [33, 75, true], [67, 75, true]],
  "7":  [[33, 25], [67, 25], [50, 36], [33, 50], [67, 50], [33, 75, true], [67, 75, true]],
  "8":  [[33, 25], [67, 25], [50, 36], [33, 50], [67, 50], [50, 64, true], [33, 75, true], [67, 75, true]],
  "9":  [[33, 25], [67, 25], [33, 42], [67, 42], [50, 50], [33, 58, true], [67, 58, true], [33, 75, true], [67, 75, true]],
  "10": [[33, 25], [67, 25], [50, 33], [33, 42], [67, 42], [33, 58, true], [67, 58, true], [50, 67, true], [33, 75, true], [67, 75, true]],
};

/* ── Card face content (shared by flip-front + normal-front) ── */
function renderFace(card: CardType, size: keyof typeof sizeConfig, isHero: boolean) {
  const s = sizeConfig[size];
  const colors = suitColors[card.suit];
  const sym = suitSymbols[card.suit];
  const isRed = card.suit === "hearts" || card.suit === "diamonds";

  // Dynamic sizes proportional to card height
  const pipSz = Math.max(8, Math.round(s.hPx * 0.12));
  const idxRank = Math.max(9, Math.round(s.hPx * 0.14));
  const idxSuit = Math.max(7, Math.round(s.hPx * 0.10));
  const padT = Math.round(s.hPx * 0.05);
  const padL = Math.round(s.wPx * 0.09);

  const renderCenter = () => {
    // ── Ace: large ornate center pip ──
    if (card.rank === "A") {
      const aceSize = Math.round(s.hPx * 0.35);
      return (
        <div className="absolute inset-0 flex items-center justify-center" style={{ color: colors.css }}>
          <div className="relative flex items-center justify-center">
            <div className="absolute rounded-full" style={{
              width: aceSize * 1.25,
              height: aceSize * 1.25,
              border: `1.5px solid ${colors.css}`,
              opacity: 0.12,
            }} />
            <span style={{
              fontSize: aceSize,
              lineHeight: 1,
              filter: `drop-shadow(0 2px 6px ${colors.glow})`,
            }}>
              {sym}
            </span>
          </div>
        </div>
      );
    }

    // ── Face cards (J, Q, K): framed emblem ──
    if (card.rank === "J" || card.rank === "Q" || card.rank === "K") {
      const letterSz = Math.round(s.hPx * 0.22);
      const suitSz = Math.round(s.hPx * 0.13);
      const framePipSz = Math.max(6, Math.round(s.hPx * 0.06));

      return (
        <div className="absolute inset-0" style={{ color: colors.css }}>
          {/* Subtle color wash behind figure area */}
          <div className="absolute" style={{
            top: "18%", bottom: "18%", left: "19%", right: "19%",
            borderRadius: 4,
            background: isRed
              ? "linear-gradient(180deg, rgba(255,215,0,0.05) 0%, rgba(255,180,0,0.03) 100%)"
              : "linear-gradient(180deg, rgba(100,149,237,0.05) 0%, rgba(65,105,225,0.03) 100%)",
          }} />
          {/* Outer frame */}
          <div className="absolute" style={{
            top: "17%", bottom: "17%", left: "18%", right: "18%",
            border: `1px solid ${colors.css}`,
            borderRadius: 4,
            opacity: 0.15,
          }} />
          {/* Inner frame */}
          <div className="absolute" style={{
            top: "19%", bottom: "19%", left: "20%", right: "20%",
            border: `1px solid ${colors.css}`,
            borderRadius: 3,
            opacity: 0.08,
          }} />
          {/* Centered emblem: suit + rank letter + suit */}
          <div className="absolute inset-0 flex flex-col items-center justify-center"
            style={{ gap: Math.round(s.hPx * 0.01) }}
          >
            <span style={{ fontSize: suitSz, lineHeight: 1, opacity: 0.4 }}>{sym}</span>
            <span style={{
              fontSize: letterSz,
              fontWeight: 900,
              lineHeight: 1,
              letterSpacing: "-0.03em",
              textShadow: `0 1px 4px ${colors.glow}`,
            }}>
              {card.rank}
            </span>
            <span style={{ fontSize: suitSz, lineHeight: 1, opacity: 0.4 }}>{sym}</span>
          </div>
          {/* Frame corner pips (hidden on very small cards) */}
          {s.hPx >= 100 && (<>
            <span className="absolute" style={{ top: "20%", left: "22%", fontSize: framePipSz, opacity: 0.15 }}>{sym}</span>
            <span className="absolute" style={{ top: "20%", right: "22%", fontSize: framePipSz, opacity: 0.15 }}>{sym}</span>
            <span className="absolute rotate-180" style={{ bottom: "20%", left: "22%", fontSize: framePipSz, opacity: 0.15 }}>{sym}</span>
            <span className="absolute rotate-180" style={{ bottom: "20%", right: "22%", fontSize: framePipSz, opacity: 0.15 }}>{sym}</span>
          </>)}
        </div>
      );
    }

    // ── Number cards (2-10): standard pip layout ──
    const layout = pipLayouts[card.rank];
    if (!layout) return null;

    return (
      <div className="absolute inset-0">
        {layout.map(([x, y, inv], i) => (
          <span
            key={i}
            className="absolute leading-none"
            style={{
              left: `${x}%`,
              top: `${y}%`,
              transform: `translate(-50%, -50%)${inv ? " rotate(180deg)" : ""}`,
              fontSize: pipSz,
              color: colors.css,
            }}
          >
            {sym}
          </span>
        ))}
      </div>
    );
  };

  return (
    <div className="absolute inset-0 rounded-lg">
      {/* Card face background */}
      <div className="absolute inset-0 rounded-lg" style={{
        background: "linear-gradient(175deg, #ffffff 0%, #fafaf7 40%, #f5f3ec 100%)",
        border: isHero ? "2px solid #00d4ff" : "1.5px solid #c9a84c",
        boxShadow: isHero
          ? "inset 0 0 8px rgba(0,212,255,0.1)"
          : "inset 0 1px 2px rgba(255,255,255,0.8)",
      }} />

      {/* Subtle linen texture */}
      <div className="absolute inset-[2px] rounded-[6px] pointer-events-none overflow-hidden" style={{
        backgroundImage: `repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,0,0,0.006) 3px, rgba(0,0,0,0.006) 4px),
                          repeating-linear-gradient(90deg, transparent, transparent 3px, rgba(0,0,0,0.006) 3px, rgba(0,0,0,0.006) 4px)`,
      }} />

      {/* Top-left corner index */}
      <div className="absolute flex flex-col items-center leading-none"
        style={{ top: padT, left: padL, color: colors.css }}
      >
        <span style={{ fontSize: idxRank, fontWeight: 800, lineHeight: 1.1 }}>{card.rank}</span>
        <span style={{ fontSize: idxSuit, lineHeight: 1 }}>{sym}</span>
      </div>

      {/* Bottom-right corner index */}
      <div className="absolute flex flex-col items-center leading-none rotate-180"
        style={{ bottom: padT, right: padL, color: colors.css }}
      >
        <span style={{ fontSize: idxRank, fontWeight: 800, lineHeight: 1.1 }}>{card.rank}</span>
        <span style={{ fontSize: idxSuit, lineHeight: 1 }}>{sym}</span>
      </div>

      {/* Center content (pips / face design / ace) */}
      {renderCenter()}

      {/* Light sheen overlay */}
      <div className="absolute inset-0 rounded-lg pointer-events-none" style={{
        background: "linear-gradient(160deg, rgba(255,255,255,0.35) 0%, transparent 30%, transparent 75%, rgba(255,255,255,0.1) 100%)",
      }} />
    </div>
  );
}

/* ── Card back with diamond lattice ── */
function renderBack(s: { wPx: number; hPx: number }) {
  const lattice = Math.max(6, Math.round(s.hPx * 0.055));
  const emblem = Math.round(s.hPx * 0.16);
  const innerEmblem = Math.round(s.hPx * 0.09);
  const frame = Math.round(Math.min(s.wPx, s.hPx) * 0.08);

  return (
    <div className="absolute inset-0 rounded-lg p-[1.5px]"
      style={{ background: "linear-gradient(135deg, #00d4ff, #005577, #00d4ff)" }}
    >
      <div className="w-full h-full rounded-[6px] overflow-hidden relative"
        style={{ background: "linear-gradient(145deg, #1a1040 0%, #0d0820 40%, #1a0a30 70%, #0a0618 100%)" }}
      >
        {/* Diamond lattice pattern */}
        <div className="absolute inset-0" style={{
          backgroundImage: `
            repeating-linear-gradient(45deg, transparent, transparent ${lattice}px, rgba(0,180,220,0.05) ${lattice}px, rgba(0,180,220,0.05) ${lattice + 1}px),
            repeating-linear-gradient(-45deg, transparent, transparent ${lattice}px, rgba(0,180,220,0.05) ${lattice}px, rgba(0,180,220,0.05) ${lattice + 1}px)`,
        }} />
        {/* Center emblem */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="relative">
            <div className="rounded-full border-2 border-cyan-500/20"
              style={{
                width: emblem,
                height: emblem,
                background: "radial-gradient(circle, rgba(0,212,255,0.12) 0%, transparent 70%)",
              }}
            />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="rounded-full border border-cyan-600/15"
                style={{ width: innerEmblem, height: innerEmblem }}
              />
            </div>
          </div>
        </div>
        {/* Inner frame border */}
        <div className="absolute rounded border border-cyan-700/15"
          style={{ top: frame, left: frame, right: frame, bottom: frame }}
        />
        {/* Top highlight */}
        <div className="absolute inset-x-0 top-0 bg-gradient-to-b from-white/[0.06] to-transparent"
          style={{ height: "30%" }}
        />
      </div>
    </div>
  );
}

/* ── Main Card component ── */
export function Card({
  card,
  className,
  size = "md",
  delay = 0,
  isHero = false,
  dealFrom,
  onDealt,
  faceDown = false,
  flipDelay = 0,
}: CardProps) {
  const s = sizeConfig[size];
  const [holoActive, setHoloActive] = useState(false);
  const [hasFlipped, setHasFlipped] = useState(false);
  let compactMode = false;
  try { compactMode = useGameUI().compactMode; } catch {}
  let sound: ReturnType<typeof useSoundEngine> | null = null;
  try { sound = useSoundEngine(); } catch {}

  // 3D flip: back (rotateY=0) → front (rotateY=180)
  const rotateY = useMotionValue(faceDown ? 0 : 180);
  const backOpacity = useTransform(rotateY, [0, 90, 91, 180], [1, 1, 0, 0]);
  const frontOpacity = useTransform(rotateY, [0, 89, 90, 180], [0, 0, 1, 1]);

  useEffect(() => {
    if (!faceDown && !hasFlipped && card && !card.hidden) {
      const timer = setTimeout(() => {
        animate(rotateY, 180, {
          type: "spring",
          stiffness: 200,
          damping: 22,
          mass: 0.8,
        });
        sound?.playCardFlip();
        setHasFlipped(true);
      }, flipDelay * 1000);
      return () => clearTimeout(timer);
    }
  }, [faceDown, hasFlipped, flipDelay, rotateY, card, sound]);

  const dealAnimation = compactMode
    ? {
        initial: { scale: 1, opacity: 1, x: 0, y: 0, rotate: 0 },
        animate: { scale: 1, opacity: 1, x: 0, y: 0, rotate: 0 },
        transition: { duration: 0 },
      }
    : dealFrom
    ? {
        initial: { x: dealFrom.x, y: dealFrom.y, scale: 0.2, opacity: 0, rotate: -20 },
        animate: { x: 0, y: 0, scale: 1, opacity: 1, rotate: 0 },
        transition: {
          type: "spring" as const,
          stiffness: 160,
          damping: 20,
          delay,
          mass: 0.7,
        },
      }
    : {
        initial: { scale: 0.4, opacity: 0, y: -40 },
        animate: { scale: 1, opacity: 1, y: 0 },
        transition: { type: "spring" as const, stiffness: 280, damping: 20, delay },
      };

  // ── Branch 1: Face-down with 3D flip animation ──
  if ((faceDown || !hasFlipped) && card && !card.hidden && !compactMode) {
    return (
      <motion.div
        {...dealAnimation}
        onAnimationComplete={() => {
          onDealt?.();
          sound?.playCardDeal();
        }}
        className={cn("relative select-none", s.w, s.h, className)}
        style={{ perspective: 800 }}
      >
        <motion.div
          className="w-full h-full relative"
          style={{ rotateY, transformStyle: "preserve-3d" }}
        >
          {/* Card back (visible at rotateY: 0) */}
          <motion.div
            className="absolute inset-0 rounded-lg overflow-hidden"
            style={{ backfaceVisibility: "hidden", opacity: backOpacity }}
          >
            {renderBack(s)}
          </motion.div>

          {/* Card front (visible at rotateY: 180) */}
          <motion.div
            className="absolute inset-0 rounded-lg"
            style={{ backfaceVisibility: "hidden", rotateY: 180, opacity: frontOpacity }}
          >
            {renderFace(card, size, isHero)}
          </motion.div>
        </motion.div>
      </motion.div>
    );
  }

  // ── Branch 2: Hidden / no card — card back only ──
  if (!card || card.hidden) {
    return (
      <motion.div
        {...dealAnimation}
        onAnimationComplete={() => onDealt?.()}
        className={cn(
          "relative rounded-lg overflow-hidden select-none",
          s.w, s.h,
          isHero ? "card-shadow-hero" : "card-shadow",
          className
        )}
      >
        {renderBack(s)}
      </motion.div>
    );
  }

  // ── Branch 3: Normal face-up card ──
  const colors = suitColors[card.suit];

  return (
    <motion.div
      initial={compactMode ? { rotateY: 0, scale: 1, opacity: 1 } : { rotateY: 180, scale: 0.6, opacity: 0 }}
      animate={{ rotateY: 0, scale: 1, opacity: 1 }}
      transition={compactMode ? { duration: 0 } : { type: "spring", stiffness: 180, damping: 16, delay }}
      whileHover={isHero && !compactMode ? {
        rotateY: -12,
        rotateX: 8,
        y: -14,
        scale: 1.08,
        transition: { duration: 0.25 },
      } : undefined}
      onAnimationComplete={() => {
        if (isHero && !compactMode) setHoloActive(true);
        onDealt?.();
      }}
      className={cn(
        "relative rounded-lg overflow-hidden select-none cursor-default",
        s.w, s.h,
        isHero ? "card-shadow-hero" : "card-shadow",
        className
      )}
      style={{
        boxShadow: isHero
          ? `0 4px 12px rgba(0,0,0,0.4), 0 12px 28px rgba(0,0,0,0.3), 0 0 24px ${colors.glow}`
          : `0 2px 8px rgba(0,0,0,0.4), 0 6px 16px rgba(0,0,0,0.25)`,
        transformOrigin: isHero ? "left center" : "center center",
      }}
    >
      {renderFace(card, size, isHero)}

      {/* Holographic sweep on hero cards */}
      {holoActive && (
        <div
          className="absolute inset-0 rounded-lg pointer-events-none"
          style={{
            background: "linear-gradient(105deg, rgba(255,0,0,0.12) 0%, rgba(255,154,0,0.12) 10%, rgba(208,222,33,0.12) 20%, rgba(79,220,74,0.12) 30%, rgba(63,218,216,0.12) 40%, rgba(47,201,226,0.12) 50%, rgba(28,127,238,0.12) 60%, rgba(95,21,242,0.12) 70%, rgba(186,12,248,0.12) 80%, rgba(251,7,217,0.12) 90%, rgba(255,0,0,0.12) 100%)",
            backgroundSize: "200% 100%",
            animation: "holoSweep 1.5s ease-out forwards",
            mixBlendMode: "screen",
          }}
          onAnimationEnd={() => setHoloActive(false)}
        />
      )}
    </motion.div>
  );
}
