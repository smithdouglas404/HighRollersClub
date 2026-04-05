import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, ChevronUp, BarChart3, Users, Layers, Coins, TrendingUp } from "lucide-react";

interface TournamentStatsPanelProps {
  chips: number;
  playersRemaining: number;
  currentBlindLevel: number;
  sb: number;
  bb: number;
  ante: number;
  totalPlayers: number;
  startingChips?: number;
}

export function TournamentStatsPanel({
  chips,
  playersRemaining,
  currentBlindLevel,
  sb,
  bb,
  ante,
  totalPlayers,
  startingChips = 1500,
}: TournamentStatsPanelProps) {
  const [collapsed, setCollapsed] = useState(false);

  const avgStack = totalPlayers > 0 && playersRemaining > 0
    ? Math.round((totalPlayers * startingChips) / playersRemaining)
    : 0;
  const bbCount = bb > 0 ? Math.round(chips / bb) : 0;
  const stackRatio = avgStack > 0 ? (chips / avgStack) : 0;

  const getStackColor = () => {
    if (stackRatio > 1.0) return { text: "text-green-400", glow: "rgba(34,197,94,0.3)" };
    if (stackRatio >= 0.5) return { text: "text-amber-400", glow: "rgba(212,175,55,0.3)" };
    return { text: "text-red-400", glow: "rgba(239,68,68,0.3)" };
  };

  const stackColor = getStackColor();

  const stats = [
    {
      icon: Coins,
      label: "Your Stack",
      value: chips.toLocaleString(),
      sub: `${bbCount} BB`,
      color: stackColor.text,
      highlight: true,
    },
    {
      icon: TrendingUp,
      label: "Avg Stack",
      value: avgStack.toLocaleString(),
      sub: stackRatio >= 1 ? "Above avg" : "Below avg",
      color: "text-gray-300",
      highlight: false,
    },
    {
      icon: Users,
      label: "Players Left",
      value: `${playersRemaining}/${totalPlayers}`,
      sub: `${Math.round((playersRemaining / Math.max(totalPlayers, 1)) * 100)}% remain`,
      color: "text-gray-300",
      highlight: false,
    },
    {
      icon: Layers,
      label: "Blind Level",
      value: `Lv.${currentBlindLevel}`,
      sub: `${sb}/${bb}${ante > 0 ? ` +${ante}` : ""}`,
      color: "text-amber-400",
      highlight: false,
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ type: "spring", stiffness: 200, damping: 25 }}
      className="fixed bottom-[160px] left-4 z-40"
    >
      <div
        className="rounded-xl backdrop-blur-md overflow-hidden"
        style={{
          background: "linear-gradient(180deg, rgba(20,31,40,0.88) 0%, rgba(16,24,36,0.92) 100%)",
          border: "1px solid rgba(212,175,55,0.1)",
          boxShadow: "0 4px 30px rgba(0,0,0,0.4), 0 0 15px rgba(212,175,55,0.04)",
          minWidth: 200,
        }}
      >
        {/* Header */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="w-full flex items-center justify-between gap-2 px-3 py-2.5 hover:bg-white/[0.02] transition-colors"
        >
          <div className="flex items-center gap-2">
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
              style={{
                background: "rgba(212,175,55,0.08)",
                border: "1px solid rgba(212,175,55,0.15)",
              }}
            >
              <BarChart3 className="w-3.5 h-3.5 text-amber-400" />
            </div>
            <span className="text-[0.625rem] font-bold uppercase tracking-wider text-gray-400">
              Tournament Stats
            </span>
          </div>
          {collapsed ? (
            <ChevronUp className="w-3.5 h-3.5 text-gray-600" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5 text-gray-600" />
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
                className="px-3 pb-3 space-y-1.5"
                style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}
              >
                {stats.map((stat, i) => {
                  const Icon = stat.icon;
                  return (
                    <motion.div
                      key={stat.label}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className={`flex items-center gap-2.5 rounded-lg px-2.5 py-2 ${
                        stat.highlight ? "mt-1.5" : ""
                      }`}
                      style={
                        stat.highlight
                          ? {
                              background: `linear-gradient(135deg, ${stackColor.glow.replace("0.3", "0.06")} 0%, transparent 100%)`,
                              border: `1px solid ${stackColor.glow.replace("0.3", "0.12")}`,
                            }
                          : {
                              background: "rgba(255,255,255,0.01)",
                            }
                      }
                    >
                      <Icon className={`w-3.5 h-3.5 ${stat.color} shrink-0 opacity-70`} />
                      <div className="flex-1 min-w-0">
                        <div className="text-[0.5625rem] text-gray-600 uppercase tracking-wider font-bold">
                          {stat.label}
                        </div>
                        <div className={`text-sm font-mono font-bold ${stat.color}`}>
                          {stat.value}
                        </div>
                      </div>
                      <div className="text-[0.5625rem] text-gray-600 font-mono shrink-0">
                        {stat.sub}
                      </div>
                    </motion.div>
                  );
                })}

                {/* Commission / Rake display */}
                <div
                  className="flex items-center justify-between rounded-lg px-2.5 py-1.5 mt-1"
                  style={{
                    background: "rgba(168,85,247,0.03)",
                    border: "1px solid rgba(168,85,247,0.08)",
                  }}
                >
                  <span className="text-[0.5625rem] text-gray-600 uppercase tracking-wider font-bold">
                    Commission
                  </span>
                  <span className="text-[0.625rem] font-mono text-purple-400/70">
                    Standard
                  </span>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
