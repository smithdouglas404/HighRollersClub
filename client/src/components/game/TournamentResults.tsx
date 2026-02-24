import { motion, AnimatePresence } from "framer-motion";
import { Trophy, Medal, Crown, ArrowLeft, Coins } from "lucide-react";

interface TournamentResult {
  playerId: string;
  displayName: string;
  finishPlace: number;
  prizeAmount: number;
}

interface TournamentResultsProps {
  results: TournamentResult[];
  prizePool: number;
  onClose: () => void;
}

const placeConfig: Record<number, {
  gradient: string;
  border: string;
  glow: string;
  icon: typeof Trophy;
  iconColor: string;
  label: string;
  textColor: string;
}> = {
  1: {
    gradient: "linear-gradient(135deg, rgba(255,215,0,0.15) 0%, rgba(255,170,0,0.08) 100%)",
    border: "rgba(255,215,0,0.35)",
    glow: "0 0 30px rgba(255,215,0,0.15)",
    icon: Crown,
    iconColor: "text-yellow-400",
    label: "1st Place",
    textColor: "text-yellow-300",
  },
  2: {
    gradient: "linear-gradient(135deg, rgba(192,192,192,0.12) 0%, rgba(160,160,170,0.06) 100%)",
    border: "rgba(192,192,192,0.3)",
    glow: "0 0 20px rgba(192,192,192,0.1)",
    icon: Medal,
    iconColor: "text-gray-300",
    label: "2nd Place",
    textColor: "text-gray-200",
  },
  3: {
    gradient: "linear-gradient(135deg, rgba(205,127,50,0.12) 0%, rgba(180,100,30,0.06) 100%)",
    border: "rgba(205,127,50,0.3)",
    glow: "0 0 20px rgba(205,127,50,0.1)",
    icon: Medal,
    iconColor: "text-amber-600",
    label: "3rd Place",
    textColor: "text-amber-500",
  },
};

export function TournamentResults({ results, prizePool, onClose }: TournamentResultsProps) {
  const sorted = [...results].sort((a, b) => a.finishPlace - b.finishPlace);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] flex items-center justify-center"
        style={{
          background: "radial-gradient(ellipse at center, rgba(0,10,20,0.95) 0%, rgba(0,0,0,0.98) 100%)",
          backdropFilter: "blur(12px)",
        }}
      >
        {/* Ambient glow */}
        <div
          className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full opacity-20 blur-[120px] pointer-events-none"
          style={{ background: "radial-gradient(circle, rgba(255,215,0,0.4) 0%, transparent 70%)" }}
        />

        <motion.div
          initial={{ scale: 0.85, y: 40 }}
          animate={{ scale: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 180, damping: 22, delay: 0.1 }}
          className="relative w-full max-w-lg mx-4"
        >
          {/* Main container */}
          <div
            className="rounded-2xl overflow-hidden"
            style={{
              background: "linear-gradient(180deg, rgba(12,20,30,0.98) 0%, rgba(6,12,20,0.99) 100%)",
              border: "1px solid rgba(255,215,0,0.15)",
              boxShadow: "0 0 60px rgba(255,215,0,0.08), 0 25px 80px rgba(0,0,0,0.6)",
            }}
          >
            {/* Header */}
            <div className="relative px-6 pt-8 pb-5 text-center">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1, rotate: [0, -5, 5, 0] }}
                transition={{ delay: 0.3, type: "spring", stiffness: 200 }}
                className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4"
                style={{
                  background: "linear-gradient(135deg, rgba(255,215,0,0.2) 0%, rgba(255,170,0,0.1) 100%)",
                  border: "1px solid rgba(255,215,0,0.3)",
                  boxShadow: "0 0 40px rgba(255,215,0,0.15)",
                }}
              >
                <Trophy className="w-8 h-8 text-yellow-400" />
              </motion.div>

              <motion.h1
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="text-2xl font-black uppercase tracking-wider text-white"
                style={{ textShadow: "0 0 20px rgba(255,215,0,0.2)" }}
              >
                Tournament Complete
              </motion.h1>

              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
                className="mt-2 flex items-center justify-center gap-2"
              >
                <Coins className="w-4 h-4 text-amber-400" />
                <span className="text-sm font-mono font-bold text-amber-300">
                  Prize Pool: {prizePool.toLocaleString()}
                </span>
              </motion.div>
            </div>

            {/* Divider */}
            <div style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }} />

            {/* Results list */}
            <div className="px-4 py-4 space-y-2 max-h-[400px] overflow-y-auto custom-scrollbar">
              {sorted.map((result, index) => {
                const config = placeConfig[result.finishPlace];
                const isTopThree = result.finishPlace <= 3;
                const PlaceIcon = config?.icon || Trophy;

                return (
                  <motion.div
                    key={result.playerId}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.5 + index * 0.08 }}
                    className="relative rounded-xl px-4 py-3 flex items-center gap-3 overflow-hidden"
                    style={{
                      background: isTopThree
                        ? config.gradient
                        : "rgba(255,255,255,0.02)",
                      border: `1px solid ${isTopThree ? config.border : "rgba(255,255,255,0.05)"}`,
                      boxShadow: isTopThree ? config.glow : "none",
                    }}
                  >
                    {/* Place indicator */}
                    <div
                      className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                        isTopThree ? "" : "bg-white/[0.03] border border-white/[0.06]"
                      }`}
                      style={
                        isTopThree
                          ? {
                              background: config.gradient,
                              border: `1px solid ${config.border}`,
                            }
                          : undefined
                      }
                    >
                      {isTopThree ? (
                        <PlaceIcon className={`w-5 h-5 ${config.iconColor}`} />
                      ) : (
                        <span className="text-sm font-mono font-bold text-gray-500">
                          {result.finishPlace}
                        </span>
                      )}
                    </div>

                    {/* Player name */}
                    <div className="flex-1 min-w-0">
                      <div
                        className={`text-sm font-bold truncate ${
                          isTopThree ? config!.textColor : "text-gray-400"
                        }`}
                      >
                        {result.displayName}
                      </div>
                      {isTopThree && (
                        <div className="text-[10px] text-gray-600 uppercase tracking-wider font-bold">
                          {config!.label}
                        </div>
                      )}
                    </div>

                    {/* Prize */}
                    <div className="text-right shrink-0">
                      {result.prizeAmount > 0 ? (
                        <div
                          className={`text-sm font-mono font-black ${
                            isTopThree ? config!.textColor : "text-gray-400"
                          }`}
                        >
                          +{result.prizeAmount.toLocaleString()}
                        </div>
                      ) : (
                        <div className="text-xs font-mono text-gray-700">--</div>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>

            {/* Footer */}
            <div
              className="px-4 py-4"
              style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}
            >
              <motion.button
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.8 }}
                whileHover={{ scale: 1.02, y: -1 }}
                whileTap={{ scale: 0.98 }}
                onClick={onClose}
                className="w-full flex items-center justify-center gap-2 rounded-xl px-6 py-3.5 font-bold text-sm uppercase tracking-wider transition-all"
                style={{
                  background: "linear-gradient(180deg, rgba(0,240,255,0.15) 0%, rgba(0,180,220,0.08) 100%)",
                  border: "1px solid rgba(0,240,255,0.25)",
                  color: "#67e8f9",
                  boxShadow: "0 0 25px rgba(0,240,255,0.1), inset 0 1px 0 rgba(255,255,255,0.03)",
                }}
              >
                <ArrowLeft className="w-4 h-4" />
                Back to Lobby
              </motion.button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
