import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Link } from "wouter";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/hooks/use-toast";
import { Coins, Gift, Loader2 } from "lucide-react";

export function WalletBar() {
  const { user, refreshUser } = useAuth();
  const { toast } = useToast();
  const [claiming, setClaiming] = useState(false);
  const [claimResult, setClaimResult] = useState<{ bonus: number } | null>(null);
  const [balance, setBalance] = useState<number | null>(null);

  useEffect(() => {
    if (user) setBalance(user.chipBalance);
  }, [user?.chipBalance]);

  // Fetch fresh balance on mount
  useEffect(() => {
    fetch("/api/wallet/balance")
      .then((r) => r.ok ? r.json() : null)
      .then((data) => { if (data?.balance != null) setBalance(data.balance); })
      .catch(() => {});
  }, []);

  const handleClaimDaily = async () => {
    if (claiming) return;
    setClaiming(true);
    setClaimResult(null);
    try {
      const res = await fetch("/api/wallet/claim-daily", { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        setBalance(data.balance);
        setClaimResult({ bonus: data.bonus });
        toast({
          title: "Daily Bonus Claimed!",
          description: `+${data.bonus.toLocaleString()} chips added to your wallet.`,
        });
        await refreshUser();
        setTimeout(() => setClaimResult(null), 3000);
      } else if (res.status === 429) {
        const data = await res.json();
        let cooldownMsg = data.message || "You already claimed your daily bonus.";
        if (data.nextClaimAt) {
          const remaining = new Date(data.nextClaimAt).getTime() - Date.now();
          if (remaining > 0) {
            const hours = Math.floor(remaining / (1000 * 60 * 60));
            const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
            cooldownMsg = `Next bonus available in ${hours > 0 ? `${hours}h ` : ""}${minutes}m`;
          }
        }
        toast({
          title: "Already Claimed",
          description: cooldownMsg,
          variant: "destructive",
        });
      }
    } catch {
      toast({
        title: "Error",
        description: "Failed to claim daily bonus. Please try again.",
        variant: "destructive",
      });
    } finally {
      setClaiming(false);
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
            {(balance ?? user.chipBalance).toLocaleString()}
          </span>
          <span className="text-[8px] text-amber-600 uppercase">chips</span>
        </div>
      </Link>

      {/* Daily claim */}
      <motion.button
        whileHover={{ scale: 1.03 }}
        whileTap={{ scale: 0.97 }}
        onClick={handleClaimDaily}
        disabled={claiming}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider text-green-400 bg-green-500/10 border border-green-500/15 hover:bg-green-500/20 transition-colors disabled:opacity-50"
      >
        {claiming ? (
          <Loader2 className="w-3 h-3 animate-spin" />
        ) : (
          <Gift className="w-3 h-3" />
        )}
        Daily Bonus
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
