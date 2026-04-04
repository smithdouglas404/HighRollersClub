import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useAuth } from "@/lib/auth-context";
import { useLocation } from "wouter";
import { Shield, DollarSign, AlertTriangle, Server, CheckCircle, XCircle, Eye, ChevronDown, ChevronUp, Lock, Unlock, RefreshCw, Settings, Save, ShieldAlert, Loader2, MessageSquare, Ticket } from "lucide-react";

interface AdminStats {
  totalUsers: number;
  activeTables: number;
  totalDeposits: number;
  totalWithdrawals: number;
}

interface WithdrawalRequest {
  id: string;
  userId: string;
  amount: number;
  currency: string;
  withdrawalAddress: string;
  status: string;
  createdAt: string;
}

interface CollusionAlertData {
  id: string;
  tableId: string;
  player1Id: string;
  player2Id: string;
  alertType: string;
  severity: string;
  details: any;
  status: string;
  createdAt: string;
}

interface RevenueSummary {
  grossRake: number;
  rakebackPaid: number;
  netRevenue: number;
  totalDeposits: number;
  totalBonuses: number;
  totalBuyins: number;
  totalCashouts: number;
  totalPrizes: number;
}

interface RakeReportEntry {
  tableId: string;
  handsPlayed: number;
  totalRake: number;
  reportDate: string;
}

interface RakeByPlayerEntry {
  userId: string;
  totalRake: number;
  handsPlayed: number;
}

interface SystemStatus {
  locked: boolean;
  reason: string;
}

interface RakebackResult {
  processed: number;
  totalPaid: number;
  payouts: { userId: string; amount: number }[];
}

interface TrialBalance {
  playerBalanceSum: number;
  escrowedAtTables: number;
  moneyIn: number;
  totalWithdrawals: number;
  totalRake: number;
  totalRakeback: number;
  totalPrizes: number;
  expectedBalance: number;
  discrepancy: number;
  healthy: boolean;
}

interface PaymentRecord {
  id: string;
  userId: string;
  amount: number;
  currency: string;
  status: string;
  provider: string;
  createdAt: string;
}

interface SocialLinks {
  twitter: string;
  discord: string;
  telegram: string;
}

interface KycApplication {
  id: string;
  username: string;
  displayName: string | null;
  memberId: string | null;
  kycStatus: string;
  kycData: { fullName: string; dateOfBirth: string; country: string; idType: string; submittedAt: string } | null;
  tier: string;
  createdAt: string;
}

interface RiskFlag {
  userId: string;
  score: number;
  reasons: string[];
}

interface AntiCheatLiveData {
  activeRiskFlags: RiskFlag[];
  pendingAlerts: CollusionAlertData[];
  totalPendingAlerts: number;
}

interface AdminTicket {
  id: string;
  userId: string;
  subject: string;
  status: string;
  priority: string;
  category: string;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
}

type Tab = "overview" | "withdrawals" | "collusion" | "system" | "payments" | "settings" | "kyc" | "security" | "support";

export default function AdminDashboard() {
  const { user, loading: authLoading } = useAuth();
  const [, navigate] = useLocation();
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([]);
  const [alerts, setAlerts] = useState<CollusionAlertData[]>([]);
  const [revenueSummary, setRevenueSummary] = useState<RevenueSummary | null>(null);
  const [rakeReport, setRakeReport] = useState<RakeReportEntry[]>([]);
  const [rakeByPlayer, setRakeByPlayer] = useState<RakeByPlayerEntry[]>([]);
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);
  const [rakebackResult, setRakebackResult] = useState<RakebackResult | null>(null);
  const [trialBalance, setTrialBalance] = useState<TrialBalance | null>(null);
  const [adminPayments, setAdminPayments] = useState<PaymentRecord[]>([]);
  const [socialLinks, setSocialLinks] = useState<SocialLinks>({ twitter: "", discord: "", telegram: "" });
  const [savingSocial, setSavingSocial] = useState(false);
  const [socialSaved, setSocialSaved] = useState(false);
  const [kycApplications, setKycApplications] = useState<KycApplication[]>([]);
  const [kycProcessing, setKycProcessing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [processingRakeback, setProcessingRakeback] = useState(false);
  const [togglingLock, setTogglingLock] = useState(false);
  const [loading, setLoading] = useState(false);
  const [expandedAlert, setExpandedAlert] = useState<string | null>(null);
  const [antiCheatData, setAntiCheatData] = useState<AntiCheatLiveData | null>(null);
  const [antiCheatLoading, setAntiCheatLoading] = useState(false);
  const [freezingUser, setFreezingUser] = useState<string | null>(null);
  const [adminTickets, setAdminTickets] = useState<AdminTicket[]>([]);
  const [adminTicketsLoading, setAdminTicketsLoading] = useState(false);
  const [ticketStatusFilter, setTicketStatusFilter] = useState<string>("all");
  const [changingTicketStatus, setChangingTicketStatus] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && user && user.role !== "admin") {
      navigate("/lobby");
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (!user || user.role !== "admin") return;
    setLoading(true);
    setError(null);

    if (activeTab === "overview") {
      Promise.all([
        fetch("/api/admin/stats", { credentials: "include" }).then(r => r.ok ? r.json() : null),
        fetch("/api/admin/revenue-summary", { credentials: "include" }).then(r => {
          if (!r.ok) throw new Error("Failed to fetch revenue summary");
          return r.json();
        }).catch(() => null),
        fetch("/api/admin/rake-report?days=30", { credentials: "include" }).then(r => {
          if (!r.ok) throw new Error("Failed to fetch rake report");
          return r.json();
        }).catch(() => []),
        fetch("/api/admin/trial-balance", { credentials: "include" }).then(r => {
          if (!r.ok) throw new Error("Failed to fetch trial balance");
          return r.json();
        }).catch(() => null),
      ]).then(([s, rev, rake, tb]) => {
        if (s) setStats(s);
        if (rev) setRevenueSummary(rev);
        if (rake) setRakeReport(rake);
        if (tb) setTrialBalance(tb);
      }).catch(err => {
        setError(err.message || "Failed to load overview data");
      }).finally(() => setLoading(false));
    } else if (activeTab === "withdrawals") {
      fetch("/api/admin/withdrawals?status=pending", { credentials: "include" })
        .then(r => r.ok ? r.json() : [])
        .then(setWithdrawals)
        .catch(err => setError(err.message || "Failed to load withdrawals"))
        .finally(() => setLoading(false));
    } else if (activeTab === "collusion") {
      fetch("/api/admin/collusion-alerts?status=pending", { credentials: "include" })
        .then(r => r.ok ? r.json() : [])
        .then(setAlerts)
        .catch(err => setError(err.message || "Failed to load collusion alerts"))
        .finally(() => setLoading(false));
    } else if (activeTab === "payments") {
      fetch("/api/admin/payments", { credentials: "include" })
        .then(r => r.ok ? r.json() : [])
        .then(setAdminPayments)
        .catch(err => setError(err.message || "Failed to load payments"))
        .finally(() => setLoading(false));
    } else if (activeTab === "settings") {
      fetch("/api/settings/social", { credentials: "include" })
        .then(r => r.ok ? r.json() : { twitter: "", discord: "", telegram: "" })
        .then(data => setSocialLinks(data))
        .catch(() => {})
        .finally(() => setLoading(false));
    } else if (activeTab === "kyc") {
      fetch("/api/admin/kyc/pending", { credentials: "include" })
        .then(r => r.ok ? r.json() : [])
        .then(setKycApplications)
        .catch(err => setError(err.message || "Failed to load KYC applications"))
        .finally(() => setLoading(false));
    } else if (activeTab === "system") {
      Promise.all([
        fetch("/api/admin/system-status", { credentials: "include" }).then(r => {
          if (!r.ok) throw new Error("Failed to fetch system status");
          return r.json();
        }).catch(() => null),
        fetch("/api/admin/rake-by-player?days=30", { credentials: "include" }).then(r => {
          if (!r.ok) throw new Error("Failed to fetch rake by player");
          return r.json();
        }).catch(() => []),
      ]).then(([status, rakeByP]) => {
        if (status) setSystemStatus(status);
        if (rakeByP) setRakeByPlayer(rakeByP);
      }).catch(err => {
        setError(err.message || "Failed to load system data");
      }).finally(() => setLoading(false));
    } else if (activeTab === "security") {
      setAntiCheatLoading(true);
      fetch("/api/admin/anti-cheat/live", { credentials: "include" })
        .then(r => r.ok ? r.json() : null)
        .then(data => { if (data) setAntiCheatData(data); })
        .catch(err => setError(err.message || "Failed to load anti-cheat data"))
        .finally(() => { setAntiCheatLoading(false); setLoading(false); });
    } else if (activeTab === "support") {
      setAdminTicketsLoading(true);
      const statusParam = ticketStatusFilter !== "all" ? `?status=${ticketStatusFilter}` : "";
      fetch(`/api/admin/support/tickets${statusParam}`, { credentials: "include" })
        .then(r => r.ok ? r.json() : [])
        .then(setAdminTickets)
        .catch(err => setError(err.message || "Failed to load tickets"))
        .finally(() => { setAdminTicketsLoading(false); setLoading(false); });
    }
  }, [activeTab, user, ticketStatusFilter]);

  const handleFreezeAccount = async (userId: string) => {
    setFreezingUser(userId);
    try {
      const res = await fetch(`/api/admin/anti-cheat/freeze/${userId}`, {
        method: "POST",
        credentials: "include",
      });
      if (res.ok) {
        setAntiCheatData(prev => prev ? {
          ...prev,
          activeRiskFlags: prev.activeRiskFlags.filter(f => f.userId !== userId),
        } : prev);
      }
    } catch (err: any) {
      setError(err.message || "Failed to freeze account");
    } finally {
      setFreezingUser(null);
    }
  };

  const handleChangeTicketStatus = async (ticketId: string, newStatus: string) => {
    setChangingTicketStatus(ticketId);
    try {
      const res = await fetch(`/api/admin/support/tickets/${ticketId}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        const updated = await res.json();
        setAdminTickets(prev => prev.map(t => t.id === ticketId ? { ...t, ...updated } : t));
      }
    } catch (err: any) {
      setError(err.message || "Failed to update ticket status");
    } finally {
      setChangingTicketStatus(null);
    }
  };

  const handleWithdrawalAction = async (id: string, action: "approve" | "reject") => {
    const res = await fetch(`/api/admin/withdrawals/${id}/${action}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
    });
    if (res.ok) {
      setWithdrawals(prev => prev.filter(w => w.id !== id));
    }
  };

  const handleAlertReview = async (id: string, status: "reviewed" | "dismissed") => {
    const res = await fetch(`/api/admin/collusion-alerts/${id}/review`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ status }),
    });
    if (res.ok) {
      setAlerts(prev => prev.filter(a => a.id !== id));
    }
  };

  const handleProcessRakeback = async () => {
    setProcessingRakeback(true);
    setRakebackResult(null);
    setError(null);
    try {
      const res = await fetch("/api/admin/process-rakeback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ rakebackPercent: 20, days: 7 }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Failed to process rakeback");
      }
      const result = await res.json();
      setRakebackResult(result);
    } catch (err: any) {
      setError(err.message || "Failed to process rakeback");
    } finally {
      setProcessingRakeback(false);
    }
  };

  const handleToggleSystemLock = async () => {
    if (!systemStatus) return;
    setTogglingLock(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/system-lock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          locked: !systemStatus.locked,
          reason: !systemStatus.locked ? "Manual admin lock" : "",
        }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Failed to toggle system lock");
      }
      const result = await res.json();
      setSystemStatus(result);
    } catch (err: any) {
      setError(err.message || "Failed to toggle system lock");
    } finally {
      setTogglingLock(false);
    }
  };

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: "overview", label: "Overview", icon: <Shield className="w-4 h-4" /> },
    { key: "withdrawals", label: "Withdrawals", icon: <DollarSign className="w-4 h-4" /> },
    { key: "collusion", label: "Collusion", icon: <AlertTriangle className="w-4 h-4" /> },
    { key: "payments", label: "Payments", icon: <Eye className="w-4 h-4" /> },
    { key: "kyc", label: "KYC", icon: <Shield className="w-4 h-4" /> },
    { key: "system", label: "System", icon: <Server className="w-4 h-4" /> },
    { key: "settings", label: "Settings", icon: <Settings className="w-4 h-4" /> },
    { key: "security", label: "Security", icon: <ShieldAlert className="w-4 h-4" /> },
    { key: "support", label: "Support", icon: <Ticket className="w-4 h-4" /> },
  ];

  if (authLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-20">
          <div className="spinner spinner-md" />
        </div>
      </DashboardLayout>
    );
  }

  if (!user || user.role !== "admin") {
    return <DashboardLayout><div className="p-8 text-center text-gray-400">Access denied</div></DashboardLayout>;
  }

  return (
    <DashboardLayout>
      <div className="p-6 max-w-6xl mx-auto space-y-6">
        <h1 className="text-2xl font-bold text-white font-display">Admin Dashboard</h1>

        {/* Tabs */}
        <div className="flex gap-2 flex-wrap">
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                activeTab === t.key
                  ? "bg-primary/20 text-primary border border-primary/30"
                  : "text-gray-400 hover:text-white hover:bg-white/5 border border-transparent"
              }`}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {loading && (
          <div className="flex items-center justify-center py-12">
            <div className="spinner spinner-md" />
          </div>
        )}

        {error && (
          <div className="glass rounded-xl p-4 border border-red-500/30 bg-red-500/10">
            <div className="flex items-center gap-2 text-red-400 text-sm">
              <AlertTriangle className="w-4 h-4" />
              <span>{error}</span>
            </div>
          </div>
        )}

        {/* Overview */}
        {!loading && activeTab === "overview" && (
          <div className="space-y-6">
            {/* Stats cards from /api/admin/stats */}
            {stats && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: "Total Users", value: stats.totalUsers, colorClass: "text-primary" },
                  { label: "Active Tables", value: stats.activeTables, colorClass: "text-green-400" },
                  { label: "Total Deposits", value: `$${(stats.totalDeposits / 100).toFixed(2)}`, colorClass: "text-primary" },
                  { label: "Withdrawals", value: `$${(stats.totalWithdrawals / 100).toFixed(2)}`, colorClass: "text-red-400" },
                ].map((stat, i) => (
                  <div key={i} className="glass rounded-xl p-4 text-center">
                    <div className="text-xs text-gray-500 uppercase mb-1">{stat.label}</div>
                    <div className={`text-xl font-bold font-mono ${stat.colorClass}`}>{stat.value}</div>
                  </div>
                ))}
              </div>
            )}

            {/* Revenue summary from /api/admin/revenue-summary */}
            {revenueSummary && (
              <div>
                <h3 className="text-sm font-bold text-white mb-3">Revenue Summary</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[
                    { label: "Gross Rake", value: (revenueSummary.grossRake / 100).toFixed(2), colorClass: "text-primary" },
                    { label: "Rakeback Paid", value: (revenueSummary.rakebackPaid / 100).toFixed(2), colorClass: "text-amber-400" },
                    { label: "Net Revenue", value: (revenueSummary.netRevenue / 100).toFixed(2), colorClass: "text-green-400" },
                    { label: "Total Buyins", value: (revenueSummary.totalBuyins / 100).toFixed(2), colorClass: "text-blue-400" },
                  ].map((stat, i) => (
                    <div key={i} className="glass rounded-xl p-4 text-center">
                      <div className="text-xs text-gray-500 uppercase mb-1">{stat.label}</div>
                      <div className={`text-xl font-bold font-mono ${stat.colorClass}`}>${stat.value}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Rake report table from /api/admin/rake-report */}
            {rakeReport.length > 0 && (
              <div>
                <h3 className="text-sm font-bold text-white mb-3">Daily Rake Report (Last 30 Days)</h3>
                <div className="glass rounded-xl overflow-hidden">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-white/10">
                        <th className="text-left p-3 text-gray-500 uppercase font-bold">Date</th>
                        <th className="text-left p-3 text-gray-500 uppercase font-bold">Table</th>
                        <th className="text-right p-3 text-gray-500 uppercase font-bold">Hands</th>
                        <th className="text-right p-3 text-gray-500 uppercase font-bold">Rake</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rakeReport.slice(0, 20).map((entry, i) => (
                        <tr key={i} className="border-b border-white/5 hover:bg-white/5">
                          <td className="p-3 text-gray-400 font-mono">{entry.reportDate}</td>
                          <td className="p-3 text-gray-400 font-mono">{entry.tableId.slice(0, 12)}...</td>
                          <td className="p-3 text-right text-gray-400 font-mono">{entry.handsPlayed}</td>
                          <td className="p-3 text-right text-primary font-mono font-bold">${(entry.totalRake / 100).toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Trial Balance from /api/admin/trial-balance */}
            {trialBalance && (
              <div>
                <h3 className="text-sm font-bold text-white mb-3">Trial Balance (Audit)</h3>
                <div className={`glass rounded-xl p-5 border ${trialBalance.healthy ? "border-green-500/20" : "border-red-500/30 bg-red-500/5"}`}>
                  <div className="flex items-center gap-2 mb-4">
                    <div className={`w-2.5 h-2.5 rounded-full ${trialBalance.healthy ? "bg-green-500" : "bg-red-500 animate-pulse"}`} />
                    <span className={`text-xs font-bold ${trialBalance.healthy ? "text-green-400" : "text-red-400"}`}>
                      {trialBalance.healthy ? "Balanced — No Discrepancy" : `Discrepancy: $${(trialBalance.discrepancy / 100).toFixed(2)}`}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                      { label: "Player Balances", value: trialBalance.playerBalanceSum, color: "text-primary" },
                      { label: "Table Escrow", value: trialBalance.escrowedAtTables, color: "text-amber-400" },
                      { label: "Money In", value: trialBalance.moneyIn, color: "text-green-400" },
                      { label: "Withdrawals", value: trialBalance.totalWithdrawals, color: "text-red-400" },
                      { label: "Total Rake", value: trialBalance.totalRake, color: "text-primary" },
                      { label: "Rakeback Paid", value: trialBalance.totalRakeback, color: "text-purple-400" },
                      { label: "Prizes Paid", value: trialBalance.totalPrizes, color: "text-amber-400" },
                      { label: "Expected Balance", value: trialBalance.expectedBalance, color: "text-white" },
                    ].map((item) => (
                      <div key={item.label} className="p-2.5 rounded-lg bg-white/[0.03] border border-white/[0.06]">
                        <div className="text-[0.5625rem] text-gray-500 uppercase tracking-wider font-bold">{item.label}</div>
                        <div className={`text-sm font-mono font-bold mt-0.5 ${item.color}`}>${(item.value / 100).toFixed(2)}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Payments */}
        {!loading && activeTab === "payments" && (
          <div className="space-y-3">
            {adminPayments.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4 bg-primary/10 border border-primary/15">
                  <DollarSign className="w-7 h-7 text-primary/40" />
                </div>
                <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-1">No Payments</h3>
                <p className="text-xs text-muted-foreground/60 max-w-xs">No payment records found.</p>
              </div>
            ) : (
              <div className="glass rounded-xl overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-white/10">
                      <th className="text-left p-3 text-gray-500 uppercase font-bold">ID</th>
                      <th className="text-left p-3 text-gray-500 uppercase font-bold">User</th>
                      <th className="text-right p-3 text-gray-500 uppercase font-bold">Amount</th>
                      <th className="text-left p-3 text-gray-500 uppercase font-bold">Currency</th>
                      <th className="text-left p-3 text-gray-500 uppercase font-bold">Provider</th>
                      <th className="text-left p-3 text-gray-500 uppercase font-bold">Status</th>
                      <th className="text-left p-3 text-gray-500 uppercase font-bold">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {adminPayments.map((p) => (
                      <tr key={p.id} className="border-b border-white/5 hover:bg-white/5">
                        <td className="p-3 text-gray-400 font-mono">{p.id.slice(0, 10)}...</td>
                        <td className="p-3 text-gray-400 font-mono">{p.userId.slice(0, 12)}...</td>
                        <td className="p-3 text-right text-primary font-mono font-bold">{p.amount}</td>
                        <td className="p-3 text-gray-400 uppercase">{p.currency}</td>
                        <td className="p-3 text-gray-400">{p.provider}</td>
                        <td className="p-3">
                          <span className={`px-2 py-0.5 rounded-full text-[0.5625rem] font-bold ${
                            p.status === "completed" ? "bg-green-500/20 text-green-400" :
                            p.status === "pending" ? "bg-amber-500/20 text-amber-400" :
                            p.status === "failed" ? "bg-red-500/20 text-red-400" :
                            "bg-white/10 text-gray-400"
                          }`}>
                            {p.status}
                          </span>
                        </td>
                        <td className="p-3 text-gray-500 font-mono">{new Date(p.createdAt).toLocaleDateString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Withdrawals */}
        {!loading && activeTab === "withdrawals" && (
          <div className="space-y-3">
            {withdrawals.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4 bg-primary/10 border border-primary/15">
                  <DollarSign className="w-7 h-7 text-primary/40" />
                </div>
                <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-1">No Pending Withdrawals</h3>
                <p className="text-xs text-muted-foreground/60 max-w-xs">All withdrawal requests have been processed. New requests will appear here.</p>
              </div>
            ) : withdrawals.map(w => (
              <div key={w.id} className="glass rounded-xl p-4 flex items-center justify-between">
                <div>
                  <div className="text-sm font-bold text-white">{w.amount.toLocaleString()} chips</div>
                  <div className="text-xs text-gray-500">{w.currency} to {w.withdrawalAddress.slice(0, 12)}...</div>
                  <div className="text-xs text-gray-600">{new Date(w.createdAt).toLocaleString()}</div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleWithdrawalAction(w.id, "approve")}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-green-500/20 text-green-400 text-xs font-bold hover:bg-green-500/30 transition-colors"
                  >
                    <CheckCircle className="w-3 h-3" /> Approve
                  </button>
                  <button
                    onClick={() => handleWithdrawalAction(w.id, "reject")}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-red-500/20 text-red-400 text-xs font-bold hover:bg-red-500/30 transition-colors"
                  >
                    <XCircle className="w-3 h-3" /> Deny
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Collusion Alerts */}
        {!loading && activeTab === "collusion" && (
          <div className="space-y-3">
            {alerts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4 bg-primary/10 border border-primary/15">
                  <Shield className="w-7 h-7 text-primary/40" />
                </div>
                <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-1">No Collusion Alerts</h3>
                <p className="text-xs text-muted-foreground/60 max-w-xs">No suspicious activity has been detected. Alerts will appear here when flagged.</p>
              </div>
            ) : alerts.map(a => (
              <div key={a.id} className="glass rounded-xl p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${
                      a.severity === "high" ? "bg-red-500" : a.severity === "medium" ? "bg-amber-500" : "bg-yellow-500"
                    }`} />
                    <div>
                      <div className="text-sm font-bold text-white">{a.alertType}</div>
                      <div className="text-xs text-gray-500">
                        Players: {a.player1Id.slice(0, 8)}... vs {a.player2Id.slice(0, 8)}...
                      </div>
                      <div className="text-xs text-gray-600">Table: {a.tableId.slice(0, 8)}... | {new Date(a.createdAt).toLocaleString()}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setExpandedAlert(expandedAlert === a.id ? null : a.id)}
                      className="p-1.5 rounded-lg hover:bg-white/5 text-gray-500 transition-colors"
                    >
                      {expandedAlert === a.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                    <button
                      onClick={() => handleAlertReview(a.id, "reviewed")}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-primary/20 text-primary text-xs font-bold hover:bg-primary/30 transition-colors"
                    >
                      <Eye className="w-3 h-3" /> Review
                    </button>
                    <button
                      onClick={() => handleAlertReview(a.id, "dismissed")}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-gray-500/20 text-gray-400 text-xs font-bold hover:bg-gray-500/30 transition-colors"
                    >
                      <XCircle className="w-3 h-3" /> Dismiss
                    </button>
                  </div>
                </div>
                {expandedAlert === a.id && a.details && (
                  <div className="mt-3 p-3 rounded-lg bg-black/30 text-xs text-gray-400 font-mono overflow-auto max-h-40">
                    {JSON.stringify(a.details, null, 2)}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* KYC Applications */}
        {!loading && activeTab === "kyc" && (
          <div className="space-y-3">
            {kycApplications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4 bg-primary/10 border border-primary/15">
                  <Shield className="w-7 h-7 text-primary/40" />
                </div>
                <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-1">No Pending Applications</h3>
                <p className="text-xs text-muted-foreground/60 max-w-xs">All KYC applications have been processed.</p>
              </div>
            ) : kycApplications.map(app => (
              <div key={app.id} className="glass rounded-xl p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-bold text-white">{app.kycData?.fullName || app.username}</div>
                    <div className="text-xs text-gray-500">@{app.username} | {app.memberId || "No member ID"}</div>
                    {app.kycData && (
                      <div className="text-xs text-gray-600 mt-1">
                        DOB: {app.kycData.dateOfBirth} | Country: {app.kycData.country} | ID: {app.kycData.idType}
                      </div>
                    )}
                    <div className="text-xs text-gray-600">Tier: {app.tier} | Submitted: {app.kycData?.submittedAt ? new Date(app.kycData.submittedAt).toLocaleString() : "N/A"}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={async () => {
                        setKycProcessing(app.id);
                        try {
                          const res = await fetch(`/api/admin/kyc/${app.id}/verify`, { method: "POST", credentials: "include" });
                          if (res.ok) {
                            setKycApplications(prev => prev.filter(a => a.id !== app.id));
                          }
                        } finally { setKycProcessing(null); }
                      }}
                      disabled={kycProcessing === app.id}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-green-500/20 text-green-400 text-xs font-bold hover:bg-green-500/30 transition-colors"
                    >
                      <CheckCircle className="w-3 h-3" /> Verify
                    </button>
                    <button
                      onClick={async () => {
                        const reason = prompt("Rejection reason:");
                        if (reason === null) return;
                        setKycProcessing(app.id);
                        try {
                          const res = await fetch(`/api/admin/kyc/${app.id}/reject`, {
                            method: "POST",
                            credentials: "include",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ reason }),
                          });
                          if (res.ok) {
                            setKycApplications(prev => prev.filter(a => a.id !== app.id));
                          }
                        } finally { setKycProcessing(null); }
                      }}
                      disabled={kycProcessing === app.id}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-red-500/20 text-red-400 text-xs font-bold hover:bg-red-500/30 transition-colors"
                    >
                      <XCircle className="w-3 h-3" /> Reject
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* System */}
        {!loading && activeTab === "system" && (
          <div className="space-y-6">
            {/* System Lock Status */}
            {systemStatus && (
              <div className="glass rounded-xl p-6">
                <h3 className="text-sm font-bold text-white mb-4">System Lock Status</h3>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full ${systemStatus.locked ? "bg-red-500 animate-pulse" : "bg-green-500"}`} />
                    <div>
                      <div className="text-sm font-bold text-white">
                        {systemStatus.locked ? "System Locked" : "System Operational"}
                      </div>
                      {systemStatus.reason && (
                        <div className="text-xs text-gray-500 mt-0.5">{systemStatus.reason}</div>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={handleToggleSystemLock}
                    disabled={togglingLock}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-colors ${
                      systemStatus.locked
                        ? "bg-green-500/20 text-green-400 hover:bg-green-500/30"
                        : "bg-red-500/20 text-red-400 hover:bg-red-500/30"
                    } disabled:opacity-50`}
                  >
                    {togglingLock ? (
                      <RefreshCw className="w-3 h-3 animate-spin" />
                    ) : systemStatus.locked ? (
                      <Unlock className="w-3 h-3" />
                    ) : (
                      <Lock className="w-3 h-3" />
                    )}
                    {systemStatus.locked ? "Unlock System" : "Lock System"}
                  </button>
                </div>
              </div>
            )}

            {/* Process Rakeback */}
            <div className="glass rounded-xl p-6">
              <h3 className="text-sm font-bold text-white mb-4">Rakeback Processing</h3>
              <p className="text-xs text-gray-500 mb-4">Process 20% rakeback payouts for all players based on the last 7 days of rake contributions.</p>
              <button
                onClick={handleProcessRakeback}
                disabled={processingRakeback}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary/20 text-primary text-xs font-bold hover:bg-primary/30 transition-colors disabled:opacity-50"
              >
                {processingRakeback ? (
                  <RefreshCw className="w-3 h-3 animate-spin" />
                ) : (
                  <DollarSign className="w-3 h-3" />
                )}
                {processingRakeback ? "Processing..." : "Process Rakeback"}
              </button>
              {rakebackResult && (
                <div className="mt-4 p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                  <div className="text-xs text-green-400 font-bold">
                    Processed {rakebackResult.processed} player{rakebackResult.processed !== 1 ? "s" : ""} - Total paid: ${(rakebackResult.totalPaid / 100).toFixed(2)}
                  </div>
                  {rakebackResult.payouts.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {rakebackResult.payouts.map((p, i) => (
                        <div key={i} className="text-xs text-gray-400 font-mono">
                          {p.userId.slice(0, 12)}... - ${(p.amount / 100).toFixed(2)}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Rake by Player from /api/admin/rake-by-player */}
            {rakeByPlayer.length > 0 && (
              <div>
                <h3 className="text-sm font-bold text-white mb-3">Rake by Player (Last 30 Days)</h3>
                <div className="glass rounded-xl overflow-hidden">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-white/10">
                        <th className="text-left p-3 text-gray-500 uppercase font-bold">Player</th>
                        <th className="text-right p-3 text-gray-500 uppercase font-bold">Hands</th>
                        <th className="text-right p-3 text-gray-500 uppercase font-bold">Total Rake</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rakeByPlayer.slice(0, 20).map((entry, i) => (
                        <tr key={i} className="border-b border-white/5 hover:bg-white/5">
                          <td className="p-3 text-gray-400 font-mono">{entry.userId.slice(0, 16)}...</td>
                          <td className="p-3 text-right text-gray-400 font-mono">{entry.handsPlayed}</td>
                          <td className="p-3 text-right text-primary font-mono font-bold">${(entry.totalRake / 100).toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Settings */}
        {!loading && activeTab === "settings" && (
          <div className="space-y-6">
            <div className="glass rounded-xl p-6">
              <h3 className="text-sm font-bold text-white mb-4">Social Links</h3>
              <p className="text-xs text-gray-500 mb-4">Configure social media URLs displayed in the landing page footer. Leave blank to hide a link.</p>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs text-gray-400 font-bold uppercase tracking-wider mb-1">Twitter / X URL</label>
                  <input
                    type="url"
                    value={socialLinks.twitter}
                    onChange={e => { setSocialLinks(prev => ({ ...prev, twitter: e.target.value })); setSocialSaved(false); }}
                    placeholder="https://x.com/yourhandle"
                    className="w-full rounded-lg px-4 py-2.5 text-sm bg-white/5 border border-white/10 text-white placeholder-gray-600 focus:border-primary/40 focus:outline-none transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 font-bold uppercase tracking-wider mb-1">Discord URL</label>
                  <input
                    type="url"
                    value={socialLinks.discord}
                    onChange={e => { setSocialLinks(prev => ({ ...prev, discord: e.target.value })); setSocialSaved(false); }}
                    placeholder="https://discord.gg/invite-code"
                    className="w-full rounded-lg px-4 py-2.5 text-sm bg-white/5 border border-white/10 text-white placeholder-gray-600 focus:border-primary/40 focus:outline-none transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 font-bold uppercase tracking-wider mb-1">Telegram URL</label>
                  <input
                    type="url"
                    value={socialLinks.telegram}
                    onChange={e => { setSocialLinks(prev => ({ ...prev, telegram: e.target.value })); setSocialSaved(false); }}
                    placeholder="https://t.me/yourchannel"
                    className="w-full rounded-lg px-4 py-2.5 text-sm bg-white/5 border border-white/10 text-white placeholder-gray-600 focus:border-primary/40 focus:outline-none transition-colors"
                  />
                </div>
                <div className="flex items-center gap-3 pt-2">
                  <button
                    onClick={async () => {
                      setSavingSocial(true);
                      setSocialSaved(false);
                      setError(null);
                      try {
                        const res = await fetch("/api/settings/social", {
                          method: "PUT",
                          headers: { "Content-Type": "application/json" },
                          credentials: "include",
                          body: JSON.stringify(socialLinks),
                        });
                        if (!res.ok) {
                          const errData = await res.json().catch(() => ({}));
                          throw new Error(errData.message || "Failed to save social links");
                        }
                        const saved = await res.json();
                        setSocialLinks(saved);
                        setSocialSaved(true);
                      } catch (err: any) {
                        setError(err.message || "Failed to save social links");
                      } finally {
                        setSavingSocial(false);
                      }
                    }}
                    disabled={savingSocial}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary/20 text-primary text-xs font-bold hover:bg-primary/30 transition-colors disabled:opacity-50"
                  >
                    {savingSocial ? (
                      <RefreshCw className="w-3 h-3 animate-spin" />
                    ) : (
                      <Save className="w-3 h-3" />
                    )}
                    {savingSocial ? "Saving..." : "Save Social Links"}
                  </button>
                  {socialSaved && (
                    <span className="text-xs text-green-400 font-bold flex items-center gap-1">
                      <CheckCircle className="w-3 h-3" /> Saved
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Security Tab */}
        {!loading && activeTab === "security" && (
          <div className="space-y-6">
            <h3 className="text-sm font-bold text-white">Live Anti-Cheat Monitor</h3>

            {antiCheatLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
              </div>
            ) : !antiCheatData ? (
              <div className="glass rounded-xl p-6 text-center text-gray-400 text-sm">
                Unable to load anti-cheat data
              </div>
            ) : (
              <>
                {/* Summary */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="glass rounded-xl p-4 text-center">
                    <div className="text-xs text-gray-500 uppercase mb-1">Active Risk Flags</div>
                    <div className="text-xl font-bold font-mono text-red-400">{antiCheatData.activeRiskFlags.length}</div>
                  </div>
                  <div className="glass rounded-xl p-4 text-center">
                    <div className="text-xs text-gray-500 uppercase mb-1">Pending Alerts</div>
                    <div className="text-xl font-bold font-mono text-amber-400">{antiCheatData.totalPendingAlerts}</div>
                  </div>
                </div>

                {/* Risk Flags */}
                {antiCheatData.activeRiskFlags.length > 0 && (
                  <div>
                    <h4 className="text-xs font-bold text-white mb-2 uppercase tracking-wider">Player Risk Scores</h4>
                    <div className="glass rounded-xl overflow-hidden">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-white/10">
                            <th className="text-left p-3 text-gray-500 uppercase font-bold">User ID</th>
                            <th className="text-right p-3 text-gray-500 uppercase font-bold">Risk Score</th>
                            <th className="text-left p-3 text-gray-500 uppercase font-bold">Reasons</th>
                            <th className="text-right p-3 text-gray-500 uppercase font-bold">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {antiCheatData.activeRiskFlags.map((flag) => (
                            <tr key={flag.userId} className="border-b border-white/5 hover:bg-white/5">
                              <td className="p-3 text-gray-400 font-mono">{flag.userId.slice(0, 12)}...</td>
                              <td className="p-3 text-right">
                                <span className={`font-bold font-mono px-2 py-0.5 rounded ${
                                  flag.score >= 70 ? "bg-red-500/20 text-red-400" :
                                  flag.score >= 40 ? "bg-amber-500/20 text-amber-400" :
                                  "bg-yellow-500/20 text-yellow-400"
                                }`}>
                                  {flag.score}
                                </span>
                              </td>
                              <td className="p-3 text-gray-400 max-w-xs">
                                <div className="space-y-0.5">
                                  {flag.reasons.slice(0, 2).map((r, i) => (
                                    <div key={i} className="text-[0.5625rem] truncate">{r}</div>
                                  ))}
                                </div>
                              </td>
                              <td className="p-3 text-right">
                                <button
                                  onClick={() => handleFreezeAccount(flag.userId)}
                                  disabled={freezingUser === flag.userId}
                                  className="px-3 py-1 rounded text-[0.5625rem] font-bold bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30 transition-colors disabled:opacity-50"
                                >
                                  {freezingUser === flag.userId ? "Freezing..." : "Freeze Account"}
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Live Alerts */}
                {antiCheatData.pendingAlerts.length > 0 && (
                  <div>
                    <h4 className="text-xs font-bold text-white mb-2 uppercase tracking-wider">Pending Alerts</h4>
                    <div className="space-y-2">
                      {antiCheatData.pendingAlerts.slice(0, 20).map((alert) => (
                        <div key={alert.id} className={`glass rounded-xl p-4 border ${
                          alert.severity === "high" ? "border-red-500/30" :
                          alert.severity === "medium" ? "border-amber-500/30" :
                          "border-yellow-500/30"
                        }`}>
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-2">
                              <span className={`text-[0.5625rem] font-bold px-2 py-0.5 rounded ${
                                alert.severity === "high" ? "bg-red-500/20 text-red-400" :
                                alert.severity === "medium" ? "bg-amber-500/20 text-amber-400" :
                                "bg-yellow-500/20 text-yellow-400"
                              }`}>
                                {alert.severity.toUpperCase()}
                              </span>
                              <span className="text-xs font-bold text-white">{alert.alertType.replace(/_/g, " ")}</span>
                            </div>
                            <span className="text-[0.5625rem] text-gray-500">{new Date(alert.createdAt).toLocaleString()}</span>
                          </div>
                          <div className="text-[0.5625rem] text-gray-400">
                            Table: {alert.tableId.slice(0, 12)}... | Players: {alert.player1Id.slice(0, 8)}... vs {alert.player2Id.slice(0, 8)}...
                          </div>
                          <div className="flex gap-2 mt-2">
                            <button
                              onClick={() => handleAlertReview(alert.id, "reviewed")}
                              className="px-2 py-1 text-[0.5625rem] font-bold rounded bg-green-500/20 text-green-400 border border-green-500/30 hover:bg-green-500/30 transition-colors"
                            >
                              Mark Reviewed
                            </button>
                            <button
                              onClick={() => handleAlertReview(alert.id, "dismissed")}
                              className="px-2 py-1 text-[0.5625rem] font-bold rounded bg-gray-500/20 text-gray-400 border border-gray-500/30 hover:bg-gray-500/30 transition-colors"
                            >
                              Dismiss
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {antiCheatData.activeRiskFlags.length === 0 && antiCheatData.pendingAlerts.length === 0 && (
                  <div className="glass rounded-xl p-8 text-center">
                    <CheckCircle className="w-8 h-8 text-green-400 mx-auto mb-2" />
                    <div className="text-sm text-gray-400">No active threats detected</div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Support Tab */}
        {!loading && activeTab === "support" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white">Support Ticket Queue</h3>
              <div className="flex gap-2">
                {["all", "open", "in-progress", "resolved", "closed"].map((s) => (
                  <button
                    key={s}
                    onClick={() => setTicketStatusFilter(s)}
                    className={`px-3 py-1 text-[0.5625rem] font-bold rounded-lg transition-colors ${
                      ticketStatusFilter === s
                        ? "bg-primary/20 text-primary border border-primary/30"
                        : "text-gray-400 hover:text-white hover:bg-white/5 border border-transparent"
                    }`}
                  >
                    {s === "all" ? "All" : s.replace("-", " ").replace(/\b\w/g, l => l.toUpperCase())}
                  </button>
                ))}
              </div>
            </div>

            {adminTicketsLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
              </div>
            ) : adminTickets.length === 0 ? (
              <div className="glass rounded-xl p-8 text-center text-gray-400 text-sm">
                No tickets found
              </div>
            ) : (
              <div className="glass rounded-xl overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-white/10">
                      <th className="text-left p-3 text-gray-500 uppercase font-bold">Subject</th>
                      <th className="text-left p-3 text-gray-500 uppercase font-bold">Category</th>
                      <th className="text-left p-3 text-gray-500 uppercase font-bold">Priority</th>
                      <th className="text-left p-3 text-gray-500 uppercase font-bold">Status</th>
                      <th className="text-left p-3 text-gray-500 uppercase font-bold">Created</th>
                      <th className="text-right p-3 text-gray-500 uppercase font-bold">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {adminTickets.map((ticket) => (
                      <tr key={ticket.id} className="border-b border-white/5 hover:bg-white/5">
                        <td className="p-3 text-white font-medium max-w-xs truncate">{ticket.subject}</td>
                        <td className="p-3 text-gray-400 capitalize">{ticket.category}</td>
                        <td className="p-3">
                          <span className={`px-2 py-0.5 rounded text-[0.5625rem] font-bold ${
                            ticket.priority === "urgent" ? "bg-red-500/20 text-red-400" :
                            ticket.priority === "high" ? "bg-amber-500/20 text-amber-400" :
                            ticket.priority === "medium" ? "bg-blue-500/20 text-blue-400" :
                            "bg-gray-500/20 text-gray-400"
                          }`}>
                            {ticket.priority}
                          </span>
                        </td>
                        <td className="p-3">
                          <span className={`px-2 py-0.5 rounded text-[0.5625rem] font-bold ${
                            ticket.status === "open" ? "bg-green-500/20 text-green-400" :
                            ticket.status === "in-progress" ? "bg-blue-500/20 text-blue-400" :
                            ticket.status === "resolved" ? "bg-purple-500/20 text-purple-400" :
                            "bg-gray-500/20 text-gray-400"
                          }`}>
                            {ticket.status}
                          </span>
                        </td>
                        <td className="p-3 text-gray-400 font-mono">{new Date(ticket.createdAt).toLocaleDateString()}</td>
                        <td className="p-3 text-right">
                          <select
                            value={ticket.status}
                            onChange={(e) => handleChangeTicketStatus(ticket.id, e.target.value)}
                            disabled={changingTicketStatus === ticket.id}
                            className="bg-white/5 border border-white/10 rounded px-2 py-1 text-[0.5625rem] text-gray-300 focus:outline-none focus:border-primary/40"
                          >
                            <option value="open">Open</option>
                            <option value="in-progress">In Progress</option>
                            <option value="resolved">Resolved</option>
                            <option value="closed">Closed</option>
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
