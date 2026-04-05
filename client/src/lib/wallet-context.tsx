import { createContext, useContext, useState, useEffect, useCallback, useRef, type ReactNode } from "react";
import { useAuth } from "@/lib/auth-context";

// ── Types ─────────────────────────────────────────────────────────────
export type WalletType = "main" | "cash_game" | "sng" | "tournament" | "bonus";

export interface WalletBalances {
  main: number;
  cash_game: number;
  sng: number;
  tournament: number;
  bonus: number;
  total: number;
}

export interface Transaction {
  id: string;
  type: string;
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  description: string | null;
  walletType?: string | null;
  createdAt: string;
}

export interface AllocationEntry {
  walletType: WalletType;
  amount: number;
}

interface WalletContextValue {
  // Multi-wallet balances
  balances: WalletBalances;
  refreshBalances: () => Promise<void>;

  // Backward compat: total balance
  balance: number;
  refreshBalance: () => Promise<void>;

  // Transfers
  transfer: (from: WalletType, to: WalletType, amount: number) => Promise<{ success: boolean; error?: string }>;

  // Daily bonus
  canClaim: boolean;
  claiming: boolean;
  bonusAmount: number;
  hasElitePass: boolean;
  timeLeft: string;
  cooldownEnd: number | null;
  claimDailyBonus: () => Promise<{ success: boolean; bonus?: number }>;

  // Transactions
  transactions: Transaction[];
  loadingTransactions: boolean;
  hasMore: boolean;
  loadMore: () => Promise<void>;
  refreshTransactions: () => Promise<void>;

  error: string | null;
}

const WalletContext = createContext<WalletContextValue | null>(null);

const PAGE_SIZE = 50;

const DEFAULT_BALANCES: WalletBalances = {
  main: 0, cash_game: 0, sng: 0, tournament: 0, bonus: 0, total: 0,
};

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

function computeTotal(b: Omit<WalletBalances, "total">): number {
  return (b.main || 0) + (b.cash_game || 0) + (b.sng || 0) + (b.tournament || 0) + (b.bonus || 0);
}

export function WalletProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();

  // ── Error state (declared early — referenced in callbacks below) ────
  const [error, setError] = useState<string | null>(null);

  // ── Multi-Wallet Balances ───────────────────────────────────────────
  const [balances, setBalances] = useState<WalletBalances>(DEFAULT_BALANCES);
  const balance = balances.total;

  useEffect(() => {
    if (user?.chipBalance != null) {
      setBalances(prev => ({ ...prev, total: user.chipBalance }));
    }
  }, [user?.chipBalance]);

  const refreshBalances = useCallback(async () => {
    try {
      const res = await fetch("/api/wallet/balances");
      if (res.ok) {
        const data = await res.json();
        setBalances({
          main: data.balances?.main ?? 0,
          cash_game: data.balances?.cash_game ?? 0,
          sng: data.balances?.sng ?? 0,
          tournament: data.balances?.tournament ?? 0,
          bonus: data.balances?.bonus ?? 0,
          total: data.total ?? 0,
        });
        return;
      }
    } catch {
      // Primary endpoint failed — try fallback
    }
    try {
      const res = await fetch("/api/wallet/balance");
      if (res.ok) {
        const data = await res.json();
        setBalances(prev => ({ ...prev, total: data.balance }));
      }
    } catch {
      setError("Failed to load wallet balances");
    }
  }, []);

  const refreshBalance = refreshBalances;

  useEffect(() => {
    if (user) refreshBalances();
  }, [user, refreshBalances]);

  // ── Transfer (with optimistic update) ─────────────────────────────
  const balancesRef = useRef(balances);
  balancesRef.current = balances;

  const transfer = useCallback(async (from: WalletType, to: WalletType, amount: number) => {
    // Optimistic update
    const previous = { ...balancesRef.current };
    setBalances(prev => {
      const updated = { ...prev };
      updated[from] = (updated[from] || 0) - amount;
      updated[to] = (updated[to] || 0) + amount;
      updated.total = computeTotal(updated);
      return updated;
    });

    try {
      const res = await fetch("/api/wallet/transfer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ from, to, amount }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.balances) {
          setBalances(prev => {
            const b = { ...prev, ...data.balances };
            b.total = computeTotal(b);
            return b;
          });
        }
        return { success: true };
      }
      // Rollback on failure
      setBalances(previous);
      const err = await res.json().catch(() => ({ message: "Transfer failed" }));
      return { success: false, error: err.message };
    } catch {
      setBalances(previous);
      return { success: false, error: "Network error" };
    }
  }, []);

  // ── Daily bonus ───────────────────────────────────────────────────
  const [canClaim, setCanClaim] = useState(true);
  const [claiming, setClaiming] = useState(false);
  const [bonusAmount, setBonusAmount] = useState(1000);
  const [cooldownEnd, setCooldownEnd] = useState<number | null>(null);
  const [timeLeft, setTimeLeft] = useState("");
  const hasElitePass = bonusAmount >= 2000;

  const refreshDailyStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/wallet/daily-status");
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
    } catch {
      // Daily status is non-critical; don't surface error
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    refreshDailyStatus();
  }, [user, refreshDailyStatus]);

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
      setError("Failed to load transactions");
    } finally {
      setLoadingTransactions(false);
    }
  }, []);

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
  const claimDailyBonus = useCallback(async (): Promise<{ success: boolean; bonus?: number }> => {
    if (claiming || !canClaim) return { success: false };
    setClaiming(true);
    setError(null);
    try {
      const res = await fetch("/api/wallet/claim-daily", { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        await refreshBalances();
        await refreshDailyStatus();
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
  }, [claiming, canClaim, fetchTransactionsPage, refreshBalances, refreshDailyStatus]);

  const value: WalletContextValue = {
    balances,
    refreshBalances,
    balance,
    refreshBalance,
    transfer,
    canClaim,
    claiming,
    bonusAmount,
    hasElitePass,
    timeLeft,
    cooldownEnd,
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
