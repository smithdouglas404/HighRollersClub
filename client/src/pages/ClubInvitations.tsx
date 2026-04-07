import { useState } from "react";
import { GoldButton, GoldCard, SectionHeader } from "@/components/premium/PremiumComponents";
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
        return "text-primary";
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
          <div className="max-w-5xl mx-auto space-y-8">
            {/* Page Title */}
            <div>
              <h1 className="text-2xl font-black gold-text">Club Member Invite Flow</h1>
              <p className="text-sm text-gray-500 mt-1">Recruiting and onboarding new members into the {club.name}.</p>
            </div>

            {/* 2-column: Invite Form + Welcome Card */}
            <GoldCard glow>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Left: Invite Form */}
                <div>
                  <h3 className="text-lg font-black text-white mb-4">Invite New Member</h3>

                  <div className="space-y-4">
                    <div>
                      <label className="text-[0.625rem] font-bold uppercase tracking-wider text-gray-400 mb-1.5 block">
                        Member Email or Wallet Address
                      </label>
                      <input
                        type="text"
                        value={inviteUsername}
                        onChange={(e) => setInviteUsername(e.target.value)}
                        placeholder="Member Email or Wallet Address"
                        className="w-full px-4 py-2.5 rounded-lg text-sm text-white placeholder-gray-600 outline-none transition-all focus:ring-1 focus:ring-[#d4af37]/40 gold-border"
                        style={{ background: "rgba(255,255,255,0.04)" }}
                      />
                    </div>

                    <div>
                      <label className="text-[0.625rem] font-bold uppercase tracking-wider text-gray-400 mb-1.5 block">
                        Assign Initial Credit Limit
                      </label>
                      <select
                        value={inviteRole}
                        onChange={(e) => setInviteRole(e.target.value as any)}
                        className="w-full px-4 py-2.5 rounded-lg text-sm text-white outline-none transition-all focus:ring-1 focus:ring-[#d4af37]/40 gold-border appearance-none cursor-pointer"
                        style={{ background: "rgba(255,255,255,0.04)" }}
                      >
                        <option value="member" style={{ background: "#1a1a2e" }}>$10,000</option>
                        <option value="moderator" style={{ background: "#1a1a2e" }}>$25,000</option>
                        <option value="admin" style={{ background: "#1a1a2e" }}>$50,000</option>
                      </select>
                    </div>

                    {/* Success/Error messages */}
                    <AnimatePresence>
                      {sendSuccess && (
                        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-xs text-green-400 flex items-center gap-1.5">
                          <CheckCircle className="w-3.5 h-3.5" /> {sendSuccess}
                        </motion.p>
                      )}
                      {sendError && (
                        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-xs text-red-400 flex items-center gap-1.5">
                          <AlertTriangle className="w-3.5 h-3.5" /> {sendError}
                        </motion.p>
                      )}
                    </AnimatePresence>

                    <GoldButton onClick={handleSendInvite} disabled={sending || !inviteUsername.trim()} fullWidth>
                      {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Send Invitation"}
                    </GoldButton>
                  </div>
                </div>

                {/* Right: Welcome Card Preview */}
                <div className="flex items-center justify-center">
                  <div
                    className="w-full max-w-[280px] rounded-xl p-6 text-center"
                    style={{
                      background: "linear-gradient(135deg, rgba(212,175,55,0.08) 0%, rgba(15,12,8,0.9) 100%)",
                      border: "1px solid rgba(212,175,55,0.3)",
                      boxShadow: "0 0 30px rgba(212,175,55,0.1)",
                    }}
                  >
                    <div
                      className="w-16 h-16 rounded-full mx-auto mb-3 flex items-center justify-center"
                      style={{ background: "linear-gradient(135deg, rgba(212,175,55,0.2), rgba(154,123,44,0.1))", border: "2px solid rgba(212,175,55,0.4)" }}
                    >
                      <ShieldCheck className="w-8 h-8 text-[#d4af37]" />
                    </div>
                    <h4 className="text-sm font-black gold-text">High Rollers Welcome Card</h4>
                    <p className="text-xs text-gray-400 mt-2">Welcome to the {club.name},</p>
                    <p className="text-xs text-gray-500 mt-1 italic">Your Exclusive Access Awaits</p>
                    <p className="text-[0.5625rem] text-gray-600 mt-3 font-mono">Club: {club.name}</p>
                  </div>
                </div>
              </div>
            </GoldCard>

            {/* ── Pending Invitations Table ── */}
            {sentInvitations.length > 0 && (
            <GoldCard>
              <h3 className="text-lg font-black text-white mb-4">Pending Invitations</h3>

              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr style={{ background: "rgba(212,175,55,0.06)" }}>
                      <th className="text-left py-3 px-4 text-xs font-bold uppercase tracking-wider" style={{ color: "#d4af37" }}>Invitee</th>
                      <th className="text-left py-3 px-4 text-xs font-bold uppercase tracking-wider" style={{ color: "#d4af37" }}>Status</th>
                      <th className="text-left py-3 px-4 text-xs font-bold uppercase tracking-wider" style={{ color: "#d4af37" }}>Sent Date</th>
                      <th className="text-left py-3 px-4 text-xs font-bold uppercase tracking-wider" style={{ color: "#d4af37" }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sentInvitations.map((inv: any) => (
                      <tr key={inv.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                        <td className="py-3 px-4 text-sm text-gray-300">{inv.userId}</td>
                        <td className="py-3 px-4">
                          <span className={`text-xs font-semibold flex items-center gap-1.5 ${statusColor(inv.status)}`}>
                            {statusIcon(inv.status)} {inv.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-xs text-gray-500">{new Date(inv.createdAt).toLocaleDateString()}</td>
                        <td className="py-3 px-4">
                          {inv.status === "pending" && (
                            <button
                              onClick={() => handleResend(inv.userId, inv.id)}
                              disabled={resending[inv.id]}
                              className="text-xs font-bold px-3 py-1 rounded-lg transition-all"
                              style={{ background: "rgba(212,175,55,0.1)", border: "1px solid rgba(212,175,55,0.2)", color: "#d4af37" }}
                            >
                              {resending[inv.id] ? <Loader2 className="w-3 h-3 animate-spin" /> : "Resend"}
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </GoldCard>
            )}

            {/* ── Pending Join Requests ── */}
            {pendingRequests.length > 0 && (
            <GoldCard>
              <h3 className="text-lg font-black text-white mb-4 flex items-center gap-2">
                <Inbox className="w-5 h-5 text-[#d4af37]" />
                Pending Join Requests <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: "rgba(212,175,55,0.15)", color: "#d4af37" }}>{pendingRequests.length}</span>
              </h3>
              {pendingRequests.map((req: any) => (
                <div key={req.id} className="flex items-center justify-between py-3 border-b border-white/5 last:border-0">
                  <span className="text-sm text-gray-300">{req.userId}</span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleAction(req.id, "accepted")}
                      disabled={actionLoading[req.id]}
                      className="text-xs font-bold px-3 py-1.5 rounded-lg bg-green-500/15 text-green-400 border border-green-500/20 hover:bg-green-500/25 transition-all"
                    >
                      Accept
                    </button>
                    <button
                      onClick={() => handleAction(req.id, "declined")}
                      disabled={actionLoading[req.id]}
                      className="text-xs font-bold px-3 py-1.5 rounded-lg bg-red-500/15 text-red-400 border border-red-500/20 hover:bg-red-500/25 transition-all"
                    >
                      Decline
                    </button>
                  </div>
                </div>
              ))}
            </GoldCard>
            )}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
