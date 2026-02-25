import { motion, AnimatePresence } from "framer-motion";
import { Card } from "./Card";
import type { CardType } from "@/lib/poker-types";
import type { Player } from "@/lib/poker-types";

// DALL-E generated assets
import tableBackground from "@assets/generated_images/poker_table_topdown_clean.png";
import chipStackImg from "@assets/generated_images/chip_stack_gold_pile.png";
import dealerBtnImg from "@assets/generated_images/dealer_button.png";

// ─── Seat Coordinate Map (percentage-based, 10% rail padding) ───────────────
// All coordinates are % of the table container.
// "Padded Rail" rule: no seat closer than 10% from any edge.
// `scale`: perspective depth (1.0 = near you, 0.6 = across table).
const TABLE_SEATS = [
  { x: 50, y: 88, scale: 1.0  },  // Seat 0: YOU (bottom center)
  { x: 15, y: 75, scale: 0.88 },  // Seat 1: Bottom-left
  { x: 10, y: 50, scale: 0.78 },  // Seat 2: Mid-left
  { x: 15, y: 25, scale: 0.68 },  // Seat 3: Top-left
  { x: 35, y: 12, scale: 0.60 },  // Seat 4: Top-left-center
  { x: 65, y: 12, scale: 0.60 },  // Seat 5: Top-right-center
  { x: 85, y: 25, scale: 0.68 },  // Seat 6: Top-right
  { x: 90, y: 50, scale: 0.78 },  // Seat 7: Mid-right
  { x: 85, y: 75, scale: 0.88 },  // Seat 8: Bottom-right
];

// Dealer button — offset toward center from each seat
const DEALER_POSITIONS = [
  { x: 50, y: 78 },
  { x: 24, y: 68 },
  { x: 18, y: 50 },
  { x: 24, y: 32 },
  { x: 40, y: 22 },
  { x: 60, y: 22 },
  { x: 76, y: 32 },
  { x: 82, y: 50 },
  { x: 76, y: 68 },
];

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
      {/* ── Layer 1: table-background (z-index: 1) ── */}
      <img
        src={tableBackground}
        alt="Poker Table"
        className="absolute inset-0 w-full h-full object-cover rounded-2xl"
        draggable={false}
        style={{
          zIndex: 1,
          filter: "brightness(0.9) contrast(1.08) saturate(1.1)",
        }}
      />

      {/* Vignette */}
      <div
        className="absolute inset-0 rounded-2xl pointer-events-none"
        style={{
          zIndex: 2,
          background: "radial-gradient(ellipse at 50% 48%, transparent 28%, rgba(2,5,8,0.5) 65%, rgba(2,5,8,0.88) 100%)",
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

        {/* ── Community cards — center of the table (50%, 50%) ── */}
        <AnimatePresence>
          {communityCards.length > 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="absolute flex gap-1.5"
              style={{ left: "50%", top: "50%", transform: "translate(-50%, -50%)" }}
            >
              {communityCards.map((card, i) => (
                <Card
                  key={`cc-${i}-${card.suit}-${card.rank}`}
                  card={card}
                  size="md"
                  delay={i * 0.15}
                  dealFrom={{ x: 180, y: -80 }}
                />
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Pot display — above the community cards ── */}
        <AnimatePresence>
          {pot > 0 && (
            <motion.div
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.85 }}
              className="absolute flex items-center gap-2"
              style={{ left: "50%", top: "38%", transform: "translate(-50%, -50%)" }}
            >
              <img
                src={chipStackImg}
                alt="Pot"
                className="w-9 h-9 object-contain"
                draggable={false}
                style={{ filter: "brightness(1.1) drop-shadow(0 0 6px rgba(255,215,0,0.3))" }}
              />
              <div
                className="px-3 py-1 rounded-lg border border-amber-500/25"
                style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)", boxShadow: "0 0 16px rgba(255,215,0,0.1)" }}
              >
                <span className="text-base font-mono font-bold text-amber-400">
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
              <img
                src={dealerBtnImg}
                alt="D"
                className="w-7 h-7 object-contain"
                draggable={false}
                style={{ filter: "brightness(1.2) drop-shadow(0 2px 4px rgba(0,0,0,0.5))" }}
              />
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

export { TABLE_SEATS };
