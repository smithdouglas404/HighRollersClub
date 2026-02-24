import { useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card } from "./Card";
import type { CardType } from "@/lib/poker-types";

import feltTexture from "@assets/generated_images/poker_table_top_cinematic.png";
import lionLogo from "@assets/generated_images/lion_crest_gold_emblem.png";

// ─── Seat positions (percentage-based) for 9-max layout ──────────────────────
// Positioned around the oval table. Each seat has x/y percentages relative to
// the table container, plus an angle for the bet-chip offset direction.
const TABLE_SEATS = [
  { x: 50, y: 92, chipAngle: -90 },   // 0: Hero (bottom center)
  { x: 14, y: 76, chipAngle: -45 },   // 1: bottom-left
  { x: 4,  y: 46, chipAngle: 0 },     // 2: left
  { x: 14, y: 18, chipAngle: 45 },    // 3: top-left
  { x: 36, y: 4,  chipAngle: 90 },    // 4: top-left-center
  { x: 64, y: 4,  chipAngle: 90 },    // 5: top-right-center
  { x: 86, y: 18, chipAngle: 135 },   // 6: top-right
  { x: 96, y: 46, chipAngle: 180 },   // 7: right
  { x: 86, y: 76, chipAngle: -135 },  // 8: bottom-right
];

// ─── Community card positions along center ────────────────────────────────────
const CARD_SPACING = 62; // px between cards
const CARD_START_OFFSET = -2 * CARD_SPACING; // center 5 cards

interface ImageTableProps {
  communityCards: CardType[];
  pot: number;
  playerCount: number;
}

export function ImageTable({ communityCards, pot, playerCount }: ImageTableProps) {
  const seatCount = Math.max(playerCount, 2);
  const seats = TABLE_SEATS.slice(0, seatCount);

  return (
    <div className="absolute inset-0 flex items-center justify-center overflow-hidden">
      {/* ── Cyberpunk ambient background ── */}
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_45%,rgba(15,46,53,0.7)_0%,transparent_55%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_30%,rgba(0,240,255,0.04)_0%,transparent_40%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_30%,rgba(180,77,255,0.03)_0%,transparent_40%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_80%,rgba(201,168,76,0.04)_0%,transparent_35%)]" />
      </div>

      {/* ── The poker table (image-based oval) — fills the viewport like the reference ── */}
      <div
        className="relative"
        style={{
          width: "min(92vw, 1400px)",
          aspectRatio: "1.85 / 1",
        }}
      >
        {/* Outer glow — large ambient neon like reference */}
        <div
          className="absolute -inset-6 rounded-[50%]"
          style={{
            boxShadow:
              "0 0 80px rgba(201,168,76,0.3), 0 0 160px rgba(0,240,255,0.08), 0 0 240px rgba(201,168,76,0.1)",
          }}
        />

        {/* Gold rail ring — thick like reference */}
        <div
          className="absolute -inset-[10px] rounded-[50%]"
          style={{
            background: "linear-gradient(135deg, #c9a84c 0%, #8b6914 25%, #f5e6a3 50%, #8b6914 75%, #c9a84c 100%)",
            boxShadow: "0 0 40px rgba(201,168,76,0.5), 0 0 80px rgba(201,168,76,0.2), inset 0 0 30px rgba(0,0,0,0.5)",
          }}
        />

        {/* Dark wood rail */}
        <div
          className="absolute -inset-[4px] rounded-[50%]"
          style={{
            background: "linear-gradient(180deg, #1a0f08 0%, #2a1a0e 50%, #1a0f08 100%)",
          }}
        />

        {/* Felt surface with image texture */}
        <div
          className="absolute inset-0 rounded-[50%] overflow-hidden"
          style={{
            background: "radial-gradient(ellipse at 50% 50%, #0f2e35 0%, #0a1e24 50%, #071318 100%)",
            boxShadow: "inset 0 0 80px rgba(0,0,0,0.6)",
          }}
        >
          {/* Felt texture overlay */}
          <img
            src={feltTexture}
            alt=""
            className="absolute inset-0 w-full h-full object-cover opacity-50 mix-blend-overlay"
            draggable={false}
          />

          {/* Green felt color boost — matches the rich green in reference */}
          <div
            className="absolute inset-0 rounded-[50%]"
            style={{
              background: "radial-gradient(ellipse at 50% 45%, rgba(16,80,60,0.35) 0%, transparent 65%)",
            }}
          />

          {/* Inner gold trim line */}
          <div
            className="absolute rounded-[50%]"
            style={{
              inset: "5%",
              border: "1.5px solid rgba(201,168,76,0.25)",
              boxShadow: "0 0 8px rgba(201,168,76,0.08)",
            }}
          />

          {/* Center logo watermark */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <img
              src={lionLogo}
              alt=""
              className="w-[12%] opacity-[0.06]"
              draggable={false}
            />
          </div>

          {/* Subtle spotlight on felt — top-down lighting effect */}
          <div
            className="absolute inset-0 rounded-[50%]"
            style={{
              background: "radial-gradient(ellipse at 50% 35%, rgba(255,255,255,0.04) 0%, transparent 55%)",
            }}
          />
        </div>

        {/* ── Community Cards ── */}
        <div className="absolute left-1/2 top-[42%] -translate-x-1/2 -translate-y-1/2 z-20 flex gap-2.5">
          {communityCards.map((card, i) => (
            <Card
              key={`comm-${i}`}
              card={card}
              size="lg"
              delay={0.1 * i}
            />
          ))}
          {/* Placeholder slots for un-dealt community cards */}
          {Array.from({ length: Math.max(0, 5 - communityCards.length) }).map((_, i) => (
            <div
              key={`slot-${i}`}
              className="w-[72px] h-[102px] rounded-lg border border-white/5"
              style={{
                background: "rgba(255,255,255,0.02)",
              }}
            />
          ))}
        </div>

        {/* ── Pot Display ── */}
        <AnimatePresence>
          {pot > 0 && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="absolute left-1/2 top-[28%] -translate-x-1/2 -translate-y-1/2 z-20 flex flex-col items-center"
            >
              <div className="text-[11px] font-bold uppercase tracking-[0.3em] text-gray-400 mb-1">
                POT
              </div>
              <div
                className="px-6 py-2.5 rounded-xl backdrop-blur-md border border-amber-500/25"
                style={{
                  background: "rgba(0,0,0,0.65)",
                  boxShadow: "0 0 30px rgba(255,215,0,0.15), 0 0 60px rgba(255,215,0,0.05)",
                }}
              >
                <span className="text-2xl font-mono font-bold text-amber-400">
                  ${pot.toLocaleString()}
                </span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Neon edge glow (animated) — prominent like reference ── */}
        <div
          className="absolute -inset-[14px] rounded-[50%] pointer-events-none"
          style={{
            background: "conic-gradient(from 0deg, rgba(0,240,255,0.1), rgba(201,168,76,0.06), rgba(180,77,255,0.08), rgba(0,240,255,0.1))",
            animation: "imageTableGlow 8s linear infinite",
            filter: "blur(10px)",
          }}
        />
      </div>

      {/* Keyframe for rotating table glow */}
      <style>{`
        @keyframes imageTableGlow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

export { TABLE_SEATS };
