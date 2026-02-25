import { useState } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { CardType, Suit } from "@/lib/poker-types";

// DALL-E generated card back
import cardBackImage from "@assets/generated_images/card_back_cyberpunk.png";

interface CardProps {
  card?: CardType;
  className?: string;
  size?: "sm" | "md" | "lg";
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

const suitColors: Record<Suit, { text: string; glow: string }> = {
  hearts: { text: "text-red-500", glow: "rgba(239,68,68,0.4)" },
  diamonds: { text: "text-sky-400", glow: "rgba(56,189,248,0.4)" },
  clubs: { text: "text-emerald-400", glow: "rgba(52,211,153,0.4)" },
  spades: { text: "text-slate-200", glow: "rgba(226,232,240,0.3)" },
};

const sizeConfig = {
  sm: { w: "w-[38px]", h: "h-[54px]", rank: "text-[10px]", suit: "text-[9px]", center: "text-base" },
  md: { w: "w-[52px]", h: "h-[74px]", rank: "text-sm", suit: "text-xs", center: "text-xl" },
  lg: { w: "w-[72px]", h: "h-[102px]", rank: "text-lg", suit: "text-base", center: "text-3xl" },
};

export function Card({ card, className, size = "md", delay = 0, isHero = false, dealFrom, onDealt }: CardProps) {
  const s = sizeConfig[size];
  const [holoActive, setHoloActive] = useState(false);

  // Deal-from animation (arc trajectory from shoe position)
  const dealAnimation = dealFrom
    ? {
        initial: { x: dealFrom.x, y: dealFrom.y, scale: 0.3, opacity: 0, rotate: -15 },
        animate: { x: 0, y: 0, scale: 1, opacity: 1, rotate: 0 },
        transition: {
          type: "spring" as const,
          stiffness: 180,
          damping: 22,
          delay,
          mass: 0.8,
        },
      }
    : {
        initial: { scale: 0.5, opacity: 0, y: -30 },
        animate: { scale: 1, opacity: 1, y: 0 },
        transition: { type: "spring" as const, stiffness: 300, damping: 20, delay },
      };

  // Card Back — uses DALL-E generated cyberpunk card back image
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
        {/* Gold border frame */}
        <div className="absolute inset-0 rounded-lg bg-gradient-to-br from-[#c9a84c] via-[#8b6914] to-[#c9a84c] p-[1.5px]">
          <div className="w-full h-full rounded-[6px] overflow-hidden relative">
            <img
              src={cardBackImage}
              alt=""
              className="w-full h-full object-cover"
              draggable={false}
            />
            {/* Top shine overlay */}
            <div className="absolute inset-x-0 top-0 h-1/3 bg-gradient-to-b from-white/8 to-transparent" />
          </div>
        </div>
      </motion.div>
    );
  }

  const colors = suitColors[card.suit];

  return (
    <motion.div
      initial={{ rotateY: 180, scale: 0.7, opacity: 0 }}
      animate={{ rotateY: 0, scale: 1, opacity: 1 }}
      transition={{ type: "spring", stiffness: 200, damping: 18, delay }}
      whileHover={isHero ? {
        rotateY: -15,
        rotateX: 8,
        y: -10,
        scale: 1.05,
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
        ...(isHero ? {
          boxShadow: `0 4px 12px rgba(0,0,0,0.4), 0 12px 28px rgba(0,0,0,0.3), 0 0 20px ${colors.glow}`,
          transformOrigin: "left center",
        } : {}),
      }}
    >
      {/* Card face background */}
      <div className="absolute inset-0 rounded-lg bg-gradient-to-br from-[#c9a84c] via-[#a08530] to-[#c9a84c] p-[1px]">
        <div className="w-full h-full rounded-[7px] bg-gradient-to-b from-[#fafafa] via-[#f0f0f0] to-[#e8e8e8] relative overflow-hidden">

          {/* Subtle texture overlay */}
          <div className="absolute inset-0 opacity-[0.03]"
            style={{
              backgroundImage: `radial-gradient(circle at 50% 50%, #000 1px, transparent 1px)`,
              backgroundSize: '8px 8px',
            }}
          />

          {/* Top-left rank & suit */}
          <div className={cn("absolute top-1 left-1.5 flex flex-col items-center leading-none font-bold", colors.text, s.rank)}>
            <span className="drop-shadow-sm">{card.rank}</span>
            <span className={s.suit}>{suitSymbols[card.suit]}</span>
          </div>

          {/* Center suit (large, faded) */}
          <div className={cn("absolute inset-0 flex items-center justify-center opacity-15", colors.text, s.center)}>
            <span style={{ fontSize: size === "sm" ? "20px" : size === "md" ? "28px" : "42px" }}>
              {suitSymbols[card.suit]}
            </span>
          </div>

          {/* Bottom-right rank & suit (rotated) */}
          <div className={cn("absolute bottom-1 right-1.5 flex flex-col items-center leading-none font-bold rotate-180", colors.text, s.rank)}>
            <span className="drop-shadow-sm">{card.rank}</span>
            <span className={s.suit}>{suitSymbols[card.suit]}</span>
          </div>

          {/* Top highlight */}
          <div className="absolute inset-x-0 top-0 h-1/3 bg-gradient-to-b from-white/40 to-transparent rounded-t-[7px]" />

          {/* Holographic rainbow shimmer overlay */}
          {holoActive && (
            <div
              className="absolute inset-0 rounded-[7px] pointer-events-none"
              style={{
                background: "linear-gradient(105deg, rgba(255,0,0,0.15) 0%, rgba(255,154,0,0.15) 10%, rgba(208,222,33,0.15) 20%, rgba(79,220,74,0.15) 30%, rgba(63,218,216,0.15) 40%, rgba(47,201,226,0.15) 50%, rgba(28,127,238,0.15) 60%, rgba(95,21,242,0.15) 70%, rgba(186,12,248,0.15) 80%, rgba(251,7,217,0.15) 90%, rgba(255,0,0,0.15) 100%)",
                backgroundSize: "200% 100%",
                animation: "holoSweep 1.5s ease-out forwards",
                mixBlendMode: "screen",
              }}
              onAnimationEnd={() => setHoloActive(false)}
            />
          )}
        </div>
      </div>
    </motion.div>
  );
}
