import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/hooks/use-toast";
import { useWallet, type Transaction, type WalletType, type WalletBalances } from "@/lib/wallet-context";
import { useAnimatedCounter } from "@/hooks/useAnimatedCounter";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Coins, Gift, ArrowDownRight, ArrowUpRight, Loader2,
  Clock, Filter, TrendingUp, Sparkles, RefreshCw, Download,
  Wallet as WalletIcon, Gamepad2, ArrowRightLeft, Trophy,
  Send, ArrowDown, QrCode, Copy, Check, ExternalLink,
  ChevronDown, Lock, Unlock, AlertTriangle, ArrowRight,
} from "lucide-react";

// ── Wallet Config ─────────────────────────────────────────────────────
const WALLET_CONFIG = [
  { key: "main" as WalletType, label: "Main Wallet", shortLabel: "Main", desc: "Deposits & withdrawals", icon: WalletIcon, color: "text-blue-400", border: "border-blue-500/20", bg: "bg-blue-500/10", gradient: "from-blue-500/20 to-blue-600/10", rgb: "59,130,246" },
  { key: "cash_game" as WalletType, label: "Cash Game", shortLabel: "Cash", desc: "Ring game buy-ins", icon: Gamepad2, color: "text-green-400", border: "border-green-500/20", bg: "bg-green-500/10", gradient: "from-green-500/20 to-emerald-600/10", rgb: "34,197,94" },
  { key: "sng" as WalletType, label: "Sit & Go", shortLabel: "SNG", desc: "SNG buy-ins", icon: ArrowRightLeft, color: "text-purple-400", border: "border-purple-500/20", bg: "bg-purple-500/10", gradient: "from-purple-500/20 to-violet-600/10", rgb: "168,85,247" },
  { key: "tournament" as WalletType, label: "Tournament", shortLabel: "Tourney", desc: "Tournament entries", icon: Trophy, color: "text-orange-400", border: "border-orange-500/20", bg: "bg-orange-500/10", gradient: "from-orange-500/20 to-amber-600/10", rgb: "249,115,22" },
  { key: "bonus" as WalletType, label: "Bonus", shortLabel: "Bonus", desc: "Rewards & rakeback", icon: Sparkles, color: "text-pink-400", border: "border-pink-500/20", bg: "bg-pink-500/10", gradient: "from-pink-500/20 to-rose-600/10", rgb: "236,72,153" },
];

const CRYPTO_CURRENCIES = [
  { id: "BTC", name: "Bitcoin", icon: "₿", color: "text-orange-400" },
  { id: "ETH", name: "Ethereum", icon: "Ξ", color: "text-blue-400" },
  { id: "USDT", name: "Tether", icon: "$", color: "text-green-400" },
  { id: "SOL", name: "Solana", icon: "◎", color: "text-purple-400" },
  { id: "LTC", name: "Litecoin", icon: "Ł", color: "text-gray-400" },
  { id: "DOGE", name: "Dogecoin", icon: "Ð", color: "text-primary" },
];

const GATEWAYS = [
  { id: "nowpayments", name: "NOWPayments", desc: "200+ coins, simple setup", badge: "Most Coins" },
  { id: "direct", name: "Direct Wallet", desc: "No middleman, lowest fees", badge: "Low Fees" },
];

const FEE_ESTIMATES: Record<string, string> = {
  USDT: "~1 USDT", BTC: "~0.0001 BTC", ETH: "~0.002 ETH", SOL: "~0.001 SOL",
  LTC: "~0.001 LTC", DOGE: "~2 DOGE",
};

type FilterType = "all" | "bonus" | "buy_in" | "cashout" | "purchase" | "prize" | "transfer" | "deposit" | "withdraw";

const FILTER_OPTIONS: { key: FilterType; label: string }[] = [
  { key: "all", label: "All" },
  { key: "deposit", label: "Deposits" },
  { key: "withdraw", label: "Withdrawals" },
  { key: "transfer", label: "Transfers" },
  { key: "bonus", label: "Bonuses" },
  { key: "buy_in", label: "Buy-ins" },
  { key: "cashout", label: "Cashouts" },
  { key: "prize", label: "Winnings" },
  { key: "purchase", label: "Purchases" },
];

const ALLOCATION_PRESETS = [
  { label: "All Main", alloc: { main: 100, cash_game: 0, sng: 0, tournament: 0 } },
  { label: "Even Split", alloc: { main: 25, cash_game: 25, sng: 25, tournament: 25 } },
  { label: "Cash Focus", alloc: { main: 20, cash_game: 60, sng: 10, tournament: 10 } },
  { label: "Tourney Focus", alloc: { main: 20, cash_game: 10, sng: 10, tournament: 60 } },
];

// ── Helpers ───────────────────────────────────────────────────────────
function getTypeIcon(type: string) {
  switch (type) {
    case "bonus": case "daily_bonus": return Gift;
    case "buy_in": case "buyin": case "purchase": return ArrowDownRight;
    case "cashout": case "prize": return ArrowUpRight;
    case "transfer": return ArrowRightLeft;
    case "deposit": return ArrowDown;
    case "withdraw": return Send;
    default: return Coins;
  }
}

function getTypeColor(type: string) {
  switch (type) {
    case "bonus": case "daily_bonus": return "text-purple-400";
    case "buy_in": case "buyin": case "purchase": case "withdraw": return "text-red-400";
    case "cashout": case "prize": case "deposit": return "text-green-400";
    case "transfer": return "text-blue-400";
    default: return "text-primary";
  }
}

function matchesFilter(type: string, filter: FilterType): boolean {
  if (filter === "all") return true;
  if (filter === "bonus") return type === "bonus" || type === "daily_bonus";
  if (filter === "buy_in") return type === "buy_in" || type === "buyin";
  if (filter === "deposit") return type === "deposit";
  if (filter === "withdraw") return type === "withdraw";
  if (filter === "transfer") return type === "transfer";
  if (filter === "cashout") return type === "cashout";
  if (filter === "purchase") return type === "purchase";
  if (filter === "prize") return type === "prize" || type === "winnings";
  return false;
}

function getWalletConfig(walletType: string | null | undefined) {
  return WALLET_CONFIG.find(w => w.key === walletType);
}

// ── Animated Number with color flash ─────────────────────────────────
function AnimatedChips({ value, className = "" }: { value: number; className?: string }) {
  const { value: display, animating, delta } = useAnimatedCounter(value);
  return (
    <span className={`tabular-nums transition-colors duration-300 ${
      animating && delta > 0 ? "text-green-400" :
      animating && delta < 0 ? "text-red-400" :
      className
    }`}>
      {display.toLocaleString()}
    </span>
  );
}

// ── Wallet Badge (colored) ───────────────────────────────────────────
function WalletBadge({ walletType }: { walletType: string }) {
  const config = getWalletConfig(walletType);
  if (!config) return <span className="text-[0.5625rem] text-gray-600 uppercase">{walletType}</span>;
  const Icon = config.icon;
  return (
    <span className={`inline-flex items-center gap-1 text-[0.5625rem] font-bold uppercase px-2 py-0.5 rounded-md ${config.bg} ${config.color} border ${config.border}`}>
      <Icon className="w-2.5 h-2.5" />
      {config.shortLabel}
    </span>
  );
}

// ── Allocation Bar ───────────────────────────────────────────────────
function AllocationBar({ balances, total }: { balances: WalletBalances; total: number }) {
  if (total <= 0) return null;
  return (
    <div className="flex h-1.5 rounded-full overflow-hidden bg-white/[0.03]">
      {WALLET_CONFIG.map(w => {
        const pct = ((balances[w.key] ?? 0) / total) * 100;
        if (pct < 0.5) return null;
        return (
          <motion.div
            key={w.key}
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="h-full"
            style={{ backgroundColor: `rgba(${w.rgb}, 0.5)` }}
            title={`${w.label}: ${pct.toFixed(1)}%`}
          />
        );
      })}
    </div>
  );
}

// ── Balance Chart ─────────────────────────────────────────────────────
function BalanceChart({ transactions }: { transactions: Transaction[] }) {
  const points = useMemo(() => {
    const recent = [...transactions].reverse().slice(-20);
    if (recent.length < 2) return null;
    const balances = recent.map((t) => t.balanceAfter);
    const min = Math.min(...balances);
    const max = Math.max(...balances);
    const range = max - min || 1;
    const width = 100, height = 100, padding = 5;
    const usableW = width - padding * 2, usableH = height - padding * 2;
    const coords = balances.map((b, i) => ({
      x: padding + (i / (balances.length - 1)) * usableW,
      y: padding + usableH - ((b - min) / range) * usableH,
    }));
    const linePath = coords.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
    const areaPath = linePath + ` L ${coords[coords.length - 1].x.toFixed(1)} ${(height - padding).toFixed(1)} L ${coords[0].x.toFixed(1)} ${(height - padding).toFixed(1)} Z`;
    return { linePath, areaPath, coords, min, max };
  }, [transactions]);

  if (!points) return <div className="flex items-center justify-center h-full text-gray-600 text-xs">Not enough data yet</div>;
  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-full">
      <defs>
        <linearGradient id="balGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgb(212,168,67)" stopOpacity="0.3" />
          <stop offset="100%" stopColor="rgb(212,168,67)" stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <path d={points.areaPath} fill="url(#balGrad)" />
      <path d={points.linePath} fill="none" stroke="rgb(212,168,67)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      {points.coords.length > 0 && <circle cx={points.coords[points.coords.length - 1].x} cy={points.coords[points.coords.length - 1].y} r="2" fill="rgb(212,168,67)" />}
    </svg>
  );
}

// ── Wallet Pill Selector ─────────────────────────────────────────────
function WalletPillSelector({ value, onChange, exclude, balances, label }: {
  value: WalletType;
  onChange: (v: WalletType) => void;
  exclude?: WalletType[];
  balances: WalletBalances;
  label: string;
}) {
  const options = WALLET_CONFIG.filter(w => !exclude?.includes(w.key));
  return (
    <div>
      <label className="text-[0.625rem] text-gray-500 uppercase tracking-wider font-medium mb-2 block">{label}</label>
      <div className="grid grid-cols-2 gap-1.5">
        {options.map(w => {
          const Icon = w.icon;
          const isSelected = value === w.key;
          const amt = balances[w.key] ?? 0;
          return (
            <button key={w.key} onClick={() => onChange(w.key)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-all text-left ${
                isSelected
                  ? `border-transparent`
                  : "bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.04] hover:border-white/[0.1]"
              }`}
              style={isSelected ? {
                backgroundColor: `rgba(${w.rgb}, 0.1)`,
                borderColor: `rgba(${w.rgb}, 0.25)`,
              } : undefined}
            >
              <div className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 ${w.bg}`}>
                <Icon className={`w-3 h-3 ${w.color}`} />
              </div>
              <div className="min-w-0 flex-1">
                <p className={`text-[0.625rem] font-bold ${isSelected ? w.color : "text-gray-400"}`}>{w.shortLabel}</p>
                <p className="text-[0.5rem] text-gray-600 tabular-nums">{amt.toLocaleString()}</p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Transfer Panel ────────────────────────────────────────────────────
function TransferPanel({ onComplete, initialFrom, initialTo }: { onComplete: () => void; initialFrom?: WalletType; initialTo?: WalletType }) {
  const { balances, transfer } = useWallet();
  const { toast } = useToast();
  const [from, setFrom] = useState<WalletType>(initialFrom || "main");
  const [to, setTo] = useState<WalletType>(initialTo || "cash_game");
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [successAmount, setSuccessAmount] = useState(0);

  const maxAmount = balances[from] ?? 0;

  const handleSwap = () => {
    if (to === "bonus") return; // Can't transfer from bonus
    const temp = from;
    setFrom(to);
    setTo(temp);
  };

  const handleTransfer = async () => {
    const amt = parseInt(amount);
    if (!amt || amt <= 0) return;
    setLoading(true);
    const result = await transfer(from, to, amt);
    setLoading(false);
    if (result.success) {
      setSuccessAmount(amt);
      setShowSuccess(true);
      setAmount("");
      onComplete();
      setTimeout(() => setShowSuccess(false), 2000);
    } else {
      toast({ title: "Transfer Failed", description: result.error || "Unknown error", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-4 relative">
      {/* Success overlay */}
      <AnimatePresence>
        {showSuccess && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm rounded-2xl z-10"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 400, damping: 15 }}
              className="w-14 h-14 rounded-full bg-green-500/20 border border-green-500/30 flex items-center justify-center mb-3"
            >
              <Check className="w-7 h-7 text-green-400" />
            </motion.div>
            <p className="text-sm font-bold text-green-400">Transfer Complete</p>
            <p className="text-xs text-gray-400 mt-1">{successAmount.toLocaleString()} chips moved</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* From wallet */}
      <WalletPillSelector
        value={from}
        onChange={(v) => { setFrom(v); if (v === to) setTo(WALLET_CONFIG.find(w => w.key !== v && w.key !== "bonus")?.key || "main"); }}
        exclude={["bonus"]}
        balances={balances}
        label="From"
      />

      {/* Swap + Flow arrow */}
      <div className="flex items-center justify-center gap-3">
        <div className="flex-1 h-px bg-gradient-to-r from-transparent to-white/[0.06]" />
        <motion.button
          whileHover={{ scale: 1.15, rotate: 180 }}
          whileTap={{ scale: 0.9 }}
          onClick={handleSwap}
          className="w-8 h-8 rounded-full bg-white/[0.05] border border-white/[0.1] flex items-center justify-center hover:bg-primary/10 hover:border-primary/20 transition-colors"
        >
          <ArrowRightLeft className="w-4 h-4 text-primary" />
        </motion.button>
        <div className="flex-1 h-px bg-gradient-to-l from-transparent to-white/[0.06]" />
      </div>

      {/* To wallet */}
      <WalletPillSelector
        value={to}
        onChange={setTo}
        exclude={[from]}
        balances={balances}
        label="To"
      />

      {/* Amount */}
      <div>
        <label className="text-[0.625rem] text-gray-500 uppercase tracking-wider font-medium mb-1.5 block">Amount</label>
        <div className="relative">
          <input type="number" value={amount} onChange={e => setAmount(e.target.value)} min={1} max={maxAmount}
            placeholder="Enter amount" className="w-full px-3 py-2.5 pr-20 rounded-lg bg-white/[0.03] border border-white/[0.08] text-sm text-gray-300 outline-none focus:border-primary/30 transition-colors" />
          <button onClick={() => setAmount(String(maxAmount))} className="absolute right-2 top-1/2 -translate-y-1/2 px-2 py-0.5 rounded text-[0.5625rem] font-bold uppercase text-primary bg-primary/10 hover:bg-primary/20 transition-colors">Max</button>
        </div>
        {/* Quick amount buttons */}
        <div className="flex gap-1.5 mt-2">
          {[0.25, 0.5, 0.75].map(pct => (
            <button key={pct} onClick={() => setAmount(String(Math.floor(maxAmount * pct)))}
              className="flex-1 py-1.5 rounded-lg text-[0.5625rem] font-bold uppercase text-gray-500 bg-white/[0.03] border border-white/[0.06] hover:bg-primary/10 hover:text-primary hover:border-primary/20 transition-all">
              {pct * 100}%
            </button>
          ))}
        </div>
        <p className="text-[0.5625rem] text-gray-600 mt-1.5">Available: {maxAmount.toLocaleString()} chips</p>
      </div>

      <button onClick={handleTransfer} disabled={loading || !amount || parseInt(amount) <= 0 || parseInt(amount) > maxAmount}
        className="w-full py-2.5 rounded-lg font-bold text-sm uppercase tracking-wider bg-gradient-to-r from-amber-500/20 to-orange-500/20 text-primary border border-primary/20 hover:border-primary/40 transition-all disabled:opacity-40">
        {loading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : "Transfer"}
      </button>
    </div>
  );
}

// ── Deposit Panel ─────────────────────────────────────────────────────
function DepositPanel() {
  const { balances } = useWallet();
  const { toast } = useToast();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [currency, setCurrency] = useState("USDT");
  const [gateway, setGateway] = useState("nowpayments");
  const [amount, setAmount] = useState("");
  const [allocation, setAllocation] = useState<Record<string, number>>({ main: 100, cash_game: 0, sng: 0, tournament: 0 });
  const [lockedWallets, setLockedWallets] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [depositResult, setDepositResult] = useState<{ payAddress: string; payAmount: string; currency: string; expiresAt: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [expirySeconds, setExpirySeconds] = useState(0);

  const totalPercent = Object.values(allocation).reduce((s, v) => s + v, 0);
  const amountNum = parseInt(amount) || 0;

  // Expiry countdown
  useEffect(() => {
    if (!depositResult?.expiresAt) return;
    function tick() {
      const remaining = Math.max(0, Math.floor((new Date(depositResult!.expiresAt).getTime() - Date.now()) / 1000));
      setExpirySeconds(remaining);
    }
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [depositResult?.expiresAt]);

  const handleAllocationChange = (wallet: string, newValue: number) => {
    const clamped = Math.max(0, Math.min(100, newValue));
    const otherUnlocked = Object.keys(allocation).filter(k => k !== wallet && !lockedWallets.has(k));
    const lockedTotal = Object.entries(allocation)
      .filter(([k]) => lockedWallets.has(k) && k !== wallet)
      .reduce((s, [_, v]) => s + v, 0);
    const remaining = 100 - lockedTotal - clamped;

    if (otherUnlocked.length === 0) {
      setAllocation(prev => ({ ...prev, [wallet]: clamped }));
      return;
    }

    const currentUnlockedTotal = otherUnlocked.reduce((s, k) => s + (allocation[k] || 0), 0);
    const newAlloc = { ...allocation, [wallet]: clamped };

    if (currentUnlockedTotal === 0) {
      const each = Math.floor(remaining / otherUnlocked.length);
      const remainder = remaining - each * otherUnlocked.length;
      otherUnlocked.forEach((k, i) => { newAlloc[k] = each + (i === 0 ? remainder : 0); });
    } else {
      let distributed = 0;
      otherUnlocked.forEach((k, i) => {
        if (i === otherUnlocked.length - 1) {
          newAlloc[k] = Math.max(0, remaining - distributed);
        } else {
          const ratio = (allocation[k] || 0) / currentUnlockedTotal;
          const share = Math.round(remaining * ratio);
          newAlloc[k] = Math.max(0, share);
          distributed += newAlloc[k];
        }
      });
    }

    setAllocation(newAlloc);
  };

  const toggleLock = (wallet: string) => {
    setLockedWallets(prev => {
      const next = new Set(prev);
      if (next.has(wallet)) next.delete(wallet);
      else next.add(wallet);
      return next;
    });
  };

  const handleDeposit = async () => {
    const amountCents = amountNum * 100;
    if (!amountCents || amountCents < 100) return;
    const allocationEntries = Object.entries(allocation)
      .filter(([_, pct]) => pct > 0)
      .map(([walletType, pct]) => ({ walletType: walletType as WalletType, amount: Math.round(amountCents * pct / 100) }));
    const allocSum = allocationEntries.reduce((s, a) => s + a.amount, 0);
    if (allocSum !== amountCents && allocationEntries.length > 0) {
      allocationEntries[0].amount += amountCents - allocSum;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/payments/deposit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: amountCents, currency, gateway, allocation: allocationEntries }),
      });
      if (res.ok) {
        const data = await res.json();
        setDepositResult({ payAddress: data.payAddress, payAmount: data.payAmount, currency: data.currency, expiresAt: data.expiresAt });
        toast({ title: "Deposit Created", description: `Send ${data.payAmount} ${currency} to the address shown` });
      } else {
        const err = await res.json().catch(() => ({ message: "Deposit failed" }));
        toast({ title: "Error", description: err.message, variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Network error", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const copyAddress = () => {
    if (depositResult?.payAddress) {
      navigator.clipboard.writeText(depositResult.payAddress);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Payment result screen
  if (depositResult) {
    const expiryMin = Math.floor(expirySeconds / 60);
    const expirySec = expirySeconds % 60;
    return (
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
        <div className="text-center space-y-2">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
            className="w-14 h-14 rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center mx-auto"
          >
            <QrCode className="w-7 h-7 text-green-400" />
          </motion.div>
          <p className="text-sm font-bold text-white">Send Payment</p>
          <p className="text-xs text-gray-500">Send exactly <span className="text-primary font-bold">{depositResult.payAmount} {depositResult.currency}</span></p>
        </div>

        {/* Address with copy */}
        <div className="relative group">
          <div className="px-4 py-3 rounded-xl bg-white/[0.03] border border-white/[0.08] font-mono text-xs text-gray-300 break-all pr-12">
            {depositResult.payAddress}
          </div>
          <button onClick={copyAddress} className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors">
            {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4 text-gray-400" />}
          </button>
        </div>

        {/* Expiry countdown */}
        {expirySeconds > 0 && (
          <div className="flex items-center justify-center gap-2 text-[0.625rem] text-gray-500">
            <Clock className="w-3 h-3" />
            <span>Expires in <span className="text-primary font-bold tabular-nums">{expiryMin}:{expirySec.toString().padStart(2, "0")}</span></span>
          </div>
        )}

        {/* Allocation breakdown */}
        <div className="rounded-xl bg-white/[0.02] border border-white/[0.06] p-3 space-y-2">
          <p className="text-[0.5625rem] text-gray-500 uppercase tracking-wider font-medium">Chips will be credited to:</p>
          {Object.entries(allocation).filter(([_, pct]) => pct > 0).map(([key, pct]) => {
            const w = getWalletConfig(key);
            if (!w) return null;
            const Icon = w.icon;
            return (
              <div key={key} className="flex items-center gap-2">
                <div className={`w-5 h-5 rounded flex items-center justify-center ${w.bg}`}>
                  <Icon className={`w-2.5 h-2.5 ${w.color}`} />
                </div>
                <span className="text-[0.625rem] text-gray-400 flex-1">{w.shortLabel}</span>
                <span className="text-[0.625rem] text-gray-300 font-bold tabular-nums">{pct}%</span>
                <div className="w-16 h-1 rounded-full bg-white/[0.05] overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: `rgba(${w.rgb}, 0.6)` }} />
                </div>
              </div>
            );
          })}
        </div>

        <p className="text-[0.5625rem] text-gray-600 text-center">Payment will be credited after blockchain confirmations</p>
        <button onClick={() => { setDepositResult(null); setStep(1); }} className="w-full py-2.5 rounded-lg text-xs font-medium text-gray-400 bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.05] transition-colors">
          New Deposit
        </button>
      </motion.div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Step indicator */}
      <div className="flex items-center gap-1 justify-center">
        {[
          { n: 1, label: "Amount" },
          { n: 2, label: "Payment" },
          { n: 3, label: "Allocate" },
        ].map((s, i) => (
          <div key={s.n} className="flex items-center gap-1">
            {i > 0 && <div className={`w-6 h-px ${step >= s.n ? "bg-primary/40" : "bg-white/[0.06]"}`} />}
            <button
              onClick={() => { if (s.n === 1 || (s.n === 2 && amountNum > 0) || (s.n === 3 && amountNum > 0)) setStep(s.n as 1|2|3); }}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[0.5625rem] font-bold uppercase tracking-wider transition-all ${
                step === s.n ? "bg-primary/15 text-primary border border-primary/25" :
                step > s.n ? "text-green-400 border border-green-500/15 bg-green-500/5" :
                "text-gray-600 border border-white/[0.05]"
              }`}
            >
              {step > s.n ? <Check className="w-2.5 h-2.5" /> : null}
              {s.label}
            </button>
          </div>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {step === 1 && (
          <motion.div key="step1" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} className="space-y-4">
            <div>
              <label className="text-[0.625rem] text-gray-500 uppercase tracking-wider font-medium mb-1.5 block">Amount (USD)</label>
              <input type="number" value={amount} onChange={e => setAmount(e.target.value)} min={1} placeholder="Enter amount in USD"
                className="w-full px-3 py-2.5 rounded-lg bg-white/[0.03] border border-white/[0.08] text-sm text-gray-300 outline-none focus:border-primary/30 transition-colors" />
              <div className="flex gap-1.5 mt-2">
                {[10, 25, 50, 100].map(v => (
                  <button key={v} onClick={() => setAmount(String(v))}
                    className={`flex-1 py-1.5 rounded-lg text-[0.5625rem] font-bold border transition-all ${
                      amount === String(v) ? "bg-primary/15 text-primary border-primary/25" : "text-gray-500 bg-white/[0.03] border-white/[0.06] hover:bg-primary/10 hover:text-primary"
                    }`}>
                    ${v}
                  </button>
                ))}
              </div>
            </div>
            <button onClick={() => setStep(2)} disabled={amountNum <= 0}
              className="w-full py-2.5 rounded-lg font-bold text-sm uppercase tracking-wider bg-gradient-to-r from-amber-500/20 to-orange-500/20 text-primary border border-primary/20 hover:border-primary/40 transition-all disabled:opacity-40 flex items-center justify-center gap-2">
              Continue <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </motion.div>
        )}

        {step === 2 && (
          <motion.div key="step2" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} className="space-y-4">
            {/* Currency */}
            <div>
              <label className="text-[0.625rem] text-gray-500 uppercase tracking-wider font-medium mb-1.5 block">Cryptocurrency</label>
              <div className="grid grid-cols-3 gap-1.5">
                {CRYPTO_CURRENCIES.map(c => (
                  <button key={c.id} onClick={() => setCurrency(c.id)}
                    className={`px-2 py-2.5 rounded-lg text-[0.625rem] font-semibold border transition-all flex items-center gap-1.5 justify-center ${
                      currency === c.id ? "bg-primary/15 text-primary border-primary/25" : "bg-white/[0.02] text-gray-500 border-white/[0.05] hover:bg-white/[0.05]"
                    }`}>
                    <span className={c.color}>{c.icon}</span>
                    {c.id}
                  </button>
                ))}
              </div>
            </div>

            {/* Gateway */}
            <div>
              <label className="text-[0.625rem] text-gray-500 uppercase tracking-wider font-medium mb-1.5 block">Payment Gateway</label>
              <div className="space-y-1.5">
                {GATEWAYS.map(g => (
                  <button key={g.id} onClick={() => setGateway(g.id)}
                    className={`w-full px-3 py-2.5 rounded-lg text-left border transition-all flex items-center justify-between ${
                      gateway === g.id ? "bg-primary/10 border-primary/20" : "bg-white/[0.02] border-white/[0.05] hover:bg-white/[0.04]"
                    }`}>
                    <div>
                      <p className={`text-xs font-medium ${gateway === g.id ? "text-primary" : "text-gray-300"}`}>{g.name}</p>
                      <p className="text-[0.5625rem] text-gray-600">{g.desc}</p>
                    </div>
                    <span className={`text-[0.5rem] font-bold uppercase px-1.5 py-0.5 rounded ${gateway === g.id ? "bg-primary/20 text-primary" : "bg-white/[0.05] text-gray-600"}`}>
                      {g.badge}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-2">
              <button onClick={() => setStep(1)} className="px-4 py-2.5 rounded-lg text-xs font-bold uppercase text-gray-400 bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.05] transition-colors">Back</button>
              <button onClick={() => setStep(3)}
                className="flex-1 py-2.5 rounded-lg font-bold text-sm uppercase tracking-wider bg-gradient-to-r from-amber-500/20 to-orange-500/20 text-primary border border-primary/20 hover:border-primary/40 transition-all flex items-center justify-center gap-2">
                Continue <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </motion.div>
        )}

        {step === 3 && (
          <motion.div key="step3" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} className="space-y-4">
            {/* Summary */}
            <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-white/[0.02] border border-white/[0.06]">
              <span className="text-[0.625rem] text-gray-500">Depositing</span>
              <span className="text-sm font-bold text-primary">${amountNum} USD</span>
            </div>

            {/* Preset buttons */}
            <div>
              <label className="text-[0.625rem] text-gray-500 uppercase tracking-wider font-medium mb-1.5 block">Quick Presets</label>
              <div className="flex gap-1.5">
                {ALLOCATION_PRESETS.map(p => (
                  <button key={p.label} onClick={() => setAllocation({ ...p.alloc })}
                    className="flex-1 py-1.5 rounded-lg text-[0.5rem] font-bold uppercase text-gray-500 bg-white/[0.03] border border-white/[0.06] hover:bg-primary/10 hover:text-primary hover:border-primary/20 transition-all leading-tight">
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Allocation sliders */}
            <div>
              <label className="text-[0.625rem] text-gray-500 uppercase tracking-wider font-medium mb-2 block">
                Allocate to Wallets <span className={totalPercent === 100 ? "text-green-400" : "text-red-400"}>({totalPercent}%)</span>
              </label>
              <div className="space-y-3">
                {WALLET_CONFIG.filter(w => w.key !== "bonus").map(w => {
                  const Icon = w.icon;
                  const isLocked = lockedWallets.has(w.key);
                  const chipAmount = Math.round(amountNum * 100 * (allocation[w.key] || 0) / 100);
                  return (
                    <div key={w.key} className="space-y-1">
                      <div className="flex items-center gap-2">
                        <div className={`w-5 h-5 rounded flex items-center justify-center ${w.bg}`}>
                          <Icon className={`w-2.5 h-2.5 ${w.color}`} />
                        </div>
                        <span className={`text-[0.625rem] font-medium flex-1 ${w.color}`}>{w.shortLabel}</span>
                        <button onClick={() => toggleLock(w.key)} className="p-0.5 rounded hover:bg-white/[0.05] transition-colors" title={isLocked ? "Unlock" : "Lock"}>
                          {isLocked ? <Lock className="w-3 h-3 text-primary" /> : <Unlock className="w-3 h-3 text-gray-600" />}
                        </button>
                        <span className="text-[0.625rem] font-bold text-gray-400 w-10 text-right tabular-nums">{allocation[w.key] || 0}%</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <input type="range" min={0} max={100} step={5} value={allocation[w.key] || 0}
                          onChange={e => handleAllocationChange(w.key, parseInt(e.target.value))}
                          disabled={isLocked}
                          className="flex-1 accent-amber-500 h-1 disabled:opacity-40" />
                        <span className="text-[0.5rem] tabular-nums w-20 text-right" style={{ color: `rgba(${w.rgb}, 0.6)` }}>
                          ~{chipAmount.toLocaleString()} chips
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
              {totalPercent !== 100 && <p className="text-[0.5625rem] text-red-400 mt-2 flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Allocation must total 100%</p>}
            </div>

            <div className="flex gap-2">
              <button onClick={() => setStep(2)} className="px-4 py-2.5 rounded-lg text-xs font-bold uppercase text-gray-400 bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.05] transition-colors">Back</button>
              <button onClick={handleDeposit} disabled={loading || totalPercent !== 100}
                className="flex-1 py-2.5 rounded-lg font-bold text-sm uppercase tracking-wider bg-gradient-to-r from-green-500/20 to-emerald-500/20 text-green-400 border border-green-500/20 hover:border-green-500/40 transition-all disabled:opacity-40">
                {loading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : "Generate Payment Address"}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Withdraw Panel ────────────────────────────────────────────────────
function WithdrawPanel() {
  const { balances, refreshBalances } = useWallet();
  const { toast } = useToast();
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("USDT");
  const [address, setAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [withdrawals, setWithdrawals] = useState<any[]>([]);

  const mainBalance = balances.main ?? 0;

  useEffect(() => {
    fetch("/api/wallet/withdrawals").then(r => r.ok ? r.json() : []).then(data => {
      if (Array.isArray(data)) setWithdrawals(data);
    }).catch(() => {});
  }, []);

  const handleSubmit = () => {
    const amt = parseInt(amount);
    if (!amt || amt <= 0 || !address) return;
    setShowConfirmation(true);
  };

  const executeWithdraw = async () => {
    setShowConfirmation(false);
    const amt = parseInt(amount);
    setLoading(true);
    try {
      const res = await fetch("/api/wallet/withdraw", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: amt, currency, address }),
      });
      if (res.ok) {
        toast({ title: "Withdrawal Requested", description: "Your withdrawal is pending admin approval." });
        setAmount(""); setAddress("");
        await refreshBalances();
        // Refresh withdrawals
        const wd = await fetch("/api/wallet/withdrawals").then(r => r.ok ? r.json() : []);
        if (Array.isArray(wd)) setWithdrawals(wd);
      } else {
        const err = await res.json().catch(() => ({ message: "Withdrawal failed" }));
        toast({ title: "Error", description: err.message, variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Network error", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const truncateAddress = (addr: string) => addr.length > 16 ? `${addr.slice(0, 8)}...${addr.slice(-8)}` : addr;

  const statusColors: Record<string, string> = {
    pending: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
    processing: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    completed: "bg-green-500/10 text-green-400 border-green-500/20",
    failed: "bg-red-500/10 text-red-400 border-red-500/20",
    cancelled: "bg-gray-500/10 text-gray-400 border-gray-500/20",
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-500/5 border border-blue-500/15">
        <WalletIcon className="w-3.5 h-3.5 text-blue-400 shrink-0" />
        <p className="text-[0.625rem] text-gray-400">Withdrawals are processed from your <span className="text-blue-400 font-semibold">Main Wallet</span> ({mainBalance.toLocaleString()} chips available)</p>
      </div>

      <div>
        <label className="text-[0.625rem] text-gray-500 uppercase tracking-wider font-medium mb-1.5 block">Amount (chips)</label>
        <div className="relative">
          <input type="number" value={amount} onChange={e => setAmount(e.target.value)} min={1} max={mainBalance} placeholder="Chips to withdraw"
            className="w-full px-3 py-2.5 pr-20 rounded-lg bg-white/[0.03] border border-white/[0.08] text-sm text-gray-300 outline-none focus:border-primary/30 transition-colors" />
          <button onClick={() => setAmount(String(mainBalance))} className="absolute right-2 top-1/2 -translate-y-1/2 px-2 py-0.5 rounded text-[0.5625rem] font-bold uppercase text-primary bg-primary/10 hover:bg-primary/20 transition-colors">Max</button>
        </div>
      </div>

      <div>
        <label className="text-[0.625rem] text-gray-500 uppercase tracking-wider font-medium mb-1.5 block">Currency</label>
        <div className="flex gap-1.5">
          {["USDT", "BTC", "ETH", "SOL"].map(c => (
            <button key={c} onClick={() => setCurrency(c)}
              className={`flex-1 px-3 py-2 rounded-lg text-[0.625rem] font-semibold border transition-all ${currency === c ? "bg-primary/15 text-primary border-primary/25" : "bg-white/[0.02] text-gray-500 border-white/[0.05] hover:bg-white/[0.05]"}`}>
              {c}
            </button>
          ))}
        </div>
        <p className="text-[0.5625rem] text-gray-600 mt-1">Estimated fee: {FEE_ESTIMATES[currency] || "varies"}</p>
      </div>

      <div>
        <label className="text-[0.625rem] text-gray-500 uppercase tracking-wider font-medium mb-1.5 block">{currency} Address</label>
        <input type="text" value={address} onChange={e => setAddress(e.target.value)} placeholder={`Enter your ${currency} wallet address`}
          className="w-full px-3 py-2.5 rounded-lg bg-white/[0.03] border border-white/[0.08] text-sm text-gray-300 font-mono outline-none focus:border-primary/30 transition-colors" />
      </div>

      <button onClick={handleSubmit} disabled={loading || !amount || parseInt(amount) <= 0 || !address || parseInt(amount) > mainBalance}
        className="w-full py-2.5 rounded-lg font-bold text-sm uppercase tracking-wider bg-gradient-to-r from-red-500/20 to-orange-500/20 text-red-400 border border-red-500/20 hover:border-red-500/40 transition-all disabled:opacity-40">
        {loading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : "Review Withdrawal"}
      </button>

      {/* Confirmation Dialog */}
      <Dialog open={showConfirmation} onOpenChange={setShowConfirmation}>
        <DialogContent className="bg-surface-high/50 backdrop-blur-xl border border-white/[0.06] max-w-md">
          <DialogHeader>
            <DialogTitle className="text-primary font-display tracking-wider text-base">Confirm Withdrawal</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-4 space-y-2.5">
              {[
                { label: "Amount", value: `${parseInt(amount || "0").toLocaleString()} chips` },
                { label: "Currency", value: currency },
                { label: "Address", value: truncateAddress(address), mono: true },
                { label: "Est. Network Fee", value: FEE_ESTIMATES[currency] || "varies" },
                { label: "Processing", value: "1-24 hours" },
              ].map(row => (
                <div key={row.label} className="flex items-center justify-between">
                  <span className="text-[0.625rem] text-gray-500">{row.label}</span>
                  <span className={`text-xs font-medium text-gray-300 ${row.mono ? "font-mono" : ""}`}>{row.value}</span>
                </div>
              ))}
            </div>
            <p className="text-[0.5625rem] text-gray-500 text-center">Withdrawals require admin approval. You'll be notified when processed.</p>
          </div>
          <DialogFooter className="gap-2">
            <button onClick={() => setShowConfirmation(false)} className="px-4 py-2 rounded-lg text-xs font-bold uppercase text-gray-400 bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.05] transition-colors">Cancel</button>
            <button onClick={executeWithdraw} className="px-6 py-2 rounded-lg font-bold text-xs uppercase tracking-wider bg-gradient-to-r from-red-500/20 to-orange-500/20 text-red-400 border border-red-500/20 hover:border-red-500/40 transition-all">
              Confirm Withdrawal
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Pending Withdrawals */}
      {withdrawals.length > 0 && (
        <div className="space-y-2 pt-2 border-t border-white/[0.06]">
          <p className="text-[0.625rem] text-gray-500 uppercase tracking-wider font-medium">Recent Withdrawals</p>
          {withdrawals.slice(0, 5).map((w: any) => (
            <div key={w.id} className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-white/[0.02] border border-white/[0.05]">
              <span className={`text-[0.5rem] font-bold uppercase px-2 py-0.5 rounded border ${statusColors[w.status] || statusColors.pending}`}>{w.status}</span>
              <span className="text-xs font-bold text-gray-300 tabular-nums flex-1">{w.amount?.toLocaleString()} chips</span>
              <span className="text-[0.5625rem] text-gray-600">{w.currency}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Transaction Row (expandable) ─────────────────────────────────────
function TransactionRow({ tx }: { tx: Transaction }) {
  const [expanded, setExpanded] = useState(false);
  const [copiedId, setCopiedId] = useState(false);
  const Icon = getTypeIcon(tx.type);
  const isPositive = tx.amount > 0;

  const copyId = () => {
    navigator.clipboard.writeText(tx.id);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 1500);
  };

  return (
    <motion.div layout className="rounded-xl overflow-hidden">
      <div onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-3 px-3 py-3 hover:bg-white/[0.02] transition-colors cursor-pointer">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${isPositive ? "bg-green-500/10 border border-green-500/15" : "bg-red-500/10 border border-red-500/15"}`}>
          <Icon className={`w-4 h-4 ${getTypeColor(tx.type)}`} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-gray-300 truncate">{tx.description || tx.type.replace(/_/g, " ")}</p>
          <div className="flex items-center gap-2 mt-0.5">
            <p className="text-[0.625rem] text-gray-600">
              {new Date(tx.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
            </p>
            {tx.walletType && <WalletBadge walletType={tx.walletType} />}
          </div>
        </div>
        <div className="text-right shrink-0 flex items-center gap-2">
          <div>
            <p className={`text-xs font-bold tabular-nums ${isPositive ? "text-green-400" : "text-red-400"}`}>
              {isPositive ? "+" : ""}{tx.amount.toLocaleString()}
            </p>
            <p className="text-[0.625rem] text-gray-600 tabular-nums">Bal: {tx.balanceAfter.toLocaleString()}</p>
          </div>
          <ChevronDown className={`w-3 h-3 text-gray-600 transition-transform ${expanded ? "rotate-180" : ""}`} />
        </div>
      </div>
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-3 pt-1 space-y-2 border-t border-white/[0.04] ml-11">
              <div className="flex items-center justify-between">
                <span className="text-[0.5625rem] text-gray-600">Transaction ID</span>
                <button onClick={copyId} className="flex items-center gap-1 text-[0.5625rem] text-gray-400 font-mono hover:text-primary transition-colors">
                  {tx.id.slice(0, 12)}...
                  {copiedId ? <Check className="w-2.5 h-2.5 text-green-400" /> : <Copy className="w-2.5 h-2.5" />}
                </button>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[0.5625rem] text-gray-600">Balance Before</span>
                <span className="text-[0.5625rem] text-gray-400 tabular-nums">{tx.balanceBefore.toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[0.5625rem] text-gray-600">Balance After</span>
                <span className="text-[0.5625rem] text-gray-400 tabular-nums">{tx.balanceAfter.toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[0.5625rem] text-gray-600">Date</span>
                <span className="text-[0.5625rem] text-gray-400">
                  {new Date(tx.createdAt).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", second: "2-digit" })}
                </span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ── Skeleton Loading ─────────────────────────────────────────────────
function WalletSkeleton() {
  return (
    <div className="px-4 sm:px-8 pb-8 space-y-6 max-w-6xl mx-auto">
      <div className="rounded-2xl bg-white/[0.03] border border-white/[0.06] p-6 sm:p-8">
        <Skeleton className="h-3 w-24 bg-white/[0.05] mb-3" />
        <Skeleton className="h-12 w-48 bg-white/[0.05] mb-3" />
        <Skeleton className="h-1.5 w-full bg-white/[0.03] rounded-full" />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-4">
            <div className="flex items-center gap-2 mb-3">
              <Skeleton className="w-7 h-7 rounded-lg bg-white/[0.05]" />
              <Skeleton className="h-2.5 w-16 bg-white/[0.05]" />
            </div>
            <Skeleton className="h-5 w-20 bg-white/[0.05]" />
          </div>
        ))}
      </div>
      <div className="rounded-2xl bg-white/[0.03] border border-white/[0.06] p-5 sm:p-6">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="flex items-center gap-3 px-3 py-3">
            <Skeleton className="w-8 h-8 rounded-lg bg-white/[0.05]" />
            <div className="flex-1">
              <Skeleton className="h-3 w-40 bg-white/[0.05] mb-1.5" />
              <Skeleton className="h-2 w-24 bg-white/[0.03]" />
            </div>
            <Skeleton className="h-3 w-16 bg-white/[0.05]" />
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────
export default function Wallet() {
  const { refreshUser } = useAuth();
  const { toast } = useToast();
  const [location] = useLocation();

  const {
    balance, balances, canClaim, claiming, bonusAmount, hasElitePass, timeLeft,
    claimDailyBonus, transactions, loadingTransactions: loadingTx,
    hasMore, loadMore, refreshTransactions, refreshBalances, error,
  } = useWallet();

  const [filter, setFilter] = useState<FilterType>("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [activeTab, setActiveTab] = useState<"transfer" | "deposit" | "withdraw">("transfer");
  const [initialFrom, setInitialFrom] = useState<WalletType | undefined>();
  const [initialTo, setInitialTo] = useState<WalletType | undefined>();
  const actionRef = useRef<HTMLDivElement>(null);

  // Deep-link from URL params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tab = params.get("tab") as "transfer" | "deposit" | "withdraw" | null;
    if (tab && ["transfer", "deposit", "withdraw"].includes(tab)) {
      setActiveTab(tab);
      const from = params.get("from") as WalletType | null;
      const to = params.get("to") as WalletType | null;
      if (from) setInitialFrom(from);
      if (to) setInitialTo(to);
      setTimeout(() => actionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 300);
    }
  }, [location]);

  const exportCSV = () => {
    const header = "Date,Type,Wallet,Amount,Balance After,Description\n";
    const rows = filtered.map(t =>
      `${new Date(t.createdAt).toISOString()},${t.type},${t.walletType || ""},${t.amount},${t.balanceAfter},"${(t.description || t.type).replace(/"/g, '""')}"`
    ).join("\n");
    const blob = new Blob([header + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `transactions_${new Date().toISOString().split("T")[0]}.csv`;
    a.click(); URL.revokeObjectURL(url);
  };

  const handleClaimDaily = async () => {
    const result = await claimDailyBonus();
    if (result.success) {
      toast({ title: "Daily Bonus Claimed!", description: `+${result.bonus!.toLocaleString()} chips to bonus wallet` });
      await refreshUser();
    } else {
      toast({ title: "Error", description: error || "Failed to claim", variant: "destructive" });
    }
  };

  const scrollToTransfer = (from: WalletType, direction: "from" | "to") => {
    setActiveTab("transfer");
    if (direction === "from") setInitialFrom(from);
    else setInitialTo(from);
    setTimeout(() => actionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
  };

  const filtered = useMemo(
    () => transactions.filter((t) => {
      if (!matchesFilter(t.type, filter)) return false;
      if (startDate) { if (new Date(t.createdAt) < new Date(startDate)) return false; }
      if (endDate) { const end = new Date(endDate); end.setHours(23, 59, 59, 999); if (new Date(t.createdAt) > end) return false; }
      return true;
    }),
    [transactions, filter, startDate, endDate],
  );

  // Show skeleton on first load only
  const isFirstLoad = loadingTx && transactions.length === 0;
  if (isFirstLoad && balance === 0 && balances.main === 0) {
    return <DashboardLayout title="Wallet"><WalletSkeleton /></DashboardLayout>;
  }

  return (
    <DashboardLayout title="Wallet">
      <div className="px-4 sm:px-8 pb-8 space-y-6 max-w-6xl mx-auto">

        {/* ── Total Balance Hero ─────────────────────────────────────── */}
        <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.5 }}
          className="rounded-2xl bg-white/[0.03] border border-white/[0.06] p-6 sm:p-8 relative overflow-hidden">
          {/* Animated glow blobs */}
          <motion.div
            animate={{ scale: [1, 1.15, 1], opacity: [0.08, 0.15, 0.08] }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
            className="absolute -top-20 -right-20 w-60 h-60 bg-primary rounded-full blur-3xl pointer-events-none"
          />
          <motion.div
            animate={{ scale: [1, 1.1, 1], opacity: [0.05, 0.1, 0.05] }}
            transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 2 }}
            className="absolute -bottom-20 -left-20 w-48 h-48 bg-emerald-500 rounded-full blur-3xl pointer-events-none"
          />

          <div className="relative z-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
            <div className="space-y-2">
              <p className="text-xs text-gray-500 uppercase tracking-widest font-medium flex items-center gap-1.5">
                <Coins className="w-3.5 h-3.5 text-primary" /> Total Balance
              </p>
              <div className="flex items-baseline gap-2">
                <span className="text-4xl sm:text-5xl font-display font-bold gold-text tabular-nums">
                  <AnimatedChips value={balance} className="gold-text" />
                </span>
                <span className="text-sm text-primary/70 font-semibold uppercase tracking-wider">chips</span>
              </div>
              {/* Allocation bar */}
              <div className="w-full max-w-xs">
                <AllocationBar balances={balances} total={balance} />
              </div>
            </div>
            <div className="flex flex-col items-start sm:items-end gap-2">
              {!canClaim && timeLeft ? (
                <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                  <Clock className="w-4 h-4 text-gray-500" />
                  <div>
                    <p className="text-[0.625rem] text-gray-500 uppercase tracking-wider">Next bonus in</p>
                    <p className="text-sm font-bold text-primary tabular-nums">{timeLeft}</p>
                  </div>
                </div>
              ) : (
                <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} onClick={handleClaimDaily} disabled={claiming}
                  className="flex items-center gap-2 px-5 py-3 rounded-xl font-bold text-sm uppercase tracking-wider bg-gradient-to-r from-green-500/20 to-emerald-500/20 text-green-400 border border-green-500/20 hover:border-green-500/40 transition-all disabled:opacity-50">
                  {claiming ? <Loader2 className="w-4 h-4 animate-spin" /> : <Gift className="w-4 h-4" />}
                  Claim Daily Bonus
                </motion.button>
              )}
              <div className="flex items-center gap-1.5 text-[0.625rem] text-gray-600">
                <Sparkles className="w-3 h-3 text-primary/60" />
                <span>+{bonusAmount.toLocaleString()} chips daily{hasElitePass ? " (Elite)" : ""}</span>
              </div>
            </div>
          </div>
        </motion.div>

        {/* ── Wallet Cards ────────────────────────────────────────────── */}
        <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.5, delay: 0.1 }}>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {WALLET_CONFIG.map((w, i) => {
              const Icon = w.icon;
              const amt = balances[w.key] ?? 0;
              return (
                <motion.div key={w.key}
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  whileHover={{ y: -4, transition: { duration: 0.2 } }}
                  transition={{ delay: 0.1 + i * 0.05 }}
                  className={`rounded-xl bg-gradient-to-br ${w.gradient} border ${w.border} p-4 relative overflow-hidden group cursor-pointer transition-shadow duration-300`}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.boxShadow = `0 0 20px rgba(${w.rgb}, 0.15)`; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = "none"; }}
                >
                  <div className="flex items-center gap-2 mb-3">
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${w.bg}`}>
                      <Icon className={`w-3.5 h-3.5 ${w.color}`} />
                    </div>
                    <p className="text-[0.625rem] font-bold text-gray-400 uppercase tracking-wider">{w.shortLabel}</p>
                  </div>
                  <p className={`text-lg font-bold tabular-nums ${amt > 0 ? "text-white" : "text-gray-600"}`}>
                    <AnimatedChips value={amt} className={amt > 0 ? "text-white" : "text-gray-600"} />
                  </p>
                  <p className="text-[0.5625rem] text-gray-600 mt-0.5">{w.desc}</p>

                  {/* Quick actions on hover */}
                  {w.key !== "bonus" && (
                    <div className="flex gap-1.5 mt-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                      <button onClick={(e) => { e.stopPropagation(); scrollToTransfer(w.key, "from"); }}
                        className="flex-1 py-1 rounded-md text-[0.5rem] font-bold uppercase bg-white/[0.05] border border-white/[0.08] hover:bg-white/[0.1] text-gray-400 transition-colors flex items-center justify-center gap-0.5">
                        <Send className="w-2.5 h-2.5" /> Send
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); scrollToTransfer(w.key, "to"); }}
                        className="flex-1 py-1 rounded-md text-[0.5rem] font-bold uppercase bg-white/[0.05] border border-white/[0.08] hover:bg-white/[0.1] text-gray-400 transition-colors flex items-center justify-center gap-0.5">
                        <ArrowDown className="w-2.5 h-2.5" /> Receive
                      </button>
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>
        </motion.div>

        {/* ── Actions: Transfer / Deposit / Withdraw ──────────────────── */}
        <motion.div ref={actionRef} initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.5, delay: 0.2 }}
          className="rounded-2xl bg-white/[0.03] border border-white/[0.06] p-5 sm:p-6">
          <div className="flex items-center gap-2 mb-5">
            {[
              { key: "transfer" as const, label: "Transfer", icon: ArrowRightLeft },
              { key: "deposit" as const, label: "Deposit", icon: ArrowDown },
              { key: "withdraw" as const, label: "Withdraw", icon: Send },
            ].map(tab => (
              <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider border transition-all ${
                  activeTab === tab.key ? "bg-primary/15 text-primary border-primary/25" : "bg-white/[0.02] text-gray-500 border-white/[0.05] hover:bg-white/[0.05]"
                }`}>
                <tab.icon className="w-3.5 h-3.5" /> {tab.label}
              </button>
            ))}
          </div>
          <AnimatePresence mode="wait">
            <motion.div key={activeTab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>
              {activeTab === "transfer" && <TransferPanel onComplete={refreshBalances} initialFrom={initialFrom} initialTo={initialTo} />}
              {activeTab === "deposit" && <DepositPanel />}
              {activeTab === "withdraw" && <WithdrawPanel />}
            </motion.div>
          </AnimatePresence>
        </motion.div>

        {/* ── Balance Chart ────────────────────────────────────────────── */}
        <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.5, delay: 0.3 }}
          className="rounded-2xl bg-white/[0.03] border border-white/[0.06] p-5 sm:p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xs font-display font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-primary/70" /> Balance History
            </h2>
          </div>
          <div className="h-32 sm:h-40"><BalanceChart transactions={transactions} /></div>
        </motion.div>

        {/* ── Transaction History ──────────────────────────────────────── */}
        <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.5, delay: 0.4 }}
          className="rounded-2xl bg-white/[0.03] border border-white/[0.06] p-5 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
            <h2 className="text-xs font-display font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
              <Filter className="w-4 h-4 text-primary/70" /> Transactions
              <button onClick={() => refreshTransactions()} className="p-1 rounded-md hover:bg-white/[0.05]"><RefreshCw className="w-3.5 h-3.5 text-gray-500" /></button>
              <button onClick={exportCSV} className="p-1 rounded-md hover:bg-white/[0.05]"><Download className="w-3.5 h-3.5 text-gray-500" /></button>
            </h2>
            <div className="flex items-center gap-2">
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
                className="px-2 py-1 rounded-lg bg-white/[0.03] border border-white/[0.06] text-[0.625rem] text-gray-400 outline-none focus:border-primary/20" />
              <span className="text-[0.5rem] text-gray-600">to</span>
              <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
                className="px-2 py-1 rounded-lg bg-white/[0.03] border border-white/[0.06] text-[0.625rem] text-gray-400 outline-none focus:border-primary/20" />
            </div>
          </div>

          {/* Filter chips */}
          <div className="flex flex-wrap items-center gap-1 mb-4">
            {FILTER_OPTIONS.map(opt => (
              <button key={opt.key} onClick={() => setFilter(opt.key)}
                className={`px-2.5 py-1 rounded-lg text-[0.5625rem] font-semibold uppercase tracking-wider border transition-all ${
                  filter === opt.key ? "bg-primary/15 text-primary border-primary/25" : "bg-white/[0.02] text-gray-500 border-white/[0.05] hover:text-gray-300"
                }`}>{opt.label}</button>
            ))}
          </div>

          {loadingTx && transactions.length === 0 ? (
            <div className="space-y-1">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex items-center gap-3 px-3 py-3">
                  <Skeleton className="w-8 h-8 rounded-lg bg-white/[0.05]" />
                  <div className="flex-1">
                    <Skeleton className="h-3 w-40 bg-white/[0.05] mb-1.5" />
                    <Skeleton className="h-2 w-24 bg-white/[0.03]" />
                  </div>
                  <Skeleton className="h-3 w-16 bg-white/[0.05]" />
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-600">
              <Coins className="w-10 h-10 mb-3 opacity-30" />
              <p className="text-sm font-medium">No transactions found</p>
              <p className="text-xs text-gray-700 mt-1">Try adjusting your filters</p>
            </div>
          ) : (
            <div className="space-y-0.5">
              {filtered.map((tx) => (
                <TransactionRow key={tx.id} tx={tx} />
              ))}
              {hasMore && (
                <button onClick={loadMore} disabled={loadingTx}
                  className="w-full py-3 text-[0.625rem] font-bold uppercase text-primary hover:text-white transition-colors flex items-center justify-center gap-2">
                  {loadingTx ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
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
