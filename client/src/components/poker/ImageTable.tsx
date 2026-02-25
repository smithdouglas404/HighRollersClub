import { motion, AnimatePresence } from "framer-motion";
import { Card } from "./Card";
import type { CardType } from "@/lib/poker-types";
import type { Player } from "@/lib/poker-types";
import { TABLE_SEATS, DEALER_POSITIONS } from "@/lib/table-constants";

import tableBackground from "@assets/generated_images/poker_table_topdown_clean.png";

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
  maxSeats = 9,
  players,
  dealerSeatIndex = -1,
}: ImageTableProps) {
  const occupiedCount = players?.length || playerCount;
  const dealerPos = dealerSeatIndex >= 0 && dealerSeatIndex < DEALER_POSITIONS.length
    ? DEALER_POSITIONS[dealerSeatIndex]
    : null;

  return (
    <>
      {/* ── Layer 1: DALL-E premium table image (NEVER replace with CSS) ── */}
      <img
        src={tableBackground}
        alt="Poker Table"
        className="absolute inset-0 w-full h-full object-cover rounded-2xl"
        draggable={false}
        style={{
          zIndex: 1,
          filter: "brightness(0.95) contrast(1.1) saturate(1.15)",
        }}
      />

      {/* Warm spotlight on felt center — subtle overhead lamp effect */}
      <div
        className="absolute inset-0 rounded-2xl pointer-events-none"
        style={{
          zIndex: 2,
          background: "radial-gradient(ellipse 45% 40% at 50% 46%, rgba(255,248,220,0.06) 0%, transparent 100%)",
        }}
      />

      {/* Gold rim highlight — traces the table rail edge */}
      <div
        className="absolute inset-0 rounded-2xl pointer-events-none"
        style={{
          zIndex: 2,
          background: "radial-gradient(ellipse 52% 48% at 50% 46%, transparent 70%, rgba(201,168,76,0.08) 85%, transparent 100%)",
        }}
      />

      {/* Cinematic vignette — dark edges, clear center */}
      <div
        className="absolute inset-0 rounded-2xl pointer-events-none"
        style={{
          zIndex: 3,
          background: "radial-gradient(ellipse 65% 60% at 50% 46%, transparent 25%, rgba(2,5,8,0.35) 55%, rgba(2,5,8,0.75) 80%, rgba(2,5,8,0.92) 100%)",
        }}
      />

      {/* ── Layer 2: game-overlay (z-index: 10) ── */}
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
                style={{ borderColor: "rgba(255,255,255,0.06)", background: "rgba(0,0,0,0.2)" }}
              >
                <span className="text-[9px] text-white/10 font-mono font-bold">{i + 1}</span>
              </div>
            </div>
          );
        })}

        {/* ── Community cards — prominent center of felt (50%, 48%) ── */}
        <AnimatePresence>
          {communityCards.length > 0 && (
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
              {communityCards.map((card, i) => (
                <Card
                  key={`cc-${i}-${card.suit}-${card.rank}`}
                  card={card}
                  size="lg"
                  delay={i * 0.15}
                  dealFrom={{ x: 200, y: -100 }}
                />
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Pot display — chip stack + gold amount above community cards ── */}
        <AnimatePresence>
          {pot > 0 && (
            <motion.div
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.85 }}
              className="absolute flex flex-col items-center gap-0.5"
              style={{ left: "50%", top: "36%", transform: "translate(-50%, -50%)" }}
            >
              <svg width="48" height="48" viewBox="0 0 48 48" fill="none" data-testid="pot-chip-icon">
                <circle cx="24" cy="24" r="20" fill="#ffd700" stroke="#b8860b" strokeWidth="3" />
                <circle cx="24" cy="24" r="14" fill="none" stroke="#b8860b" strokeWidth="1.5" />
                <circle cx="24" cy="24" r="8" fill="#b8860b" />
                <text x="24" y="28" textAnchor="middle" fontSize="12" fill="#ffd700" fontWeight="bold">$</text>
              </svg>
              <div
                className="px-4 py-1 rounded-lg border border-amber-500/30"
                style={{
                  background: "linear-gradient(180deg, rgba(0,0,0,0.65) 0%, rgba(0,0,0,0.75) 100%)",
                  backdropFilter: "blur(6px)",
                  boxShadow: "0 0 20px rgba(255,215,0,0.12), 0 2px 8px rgba(0,0,0,0.4)",
                }}
              >
                <span className="text-lg font-mono font-bold text-amber-400" style={{ textShadow: "0 0 8px rgba(255,215,0,0.3)" }}>
                  ${pot.toLocaleString()}
                </span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Dealer button — spring-animates between seats ── */}
        <AnimatePresence>
          {dealerPos && (
            <motion.div
              key="dealer-btn"
              initial={false}
              animate={{ left: `${dealerPos.x}%`, top: `${dealerPos.y}%`, opacity: 1 }}
              transition={{ type: "spring", stiffness: 200, damping: 25 }}
              className="absolute"
              style={{ transform: "translate(-50%, -50%)", zIndex: 15 }}
            >
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center font-black text-sm text-black"
                data-testid="dealer-button"
                style={{
                  background: "linear-gradient(145deg, #ffffff, #e8e0d0)",
                  border: "3px solid #c9a84c",
                  boxShadow: "0 3px 10px rgba(0,0,0,0.5), 0 0 16px rgba(255,255,255,0.2), inset 0 1px 2px rgba(255,255,255,0.5)",
                }}
              >
                D
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Top fade */}
      <div
        className="absolute inset-x-0 top-0 h-12 rounded-t-2xl pointer-events-none"
        style={{ zIndex: 20, background: "linear-gradient(to bottom, rgba(2,5,8,0.7) 0%, transparent 100%)" }}
      />
      {/* Bottom fade */}
      <div
        className="absolute inset-x-0 bottom-0 h-20 rounded-b-2xl pointer-events-none"
        style={{ zIndex: 20, background: "linear-gradient(to top, rgba(2,5,8,0.8) 0%, rgba(2,5,8,0.3) 60%, transparent 100%)" }}
      />
    </>
  );
}

