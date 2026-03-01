import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card } from "./Card";
import type { CardType } from "@/lib/poker-types";
import type { Player } from "@/lib/poker-types";
import { TABLE_SEATS, DEALER_POSITIONS } from "@/lib/table-constants";
import { useGameUI } from "@/lib/game-ui-context";
import { useAnimatedCounter } from "@/hooks/useAnimatedCounter";

import pokerTableImg from "@assets/generated_images/poker_table_clean_topdown.webp";

interface ImageTableProps {
  communityCards: CardType[];
  pot: number;
  playerCount: number;
  maxSeats?: number;
  players?: Player[];
  dealerSeatIndex?: number;
  visibleCommunityCards?: number;
  communityFlipped?: boolean;
  showBurnCard?: boolean;
  dealPhase?: string;
}

export function ImageTable({
  communityCards,
  pot,
  playerCount,
  maxSeats = 10,
  players,
  dealerSeatIndex = -1,
  visibleCommunityCards,
  communityFlipped = true,
  showBurnCard = false,
  dealPhase,
}: ImageTableProps) {
  const { compactMode } = useGameUI();
  const occupiedCount = players?.length || playerCount;
  const dealerPos = dealerSeatIndex >= 0 && dealerSeatIndex < DEALER_POSITIONS.length
    ? DEALER_POSITIONS[dealerSeatIndex]
    : null;

  // Animated pot counter
  const { value: animatedPot } = useAnimatedCounter(pot, 500);

  // Pot container ref
  const potRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    (window as any).__potRef = potRef;
    return () => { delete (window as any).__potRef; };
  }, []);

  return (
    <>
      {/* ── Table background ── */}
      <img
        src={pokerTableImg}
        alt=""
        draggable={false}
        className="absolute inset-0 w-full h-full pointer-events-none"
        style={{ zIndex: 1, objectFit: "contain", objectPosition: "center" }}
      />

      {/* ── Game elements overlay ── */}
      <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 10 }}>

        {/* Empty seat indicators */}
        {Array.from({ length: maxSeats }).map((_, i) => {
          if (i < occupiedCount) return null;
          const seat = TABLE_SEATS[i];
          if (!seat) return null;
          return (
            <div
              key={`empty-${i}`}
              className="absolute"
              style={{
                left: `${seat.x}%`,
                top: `${seat.y}%`,
                transform: `translate(-50%, -50%) scale(${seat.scale})`,
              }}
            >
              <div
                className="w-12 h-12 rounded-full border-2 border-dashed flex items-center justify-center transition-all hover:border-white/30"
                style={{
                  borderColor: "rgba(255,255,255,0.15)",
                  background: "radial-gradient(circle, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0.4) 100%)",
                }}
              >
                <span className="text-[0.5625rem] text-white/40 font-mono font-bold">{i + 1}</span>
              </div>
            </div>
          );
        })}

        {/* ── Community cards ── */}
        <AnimatePresence>
          {(() => {
            const count = visibleCommunityCards !== undefined
              ? Math.min(visibleCommunityCards, communityCards.length)
              : communityCards.length;
            if (count <= 0) return null;
            const cardsToShow = communityCards.slice(0, count);
            return (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="absolute flex gap-2.5"
                style={{
                  left: "50%",
                  top: "48%",
                  transform: "translate(-50%, -50%)",
                  filter: "drop-shadow(0 4px 12px rgba(0,0,0,0.5))",
                }}
              >
                {cardsToShow.map((card, i) => (
                  <Card
                    key={`cc-${i}-${card.suit}-${card.rank}`}
                    card={card}
                    size={compactMode ? "lg" : "2xl"}
                    delay={compactMode ? 0 : i * 0.12}
                    dealFrom={compactMode ? undefined : { x: 200, y: -100 }}
                    faceDown={!communityFlipped && !compactMode}
                    flipDelay={compactMode ? 0 : 0.15 * i}
                  />
                ))}
              </motion.div>
            );
          })()}
        </AnimatePresence>

        {/* ── Pot display — simple dark pill ── */}
        <AnimatePresence>
          {pot > 0 && (
            <motion.div
              ref={potRef}
              initial={compactMode ? { opacity: 1 } : { opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={compactMode ? { duration: 0 } : { duration: 0.2 }}
              className="absolute"
              style={{ left: "50%", top: "27%", transform: "translate(-50%, -50%)" }}
            >
              <div
                className="px-5 py-2 rounded-full flex flex-col items-center gap-0.5"
                style={{
                  background: "rgba(0,0,0,0.7)",
                  border: "1px solid rgba(255,255,255,0.12)",
                  backdropFilter: "blur(8px)",
                }}
              >
                {dealPhase && (
                  <span className="text-[0.6rem] font-bold uppercase tracking-wider text-gray-400">
                    {dealPhase === "pre-flop" ? "Pre-Flop" : dealPhase === "flop" ? "Flop" : dealPhase === "turn" ? "Turn" : dealPhase === "river" ? "River" : ""}
                  </span>
                )}
                <span className="text-lg font-mono font-black text-white" data-testid="text-pot">
                  {animatedPot.toLocaleString()}
                </span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Dealer button — simple yellow circle ── */}
        <AnimatePresence>
          {dealerPos && (
            <motion.div
              key="dealer-btn"
              initial={false}
              animate={{
                left: `${dealerPos.x}%`,
                top: `${dealerPos.y}%`,
                opacity: 1,
              }}
              transition={compactMode ? { duration: 0 } : {
                type: "spring", stiffness: 200, damping: 25,
              }}
              className="absolute"
              style={{ transform: "translate(-50%, -50%)", zIndex: 15 }}
            >
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center font-black text-sm text-black"
                data-testid="dealer-button"
                style={{
                  background: "#eab308",
                  border: "2px solid #ca8a04",
                  boxShadow: "0 2px 6px rgba(0,0,0,0.4)",
                }}
              >
                D
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  );
}
