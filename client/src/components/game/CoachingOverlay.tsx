import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Brain, TrendingUp, TrendingDown, Coins } from "lucide-react";

interface CoachingOverlayProps {
  enabled: boolean;
  holeCards: string[];
  communityCards: string[];
  pot: number;
  currentBet: number;
  position: string;
  phase: string;
  isHeroTurn: boolean;
  onToggle: () => void;
}

interface CoachingResult {
  action: string;
  ev: number;
  confidence: number;
  explanation: string;
}

export function CoachingOverlay({
  enabled,
  holeCards,
  communityCards,
  pot,
  currentBet,
  position,
  phase,
  isHeroTurn,
  onToggle,
}: CoachingOverlayProps) {
  const [result, setResult] = useState<CoachingResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const lastAnalyzedRef = useRef<{ phase: string; pot: number; isHeroTurn: boolean }>({
    phase: "",
    pot: 0,
    isHeroTurn: false,
  });

  useEffect(() => {
    if (!enabled || !isHeroTurn || !holeCards || holeCards.length < 2) {
      setResult(null);
      return;
    }

    // Guard: skip if the same decision point was already analyzed
    const current = { phase, pot, isHeroTurn };
    const last = lastAnalyzedRef.current;
    if (
      last.phase === current.phase &&
      last.pot === current.pot &&
      last.isHeroTurn === current.isHeroTurn
    ) {
      return;
    }
    lastAnalyzedRef.current = current;

    let cancelled = false;
    setLoading(true);
    setError("");

    fetch("/api/coaching/live-analysis", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ holeCards, communityCards, pot, currentBet, position, phase }),
    })
      .then((r) => {
        if (!r.ok) throw new Error("Analysis failed");
        return r.json();
      })
      .then((data) => {
        if (!cancelled) setResult(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [enabled, isHeroTurn, holeCards?.join(","), communityCards?.join(","), pot, currentBet, position, phase]);

  if (!enabled) return null;

  const actionColors: Record<string, string> = {
    RAISE: "text-green-400 bg-green-500/15 border-green-500/30",
    CALL: "text-yellow-400 bg-yellow-500/15 border-yellow-500/30",
    FOLD: "text-red-400 bg-red-500/15 border-red-500/30",
  };

  return (
    <AnimatePresence>
      {(isHeroTurn || result) && (
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 20 }}
          transition={{ duration: 0.3 }}
          className="fixed top-20 right-4 z-50 w-64"
        >
          <div className="rounded-lg bg-black/80 backdrop-blur-xl border border-primary/20 p-3 shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <Brain className="w-4 h-4 text-primary" />
                <span className="text-[10px] font-bold uppercase tracking-wider text-primary">
                  Live Coach
                </span>
              </div>
              <span className="flex items-center gap-1 text-[9px] font-medium text-amber-400/70">
                <Coins className="w-3 h-3" />
                Premium 50/hand
              </span>
            </div>

            {loading && (
              <div className="flex items-center gap-2 py-3">
                <div className="w-3 h-3 border-2 border-primary/40 border-t-primary rounded-full animate-spin" />
                <span className="text-xs text-muted-foreground">Analyzing...</span>
              </div>
            )}

            {error && (
              <p className="text-xs text-red-400 py-2">{error}</p>
            )}

            {result && !loading && (
              <div className="space-y-2">
                {/* Action badge */}
                <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${actionColors[result.action] || "text-white bg-white/10 border-white/20"}`}>
                  {result.action}
                </div>

                {/* EV */}
                <div className="flex items-center gap-2">
                  {result.ev >= 0 ? (
                    <TrendingUp className="w-3.5 h-3.5 text-green-400" />
                  ) : (
                    <TrendingDown className="w-3.5 h-3.5 text-red-400" />
                  )}
                  <span className={`text-sm font-bold ${result.ev >= 0 ? "text-green-400" : "text-red-400"}`}>
                    {result.ev >= 0 ? "+" : ""}{result.ev} EV
                  </span>
                  <span className="text-[10px] text-muted-foreground ml-auto">
                    {result.confidence}% conf
                  </span>
                </div>

                {/* Explanation */}
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  {result.explanation}
                </p>
              </div>
            )}

            {!isHeroTurn && !loading && !result && (
              <p className="text-[11px] text-muted-foreground py-2">
                Waiting for your turn...
              </p>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
