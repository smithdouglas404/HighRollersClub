import { useState, useEffect, useCallback, useRef } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useAuth } from "@/lib/auth-context";
import { GoldButton, GoldCard, SectionHeader, GoldDivider } from "@/components/premium/PremiumComponents";
import {
  Search, Filter, ChevronDown, ChevronRight, ExternalLink, Copy, Check,
  ArrowDownCircle, ArrowUpCircle, RefreshCw, Loader2, Shield, Link as LinkIcon,
  Coins, CreditCard, Gamepad2, ShieldCheck, AlertTriangle,
} from "lucide-react";

// ─── Types ──────────────────────────────────────────────────────────────────

interface TransactionRecord {
  id: string;
  user_id: string;
  username?: string;
  display_name?: string;
  type: string;
  amount: number;
  balance_before: number;
  balance_after: number;
  description: string | null;
  wallet_type: string | null;
  payment_id: string | null;
  metadata: any;
  created_at: string;
}

interface PaymentRecord {
  id: string;
  user_id: string;
  username?: string;
  display_name?: string;
  direction: string;
  status: string;
  amount_fiat: number;
  amount_crypto: string | null;
  currency: string;
  chip_amount: number;
  gateway_provider: string | null;
  deposit_address: string | null;
  tx_hash: string | null;
  confirmations: number;
  required_confirmations: number;
  withdrawal_address: string | null;
  created_at: string;
}

interface HandRecord {
  id: string;
  table_id: string;
  table_name: string | null;
  hand_number: number;
  pot_total: number;
  total_rake: number;
  commitment_hash: string | null;
  vrf_request_id: string | null;
  vrf_random_word: string | null;
  on_chain_commit_tx: string | null;
  on_chain_reveal_tx: string | null;
  winner_ids: string[] | null;
  created_at: string;
}

interface VerificationResult {
  hand: {
    id: string;
    commitmentHash: string;
    onChainCommitTx: string | null;
    onChainRevealTx: string | null;
    vrfRequestId: string | null;
  };
  onChain: {
    committed: boolean;
    revealed: boolean;
    commitHash: string;
    timestamp: number;
    explorerUrl?: string;
    error?: string;
  } | null;
  explorerLinks: {
    commitTx: string | null;
    revealTx: string | null;
  };
}

// ─── Constants ──────────────────────────────────────────────────────────────

const TX_TYPES = [
  { value: "all", label: "All Types" },
  { value: "deposit", label: "Deposit" },
  { value: "withdraw", label: "Withdrawal" },
  { value: "buyin", label: "Buy-in" },
  { value: "cashout", label: "Cash Out" },
  { value: "bonus", label: "Bonus" },
  { value: "rake", label: "Rake" },
  { value: "prize", label: "Prize" },
  { value: "transfer", label: "Transfer" },
  { value: "purchase", label: "Purchase" },
  { value: "rakeback", label: "Rakeback" },
];

const WALLET_TYPES = [
  { value: "all", label: "All Wallets" },
  { value: "main", label: "Main" },
  { value: "cash_game", label: "Cash Game" },
  { value: "sng", label: "SNG" },
  { value: "tournament", label: "Tournament" },
  { value: "bonus", label: "Bonus" },
];

const PAYMENT_STATUSES = [
  { value: "", label: "All Statuses" },
  { value: "pending", label: "Pending" },
  { value: "confirming", label: "Confirming" },
  { value: "confirmed", label: "Confirmed" },
  { value: "credited", label: "Credited" },
  { value: "failed", label: "Failed" },
  { value: "expired", label: "Expired" },
];

type TabType = "transactions" | "payments" | "hands";

function getExplorerUrl(txHash: string, currency?: string): string {
  if (!txHash) return "";
  // Polygon Amoy testnet by default
  if (currency === "SOL") return `https://solscan.io/tx/${txHash}`;
  if (currency === "BTC") return `https://blockchair.com/bitcoin/transaction/${txHash}`;
  if (currency === "ETH") return `https://etherscan.io/tx/${txHash}`;
  // Default: Polygon Amoy
  return `https://amoy.polygonscan.com/tx/${txHash}`;
}

function formatChips(amount: number): string {
  if (Math.abs(amount) >= 1_000_000) return `${(amount / 1_000_000).toFixed(1)}M`;
  if (Math.abs(amount) >= 1_000) return `${(amount / 1_000).toFixed(1)}K`;
  return amount.toLocaleString();
}

function shortenHash(hash: string, chars = 8): string {
  if (!hash || hash.length < chars * 2 + 2) return hash || "";
  return `${hash.slice(0, chars + 2)}...${hash.slice(-chars)}`;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
      className="p-1 hover:bg-white/5 rounded transition-colors"
      title="Copy to clipboard"
    >
      {copied ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3 text-gray-500" />}
    </button>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    pending: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
    confirming: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    confirmed: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
    credited: "bg-green-500/10 text-green-400 border-green-500/20",
    completed: "bg-green-500/10 text-green-400 border-green-500/20",
    failed: "bg-red-500/10 text-red-400 border-red-500/20",
    expired: "bg-gray-500/10 text-gray-400 border-gray-500/20",
    cancelled: "bg-gray-500/10 text-gray-400 border-gray-500/20",
    processing: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  };
  return (
    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${colors[status] || "bg-gray-500/10 text-gray-400 border-gray-500/20"}`}>
      {status}
    </span>
  );
}

function TxHashLink({ hash, currency }: { hash: string; currency?: string }) {
  if (!hash) return <span className="text-gray-600">—</span>;
  const url = getExplorerUrl(hash, currency);
  return (
    <span className="inline-flex items-center gap-1 font-mono text-xs">
      <span className="text-purple-400">{shortenHash(hash)}</span>
      <CopyButton text={hash} />
      <a href={url} target="_blank" rel="noopener noreferrer" className="text-purple-400 hover:text-purple-300">
        <ExternalLink className="w-3 h-3" />
      </a>
    </span>
  );
}

// ─── Blockchain Verification Panel ──────────────────────────────────────────

function BlockchainVerifier({ tableId, handNumber }: { tableId: string; handNumber: number }) {
  const [result, setResult] = useState<VerificationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const verify = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/explorer/verify/${tableId}/${handNumber}`);
      if (!res.ok) throw new Error((await res.json()).message || "Verification failed");
      setResult(await res.json());
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-3 p-3 rounded-lg bg-black/20 border border-white/5">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-bold text-purple-400 flex items-center gap-1">
          <ShieldCheck className="w-3.5 h-3.5" /> On-Chain Verification
        </span>
        <button
          onClick={verify}
          disabled={loading}
          className="px-3 py-1 rounded text-xs font-bold bg-purple-500/10 text-purple-300 border border-purple-500/20 hover:bg-purple-500/20 transition-all disabled:opacity-50"
        >
          {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : "Verify"}
        </button>
      </div>

      {error && <p className="text-xs text-red-400">{error}</p>}

      {result && (
        <div className="space-y-2 text-xs">
          {/* Local record */}
          <div className="space-y-1">
            <div className="text-gray-500">Commitment Hash:</div>
            <div className="font-mono text-[10px] text-gray-300 break-all">{result.hand.commitmentHash || "—"}</div>
          </div>

          {/* On-chain status */}
          {result.onChain && !result.onChain.error ? (
            <div className="p-2 rounded bg-green-500/5 border border-green-500/10">
              <div className="flex items-center gap-2 mb-1">
                <ShieldCheck className="w-3.5 h-3.5 text-green-400" />
                <span className="text-green-400 font-bold">Verified On-Chain</span>
              </div>
              <div className="space-y-0.5 text-gray-400">
                <div>Committed: {result.onChain.committed ? "Yes" : "No"}</div>
                <div>Revealed: {result.onChain.revealed ? "Yes" : "No"}</div>
                {result.onChain.timestamp > 0 && (
                  <div>Block time: {new Date(result.onChain.timestamp * 1000).toLocaleString()}</div>
                )}
              </div>
            </div>
          ) : result.onChain?.error ? (
            <div className="p-2 rounded bg-yellow-500/5 border border-yellow-500/10">
              <div className="flex items-center gap-1 text-yellow-400">
                <AlertTriangle className="w-3 h-3" />
                <span className="font-bold text-xs">Chain query failed</span>
              </div>
              <p className="text-gray-500 text-[10px] mt-1">{result.onChain.error}</p>
            </div>
          ) : (
            <div className="p-2 rounded bg-gray-500/5 border border-gray-500/10">
              <span className="text-gray-500">Blockchain not configured — hash recorded locally</span>
            </div>
          )}

          {/* Explorer links */}
          {(result.explorerLinks.commitTx || result.explorerLinks.revealTx) && (
            <div className="space-y-1">
              {result.explorerLinks.commitTx && (
                <a href={result.explorerLinks.commitTx} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1 text-purple-400 hover:text-purple-300">
                  <LinkIcon className="w-3 h-3" /> View Commit Tx on Polygonscan
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
              {result.explorerLinks.revealTx && (
                <a href={result.explorerLinks.revealTx} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1 text-purple-400 hover:text-purple-300">
                  <LinkIcon className="w-3 h-3" /> View Reveal Tx on Polygonscan
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────

export default function TransactionExplorer() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  const [tab, setTab] = useState<TabType>("transactions");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleSearchChange = (value: string) => {
    setSearchInput(value);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      setSearch(value);
    }, 300);
  };
  useEffect(() => {
    return () => { if (searchTimerRef.current) clearTimeout(searchTimerRef.current); };
  }, []);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 25;

  // Transaction filters
  const [txType, setTxType] = useState("all");
  const [txWallet, setTxWallet] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [txResults, setTxResults] = useState<TransactionRecord[]>([]);
  const [txTotal, setTxTotal] = useState(0);

  // Payment filters
  const [payDirection, setPayDirection] = useState("");
  const [payStatus, setPayStatus] = useState("");
  const [payCurrency, setPayCurrency] = useState("");
  const [payResults, setPayResults] = useState<PaymentRecord[]>([]);
  const [payTotal, setPayTotal] = useState(0);

  // Hand filters
  const [handTableId, setHandTableId] = useState("");
  const [handOnChainOnly, setHandOnChainOnly] = useState(false);
  const [handResults, setHandResults] = useState<HandRecord[]>([]);
  const [handTotal, setHandTotal] = useState(0);

  // Expanded rows
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const toggleExpand = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      if (tab === "transactions") {
        const params = new URLSearchParams({
          limit: String(PAGE_SIZE), offset: String(page * PAGE_SIZE),
          ...(txType !== "all" && { type: txType }),
          ...(txWallet !== "all" && { wallet: txWallet }),
          ...(dateFrom && { from: dateFrom }),
          ...(dateTo && { to: dateTo }),
          ...(search && { search }),
          ...(isAdmin && { all: "true" }),
        });
        const res = await fetch(`/api/explorer/transactions?${params}`);
        const data = await res.json();
        setTxResults(data.results || []);
        setTxTotal(data.total || 0);
      } else if (tab === "payments") {
        const params = new URLSearchParams({
          limit: String(PAGE_SIZE), offset: String(page * PAGE_SIZE),
          ...(payDirection && { direction: payDirection }),
          ...(payStatus && { status: payStatus }),
          ...(payCurrency && { currency: payCurrency }),
          ...(search && { search }),
          ...(isAdmin && { all: "true" }),
        });
        const res = await fetch(`/api/explorer/payments?${params}`);
        const data = await res.json();
        setPayResults(data.results || []);
        setPayTotal(data.total || 0);
      } else {
        const params = new URLSearchParams({
          limit: String(PAGE_SIZE), offset: String(page * PAGE_SIZE),
          ...(handTableId && { tableId: handTableId }),
          ...(handOnChainOnly && { onChainOnly: "true" }),
          ...(search && { search }),
        });
        const res = await fetch(`/api/explorer/hands?${params}`);
        const data = await res.json();
        setHandResults(data.results || []);
        setHandTotal(data.total || 0);
      }
    } catch {
      // Silently handle fetch errors
    } finally {
      setLoading(false);
    }
  }, [tab, page, txType, txWallet, dateFrom, dateTo, search, payDirection, payStatus, payCurrency, handTableId, handOnChainOnly, isAdmin]);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => { setPage(0); }, [tab, txType, txWallet, dateFrom, dateTo, search, payDirection, payStatus, payCurrency, handTableId, handOnChainOnly]);

  const totalForTab = tab === "transactions" ? txTotal : tab === "payments" ? payTotal : handTotal;
  const totalPages = Math.ceil(totalForTab / PAGE_SIZE);

  return (
    <DashboardLayout title="Transaction Explorer">
      <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-xl font-display font-black text-white flex items-center gap-2">
              <Search className="w-5 h-5 text-primary" />
              Transaction Explorer
            </h1>
            <p className="text-xs text-gray-500 mt-0.5">Search and verify all platform activity</p>
          </div>
          <GoldButton onClick={fetchData} disabled={loading}>
            <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} /> Refresh
          </GoldButton>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 p-1 rounded-lg bg-black/20 border border-white/5">
          {([
            { key: "transactions" as TabType, label: "Transactions", icon: Coins, count: txTotal },
            { key: "payments" as TabType, label: "Payments", icon: CreditCard, count: payTotal },
            { key: "hands" as TabType, label: "Game Hands", icon: Gamepad2, count: handTotal },
          ]).map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-xs font-bold transition-all ${
                tab === t.key ? "bg-[#d4af37]/15 text-[#d4af37] border border-[#d4af37]/20" : "text-gray-500 hover:text-gray-300 hover:bg-white/5"
              }`}
            >
              <t.icon className="w-3.5 h-3.5" />
              {t.label}
              {t.count > 0 && <span className="text-[10px] opacity-60">({t.count})</span>}
            </button>
          ))}
        </div>

        {/* Search + Filters */}
        <div className="flex flex-wrap gap-2">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
            <input
              type="text"
              placeholder={tab === "hands" ? "Search by ID, hash, or tx..." : "Search by ID, description, or tx hash..."}
              value={searchInput}
              onChange={e => handleSearchChange(e.target.value)}
              className="w-full pl-9 pr-3 py-2 rounded-lg bg-black/30 border border-white/10 text-white text-sm focus:outline-none focus:border-primary/40"
            />
          </div>

          {tab === "transactions" && (
            <>
              <select value={txType} onChange={e => setTxType(e.target.value)} className="px-3 py-2 rounded-lg bg-black/30 border border-white/10 text-white text-xs">
                {TX_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
              <select value={txWallet} onChange={e => setTxWallet(e.target.value)} className="px-3 py-2 rounded-lg bg-black/30 border border-white/10 text-white text-xs">
                {WALLET_TYPES.map(w => <option key={w.value} value={w.value}>{w.label}</option>)}
              </select>
              <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="px-3 py-2 rounded-lg bg-black/30 border border-white/10 text-white text-xs" />
              <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="px-3 py-2 rounded-lg bg-black/30 border border-white/10 text-white text-xs" />
            </>
          )}

          {tab === "payments" && (
            <>
              <select value={payDirection} onChange={e => setPayDirection(e.target.value)} className="px-3 py-2 rounded-lg bg-black/30 border border-white/10 text-white text-xs">
                <option value="">All Directions</option>
                <option value="deposit">Deposits</option>
                <option value="withdrawal">Withdrawals</option>
              </select>
              <select value={payStatus} onChange={e => setPayStatus(e.target.value)} className="px-3 py-2 rounded-lg bg-black/30 border border-white/10 text-white text-xs">
                {PAYMENT_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
              <select value={payCurrency} onChange={e => setPayCurrency(e.target.value)} className="px-3 py-2 rounded-lg bg-black/30 border border-white/10 text-white text-xs">
                <option value="">All Currencies</option>
                <option value="USD">USD</option>
                <option value="BTC">BTC</option>
                <option value="ETH">ETH</option>
                <option value="USDT">USDT</option>
                <option value="SOL">SOL</option>
              </select>
            </>
          )}

          {tab === "hands" && (
            <>
              <input
                type="text"
                placeholder="Filter by Table ID"
                value={handTableId}
                onChange={e => setHandTableId(e.target.value)}
                className="px-3 py-2 rounded-lg bg-black/30 border border-white/10 text-white text-xs w-44"
              />
              <label className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-black/30 border border-white/10 text-xs text-gray-300 cursor-pointer">
                <input type="checkbox" checked={handOnChainOnly} onChange={e => setHandOnChainOnly(e.target.checked)} className="accent-primary" />
                On-chain only
              </label>
            </>
          )}
        </div>

        {/* Results */}
        <div className="rounded-xl border border-white/10 bg-surface-high/30 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : (
            <>
              {/* Transactions Tab */}
              {tab === "transactions" && (
                <div className="divide-y divide-white/5">
                  {txResults.length === 0 ? (
                    <div className="py-12 text-center text-gray-500 text-sm">No transactions found</div>
                  ) : txResults.map(tx => (
                    <div key={tx.id} className="hover:bg-white/[0.02] transition-colors">
                      <button onClick={() => toggleExpand(tx.id)} className="w-full flex items-center gap-3 px-4 py-3 text-left">
                        {expanded.has(tx.id) ? <ChevronDown className="w-3.5 h-3.5 text-gray-500 flex-shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 text-gray-500 flex-shrink-0" />}
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${tx.amount >= 0 ? "bg-green-500/10" : "bg-red-500/10"}`}>
                          {tx.amount >= 0 ? <ArrowDownCircle className="w-4 h-4 text-green-400" /> : <ArrowUpCircle className="w-4 h-4 text-red-400" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-white capitalize">{tx.type.replace("_", " ")}</span>
                            {tx.wallet_type && <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-gray-500">{tx.wallet_type}</span>}
                            {isAdmin && tx.username && <span className="text-[10px] text-gray-500">@{tx.username}</span>}
                          </div>
                          <p className="text-[10px] text-gray-500 truncate">{tx.description || tx.id}</p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <div className={`text-sm font-bold ${tx.amount >= 0 ? "text-green-400" : "text-red-400"}`}>
                            {tx.amount >= 0 ? "+" : ""}{formatChips(tx.amount)}
                          </div>
                          <div className="text-[10px] text-gray-600">{new Date(tx.created_at).toLocaleDateString()}</div>
                        </div>
                      </button>
                      {expanded.has(tx.id) && (
                        <div className="px-4 pb-3 ml-11 space-y-1.5 text-xs">
                          <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-gray-400">
                            <div>ID: <span className="text-gray-300 font-mono text-[10px]">{tx.id}</span> <CopyButton text={tx.id} /></div>
                            <div>Time: <span className="text-gray-300">{new Date(tx.created_at).toLocaleString()}</span></div>
                            <div>Before: <span className="text-gray-300">{formatChips(tx.balance_before)}</span></div>
                            <div>After: <span className="text-gray-300">{formatChips(tx.balance_after)}</span></div>
                            {tx.payment_id && <div>Payment: <span className="text-gray-300 font-mono text-[10px]">{shortenHash(tx.payment_id)}</span> <CopyButton text={tx.payment_id} /></div>}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Payments Tab */}
              {tab === "payments" && (
                <div className="divide-y divide-white/5">
                  {payResults.length === 0 ? (
                    <div className="py-12 text-center text-gray-500 text-sm">No payments found</div>
                  ) : payResults.map(pay => (
                    <div key={pay.id} className="hover:bg-white/[0.02] transition-colors">
                      <button onClick={() => toggleExpand(pay.id)} className="w-full flex items-center gap-3 px-4 py-3 text-left">
                        {expanded.has(pay.id) ? <ChevronDown className="w-3.5 h-3.5 text-gray-500 flex-shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 text-gray-500 flex-shrink-0" />}
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${pay.direction === "deposit" ? "bg-green-500/10" : "bg-orange-500/10"}`}>
                          {pay.direction === "deposit" ? <ArrowDownCircle className="w-4 h-4 text-green-400" /> : <ArrowUpCircle className="w-4 h-4 text-orange-400" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-white capitalize">{pay.direction}</span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-gray-400">{pay.currency}</span>
                            <StatusBadge status={pay.status} />
                            {isAdmin && pay.username && <span className="text-[10px] text-gray-500">@{pay.username}</span>}
                          </div>
                          {pay.tx_hash && <TxHashLink hash={pay.tx_hash} currency={pay.currency} />}
                        </div>
                        <div className="text-right flex-shrink-0">
                          <div className="text-sm font-bold text-white">{formatChips(pay.chip_amount)} chips</div>
                          {pay.amount_crypto && <div className="text-[10px] text-gray-500">{pay.amount_crypto} {pay.currency}</div>}
                          <div className="text-[10px] text-gray-600">{new Date(pay.created_at).toLocaleDateString()}</div>
                        </div>
                      </button>
                      {expanded.has(pay.id) && (
                        <div className="px-4 pb-3 ml-11 space-y-1.5 text-xs">
                          <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-gray-400">
                            <div>ID: <span className="text-gray-300 font-mono text-[10px]">{pay.id}</span> <CopyButton text={pay.id} /></div>
                            <div>Gateway: <span className="text-gray-300">{pay.gateway_provider || "direct"}</span></div>
                            <div>Fiat: <span className="text-gray-300">${(pay.amount_fiat / 100).toFixed(2)}</span></div>
                            <div>Confirmations: <span className="text-gray-300">{pay.confirmations}/{pay.required_confirmations}</span></div>
                            {pay.deposit_address && <div className="col-span-2">Deposit Address: <span className="text-gray-300 font-mono text-[10px] break-all">{pay.deposit_address}</span> <CopyButton text={pay.deposit_address} /></div>}
                            {pay.withdrawal_address && <div className="col-span-2">Withdrawal Address: <span className="text-gray-300 font-mono text-[10px] break-all">{pay.withdrawal_address}</span> <CopyButton text={pay.withdrawal_address} /></div>}
                            {pay.tx_hash && (
                              <div className="col-span-2">
                                Blockchain Tx: <TxHashLink hash={pay.tx_hash} currency={pay.currency} />
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Hands Tab */}
              {tab === "hands" && (
                <div className="divide-y divide-white/5">
                  {handResults.length === 0 ? (
                    <div className="py-12 text-center text-gray-500 text-sm">No game hands found</div>
                  ) : handResults.map(hand => (
                    <div key={hand.id} className="hover:bg-white/[0.02] transition-colors">
                      <button onClick={() => toggleExpand(hand.id)} className="w-full flex items-center gap-3 px-4 py-3 text-left">
                        {expanded.has(hand.id) ? <ChevronDown className="w-3.5 h-3.5 text-gray-500 flex-shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 text-gray-500 flex-shrink-0" />}
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 bg-purple-500/10">
                          <Shield className="w-4 h-4 text-purple-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-white">Hand #{hand.hand_number}</span>
                            <span className="text-[10px] text-gray-500">{hand.table_name || shortenHash(hand.table_id)}</span>
                            {(hand.on_chain_commit_tx || hand.on_chain_reveal_tx) && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-400 border border-purple-500/20">On-Chain</span>
                            )}
                            {hand.vrf_request_id && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">VRF</span>
                            )}
                          </div>
                          {hand.commitment_hash && (
                            <span className="font-mono text-[10px] text-gray-600">{shortenHash(hand.commitment_hash, 12)}</span>
                          )}
                        </div>
                        <div className="text-right flex-shrink-0">
                          <div className="text-sm font-bold text-amber-400">{formatChips(hand.pot_total)} pot</div>
                          {hand.total_rake > 0 && <div className="text-[10px] text-gray-500">{formatChips(hand.total_rake)} rake</div>}
                          <div className="text-[10px] text-gray-600">{new Date(hand.created_at).toLocaleDateString()}</div>
                        </div>
                      </button>
                      {expanded.has(hand.id) && (
                        <div className="px-4 pb-3 ml-11 space-y-1.5 text-xs">
                          <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-gray-400">
                            <div>Hand ID: <span className="text-gray-300 font-mono text-[10px]">{hand.id}</span> <CopyButton text={hand.id} /></div>
                            <div>Table: <span className="text-gray-300">{hand.table_name || hand.table_id}</span></div>
                            {hand.vrf_request_id && <div>VRF Request: <span className="text-cyan-400 font-mono text-[10px]">{shortenHash(hand.vrf_request_id)}</span></div>}
                            {hand.on_chain_commit_tx && <div>Commit Tx: <TxHashLink hash={hand.on_chain_commit_tx} /></div>}
                            {hand.on_chain_reveal_tx && <div>Reveal Tx: <TxHashLink hash={hand.on_chain_reveal_tx} /></div>}
                          </div>
                          <BlockchainVerifier tableId={hand.table_id} handNumber={hand.hand_number} />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, totalForTab)} of {totalForTab}</span>
            <div className="flex gap-1">
              <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0} className="px-3 py-1.5 rounded bg-white/5 border border-white/10 hover:bg-white/10 disabled:opacity-30">Prev</button>
              <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1} className="px-3 py-1.5 rounded bg-white/5 border border-white/10 hover:bg-white/10 disabled:opacity-30">Next</button>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
