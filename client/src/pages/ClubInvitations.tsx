import { useState } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useAuth } from "@/lib/auth-context";
import { useClub } from "@/lib/club-context";
import {
  Mail, Send, UserPlus, Check, X, Loader2,
  Clock, CheckCircle, XCircle, AlertTriangle, Users, Inbox,
} from "lucide-react";

export default function ClubInvitations() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const { club, invitations, loading, sendInvite, handleInvitation } = useClub();

  // Invite form
  const [inviteUsername, setInviteUsername] = useState("");
  const [sending, setSending] = useState(false);
  const [sendSuccess, setSendSuccess] = useState("");
  const [sendError, setSendError] = useState("");

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

  const sentInvitations = invitations.filter((inv) => inv.type === "invite");
  const pendingRequests = invitations.filter(
    (inv) => inv.type === "request" && inv.status === "pending"
  );

  const statusIcon = (status: string) => {
    switch (status) {
      case "pending":
        return <Clock className="w-3.5 h-3.5 text-amber-400" />;
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
        return "text-amber-400";
      case "accepted":
        return "text-green-400";
      case "declined":
        return "text-red-400";
      default:
        return "text-gray-400";
    }
  };

  return (
    <DashboardLayout title="Invitations">
      <div className="px-8 pb-8">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-amber-400" />
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
              className="mt-4 px-6 py-2 rounded-lg text-xs font-bold uppercase tracking-wider text-black"
              style={{
                background: "linear-gradient(135deg, #c9a84c, #f0d078)",
                boxShadow: "0 0 20px rgba(201,168,76,0.3)",
              }}
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
              className="rounded-xl overflow-hidden"
              style={{
                background: "linear-gradient(135deg, rgba(20,31,40,0.90) 0%, rgba(16,24,36,0.95) 100%)",
                border: "1px solid rgba(212,168,67,0.1)",
                boxShadow: "0 10px 40px rgba(0,0,0,0.3)",
              }}
            >
              <div
                className="flex items-center gap-3 px-5 py-4"
                style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
              >
                <div className="w-9 h-9 rounded-lg bg-amber-500/15 border border-amber-500/20 flex items-center justify-center">
                  <UserPlus className="w-5 h-5 text-amber-400" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-amber-400 tracking-wider uppercase">
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
                    className="flex-1 px-4 py-2.5 rounded-lg text-sm text-white placeholder-gray-600 outline-none transition-all focus:ring-1 focus:ring-amber-500/40"
                    style={{
                      background: "rgba(255,255,255,0.06)",
                      border: "1px solid rgba(255,255,255,0.12)",
                    }}
                  />
                  <motion.button
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={handleSendInvite}
                    disabled={sending || !inviteUsername.trim()}
                    className="px-5 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider text-black flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
                    style={{
                      background: "linear-gradient(135deg, #c9a84c, #f0d078)",
                      boxShadow: "0 0 20px rgba(201,168,76,0.3)",
                    }}
                  >
                    {sending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                    Send
                  </motion.button>
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
              className="rounded-xl overflow-hidden"
              style={{
                background: "linear-gradient(135deg, rgba(20,31,40,0.90) 0%, rgba(16,24,36,0.95) 100%)",
                border: "1px solid rgba(255,165,0,0.1)",
                boxShadow: "0 10px 40px rgba(0,0,0,0.3)",
              }}
            >
              <div
                className="flex items-center justify-between px-5 py-4"
                style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-amber-500/15 border border-amber-500/20 flex items-center justify-center">
                    <Inbox className="w-5 h-5 text-amber-400" />
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
                    className="text-[0.5625rem] font-bold text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-full border border-amber-500/20"
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
                        className="flex items-center gap-3 px-4 py-3 rounded-lg transition-colors hover:bg-white/[0.02]"
                        style={{ border: "1px solid rgba(255,255,255,0.04)" }}
                      >
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-500/30 to-purple-500/30 flex items-center justify-center border border-white/10 shrink-0 shadow-[0_0_10px_rgba(212,168,67,0.15)]">
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
                            className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors disabled:opacity-50"
                            style={{
                              background: "rgba(201,168,76,0.1)",
                              border: "1px solid rgba(201,168,76,0.2)",
                            }}
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
                            className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors disabled:opacity-50"
                            style={{
                              background: "rgba(255,60,60,0.1)",
                              border: "1px solid rgba(255,60,60,0.2)",
                            }}
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
              className="rounded-xl overflow-hidden"
              style={{
                background: "linear-gradient(135deg, rgba(20,31,40,0.90) 0%, rgba(16,24,36,0.95) 100%)",
                border: "1px solid rgba(120,80,220,0.1)",
                boxShadow: "0 10px 40px rgba(0,0,0,0.3)",
              }}
            >
              <div
                className="flex items-center gap-3 px-5 py-4"
                style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
              >
                <div className="w-9 h-9 rounded-lg bg-purple-500/15 border border-purple-500/20 flex items-center justify-center">
                  <Send className="w-5 h-5 text-purple-400" />
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
                        className="flex items-center gap-3 px-4 py-3 rounded-lg"
                        style={{ border: "1px solid rgba(255,255,255,0.04)" }}
                      >
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-500/30 to-purple-500/30 flex items-center justify-center border border-white/10 shrink-0 shadow-[0_0_10px_rgba(212,168,67,0.15)]">
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
                        <div className="flex items-center gap-1.5 shrink-0">
                          {statusIcon(inv.status)}
                          <span className={`text-[0.5625rem] font-bold uppercase tracking-wider ${statusColor(inv.status)}`}>
                            {inv.status}
                          </span>
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
