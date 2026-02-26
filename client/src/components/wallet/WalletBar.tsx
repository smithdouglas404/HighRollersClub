import { useState } from "react";
import { motion } from "framer-motion";
import { Link } from "wouter";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/hooks/use-toast";
import { useWallet } from "@/lib/wallet-context";
import { Coins, Gift, Loader2, Clock } from "lucide-react";

export function WalletBar() {
  const { user, refreshUser } = useAuth();
  const { toast } = useToast();
  const [claimResult, setClaimResult] = useState<{ bonus: number } | null>(null);

  const { balance, canClaim, claiming, claimDailyBonus, timeLeft } = useWallet();

  const handleClaimDaily = async () => {
    if (claiming) return;
    setClaimResult(null);
    const result = await claimDailyBonus();
    if (result.success) {
      setClaimResult({ bonus: result.bonus! });
      toast({
        title: "Daily Bonus Claimed!",
        description: `+${result.bonus!.toLocaleString()} chips added to your wallet.`,
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
        description: "Failed to claim daily bonus. Please try again.",
        variant: "destructive",
      });
    }
  };

  if (!user) return null;

  return (
    <div className="flex items-center gap-2">
      {/* Chip balance — clickable link to /wallet */}
      <Link href="/wallet">
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/15 hover:border-amber-500/30 hover:bg-amber-500/15 transition-all cursor-pointer">
          <Coins className="w-3.5 h-3.5 text-amber-400" />
          <span className="text-xs font-bold text-amber-400 tabular-nums">
            {balance.toLocaleString()}
          </span>
          <span className="text-[8px] text-amber-600 uppercase">chips</span>
        </div>
      </Link>

      {/* Daily claim */}
      <motion.button
        whileHover={{ scale: 1.03 }}
        whileTap={{ scale: 0.97 }}
        onClick={handleClaimDaily}
        disabled={claiming || !canClaim}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider text-green-400 bg-green-500/10 border border-green-500/15 hover:bg-green-500/20 transition-colors disabled:opacity-50"
      >
        {claiming ? (
          <Loader2 className="w-3 h-3 animate-spin" />
        ) : !canClaim && timeLeft ? (
          <Clock className="w-3 h-3" />
        ) : (
          <Gift className="w-3 h-3" />
        )}
        {!canClaim && timeLeft ? timeLeft : "Daily Bonus"}
      </motion.button>

      {/* Claim result toast */}
      {claimResult && (
        <motion.span
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0 }}
          className="text-[10px] font-bold text-green-400"
        >
          +{claimResult.bonus.toLocaleString()}
        </motion.span>
      )}
    </div>
  );
}
