import { useState, useEffect, useCallback } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useAuth } from "@/lib/auth-context";
import { Link } from "wouter";
import { Shield, CheckCircle, XCircle, Clock, Loader2, AlertTriangle, Link as LinkIcon, Upload, Camera, Fingerprint, ShieldCheck, ExternalLink, ArrowRight, Lock, ArrowDown, ArrowUp } from "lucide-react";

interface KycStatus {
  kycStatus: string;
  kycData: { fullName: string; dateOfBirth: string; country: string; idType: string; submittedAt: string; idDocumentPath?: string; selfiePath?: string } | null;
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

type KycLevel = "none" | "email" | "basic" | "standard" | "full" | "enhanced";

const KYC_LEVELS: { level: KycLevel; label: string; tier: string; color: string; requirements: string[]; depositDay: string; withdrawWeek: string }[] = [
  {
    level: "none",
    label: "Unverified",
    tier: "Free",
    color: "text-gray-500",
    requirements: ["No verification needed"],
    depositDay: "N/A (play chips only)",
    withdrawWeek: "N/A (play chips only)",
  },
  {
    level: "email",
    label: "Email Verified",
    tier: "Bronze",
    color: "text-orange-400",
    requirements: ["Confirm email address"],
    depositDay: "$200/day",
    withdrawWeek: "$500/week",
  },
  {
    level: "basic",
    label: "Basic",
    tier: "Silver",
    color: "text-gray-200",
    requirements: ["Phone verification", "Age check (18+)"],
    depositDay: "$1,000/day",
    withdrawWeek: "$2,500/week",
  },
  {
    level: "full",
    label: "Full KYC",
    tier: "Gold",
    color: "text-amber-400",
    requirements: ["Government ID scan", "Liveness check", "Face match", "AML screening"],
    depositDay: "$5,000/day",
    withdrawWeek: "$10,000/week",
  },
  {
    level: "enhanced",
    label: "Enhanced",
    tier: "Platinum",
    color: "text-purple-300",
    requirements: ["NFC passport scan", "Active liveness", "Source of funds"],
    depositDay: "$25,000/day",
    withdrawWeek: "$50,000/week",
  },
];

function getKycLevelFromStatus(kycStatus: string, tier: string): KycLevel {
  if (kycStatus === "verified") {
    const tierMap: Record<string, KycLevel> = {
      platinum: "enhanced",
      gold: "full",
      silver: "basic",
      bronze: "email",
    };
    return tierMap[tier] || "email";
  }
  if (tier === "bronze" || tier === "silver" || tier === "gold" || tier === "platinum") {
    // Has a tier but not verified yet — at least email level
    return "email";
  }
  return "none";
}

function getKycLevelIndex(level: KycLevel): number {
  return KYC_LEVELS.findIndex(k => k.level === level);
}

export default function KYC() {
  const { user, refreshUser } = useAuth();
  const [status, setStatus] = useState<KycStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [recordingOnChain, setRecordingOnChain] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Didit verification state
  const [kycMode, setKycMode] = useState<"loading" | "didit" | "manual">("loading");
  const [diditStarting, setDiditStarting] = useState(false);
  const [pollingStatus, setPollingStatus] = useState(false);

  // Form fields (manual fallback)
  const [fullName, setFullName] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [country, setCountry] = useState("");
  const [idType, setIdType] = useState("");
  const [idDocument, setIdDocument] = useState<File | null>(null);
  const [selfie, setSelfie] = useState<File | null>(null);

  useEffect(() => {
    fetch("/api/kyc/status")
      .then(r => r.json())
      .then(data => setStatus(data))
      .catch(() => setError("Failed to load KYC status"))
      .finally(() => setLoading(false));
  }, []);

  const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
  const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "application/pdf"];

  function validateFile(file: File | null, label: string): string | null {
    if (!file) return null;
    if (file.size > MAX_FILE_SIZE) {
      return `${label} is too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Maximum size is 10MB.`;
    }
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return `${label} has an unsupported format (${file.type || "unknown"}). Allowed: JPEG, PNG, PDF.`;
    }
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const idDocError = validateFile(idDocument, "ID document");
    if (idDocError) { setError(idDocError); setSubmitting(false); return; }
    const selfieError = validateFile(selfie, "Selfie");
    if (selfieError) { setError(selfieError); setSubmitting(false); return; }

    try {
      const formData = new FormData();
      formData.append("fullName", fullName);
      formData.append("dateOfBirth", dateOfBirth);
      formData.append("country", country);
      formData.append("idType", idType);
      if (idDocument) formData.append("idDocument", idDocument);
      if (selfie) formData.append("selfie", selfie);

      const res = await fetch("/api/kyc/submit", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message || "Submission failed");
      } else {
        setSuccess("KYC application submitted successfully! You'll receive an email when reviewed.");
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

  const startDidit = useCallback(async () => {
    setDiditStarting(true);
    setError(null);
    try {
      const res = await fetch("/api/kyc/didit/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName: fullName || user?.displayName, dateOfBirth }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.message || "Failed to start verification"); return; }

      if (data.mode === "manual") {
        setKycMode("manual");
        return;
      }

      if (data.sessionUrl) {
        window.location.href = data.sessionUrl;
      } else {
        setError("No verification URL returned");
        setKycMode("manual");
      }
    } catch (err: any) {
      setError(err.message || "Failed to start verification");
      setKycMode("manual");
    } finally {
      setDiditStarting(false);
    }
  }, [fullName, dateOfBirth, user]);

  const checkDiditStatus = useCallback(async () => {
    setPollingStatus(true);
    setError(null);
    try {
      const res = await fetch("/api/kyc/didit/status", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        if (data.status === "verified") {
          setSuccess("Identity verified successfully!");
          setStatus(prev => prev ? { ...prev, kycStatus: "verified" } : prev);
          await refreshUser();
        } else if (data.status === "rejected") {
          setError("Verification was not approved. You may try again.");
          setStatus(prev => prev ? { ...prev, kycStatus: "rejected" } : prev);
        } else {
          setSuccess("Verification is still being processed. You'll be notified when complete.");
        }
      }
    } catch {
      setError("Failed to check verification status");
    } finally {
      setPollingStatus(false);
    }
  }, [refreshUser]);

  // Check if Didit is configured on first load
  useEffect(() => {
    if (status && (status.kycStatus === "none" || status.kycStatus === "rejected")) {
      fetch("/api/kyc/didit/start", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) })
        .then(r => r.json())
        .then(data => { setKycMode(data.mode === "didit" ? "didit" : "manual"); })
        .catch(() => setKycMode("manual"));
    } else if (status?.kycStatus === "pending") {
      setKycMode("didit");
    } else {
      setKycMode("manual");
    }
  }, [status]);

  const userTier = user?.tier || "free";
  const currentKycLevel = getKycLevelFromStatus(status?.kycStatus || "none", userTier);
  const currentLevelIdx = getKycLevelIndex(currentKycLevel);
  const nextLevel = currentLevelIdx < KYC_LEVELS.length - 1 ? KYC_LEVELS[currentLevelIdx + 1] : null;

  // Any tier can now access KYC — it's progressive
  const canSubmitKyc = true;

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
      <div className="p-6 max-w-3xl mx-auto space-y-6">
        <div className="text-center mb-6">
          <Shield className="w-12 h-12 mx-auto mb-3 text-primary" />
          <h1 className="text-2xl font-display font-black text-white">KYC Verification</h1>
          <p className="text-gray-400 text-sm mt-1">Progressive identity verification unlocks higher limits</p>
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

        {/* Current KYC Level */}
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">Your Verification Level</h2>
              <p className={`text-xs font-bold uppercase tracking-wider ${KYC_LEVELS[currentLevelIdx].color}`}>
                {KYC_LEVELS[currentLevelIdx].label}
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="rounded-lg bg-black/20 p-3">
              <div className="flex items-center gap-1.5 text-gray-400 mb-1">
                <ArrowDown className="w-3 h-3" /> Deposit Limit
              </div>
              <p className="text-white font-bold">{KYC_LEVELS[currentLevelIdx].depositDay}</p>
            </div>
            <div className="rounded-lg bg-black/20 p-3">
              <div className="flex items-center gap-1.5 text-gray-400 mb-1">
                <ArrowUp className="w-3 h-3" /> Withdraw Limit
              </div>
              <p className="text-white font-bold">{KYC_LEVELS[currentLevelIdx].withdrawWeek}</p>
            </div>
          </div>
        </div>

        {/* KYC Level Progression */}
        <div className="rounded-xl border border-white/10 bg-surface-high/50 p-5">
          <h3 className="text-xs font-bold text-gray-300 uppercase tracking-wider mb-4">Verification Levels</h3>
          <div className="space-y-3">
            {KYC_LEVELS.map((level, idx) => {
              const isComplete = idx <= currentLevelIdx;
              const isCurrent = idx === currentLevelIdx;
              const isNext = idx === currentLevelIdx + 1;
              return (
                <div key={level.level} className={`rounded-lg p-3 border transition-all ${
                  isCurrent ? "border-primary/30 bg-primary/5" :
                  isComplete ? "border-green-500/20 bg-green-500/5" :
                  isNext ? "border-white/10 bg-white/[0.02]" :
                  "border-white/5 bg-white/[0.01] opacity-60"
                }`}>
                  <div className="flex items-center gap-3">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
                      isComplete ? "bg-green-500/20 border border-green-500/30" :
                      isNext ? "bg-primary/10 border border-primary/20" :
                      "bg-gray-800 border border-gray-700"
                    }`}>
                      {isComplete ? (
                        <CheckCircle className="w-4 h-4 text-green-400" />
                      ) : (
                        <Lock className={`w-3 h-3 ${isNext ? "text-primary" : "text-gray-600"}`} />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`text-sm font-bold ${isComplete ? "text-green-400" : isNext ? "text-white" : "text-gray-500"}`}>
                          {level.label}
                        </span>
                        <span className={`text-[0.5rem] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full ${
                          isComplete ? "bg-green-500/10 text-green-400" :
                          isCurrent ? "bg-primary/10 text-primary" :
                          "bg-gray-800 text-gray-500"
                        }`}>
                          {level.tier}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-[0.625rem] text-gray-500 mt-0.5">
                        <span>Deposit: {level.depositDay}</span>
                        <span>Withdraw: {level.withdrawWeek}</span>
                      </div>
                    </div>
                    {isNext && (
                      <ArrowRight className="w-4 h-4 text-primary shrink-0" />
                    )}
                  </div>
                  {isNext && (
                    <div className="mt-2 ml-10 space-y-1">
                      <p className="text-[0.625rem] font-bold text-gray-400 uppercase tracking-wider">Required:</p>
                      {level.requirements.map((req, i) => (
                        <div key={i} className="flex items-center gap-1.5 text-xs text-gray-400">
                          <div className="w-1 h-1 rounded-full bg-primary/50" />
                          {req}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Verified */}
        {status?.kycStatus === "verified" && (
          <div className="space-y-4">
            <div className="rounded-xl border border-green-500/30 bg-green-500/5 p-6 text-center">
              <CheckCircle className="w-12 h-12 mx-auto mb-3 text-green-400" />
              <h2 className="text-xl font-bold text-green-400 mb-1">Verified</h2>
              {status.kycVerifiedAt && (
                <p className="text-gray-400 text-xs">Verified on {new Date(status.kycVerifiedAt).toLocaleDateString()}</p>
              )}
              {nextLevel && (
                <p className="text-gray-500 text-xs mt-2">
                  Upgrade to {nextLevel.tier} to unlock {nextLevel.label} verification
                </p>
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
        {status?.kycStatus === "pending" && (
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
            <button
              onClick={checkDiditStatus}
              disabled={pollingStatus}
              className="mt-4 px-6 py-2.5 rounded-lg bg-yellow-500/20 text-yellow-300 font-bold text-sm border border-yellow-500/30 hover:bg-yellow-500/30 transition-all disabled:opacity-50 inline-flex items-center gap-2"
            >
              {pollingStatus ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
              Check Verification Status
            </button>
          </div>
        )}

        {/* Rejected */}
        {status?.kycStatus === "rejected" && (
          <div className="space-y-4">
            <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-6 text-center">
              <XCircle className="w-12 h-12 mx-auto mb-3 text-red-400" />
              <h2 className="text-xl font-bold text-red-400 mb-2">Application Rejected</h2>
              {status.kycRejectionReason && (
                <p className="text-gray-400 text-sm">Reason: {status.kycRejectionReason}</p>
              )}
              <p className="text-gray-500 text-xs mt-2">You may resubmit your application below.</p>
            </div>

            {kycMode !== "manual" ? (
              <button onClick={startDidit} disabled={diditStarting}
                className="w-full py-3 rounded-lg bg-purple-500/20 text-purple-400 font-bold text-sm border border-purple-500/30 hover:bg-purple-500/30 flex items-center justify-center gap-2">
                {diditStarting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Fingerprint className="w-4 h-4" />}
                Retry Identity Verification
              </button>
            ) : (
              <KycForm
                fullName={fullName} setFullName={setFullName}
                dateOfBirth={dateOfBirth} setDateOfBirth={setDateOfBirth}
                country={country} setCountry={setCountry}
                idType={idType} setIdType={setIdType}
                idDocument={idDocument} setIdDocument={setIdDocument}
                selfie={selfie} setSelfie={setSelfie}
                onSubmit={handleSubmit} submitting={submitting}
              />
            )}
          </div>
        )}

        {/* None — show Didit or manual form */}
        {canSubmitKyc && (status?.kycStatus === "none" || !status?.kycStatus) && (
          <div className="space-y-4">
            {/* Professional Didit flow */}
            {kycMode !== "manual" && (
              <div className="rounded-xl border border-purple-500/20 bg-purple-500/5 p-6 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-purple-500/10 flex items-center justify-center">
                    <Fingerprint className="w-6 h-6 text-purple-400" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white">AI-Powered Identity Verification</h3>
                    <p className="text-xs text-gray-400">Powered by Didit -- instant ID check with liveness detection</p>
                  </div>
                </div>

                {/* Tier-based verification features */}
                <div className="rounded-lg bg-black/20 p-4 space-y-3">
                  <h4 className="text-xs font-bold text-gray-300 uppercase tracking-wider">What Gets Unlocked</h4>
                  {nextLevel && (
                    <div className="rounded-lg bg-primary/5 border border-primary/10 p-3">
                      <p className="text-xs text-primary font-bold mb-1">Next: {nextLevel.label} ({nextLevel.tier})</p>
                      <p className="text-[0.625rem] text-gray-400">Deposit: {nextLevel.depositDay} | Withdraw: {nextLevel.withdrawWeek}</p>
                      <div className="mt-2 space-y-1">
                        {nextLevel.requirements.map((req, i) => (
                          <div key={i} className="flex items-center gap-1.5 text-[0.625rem] text-gray-500">
                            <div className="w-1 h-1 rounded-full bg-primary/50" />
                            {req}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-3 text-center text-xs">
                  <div className="rounded-lg bg-black/20 p-3">
                    <ShieldCheck className="w-5 h-5 text-green-400 mx-auto mb-1" />
                    <div className="text-gray-300 font-bold">Document Scan</div>
                    <div className="text-gray-500">AI reads your ID</div>
                  </div>
                  <div className="rounded-lg bg-black/20 p-3">
                    <Camera className="w-5 h-5 text-cyan-400 mx-auto mb-1" />
                    <div className="text-gray-300 font-bold">Liveness Check</div>
                    <div className="text-gray-500">Proves you're real</div>
                  </div>
                  <div className="rounded-lg bg-black/20 p-3">
                    <Fingerprint className="w-5 h-5 text-purple-400 mx-auto mb-1" />
                    <div className="text-gray-300 font-bold">Face Match</div>
                    <div className="text-gray-500">Photo matches ID</div>
                  </div>
                </div>

                {/* Name + DOB for session creation */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Full Legal Name</label>
                    <input type="text" value={fullName} onChange={e => setFullName(e.target.value)} placeholder="John Doe"
                      className="w-full px-3 py-2.5 rounded-lg bg-black/30 border border-white/10 text-white text-sm focus:outline-none focus:border-purple-500/50" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Date of Birth</label>
                    <input type="date" value={dateOfBirth} onChange={e => setDateOfBirth(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-lg bg-black/30 border border-white/10 text-white text-sm focus:outline-none focus:border-purple-500/50" />
                  </div>
                </div>

                <button onClick={startDidit} disabled={diditStarting || !fullName}
                  className="w-full py-3 rounded-lg bg-purple-500/20 text-purple-400 font-bold text-sm border border-purple-500/30 hover:bg-purple-500/30 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                  {diditStarting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Fingerprint className="w-4 h-4" />}
                  {diditStarting ? "Starting Verification..." : "Start Identity Verification"}
                </button>

                <p className="text-[10px] text-gray-600 text-center">
                  Your documents are processed securely by Didit and never stored on our servers.
                  <a href="https://didit.me/privacy" target="_blank" rel="noopener noreferrer" className="text-purple-400 hover:text-purple-300 ml-1 inline-flex items-center gap-0.5">
                    Privacy Policy <ExternalLink className="w-2.5 h-2.5" />
                  </a>
                </p>
              </div>
            )}

            {/* Manual fallback form */}
            {kycMode === "manual" && (
              <KycForm
                fullName={fullName} setFullName={setFullName}
                dateOfBirth={dateOfBirth} setDateOfBirth={setDateOfBirth}
                country={country} setCountry={setCountry}
                idType={idType} setIdType={setIdType}
                idDocument={idDocument} setIdDocument={setIdDocument}
                selfie={selfie} setSelfie={setSelfie}
                onSubmit={handleSubmit} submitting={submitting}
              />
            )}
          </div>
        )}

        {/* Upgrade prompt */}
        {nextLevel && status?.kycStatus === "verified" && (
          <div className="text-center">
            <Link href="/tiers">
              <button className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg bg-primary/10 border border-primary/20 text-primary text-sm font-bold hover:bg-primary/20 transition-all">
                Upgrade to {nextLevel.tier} for {nextLevel.label} Verification
                <ArrowRight className="w-4 h-4" />
              </button>
            </Link>
          </div>
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
  idDocument, setIdDocument,
  selfie, setSelfie,
  onSubmit, submitting,
}: {
  fullName: string; setFullName: (v: string) => void;
  dateOfBirth: string; setDateOfBirth: (v: string) => void;
  country: string; setCountry: (v: string) => void;
  idType: string; setIdType: (v: string) => void;
  idDocument: File | null; setIdDocument: (v: File | null) => void;
  selfie: File | null; setSelfie: (v: File | null) => void;
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

      {/* Document Upload */}
      <div>
        <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">
          <Upload className="w-3 h-3 inline mr-1" />
          Government ID Photo
        </label>
        <p className="text-xs text-gray-500 mb-2">Upload a clear photo of the front of your ID document (JPG, PNG, PDF -- max 10MB)</p>
        <label className="flex items-center justify-center w-full px-4 py-6 border-2 border-dashed border-white/20 hover:border-primary/40 rounded-xl bg-black/30 cursor-pointer transition-all">
          <input
            type="file"
            accept=".jpg,.jpeg,.png,.pdf"
            onChange={e => setIdDocument(e.target.files?.[0] || null)}
            className="hidden"
          />
          {idDocument ? (
            <span className="text-sm text-green-400">{idDocument.name}</span>
          ) : (
            <span className="text-sm text-gray-500">Click or drag to upload ID document</span>
          )}
        </label>
      </div>

      <div>
        <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">
          <Camera className="w-3 h-3 inline mr-1" />
          Selfie Photo
        </label>
        <p className="text-xs text-gray-500 mb-2">Upload a clear selfie holding your ID next to your face</p>
        <label className="flex items-center justify-center w-full px-4 py-6 border-2 border-dashed border-white/20 hover:border-primary/40 rounded-xl bg-black/30 cursor-pointer transition-all">
          <input
            type="file"
            accept=".jpg,.jpeg,.png"
            onChange={e => setSelfie(e.target.files?.[0] || null)}
            className="hidden"
          />
          {selfie ? (
            <span className="text-sm text-green-400">{selfie.name}</span>
          ) : (
            <span className="text-sm text-gray-500">Click or drag to upload selfie</span>
          )}
        </label>
      </div>

      <button
        type="submit"
        disabled={submitting || !fullName || !dateOfBirth || !country || !idType || !idDocument || !selfie}
        className="w-full py-3 rounded-lg bg-primary/20 text-primary font-bold text-sm border border-primary/30 hover:bg-primary/30 transition-all disabled:opacity-50"
      >
        {submitting ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : "Submit Application"}
      </button>

      <p className="text-xs text-gray-500 text-center">
        Your documents are securely stored and only accessible by authorized administrators.
      </p>
    </form>
  );
}
