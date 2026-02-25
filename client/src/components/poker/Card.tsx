import { useState } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { CardType, Suit } from "@/lib/poker-types";

interface CardProps {
  card?: CardType;
  className?: string;
  size?: "sm" | "md" | "lg" | "xl";
  delay?: number;
  isHero?: boolean;
  dealFrom?: { x: number; y: number };
  onDealt?: () => void;
}

const suitSymbols: Record<Suit, string> = {
  hearts: "\u2665",
  diamonds: "\u2666",
  clubs: "\u2663",
  spades: "\u2660",
};

const suitColors: Record<Suit, { text: string; css: string; glow: string }> = {
  hearts:   { text: "text-red-500",     css: "#ef4444", glow: "rgba(239,68,68,0.5)" },
  diamonds: { text: "text-sky-400",     css: "#38bdf8", glow: "rgba(56,189,248,0.5)" },
  clubs:    { text: "text-emerald-400", css: "#34d399", glow: "rgba(52,211,153,0.5)" },
  spades:   { text: "text-slate-200",   css: "#e2e8f0", glow: "rgba(226,232,240,0.4)" },
};

const sizeConfig = {
  sm: { w: "w-[52px]",  h: "h-[72px]",  rank: "text-sm",  suit: "text-xs",   centerPx: "26px", padTop: "4px", padLeft: "5px" },
  md: { w: "w-[72px]",  h: "h-[100px]", rank: "text-lg",  suit: "text-sm",   centerPx: "36px", padTop: "6px", padLeft: "7px" },
  lg: { w: "w-[68px]",  h: "h-[97px]",  rank: "text-xl",  suit: "text-sm",   centerPx: "34px", padTop: "6px", padLeft: "7px" },
  xl: { w: "w-[95px]",  h: "h-[136px]", rank: "text-3xl", suit: "text-lg",   centerPx: "50px", padTop: "8px", padLeft: "9px" },
};

export function Card({ card, className, size = "md", delay = 0, isHero = false, dealFrom, onDealt }: CardProps) {
  const s = sizeConfig[size];
  const [holoActive, setHoloActive] = useState(false);

  const dealAnimation = dealFrom
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
            background: "linear-gradient(135deg, #c9a84c, #8b6914, #c9a84c)",
          }}
        >
          <div className="w-full h-full rounded-[6px] overflow-hidden relative"
            style={{
              background: "linear-gradient(145deg, #1a1040 0%, #0d0820 40%, #1a0a30 70%, #0a0618 100%)",
            }}
          >
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-8 h-8 rounded-full border-2 border-amber-600/40"
                style={{
                  background: "radial-gradient(circle, rgba(201,168,76,0.15) 0%, transparent 70%)",
                }}
              />
            </div>
            <div className="absolute inset-2 rounded border border-amber-700/20" />
            <div className="absolute inset-x-0 top-0 h-1/3 bg-gradient-to-b from-white/8 to-transparent" />
          </div>
        </div>
      </motion.div>
    );
  }

  const colors = suitColors[card.suit];

  return (
    <motion.div
      initial={{ rotateY: 180, scale: 0.6, opacity: 0 }}
      animate={{ rotateY: 0, scale: 1, opacity: 1 }}
      transition={{ type: "spring", stiffness: 180, damping: 16, delay }}
      whileHover={isHero ? {
        rotateY: -12,
        rotateX: 8,
        y: -14,
        scale: 1.08,
        transition: { duration: 0.25 },
      } : undefined}
      onAnimationComplete={() => {
        setHoloActive(true);
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
          border: "2px solid #c9a84c",
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
