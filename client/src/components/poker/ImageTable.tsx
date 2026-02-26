import { motion, AnimatePresence } from "framer-motion";
import { Card } from "./Card";
import type { CardType } from "@/lib/poker-types";
import type { Player } from "@/lib/poker-types";
import { TABLE_SEATS, DEALER_POSITIONS } from "@/lib/table-constants";
import { useGameUI } from "@/lib/game-ui-context";

import pokerTableImg from "@assets/generated_images/poker_table_clean_topdown.png";

interface ImageTableProps {
  communityCards: CardType[];
  pot: number;
  playerCount: number;
  maxSeats?: number;
  players?: Player[];
  dealerSeatIndex?: number;
}

export function ImageTable({
  communityCards,
  pot,
  playerCount,
  maxSeats = 10,
  players,
  dealerSeatIndex = -1,
}: ImageTableProps) {
  const { compactMode } = useGameUI();
  const occupiedCount = players?.length || playerCount;
  const dealerPos = dealerSeatIndex >= 0 && dealerSeatIndex < DEALER_POSITIONS.length
    ? DEALER_POSITIONS[dealerSeatIndex]
    : null;

  return (
    <>
      {/* ── Clean table background ── */}
      <img
        src={pokerTableImg}
        alt=""
        draggable={false}
        className="absolute inset-0 w-full h-full pointer-events-none"
        style={{
          zIndex: 1,
          objectFit: "contain",
          objectPosition: "center",
        }}
      />

      {/* ── Game elements overlay (z-index: 10) ── */}
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
                className="w-12 h-12 rounded-full border-2 border-dashed flex items-center justify-center"
                style={{ borderColor: "rgba(255,255,255,0.12)", background: "rgba(0,0,0,0.4)" }}
              >
                <span className="text-[9px] text-white/25 font-mono font-bold">{i + 1}</span>
              </div>
            </div>
          );
        })}

        {/* ── Community cards — large, center of felt ── */}
        <AnimatePresence>
          {communityCards.length > 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="absolute flex gap-2"
              style={{
                left: "50%",
                top: "45%",
                transform: "translate(-50%, -50%)",
                filter: "drop-shadow(0 6px 16px rgba(0,0,0,0.7))",
              }}
            >
              {communityCards.map((card, i) => (
                <Card
                  key={`cc-${i}-${card.suit}-${card.rank}`}
                  card={card}
                  size={compactMode ? "lg" : "xl"}
                  delay={compactMode ? 0 : i * 0.15}
                  dealFrom={compactMode ? undefined : { x: 200, y: -100 }}
                />
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Pot display ── */}
        <AnimatePresence>
          {pot > 0 && (
            <motion.div
              initial={compactMode ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.85 }}
              transition={compactMode ? { duration: 0 } : undefined}
              className="absolute flex items-center gap-2"
              style={{ left: "50%", top: "35%", transform: "translate(-50%, -50%)" }}
            >
              <svg width="36" height="36" viewBox="0 0 48 48" fill="none" data-testid="pot-chip-icon">
                <circle cx="24" cy="24" r="20" fill="#ffd700" stroke="#b8860b" strokeWidth="3" />
                <circle cx="24" cy="24" r="14" fill="none" stroke="#b8860b" strokeWidth="1.5" />
                <circle cx="24" cy="24" r="8" fill="#b8860b" />
                <text x="24" y="28" textAnchor="middle" fontSize="12" fill="#ffd700" fontWeight="bold">$</text>
              </svg>
              <div
                className="px-3 py-1 rounded-lg border border-amber-500/30"
                style={{
                  background: "linear-gradient(180deg, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.85) 100%)",
                  backdropFilter: "blur(8px)",
                  boxShadow: "0 0 20px rgba(255,215,0,0.15), 0 2px 8px rgba(0,0,0,0.5)",
                }}
              >
                <span className="text-lg font-mono font-bold text-amber-400" style={{ textShadow: "0 0 10px rgba(255,215,0,0.4)" }}>
                  ${pot.toLocaleString()}
                </span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Dealer button ── */}
        <AnimatePresence>
          {dealerPos && (
            <motion.div
              key="dealer-btn"
              initial={false}
              animate={{ left: `${dealerPos.x}%`, top: `${dealerPos.y}%`, opacity: 1 }}
              transition={compactMode ? { duration: 0 } : { type: "spring", stiffness: 200, damping: 25 }}
              className="absolute"
              style={{ transform: "translate(-50%, -50%)", zIndex: 15 }}
            >
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center font-black text-sm text-black"
                data-testid="dealer-button"
                style={{
                  background: "linear-gradient(145deg, #ffffff, #e8e0d0)",
                  border: "3px solid #c9a84c",
                  boxShadow: "0 3px 12px rgba(0,0,0,0.5), 0 0 16px rgba(255,255,255,0.2), inset 0 1px 2px rgba(255,255,255,0.5)",
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
