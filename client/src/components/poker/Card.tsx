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

const suitColors: Record<Suit, { text: string; css: string; glow: string }> = {
  hearts:   { text: "text-red-500",     css: "#ef4444", glow: "rgba(239,68,68,0.5)" },
  diamonds: { text: "text-red-500",     css: "#ef4444", glow: "rgba(239,68,68,0.5)" },
  clubs:    { text: "text-slate-800",   css: "#1e293b", glow: "rgba(30,41,59,0.4)" },
  spades:   { text: "text-slate-800",   css: "#1e293b", glow: "rgba(30,41,59,0.4)" },
};

const sizeConfig = {
  sm: { w: "w-[52px]",  h: "h-[72px]",  rank: "text-sm",  suit: "text-xs",   centerPx: "26px", padTop: "4px", padLeft: "5px" },
  md: { w: "w-[72px]",  h: "h-[100px]", rank: "text-lg",  suit: "text-sm",   centerPx: "36px", padTop: "6px", padLeft: "7px" },
  lg: { w: "w-[84px]",  h: "h-[118px]", rank: "text-xl",  suit: "text-base", centerPx: "42px", padTop: "7px", padLeft: "8px" },
  xl: { w: "w-[95px]",  h: "h-[136px]", rank: "text-3xl", suit: "text-lg",   centerPx: "50px", padTop: "8px", padLeft: "9px" },
  "2xl": { w: "w-[110px]", h: "h-[156px]", rank: "text-4xl", suit: "text-xl", centerPx: "58px", padTop: "10px", padLeft: "10px" },
  "3xl": { w: "w-[140px]", h: "h-[200px]", rank: "text-5xl", suit: "text-2xl", centerPx: "72px", padTop: "12px", padLeft: "12px" },
};

export function Card({ card, className, size = "md", delay = 0, isHero = false, dealFrom, onDealt, faceDown = false, flipDelay = 0 }: CardProps) {
  const s = sizeConfig[size];
  const [holoActive, setHoloActive] = useState(false);
  const [hasFlipped, setHasFlipped] = useState(false);
  let compactMode = false;
  try { compactMode = useGameUI().compactMode; } catch {}
  let sound: ReturnType<typeof useSoundEngine> | null = null;
  try { sound = useSoundEngine(); } catch {}

  // Track when faceDown transitions from true → false to trigger flip
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

  // Face-down mode: render card with 3D flip (back → front)
  if ((faceDown || !hasFlipped) && card && !card.hidden && !compactMode) {
    const colors = suitColors[card.suit];
    return (
      <motion.div
        {...dealAnimation}
        onAnimationComplete={() => {
          onDealt?.();
          sound?.playCardDeal();
        }}
        className={cn(
          "relative select-none",
          s.w, s.h,
          className
        )}
        style={{ perspective: 800 }}
      >
        <motion.div
          className="w-full h-full relative"
          style={{
            rotateY,
            transformStyle: "preserve-3d",
          }}
        >
          {/* Card back (visible at rotateY: 0) */}
          <motion.div
            className="absolute inset-0 rounded-lg overflow-hidden"
            style={{ backfaceVisibility: "hidden", opacity: backOpacity }}
          >
            <div className="absolute inset-0 rounded-lg p-[1.5px]"
              style={{ background: "linear-gradient(135deg, #00d4ff, #006680, #00d4ff)" }}
            >
              <div className="w-full h-full rounded-[6px] overflow-hidden relative"
                style={{ background: "linear-gradient(145deg, #1a1040 0%, #0d0820 40%, #1a0a30 70%, #0a0618 100%)" }}
              >
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-8 h-8 rounded-full border-2 border-cyan-600/40"
                    style={{ background: "radial-gradient(circle, rgba(0,212,255,0.15) 0%, transparent 70%)" }}
                  />
                </div>
                <div className="absolute inset-2 rounded border border-cyan-700/20" />
              </div>
            </div>
          </motion.div>

          {/* Card front (visible at rotateY: 180) */}
          <motion.div
            className="absolute inset-0 rounded-lg"
            style={{
              backfaceVisibility: "hidden",
              rotateY: 180,
              opacity: frontOpacity,
            }}
          >
            <div className="absolute inset-0 rounded-lg"
              style={{
                background: "linear-gradient(180deg, #ffffff 0%, #f8f6f0 100%)",
                border: "2px solid #d4a843",
              }}
            />
            <div className="absolute inset-0 rounded-lg">
              <div className="absolute flex flex-col items-center leading-none font-black"
                style={{ top: s.padTop, left: s.padLeft, color: colors.css, textShadow: "0 1px 2px rgba(0,0,0,0.15)" }}
              >
                <span className={s.rank}>{card.rank}</span>
                <span className={s.suit}>{suitSymbols[card.suit]}</span>
              </div>
              <div className="absolute inset-0 flex items-center justify-center" style={{ color: colors.css, opacity: 0.3 }}>
                <span style={{ fontSize: s.centerPx, fontWeight: 900 }}>{suitSymbols[card.suit]}</span>
              </div>
              <div className="absolute flex flex-col items-center leading-none font-black rotate-180"
                style={{ bottom: s.padTop, right: s.padLeft, color: colors.css, textShadow: "0 1px 2px rgba(0,0,0,0.15)" }}
              >
                <span className={s.rank}>{card.rank}</span>
                <span className={s.suit}>{suitSymbols[card.suit]}</span>
              </div>
              <div className="absolute inset-0 rounded-lg pointer-events-none"
                style={{ background: "linear-gradient(160deg, rgba(255,255,255,0.3) 0%, transparent 35%, transparent 70%, rgba(255,255,255,0.08) 100%)" }}
              />
            </div>
          </motion.div>
        </motion.div>
      </motion.div>
    );
  }

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
        <div className="absolute inset-0 rounded-lg p-[1.5px]"
          style={{
            background: "linear-gradient(135deg, #00d4ff, #006680, #00d4ff)",
          }}
        >
          <div className="w-full h-full rounded-[6px] overflow-hidden relative"
            style={{
              background: "linear-gradient(145deg, #1a1040 0%, #0d0820 40%, #1a0a30 70%, #0a0618 100%)",
            }}
          >
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-8 h-8 rounded-full border-2 border-cyan-600/40"
                style={{
                  background: "radial-gradient(circle, rgba(0,212,255,0.15) 0%, transparent 70%)",
                }}
              />
            </div>
            <div className="absolute inset-2 rounded border border-cyan-700/20" />
            <div className="absolute inset-x-0 top-0 h-1/3 bg-gradient-to-b from-white/8 to-transparent" />
          </div>
        </div>
      </motion.div>
    );
  }

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
      <div className="absolute inset-0 rounded-lg"
        style={{
          background: "linear-gradient(180deg, #ffffff 0%, #f8f6f0 100%)",
          border: isHero ? "2px solid #00d4ff" : "2px solid #d4a843",
        }}
      />

      <div className="absolute inset-0 rounded-lg">
        <div
          className="absolute flex flex-col items-center leading-none font-black"
          style={{
            top: s.padTop,
            left: s.padLeft,
            color: colors.css,
            textShadow: `0 1px 2px rgba(0,0,0,0.15)`,
          }}
        >
          <span className={s.rank}>{card.rank}</span>
          <span className={s.suit}>{suitSymbols[card.suit]}</span>
        </div>

        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{ color: colors.css, opacity: 0.3 }}
        >
          <span style={{ fontSize: s.centerPx, fontWeight: 900 }}>
            {suitSymbols[card.suit]}
          </span>
        </div>

        <div
          className="absolute flex flex-col items-center leading-none font-black rotate-180"
          style={{
            bottom: s.padTop,
            right: s.padLeft,
            color: colors.css,
            textShadow: `0 1px 2px rgba(0,0,0,0.15)`,
          }}
        >
          <span className={s.rank}>{card.rank}</span>
          <span className={s.suit}>{suitSymbols[card.suit]}</span>
        </div>

        <div
          className="absolute inset-0 rounded-lg pointer-events-none"
          style={{
            background: "linear-gradient(160deg, rgba(255,255,255,0.3) 0%, transparent 35%, transparent 70%, rgba(255,255,255,0.08) 100%)",
          }}
        />

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
      </div>
    </motion.div>
  );
}
