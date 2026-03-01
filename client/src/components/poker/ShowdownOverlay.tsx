import { motion, AnimatePresence } from "framer-motion";
import { PlayerResult } from "@/lib/hand-evaluator";
import { Player } from "@/lib/poker-types";
import { Card } from "./Card";
import { useEffect, useRef } from "react";
import { useSoundEngine } from "@/lib/sound-context";

interface ShowdownOverlayProps {
  visible: boolean;
  results: PlayerResult[];
  players: Player[];
  pot: number;
}

export function ShowdownOverlay({ visible, results, players, pot }: ShowdownOverlayProps) {
  const winners = results.filter(r => r.isWinner);
  const losers = results.filter(r => !r.isWinner);
  const sound = useSoundEngine();
  const soundPlayedRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    if (visible && !soundPlayedRef.current) {
      soundPlayedRef.current = true;
      sound.playPhaseReveal();
      timerRef.current = setTimeout(() => {
        sound.playShowdownFanfare();
        timerRef.current = setTimeout(() => {
          sound.playChipSlide();
          timerRef.current = setTimeout(() => {
            sound.playWinCelebration();
          }, 400);
        }, 600);
      }, 300);
    }
    if (!visible) {
      soundPlayedRef.current = false;
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [visible, sound]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4 }}
          className="fixed inset-0 z-[100] flex items-center justify-center overflow-auto"
        >
          {/* Simple dark backdrop */}
          <div
            className="absolute inset-0"
            style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(4px)" }}
          />

          {/* Content */}
          <motion.div
            initial={{ scale: 0.85, y: 30 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.85, y: 30 }}
            transition={{ type: "spring", stiffness: 200, damping: 20 }}
            className="relative z-50 w-full max-w-3xl px-6 py-4"
          >
            {/* Header */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.1 }}
              className="text-center mb-4"
            >
              <span className="text-sm text-gray-400 uppercase tracking-[0.4em] font-bold">
                Showdown
              </span>
            </motion.div>

            {/* Winners */}
            {winners.map((winner, wi) => {
              const player = players.find(p => p.id === winner.playerId);
              if (!player || !player.cards) return null;

              return (
                <motion.div
                  key={winner.playerId}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 + wi * 0.1 }}
                  className="text-center mb-6"
                >
                  {/* Winner name */}
                  <h2 className="text-3xl font-black text-white mb-3">
                    {player.name}
                  </h2>

                  {/* Cards */}
                  <div className="flex gap-3 justify-center mb-3">
                    <Card card={{ ...player.cards[0], hidden: false }} size="2xl" delay={0.3} />
                    <Card card={{ ...player.cards[1], hidden: false }} size="2xl" delay={0.4} />
                  </div>

                  {/* Hand badge */}
                  <div
                    className="inline-block rounded-lg px-4 py-2 mb-3"
                    style={{
                      background: "rgba(34,197,94,0.15)",
                      border: "1px solid rgba(34,197,94,0.3)",
                    }}
                  >
                    <span className="text-lg font-black text-green-400">
                      {winner.hand.description}
                    </span>
                  </div>

                  {/* Pot won */}
                  <div className="mt-1">
                    <span className="text-gray-400 mr-2">Wins</span>
                    <span className="font-black font-mono text-2xl text-green-400">
                      +${pot.toLocaleString()}
                    </span>
                  </div>
                </motion.div>
              );
            })}

            {/* Other hands */}
            {losers.length > 0 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
                className="mt-2"
              >
                <div className="text-center text-xs text-gray-500 uppercase tracking-widest mb-3">
                  Other Hands
                </div>
                <div className="flex flex-wrap justify-center gap-4">
                  {losers.map((result, i) => {
                    const player = players.find(p => p.id === result.playerId);
                    if (!player || !player.cards) return null;
                    const cardsHidden = player.cards.every(c => c.hidden);

                    return (
                      <motion.div
                        key={result.playerId}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 0.7 }}
                        transition={{ delay: 0.6 + i * 0.08 }}
                        className="rounded-lg p-3 text-center"
                        style={{
                          minWidth: "130px",
                          background: "rgba(0,0,0,0.5)",
                          border: "1px solid rgba(255,255,255,0.08)",
                        }}
                      >
                        <div className="text-sm font-bold text-white/60 mb-1 truncate">
                          {player.name}
                        </div>
                        <div className="flex gap-1 justify-center mb-1">
                          {cardsHidden ? (
                            <>
                              <Card faceDown size="md" delay={0.7 + i * 0.08} />
                              <Card faceDown size="md" delay={0.75 + i * 0.08} />
                            </>
                          ) : (
                            <>
                              <Card card={{ ...player.cards[0], hidden: false }} size="md" delay={0.7 + i * 0.08} />
                              <Card card={{ ...player.cards[1], hidden: false }} size="md" delay={0.75 + i * 0.08} />
                            </>
                          )}
                        </div>
                        <div className="text-xs font-mono text-gray-500">
                          {cardsHidden ? "Mucked" : result.hand.description}
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </motion.div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
