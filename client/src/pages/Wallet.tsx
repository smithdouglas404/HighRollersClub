import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/hooks/use-toast";
import { useWallet, type Transaction } from "@/lib/wallet-context";
import {
  Coins, Gift, ArrowDownRight, ArrowUpRight, Loader2,
  Clock, Filter, TrendingUp, Sparkles, ChevronDown, RefreshCw, Download,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────

type FilterType = "all" | "bonus" | "buy_in" | "cashout" | "purchase" | "prize";

const FILTER_OPTIONS: { key: FilterType; label: string }[] = [
  { key: "all", label: "All" },
  { key: "bonus", label: "Bonuses" },
  { key: "buy_in", label: "Buy-ins" },
  { key: "cashout", label: "Cashouts" },
  { key: "purchase", label: "Purchases" },
  { key: "prize", label: "Winnings" },
];

// ── Helpers ───────────────────────────────────────────────────────────

function getTypeIcon(type: string) {
  switch (type) {
    case "bonus":
    case "daily_bonus":
      return Gift;
    case "buy_in":
    case "purchase":
      return ArrowDownRight;
    case "cashout":
    case "prize":
      return ArrowUpRight;
    default:
      return Coins;
  }
}

function getTypeColor(type: string) {
  switch (type) {
    case "bonus":
    case "daily_bonus":
      return "text-purple-400";
    case "buy_in":
    case "purchase":
      return "text-red-400";
    case "cashout":
    case "prize":
      return "text-green-400";
    default:
      return "text-amber-400";
  }
}

function matchesFilter(type: string, filter: FilterType): boolean {
  if (filter === "all") return true;
  if (filter === "bonus") return type === "bonus" || type === "daily_bonus";
  if (filter === "buy_in") return type === "buy_in";
  if (filter === "cashout") return type === "cashout";
  if (filter === "purchase") return type === "purchase";
  if (filter === "prize") return type === "prize" || type === "winnings";
  return false;
}

// ── Mini Balance Chart (SVG) ──────────────────────────────────────────
function BalanceChart({ transactions }: { transactions: Transaction[] }) {
  const points = useMemo(() => {
    // Take last 20 transactions, ordered oldest -> newest
    const recent = [...transactions].reverse().slice(-20);
    if (recent.length < 2) return null;

    const balances = recent.map((t) => t.balanceAfter);
    const min = Math.min(...balances);
    const max = Math.max(...balances);
    const range = max - min || 1;

    const width = 100;
    const height = 100;
    const padding = 5;
    const usableW = width - padding * 2;
    const usableH = height - padding * 2;

    const coords = balances.map((b, i) => ({
      x: padding + (i / (balances.length - 1)) * usableW,
      y: padding + usableH - ((b - min) / range) * usableH,
    }));

    const linePath = coords
      .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
      .join(" ");

    // Gradient fill area
    const areaPath =
      linePath +
      ` L ${coords[coords.length - 1].x.toFixed(1)} ${(height - padding).toFixed(1)}` +
      ` L ${coords[0].x.toFixed(1)} ${(height - padding).toFixed(1)} Z`;

    return { linePath, areaPath, coords, min, max };
  }, [transactions]);

  if (!points) {
    return (
      <div className="flex items-center justify-center h-full text-gray-600 text-xs">
        Not enough data to display chart
      </div>
    );
  }

  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-full">
      <defs>
        <linearGradient id="balanceGradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgb(0, 240, 255)" stopOpacity="0.3" />
          <stop offset="100%" stopColor="rgb(0, 240, 255)" stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <path d={points.areaPath} fill="url(#balanceGradient)" />
      <path
        d={points.linePath}
        fill="none"
        stroke="rgb(0, 240, 255)"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
      {/* End dot */}
      {points.coords.length > 0 && (
        <circle
          cx={points.coords[points.coords.length - 1].x}
          cy={points.coords[points.coords.length - 1].y}
          r="2"
          fill="rgb(0, 240, 255)"
          className="drop-shadow-[0_0_4px_rgba(0,240,255,0.6)]"
        />
      )}
    </svg>
  );
}

// ── Animated Number ───────────────────────────────────────────────────
function AnimatedBalance({ value }: { value: number }) {
  const [displayed, setDisplayed] = useState(value);

  useEffect(() => {
    const start = displayed;
    const diff = value - start;
    if (diff === 0) return;
    const duration = 600;
    const startTime = performance.now();

    function tick(now: number) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayed(Math.round(start + diff * eased));
      if (progress < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return <>{displayed.toLocaleString()}</>;
}

// ── Main Page ─────────────────────────────────────────────────────────
export default function Wallet() {
  const { refreshUser } = useAuth();
  const { toast } = useToast();

  const {
    balance, canClaim, claiming, bonusAmount, hasElitePass, timeLeft,
    claimDailyBonus, transactions, loadingTransactions: loadingTx,
    hasMore, loadMore, refreshTransactions, error,
  } = useWallet();

  const [filter, setFilter] = useState<FilterType>("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const exportCSV = () => {
    const header = "Date,Type,Amount,Balance After,Description\n";
    const rows = filtered.map(t =>
      `${new Date(t.createdAt).toISOString()},${t.type},${t.amount},${t.balanceAfter},"${(t.description || t.type.replace(/_/g, " ")).replace(/"/g, '""')}"`
    ).join("\n");
    const blob = new Blob([header + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `transactions_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleClaimDaily = async () => {
    const result = await claimDailyBonus();
    if (result.success) {
      toast({ title: "Daily Bonus Claimed!", description: `+${result.bonus!.toLocaleString()} chips` });
      await refreshUser();
    } else {
      toast({ title: "Error", description: error || "Failed to claim", variant: "destructive" });
    }
  };

  // ── Filter transactions ────────────────────────────────────────────
  const filtered = useMemo(
    () => transactions.filter((t) => {
      if (!matchesFilter(t.type, filter)) return false;
      if (startDate) {
        const txDate = new Date(t.createdAt);
        if (txDate < new Date(startDate)) return false;
      }
      if (endDate) {
        const txDate = new Date(t.createdAt);
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        if (txDate > end) return false;
      }
      return true;
    }),
    [transactions, filter, startDate, endDate],
  );

  // ── Render ─────────────────────────────────────────────────────────
  return (
    <DashboardLayout title="Wallet">
      <div className="px-4 sm:px-8 pb-8 space-y-6 max-w-5xl mx-auto">
        {/* ── Balance Hero ──────────────────────────────────────────── */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.5 }}
          className="rounded-2xl bg-white/[0.03] border border-white/[0.06] p-6 sm:p-8 relative overflow-hidden"
        >
          {/* Background glow */}
          <div className="absolute -top-20 -right-20 w-60 h-60 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
            {/* Left — balance display */}
            <div className="space-y-1">
              <p className="text-xs text-gray-500 uppercase tracking-widest font-medium flex items-center gap-1.5">
                <Coins className="w-3.5 h-3.5 text-amber-500" />
                Total Balance
              </p>
              <div className="flex items-baseline gap-2">
                <span className="text-4xl sm:text-5xl font-display font-bold gold-text tabular-nums">
                  <AnimatedBalance value={balance} />
                </span>
                <span className="text-sm text-amber-600/70 font-semibold uppercase tracking-wider">chips</span>
              </div>
            </div>

            {/* Right — daily bonus */}
            <div className="flex flex-col items-start sm:items-end gap-2">
              {!canClaim && timeLeft ? (
                <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                  <Clock className="w-4 h-4 text-gray-500" />
                  <div>
                    <p className="text-[10px] text-gray-500 uppercase tracking-wider">Next bonus in</p>
                    <p className="text-sm font-bold text-cyan-400 tabular-nums">{timeLeft}</p>
                  </div>
                </div>
              ) : (
                <motion.button
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={handleClaimDaily}
                  disabled={claiming}
                  className="flex items-center gap-2 px-5 py-3 rounded-xl font-bold text-sm uppercase tracking-wider
                    bg-gradient-to-r from-green-500/20 to-emerald-500/20 text-green-400
                    border border-green-500/20 hover:border-green-500/40
                    shadow-[0_0_20px_rgba(34,197,94,0.1)] hover:shadow-[0_0_30px_rgba(34,197,94,0.15)]
                    transition-all disabled:opacity-50"
                >
                  {claiming ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Gift className="w-4 h-4" />
                  )}
                  Claim Daily Bonus
                </motion.button>
              )}
              <div className="flex items-center gap-1.5 text-[10px] text-gray-600">
                <Sparkles className="w-3 h-3 text-amber-500/60" />
                <span>+{bonusAmount.toLocaleString()} chips daily reward{hasElitePass ? " (Elite Pass Active)" : " (2x with Elite Pass)"}</span>
              </div>
            </div>
          </div>
        </motion.div>

        {/* ── Balance Chart ─────────────────────────────────────────── */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="rounded-2xl bg-white/[0.03] border border-white/[0.06] p-5 sm:p-6"
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-cyan-500/70" />
              Balance History
            </h2>
            {transactions.length >= 2 && (
              <div className="flex items-center gap-2 text-[10px] text-gray-600">
                <span>Last {Math.min(transactions.length, 20)} transactions</span>
              </div>
            )}
          </div>
          <div className="h-32 sm:h-40">
            <BalanceChart transactions={transactions} />
          </div>
          {/* Min/Max labels */}
          {transactions.length >= 2 && (
            <div className="flex justify-between mt-2 text-[10px] text-gray-600 tabular-nums">
              <span>
                Low:{" "}
                {Math.min(
                  ...[...transactions].reverse().slice(-20).map((t) => t.balanceAfter),
                ).toLocaleString()}
              </span>
              <span>
                High:{" "}
                {Math.max(
                  ...[...transactions].reverse().slice(-20).map((t) => t.balanceAfter),
                ).toLocaleString()}
              </span>
            </div>
          )}
        </motion.div>

        {/* ── Transaction History ───────────────────────────────────── */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="rounded-2xl bg-white/[0.03] border border-white/[0.06] p-5 sm:p-6"
        >
          {/* Header + filters */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
            <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
              <Filter className="w-4 h-4 text-cyan-500/70" />
              Transaction History
              <button
                onClick={() => refreshTransactions()}
                className="p-1 rounded-md hover:bg-white/[0.05] transition-colors"
                title="Refresh transactions"
              >
                <RefreshCw className="w-3.5 h-3.5 text-gray-500 hover:text-cyan-400 transition-colors" />
              </button>
              <button
                onClick={exportCSV}
                className="p-1 rounded-md hover:bg-white/[0.05] transition-colors"
                title="Export as CSV"
              >
                <Download className="w-3.5 h-3.5 text-gray-500 hover:text-green-400 transition-colors" />
              </button>
            </h2>
            <div className="flex flex-wrap items-center gap-1.5">
              {FILTER_OPTIONS.map((opt) => (
                <button
                  key={opt.key}
                  onClick={() => setFilter(opt.key)}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-semibold uppercase tracking-wider transition-all border ${
                    filter === opt.key
                      ? "bg-cyan-500/15 text-cyan-400 border-cyan-500/25"
                      : "bg-white/[0.02] text-gray-500 border-white/[0.05] hover:text-gray-300 hover:bg-white/[0.05]"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
              <span className="text-[9px] text-gray-600 ml-1">|</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="px-2 py-1 rounded-lg text-[10px] text-gray-400 bg-white/[0.02] border border-white/[0.05] outline-none focus:border-cyan-500/25 transition-all"
                title="From date"
              />
              <span className="text-[9px] text-gray-600">to</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="px-2 py-1 rounded-lg text-[10px] text-gray-400 bg-white/[0.02] border border-white/[0.05] outline-none focus:border-cyan-500/25 transition-all"
                title="To date"
              />
              {(startDate || endDate) && (
                <button
                  onClick={() => { setStartDate(""); setEndDate(""); }}
                  className="text-[9px] text-red-400 hover:text-red-300 transition-colors"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          {/* Transaction list */}
          {loadingTx ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-6 h-6 text-cyan-500/50 animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-600">
              <Coins className="w-10 h-10 mb-3 opacity-30" />
              <p className="text-sm font-medium">No transactions found</p>
              <p className="text-xs text-gray-700 mt-1">
                {filter !== "all"
                  ? "Try a different filter."
                  : "Your transaction history will appear here."}
              </p>
            </div>
          ) : (
            <div className="space-y-1">
              <AnimatePresence mode="popLayout">
                {filtered.map((tx, i) => {
                  const Icon = getTypeIcon(tx.type);
                  const isPositive = tx.amount > 0;
                  return (
                    <motion.div
                      key={tx.id}
                      layout
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.2, delay: i * 0.02 }}
                      className="flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-white/[0.02] transition-colors group"
                    >
                      {/* Icon */}
                      <div
                        className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                          isPositive
                            ? "bg-green-500/10 border border-green-500/15"
                            : "bg-red-500/10 border border-red-500/15"
                        }`}
                      >
                        <Icon className={`w-4 h-4 ${getTypeColor(tx.type)}`} />
                      </div>

                      {/* Description */}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-gray-300 truncate">
                          {tx.description || tx.type.replace(/_/g, " ")}
                        </p>
                        <p className="text-[10px] text-gray-600">
                          {new Date(tx.createdAt).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                            hour: "numeric",
                            minute: "2-digit",
                          })}
                        </p>
                      </div>

                      {/* Amount */}
                      <div className="text-right shrink-0">
                        <p
                          className={`text-xs font-bold tabular-nums ${
                            isPositive ? "text-green-400" : "text-red-400"
                          }`}
                        >
                          {isPositive ? "+" : ""}
                          {tx.amount.toLocaleString()}
                        </p>
                        <p className="text-[10px] text-gray-600 tabular-nums">
                          Bal: {tx.balanceAfter.toLocaleString()}
                        </p>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
              {hasMore && (
                <button
                  onClick={loadMore}
                  className="w-full py-3 text-[10px] font-bold uppercase text-cyan-400 hover:text-white transition-colors"
                >
                  Load More
                </button>
              )}
            </div>
          )}
        </motion.div>
      </div>
    </DashboardLayout>
  );
}
