import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useAuth } from "@/lib/auth-context";
import { Link } from "wouter";
import { Shield, CheckCircle, XCircle, Clock, Loader2, AlertTriangle, Link as LinkIcon } from "lucide-react";

interface KycStatus {
  kycStatus: string;
  kycData: { fullName: string; dateOfBirth: string; country: string; idType: string; submittedAt: string } | null;
  kycVerifiedAt: string | null;
  kycRejectionReason: string | null;
  kycBlockchainTxHash: string | null;
}

const COUNTRIES = [
  "United States", "United Kingdom", "Canada", "Australia", "Germany", "France",
  "Japan", "South Korea", "Singapore", "Brazil", "India", "Mexico", "Spain",
  "Italy", "Netherlands", "Switzerland", "Sweden", "Norway", "Denmark", "Finland",
  "Portugal", "Ireland", "Belgium", "Austria", "New Zealand", "Poland", "Other",
];

const ID_TYPES = [
  { value: "passport", label: "Passport" },
  { value: "drivers_license", label: "Driver's License" },
  { value: "national_id", label: "National ID Card" },
  { value: "residence_permit", label: "Residence Permit" },
];

export default function KYC() {
  const { user, refreshUser } = useAuth();
  const [status, setStatus] = useState<KycStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [recordingOnChain, setRecordingOnChain] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form fields
  const [fullName, setFullName] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [country, setCountry] = useState("");
  const [idType, setIdType] = useState("");

  useEffect(() => {
    fetch("/api/kyc/status")
      .then(r => r.json())
      .then(data => setStatus(data))
      .catch(() => setError("Failed to load KYC status"))
      .finally(() => setLoading(false));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/kyc/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName, dateOfBirth, country, idType }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message || "Submission failed");
      } else {
        setSuccess("KYC application submitted successfully!");
        setStatus({ ...status!, kycStatus: "pending", kycData: { fullName, dateOfBirth, country, idType, submittedAt: new Date().toISOString() } });
        await refreshUser();
      }
    } catch {
      setError("Network error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleRecordOnChain = async () => {
    setRecordingOnChain(true);
    setError(null);
    try {
      const res = await fetch("/api/kyc/record-on-chain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message || "Failed to record on-chain");
      } else {
        setStatus(prev => prev ? { ...prev, kycBlockchainTxHash: data.txHash } : prev);
        setSuccess("Identity recorded on-chain successfully!");
        await refreshUser();
      }
    } catch {
      setError("Network error");
    } finally {
      setRecordingOnChain(false);
    }
  };

  const userTier = user?.tier || "free";
  const tierOrder = ["free", "bronze", "silver", "gold", "platinum"];
  const isGoldPlus = tierOrder.indexOf(userTier) >= tierOrder.indexOf("gold");

  if (loading) {
    return (
      <DashboardLayout title="KYC Verification">
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="KYC Verification">
      <div className="p-6 max-w-2xl mx-auto space-y-6">
        <div className="text-center mb-6">
          <Shield className="w-12 h-12 mx-auto mb-3 text-primary" />
          <h1 className="text-2xl font-display font-black text-white">KYC Verification</h1>
          <p className="text-gray-400 text-sm mt-1">Verify your identity for enhanced platform features</p>
        </div>

        {error && (
          <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm text-center">
            {error}
          </div>
        )}
        {success && (
          <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20 text-green-400 text-sm text-center">
            {success}
          </div>
        )}

        {/* Not Gold+ */}
        {!isGoldPlus && (
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-8 text-center">
            <AlertTriangle className="w-10 h-10 mx-auto mb-3 text-amber-400" />
            <h2 className="text-lg font-bold text-white mb-2">Gold Tier Required</h2>
            <p className="text-gray-400 text-sm mb-4">Upgrade to Gold tier or higher to access KYC verification.</p>
            <Link href="/tiers">
              <button className="px-6 py-2.5 rounded-lg bg-primary/20 text-primary font-bold text-sm border border-primary/30 hover:bg-primary/30 transition-all">
                View Membership Tiers
              </button>
            </Link>
          </div>
        )}

        {/* Verified */}
        {isGoldPlus && status?.kycStatus === "verified" && (
          <div className="space-y-4">
            <div className="rounded-xl border border-green-500/30 bg-green-500/5 p-6 text-center">
              <CheckCircle className="w-12 h-12 mx-auto mb-3 text-green-400" />
              <h2 className="text-xl font-bold text-green-400 mb-1">Verified</h2>
              {status.kycVerifiedAt && (
                <p className="text-gray-400 text-xs">Verified on {new Date(status.kycVerifiedAt).toLocaleDateString()}</p>
              )}
            </div>

            {/* Blockchain recording */}
            {status.kycBlockchainTxHash ? (
              <div className="rounded-xl border border-purple-500/20 bg-purple-500/5 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <LinkIcon className="w-4 h-4 text-purple-400" />
                  <span className="text-sm font-bold text-purple-300">On-Chain Verification</span>
                </div>
                <p className="text-xs text-gray-400 break-all font-mono">
                  {status.kycBlockchainTxHash}
                </p>
                <p className="text-xs text-green-400 mt-2">Your identity has been recorded on-chain</p>
              </div>
            ) : (
              <div className="rounded-xl border border-purple-500/20 bg-purple-500/5 p-4 text-center">
                <p className="text-sm text-gray-400 mb-3">Record your verified identity on the blockchain</p>
                <button
                  onClick={handleRecordOnChain}
                  disabled={recordingOnChain}
                  className="px-6 py-2.5 rounded-lg bg-purple-500/20 text-purple-300 font-bold text-sm border border-purple-500/30 hover:bg-purple-500/30 transition-all"
                >
                  {recordingOnChain ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : "Record On-Chain"}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Pending */}
        {isGoldPlus && status?.kycStatus === "pending" && (
          <div className="rounded-xl border border-yellow-500/20 bg-yellow-500/5 p-6 text-center">
            <Clock className="w-12 h-12 mx-auto mb-3 text-yellow-400 animate-pulse" />
            <h2 className="text-xl font-bold text-yellow-400 mb-2">Application Pending</h2>
            <p className="text-gray-400 text-sm mb-4">Your KYC application is being reviewed.</p>
            {status.kycData && (
              <div className="text-left rounded-lg bg-black/20 p-4 text-xs space-y-1">
                <p className="text-gray-400">Name: <span className="text-white">{status.kycData.fullName}</span></p>
                <p className="text-gray-400">DOB: <span className="text-white">{status.kycData.dateOfBirth}</span></p>
                <p className="text-gray-400">Country: <span className="text-white">{status.kycData.country}</span></p>
                <p className="text-gray-400">ID Type: <span className="text-white">{status.kycData.idType}</span></p>
                <p className="text-gray-400">Submitted: <span className="text-white">{new Date(status.kycData.submittedAt).toLocaleString()}</span></p>
              </div>
            )}
          </div>
        )}

        {/* Rejected */}
        {isGoldPlus && status?.kycStatus === "rejected" && (
          <div className="space-y-4">
            <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-6 text-center">
              <XCircle className="w-12 h-12 mx-auto mb-3 text-red-400" />
              <h2 className="text-xl font-bold text-red-400 mb-2">Application Rejected</h2>
              {status.kycRejectionReason && (
                <p className="text-gray-400 text-sm">Reason: {status.kycRejectionReason}</p>
              )}
              <p className="text-gray-500 text-xs mt-2">You may resubmit your application below.</p>
            </div>
            {/* Show form for resubmission */}
            <KycForm
              fullName={fullName} setFullName={setFullName}
              dateOfBirth={dateOfBirth} setDateOfBirth={setDateOfBirth}
              country={country} setCountry={setCountry}
              idType={idType} setIdType={setIdType}
              onSubmit={handleSubmit} submitting={submitting}
            />
          </div>
        )}

        {/* None — show form */}
        {isGoldPlus && (status?.kycStatus === "none" || !status?.kycStatus) && (
          <KycForm
            fullName={fullName} setFullName={setFullName}
            dateOfBirth={dateOfBirth} setDateOfBirth={setDateOfBirth}
            country={country} setCountry={setCountry}
            idType={idType} setIdType={setIdType}
            onSubmit={handleSubmit} submitting={submitting}
          />
        )}
      </div>
    </DashboardLayout>
  );
}

function KycForm({
  fullName, setFullName,
  dateOfBirth, setDateOfBirth,
  country, setCountry,
  idType, setIdType,
  onSubmit, submitting,
}: {
  fullName: string; setFullName: (v: string) => void;
  dateOfBirth: string; setDateOfBirth: (v: string) => void;
  country: string; setCountry: (v: string) => void;
  idType: string; setIdType: (v: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  submitting: boolean;
}) {
  return (
    <form onSubmit={onSubmit} className="rounded-xl border border-white/10 bg-surface-high/50 p-6 space-y-4">
      <h3 className="text-lg font-bold text-white mb-2">Submit KYC Application</h3>

      <div>
        <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Full Legal Name</label>
        <input
          type="text"
          value={fullName}
          onChange={e => setFullName(e.target.value)}
          required
          className="w-full px-3 py-2.5 rounded-lg bg-black/30 border border-white/10 text-white text-sm focus:outline-none focus:border-primary/50"
          placeholder="John Doe"
        />
      </div>

      <div>
        <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Date of Birth</label>
        <input
          type="date"
          value={dateOfBirth}
          onChange={e => setDateOfBirth(e.target.value)}
          required
          className="w-full px-3 py-2.5 rounded-lg bg-black/30 border border-white/10 text-white text-sm focus:outline-none focus:border-primary/50"
        />
      </div>

      <div>
        <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Country</label>
        <select
          value={country}
          onChange={e => setCountry(e.target.value)}
          required
          className="w-full px-3 py-2.5 rounded-lg bg-black/30 border border-white/10 text-white text-sm focus:outline-none focus:border-primary/50"
        >
          <option value="">Select country...</option>
          {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      <div>
        <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">ID Type</label>
        <select
          value={idType}
          onChange={e => setIdType(e.target.value)}
          required
          className="w-full px-3 py-2.5 rounded-lg bg-black/30 border border-white/10 text-white text-sm focus:outline-none focus:border-primary/50"
        >
          <option value="">Select ID type...</option>
          {ID_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
      </div>

      <button
        type="submit"
        disabled={submitting || !fullName || !dateOfBirth || !country || !idType}
        className="w-full py-3 rounded-lg bg-primary/20 text-primary font-bold text-sm border border-primary/30 hover:bg-primary/30 transition-all disabled:opacity-50"
      >
        {submitting ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : "Submit Application"}
      </button>
    </form>
  );
}
