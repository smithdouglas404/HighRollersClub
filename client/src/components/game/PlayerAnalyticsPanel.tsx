import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, ChevronUp, Activity, Eye, Crosshair, BarChart2, Hash } from "lucide-react";

interface PlayerStats {
  handsPlayed: number;
  potsWon: number;
  vpip: number;
  pfr: number;
  showdownCount: number;
}

interface PlayerAnalyticsPanelProps {
  stats: PlayerStats;
}

export function PlayerAnalyticsPanel({ stats }: PlayerAnalyticsPanelProps) {
  const [collapsed, setCollapsed] = useState(false);

  const winRate = stats.handsPlayed > 0
    ? Math.round((stats.potsWon / stats.handsPlayed) * 100)
    : 0;

  const showdownPct = stats.handsPlayed > 0
    ? Math.round((stats.showdownCount / stats.handsPlayed) * 100)
    : 0;

  const getWinRateColor = (rate: number) => {
    if (rate >= 40) return { text: "text-green-400", bar: "#22c55e", glow: "rgba(34,197,94,0.3)" };
    if (rate >= 25) return { text: "text-cyan-400", bar: "#06b6d4", glow: "rgba(0,240,255,0.3)" };
    if (rate >= 15) return { text: "text-yellow-400", bar: "#eab308", glow: "rgba(234,179,8,0.3)" };
    return { text: "text-red-400", bar: "#ef4444", glow: "rgba(239,68,68,0.3)" };
  };

  const getStatColor = (value: number, thresholds: { high: number; mid: number }) => {
    if (value >= thresholds.high) return "text-green-400";
    if (value >= thresholds.mid) return "text-cyan-400";
    if (value >= thresholds.mid / 2) return "text-yellow-400";
    return "text-red-400";
  };

  const winRateStyle = getWinRateColor(winRate);

  const analyticsData = [
    {
      icon: Activity,
      label: "Win Rate",
      value: `${winRate}%`,
      percentage: winRate,
      barColor: winRateStyle.bar,
      color: winRateStyle.text,
      tooltip: "Percentage of hands won",
    },
    {
      icon: Eye,
      label: "VPIP",
      value: `${stats.vpip}%`,
      percentage: stats.vpip,
      barColor: stats.vpip >= 20 && stats.vpip <= 35 ? "#06b6d4" : stats.vpip > 50 ? "#ef4444" : "#eab308",
      color: getStatColor(stats.vpip, { high: 20, mid: 15 }),
      tooltip: "Voluntarily put $ in pot",
    },
    {
      icon: Crosshair,
      label: "PFR",
      value: `${stats.pfr}%`,
      percentage: stats.pfr,
      barColor: stats.pfr >= 15 && stats.pfr <= 25 ? "#06b6d4" : stats.pfr > 35 ? "#ef4444" : "#eab308",
      color: getStatColor(stats.pfr, { high: 15, mid: 10 }),
      tooltip: "Pre-flop raise percentage",
    },
    {
      icon: BarChart2,
      label: "Showdown",
      value: `${showdownPct}%`,
      percentage: showdownPct,
      barColor: showdownPct >= 25 && showdownPct <= 40 ? "#06b6d4" : "#eab308",
      color: "text-gray-300",
      tooltip: "Went to showdown",
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ type: "spring", stiffness: 200, damping: 25 }}
      className="fixed bottom-[160px] right-4 z-40"
    >
      <div
        className="rounded-xl backdrop-blur-md overflow-hidden"
        style={{
          background: "linear-gradient(180deg, rgba(8,16,24,0.92) 0%, rgba(4,10,16,0.96) 100%)",
          border: "1px solid rgba(0,240,255,0.1)",
          boxShadow: "0 4px 30px rgba(0,0,0,0.4), 0 0 15px rgba(0,240,255,0.04)",
          minWidth: 210,
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
                background: "rgba(168,85,247,0.1)",
                border: "1px solid rgba(168,85,247,0.2)",
              }}
            >
              <Activity className="w-3.5 h-3.5 text-purple-400" />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
              Player Analytics
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
                className="px-3 pb-3 space-y-2"
                style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}
              >
                {/* Stat rows with bars */}
                {analyticsData.map((stat, i) => {
                  const Icon = stat.icon;
                  return (
                    <motion.div
                      key={stat.label}
                      initial={{ opacity: 0, x: 10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.06 }}
                      className="pt-1.5"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-1.5">
                          <Icon className="w-3 h-3 text-gray-600" />
                          <span className="text-[9px] text-gray-500 uppercase tracking-wider font-bold">
                            {stat.label}
                          </span>
                        </div>
                        <span className={`text-xs font-mono font-black ${stat.color}`}>
                          {stat.value}
                        </span>
                      </div>
                      {/* Progress bar */}
                      <div
                        className="h-1.5 rounded-full overflow-hidden"
                        style={{
                          background: "rgba(255,255,255,0.04)",
                        }}
                      >
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${Math.min(stat.percentage, 100)}%` }}
                          transition={{ duration: 0.8, delay: 0.1 + i * 0.06, ease: "easeOut" }}
                          className="h-full rounded-full"
                          style={{
                            background: stat.barColor,
                            boxShadow: `0 0 8px ${stat.barColor}50`,
                          }}
                        />
                      </div>
                    </motion.div>
                  );
                })}

                {/* Hands played counter */}
                <div
                  className="flex items-center justify-between rounded-lg px-2.5 py-2 mt-1"
                  style={{
                    background: "rgba(255,255,255,0.02)",
                    border: "1px solid rgba(255,255,255,0.04)",
                  }}
                >
                  <div className="flex items-center gap-1.5">
                    <Hash className="w-3 h-3 text-gray-600" />
                    <span className="text-[9px] text-gray-600 uppercase tracking-wider font-bold">
                      Hands Played
                    </span>
                  </div>
                  <span className="text-xs font-mono font-bold text-white">
                    {stats.handsPlayed}
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
