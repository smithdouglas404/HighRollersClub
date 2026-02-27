import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { History, ChevronLeft, Trophy, Coins, Clock, ExternalLink, Download } from "lucide-react";

interface HandRecord {
  id: string;
  handNumber: number;
  potTotal: number;
  winnerIds: string[] | null;
  summary: any;
  commitmentHash: string | null;
  createdAt: string;
}

export function HandHistoryDrawer({ tableId }: { tableId: string }) {
  const [, navigate] = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const [hands, setHands] = useState<HandRecord[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchHands = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/tables/${tableId}/hands?limit=20`);
      if (res.ok) {
        setHands(await res.json());
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [tableId]);

  useEffect(() => {
    if (isOpen) {
      fetchHands();
    }
  }, [isOpen, fetchHands]);

  return (
    <>
      {/* Toggle button */}
      <AnimatePresence>
        {!isOpen && (
          <motion.button
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setIsOpen(true)}
            className="fixed left-4 bottom-32 z-40 glass rounded-full p-3 border border-white/10 hover:border-amber-500/30 transition-all shadow-lg"
          >
            <History className="w-5 h-5 text-amber-400" />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Drawer */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ x: -320, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -320, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="fixed left-0 top-0 bottom-0 w-72 z-40 flex flex-col"
            style={{
              background: "rgba(5, 10, 20, 0.95)",
              borderRight: "1px solid rgba(255,255,255,0.05)",
              backdropFilter: "blur(20px)",
            }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
              <div className="flex items-center gap-2">
                <History className="w-4 h-4 text-amber-400" />
                <span className="text-xs font-bold uppercase tracking-wider text-white">Hand History</span>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 hover:bg-white/5 rounded transition-colors"
              >
                <ChevronLeft className="w-4 h-4 text-gray-500" />
              </button>
            </div>

            {/* Hand list */}
            <div className="flex-1 overflow-y-auto py-2 scrollbar-thin">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="spinner spinner-md" />
                </div>
              ) : hands.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center px-4">
                  <History className="w-8 h-8 text-gray-700 mb-2" />
                  <p className="text-[0.625rem] text-gray-600">No hands played yet</p>
                  <p className="text-[0.5625rem] text-gray-700">History will appear here as hands complete</p>
                </div>
              ) : (
                hands.map((hand) => {
                  const winners = hand.summary?.winners || [];
                  const players = hand.summary?.players || [];
                  const playerMap = new Map<string, any>(players.map((p: any) => [p.id, p]));

                  return (
                    <motion.div
                      key={hand.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="px-3 py-2 mx-2 mb-1 rounded-lg hover:bg-white/[0.03] transition-colors cursor-pointer group"
                      onClick={() => navigate(`/hands/${hand.id}`)}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-bold text-white">
                          Hand #{hand.handNumber}
                        </span>
                        <ExternalLink className="w-3 h-3 text-gray-700 group-hover:text-gray-400 transition-colors" />
                      </div>
                      <div className="flex items-center gap-3 text-[0.625rem] text-gray-500">
                        <span className="flex items-center gap-1">
                          <Coins className="w-2.5 h-2.5 text-amber-500/60" />
                          {(hand.potTotal || 0).toLocaleString()}
                        </span>
                        {winners.length > 0 && (
                          <span className="flex items-center gap-1 text-green-500/80">
                            <Trophy className="w-2.5 h-2.5" />
                            {playerMap.get(winners[0].playerId)?.displayName || "Winner"}
                          </span>
                        )}
                        <span className="flex items-center gap-1 ml-auto text-gray-600">
                          <Clock className="w-2.5 h-2.5" />
                          {new Date(hand.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                      {hand.commitmentHash && (
                        <div className="mt-1">
                          <span className="text-[0.5rem] text-green-500/50 font-mono">
                            {hand.commitmentHash.slice(0, 16)}...
                          </span>
                        </div>
                      )}
                    </motion.div>
                  );
                })
              )}
            </div>

            {/* Footer: Export + Refresh */}
            {hands.length > 0 && (
              <div className="px-4 py-2 border-t border-white/5 space-y-1">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      const json = JSON.stringify(hands.map(h => ({
                        id: h.id,
                        handNumber: h.handNumber,
                        potTotal: h.potTotal,
                        winnerIds: h.winnerIds,
                        commitmentHash: h.commitmentHash,
                        createdAt: h.createdAt,
                        summary: h.summary,
                      })), null, 2);
                      const blob = new Blob([json], { type: "application/json" });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement("a");
                      a.href = url; a.download = `hand-history-${tableId.slice(0,8)}.json`;
                      a.click(); URL.revokeObjectURL(url);
                    }}
                    className="flex-1 flex items-center justify-center gap-1 text-[0.625rem] font-bold text-amber-500 hover:text-amber-300 transition-colors py-1"
                  >
                    <Download className="w-3 h-3" /> JSON
                  </button>
                  <div className="w-px h-3 bg-white/10" />
                  <button
                    onClick={() => {
                      const header = "Hand #,Pot,Winner,Commitment Hash,Time\n";
                      const rows = hands.map(h => {
                        const winners = h.summary?.winners || [];
                        const players = h.summary?.players || [];
                        const pMap = new Map<string, any>(players.map((p: any) => [p.id, p]));
                        const winnerName = winners[0] ? (pMap.get(winners[0].playerId)?.displayName || "Unknown") : "";
                        return `${h.handNumber},${h.potTotal || 0},"${winnerName}",${h.commitmentHash || ""},${h.createdAt}`;
                      }).join("\n");
                      const blob = new Blob([header + rows], { type: "text/csv" });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement("a");
                      a.href = url; a.download = `hand-history-${tableId.slice(0,8)}.csv`;
                      a.click(); URL.revokeObjectURL(url);
                    }}
                    className="flex-1 flex items-center justify-center gap-1 text-[0.625rem] font-bold text-amber-500 hover:text-amber-300 transition-colors py-1"
                  >
                    <Download className="w-3 h-3" /> CSV
                  </button>
                </div>
                <button
                  onClick={fetchHands}
                  disabled={loading}
                  className="w-full text-center text-[0.625rem] font-bold text-gray-500 hover:text-gray-300 transition-colors py-1"
                >
                  {loading ? "Loading..." : "Refresh"}
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
