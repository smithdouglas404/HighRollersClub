import { useState } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { CardType, Suit } from "@/lib/poker-types";

// DALL-E generated premium card assets
import cardBackImage from "@assets/generated_images/card_back_cyberpunk.png";
import cardFaceTemplate from "@assets/generated_images/card_face_template.png";

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

const suitColors: Record<Suit, { text: string; css: string; glow: string }> = {
  hearts:   { text: "text-red-500",     css: "#ef4444", glow: "rgba(239,68,68,0.5)" },
  diamonds: { text: "text-sky-400",     css: "#38bdf8", glow: "rgba(56,189,248,0.5)" },
  clubs:    { text: "text-emerald-400", css: "#34d399", glow: "rgba(52,211,153,0.5)" },
  spades:   { text: "text-slate-200",   css: "#e2e8f0", glow: "rgba(226,232,240,0.4)" },
};

const sizeConfig = {
  sm: { w: "w-[46px]",  h: "h-[65px]",  rank: "text-xs",  suit: "text-[11px]", centerPx: "22px", padTop: "4px", padLeft: "5px" },
  md: { w: "w-[62px]",  h: "h-[88px]",  rank: "text-base", suit: "text-sm",    centerPx: "30px", padTop: "5px", padLeft: "6px" },
  lg: { w: "w-[82px]",  h: "h-[116px]", rank: "text-xl",  suit: "text-base",   centerPx: "44px", padTop: "7px", padLeft: "8px" },
};

export function Card({ card, className, size = "md", delay = 0, isHero = false, dealFrom, onDealt }: CardProps) {
  const s = sizeConfig[size];
  const [holoActive, setHoloActive] = useState(false);

  // Deal-from animation — sweeping arc from shoe/dealer position
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

  // ── Card Back — DALL-E premium cyberpunk design with gold border ──
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
            {/* Top glossy shine */}
            <div className="absolute inset-x-0 top-0 h-1/3 bg-gradient-to-b from-white/10 to-transparent" />
          </div>
        </div>
      </motion.div>
    );
  }

  // ── Card Face — DALL-E ornate template + CSS suit/rank overlay ──
  const colors = suitColors[card.suit];

  return (
    <motion.div
      // 3D flip reveal: card spins from back to face
      initial={{ rotateY: 180, scale: 0.6, opacity: 0 }}
      animate={{ rotateY: 0, scale: 1, opacity: 1 }}
      transition={{ type: "spring", stiffness: 180, damping: 16, delay }}
      // Hero cards lift and tilt on hover
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
      {/* DALL-E ornate card face template as base */}
      <img
        src={cardFaceTemplate}
        alt=""
        className="absolute inset-0 w-full h-full object-cover rounded-lg"
        draggable={false}
      />

      {/* Suit & rank overlays on top of the ornate template */}
      <div className="absolute inset-0 rounded-lg">
        {/* Top-left rank & suit */}
        <div
          className="absolute flex flex-col items-center leading-none font-black"
          style={{
            top: s.padTop,
            left: s.padLeft,
            color: colors.css,
            textShadow: `0 1px 3px rgba(0,0,0,0.3), 0 0 6px ${colors.glow}`,
          }}
        >
          <span className={s.rank}>{card.rank}</span>
          <span className={s.suit}>{suitSymbols[card.suit]}</span>
        </div>

        {/* Center suit — large, semi-transparent watermark */}
        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{ color: colors.css, opacity: 0.18 }}
        >
          <span style={{ fontSize: s.centerPx, fontWeight: 900 }}>
            {suitSymbols[card.suit]}
          </span>
        </div>

        {/* Bottom-right rank & suit (rotated 180) */}
        <div
          className="absolute flex flex-col items-center leading-none font-black rotate-180"
          style={{
            bottom: s.padTop,
            right: s.padLeft,
            color: colors.css,
            textShadow: `0 1px 3px rgba(0,0,0,0.3), 0 0 6px ${colors.glow}`,
          }}
        >
          <span className={s.rank}>{card.rank}</span>
          <span className={s.suit}>{suitSymbols[card.suit]}</span>
        </div>

        {/* Glossy highlight overlay */}
        <div
          className="absolute inset-0 rounded-lg pointer-events-none"
          style={{
            background: "linear-gradient(160deg, rgba(255,255,255,0.22) 0%, transparent 35%, transparent 70%, rgba(255,255,255,0.06) 100%)",
          }}
        />

        {/* Holographic rainbow shimmer on reveal */}
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
