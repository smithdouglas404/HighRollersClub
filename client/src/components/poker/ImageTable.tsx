import { motion, AnimatePresence } from "framer-motion";
import { Card } from "./Card";
import type { CardType } from "@/lib/poker-types";
import type { Player } from "@/lib/poker-types";

// DALL-E 3 generated assets
import casinoBg from "@assets/generated_images/cyberpunk_casino_bg_wide.png";
import feltTexture from "@assets/generated_images/poker_felt_top_down.png";
import chipStack from "@assets/generated_images/chip_stack_gold_pile.png";

// ─── 9-max seat positions around an oval table (top-down view) ──────────────
// x/y are percentages of the TABLE container (not the screen).
// Seats go clockwise from bottom-center (hero).
const TABLE_SEATS = [
  { x: 50, y: 92 },   // 0: Hero (bottom center)
  { x: 15, y: 78 },   // 1: bottom-left
  { x: 4,  y: 50 },   // 2: left
  { x: 15, y: 22 },   // 3: top-left
  { x: 38, y: 8  },   // 4: top-left-center
  { x: 62, y: 8  },   // 5: top-right-center
  { x: 85, y: 22 },   // 6: top-right
  { x: 96, y: 50 },   // 7: right
  { x: 85, y: 78 },   // 8: bottom-right
];

interface ImageTableProps {
  communityCards: CardType[];
  pot: number;
  playerCount: number;
  maxSeats?: number;
  players?: Player[];
}

export function ImageTable({ communityCards, pot, playerCount, maxSeats = 9, players }: ImageTableProps) {
  // Determine which seats are occupied
  const occupiedCount = players?.length || playerCount;

  return (
    <div className="absolute inset-0 overflow-hidden">
      {/* Layer 1: Casino room environment (DALL-E generated) */}
      <img
        src={casinoBg}
        alt=""
        className="absolute inset-0 w-full h-full object-cover"
        draggable={false}
        style={{
          filter: "brightness(0.35) saturate(1.3)",
        }}
      />

      {/* Ambient neon glow from casino */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse at 30% 70%, rgba(0,240,255,0.04) 0%, transparent 50%), " +
            "radial-gradient(ellipse at 70% 70%, rgba(180,77,255,0.04) 0%, transparent 50%), " +
            "radial-gradient(ellipse at 50% 40%, rgba(255,215,0,0.02) 0%, transparent 40%)",
        }}
      />

      {/* Layer 2: The poker table — oval felt surface with gold rail */}
      <div
        className="absolute"
        style={{
          left: "10%",
          top: "12%",
          width: "80%",
          height: "76%",
        }}
      >
        {/* Outer gold rail ring */}
        <div
          className="absolute inset-0 rounded-[50%]"
          style={{
            background: "linear-gradient(145deg, #c9a84c 0%, #8b6914 30%, #c9a84c 50%, #6b5210 70%, #c9a84c 100%)",
            padding: "6px",
            boxShadow:
              "0 0 40px rgba(201,168,76,0.25), " +
              "0 0 80px rgba(201,168,76,0.1), " +
              "inset 0 2px 4px rgba(255,255,255,0.15), " +
              "0 8px 32px rgba(0,0,0,0.5)",
          }}
        >
          {/* Inner dark rail border */}
          <div
            className="w-full h-full rounded-[50%] relative overflow-hidden"
            style={{
              background: "linear-gradient(180deg, #1a2a1a 0%, #0d1a0d 50%, #0a140a 100%)",
              padding: "4px",
              boxShadow: "inset 0 2px 8px rgba(0,0,0,0.6)",
            }}
          >
            {/* Felt surface using DALL-E texture */}
            <div className="w-full h-full rounded-[50%] relative overflow-hidden">
              <img
                src={feltTexture}
                alt=""
                className="absolute inset-0 w-full h-full object-cover rounded-[50%]"
                draggable={false}
                style={{
                  filter: "brightness(0.75) contrast(1.1) saturate(1.2)",
                }}
              />

              {/* Spotlight on center of felt */}
              <div
                className="absolute inset-0 rounded-[50%] pointer-events-none"
                style={{
                  background: "radial-gradient(ellipse at 50% 45%, rgba(255,255,255,0.06) 0%, transparent 50%)",
                }}
              />

              {/* Inner felt border line (subtle gold trim) */}
              <div
                className="absolute rounded-[50%] pointer-events-none"
                style={{
                  inset: "8%",
                  border: "1px solid rgba(201,168,76,0.15)",
                  boxShadow: "0 0 6px rgba(201,168,76,0.05)",
                }}
              />
            </div>
          </div>
        </div>

        {/* Empty seat indicators for unoccupied positions */}
        {Array.from({ length: maxSeats }).map((_, i) => {
          const isOccupied = i < occupiedCount;
          if (isOccupied) return null; // Occupied seats handled by Game.tsx Seat overlay
          const seat = TABLE_SEATS[i];
          if (!seat) return null;
          return (
            <div
              key={`empty-${i}`}
              className="absolute transform -translate-x-1/2 -translate-y-1/2 pointer-events-none"
              style={{ left: `${seat.x}%`, top: `${seat.y}%` }}
            >
              <div
                className="w-10 h-10 rounded-full border border-dashed flex items-center justify-center"
                style={{
                  borderColor: "rgba(255,255,255,0.1)",
                  background: "rgba(0,0,0,0.3)",
                }}
              >
                <span className="text-[9px] text-gray-600 font-bold">{i + 1}</span>
              </div>
            </div>
          );
        })}

        {/* Community cards — dead center of the table */}
        {communityCards.length > 0 && (
          <div className="absolute left-1/2 top-[45%] -translate-x-1/2 -translate-y-1/2 z-10 flex gap-1.5">
            {communityCards.map((card, i) => (
              <Card
                key={`cc-${i}-${card.suit}-${card.rank}`}
                card={card}
                size="md"
                delay={i * 0.12}
              />
            ))}
          </div>
        )}

        {/* POT display — above community cards, center of table */}
        <AnimatePresence>
          {pot > 0 && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="absolute left-1/2 top-[28%] -translate-x-1/2 -translate-y-1/2 z-20 flex items-center gap-2"
            >
              {/* Chip stack image */}
              <img
                src={chipStack}
                alt=""
                className="w-10 h-10 object-contain drop-shadow-[0_0_8px_rgba(255,215,0,0.3)]"
                style={{ filter: "brightness(1.1)" }}
                draggable={false}
              />
              <div
                className="px-4 py-1.5 rounded-lg backdrop-blur-sm border border-amber-500/25"
                style={{
                  background: "rgba(0,0,0,0.55)",
                  boxShadow: "0 0 20px rgba(255,215,0,0.15)",
                }}
              >
                <span className="text-lg font-mono font-bold text-amber-400">
                  ${pot.toLocaleString()}
                </span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Top edge fade for the HUD bar */}
      <div
        className="absolute inset-x-0 top-0 h-14 pointer-events-none z-30"
        style={{
          background: "linear-gradient(to bottom, rgba(2,5,8,0.85) 0%, transparent 100%)",
        }}
      />

      {/* Bottom edge fade for controls */}
      <div
        className="absolute inset-x-0 bottom-0 h-28 pointer-events-none z-30"
        style={{
          background: "linear-gradient(to top, rgba(2,5,8,0.9) 0%, rgba(2,5,8,0.5) 50%, transparent 100%)",
        }}
      />
    </div>
  );
}

export { TABLE_SEATS };
