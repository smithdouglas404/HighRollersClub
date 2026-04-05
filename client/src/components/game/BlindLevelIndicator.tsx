import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, ChevronUp, Clock, Layers, AlertTriangle } from "lucide-react";

interface BlindScheduleEntry {
  level: number;
  sb: number;
  bb: number;
  ante: number;
  duration: number;
}

interface BlindLevelIndicatorProps {
  currentLevel: number;
  sb: number;
  bb: number;
  ante: number;
  nextLevelIn: number;
  blindSchedule?: BlindScheduleEntry[];
}

export function BlindLevelIndicator({
  currentLevel,
  sb,
  bb,
  ante,
  nextLevelIn,
  blindSchedule,
}: BlindLevelIndicatorProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [timeLeft, setTimeLeft] = useState(nextLevelIn);

  // Sync timeLeft when prop changes
  useEffect(() => {
    setTimeLeft(nextLevelIn);
  }, [nextLevelIn]);

  // Countdown timer
  useEffect(() => {
    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 0) return 0;
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const isWarning = timeLeft > 0 && timeLeft <= 30;
  const nextLevel = blindSchedule?.find((l) => l.level === currentLevel + 1);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 200, damping: 25 }}
      className="fixed top-4 left-4 z-50"
    >
      <div
        className="rounded-xl backdrop-blur-md overflow-hidden"
        style={{
          background: "linear-gradient(180deg, rgba(20,31,40,0.88) 0%, rgba(16,24,36,0.92) 100%)",
          border: "1px solid rgba(212,175,55,0.12)",
          boxShadow: "0 4px 30px rgba(0,0,0,0.4), 0 0 20px rgba(212,175,55,0.05)",
          minWidth: 220,
        }}
      >
        {/* Header - always visible */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="w-full flex items-center justify-between gap-3 p-3 hover:bg-white/[0.02] transition-colors"
        >
          <div className="flex items-center gap-2.5">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
              style={{
                background: isWarning
                  ? "rgba(234,179,8,0.15)"
                  : "rgba(212,175,55,0.08)",
                border: `1px solid ${isWarning ? "rgba(234,179,8,0.3)" : "rgba(212,175,55,0.15)"}`,
              }}
            >
              <Layers
                className={`w-4 h-4 ${isWarning ? "text-yellow-400" : "text-amber-400"}`}
              />
            </div>
            <div className="text-left">
              <div className="text-[0.625rem] font-bold uppercase tracking-wider text-gray-500">
                Blind Level
              </div>
              <div className="text-sm font-mono font-bold text-white">
                Level {currentLevel}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Countdown */}
            <AnimatePresence>
              {isWarning && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: [1, 1.15, 1] }}
                  transition={{ repeat: Infinity, duration: 1.2 }}
                >
                  <AlertTriangle className="w-4 h-4 text-yellow-400" />
                </motion.div>
              )}
            </AnimatePresence>

            {collapsed ? (
              <ChevronDown className="w-4 h-4 text-gray-600" />
            ) : (
              <ChevronUp className="w-4 h-4 text-gray-600" />
            )}
          </div>
        </button>

        {/* Expandable content */}
        <AnimatePresence>
          {!collapsed && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div
                className="px-3 pb-3 space-y-3"
                style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}
              >
                {/* Current blinds */}
                <div className="pt-3">
                  <div className="text-[0.5625rem] font-bold uppercase tracking-wider text-gray-600 mb-1.5">
                    Current Blinds
                  </div>
                  <div className="flex items-center gap-2">
                    <div
                      className="flex-1 rounded-lg px-3 py-2 text-center"
                      style={{
                        background: "rgba(212,175,55,0.04)",
                        border: "1px solid rgba(212,175,55,0.1)",
                      }}
                    >
                      <div className="text-[0.5rem] text-gray-600 uppercase">SB</div>
                      <div className="text-sm font-mono font-bold" style={{ color: "#ffd700" }}>{sb}</div>
                    </div>
                    <div className="text-gray-700 font-bold">/</div>
                    <div
                      className="flex-1 rounded-lg px-3 py-2 text-center"
                      style={{
                        background: "rgba(212,175,55,0.04)",
                        border: "1px solid rgba(212,175,55,0.1)",
                      }}
                    >
                      <div className="text-[0.5rem] text-gray-600 uppercase">BB</div>
                      <div className="text-sm font-mono font-bold" style={{ color: "#ffd700" }}>{bb}</div>
                    </div>
                    {ante > 0 && (
                      <>
                        <div className="text-gray-700 font-bold">+</div>
                        <div
                          className="rounded-lg px-3 py-2 text-center"
                          style={{
                            background: "rgba(234,179,8,0.06)",
                            border: "1px solid rgba(234,179,8,0.12)",
                          }}
                        >
                          <div className="text-[0.5rem] text-gray-600 uppercase">Ante</div>
                          <div className="text-sm font-mono font-bold" style={{ color: "#ffd700" }}>{ante}</div>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Timer */}
                <div>
                  <div className="text-[0.5625rem] font-bold uppercase tracking-wider text-gray-600 mb-1.5">
                    Next Level In
                  </div>
                  <div
                    className="relative rounded-lg px-3 py-2.5 flex items-center gap-2 overflow-hidden"
                    style={{
                      background: isWarning
                        ? "rgba(234,179,8,0.06)"
                        : "rgba(255,255,255,0.02)",
                      border: `1px solid ${isWarning ? "rgba(234,179,8,0.15)" : "rgba(255,255,255,0.06)"}`,
                    }}
                  >
                    {/* Pulsing background when warning */}
                    {isWarning && (
                      <motion.div
                        className="absolute inset-0"
                        animate={{ opacity: [0, 0.1, 0] }}
                        transition={{ repeat: Infinity, duration: 1 }}
                        style={{ background: "rgba(234,179,8,0.2)" }}
                      />
                    )}
                    <Clock
                      className={`w-4 h-4 shrink-0 ${isWarning ? "text-yellow-400" : "text-gray-500"}`}
                    />
                    <span
                      className={`text-lg font-mono font-black ${
                        isWarning ? "text-yellow-300" : "text-white"
                      }`}
                      style={
                        isWarning
                          ? { textShadow: "0 0 12px rgba(234,179,8,0.4)" }
                          : undefined
                      }
                    >
                      {formatTime(timeLeft)}
                    </span>
                  </div>
                </div>

                {/* Next level preview */}
                {nextLevel && (
                  <div>
                    <div className="text-[0.5625rem] font-bold uppercase tracking-wider text-gray-600 mb-1.5">
                      Next Level ({nextLevel.level})
                    </div>
                    <div
                      className="rounded-lg px-3 py-2 flex items-center gap-3"
                      style={{
                        background: "rgba(255,255,255,0.03)",
                        border: "1px solid rgba(255,255,255,0.08)",
                      }}
                    >
                      <span className="text-[0.6875rem] font-mono" style={{ color: "rgba(255,215,0,0.7)" }}>
                        {nextLevel.sb}/{nextLevel.bb}
                      </span>
                      {nextLevel.ante > 0 && (
                        <span className="text-[0.625rem] font-mono text-gray-500">
                          +{nextLevel.ante} ante
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* Full schedule preview (first few levels) */}
                {blindSchedule && blindSchedule.length > 0 && (
                  <div>
                    <div className="text-[0.5625rem] font-bold uppercase tracking-wider text-gray-600 mb-1.5">
                      Schedule
                    </div>
                    <div className="space-y-0.5 max-h-28 overflow-y-auto custom-scrollbar">
                      {blindSchedule.map((entry) => (
                        <div
                          key={entry.level}
                          className={`flex items-center justify-between text-[0.625rem] px-2 py-1 rounded ${
                            entry.level === currentLevel
                              ? "bg-amber-500/10 border border-amber-500/20"
                              : entry.level < currentLevel
                                ? "opacity-40"
                                : ""
                          }`}
                        >
                          <span
                            className={`font-mono ${
                              entry.level === currentLevel
                                ? "text-amber-300 font-bold"
                                : "text-gray-500"
                            }`}
                          >
                            Lv.{entry.level}
                          </span>
                          <span
                            className={`font-mono ${
                              entry.level === currentLevel
                                ? "text-white font-bold"
                                : "text-gray-600"
                            }`}
                          >
                            {entry.sb}/{entry.bb}
                            {entry.ante > 0 && (
                              <span className="text-gray-500 ml-1">+{entry.ante}</span>
                            )}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
