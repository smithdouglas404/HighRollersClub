import { motion, AnimatePresence } from "framer-motion";
import { Card } from "./Card";
import { CardType } from "@/lib/poker-types";
import { useSoundEngine } from "@/lib/sound-context";
import { useState, useEffect, useRef } from "react";

interface CommunityCardsProps {
  cards: CardType[];
  pot: number;
}

export function CommunityCards({ cards, pot }: CommunityCardsProps) {
  const sound = useSoundEngine();
  const prevCardCount = useRef(0);
  const [burnCards, setBurnCards] = useState<number[]>([]);

  // Detect new cards being dealt and trigger phase reveal + burn card
  useEffect(() => {
    const newCount = cards.length;
    if (newCount > prevCardCount.current && prevCardCount.current >= 0) {
      const isNewPhase = newCount === 3 || newCount === 4 || newCount === 5;
      if (isNewPhase && prevCardCount.current < newCount) {
        sound.playPhaseReveal();
        // Show burn card
        const burnId = Date.now();
        setBurnCards(prev => [...prev, burnId]);
        setTimeout(() => {
          setBurnCards(prev => prev.filter(id => id !== burnId));
        }, 600);
      }
    }
    prevCardCount.current = newCount;
  }, [cards.length, sound]);

  return (
    <div className="flex flex-col items-center gap-3 relative">

      {/* Pot display */}
      <motion.div
        key={pot}
        initial={{ scale: 0.9 }}
        animate={{ scale: 1 }}
        className="relative"
      >
        <div
          className="rounded-full px-4 py-1.5 flex items-center gap-2"
          style={{
            background: "rgba(0,0,0,0.7)",
            border: "1px solid rgba(255,255,255,0.12)",
          }}
        >
          <span className="text-[0.625rem] uppercase tracking-wider text-gray-400 font-bold">POT</span>
          <span className="text-base font-mono font-black text-white">
            {pot.toLocaleString()}
          </span>
        </div>
      </motion.div>

      {/* Community cards container */}
      <div className="relative">
        <div className="relative flex gap-2 p-2.5 rounded-xl">

          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="relative">
              <AnimatePresence mode="wait">
                {cards[i] ? (
                  <motion.div
                    key={`card-${i}-${cards[i].rank}-${cards[i].suit}`}
                    initial={{ opacity: 0, y: -20, rotateY: 90 }}
                    animate={{ opacity: 1, y: 0, rotateY: 0 }}
                    transition={{
                      type: "spring",
                      stiffness: 200,
                      damping: 20,
                      delay: i * 0.3,
                    }}
                    onAnimationComplete={() => {
                      sound.playCardFlip();
                    }}
                  >
                    <Card card={cards[i]} size="md" />
                  </motion.div>
                ) : (
                  <div
                    className="w-[52px] h-[74px] rounded-lg border border-dashed flex items-center justify-center"
                    style={{
                      borderColor: "rgba(255,255,255,0.06)",
                      background: "rgba(255,255,255,0.02)",
                    }}
                  >
                    {/* Phase indicator dots */}
                    <div className="flex gap-0.5">
                      {i < 3 && <div className="w-1 h-1 rounded-full bg-cyan-500/20" />}
                      {i === 3 && <div className="w-1 h-1 rounded-full bg-yellow-500/20" />}
                      {i === 4 && <div className="w-1 h-1 rounded-full bg-red-500/20" />}
                    </div>
                  </div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
