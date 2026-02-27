import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/hooks/use-toast";
import { useWallet } from "@/lib/wallet-context";
import { useAnimatedCounter } from "@/hooks/useAnimatedCounter";
import { Coins, Gift, Loader2, Clock, ChevronDown, Wallet, ArrowRightLeft, Trophy, Gamepad2, Sparkles, ArrowDown } from "lucide-react";

const WALLET_CONFIG = [
  { key: "main" as const, label: "Main", icon: Wallet, color: "text-blue-400", bg: "bg-blue-500/10", rgb: "59,130,246" },
  { key: "cash_game" as const, label: "Cash Game", icon: Gamepad2, color: "text-green-400", bg: "bg-green-500/10", rgb: "34,197,94" },
  { key: "sng" as const, label: "Sit & Go", icon: ArrowRightLeft, color: "text-purple-400", bg: "bg-purple-500/10", rgb: "168,85,247" },
  { key: "tournament" as const, label: "Tournament", icon: Trophy, color: "text-orange-400", bg: "bg-orange-500/10", rgb: "249,115,22" },
  { key: "bonus" as const, label: "Bonus", icon: Sparkles, color: "text-pink-400", bg: "bg-pink-500/10", rgb: "236,72,153" },
];

export function WalletBar() {
  const { user, refreshUser } = useAuth();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [claimResult, setClaimResult] = useState<{ bonus: number } | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const { balance, balances, canClaim, claiming, claimDailyBonus, timeLeft, cooldownEnd, error: walletError } = useWallet();
  const { value: displayBalance, animating, delta } = useAnimatedCounter(balance);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    if (showDropdown) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showDropdown]);

  const handleClaimDaily = async () => {
    if (claiming) return;
    setClaimResult(null);
    const result = await claimDailyBonus();
    if (result.success) {
      setClaimResult({ bonus: result.bonus! });
      toast({
        title: "Daily Bonus Claimed!",
        description: `+${result.bonus!.toLocaleString()} chips added to your bonus wallet.`,
      });
      await refreshUser();
      setTimeout(() => setClaimResult(null), 3000);
    } else if (!canClaim) {
      toast({
        title: "Already Claimed",
        description: timeLeft ? `Next bonus available in ${timeLeft}` : "You already claimed your daily bonus.",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Error",
        description: walletError || "Failed to claim daily bonus. Please try again.",
        variant: "destructive",
      });
    }
  };

  if (!user) return null;

  // Progress ring for daily bonus countdown
  const radius = 11;
  const circumference = 2 * Math.PI * radius;
  const progress = cooldownEnd
    ? Math.max(0, 1 - (cooldownEnd - Date.now()) / (24 * 60 * 60 * 1000))
    : canClaim ? 1 : 0;
  const strokeDashoffset = circumference * (1 - progress);

  // Allocation bar
  const total = balance || 1;

  return (
    <div className="flex items-center gap-2">
      {/* Chip balance — clickable with dropdown */}
      <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => setShowDropdown(!showDropdown)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/15 hover:border-amber-500/30 hover:bg-amber-500/15 transition-all cursor-pointer"
        >
          <Coins className="w-3.5 h-3.5 text-amber-400" />
          <span className={`text-xs font-bold tabular-nums transition-colors duration-300 ${
            animating && delta > 0 ? "text-green-400" :
            animating && delta < 0 ? "text-red-400" :
            "text-amber-400"
          }`}>
            {displayBalance.toLocaleString()}
          </span>
          <span className="text-[0.5rem] text-amber-600 uppercase">chips</span>
          <ChevronDown className={`w-3 h-3 text-amber-600 transition-transform ${showDropdown ? "rotate-180" : ""}`} />
        </button>

        {/* Wallet dropdown */}
        <AnimatePresence>
          {showDropdown && (
            <motion.div
              initial={{ opacity: 0, y: -4, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -4, scale: 0.95 }}
              transition={{ duration: 0.15 }}
              className="absolute right-0 top-full mt-2 w-64 rounded-xl bg-gray-900/95 backdrop-blur-lg border border-white/10 shadow-xl z-50 overflow-hidden"
            >
              {/* Header with allocation bar */}
              <div className="px-3 py-2.5 border-b border-white/5 space-y-2">
                <p className="text-[0.5625rem] text-gray-500 uppercase tracking-widest font-medium">Your Wallets</p>
                <div className="flex h-1 rounded-full overflow-hidden bg-white/[0.03]">
                  {WALLET_CONFIG.map(w => {
                    const pct = ((balances[w.key] ?? 0) / total) * 100;
                    if (pct < 0.5) return null;
                    return (
                      <div key={w.key} className="h-full" style={{ width: `${pct}%`, backgroundColor: `rgba(${w.rgb}, 0.5)` }} />
                    );
                  })}
                </div>
              </div>

              {/* Wallet rows */}
              <div className="py-1">
                {WALLET_CONFIG.map((w) => {
                  const Icon = w.icon;
                  const amount = balances[w.key] ?? 0;
                  return (
                    <div key={w.key} className="flex items-center gap-2.5 px-3 py-2 hover:bg-white/[0.03] transition-colors group">
                      <div className={`w-6 h-6 rounded-md flex items-center justify-center ${w.bg}`}>
                        <Icon className={`w-3 h-3 ${w.color}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[0.625rem] text-gray-400 font-medium">{w.label}</p>
                      </div>
                      <span className={`text-xs font-bold tabular-nums ${amount > 0 ? "text-white" : "text-gray-600"}`}>
                        {amount.toLocaleString()}
                      </span>
                      {/* Quick transfer on hover */}
                      {w.key !== "bonus" && (
                        <button
                          onClick={(e) => { e.stopPropagation(); setShowDropdown(false); navigate(`/wallet?tab=transfer&from=${w.key}`); }}
                          className="opacity-0 group-hover:opacity-100 p-1 rounded-md hover:bg-white/[0.08] transition-all"
                          title={`Transfer from ${w.label}`}
                        >
                          <ArrowRightLeft className="w-3 h-3 text-gray-500" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Footer with actions */}
              <div className="px-3 py-2 border-t border-white/5 flex items-center justify-between">
                <Link href="/wallet" onClick={() => setShowDropdown(false)}>
                  <span className="text-[0.625rem] font-semibold text-amber-400 hover:text-amber-300 transition-colors cursor-pointer">
                    Manage Wallets &rarr;
                  </span>
                </Link>
                <Link href="/wallet?tab=deposit" onClick={() => setShowDropdown(false)}>
                  <span className="flex items-center gap-1 text-[0.625rem] font-semibold text-green-400 hover:text-green-300 transition-colors cursor-pointer">
                    <ArrowDown className="w-3 h-3" /> Deposit
                  </span>
                </Link>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Daily claim with progress ring */}
      <motion.button
        whileHover={{ scale: 1.03 }}
        whileTap={{ scale: 0.97 }}
        onClick={handleClaimDaily}
        disabled={claiming || !canClaim}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[0.625rem] font-bold uppercase tracking-wider text-green-400 bg-green-500/10 border border-green-500/15 hover:bg-green-500/20 transition-colors disabled:opacity-50 relative"
      >
        {/* Progress ring */}
        <div className="relative w-4 h-4">
          <svg className="absolute -inset-0.5 w-5 h-5 -rotate-90" viewBox="0 0 28 28">
            <circle cx="14" cy="14" r={radius} fill="none" stroke="rgba(74,222,128,0.12)" strokeWidth="2" />
            <circle
              cx="14" cy="14" r={radius} fill="none" stroke="rgb(74,222,128)"
              strokeWidth="2" strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              style={{ transition: "stroke-dashoffset 1s ease-out" }}
            />
          </svg>
          {claiming ? (
            <Loader2 className="w-3 h-3 animate-spin absolute inset-0.5" />
          ) : !canClaim && timeLeft ? (
            <Clock className="w-3 h-3 absolute inset-0.5" />
          ) : (
            <Gift className="w-3 h-3 absolute inset-0.5" />
          )}
        </div>
        {!canClaim && timeLeft ? timeLeft : "Daily Bonus"}
      </motion.button>

      {/* Claim result float-up */}
      <AnimatePresence>
        {claimResult && (
          <motion.span
            initial={{ opacity: 1, y: 0 }}
            animate={{ opacity: 0, y: -30 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.5, ease: "easeOut" }}
            className="absolute -top-2 right-0 text-sm font-bold text-green-400 pointer-events-none"
          >
            +{claimResult.bonus.toLocaleString()}
          </motion.span>
        )}
      </AnimatePresence>
    </div>
  );
}
