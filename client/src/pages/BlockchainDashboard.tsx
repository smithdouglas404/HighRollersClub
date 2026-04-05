import { useState, useEffect, useCallback } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useAuth } from "@/lib/auth-context";
import {
  Shield, ShieldCheck, Link as LinkIcon, ExternalLink, Copy, Check,
  Search, RefreshCw, Loader2, Lock, Unlock, Fingerprint, Gamepad2,
  CreditCard, Key, ChevronDown, ChevronRight, AlertTriangle,
  CheckCircle, XCircle, Cpu, Activity, Database, Globe, Hash,
  DollarSign, ArrowRight, TrendingUp, TrendingDown, FileCheck,
} from "lucide-react";

// ─── Helpers ────────────────────────────────────────────────────────────────

function shortenHash(hash: string, chars = 8): string {
  if (!hash || hash.length < chars * 2 + 2) return hash || "";
  return `${hash.slice(0, chars + 2)}...${hash.slice(-chars)}`;
}

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
      className="p-0.5 hover:bg-white/5 rounded" title="Copy">
      {copied ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3 text-gray-600" />}
    </button>
  );
}

function TxLink({ hash, label }: { hash: string; label?: string }) {
  if (!hash) return <span className="text-gray-600">--</span>;
  const url = hash.startsWith("0x")
    ? `https://amoy.polygonscan.com/tx/${hash}`
    : `https://solscan.io/tx/${hash}`;
  return (
    <span className="inline-flex items-center gap-1">
      <span className="font-mono text-[11px] text-purple-400">{label || shortenHash(hash)}</span>
      <CopyBtn text={hash} />
      <a href={url} target="_blank" rel="noopener noreferrer" className="text-purple-400 hover:text-purple-300">
        <ExternalLink className="w-3 h-3" />
      </a>
    </span>
  );
}

function StatCard({ icon: Icon, label, value, color, sub }: { icon: any; label: string; value: string | number; color: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-surface-high/30 p-4">
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${color}`}>
          <Icon className="w-5 h-5" />
        </div>
        <div>
          <div className="text-2xl font-black text-white">{value}</div>
          <div className="text-[10px] text-gray-500 uppercase tracking-wider">{label}</div>
          {sub && <div className="text-[10px] text-gray-600">{sub}</div>}
        </div>
      </div>
    </div>
  );
}

function StatusDot({ active }: { active: boolean }) {
  return <span className={`w-2 h-2 rounded-full inline-block ${active ? "bg-green-400 shadow-[0_0_6px_rgba(74,222,128,0.5)]" : "bg-red-400"}`} />;
}

// ─── Types ──────────────────────────────────────────────────────────────────

type Tab = "overview" | "kyc" | "hands" | "payments" | "encryption" | "settlements";

// ─── Main Component ─────────────────────────────────────────────────────────

export default function BlockchainDashboard() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [tab, setTab] = useState<Tab>("overview");
  const [loading, setLoading] = useState(false);

  // Stats
  const [stats, setStats] = useState<any>(null);

  // KYC
  const [kycSearch, setKycSearch] = useState("");
  const [kycOnChainOnly, setKycOnChainOnly] = useState(false);
  const [kycRecords, setKycRecords] = useState<any[]>([]);

  // Hands
  const [handSearch, setHandSearch] = useState("");
  const [handOnChainOnly, setHandOnChainOnly] = useState(true);
  const [handRecords, setHandRecords] = useState<any[]>([]);
  const [expandedHand, setExpandedHand] = useState<string | null>(null);
  const [verifyResult, setVerifyResult] = useState<any>(null);
  const [verifying, setVerifying] = useState(false);

  // Payments
  const [paySearch, setPaySearch] = useState("");
  const [payRecords, setPayRecords] = useState<any[]>([]);

  // Settlements
  const [settlementSearch, setSettlementSearch] = useState("");
  const [settlementOnChainOnly, setSettlementOnChainOnly] = useState(false);
  const [settlementRecords, setSettlementRecords] = useState<any[]>([]);
  const [expandedSettlement, setExpandedSettlement] = useState<string | null>(null);
  const [verifyingSettlement, setVerifyingSettlement] = useState<string | null>(null);
  const [settlementVerification, setSettlementVerification] = useState<any>(null);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/blockchain/stats");
      if (res.ok) setStats(await res.json());
    } catch {}
  }, []);

  const fetchKyc = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ ...(kycSearch && { search: kycSearch }), ...(kycOnChainOnly && { onChainOnly: "true" }) });
      const res = await fetch(`/api/admin/blockchain/kyc?${params}`);
      if (res.ok) setKycRecords(await res.json());
    } catch {} finally { setLoading(false); }
  }, [kycSearch, kycOnChainOnly]);

  const fetchHands = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ ...(handSearch && { search: handSearch }), onChainOnly: String(handOnChainOnly) });
      const res = await fetch(`/api/admin/blockchain/hands?${params}`);
      if (res.ok) setHandRecords(await res.json());
    } catch {} finally { setLoading(false); }
  }, [handSearch, handOnChainOnly]);

  const fetchSettlements = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        ...(settlementSearch && { search: settlementSearch }),
        ...(settlementOnChainOnly && { onChainOnly: "true" }),
      });
      const res = await fetch(`/api/admin/blockchain/settlements?${params}`);
      if (res.ok) setSettlementRecords(await res.json());
    } catch {} finally { setLoading(false); }
  }, [settlementSearch, settlementOnChainOnly]);

  const verifySettlement = async (id: string) => {
    setVerifyingSettlement(id);
    try {
      const res = await fetch(`/api/ledger/${id}/verify`);
      if (res.ok) setSettlementVerification(await res.json());
    } catch {} finally { setVerifyingSettlement(null); }
  };

  const fetchPayments = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ ...(paySearch && { search: paySearch }), all: "true" });
      const res = await fetch(`/api/explorer/payments?${params}`);
      if (res.ok) {
        const data = await res.json();
        setPayRecords((data.results || []).filter((p: any) => p.tx_hash));
      }
    } catch {} finally { setLoading(false); }
  }, [paySearch]);

  const verifyHand = async (tableId: string, handNumber: number) => {
    setVerifying(true);
    try {
      const res = await fetch(`/api/explorer/verify/${tableId}/${handNumber}`);
      if (res.ok) setVerifyResult(await res.json());
    } catch {} finally { setVerifying(false); }
  };

  const forceAnchor = async () => {
    const res = await fetch("/api/admin/encryption/anchor", { method: "POST" });
    if (res.ok) { fetchStats(); alert("Batch anchored successfully"); }
  };

  useEffect(() => { fetchStats(); }, []);
  useEffect(() => {
    if (tab === "kyc") fetchKyc();
    if (tab === "hands") fetchHands();
    if (tab === "payments") fetchPayments();
    if (tab === "settlements") fetchSettlements();
  }, [tab]);

  if (!isAdmin) {
    return <DashboardLayout title="Blockchain"><div className="p-8 text-center text-gray-400">Admin access required</div></DashboardLayout>;
  }

  return (
    <DashboardLayout title="Blockchain Dashboard">
      <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-xl font-display font-black text-white flex items-center gap-2">
              <Shield className="w-5 h-5 text-purple-400" />
              Blockchain Integrity Dashboard
            </h1>
            <p className="text-xs text-gray-500 mt-0.5">Review, certify, and validate all on-chain activity</p>
          </div>
          <div className="flex items-center gap-2">
            <StatusDot active={!!stats?.blockchainEnabled} />
            <span className="text-xs text-gray-400">{stats?.blockchainEnabled ? "Polygon Connected" : "Blockchain Offline"}</span>
            <button onClick={fetchStats} className="p-1.5 rounded hover:bg-white/5"><RefreshCw className="w-3.5 h-3.5 text-gray-500" /></button>
          </div>
        </div>

        {/* Stats Grid */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <StatCard icon={Fingerprint} label="KYC Verified" value={stats.kycVerified} color="bg-green-500/10 text-green-400" sub={`${stats.kycOnChain} on-chain`} />
            <StatCard icon={Gamepad2} label="Total Hands" value={stats.handsTotal} color="bg-blue-500/10 text-blue-400" sub={`${stats.handsOnChain} on-chain`} />
            <StatCard icon={Cpu} label="VRF Hands" value={stats.vrfHands} color="bg-cyan-500/10 text-cyan-400" sub="Chainlink verified" />
            <StatCard icon={CreditCard} label="Chain Payments" value={stats.paymentsTx} color="bg-amber-500/10 text-amber-400" sub="With tx hash" />
            <StatCard icon={Key} label="Active Sessions" value={stats.encryption?.activeKeys || 0} color="bg-purple-500/10 text-purple-400" sub={`${stats.encryption?.pendingCommitments || 0} pending`} />
            <StatCard icon={Database} label="Anchored Batches" value={stats.encryption?.anchoredBatches || 0} color="bg-pink-500/10 text-pink-400" sub={`${stats.encryption?.totalAnchored || 0} commitments`} />
          </div>
        )}

        {/* System Status Bar */}
        {stats && (
          <div className="rounded-lg border border-white/10 bg-surface-high/20 px-4 py-3 flex items-center gap-6 flex-wrap text-xs">
            <div className="flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5 text-gray-500" />
              <span className="text-gray-400">Chain:</span>
              <span className="text-white font-bold">{stats.chainId === 137 ? "Polygon Mainnet" : stats.chainId === 80002 ? "Polygon Amoy" : stats.chainId || "Not Set"}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-gray-500" />
              <span className="text-gray-400">RPC:</span>
              <StatusDot active={stats.rpcConfigured} />
            </div>
            <div className="flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-gray-500" />
              <span className="text-gray-400">Verifier Contract:</span>
              <StatusDot active={stats.contractConfigured} />
            </div>
            {stats.encryption?.lastAnchorTx && (
              <div className="flex items-center gap-1.5">
                <Hash className="w-3.5 h-3.5 text-gray-500" />
                <span className="text-gray-400">Last Anchor:</span>
                <TxLink hash={stats.encryption.lastAnchorTx} />
              </div>
            )}
            <button onClick={forceAnchor} className="ml-auto px-3 py-1 rounded bg-purple-500/10 text-purple-400 text-[10px] font-bold border border-purple-500/20 hover:bg-purple-500/20">
              Force Anchor Now
            </button>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 p-1 rounded-lg bg-black/20 border border-white/5">
          {([
            { key: "overview" as Tab, label: "Overview", icon: Shield },
            { key: "kyc" as Tab, label: "KYC Certification", icon: Fingerprint },
            { key: "hands" as Tab, label: "Hand Verification", icon: Gamepad2 },
            { key: "payments" as Tab, label: "Payment Chains", icon: CreditCard },
            { key: "settlements" as Tab, label: "Settlements", icon: FileCheck },
            { key: "encryption" as Tab, label: "Encryption", icon: Key },
          ]).map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-xs font-bold transition-all ${
                tab === t.key ? "bg-purple-500/15 text-purple-400 border border-purple-500/20" : "text-gray-500 hover:text-gray-300 hover:bg-white/5"
              }`}>
              <t.icon className="w-3.5 h-3.5" />
              {t.label}
            </button>
          ))}
        </div>

        {/* ── KYC Certification Tab ── */}
        {tab === "kyc" && (
          <div className="space-y-4">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
                <input type="text" placeholder="Search by username, member ID, or tx hash..." value={kycSearch}
                  onChange={e => setKycSearch(e.target.value)} onKeyDown={e => { if (e.key === "Enter") fetchKyc(); }}
                  className="w-full pl-9 pr-3 py-2 rounded-lg bg-black/30 border border-white/10 text-white text-sm focus:outline-none focus:border-purple-500/40" />
              </div>
              <label className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-black/30 border border-white/10 text-xs text-gray-300 cursor-pointer">
                <input type="checkbox" checked={kycOnChainOnly} onChange={e => { setKycOnChainOnly(e.target.checked); }} className="accent-purple-500" />
                On-chain only
              </label>
              <button onClick={fetchKyc} className="px-4 py-2 rounded-lg bg-purple-500/20 text-purple-400 font-bold text-xs border border-purple-500/30 hover:bg-purple-500/30">Search</button>
            </div>

            {loading ? <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-purple-400" /></div> : (
              <div className="rounded-xl border border-white/10 overflow-hidden">
                {kycRecords.length === 0 ? <p className="text-gray-500 text-sm text-center py-12">No verified KYC records found</p> : (
                  <div className="divide-y divide-white/5">
                    {kycRecords.map((r: any) => (
                      <div key={r.id} className="flex items-center gap-4 px-4 py-3 hover:bg-white/[0.02]">
                        <div className="w-9 h-9 rounded-full bg-green-500/10 flex items-center justify-center flex-shrink-0">
                          <ShieldCheck className="w-4 h-4 text-green-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-white">{r.username}</span>
                            {r.memberId && <span className="font-mono text-[10px] text-cyan-400 bg-cyan-500/10 px-1.5 py-0.5 rounded">{r.memberId}</span>}
                            <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${r.tier === "platinum" ? "bg-purple-500/10 text-purple-400" : r.tier === "gold" ? "bg-amber-500/10 text-amber-400" : "bg-gray-500/10 text-gray-400"}`}>{r.tier}</span>
                          </div>
                          <div className="text-[10px] text-gray-500 mt-0.5">
                            Verified: {r.kycVerifiedAt ? new Date(r.kycVerifiedAt).toLocaleString() : "N/A"}
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          {r.kycBlockchainTxHash ? (
                            <div>
                              <div className="flex items-center gap-1 mb-0.5">
                                <Lock className="w-3 h-3 text-green-400" />
                                <span className="text-[10px] text-green-400 font-bold">ON-CHAIN</span>
                              </div>
                              <TxLink hash={r.kycBlockchainTxHash} />
                            </div>
                          ) : (
                            <div className="flex items-center gap-1">
                              <Unlock className="w-3 h-3 text-gray-500" />
                              <span className="text-[10px] text-gray-500">Not recorded</span>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── Hand Verification Tab ── */}
        {tab === "hands" && (
          <div className="space-y-4">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
                <input type="text" placeholder="Search by hand ID, commitment hash, or tx hash..." value={handSearch}
                  onChange={e => setHandSearch(e.target.value)} onKeyDown={e => { if (e.key === "Enter") fetchHands(); }}
                  className="w-full pl-9 pr-3 py-2 rounded-lg bg-black/30 border border-white/10 text-white text-sm focus:outline-none focus:border-purple-500/40" />
              </div>
              <label className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-black/30 border border-white/10 text-xs text-gray-300 cursor-pointer">
                <input type="checkbox" checked={handOnChainOnly} onChange={e => setHandOnChainOnly(e.target.checked)} className="accent-purple-500" />
                On-chain / VRF only
              </label>
              <button onClick={fetchHands} className="px-4 py-2 rounded-lg bg-purple-500/20 text-purple-400 font-bold text-xs border border-purple-500/30 hover:bg-purple-500/30">Search</button>
            </div>

            {loading ? <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-purple-400" /></div> : (
              <div className="rounded-xl border border-white/10 overflow-hidden">
                {handRecords.length === 0 ? <p className="text-gray-500 text-sm text-center py-12">No hand records found</p> : (
                  <div className="divide-y divide-white/5">
                    {handRecords.map((h: any) => (
                      <div key={h.id}>
                        <button onClick={() => { setExpandedHand(expandedHand === h.id ? null : h.id); setVerifyResult(null); }}
                          className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/[0.02] text-left">
                          {expandedHand === h.id ? <ChevronDown className="w-3.5 h-3.5 text-gray-500" /> : <ChevronRight className="w-3.5 h-3.5 text-gray-500" />}
                          <div className="w-9 h-9 rounded-lg bg-blue-500/10 flex items-center justify-center flex-shrink-0">
                            <Gamepad2 className="w-4 h-4 text-blue-400" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-bold text-white">Hand #{h.handNumber}</span>
                              <span className="text-[10px] text-gray-500">{h.tableName || shortenHash(h.tableId)}</span>
                              {h.onChainCommitTx && <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-green-500/10 text-green-400">COMMITTED</span>}
                              {h.onChainRevealTx && <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-purple-500/10 text-purple-400">REVEALED</span>}
                              {h.vrfRequestId && <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-cyan-500/10 text-cyan-400">VRF</span>}
                            </div>
                            <div className="text-[10px] text-gray-500">{new Date(h.createdAt).toLocaleString()}</div>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <div className="text-sm font-bold text-amber-400">{(h.potTotal || 0).toLocaleString()} pot</div>
                          </div>
                        </button>

                        {expandedHand === h.id && (
                          <div className="px-4 pb-4 ml-12 space-y-3">
                            {/* Commitment details */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              <div className="rounded-lg bg-black/20 border border-white/5 p-3 space-y-2">
                                <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Commitment</h4>
                                <div className="space-y-1 text-xs">
                                  <div className="text-gray-500">Hash: <span className="font-mono text-gray-300 break-all">{h.commitmentHash || "N/A"}</span></div>
                                  {h.onChainCommitTx && <div className="text-gray-500">Commit Tx: <TxLink hash={h.onChainCommitTx} /></div>}
                                  {h.onChainRevealTx && <div className="text-gray-500">Reveal Tx: <TxLink hash={h.onChainRevealTx} /></div>}
                                  {h.vrfRequestId && <div className="text-gray-500">VRF ID: <span className="font-mono text-cyan-400">{shortenHash(h.vrfRequestId)}</span></div>}
                                </div>
                              </div>

                              {/* On-chain verification */}
                              <div className="rounded-lg bg-black/20 border border-white/5 p-3 space-y-2">
                                <div className="flex items-center justify-between">
                                  <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">On-Chain Verification</h4>
                                  <button onClick={() => verifyHand(h.tableId, h.handNumber)} disabled={verifying}
                                    className="px-2 py-1 rounded bg-purple-500/10 text-purple-400 text-[10px] font-bold border border-purple-500/20 hover:bg-purple-500/20 disabled:opacity-50">
                                    {verifying ? <Loader2 className="w-3 h-3 animate-spin" /> : "Verify On-Chain"}
                                  </button>
                                </div>
                                {verifyResult ? (
                                  verifyResult.onChain && !verifyResult.onChain.error ? (
                                    <div className="space-y-1 text-xs">
                                      <div className="flex items-center gap-1.5">
                                        <CheckCircle className="w-4 h-4 text-green-400" />
                                        <span className="text-green-400 font-bold">Verified On-Chain</span>
                                      </div>
                                      <div className="text-gray-500">Committed: {verifyResult.onChain.committed ? <CheckCircle className="w-3 h-3 text-green-400 inline" /> : <XCircle className="w-3 h-3 text-red-400 inline" />}</div>
                                      <div className="text-gray-500">Revealed: {verifyResult.onChain.revealed ? <CheckCircle className="w-3 h-3 text-green-400 inline" /> : <XCircle className="w-3 h-3 text-red-400 inline" />}</div>
                                      {verifyResult.onChain.timestamp > 0 && <div className="text-gray-500">Block time: {new Date(verifyResult.onChain.timestamp * 1000).toLocaleString()}</div>}
                                    </div>
                                  ) : (
                                    <div className="flex items-center gap-1.5 text-xs">
                                      <AlertTriangle className="w-4 h-4 text-yellow-400" />
                                      <span className="text-yellow-400">{verifyResult.onChain?.error || "Blockchain not configured"}</span>
                                    </div>
                                  )
                                ) : (
                                  <p className="text-[10px] text-gray-600">Click "Verify" to query the smart contract</p>
                                )}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── Payment Chains Tab ── */}
        {tab === "payments" && (
          <div className="space-y-4">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
                <input type="text" placeholder="Search by tx hash, payment ID..." value={paySearch}
                  onChange={e => setPaySearch(e.target.value)} onKeyDown={e => { if (e.key === "Enter") fetchPayments(); }}
                  className="w-full pl-9 pr-3 py-2 rounded-lg bg-black/30 border border-white/10 text-white text-sm focus:outline-none focus:border-purple-500/40" />
              </div>
              <button onClick={fetchPayments} className="px-4 py-2 rounded-lg bg-purple-500/20 text-purple-400 font-bold text-xs border border-purple-500/30 hover:bg-purple-500/30">Search</button>
            </div>

            {loading ? <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-purple-400" /></div> : (
              <div className="rounded-xl border border-white/10 overflow-hidden">
                {payRecords.length === 0 ? <p className="text-gray-500 text-sm text-center py-12">No blockchain payment records found</p> : (
                  <div className="divide-y divide-white/5">
                    {payRecords.map((p: any) => (
                      <div key={p.id} className="flex items-center gap-4 px-4 py-3 hover:bg-white/[0.02]">
                        <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${p.direction === "deposit" ? "bg-green-500/10" : "bg-orange-500/10"}`}>
                          <CreditCard className={`w-4 h-4 ${p.direction === "deposit" ? "text-green-400" : "text-orange-400"}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-white capitalize">{p.direction}</span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-gray-400">{p.currency}</span>
                            <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${p.status === "credited" || p.status === "completed" ? "bg-green-500/10 text-green-400" : p.status === "confirming" ? "bg-blue-500/10 text-blue-400" : "bg-gray-500/10 text-gray-400"}`}>{p.status}</span>
                          </div>
                          <div className="mt-0.5"><TxLink hash={p.tx_hash} /></div>
                          <div className="text-[10px] text-gray-600 mt-0.5">
                            {p.confirmations}/{p.required_confirmations} confirmations
                            {p.username && <span className="ml-2">@{p.username}</span>}
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <div className="text-sm font-bold text-white">{(p.chip_amount || 0).toLocaleString()} chips</div>
                          {p.amount_crypto && <div className="text-[10px] text-gray-500">{p.amount_crypto} {p.currency}</div>}
                          <div className="text-[10px] text-gray-600">{new Date(p.created_at).toLocaleDateString()}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── Settlements Tab ── */}
        {tab === "settlements" && (
          <div className="space-y-4">
            {/* Explanation banner */}
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
              <h3 className="text-sm font-bold text-amber-400 flex items-center gap-2 mb-2"><FileCheck className="w-4 h-4" /> How Settlement Verification Works</h3>
              <div className="text-xs text-gray-400 space-y-1.5">
                <p>When a club owner settles a game session, the system creates a <strong className="text-white">SHA-256 hash</strong> of the entire settlement — every player's buy-in, cash-out, net P&L, and who owes who.</p>
                <p>This hash is <strong className="text-white">anchored to the Polygon blockchain</strong> as a transaction. The hash cannot be changed without breaking the on-chain record.</p>
                <p>Anyone can <strong className="text-white">verify</strong> a settlement by reconstructing the hash from the stored data and comparing it to the on-chain record. If they match, the data is untampered.</p>
              </div>
            </div>

            {/* Search */}
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
                <input type="text" placeholder="Search by hash, tx hash, or ID..." value={settlementSearch}
                  onChange={e => setSettlementSearch(e.target.value)} onKeyDown={e => { if (e.key === "Enter") fetchSettlements(); }}
                  className="w-full pl-9 pr-3 py-2 rounded-lg bg-black/30 border border-white/10 text-white text-sm focus:outline-none focus:border-amber-500/40" />
              </div>
              <label className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-black/30 border border-white/10 text-xs text-gray-300 cursor-pointer">
                <input type="checkbox" checked={settlementOnChainOnly} onChange={e => setSettlementOnChainOnly(e.target.checked)} className="accent-amber-500" />
                On-chain only
              </label>
              <button onClick={fetchSettlements} className="px-4 py-2 rounded-lg bg-amber-500/20 text-amber-400 font-bold text-xs border border-amber-500/30 hover:bg-amber-500/30">Search</button>
            </div>

            {loading ? <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-amber-400" /></div> : (
              <div className="rounded-xl border border-white/10 overflow-hidden">
                {settlementRecords.length === 0 ? <p className="text-gray-500 text-sm text-center py-12">No settlement records found</p> : (
                  <div className="divide-y divide-white/5">
                    {settlementRecords.map((s: any) => (
                      <div key={s.id}>
                        <button onClick={() => { setExpandedSettlement(expandedSettlement === s.id ? null : s.id); setSettlementVerification(null); }}
                          className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/[0.02] text-left">
                          {expandedSettlement === s.id ? <ChevronDown className="w-3.5 h-3.5 text-gray-500" /> : <ChevronRight className="w-3.5 h-3.5 text-gray-500" />}
                          <div className="w-9 h-9 rounded-lg bg-amber-500/10 flex items-center justify-center flex-shrink-0">
                            <DollarSign className="w-4 h-4 text-amber-400" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-bold text-white">{s.tableName || "Table"}</span>
                              <span className="text-[10px] text-gray-500">{s.playerCount} players, {s.handsPlayed} hands</span>
                              {s.settlementTxHash && <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-green-500/10 text-green-400 border border-green-500/20">ON-CHAIN</span>}
                              {!s.settlementTxHash && s.settlementHash && <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-gray-500/10 text-gray-400">LOCAL HASH</span>}
                            </div>
                            <div className="text-[10px] text-gray-500">{s.settledAt ? new Date(s.settledAt).toLocaleString() : "Pending"}</div>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <div className="text-sm font-bold text-amber-400">{(s.totalPot || 0).toLocaleString()} pot</div>
                            {s.totalRake > 0 && <div className="text-[10px] text-gray-500">{(s.totalRake).toLocaleString()} rake</div>}
                          </div>
                        </button>

                        {expandedSettlement === s.id && (
                          <div className="px-4 pb-4 ml-12 space-y-3">
                            {/* Player Results */}
                            <div className="rounded-lg bg-black/20 border border-white/5 p-3">
                              <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Player Results</h4>
                              <div className="space-y-1">
                                {(s.entries as any[] || []).map((e: any, i: number) => (
                                  <div key={i} className="flex items-center justify-between px-2 py-1.5 rounded bg-white/[0.02]">
                                    <span className="text-xs text-white font-bold">{e.displayName}</span>
                                    <div className="flex items-center gap-4 text-[10px]">
                                      <span className="text-gray-500">Buy-in: {(e.buyIn || 0).toLocaleString()}</span>
                                      <span className="text-gray-500">Cash-out: {(e.cashOut || 0).toLocaleString()}</span>
                                      <span className={`font-bold flex items-center gap-0.5 ${(e.net || 0) >= 0 ? "text-green-400" : "text-red-400"}`}>
                                        {(e.net || 0) >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                                        {(e.net || 0) >= 0 ? "+" : ""}{(e.net || 0).toLocaleString()}
                                      </span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>

                            {/* Who Owes Who */}
                            {s.settlements && (s.settlements as any[]).length > 0 && (
                              <div className="rounded-lg bg-black/20 border border-amber-500/10 p-3">
                                <h4 className="text-[10px] font-bold text-amber-400 uppercase tracking-wider mb-2">Settlement — Who Owes Who</h4>
                                <div className="space-y-1.5">
                                  {(s.settlements as any[]).map((st: any, i: number) => (
                                    <div key={i} className="flex items-center gap-2 text-xs">
                                      <span className="text-red-400 font-bold">{st.fromName}</span>
                                      <ArrowRight className="w-3 h-3 text-amber-400 shrink-0" />
                                      <span className="text-green-400 font-bold">{st.toName}</span>
                                      <span className="ml-auto text-amber-400 font-bold">{(st.amount || 0).toLocaleString()}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Blockchain Proof */}
                            <div className="rounded-lg bg-black/20 border border-purple-500/10 p-3 space-y-2">
                              <div className="flex items-center justify-between">
                                <h4 className="text-[10px] font-bold text-purple-400 uppercase tracking-wider">Blockchain Proof</h4>
                                <button onClick={() => verifySettlement(s.id)} disabled={verifyingSettlement === s.id}
                                  className="px-2 py-1 rounded bg-purple-500/10 text-purple-400 text-[10px] font-bold border border-purple-500/20 hover:bg-purple-500/20 disabled:opacity-50">
                                  {verifyingSettlement === s.id ? <Loader2 className="w-3 h-3 animate-spin" /> : "Verify Integrity"}
                                </button>
                              </div>

                              <div className="space-y-1.5 text-xs">
                                {s.settlementHash && (
                                  <div>
                                    <span className="text-gray-500">Settlement Hash</span>
                                    <p className="font-mono text-[10px] text-purple-400 break-all mt-0.5" title="SHA-256 hash of the entire settlement data — player results, amounts, who owes who. If any data changes, this hash breaks.">{s.settlementHash}</p>
                                    <p className="text-[9px] text-gray-600 mt-0.5 italic">This is a SHA-256 fingerprint of the settlement. If any player's buy-in, cash-out, or settlement amount is changed, this hash will no longer match.</p>
                                  </div>
                                )}

                                {s.settlementTxHash ? (
                                  <div className="p-2 rounded bg-green-500/5 border border-green-500/10">
                                    <div className="flex items-center gap-1.5 mb-1">
                                      <ShieldCheck className="w-4 h-4 text-green-400" />
                                      <span className="text-green-400 font-bold text-[10px]">Anchored to Polygon Blockchain</span>
                                    </div>
                                    <p className="text-[9px] text-gray-500 mb-1">The settlement hash was written to the Polygon blockchain as transaction data. This creates a permanent, tamper-proof timestamp proving this settlement existed at this exact moment.</p>
                                    <div className="flex items-center gap-1">
                                      <span className="font-mono text-[10px] text-purple-400">{s.settlementTxHash.slice(0, 20)}...{s.settlementTxHash.slice(-8)}</span>
                                      <a href={`https://amoy.polygonscan.com/tx/${s.settlementTxHash}`} target="_blank" rel="noopener noreferrer"
                                        className="text-purple-400 hover:text-purple-300 flex items-center gap-0.5 text-[10px] font-bold">
                                        View on Polygonscan <ExternalLink className="w-3 h-3" />
                                      </a>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="p-2 rounded bg-gray-500/5 border border-gray-500/10">
                                    <span className="text-gray-500 text-[10px]">Hash recorded locally — blockchain not configured. Set POLYGON_ENABLED=true to anchor settlements on-chain.</span>
                                  </div>
                                )}

                                {/* Verification result */}
                                {settlementVerification && settlementVerification.ledgerEntry?.id === s.id && (
                                  <div className={`p-2 rounded ${settlementVerification.verification.hashIntegrity === "VALID" ? "bg-green-500/5 border border-green-500/10" : "bg-red-500/5 border border-red-500/10"}`}>
                                    <div className="flex items-center gap-1.5">
                                      {settlementVerification.verification.hashIntegrity === "VALID" ? (
                                        <>
                                          <CheckCircle className="w-4 h-4 text-green-400" />
                                          <span className="text-green-400 font-bold text-[10px]">Integrity Verified — Data has NOT been tampered with</span>
                                        </>
                                      ) : (
                                        <>
                                          <XCircle className="w-4 h-4 text-red-400" />
                                          <span className="text-red-400 font-bold text-[10px]">INTEGRITY FAILURE — Data may have been modified</span>
                                        </>
                                      )}
                                    </div>
                                    <p className="text-[9px] text-gray-500 mt-1">The server reconstructed the hash from the stored settlement data and compared it to the original. {settlementVerification.verification.hashIntegrity === "VALID" ? "They match perfectly — this settlement is genuine." : "They DO NOT match — investigate immediately."}</p>
                                  </div>
                                )}
                              </div>
                            </div>

                            {s.notes && (
                              <div className="text-[10px] text-gray-500 italic px-2">Note: {s.notes}</div>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── Encryption Tab ── */}
        {tab === "encryption" && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* How it works */}
              <div className="rounded-xl border border-purple-500/20 bg-purple-500/5 p-5 space-y-3">
                <h3 className="text-sm font-bold text-purple-400 flex items-center gap-2"><Lock className="w-4 h-4" /> Card Encryption Protocol</h3>
                <div className="space-y-2 text-xs text-gray-400">
                  <div className="flex items-start gap-2">
                    <span className="text-purple-400 font-bold shrink-0">1.</span>
                    <span>Player connects via WSS. Server generates <strong className="text-white">AES-256-GCM</strong> session key (256 bits of randomness).</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-purple-400 font-bold shrink-0">2.</span>
                    <span>SHA-256 commitment hash created: <code className="text-purple-300 bg-purple-500/10 px-1 rounded">hash(userId|sessionId|key|timestamp)</code></span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-purple-400 font-bold shrink-0">3.</span>
                    <span>Hero cards encrypted with unique IV per message. Opponents' cards <strong className="text-white">never transmitted</strong>.</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-purple-400 font-bold shrink-0">4.</span>
                    <span>Commitments batched every 10 min. <strong className="text-white">Merkle root anchored to Polygon</strong> in a single transaction.</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-purple-400 font-bold shrink-0">5.</span>
                    <span>Players can verify their session key commitment against the on-chain Merkle root.</span>
                  </div>
                </div>
              </div>

              {/* Live stats */}
              <div className="rounded-xl border border-white/10 bg-surface-high/30 p-5 space-y-3">
                <h3 className="text-sm font-bold text-white flex items-center gap-2"><Activity className="w-4 h-4 text-cyan-400" /> Live Encryption Status</h3>
                {stats?.encryption ? (
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs"><span className="text-gray-400">Active Encrypted Sessions</span><span className="text-cyan-400 font-bold">{stats.encryption.activeKeys}</span></div>
                    <div className="flex justify-between text-xs"><span className="text-gray-400">Pending Commitments</span><span className="text-amber-400 font-bold">{stats.encryption.pendingCommitments}</span></div>
                    <div className="flex justify-between text-xs"><span className="text-gray-400">Anchored Batches</span><span className="text-green-400 font-bold">{stats.encryption.anchoredBatches}</span></div>
                    <div className="flex justify-between text-xs"><span className="text-gray-400">Total Commitments Anchored</span><span className="text-white font-bold">{stats.encryption.totalAnchored}</span></div>
                    {stats.encryption.lastAnchorTx && (
                      <div className="pt-2 border-t border-white/5">
                        <div className="text-[10px] text-gray-500 mb-1">Last Anchor Transaction</div>
                        <TxLink hash={stats.encryption.lastAnchorTx} />
                      </div>
                    )}
                    <button onClick={forceAnchor} className="w-full mt-2 py-2 rounded-lg bg-purple-500/15 text-purple-400 font-bold text-xs border border-purple-500/20 hover:bg-purple-500/25">
                      Force Anchor Pending Commitments
                    </button>
                  </div>
                ) : <p className="text-gray-500 text-sm">Loading...</p>}
              </div>
            </div>
          </div>
        )}

        {/* ── Overview Tab ── */}
        {tab === "overview" && stats && (
          <div className="space-y-4">
            {/* Visual pipeline */}
            <div className="rounded-xl border border-white/10 bg-surface-high/20 p-5">
              <h3 className="text-sm font-bold text-white mb-4">Blockchain Integrity Pipeline</h3>
              <div className="flex items-center gap-2 overflow-x-auto pb-2">
                {[
                  { label: "Player Joins", icon: Fingerprint, color: "text-cyan-400", bg: "bg-cyan-500/10", desc: "Session key generated" },
                  { label: "Cards Dealt", icon: Lock, color: "text-purple-400", bg: "bg-purple-500/10", desc: "AES-256-GCM encrypted" },
                  { label: "Hand Committed", icon: Hash, color: "text-blue-400", bg: "bg-blue-500/10", desc: "Hash sent to Polygon" },
                  { label: "VRF Shuffle", icon: Cpu, color: "text-emerald-400", bg: "bg-emerald-500/10", desc: "Chainlink randomness" },
                  { label: "Showdown", icon: ShieldCheck, color: "text-amber-400", bg: "bg-amber-500/10", desc: "Hand revealed on-chain" },
                  { label: "Verified", icon: CheckCircle, color: "text-green-400", bg: "bg-green-500/10", desc: "Anyone can audit" },
                ].map((step, i) => (
                  <div key={i} className="flex items-center gap-2 shrink-0">
                    <div className={`w-14 h-14 rounded-xl ${step.bg} flex flex-col items-center justify-center`}>
                      <step.icon className={`w-5 h-5 ${step.color}`} />
                    </div>
                    <div className="min-w-[80px]">
                      <div className={`text-[10px] font-bold ${step.color}`}>{step.label}</div>
                      <div className="text-[9px] text-gray-600">{step.desc}</div>
                    </div>
                    {i < 5 && <div className="text-gray-700 text-lg shrink-0">&rarr;</div>}
                  </div>
                ))}
              </div>
            </div>

            {/* Quick links */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <button onClick={() => setTab("kyc")} className="rounded-xl border border-white/10 bg-surface-high/20 p-4 text-left hover:bg-white/[0.03] transition-colors">
                <Fingerprint className="w-6 h-6 text-green-400 mb-2" />
                <div className="text-sm font-bold text-white">KYC Certification</div>
                <div className="text-xs text-gray-500 mt-1">{stats.kycOnChain} members with on-chain identity hashes</div>
              </button>
              <button onClick={() => setTab("hands")} className="rounded-xl border border-white/10 bg-surface-high/20 p-4 text-left hover:bg-white/[0.03] transition-colors">
                <Gamepad2 className="w-6 h-6 text-blue-400 mb-2" />
                <div className="text-sm font-bold text-white">Hand Verification</div>
                <div className="text-xs text-gray-500 mt-1">{stats.handsOnChain} hands with on-chain proof</div>
              </button>
              <button onClick={() => setTab("encryption")} className="rounded-xl border border-white/10 bg-surface-high/20 p-4 text-left hover:bg-white/[0.03] transition-colors">
                <Key className="w-6 h-6 text-purple-400 mb-2" />
                <div className="text-sm font-bold text-white">Encryption Audit</div>
                <div className="text-xs text-gray-500 mt-1">{stats.encryption?.totalAnchored || 0} session keys committed to chain</div>
              </button>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
