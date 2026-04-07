import { useState } from "react";
import { motion } from "framer-motion";
import { Link, useLocation } from "wouter";
import {
  Wallet, Mail, KeyRound, Shield,
  ArrowLeft, Loader2, CheckCircle2, AlertTriangle, Info
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { GoldButton, SpotlightCard, VaultBackground } from "@/components/premium/PremiumComponents";

/* -- Recovery Method Card ------------------------------------------------- */

function RecoveryCard({
  icon: Icon,
  title,
  description,
  children,
  index,
  accentColor,
  accentBorder,
}: {
  icon: any;
  title: string;
  description: string;
  children: React.ReactNode;
  index: number;
  accentColor: string;
  accentBorder: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15 + index * 0.1 }}
    >
      <SpotlightCard className={`p-6 ${accentBorder}`}>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: "rgba(212,175,55,0.1)", border: "1px solid rgba(212,175,55,0.2)" }}>
            <Icon className="w-5 h-5" style={{ color: "#d4af37" }} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">{title}</h3>
            <p className="text-[0.625rem] text-gray-500">{description}</p>
          </div>
        </div>
        {children}
      </SpotlightCard>
    </motion.div>
  );
}

/* -- Crypto Wallet Verification ------------------------------------------- */

function WalletRecovery() {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [address, setAddress] = useState("");
  const [challenge, setChallenge] = useState("");
  const [token, setToken] = useState("");
  const [signature, setSignature] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<"success" | "error" | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [, navigate] = useLocation();

  const handleGetChallenge = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!address.trim()) return;
    setLoading(true);
    setResult(null);
    setErrorMsg("");
    try {
      const res = await apiRequest("POST", "/api/auth/wallet-challenge", {});
      const data = await res.json();
      setChallenge(data.challenge);
      setToken(data.token);
      setStep(2);
    } catch (err: any) {
      setResult("error");
      setErrorMsg("Failed to get challenge. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!signature.trim()) return;
    setLoading(true);
    setResult(null);
    setErrorMsg("");
    try {
      const res = await apiRequest("POST", "/api/auth/verify-wallet", {
        address: address.trim(),
        signature: signature.trim(),
        token,
      });
      await res.json();
      setResult("success");
      setTimeout(() => navigate("/"), 1500);
    } catch (err: any) {
      setResult("error");
      try {
        const parsed = JSON.parse(err.message.split(": ").slice(1).join(": "));
        setErrorMsg(parsed.message || "Wallet verification failed.");
      } catch {
        setErrorMsg("Wallet verification failed. Make sure your wallet is linked to an account.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <RecoveryCard
      icon={Wallet}
      title="Crypto Wallet Verification"
      description="Verify your connected wallet to recover access"
      index={0}
      accentColor="bg-purple-500/15 text-purple-400"
      accentBorder="border-purple-500/15"
    >
      {step === 1 && (
        <form onSubmit={handleGetChallenge} className="space-y-3">
          <p className="text-[0.625rem] text-gray-400">
            Enter the wallet address linked to your account to receive a challenge to sign.
          </p>
          <div>
            <label className="block text-[0.625rem] text-gray-500 uppercase tracking-wider mb-1.5 font-medium">
              Wallet Address
            </label>
            <input
              type="text"
              value={address}
              onChange={(e) => { setAddress(e.target.value); setResult(null); }}
              placeholder="0x..."
              className="w-full px-3 py-2.5 rounded-lg bg-surface-highest/50 border border-white/[0.06] text-sm text-foreground font-mono placeholder:text-muted-foreground/50 focus:outline-none focus:border-purple-500/30 transition-all"
              required
            />
          </div>
          <GoldButton
            disabled={loading || !address.trim()}
            className="flex items-center gap-2 px-5 py-2.5 text-[0.625rem]"
          >
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wallet className="w-3.5 h-3.5" />}
            {loading ? "Loading..." : "Get Challenge"}
          </GoldButton>
        </form>
      )}

      {step === 2 && (
        <div className="space-y-3">
          <p className="text-[0.625rem] text-gray-400">
            Sign the following message in your wallet, then paste the signature below.
          </p>
          <div className="p-3 rounded-lg bg-purple-500/10 border border-purple-500/20">
            <label className="block text-[0.625rem] text-gray-500 uppercase tracking-wider mb-1 font-medium">
              Challenge to Sign
            </label>
            <p className="text-xs font-mono text-purple-300 break-all select-all">{challenge}</p>
          </div>
          <form onSubmit={handleVerify} className="space-y-3">
            <div>
              <label className="block text-[0.625rem] text-gray-500 uppercase tracking-wider mb-1.5 font-medium">
                Signature
              </label>
              <input
                type="text"
                value={signature}
                onChange={(e) => { setSignature(e.target.value); setResult(null); }}
                placeholder="Paste your signature here"
                className="w-full px-3 py-2.5 rounded-lg bg-surface-highest/50 border border-white/[0.06] text-sm text-foreground font-mono placeholder:text-muted-foreground/50 focus:outline-none focus:border-purple-500/30 transition-all"
                required
              />
            </div>

            {result === "success" && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                <CheckCircle2 className="w-4 h-4 text-green-400" />
                <span className="text-[0.625rem] font-medium text-green-400">
                  Wallet verified! Redirecting to your account...
                </span>
              </div>
            )}

            {result === "error" && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                <AlertTriangle className="w-4 h-4 text-red-400" />
                <span className="text-[0.625rem] font-medium text-red-400">{errorMsg}</span>
              </div>
            )}

            <div className="flex items-center gap-2">
              <GoldButton
                disabled={loading || !signature.trim()}
                className="flex items-center gap-2 px-5 py-2.5 text-[0.625rem]"
              >
                {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wallet className="w-3.5 h-3.5" />}
                {loading ? "Verifying..." : "Verify Signature"}
              </GoldButton>
              <button
                type="button"
                onClick={() => { setStep(1); setResult(null); setSignature(""); }}
                className="px-4 py-2.5 rounded-lg text-[0.625rem] font-bold uppercase tracking-wider bg-white/5 text-gray-400 border border-white/10 hover:bg-white/10 transition-all"
              >
                Back
              </button>
            </div>
          </form>
        </div>
      )}
    </RecoveryCard>
  );
}

/* -- Email Recovery ------------------------------------------------------- */

function EmailRecovery() {
  const [step, setStep] = useState<1 | 2>(1);
  const [username, setUsername] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<"success" | "error" | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [, navigate] = useLocation();

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) return;
    setLoading(true);
    setResult(null);
    setErrorMsg("");
    try {
      const res = await apiRequest("POST", "/api/auth/request-recovery-email", {
        username: username.trim(),
      });
      await res.json();
      setCodeSent(true);
      setStep(2);
    } catch {
      // API always returns 200, but handle network errors
      setResult("error");
      setErrorMsg("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;
    setLoading(true);
    setResult(null);
    setErrorMsg("");
    try {
      const res = await apiRequest("POST", "/api/auth/verify-recovery-email", {
        username: username.trim(),
        code: code.trim(),
      });
      await res.json();
      setResult("success");
      setTimeout(() => navigate("/"), 1500);
    } catch (err: any) {
      setResult("error");
      try {
        const parsed = JSON.parse(err.message.split(": ").slice(1).join(": "));
        setErrorMsg(parsed.message || "Invalid code. Please try again.");
      } catch {
        setErrorMsg("Invalid code. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <RecoveryCard
      icon={Mail}
      title="Email Recovery"
      description="Receive a recovery code to your registered email"
      index={1}
      accentColor="bg-primary/15 text-primary"
      accentBorder="border-primary/15"
    >
      {step === 1 && (
        <form onSubmit={handleSendCode} className="space-y-3">
          <p className="text-[0.625rem] text-gray-400">
            Enter your username or email to receive a 6-digit recovery code.
          </p>
          <div>
            <label className="block text-[0.625rem] text-gray-500 uppercase tracking-wider mb-1.5 font-medium">
              Username or Email
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => { setUsername(e.target.value); setResult(null); }}
              placeholder="your username or email"
              className="w-full px-3 py-2.5 rounded-lg bg-surface-highest/50 border border-white/[0.06] text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/30 transition-all"
              required
            />
          </div>

          {result === "error" && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
              <AlertTriangle className="w-4 h-4 text-red-400" />
              <span className="text-[0.625rem] font-medium text-red-400">{errorMsg}</span>
            </div>
          )}

          <GoldButton
            disabled={loading || !username.trim()}
            className="flex items-center gap-2 px-5 py-2.5 text-[0.625rem]"
          >
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Mail className="w-3.5 h-3.5" />}
            {loading ? "Sending..." : "Send Code"}
          </GoldButton>
        </form>
      )}

      {step === 2 && (
        <form onSubmit={handleVerify} className="space-y-3">
          {codeSent && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-primary/10 border border-primary/20">
              <Mail className="w-4 h-4 text-primary shrink-0" />
              <span className="text-[0.625rem] font-medium text-primary">
                If an account exists with that username/email, a recovery code has been sent. Check your inbox.
              </span>
            </div>
          )}

          <div>
            <label className="block text-[0.625rem] text-gray-500 uppercase tracking-wider mb-1.5 font-medium">
              6-Digit Code
            </label>
            <input
              type="text"
              value={code}
              onChange={(e) => { setCode(e.target.value.replace(/\D/g, "").slice(0, 6)); setResult(null); }}
              placeholder="123456"
              maxLength={6}
              className="w-full px-3 py-2.5 rounded-lg bg-surface-highest/50 border border-white/[0.06] text-sm text-foreground font-mono placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/30 transition-all tracking-[0.3em] text-center"
              required
            />
          </div>

          {result === "success" && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-green-500/10 border border-green-500/20">
              <CheckCircle2 className="w-4 h-4 text-green-400" />
              <span className="text-[0.625rem] font-medium text-green-400">
                Code verified! Redirecting to your account...
              </span>
            </div>
          )}

          {result === "error" && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
              <AlertTriangle className="w-4 h-4 text-red-400" />
              <span className="text-[0.625rem] font-medium text-red-400">{errorMsg}</span>
            </div>
          )}

          <div className="flex items-center gap-2">
            <GoldButton
              disabled={loading || code.length !== 6}
              className="flex items-center gap-2 px-5 py-2.5 text-[0.625rem]"
            >
              {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Mail className="w-3.5 h-3.5" />}
              {loading ? "Verifying..." : "Verify Code"}
            </GoldButton>
            <button
              type="button"
              onClick={() => { setStep(1); setResult(null); setCode(""); setCodeSent(false); }}
              className="px-4 py-2.5 rounded-lg text-[0.625rem] font-bold uppercase tracking-wider bg-white/5 text-gray-400 border border-white/10 hover:bg-white/10 transition-all"
            >
              Back
            </button>
          </div>
        </form>
      )}
    </RecoveryCard>
  );
}

/* -- Backup Codes (real API) ---------------------------------------------- */

function BackupCodeRecovery() {
  const [username, setUsername] = useState("");
  const [code, setCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [result, setResult] = useState<"success" | "error" | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [, navigate] = useLocation();

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !code.trim()) return;
    setVerifying(true);
    setResult(null);
    setErrorMsg("");

    try {
      const res = await apiRequest("POST", "/api/auth/recover-with-code", {
        username: username.trim(),
        code: code.trim(),
      });
      const data = await res.json();
      setResult("success");
      // Redirect to dashboard after brief success display
      setTimeout(() => navigate("/"), 1500);
    } catch (err: any) {
      setResult("error");
      try {
        const parsed = JSON.parse(err.message.split(": ").slice(1).join(": "));
        setErrorMsg(parsed.message || "Invalid backup code. Please try again.");
      } catch {
        setErrorMsg("Invalid username or backup code. Please try again.");
      }
    } finally {
      setVerifying(false);
    }
  };

  return (
    <RecoveryCard
      icon={KeyRound}
      title="Backup Codes"
      description="Use one of your saved backup codes"
      index={2}
      accentColor="bg-amber-500/15 text-amber-400"
      accentBorder="border-amber-500/15"
    >
      <p className="text-[0.625rem] text-gray-400 mb-4">
        Enter your username and one of the backup codes you saved when setting up your account.
        Each code can only be used once.
      </p>

      <form onSubmit={handleVerify} className="space-y-3">
        <div>
          <label className="block text-[0.625rem] text-gray-500 uppercase tracking-wider mb-1.5 font-medium">
            Username
          </label>
          <input
            type="text"
            value={username}
            onChange={(e) => { setUsername(e.target.value); setResult(null); }}
            placeholder="your username"
            className="w-full px-3 py-2.5 rounded-lg bg-surface-highest/50 border border-white/[0.06] text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-amber-500/30 transition-all"
            required
          />
        </div>
        <div>
          <label className="block text-[0.625rem] text-gray-500 uppercase tracking-wider mb-1.5 font-medium">
            Backup Code
          </label>
          <input
            type="text"
            value={code}
            onChange={(e) => { setCode(e.target.value); setResult(null); }}
            placeholder="XXXX-XXXX"
            className="w-full px-3 py-2.5 rounded-lg bg-surface-highest/50 border border-white/[0.06] text-sm text-foreground font-mono placeholder:text-muted-foreground/50 focus:outline-none focus:border-amber-500/30 transition-all tracking-wider"
            required
          />
        </div>

        {result === "success" && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-green-500/10 border border-green-500/20">
            <CheckCircle2 className="w-4 h-4 text-green-400" />
            <span className="text-[0.625rem] font-medium text-green-400">
              Code verified! Redirecting to your account...
            </span>
          </div>
        )}

        {result === "error" && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
            <KeyRound className="w-4 h-4 text-red-400" />
            <span className="text-[0.625rem] font-medium text-red-400">
              {errorMsg}
            </span>
          </div>
        )}

        <GoldButton
          disabled={verifying || !code.trim() || !username.trim()}
          className="flex items-center gap-2 px-5 py-2.5 text-[0.625rem]"
        >
          {verifying ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <KeyRound className="w-3.5 h-3.5" />
          )}
          {verifying ? "Verifying..." : "Verify Code"}
        </GoldButton>
      </form>
    </RecoveryCard>
  );
}

/* -- Main Page ------------------------------------------------------------ */

export default function AccountRecovery() {
  return (
    <VaultBackground>
      <div className="max-w-4xl mx-auto px-4 py-12">
        {/* Back to login link */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mb-8"
        >
          <Link href="/">
            <span className="inline-flex items-center gap-1.5 text-[0.625rem] font-medium text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
              <ArrowLeft className="w-3.5 h-3.5" />
              Back to Login
            </span>
          </Link>
        </motion.div>

        {/* Page heading */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-10"
        >
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: "rgba(212,175,55,0.1)", border: "1px solid rgba(212,175,55,0.2)" }}>
            <Shield className="w-8 h-8" style={{ color: "#d4af37" }} />
          </div>
          <h1
            className="text-2xl font-black italic uppercase tracking-wider mb-2"
            style={{
              background: "linear-gradient(180deg, #f0d060 0%, #d4af37 50%, #9a7b2c 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            Account Recovery
          </h1>
          <p className="text-sm text-gray-500 max-w-sm mx-auto">
            Choose a recovery method below to regain access to your account.
          </p>
        </motion.div>

        {/* Recovery Methods */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <WalletRecovery />
          <EmailRecovery />
          <BackupCodeRecovery />
        </div>

        {/* Footer help text */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="text-center text-[0.625rem] text-gray-600 mt-8"
        >
          Still having trouble? Contact support at{" "}
          <span className="text-primary/70">support@highrollers.club</span>
        </motion.p>
      </div>
    </VaultBackground>
  );
}
