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
  faceDown?: boolean;
  flipDelay?: number;
}

/* ── Suit glow colors for hero card shadows (standard: red suits / black suits) ── */
const suitGlow: Record<Suit, string> = {
  hearts:   "rgba(220,38,38,0.5)",
  diamonds: "rgba(220,38,38,0.5)",
  clubs:    "rgba(51,65,85,0.5)",
  spades:   "rgba(51,65,85,0.5)",
};

const sizeConfig = {
  sm:    { w: "w-[52px]",   h: "h-[72px]",   wPx: 52,  hPx: 72  },
  md:    { w: "w-[72px]",   h: "h-[100px]",  wPx: 72,  hPx: 100 },
  lg:    { w: "w-[84px]",   h: "h-[118px]",  wPx: 84,  hPx: 118 },
  xl:    { w: "w-[95px]",   h: "h-[136px]",  wPx: 95,  hPx: 136 },
  "2xl": { w: "w-[110px]",  h: "h-[156px]",  wPx: 110, hPx: 156 },
  "3xl": { w: "w-[140px]",  h: "h-[200px]",  wPx: 140, hPx: 200 },
};

/* ── Card image URLs (Doug's SVG deck) ── */
function getCardFaceUrl(rank: string, suit: string): string {
  return `/cards/${rank}_${suit}.svg`;
}

const CARD_BACK_URL = "/cards/card_back.webp";

/* ── Card face: Nano Banana generated image ── */
function CardFace({ card, isHero }: { card: CardType; isHero: boolean }) {
  return (
    <div className="absolute inset-0 rounded-lg overflow-hidden" style={{
      border: isHero ? "2px solid #00d4ff" : "1.5px solid #c9a84c",
      boxShadow: isHero ? "inset 0 0 8px rgba(0,212,255,0.1)" : "inset 0 0 4px rgba(201,168,76,0.08)",
    }}>
      <img
        src={getCardFaceUrl(card.rank, card.suit)}
        alt={`${card.rank} of ${card.suit}`}
        className="w-full h-full object-cover"
        draggable={false}
      />
      {/* Light sheen overlay */}
      <div className="absolute inset-0 rounded-lg pointer-events-none" style={{
        background: "linear-gradient(155deg, rgba(255,255,255,0.18) 0%, transparent 25%, transparent 65%, rgba(255,255,255,0.05) 100%)",
      }} />
    </div>
  );
}

/* ── Card back: Nano Banana generated image ── */
function CardBack({ imageUrl }: { imageUrl?: string }) {
  const src = imageUrl || CARD_BACK_URL;
  return (
    <div className="absolute inset-0 rounded-lg p-[1.5px]"
      style={{ background: "linear-gradient(135deg, #00d4ff 0%, #0077aa 25%, #00d4ff 50%, #0077aa 75%, #00d4ff 100%)" }}
    >
      <div className="w-full h-full rounded-[6px] overflow-hidden relative">
        <img src={src} alt="card back" className="w-full h-full object-cover" draggable={false} />
        <div className="absolute inset-x-0 top-0 bg-gradient-to-b from-white/[0.06] to-transparent" style={{ height: "25%" }} />
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN CARD COMPONENT — Nano Banana images + animations
   ═══════════════════════════════════════════════════════════════════════════ */
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
  let cardBackImageUrl: string | undefined;
  try {
    const gameUI = useGameUI();
    compactMode = gameUI.compactMode;
    cardBackImageUrl = gameUI.cardBackPreset?.imageUrl;
  } catch {}
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
          damping: 20,
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
          stiffness: 200,
          damping: 20,
          delay,
        },
      }
    : {
        initial: { scale: 0.4, opacity: 0, y: -40 },
        animate: { scale: 1, opacity: 1, y: 0 },
        transition: { type: "spring" as const, stiffness: 200, damping: 20, delay },
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
          <motion.div
            className="absolute inset-0 rounded-lg overflow-hidden"
            style={{ backfaceVisibility: "hidden", opacity: backOpacity }}
          >
            <CardBack imageUrl={cardBackImageUrl} />
          </motion.div>
          <motion.div
            className="absolute inset-0 rounded-lg"
            style={{ backfaceVisibility: "hidden", rotateY: 180, opacity: frontOpacity }}
          >
            <CardFace card={card} isHero={isHero} />
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
        <CardBack imageUrl={cardBackImageUrl} />
      </motion.div>
    );
  }

  // ── Branch 3: Normal face-up card ──
  const glow = suitGlow[card.suit];

  return (
    <motion.div
      initial={compactMode ? { rotateY: 0, scale: 1, opacity: 1 } : { rotateY: 180, scale: 0.6, opacity: 0 }}
      animate={{ rotateY: 0, scale: 1, opacity: 1 }}
      transition={compactMode ? { duration: 0 } : { type: "spring", stiffness: 200, damping: 20, delay }}
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
          ? `0 4px 12px rgba(0,0,0,0.4), 0 12px 28px rgba(0,0,0,0.3), 0 0 24px ${glow}`
          : `0 2px 8px rgba(0,0,0,0.4), 0 6px 16px rgba(0,0,0,0.25)`,
        transformOrigin: isHero ? "left center" : "center center",
      }}
    >
      <CardFace card={card} isHero={isHero} />

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
