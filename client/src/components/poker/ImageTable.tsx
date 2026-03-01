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
  /** Number of community cards to visually show (from dealing sequence) */
  visibleCommunityCards?: number;
  /** Whether visible community cards have flipped face-up */
  communityFlipped?: boolean;
  /** Show burn card visual before dealing */
  showBurnCard?: boolean;
  /** Current deal phase — triggers flash on change */
  dealPhase?: string;
}

// Premium chip denomination config
interface ChipDenom {
  color: string;       // Main chip color
  border: string;      // Edge color
  stripe: string;      // Edge stripe color (casino chip stripes)
  inner: string;       // Inner circle color
  count: number;
}

function getPotChipStacks(pot: number): ChipDenom[] {
  const stacks: ChipDenom[] = [];
  let remaining = pot;

  if (remaining >= 500) {
    const count = Math.min(7, Math.floor(remaining / 500));
    stacks.push({ color: "#ffd700", border: "#b8860b", stripe: "#ffffff", inner: "#f59e0b", count });
    remaining -= count * 500;
  }
  if (remaining >= 100) {
    const count = Math.min(7, Math.floor(remaining / 100));
    stacks.push({ color: "#111827", border: "#374151", stripe: "#f8fafc", inner: "#1f2937", count });
    remaining -= count * 100;
  }
  if (remaining >= 50) {
    const count = Math.min(7, Math.floor(remaining / 50));
    stacks.push({ color: "#dc2626", border: "#991b1b", stripe: "#fecaca", inner: "#b91c1c", count });
    remaining -= count * 50;
  }
  if (remaining > 0) {
    const count = Math.min(7, Math.max(1, Math.floor(remaining / 10)));
    stacks.push({ color: "#16a34a", border: "#166534", stripe: "#bbf7d0", inner: "#15803d", count });
  }

  return stacks.slice(0, 3);
}

// Premium casino chip SVG with edge stripes
function PotChip({ chip, index }: { chip: ChipDenom; index: number }) {
  return (
    <svg
      width="32" height="32" viewBox="0 0 32 32" fill="none"
      style={{
        marginBottom: index > 0 ? -29 : 0,
        transform: "rotateX(55deg)",
        filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.5))",
      }}
    >
      {/* Main chip body */}
      <circle cx="16" cy="16" r="15" fill={chip.color} stroke={chip.border} strokeWidth="1.5" />
      {/* Edge stripes (8 evenly spaced) */}
      {[0, 45, 90, 135, 180, 225, 270, 315].map(angle => {
        const rad = (angle * Math.PI) / 180;
        const x1 = 16 + Math.cos(rad) * 12;
        const y1 = 16 + Math.sin(rad) * 12;
        const x2 = 16 + Math.cos(rad) * 15;
        const y2 = 16 + Math.sin(rad) * 15;
        return (
          <line key={angle} x1={x1} y1={y1} x2={x2} y2={y2}
            stroke={chip.stripe} strokeWidth="2.5" strokeLinecap="round" opacity="0.6"
          />
        );
      })}
      {/* Inner decorative ring */}
      <circle cx="16" cy="16" r="9" fill="none" stroke={chip.stripe} strokeWidth="0.8" opacity="0.3" />
      {/* Inner circle */}
      <circle cx="16" cy="16" r="6.5" fill={chip.inner} opacity="0.4" />
      {/* Center dot */}
      <circle cx="16" cy="16" r="2" fill={chip.stripe} opacity="0.25" />
      {/* Top highlight */}
      <ellipse cx="13" cy="10" rx="6" ry="4" fill="white" opacity="0.1" />
    </svg>
  );
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

  // Animated pot counter — smooth count-up/down when pot changes
  const { value: animatedPot, animating: potAnimating, delta: potDelta } = useAnimatedCounter(pot, 500);

  // Pot container ref — exposed via window so chip animations can target it
  const potRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    (window as any).__potRef = potRef;
    return () => { delete (window as any).__potRef; };
  }, []);

  // Phase flash effect
  const [showFlash, setShowFlash] = useState(false);
  const prevPhaseRef = useRef(dealPhase);
  useEffect(() => {
    if (dealPhase && dealPhase !== prevPhaseRef.current && !compactMode) {
      setShowFlash(true);
      const t = setTimeout(() => setShowFlash(false), 500);
      prevPhaseRef.current = dealPhase;
      return () => clearTimeout(t);
    }
    prevPhaseRef.current = dealPhase;
  }, [dealPhase, compactMode]);

  // Previous dealer seat for spin animation
  const prevDealerRef = useRef(dealerSeatIndex);
  const dealerChanged = dealerSeatIndex !== prevDealerRef.current;
  useEffect(() => { prevDealerRef.current = dealerSeatIndex; }, [dealerSeatIndex]);

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
                className="w-12 h-12 rounded-full border-2 border-dashed flex items-center justify-center transition-all hover:border-white/30"
                style={{
                  borderColor: "rgba(255,255,255,0.15)",
                  background: "radial-gradient(circle, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0.4) 100%)",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.3), inset 0 1px 3px rgba(0,0,0,0.2)",
                }}
              >
                <span className="text-[0.5625rem] text-white/40 font-mono font-bold">{i + 1}</span>
              </div>
            </div>
          );
        })}

        {/* ── Burn card visual ── */}
        <AnimatePresence>
          {showBurnCard && !compactMode && (
            <motion.div
              initial={{ opacity: 0, x: 80, y: -40, scale: 0.5 }}
              animate={{ opacity: 0.8, x: 0, y: 0, scale: 0.7 }}
              exit={{ opacity: 0, scale: 0.3 }}
              transition={{ duration: 0.25 }}
              className="absolute"
              style={{
                left: "42%",
                top: "42%",
                transform: "translate(-50%, -50%) rotate(-5deg)",
                zIndex: 11,
              }}
            >
              <div className="w-[50px] h-[70px] rounded-md overflow-hidden"
                style={{
                  background: "linear-gradient(145deg, #1a1040 0%, #0d0820 40%, #1a0a30 70%, #0a0618 100%)",
                  border: "1.5px solid rgba(0,212,255,0.4)",
                  boxShadow: "0 4px 12px rgba(0,0,0,0.6)",
                }}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Community cards glow backdrop ── */}
        {communityCards.length > 0 && (
          <div
            className="absolute pointer-events-none"
            style={{
              left: "50%",
              top: "48%",
              transform: "translate(-50%, -50%)",
              width: "420px",
              height: "180px",
              background: "radial-gradient(ellipse at center, rgba(0,212,255,0.06) 0%, rgba(0,212,255,0.02) 40%, transparent 70%)",
              zIndex: 9,
            }}
          />
        )}

        {/* ── Community cards — large, center of felt ── */}
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
                  filter: "drop-shadow(0 8px 24px rgba(0,0,0,0.7))",
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

        {/* ── Pot display with chip stacks ── */}
        <AnimatePresence>
          {pot > 0 && (
            <motion.div
              ref={potRef}
              initial={compactMode ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.85 }}
              transition={compactMode ? { duration: 0 } : undefined}
              className="absolute flex items-center gap-2.5"
              style={{ left: "50%", top: "27%", transform: "translate(-50%, -50%)" }}
            >
              {/* 3D chip stacks */}
              {!compactMode && (
                <motion.div
                  initial={{ scale: 0.7 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 300, damping: 20 }}
                  className="flex items-end gap-1"
                  style={{ perspective: "120px" }}
                >
                  {getPotChipStacks(animatedPot).map((stack, si) => (
                    <div key={si} className="flex flex-col-reverse items-center">
                      {Array.from({ length: stack.count }).map((_, ci) => (
                        <PotChip key={ci} chip={stack} index={ci} />
                      ))}
                    </div>
                  ))}
                </motion.div>
              )}
              {/* Pot label with pulse glow on change */}
              <motion.div
                animate={potAnimating && !compactMode ? {
                  boxShadow: [
                    "0 0 24px rgba(255,215,0,0.25), 0 0 8px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.1)",
                    "0 0 40px rgba(255,215,0,0.6), 0 0 80px rgba(255,215,0,0.25), 0 0 8px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.1)",
                    "0 0 24px rgba(255,215,0,0.25), 0 0 8px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.1)",
                  ],
                  scale: [1, 1.06, 1],
                } : {
                  boxShadow: "0 0 24px rgba(255,215,0,0.25), 0 0 8px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.1)",
                  scale: 1,
                }}
                transition={{ duration: 0.5, ease: "easeOut" }}
                className="px-5 py-2 rounded-xl border border-amber-500/40"
                style={{
                  background: "linear-gradient(180deg, rgba(20,15,5,0.85) 0%, rgba(10,8,3,0.92) 100%)",
                  backdropFilter: "blur(12px)",
                }}
              >
                <div className="flex items-center gap-2">
                  {dealPhase && dealPhase !== "waiting" && dealPhase !== "showdown" && (
                    <span className="text-[0.5625rem] font-black uppercase tracking-[0.15em] text-cyan-400" style={{ textShadow: "0 0 8px rgba(0,212,255,0.3)" }}>
                      {dealPhase === "pre-flop" ? "PRE-FLOP" : dealPhase.toUpperCase()}
                    </span>
                  )}
                  <span className="text-[0.6875rem] font-bold uppercase tracking-wider text-amber-500/70">POT</span>
                  <span className="text-xl font-mono font-black" style={{ color: "#ffd700", textShadow: "0 0 16px rgba(255,215,0,0.5), 0 0 40px rgba(255,215,0,0.2)" }}>
                    ${animatedPot.toLocaleString()}
                  </span>
                </div>
                {/* Floating delta indicator */}
                <AnimatePresence>
                  {potAnimating && potDelta > 0 && !compactMode && (
                    <motion.span
                      initial={{ opacity: 1, y: 0 }}
                      animate={{ opacity: 0, y: -20 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.8, ease: "easeOut" }}
                      className="absolute -top-4 right-0 text-xs font-mono font-bold text-green-400"
                      style={{ textShadow: "0 0 8px rgba(34,197,94,0.5)" }}
                    >
                      +${potDelta.toLocaleString()}
                    </motion.span>
                  )}
                </AnimatePresence>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Dealer button — metallic with spin ── */}
        <AnimatePresence>
          {dealerPos && (
            <motion.div
              key="dealer-btn"
              initial={false}
              animate={{
                left: `${dealerPos.x}%`,
                top: `${dealerPos.y}%`,
                opacity: 1,
                scale: [1, 1.18, 1],
                rotate: dealerChanged && !compactMode ? [0, 360] : 0,
              }}
              transition={compactMode ? { duration: 0 } : {
                type: "spring", stiffness: 200, damping: 25,
                scale: { duration: 0.4, ease: "easeOut" },
                rotate: { duration: 0.6, ease: "easeInOut" },
              }}
              className="absolute"
              style={{ transform: "translate(-50%, -50%)", zIndex: 15 }}
            >
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center font-black text-sm text-black"
                data-testid="dealer-button"
                style={{
                  background: "radial-gradient(circle at 35% 30%, #ffffff 0%, #f5ecd4 30%, #d4a843 70%, #b8860b 100%)",
                  border: "3px solid #c9a84c",
                  boxShadow: "0 4px 16px rgba(0,0,0,0.6), 0 0 20px rgba(212,168,67,0.3), inset 0 2px 6px rgba(255,255,255,0.7), inset 0 -2px 4px rgba(0,0,0,0.2)",
                }}
              >
                D
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Phase transition flash overlay ── */}
        <AnimatePresence>
          {showFlash && (
            <motion.div
              initial={{ opacity: 0.6 }}
              animate={{ opacity: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.5, ease: "easeOut" }}
              className="absolute inset-0 pointer-events-none"
              style={{
                background: "radial-gradient(ellipse at center, rgba(255,215,0,0.25) 0%, rgba(255,215,0,0.08) 40%, transparent 70%)",
                zIndex: 20,
              }}
            />
          )}
        </AnimatePresence>
      </div>
    </>
  );
}
