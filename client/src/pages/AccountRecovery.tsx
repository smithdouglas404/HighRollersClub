import { useState } from "react";
import { motion } from "framer-motion";
import { Link } from "wouter";
import {
  Wallet, Mail, KeyRound, Shield,
  ArrowLeft, Loader2, CheckCircle2
} from "lucide-react";

/* ── Recovery Method Card ───────────────────────────────────── */

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
      className={`bg-surface-high/50 backdrop-blur-xl border ${accentBorder} rounded-xl p-6`}
    >
      <div className="flex items-center gap-3 mb-4">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${accentColor}`}>
          <Icon className="w-5 h-5" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-white">{title}</h3>
          <p className="text-[0.625rem] text-gray-500">{description}</p>
        </div>
      </div>
      {children}
    </motion.div>
  );
}

/* ── Crypto Wallet Verification ─────────────────────────────── */

function WalletRecovery() {
  const [verifying, setVerifying] = useState(false);
  const [verified, setVerified] = useState(false);

  const handleVerify = () => {
    setVerifying(true);
    // Simulated verification delay
    setTimeout(() => {
      setVerifying(false);
      setVerified(true);
    }, 1500);
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
      <p className="text-[0.625rem] text-gray-400 mb-4">
        If you previously linked a crypto wallet to your account, you can verify ownership
        to regain access. Connect the same wallet you used during registration.
      </p>

      {verified ? (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-green-500/10 border border-green-500/20">
          <CheckCircle2 className="w-4 h-4 text-green-400" />
          <span className="text-[0.625rem] font-medium text-green-400">
            Wallet verified successfully. Redirecting...
          </span>
        </div>
      ) : (
        <button
          onClick={handleVerify}
          disabled={verifying}
          className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-[0.625rem] font-bold uppercase tracking-wider bg-purple-500/15 text-purple-300 border border-purple-500/25 hover:bg-purple-500/25 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          {verifying ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Wallet className="w-3.5 h-3.5" />
          )}
          {verifying ? "Verifying..." : "Verify Wallet"}
        </button>
      )}
    </RecoveryCard>
  );
}

/* ── Email Recovery ─────────────────────────────────────────── */

function EmailRecovery() {
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setSending(true);
    setTimeout(() => {
      setSending(false);
      setSent(true);
    }, 1200);
  };

  return (
    <RecoveryCard
      icon={Mail}
      title="Email Recovery"
      description="Receive a recovery link to your registered email"
      index={1}
      accentColor="bg-primary/15 text-primary"
      accentBorder="border-primary/15"
    >
      {sent ? (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-green-500/10 border border-green-500/20">
          <CheckCircle2 className="w-4 h-4 text-green-400" />
          <span className="text-[0.625rem] font-medium text-green-400">
            Recovery link sent! Check your inbox.
          </span>
        </div>
      ) : (
        <form onSubmit={handleSend} className="space-y-3">
          <div>
            <label className="block text-[0.625rem] text-gray-500 uppercase tracking-wider mb-1.5 font-medium">
              Email Address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full px-3 py-2.5 rounded-lg bg-surface-highest/50 border border-white/[0.06] text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/30 transition-all"
              required
            />
          </div>
          <button
            type="submit"
            disabled={sending || !email.trim()}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-[0.625rem] font-bold uppercase tracking-wider bg-primary/15 text-primary border border-primary/25 hover:bg-primary/25 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {sending ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Mail className="w-3.5 h-3.5" />
            )}
            {sending ? "Sending..." : "Send Recovery Link"}
          </button>
        </form>
      )}
    </RecoveryCard>
  );
}

/* ── Backup Codes ───────────────────────────────────────────── */

function BackupCodeRecovery() {
  const [code, setCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [result, setResult] = useState<"success" | "error" | null>(null);

  const handleVerify = (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;
    setVerifying(true);
    setResult(null);
    setTimeout(() => {
      setVerifying(false);
      // Simulate: codes starting with "R" succeed for demo
      setResult(code.toUpperCase().startsWith("R") ? "success" : "error");
    }, 1000);
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
        Enter one of the backup codes you saved when setting up your account.
        Each code can only be used once.
      </p>

      <form onSubmit={handleVerify} className="space-y-3">
        <div>
          <label className="block text-[0.625rem] text-gray-500 uppercase tracking-wider mb-1.5 font-medium">
            Backup Code
          </label>
          <input
            type="text"
            value={code}
            onChange={(e) => { setCode(e.target.value); setResult(null); }}
            placeholder="XXXX-XXXX-XXXX"
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
              Invalid backup code. Please try again.
            </span>
          </div>
        )}

        <button
          type="submit"
          disabled={verifying || !code.trim()}
          className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-[0.625rem] font-bold uppercase tracking-wider bg-amber-500/15 text-amber-400 border border-amber-500/25 hover:bg-amber-500/25 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          {verifying ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <KeyRound className="w-3.5 h-3.5" />
          )}
          {verifying ? "Verifying..." : "Verify Code"}
        </button>
      </form>
    </RecoveryCard>
  );
}

/* ── Main Page ──────────────────────────────────────────────── */

export default function AccountRecovery() {
  return (
    <div className="min-h-screen bg-background text-white relative overflow-hidden">
      {/* Background glow orbs */}
      <div className="absolute inset-0 z-0 overflow-hidden">
        <div className="absolute top-[-10%] left-[15%] w-[400px] h-[400px] bg-primary/[0.04] rounded-full blur-[150px]" />
        <div className="absolute bottom-[-10%] right-[10%] w-[350px] h-[350px] bg-purple-600/[0.03] rounded-full blur-[120px]" />
      </div>

      <div className="relative z-10 max-w-lg mx-auto px-4 py-12">
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
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/15 to-purple-500/15 border border-primary/20 flex items-center justify-center mx-auto mb-4">
            <Shield className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-2xl font-display font-bold tracking-tight mb-2">
            Account Recovery
          </h1>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto">
            Choose a recovery method below to regain access to your account.
          </p>
        </motion.div>

        {/* Recovery Methods */}
        <div className="space-y-4">
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
    </div>
  );
}
