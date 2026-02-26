import { createContext, useContext, useState, useEffect, useCallback, useRef, type ReactNode } from "react";
import { useAuth } from "@/lib/auth-context";

// ── Types ─────────────────────────────────────────────────────────────
export interface Transaction {
  id: string;
  type: string;
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  description: string | null;
  createdAt: string;
}

interface WalletContextValue {
  balance: number;
  refreshBalance: () => Promise<void>;

  canClaim: boolean;
  claiming: boolean;
  bonusAmount: number;
  hasElitePass: boolean;
  timeLeft: string;
  claimDailyBonus: () => Promise<{ success: boolean; bonus?: number }>;

  transactions: Transaction[];
  loadingTransactions: boolean;
  hasMore: boolean;
  loadMore: () => Promise<void>;
  refreshTransactions: () => Promise<void>;

  error: string | null;
}

const WalletContext = createContext<WalletContextValue | null>(null);

const PAGE_SIZE = 50;

function formatTimeRemaining(ms: number): string {
  if (ms <= 0) return "";
  const hours = Math.floor(ms / (1000 * 60 * 60));
  const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((ms % (1000 * 60)) / 1000);
  const parts: string[] = [];
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0 || hours > 0) parts.push(`${minutes}m`);
  parts.push(`${seconds}s`);
  return parts.join(" ");
}

export function WalletProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();

  // ── Balance ───────────────────────────────────────────────────────
  const [balance, setBalance] = useState<number>(user?.chipBalance ?? 0);

  useEffect(() => {
    if (user?.chipBalance != null) setBalance(user.chipBalance);
  }, [user?.chipBalance]);

  const refreshBalance = useCallback(async () => {
    try {
      const res = await fetch("/api/wallet/balance");
      if (res.ok) {
        const data = await res.json();
        setBalance(data.balance);
      }
    } catch {
      // silent
    }
  }, []);

  useEffect(() => {
    if (user) refreshBalance();
  }, [user, refreshBalance]);

  // ── Daily bonus ───────────────────────────────────────────────────
  const [canClaim, setCanClaim] = useState(true);
  const [claiming, setClaiming] = useState(false);
  const [bonusAmount, setBonusAmount] = useState(1000);
  const [cooldownEnd, setCooldownEnd] = useState<number | null>(null);
  const [timeLeft, setTimeLeft] = useState("");
  const hasElitePass = bonusAmount >= 2000;

  useEffect(() => {
    if (!user) return;
    fetch("/api/wallet/daily-status")
      .then(async (res) => {
        if (res.ok) {
          const data = await res.json();
          if (data.bonusAmount) setBonusAmount(data.bonusAmount);
          if (data.canClaim) {
            setCanClaim(true);
            setCooldownEnd(null);
          } else if (data.nextClaimAt) {
            setCanClaim(false);
            setCooldownEnd(new Date(data.nextClaimAt).getTime());
          }
        }
      })
      .catch(() => {});
  }, [user]);

  useEffect(() => {
    if (cooldownEnd == null) {
      setTimeLeft("");
      return;
    }
    function tick() {
      const remaining = (cooldownEnd as number) - Date.now();
      if (remaining <= 0) {
        setCooldownEnd(null);
        setCanClaim(true);
        setTimeLeft("");
      } else {
        setTimeLeft(formatTimeRemaining(remaining));
      }
    }
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [cooldownEnd]);

  // ── Transactions ──────────────────────────────────────────────────
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loadingTransactions, setLoadingTransactions] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const offsetRef = useRef(0);

  const fetchTransactionsPage = useCallback(async (offset: number, append: boolean) => {
    setLoadingTransactions(true);
    try {
      const res = await fetch(`/api/wallet/transactions?limit=${PAGE_SIZE}&offset=${offset}`);
      if (res.ok) {
        const data: Transaction[] = await res.json();
        if (append) {
          setTransactions(prev => [...prev, ...data]);
        } else {
          setTransactions(data);
        }
        setHasMore(data.length === PAGE_SIZE);
        offsetRef.current = offset + data.length;
      }
    } catch {
      // silent
    } finally {
      setLoadingTransactions(false);
    }
  }, []);

  // Fetch initial transactions when user is available
  useEffect(() => {
    if (!user) return;
    offsetRef.current = 0;
    fetchTransactionsPage(0, false);
  }, [user, fetchTransactionsPage]);

  const loadMore = useCallback(async () => {
    await fetchTransactionsPage(offsetRef.current, true);
  }, [fetchTransactionsPage]);

  const refreshTransactions = useCallback(async () => {
    offsetRef.current = 0;
    await fetchTransactionsPage(0, false);
  }, [fetchTransactionsPage]);

  // ── Claim daily bonus ─────────────────────────────────────────────
  const [error, setError] = useState<string | null>(null);

  const claimDailyBonus = useCallback(async (): Promise<{ success: boolean; bonus?: number }> => {
    if (claiming || !canClaim) return { success: false };
    setClaiming(true);
    setError(null);
    try {
      const res = await fetch("/api/wallet/claim-daily", { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        setBalance(data.balance);
        setCanClaim(false);
        setCooldownEnd(data.nextClaimAt ? new Date(data.nextClaimAt).getTime() : Date.now() + 24 * 60 * 60 * 1000);
        // Refresh transactions
        offsetRef.current = 0;
        fetchTransactionsPage(0, false);
        return { success: true, bonus: data.bonus };
      } else if (res.status === 429) {
        const data = await res.json().catch(() => null);
        if (data?.nextClaimAt) {
          setCooldownEnd(new Date(data.nextClaimAt).getTime());
          setCanClaim(false);
        }
        setError(data?.message || "Already claimed");
        return { success: false };
      } else {
        setError("Failed to claim daily bonus");
        return { success: false };
      }
    } catch {
      setError("Network error");
      return { success: false };
    } finally {
      setClaiming(false);
    }
  }, [claiming, canClaim, fetchTransactionsPage]);

  const value: WalletContextValue = {
    balance,
    refreshBalance,
    canClaim,
    claiming,
    bonusAmount,
    hasElitePass,
    timeLeft,
    claimDailyBonus,
    transactions,
    loadingTransactions,
    hasMore,
    loadMore,
    refreshTransactions,
    error,
  };

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

/** Shared wallet hook — all consumers share the same state */
export function useWallet() {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error("useWallet must be used within WalletProvider");
  return ctx;
}
