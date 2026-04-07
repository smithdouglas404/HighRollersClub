import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useAuth } from "@/lib/auth-context";
import {
  Shield, Lock, Key, Smartphone, Wallet,
  Eye, EyeOff, Check, X, ChevronLeft,
  Link2, ExternalLink, Loader2, Copy, CheckCircle
} from "lucide-react";

/* ────────────────────────────────────────────────────────────
   Password Change Form
   ──────────────────────────────────────────────────────────── */

function PasswordManagement() {
  const [showForm, setShowForm] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const passwordsMatch = newPassword === confirmPassword;
  const canSubmit = currentPassword.length > 0 && newPassword.length >= 6 && passwordsMatch && !saving;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSaving(true);
    setFeedback(null);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({ message: "Failed to change password" }));
        throw new Error(data.message || "Failed to change password");
      }
      setFeedback({ type: "success", message: "Password changed successfully" });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setTimeout(() => setShowForm(false), 1500);
    } catch (err: any) {
      setFeedback({ type: "error", message: err.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
      className="vault-card p-6"
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xs font-bold uppercase tracking-wider gold-text flex items-center gap-2">
          <Lock className="w-4 h-4 text-primary/70" />
          Password
        </h3>
        {!showForm && (
          <button
            onClick={() => { setShowForm(true); setFeedback(null); }}
            className="px-3 py-1.5 rounded-lg text-[0.625rem] font-bold uppercase tracking-wider bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-all"
          >
            Change Password
          </button>
        )}
      </div>

      {!showForm && (
        <div className="flex items-center gap-3 p-3.5 rounded-lg bg-white/[0.03] border border-white/5">
          <Key className="w-4 h-4 text-gray-600 shrink-0" />
          <div className="flex-1">
            <span className="text-[0.625rem] text-gray-500 block">Current Password</span>
            <span className="text-sm font-bold text-white tracking-[0.3em]">{"********"}</span>
          </div>
        </div>
      )}

      <AnimatePresence>
        {showForm && (
          <motion.form
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
            onSubmit={handleSubmit}
          >
            <div className="space-y-3">
              {/* Current password */}
              <div>
                <label className="block text-[0.625rem] text-gray-500 uppercase tracking-wider mb-1.5 font-medium">
                  Current Password
                </label>
                <div className="relative">
                  <input
                    type={showCurrent ? "text" : "password"}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-lg bg-surface-highest/50 border border-white/[0.06] text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/30 transition-all pr-10"
                    placeholder="Enter current password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrent(!showCurrent)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
                  >
                    {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* New password */}
              <div>
                <label className="block text-[0.625rem] text-gray-500 uppercase tracking-wider mb-1.5 font-medium">
                  New Password
                </label>
                <div className="relative">
                  <input
                    type={showNew ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-lg bg-surface-highest/50 border border-white/[0.06] text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/30 transition-all pr-10"
                    placeholder="Minimum 6 characters"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNew(!showNew)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
                  >
                    {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {newPassword.length > 0 && newPassword.length < 6 && (
                  <p className="text-[0.5625rem] text-red-400 mt-1">Password must be at least 6 characters</p>
                )}
              </div>

              {/* Confirm password */}
              <div>
                <label className="block text-[0.625rem] text-gray-500 uppercase tracking-wider mb-1.5 font-medium">
                  Confirm New Password
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg bg-surface-highest/50 border border-white/[0.06] text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/30 transition-all"
                  placeholder="Re-enter new password"
                />
                {confirmPassword.length > 0 && !passwordsMatch && (
                  <p className="text-[0.5625rem] text-red-400 mt-1">Passwords do not match</p>
                )}
              </div>

              {/* Feedback */}
              {feedback && (
                <div className={`flex items-center gap-2 p-3 rounded-lg text-[0.625rem] font-medium ${
                  feedback.type === "success"
                    ? "bg-green-500/10 text-green-400 border border-green-500/20"
                    : "bg-red-500/10 text-red-400 border border-red-500/20"
                }`}>
                  {feedback.type === "success" ? <Check className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />}
                  {feedback.message}
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center gap-2 pt-1">
                <button
                  type="submit"
                  disabled={!canSubmit}
                  className="px-4 py-2 rounded-lg text-[0.625rem] font-bold uppercase tracking-wider bg-primary/15 text-primary border border-primary/25 hover:bg-primary/25 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-2"
                >
                  {saving && <Loader2 className="w-3 h-3 animate-spin" />}
                  Save Password
                </button>
                <button
                  type="button"
                  onClick={() => { setShowForm(false); setFeedback(null); setCurrentPassword(""); setNewPassword(""); setConfirmPassword(""); }}
                  className="px-4 py-2 rounded-lg text-[0.625rem] font-bold uppercase tracking-wider bg-white/5 text-gray-400 border border-white/10 hover:bg-white/10 transition-all"
                >
                  Cancel
                </button>
              </div>
            </div>
          </motion.form>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/* ────────────────────────────────────────────────────────────
   Two-Factor Authentication
   ──────────────────────────────────────────────────────────── */

function TwoFactorAuth() {
  const { user, refreshUser } = useAuth();
  const [enabled, setEnabled] = useState(user?.twoFactorEnabled ?? false);
  const [showSetup, setShowSetup] = useState(false);
  const [secret, setSecret] = useState<string | null>(null);
  const [codeDigits, setCodeDigits] = useState(["", "", "", "", "", ""]);
  const [setupLoading, setSetupLoading] = useState(false);
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [disableLoading, setDisableLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [copied, setCopied] = useState(false);

  // Sync with user object when it changes (e.g. after refreshUser)
  useEffect(() => {
    setEnabled(user?.twoFactorEnabled ?? false);
  }, [user?.twoFactorEnabled]);

  const handleCodeChange = (index: number, value: string) => {
    // Allow only digits
    const digit = value.replace(/\D/g, "").slice(-1);
    const newDigits = [...codeDigits];
    newDigits[index] = digit;
    setCodeDigits(newDigits);

    // Auto-focus next input
    if (digit && index < 5) {
      const nextInput = document.getElementById(`2fa-code-${index + 1}`);
      nextInput?.focus();
    }
  };

  const handleCodeKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !codeDigits[index] && index > 0) {
      const prevInput = document.getElementById(`2fa-code-${index - 1}`);
      prevInput?.focus();
    }
  };

  const handleCodePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (pasted.length > 0) {
      const newDigits = [...codeDigits];
      for (let i = 0; i < 6; i++) {
        newDigits[i] = pasted[i] || "";
      }
      setCodeDigits(newDigits);
      // Focus the next empty input or last input
      const focusIndex = Math.min(pasted.length, 5);
      const input = document.getElementById(`2fa-code-${focusIndex}`);
      input?.focus();
    }
  };

  const fullCode = codeDigits.join("");
  const canVerify = fullCode.length === 6 && !verifyLoading;

  const handleEnableClick = async () => {
    setFeedback(null);
    setSetupLoading(true);
    try {
      const res = await fetch("/api/auth/2fa/setup", {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({ message: "Failed to start 2FA setup" }));
        throw new Error(data.message || "Failed to start 2FA setup");
      }
      const data = await res.json();
      setSecret(data.secret);
      setCodeDigits(["", "", "", "", "", ""]);
      setShowSetup(true);
    } catch (err: any) {
      setFeedback({ type: "error", message: err.message });
    } finally {
      setSetupLoading(false);
    }
  };

  const handleVerify = async () => {
    if (!canVerify) return;
    setFeedback(null);
    setVerifyLoading(true);
    try {
      const res = await fetch("/api/auth/2fa/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ code: fullCode }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({ message: "Invalid verification code" }));
        throw new Error(data.message || "Invalid verification code");
      }
      setEnabled(true);
      setShowSetup(false);
      setSecret(null);
      setCodeDigits(["", "", "", "", "", ""]);
      setFeedback({ type: "success", message: "Two-factor authentication enabled successfully" });
      await refreshUser();
    } catch (err: any) {
      setFeedback({ type: "error", message: err.message });
      setCodeDigits(["", "", "", "", "", ""]);
      // Re-focus first input on error
      const firstInput = document.getElementById("2fa-code-0");
      firstInput?.focus();
    } finally {
      setVerifyLoading(false);
    }
  };

  const handleDisable = async () => {
    setFeedback(null);
    setDisableLoading(true);
    try {
      const res = await fetch("/api/auth/2fa/disable", {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({ message: "Failed to disable 2FA" }));
        throw new Error(data.message || "Failed to disable 2FA");
      }
      setEnabled(false);
      setShowSetup(false);
      setSecret(null);
      setFeedback({ type: "success", message: "Two-factor authentication disabled" });
      await refreshUser();
    } catch (err: any) {
      setFeedback({ type: "error", message: err.message });
    } finally {
      setDisableLoading(false);
    }
  };

  const handleCopySecret = async () => {
    if (!secret) return;
    try {
      await navigator.clipboard.writeText(secret);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback: select the text for manual copy
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15 }}
      className="vault-card p-6"
    >
      <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-4 flex items-center gap-2">
        <Smartphone className="w-4 h-4 text-purple-500/70" />
        Two-Factor Authentication
      </h3>

      <div className="flex items-center justify-between p-4 rounded-lg bg-white/[0.03] border border-white/5">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
            enabled ? "bg-green-500/15" : "bg-white/5"
          }`}>
            <Shield className={`w-5 h-5 ${enabled ? "text-green-400" : "text-gray-500"}`} />
          </div>
          <div>
            <div className="text-sm font-bold text-white">
              {enabled ? "2FA Enabled" : "2FA Disabled"}
            </div>
            <div className="text-[0.625rem] text-gray-500">
              {enabled
                ? "Your account is protected with an authenticator app"
                : "Add an extra layer of security to your account"}
            </div>
          </div>
        </div>

        {/* Toggle button */}
        <button
          disabled={setupLoading || disableLoading}
          onClick={() => {
            if (enabled) {
              handleDisable();
            } else {
              handleEnableClick();
            }
          }}
          className={`relative w-11 h-6 rounded-full transition-all ${
            enabled ? "bg-green-500/30 border border-green-500/40" : "bg-white/10 border border-white/10"
          } ${(setupLoading || disableLoading) ? "opacity-50 cursor-not-allowed" : ""}`}
        >
          {(setupLoading || disableLoading) ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <Loader2 className="w-3 h-3 animate-spin text-gray-400" />
            </div>
          ) : (
            <div className={`absolute top-0.5 w-5 h-5 rounded-full transition-all ${
              enabled
                ? "left-[22px] bg-green-400 shadow-[0_0_8px_rgba(74,222,128,0.4)]"
                : "left-0.5 bg-gray-500"
            }`} />
          )}
        </button>
      </div>

      {/* Feedback message */}
      {feedback && (
        <div className={`mt-3 flex items-center gap-2 p-3 rounded-lg text-[0.625rem] font-medium ${
          feedback.type === "success"
            ? "bg-green-500/10 text-green-400 border border-green-500/20"
            : "bg-red-500/10 text-red-400 border border-red-500/20"
        }`}>
          {feedback.type === "success" ? <Check className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />}
          {feedback.message}
        </div>
      )}

      <AnimatePresence>
        {showSetup && !enabled && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="mt-4 p-4 rounded-lg bg-primary/[0.04] border border-primary/10">
              <div className="text-center">
                {/* Secret key display */}
                <div className="mx-auto rounded-xl bg-white/5 border border-white/10 p-4 mb-4 max-w-xs">
                  <div className="text-center mb-2">
                    <Key className="w-6 h-6 text-primary/60 mx-auto mb-2" />
                    <span className="text-[0.5625rem] text-gray-500 uppercase tracking-wider font-medium block">
                      Secret Key
                    </span>
                  </div>
                  {secret ? (
                    <div className="flex items-center justify-center gap-2">
                      <code className="text-sm font-mono font-bold text-white bg-white/5 px-3 py-1.5 rounded-lg border border-white/10 select-all break-all">
                        {secret}
                      </code>
                      <button
                        onClick={handleCopySecret}
                        className="p-1.5 rounded-md hover:bg-white/10 transition-colors text-gray-400 hover:text-white shrink-0"
                        title="Copy secret"
                      >
                        {copied ? <CheckCircle className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center py-2">
                      <Loader2 className="w-5 h-5 animate-spin text-primary/40" />
                    </div>
                  )}
                </div>
                <p className="text-[0.625rem] text-gray-400 mb-4 max-w-xs mx-auto">
                  Enter this secret key in your authenticator app (Google Authenticator, Authy, etc.) then enter the 6-digit code below to verify.
                </p>
                <div className="flex items-center justify-center gap-2 mb-4" onPaste={handleCodePaste}>
                  {Array.from({ length: 6 }).map((_, i) => (
                    <input
                      key={i}
                      id={`2fa-code-${i}`}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={codeDigits[i]}
                      onChange={(e) => handleCodeChange(i, e.target.value)}
                      onKeyDown={(e) => handleCodeKeyDown(i, e)}
                      className="w-9 h-11 text-center rounded-lg bg-surface-highest/50 border border-white/[0.06] text-lg font-bold text-white focus:outline-none focus:border-primary/40 transition-all"
                      disabled={verifyLoading}
                    />
                  ))}
                </div>
                <div className="flex items-center justify-center gap-2">
                  <button
                    onClick={handleVerify}
                    disabled={!canVerify}
                    className="px-4 py-2 rounded-lg text-[0.625rem] font-bold uppercase tracking-wider bg-primary/15 text-primary border border-primary/25 hover:bg-primary/25 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-2"
                  >
                    {verifyLoading && <Loader2 className="w-3 h-3 animate-spin" />}
                    Verify & Enable
                  </button>
                  <button
                    onClick={() => { setShowSetup(false); setSecret(null); setFeedback(null); setCodeDigits(["", "", "", "", "", ""]); }}
                    disabled={verifyLoading}
                    className="px-4 py-2 rounded-lg text-[0.625rem] font-bold uppercase tracking-wider bg-white/5 text-gray-400 border border-white/10 hover:bg-white/10 transition-all"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/* ────────────────────────────────────────────────────────────
   Connected Wallets (Coming Soon)
   ──────────────────────────────────────────────────────────── */

function ConnectedWallets() {
  const { user, refreshUser } = useAuth();
  const [walletAddress, setWalletAddress] = useState(user?.walletAddress || "");
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  useEffect(() => {
    setWalletAddress(user?.walletAddress || "");
  }, [user?.walletAddress]);

  const handleSave = async () => {
    setSaving(true);
    setFeedback(null);
    try {
      const res = await fetch("/api/profile/wallet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ walletAddress: walletAddress.trim() || null }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({ message: "Failed to update wallet" }));
        throw new Error(data.message || "Failed to update wallet");
      }
      setFeedback({
        type: "success",
        message: walletAddress.trim() ? "Wallet address linked successfully" : "Wallet address unlinked",
      });
      await refreshUser();
    } catch (err: any) {
      setFeedback({ type: "error", message: err.message });
    } finally {
      setSaving(false);
    }
  };

  const handleUnlink = async () => {
    setWalletAddress("");
    setSaving(true);
    setFeedback(null);
    try {
      const res = await fetch("/api/profile/wallet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ walletAddress: null }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({ message: "Failed to unlink wallet" }));
        throw new Error(data.message || "Failed to unlink wallet");
      }
      setFeedback({ type: "success", message: "Wallet address unlinked" });
      await refreshUser();
    } catch (err: any) {
      setFeedback({ type: "error", message: err.message });
    } finally {
      setSaving(false);
    }
  };

  const isLinked = !!user?.walletAddress;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className="vault-card p-6"
    >
      <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-4 flex items-center gap-2">
        <Wallet className="w-4 h-4 text-primary/70" />
        Connected Wallet
      </h3>

      {isLinked && (
        <div className="flex items-center gap-3 p-3.5 rounded-lg bg-green-500/5 border border-green-500/15 mb-4">
          <Check className="w-4 h-4 text-green-400 shrink-0" />
          <div className="flex-1 min-w-0">
            <span className="text-[0.625rem] text-gray-500 block">Linked Wallet Address</span>
            <span className="text-sm font-mono text-white truncate block">{user.walletAddress}</span>
          </div>
          <button
            onClick={handleUnlink}
            disabled={saving}
            className="px-3 py-1.5 rounded-lg text-[0.625rem] font-bold uppercase tracking-wider bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 disabled:opacity-50 transition-all shrink-0"
          >
            Unlink
          </button>
        </div>
      )}

      <div className="space-y-3">
        <div>
          <label className="block text-[0.625rem] text-gray-500 uppercase tracking-wider mb-1.5 font-medium">
            Wallet Address
          </label>
          <input
            type="text"
            value={walletAddress}
            onChange={(e) => { setWalletAddress(e.target.value); setFeedback(null); }}
            placeholder="0x..."
            className="w-full px-3 py-2.5 rounded-lg bg-surface-highest/50 border border-white/[0.06] text-sm text-foreground font-mono placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/30 transition-all"
          />
        </div>

        {feedback && (
          <div className={`flex items-center gap-2 p-3 rounded-lg text-[0.625rem] font-medium ${
            feedback.type === "success"
              ? "bg-green-500/10 text-green-400 border border-green-500/20"
              : "bg-red-500/10 text-red-400 border border-red-500/20"
          }`}>
            {feedback.type === "success" ? <Check className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />}
            {feedback.message}
          </div>
        )}

        <button
          onClick={handleSave}
          disabled={saving || !walletAddress.trim()}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-[0.625rem] font-bold uppercase tracking-wider bg-primary/15 text-primary border border-primary/25 hover:bg-primary/25 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
        >
          {saving && <Loader2 className="w-3 h-3 animate-spin" />}
          {isLinked ? "Update Wallet" : "Link Wallet"}
        </button>
      </div>
    </motion.div>
  );
}

/* ────────────────────────────────────────────────────────────
   Linked Social Accounts
   ──────────────────────────────────────────────────────────── */

const SOCIAL_PROVIDERS = [
  {
    id: "google",
    name: "Google",
    iconPath: (
      <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none">
        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
      </svg>
    ),
    color: "from-white/5 to-gray-500/5",
    borderColor: "border-white/10",
  },
  {
    id: "discord",
    name: "Discord",
    iconPath: (
      <svg viewBox="0 0 24 24" className="w-5 h-5" fill="#5865F2">
        <path d="M20.317 4.37a19.791 19.791 0 00-4.885-1.515.074.074 0 00-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 00-5.487 0 12.64 12.64 0 00-.617-1.25.077.077 0 00-.079-.037A19.736 19.736 0 003.677 4.37a.07.07 0 00-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 00.031.057 19.9 19.9 0 005.993 3.03.078.078 0 00.084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 00-.041-.106 13.107 13.107 0 01-1.872-.892.077.077 0 01-.008-.128 10.2 10.2 0 00.372-.292.074.074 0 01.077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 01.078.01c.12.098.246.198.373.292a.077.077 0 01-.006.127 12.299 12.299 0 01-1.873.892.077.077 0 00-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 00.084.028 19.839 19.839 0 006.002-3.03.077.077 0 00.032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 00-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.947 2.418-2.157 2.418z"/>
      </svg>
    ),
    color: "from-[#5865F2]/10 to-indigo-600/10",
    borderColor: "border-[#5865F2]/20",
  },
  {
    id: "twitter",
    name: "X (Twitter)",
    iconPath: (
      <svg viewBox="0 0 24 24" className="w-5 h-5" fill="white">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
      </svg>
    ),
    color: "from-white/5 to-gray-500/5",
    borderColor: "border-white/10",
  },
];

function LinkedSocialAccounts() {
  const [linkedAccounts, setLinkedAccounts] = useState<Record<string, boolean>>({});

  const handleLink = (providerId: string) => {
    // Placeholder: in production this would trigger OAuth flow
    setLinkedAccounts((prev) => ({ ...prev, [providerId]: true }));
  };

  const handleUnlink = (providerId: string) => {
    setLinkedAccounts((prev) => {
      const next = { ...prev };
      delete next[providerId];
      return next;
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.25 }}
      className="vault-card p-6"
    >
      <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-4 flex items-center gap-2">
        <Link2 className="w-4 h-4 text-green-500/70" />
        Linked Social Accounts
      </h3>

      <div className="space-y-3">
        {SOCIAL_PROVIDERS.map((provider) => {
          const isLinked = !!linkedAccounts[provider.id];

          return (
            <div
              key={provider.id}
              className={`flex items-center gap-4 p-4 rounded-xl bg-gradient-to-br ${provider.color} border ${provider.borderColor} transition-all hover:border-white/15`}
            >
              <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center shrink-0">
                {provider.iconPath}
              </div>
              <div className="flex-1">
                <div className="text-xs font-bold text-white">{provider.name}</div>
                <div className="text-[0.5625rem] text-gray-500">
                  {isLinked ? "Account linked" : "Not linked"}
                </div>
              </div>
              {isLinked ? (
                <div className="flex items-center gap-1.5">
                  <span className="flex items-center gap-1 px-2 py-1 rounded-md bg-green-500/10 text-green-400 text-[0.5625rem] font-bold border border-green-500/20">
                    <Check className="w-3 h-3" />
                    Linked
                  </span>
                  <button
                    onClick={() => handleUnlink(provider.id)}
                    className="p-1 rounded-md hover:bg-white/10 transition-colors text-gray-500 hover:text-red-400"
                    title="Unlink"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => handleLink(provider.id)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[0.625rem] font-bold uppercase tracking-wider bg-white/5 text-gray-300 border border-white/10 hover:bg-white/10 hover:text-white transition-all"
                >
                  <ExternalLink className="w-3 h-3" />
                  Link
                </button>
              )}
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}

/* ────────────────────────────────────────────────────────────
   API Keys Section
   ──────────────────────────────────────────────────────────── */

function ApiKeysSection() {
  const [keys, setKeys] = useState<{ id: string; name: string; lastUsed: string | null; createdAt: string }[]>([]);
  const [newKeyName, setNewKeyName] = useState("");
  const [generatedKey, setGeneratedKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch("/api/api-keys", { credentials: "include" })
      .then(r => r.ok ? r.json() : [])
      .then(setKeys)
      .catch(() => {});
  }, []);

  const handleGenerate = async () => {
    if (!newKeyName.trim() || loading) return;
    setLoading(true);
    try {
      const res = await fetch("/api/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name: newKeyName.trim() }),
      });
      if (res.ok) {
        const data = await res.json();
        setGeneratedKey(data.key);
        setKeys(prev => [{ id: data.id, name: data.name, lastUsed: null, createdAt: data.createdAt }, ...prev]);
        setNewKeyName("");
      }
    } catch {} finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    await fetch(`/api/api-keys/${id}`, { method: "DELETE", credentials: "include" });
    setKeys(prev => prev.filter(k => k.id !== id));
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(generatedKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.25 }}
      className="rounded-xl p-5 bg-surface-high/30 backdrop-blur-xl border border-white/[0.06]"
    >
      <div className="flex items-center gap-2 mb-4">
        <Key className="w-4 h-4 text-primary" />
        <h3 className="text-sm font-display font-bold text-white">API Keys</h3>
      </div>
      <p className="text-xs text-muted-foreground mb-4">
        Generate API keys to access player statistics programmatically.
        See <a href="/api-docs" className="text-primary hover:underline">API Documentation</a> for usage.
      </p>

      {/* Generate new key */}
      <div className="flex gap-2 mb-4">
        <input
          value={newKeyName}
          onChange={e => setNewKeyName(e.target.value)}
          placeholder="Key name (e.g., My App)"
          maxLength={50}
          className="flex-1 px-3 py-2 rounded-lg text-xs bg-surface-highest/50 border border-white/[0.06] text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-primary/30"
        />
        <button
          onClick={handleGenerate}
          disabled={!newKeyName.trim() || loading}
          className="px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider text-black bg-primary hover:bg-primary/90 transition-all disabled:opacity-40"
        >
          Generate
        </button>
      </div>

      {/* Show generated key once */}
      <AnimatePresence>
        {generatedKey && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-4 p-3 rounded-lg bg-green-500/10 border border-green-500/20"
          >
            <p className="text-[10px] font-bold text-green-400 uppercase tracking-wider mb-1">
              Copy this key now -- it will not be shown again
            </p>
            <div className="flex items-center gap-2">
              <code className="text-xs text-green-300 font-mono flex-1 break-all">{generatedKey}</code>
              <button onClick={handleCopy} className="p-1.5 rounded-md bg-white/5 hover:bg-white/10 transition-colors">
                {copied ? <CheckCircle className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4 text-muted-foreground" />}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Key list */}
      {keys.length > 0 && (
        <div className="space-y-2">
          {keys.map(k => (
            <div key={k.id} className="flex items-center justify-between p-3 rounded-lg bg-black/20 border border-white/[0.04]">
              <div>
                <span className="text-xs font-bold text-white">{k.name}</span>
                <span className="text-[10px] text-muted-foreground ml-2">
                  {k.lastUsed ? `Last used ${new Date(k.lastUsed).toLocaleDateString()}` : "Never used"}
                </span>
              </div>
              <button
                onClick={() => handleDelete(k.id)}
                className="text-[10px] font-bold text-red-400 hover:text-red-300 transition-colors"
              >
                Delete
              </button>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );
}

/* ────────────────────────────────────────────────────────────
   Main Security Page
   ──────────────────────────────────────────────────────────── */

export default function Security() {
  const { user } = useAuth();
  const [, navigate] = useLocation();

  return (
    <DashboardLayout title="Security">
      <div className="pb-8 px-4 md:px-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6"
        >
          <button
            onClick={() => navigate("/profile")}
            className="flex items-center gap-1.5 text-[0.625rem] font-medium text-gray-500 hover:text-white transition-colors mb-4"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            Back to Profile
          </button>

          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: "rgba(212,175,55,0.1)", border: "1px solid rgba(212,175,55,0.2)" }}>
              <Shield className="w-6 h-6" style={{ color: "#d4af37" }} />
            </div>
            <div>
              <h2 className="text-lg font-black uppercase tracking-wider gold-text">
                Security Settings
              </h2>
              <p className="text-[0.625rem] text-gray-500">
                Manage your account security, authentication methods, and connected services.
              </p>
            </div>
          </div>
        </motion.div>

        {/* Sections */}
        <div className="space-y-4">
          <PasswordManagement />
          <TwoFactorAuth />
          <ConnectedWallets />
          <LinkedSocialAccounts />
          <ApiKeysSection />
        </div>
      </div>
    </DashboardLayout>
  );
}
