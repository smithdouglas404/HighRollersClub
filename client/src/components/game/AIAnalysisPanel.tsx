import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Brain,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Lightbulb,
  Save,
  Loader2,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Target,
  XCircle,
} from "lucide-react";

interface AIAnalysisPanelProps {
  holeCards: any[];
  communityCards: any[];
  pot: number;
  position: string;
  onSave?: () => void;
}

interface AnalysisResult {
  rating: "OPTIMAL" | "SUBOPTIMAL";
  overallScore: number;
  evByAction: { action: string; ev: number }[];
  leaks: string[];
  recommendations: string[];
}

export function AIAnalysisPanel({
  holeCards,
  communityCards,
  pot,
  position,
  onSave,
}: AIAnalysisPanelProps) {
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [saved, setSaved] = useState(false);

  const fetchAnalysis = useCallback(async () => {
    if (!holeCards.length || loading) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/analyze-hand", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          holeCards,
          communityCards,
          pot,
          position,
        }),
      });

      if (!response.ok) {
        throw new Error("Analysis unavailable");
      }

      const data: AnalysisResult = await response.json();
      setAnalysis(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to analyze hand");
    } finally {
      setLoading(false);
    }
  }, [holeCards, communityCards, pot, position]);

  // Fetch analysis when cards change
  useEffect(() => {
    if (holeCards.length > 0) {
      fetchAnalysis();
    }
  }, [fetchAnalysis]);

  const handleSave = () => {
    setSaved(true);
    onSave?.();
    setTimeout(() => setSaved(false), 2000);
  };

  const isOptimal = analysis?.rating === "OPTIMAL";

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 200, damping: 25 }}
      className="w-full max-w-sm"
    >
      <div
        className="rounded-xl backdrop-blur-md overflow-hidden"
        style={{
          background: "linear-gradient(180deg, rgba(20,31,40,0.90) 0%, rgba(16,24,36,0.95) 100%)",
          border: "1px solid rgba(0,212,255,0.1)",
          boxShadow: "0 4px 30px rgba(0,0,0,0.4), 0 0 15px rgba(0,212,255,0.04)",
        }}
      >
        {/* Header */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="w-full flex items-center justify-between gap-2 px-4 py-3 hover:bg-white/[0.02] transition-colors"
        >
          <div className="flex items-center gap-2.5">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 relative"
              style={{
                background: "linear-gradient(135deg, rgba(139,92,246,0.15) 0%, rgba(59,130,246,0.1) 100%)",
                border: "1px solid rgba(139,92,246,0.25)",
              }}
            >
              <Brain className="w-4 h-4 text-purple-400" />
              {loading && (
                <motion.div
                  className="absolute inset-0 rounded-lg"
                  animate={{ opacity: [0.2, 0.5, 0.2] }}
                  transition={{ repeat: Infinity, duration: 1.5 }}
                  style={{ border: "1px solid rgba(139,92,246,0.4)" }}
                />
              )}
            </div>
            <div className="text-left">
              <span className="text-[0.625rem] font-bold uppercase tracking-wider text-gray-400">
                AI Hand Analysis
              </span>
              {analysis && (
                <div className="flex items-center gap-1.5 mt-0.5">
                  <div
                    className={`w-1.5 h-1.5 rounded-full ${
                      isOptimal ? "bg-green-400" : "bg-red-400"
                    }`}
                    style={{
                      boxShadow: `0 0 6px ${isOptimal ? "rgba(34,197,94,0.5)" : "rgba(239,68,68,0.5)"}`,
                    }}
                  />
                  <span
                    className={`text-[0.5625rem] font-bold uppercase tracking-wider ${
                      isOptimal ? "text-green-400" : "text-red-400"
                    }`}
                  >
                    {analysis.rating}
                  </span>
                </div>
              )}
            </div>
          </div>
          {collapsed ? (
            <ChevronUp className="w-4 h-4 text-gray-600" />
          ) : (
            <ChevronDown className="w-4 h-4 text-gray-600" />
          )}
        </button>

        {/* Content */}
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
                className="px-4 pb-4 space-y-4"
                style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}
              >
                {/* Loading state */}
                {loading && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex flex-col items-center gap-3 py-6"
                  >
                    <Loader2 className="w-6 h-6 text-purple-400 animate-spin" />
                    <span className="text-[0.6875rem] text-gray-500 font-medium">
                      Analyzing hand...
                    </span>
                  </motion.div>
                )}

                {/* Error state */}
                {error && !loading && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex items-center gap-2 rounded-lg px-3 py-2.5"
                    style={{
                      background: "rgba(239,68,68,0.06)",
                      border: "1px solid rgba(239,68,68,0.15)",
                    }}
                  >
                    <XCircle className="w-4 h-4 text-red-400 shrink-0" />
                    <span className="text-[0.6875rem] text-red-400/80">{error}</span>
                  </motion.div>
                )}

                {/* Analysis results */}
                {analysis && !loading && (
                  <>
                    {/* Rating badge */}
                    <motion.div
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.1 }}
                      className="flex items-center justify-between rounded-xl px-4 py-3"
                      style={{
                        background: isOptimal
                          ? "linear-gradient(135deg, rgba(34,197,94,0.08) 0%, rgba(16,185,129,0.04) 100%)"
                          : "linear-gradient(135deg, rgba(239,68,68,0.08) 0%, rgba(220,38,38,0.04) 100%)",
                        border: `1px solid ${isOptimal ? "rgba(34,197,94,0.2)" : "rgba(239,68,68,0.2)"}`,
                        boxShadow: `0 0 20px ${isOptimal ? "rgba(34,197,94,0.06)" : "rgba(239,68,68,0.06)"}`,
                      }}
                    >
                      <div className="flex items-center gap-2">
                        {isOptimal ? (
                          <Sparkles className="w-5 h-5 text-green-400" />
                        ) : (
                          <AlertTriangle className="w-5 h-5 text-red-400" />
                        )}
                        <div>
                          <div
                            className={`text-sm font-black uppercase tracking-wider ${
                              isOptimal ? "text-green-300" : "text-red-300"
                            }`}
                          >
                            {analysis.rating}
                          </div>
                          <div className="text-[0.5625rem] text-gray-600">Play Rating</div>
                        </div>
                      </div>
                      <div
                        className={`text-2xl font-mono font-black ${
                          isOptimal ? "text-green-400" : "text-red-400"
                        }`}
                        style={{
                          textShadow: `0 0 15px ${isOptimal ? "rgba(34,197,94,0.3)" : "rgba(239,68,68,0.3)"}`,
                        }}
                      >
                        {analysis.overallScore}
                      </div>
                    </motion.div>

                    {/* EV by action */}
                    <div>
                      <div className="text-[0.5625rem] font-bold uppercase tracking-wider text-gray-600 mb-2">
                        Expected Value by Action
                      </div>
                      <div className="space-y-1">
                        {analysis.evByAction.map((ev, i) => (
                          <motion.div
                            key={ev.action}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.15 + i * 0.05 }}
                            className="flex items-center justify-between rounded-lg px-3 py-2"
                            style={{
                              background: "rgba(255,255,255,0.02)",
                              border: "1px solid rgba(255,255,255,0.04)",
                            }}
                          >
                            <div className="flex items-center gap-2">
                              <Target className="w-3 h-3 text-gray-600" />
                              <span className="text-[0.6875rem] font-bold text-gray-300 uppercase">
                                {ev.action}
                              </span>
                            </div>
                            <div className="flex items-center gap-1">
                              {ev.ev >= 0 ? (
                                <TrendingUp className="w-3 h-3 text-green-400" />
                              ) : (
                                <TrendingDown className="w-3 h-3 text-red-400" />
                              )}
                              <span
                                className={`text-xs font-mono font-black ${
                                  ev.ev >= 0 ? "text-green-400" : "text-red-400"
                                }`}
                              >
                                {ev.ev >= 0 ? "+" : ""}
                                {ev.ev.toFixed(2)}
                              </span>
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    </div>

                    {/* Leak Detection */}
                    {analysis.leaks.length > 0 && (
                      <div>
                        <div className="text-[0.5625rem] font-bold uppercase tracking-wider text-gray-600 mb-2">
                          Leak Detection
                        </div>
                        <div className="space-y-1">
                          {analysis.leaks.map((leak, i) => (
                            <motion.div
                              key={i}
                              initial={{ opacity: 0, x: -10 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: 0.25 + i * 0.05 }}
                              className="flex items-start gap-2 rounded-lg px-3 py-2"
                              style={{
                                background: "rgba(239,68,68,0.04)",
                                border: "1px solid rgba(239,68,68,0.1)",
                              }}
                            >
                              <AlertTriangle className="w-3 h-3 text-red-400/70 shrink-0 mt-0.5" />
                              <span className="text-[0.6875rem] text-red-300/80 leading-relaxed">
                                {leak}
                              </span>
                            </motion.div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Recommendations */}
                    {analysis.recommendations.length > 0 && (
                      <div>
                        <div className="text-[0.5625rem] font-bold uppercase tracking-wider text-gray-600 mb-2">
                          Recommendations
                        </div>
                        <div className="space-y-1">
                          {analysis.recommendations.map((rec, i) => (
                            <motion.div
                              key={i}
                              initial={{ opacity: 0, x: -10 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: 0.35 + i * 0.05 }}
                              className="flex items-start gap-2 rounded-lg px-3 py-2"
                              style={{
                                background: "rgba(0,212,255,0.03)",
                                border: "1px solid rgba(0,212,255,0.08)",
                              }}
                            >
                              <Lightbulb className="w-3 h-3 text-cyan-400/70 shrink-0 mt-0.5" />
                              <span className="text-[0.6875rem] text-cyan-300/80 leading-relaxed">
                                {rec}
                              </span>
                            </motion.div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Save button */}
                    {onSave && (
                      <motion.button
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.4 }}
                        whileHover={{ scale: 1.02, y: -1 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={handleSave}
                        disabled={saved}
                        className="w-full flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 font-bold text-[0.6875rem] uppercase tracking-wider transition-all"
                        style={{
                          background: saved
                            ? "rgba(34,197,94,0.1)"
                            : "linear-gradient(180deg, rgba(139,92,246,0.12) 0%, rgba(99,62,206,0.06) 100%)",
                          border: `1px solid ${saved ? "rgba(34,197,94,0.25)" : "rgba(139,92,246,0.2)"}`,
                          color: saved ? "#4ade80" : "#c4b5fd",
                          boxShadow: saved
                            ? "0 0 15px rgba(34,197,94,0.08)"
                            : "0 0 15px rgba(139,92,246,0.06)",
                        }}
                      >
                        {saved ? (
                          <>
                            <Sparkles className="w-3.5 h-3.5" />
                            Analysis Saved
                          </>
                        ) : (
                          <>
                            <Save className="w-3.5 h-3.5" />
                            Save Analysis
                          </>
                        )}
                      </motion.button>
                    )}
                  </>
                )}

                {/* Empty state - no cards */}
                {!analysis && !loading && !error && (
                  <div className="flex flex-col items-center gap-2 py-6">
                    <Brain className="w-6 h-6 text-gray-700" />
                    <span className="text-[0.6875rem] text-gray-600 text-center">
                      Play a hand to receive AI analysis
                    </span>
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
