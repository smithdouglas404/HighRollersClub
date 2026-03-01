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

const sizeConfig = {
  sm:    { w: "w-[52px]",   h: "h-[72px]",   wPx: 52,  hPx: 72,   rankPx: 28,  suitPx: 22  },
  md:    { w: "w-[72px]",   h: "h-[100px]",  wPx: 72,  hPx: 100,  rankPx: 38,  suitPx: 30  },
  lg:    { w: "w-[84px]",   h: "h-[118px]",  wPx: 84,  hPx: 118,  rankPx: 46,  suitPx: 36  },
  xl:    { w: "w-[95px]",   h: "h-[136px]",  wPx: 95,  hPx: 136,  rankPx: 54,  suitPx: 42  },
  "2xl": { w: "w-[110px]",  h: "h-[156px]",  wPx: 110, hPx: 156,  rankPx: 62,  suitPx: 48  },
  "3xl": { w: "w-[140px]",  h: "h-[200px]",  wPx: 140, hPx: 200,  rankPx: 80,  suitPx: 62  },
};

const suitSymbol: Record<Suit, string> = {
  hearts: "♥",
  diamonds: "♦",
  clubs: "♣",
  spades: "♠",
};

const isRedSuit = (suit: Suit) => suit === "hearts" || suit === "diamonds";

/* ── Card face matching Poker Now: large rank with suit at its bottom-right ── */
function CardFace({ card, size = "md" }: { card: CardType; size?: keyof typeof sizeConfig }) {
  const s = sizeConfig[size];
  const color = isRedSuit(card.suit) ? "#d40000" : "#1a1a1a";
  const suitSize = Math.round(s.rankPx * 0.55);
  return (
    <div
      className="absolute inset-0 rounded-lg overflow-hidden bg-white"
      style={{
        border: "1px solid rgba(0,0,0,0.1)",
        boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
      }}
    >
      <div
        className="flex items-end justify-center"
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
        }}
      >
        <span
          style={{
            color,
            fontSize: `${s.rankPx}px`,
            fontWeight: 900,
            lineHeight: 0.85,
            fontFamily: "'Arial Black', 'Helvetica Neue', Arial, sans-serif",
            letterSpacing: "-0.02em",
          }}
        >
          {card.rank}
        </span>
        <span
          style={{
            color,
            fontSize: `${suitSize}px`,
            lineHeight: 1,
            marginLeft: `${Math.round(suitSize * 0.05)}px`,
            marginBottom: `${Math.round(suitSize * 0.05)}px`,
          }}
        >
          {suitSymbol[card.suit]}
        </span>
      </div>
    </div>
  );
}

/* ── Card back: dark maroon ── */
function CardBack({ imageUrl }: { imageUrl?: string }) {
  if (imageUrl) {
    return (
      <div className="absolute inset-0 rounded-lg overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.1)" }}>
        <img src={imageUrl} alt="card back" className="w-full h-full object-cover" draggable={false} />
      </div>
    );
  }
  return (
    <div
      className="absolute inset-0 rounded-lg overflow-hidden"
      style={{
        background: "linear-gradient(135deg, #5a2020, #3a0e0e)",
        border: "1px solid rgba(255,255,255,0.1)",
      }}
    >
      {/* Subtle cross-hatch pattern */}
      <div className="absolute inset-0 opacity-10" style={{
        backgroundImage: "repeating-linear-gradient(45deg, transparent, transparent 4px, rgba(255,255,255,0.15) 4px, rgba(255,255,255,0.15) 5px), repeating-linear-gradient(-45deg, transparent, transparent 4px, rgba(255,255,255,0.15) 4px, rgba(255,255,255,0.15) 5px)",
      }} />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN CARD COMPONENT
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
            <CardFace card={card} size={size} />
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
          "relative rounded-lg overflow-hidden select-none card-shadow",
          s.w, s.h,
          className
        )}
      >
        <CardBack imageUrl={cardBackImageUrl} />
      </motion.div>
    );
  }

  // ── Branch 3: Normal face-up card ──
  return (
    <motion.div
      initial={compactMode ? { rotateY: 0, scale: 1, opacity: 1 } : { rotateY: 180, scale: 0.6, opacity: 0 }}
      animate={{ rotateY: 0, scale: 1, opacity: 1 }}
      transition={compactMode ? { duration: 0 } : { type: "spring", stiffness: 180, damping: 16, delay }}
      onAnimationComplete={() => onDealt?.()}
      className={cn(
        "relative rounded-lg overflow-hidden select-none cursor-default card-shadow",
        s.w, s.h,
        className
      )}
    >
      <CardFace card={card} size={size} />
    </motion.div>
  );
}
