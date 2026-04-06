import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import type { Card as CardType } from "@workspace/api-client-react";

interface PlayingCardProps {
  card?: CardType;
  faceDown?: boolean;
  className?: string;
  delay?: number;
  animate?: boolean;
}

export function PlayingCard({ card, faceDown = false, className, delay = 0, animate: shouldAnimate = false }: PlayingCardProps) {
  if (faceDown || !card) {
    return (
      <div
        className={cn(
          "w-12 h-[68px] rounded-md border border-[#c9a84c]/30 bg-[#1a1a12] shadow-lg flex items-center justify-center relative overflow-hidden",
          className
        )}
      >
        <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'repeating-linear-gradient(45deg, #c9a84c 0, #c9a84c 1px, transparent 1px, transparent 6px)', backgroundSize: '8px 8px' }} />
        <div className="w-1/2 aspect-square border border-[#c9a84c]/40 rounded-full flex items-center justify-center">
          <div className="w-1/2 aspect-square border border-[#c9a84c]/30 rounded-full" />
        </div>
      </div>
    );
  }

  const isRed = card.suit === "hearts" || card.suit === "diamonds";
  const suitSymbol = {
    hearts: "\u2665",
    diamonds: "\u2666",
    clubs: "\u2663",
    spades: "\u2660",
  }[card.suit];

  const color = isRed ? "text-red-600" : "text-gray-900";

  const Wrapper = shouldAnimate ? motion.div : "div";
  const wrapperProps = shouldAnimate ? {
    initial: { y: -30, opacity: 0, rotateY: 180 },
    animate: { y: 0, opacity: 1, rotateY: 0 },
    transition: { delay, type: "spring" as const, stiffness: 200, damping: 20 },
  } : {};

  return (
    <Wrapper
      {...wrapperProps}
      className={cn(
        "w-12 h-[68px] rounded-lg border border-white/30 bg-white shadow-xl relative overflow-hidden",
        className
      )}
    >
      <div className={cn("absolute top-[6%] left-[10%] flex flex-col items-center leading-none", color)}>
        <span className="font-black text-[0.95em]">{card.rank}</span>
        <span className="text-[0.85em] -mt-[0.1em]">{suitSymbol}</span>
      </div>
      <div className={cn("absolute bottom-[6%] right-[10%] flex flex-col items-center leading-none rotate-180", color)}>
        <span className="font-black text-[0.95em]">{card.rank}</span>
        <span className="text-[0.85em] -mt-[0.1em]">{suitSymbol}</span>
      </div>
      <div className={cn("absolute inset-0 flex items-center justify-center", color)}>
        <span className="text-[2em] leading-none">{suitSymbol}</span>
      </div>
    </Wrapper>
  );
}
