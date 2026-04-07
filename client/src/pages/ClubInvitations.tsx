import { useState } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useAuth } from "@/lib/auth-context";
import { useClub } from "@/lib/club-context";
import {
  Mail, Send, UserPlus, Check, X, Loader2,
  Clock, CheckCircle, XCircle, AlertTriangle, Users, Inbox, RefreshCw, ShieldCheck,
} from "lucide-react";

export default function ClubInvitations() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const { club, invitations, loading, sendInvite, handleInvitation } = useClub();

  // Invite form
  const [inviteUsername, setInviteUsername] = useState("");
  const [inviteRole, setInviteRole] = useState<"member" | "moderator" | "admin">("member");
  const [sending, setSending] = useState(false);
  const [sendSuccess, setSendSuccess] = useState("");
  const [sendError, setSendError] = useState("");
  const [resending, setResending] = useState<Record<string, boolean>>({});

  // Action loading
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});

  const handleSendInvite = async () => {
    if (!club || !inviteUsername.trim() || sending) return;
    setSendSuccess("");
    setSendError("");
    setSending(true);
    try {
      const username = inviteUsername.trim();
      const ok = await sendInvite(username);
      if (ok) {
        setInviteUsername("");
        setSendSuccess(`Invitation sent to ${username}`);
        setTimeout(() => setSendSuccess(""), 3000);
      } else {
        setSendError("Failed to send invitation");
      }
    } catch (err: any) {
      setSendError(err.message || "Failed to send invitation");
    } finally {
      setSending(false);
    }
  };

  const handleAction = async (invId: string, status: "accepted" | "declined") => {
    if (!club) return;
    setActionLoading((prev) => ({ ...prev, [invId]: true }));
    try {
      await handleInvitation(invId, status);
    } catch {
      // toast handled by context
    } finally {
      setActionLoading((prev) => ({ ...prev, [invId]: false }));
    }
  };

  const handleResend = async (username: string, invId: string) => {
    if (!club || resending[invId]) return;
    setResending((prev) => ({ ...prev, [invId]: true }));
    try {
      const ok = await sendInvite(username);
      if (ok) {
        setSendSuccess(`Invitation resent to ${username}`);
        setTimeout(() => setSendSuccess(""), 3000);
      }
    } catch {
      // silently handled
    } finally {
      setResending((prev) => ({ ...prev, [invId]: false }));
    }
  };

  const sentInvitations = invitations.filter((inv) => inv.type === "invite");
  const pendingRequests = invitations.filter(
    (inv) => inv.type === "request" && inv.status === "pending"
  );

  const statusIcon = (status: string) => {
    switch (status) {
      case "pending":
        return <Clock className="w-3.5 h-3.5 text-primary" />;
      case "accepted":
        return <CheckCircle className="w-3.5 h-3.5 text-green-400" />;
      case "declined":
        return <XCircle className="w-3.5 h-3.5 text-red-400" />;
      default:
        return null;
    }
  };

  const statusColor = (status: string) => {
    switch (status) {
      case "pending":
        return "text-[#d4af37]";
      case "accepted":
        return "text-green-400";
      case "declined":
        return "text-red-400";
      default:
        return "text-gray-400";
    }
  };

  const statusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return "bg-[#d4af37]/15 text-[#d4af37] border border-[#d4af37]/30";
      case "accepted":
        return "bg-green-500/15 text-green-400 border border-green-500/30";
      case "declined":
        return "bg-red-500/15 text-red-400 border border-red-500/30";
      default:
        return "bg-gray-500/15 text-gray-400 border border-gray-500/30";
    }
  };

  return (
    <DashboardLayout title="Invitations">
      <div className="px-8 pb-8">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : !club ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-20"
          >
            <Users className="w-12 h-12 text-gray-700 mx-auto mb-3" />
            <p className="text-sm text-gray-500">You don't belong to any club yet.</p>
            <button
              onClick={() => navigate("/lobby")}
              className="mt-4 px-6 py-2 rounded-lg text-xs font-bold uppercase tracking-wider bg-primary text-black"
            >
              Back to Lobby
            </button>
          </motion.div>
        ) : (
          <div className="max-w-2xl mx-auto space-y-6">
            {/* Invite By Username */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="vault-card overflow-hidden"
            >
              <div
                className="flex items-center gap-3 px-5 py-4 border-b border-b-white/[0.06]"
              >
                <div className="w-9 h-9 rounded-lg bg-primary/15 border border-primary/20 flex items-center justify-center">
                  <UserPlus className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className="text-sm font-bold gold-text tracking-wider uppercase">
                    Invite Player
                  </h3>
                  <p className="text-[0.5625rem] text-gray-500">Send an invite by username</p>
                </div>
              </div>

              <div className="p-5 space-y-3">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={inviteUsername}
                    onChange={(e) => setInviteUsername(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSendInvite()}
                    placeholder="Enter username..."
                    className="flex-1 px-4 py-2.5 rounded-lg text-sm text-white placeholder-gray-600 outline-none transition-all focus:ring-1 focus:ring-[#d4af37]/50 focus:border-[#d4af37]/40 bg-surface-highest/50 gold-border"
                  />
                  <motion.button
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={handleSendInvite}
                    disabled={sending || !inviteUsername.trim()}
                    className="gold-btn px-5 py-2.5 text-xs font-bold uppercase tracking-wider flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
                  >
                    {sending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                    Send
                  </motion.button>
                </div>

                {/* Role selection */}
                <div className="flex items-center gap-3">
                  <ShieldCheck className="w-4 h-4 text-gray-500 shrink-0" />
                  <label className="text-[0.625rem] font-bold uppercase tracking-wider text-gray-400 shrink-0">
                    Invite as
                  </label>
                  <select
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value as "member" | "moderator" | "admin")}
                    className="flex-1 px-3 py-1.5 rounded-lg text-xs text-white outline-none transition-all focus:ring-1 focus:ring-[#d4af37]/50 focus:border-[#d4af37]/40 appearance-none cursor-pointer bg-surface-highest/50 gold-border"
                  >
                    <option value="member" className="bg-surface-lowest">Member</option>
                    <option value="moderator" className="bg-surface-lowest">Moderator</option>
                    <option value="admin" className="bg-surface-lowest">Admin</option>
                  </select>
                </div>

                <AnimatePresence>
                  {sendSuccess && (
                    <motion.div
                      initial={{ opacity: 0, y: -5 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -5 }}
                      className="flex items-center gap-2 text-[0.625rem] text-green-400"
                    >
                      <CheckCircle className="w-3 h-3" />
                      {sendSuccess}
                    </motion.div>
                  )}
                  {sendError && (
                    <motion.div
                      initial={{ opacity: 0, y: -5 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -5 }}
                      className="flex items-center gap-2 text-[0.625rem] text-red-400"
                    >
                      <AlertTriangle className="w-3 h-3" />
                      {sendError}
                      <button
                        onClick={() => setSendError("")}
                        className="ml-auto p-0.5 hover:bg-white/5 rounded"
                      >
                        <X className="w-3 h-3 text-gray-500" />
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>

            {/* Pending Requests (join requests from others) */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="vault-card overflow-hidden"
            >
              <div
                className="flex items-center justify-between px-5 py-4 border-b border-b-[#d4af37]/10"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-primary/15 border border-primary/20 flex items-center justify-center">
                    <Inbox className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold tracking-wider uppercase gold-text">
                      Pending Requests
                    </h3>
                    <p className="text-[0.5625rem] text-gray-500">Players wanting to join your club</p>
                  </div>
                </div>
                {pendingRequests.length > 0 && (
                  <span
                    className="text-[0.5625rem] font-bold text-primary bg-primary/10 px-2.5 py-1 rounded-full border border-primary/20"
                  >
                    {pendingRequests.length} pending
                  </span>
                )}
              </div>

              <div className="p-5">
                {pendingRequests.length === 0 ? (
                  <div className="text-center py-6">
                    <Mail className="w-8 h-8 text-gray-700 mx-auto mb-2" />
                    <p className="text-[0.6875rem] text-gray-600">No pending requests</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {pendingRequests.map((inv) => (
                      <motion.div
                        key={inv.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="flex items-center gap-3 px-4 py-3 rounded-lg transition-colors hover:bg-white/[0.02] border border-white/[0.06]"
                      >
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-500/30 to-purple-500/30 flex items-center justify-center border border-white/10 shrink-0 shadow-[0_0_10px_hsl(var(--primary)/0.15)]">
                          <span className="text-[0.625rem] font-bold text-white">
                            {inv.displayName.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-semibold text-white truncate">
                            {inv.displayName}
                          </div>
                          <div className="text-[0.5625rem] text-gray-500">@{inv.username}</div>
                        </div>
                        <div className="flex gap-1.5 shrink-0">
                          <motion.button
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                            onClick={() => handleAction(inv.id, "accepted")}
                            disabled={actionLoading[inv.id]}
                            className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors disabled:opacity-50 bg-primary/10 border border-primary/20"
                          >
                            {actionLoading[inv.id] ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin text-green-400" />
                            ) : (
                              <Check className="w-3.5 h-3.5 text-green-400" />
                            )}
                          </motion.button>
                          <motion.button
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                            onClick={() => handleAction(inv.id, "declined")}
                            disabled={actionLoading[inv.id]}
                            className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors disabled:opacity-50 bg-destructive/10 border border-destructive/20"
                          >
                            <X className="w-3.5 h-3.5 text-red-400" />
                          </motion.button>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>

            {/* Sent Invitations */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="vault-card overflow-hidden"
            >
              <div
                className="flex items-center gap-3 px-5 py-4 border-b border-b-[#d4af37]/10"
              >
                <div className="w-9 h-9 rounded-lg bg-[#d4af37]/15 border border-[#d4af37]/20 flex items-center justify-center">
                  <Send className="w-5 h-5 text-[#d4af37]" />
                </div>
                <div>
                  <h3 className="text-sm font-bold tracking-wider uppercase gold-text">
                    Sent Invitations
                  </h3>
                  <p className="text-[0.5625rem] text-gray-500">Track your outgoing invites</p>
                </div>
              </div>

              <div className="p-5">
                {sentInvitations.length === 0 ? (
                  <div className="text-center py-6">
                    <Send className="w-8 h-8 text-gray-700 mx-auto mb-2" />
                    <p className="text-[0.6875rem] text-gray-600">No invitations sent yet</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {sentInvitations.map((inv) => (
                      <motion.div
                        key={inv.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="flex items-center gap-3 px-4 py-3 rounded-lg gold-border"
                      >
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-500/30 to-purple-500/30 flex items-center justify-center border border-white/10 shrink-0 shadow-[0_0_10px_hsl(var(--primary)/0.15)]">
                          <span className="text-[0.625rem] font-bold text-white">
                            {inv.displayName.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-semibold text-white truncate">
                            {inv.displayName}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[0.5625rem] text-gray-500">@{inv.username}</span>
                            {(inv as any).role && (
                              <span className="text-[0.5rem] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-primary/10 border border-primary/20 text-primary">
                                {(inv as any).role}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className={`text-[0.5625rem] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${statusBadge(inv.status)}`}>
                            {inv.status}
                          </span>
                          {inv.status === "pending" && (
                            <motion.button
                              whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.95 }}
                              onClick={() => handleResend(inv.username, inv.id)}
                              disabled={resending[inv.id]}
                              className="px-2.5 py-1 rounded-md text-[0.5625rem] font-bold uppercase tracking-wider flex items-center gap-1 transition-colors disabled:opacity-50 bg-white/[0.04] border border-white/[0.08] text-gray-400 hover:text-white hover:border-primary/30"
                            >
                              {resending[inv.id] ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                <RefreshCw className="w-3 h-3" />
                              )}
                              Resend
                            </motion.button>
                          )}
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
