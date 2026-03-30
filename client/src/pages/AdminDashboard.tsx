import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useAuth } from "@/lib/auth-context";
import { useLocation, Link } from "wouter";
import { Shield, DollarSign, AlertTriangle, Server, CheckCircle, XCircle, Eye, ChevronDown, ChevronUp, Lock, Unlock, RefreshCw, Megaphone } from "lucide-react";

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

type Tab = "overview" | "withdrawals" | "collusion" | "system";

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
  const [error, setError] = useState<string | null>(null);
  const [processingRakeback, setProcessingRakeback] = useState(false);
  const [togglingLock, setTogglingLock] = useState(false);
  const [loading, setLoading] = useState(false);
  const [expandedAlert, setExpandedAlert] = useState<string | null>(null);

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
      ]).then(([s, rev, rake]) => {
        if (s) setStats(s);
        if (rev) setRevenueSummary(rev);
        if (rake) setRakeReport(rake);
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
    }
  }, [activeTab, user]);

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
    { key: "system", label: "System", icon: <Server className="w-4 h-4" /> },
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
          <Link href="/sponsorship">
            <span className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold text-gray-400 hover:text-white hover:bg-white/5 border border-transparent transition-all cursor-pointer">
              <Megaphone className="w-4 h-4" /> Sponsorship Reports
            </span>
          </Link>
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
      </div>
    </DashboardLayout>
  );
}
