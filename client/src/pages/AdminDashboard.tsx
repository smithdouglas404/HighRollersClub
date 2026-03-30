import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useAuth } from "@/lib/auth-context";
import { useLocation } from "wouter";
import { Shield, DollarSign, AlertTriangle, Server, CheckCircle, XCircle, Eye, ChevronDown, ChevronUp } from "lucide-react";

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

type Tab = "overview" | "withdrawals" | "collusion" | "system";

export default function AdminDashboard() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([]);
  const [alerts, setAlerts] = useState<CollusionAlertData[]>([]);
  const [systemStats, setSystemStats] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [expandedAlert, setExpandedAlert] = useState<string | null>(null);

  useEffect(() => {
    if (user && user.role !== "admin") {
      navigate("/lobby");
    }
  }, [user, navigate]);

  useEffect(() => {
    if (!user || user.role !== "admin") return;
    setLoading(true);

    if (activeTab === "overview") {
      Promise.all([
        fetch("/api/admin/stats").then(r => r.ok ? r.json() : null),
      ]).then(([s]) => {
        if (s) setStats(s);
      }).finally(() => setLoading(false));
    } else if (activeTab === "withdrawals") {
      fetch("/api/admin/withdrawals?status=pending")
        .then(r => r.ok ? r.json() : [])
        .then(setWithdrawals)
        .finally(() => setLoading(false));
    } else if (activeTab === "collusion") {
      fetch("/api/admin/collusion-alerts?status=pending")
        .then(r => r.ok ? r.json() : [])
        .then(setAlerts)
        .finally(() => setLoading(false));
    } else if (activeTab === "system") {
      fetch("/api/admin/stats")
        .then(r => r.ok ? r.json() : null)
        .then(setSystemStats)
        .finally(() => setLoading(false));
    }
  }, [activeTab, user]);

  const handleWithdrawalAction = async (id: string, action: "approve" | "reject") => {
    const res = await fetch(`/api/admin/withdrawals/${id}/${action}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    if (res.ok) {
      setWithdrawals(prev => prev.filter(w => w.id !== id));
    }
  };

  const handleAlertReview = async (id: string, status: "reviewed" | "dismissed") => {
    const res = await fetch(`/api/admin/collusion-alerts/${id}/review`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (res.ok) {
      setAlerts(prev => prev.filter(a => a.id !== id));
    }
  };

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: "overview", label: "Overview", icon: <Shield className="w-4 h-4" /> },
    { key: "withdrawals", label: "Withdrawals", icon: <DollarSign className="w-4 h-4" /> },
    { key: "collusion", label: "Collusion", icon: <AlertTriangle className="w-4 h-4" /> },
    { key: "system", label: "System", icon: <Server className="w-4 h-4" /> },
  ];

  if (!user || user.role !== "admin") {
    return <DashboardLayout><div className="p-8 text-center text-gray-400">Access denied</div></DashboardLayout>;
  }

  return (
    <DashboardLayout>
      <div className="p-6 max-w-6xl mx-auto space-y-6">
        <h1 className="text-2xl font-bold text-white font-display">Admin Dashboard</h1>

        {/* Tabs */}
        <div className="flex gap-2">
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

        {/* Overview */}
        {!loading && activeTab === "overview" && stats && (
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

        {/* Withdrawals */}
        {!loading && activeTab === "withdrawals" && (
          <div className="space-y-3">
            {withdrawals.length === 0 ? (
              <div className="text-center text-gray-500 py-12">No pending withdrawals</div>
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
              <div className="text-center text-gray-500 py-12">No pending collusion alerts</div>
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
        {!loading && activeTab === "system" && systemStats && (
          <div className="glass rounded-xl p-6">
            <h3 className="text-sm font-bold text-white mb-4">System Information</h3>
            <div className="space-y-2 text-xs font-mono text-gray-400">
              {Object.entries(systemStats).map(([key, value]) => (
                <div key={key} className="flex justify-between">
                  <span className="text-gray-500">{key}</span>
                  <span>{String(value)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
