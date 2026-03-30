import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useAuth } from "@/lib/auth-context";
import { useClub } from "@/lib/club-context";
import { useToast } from "@/hooks/use-toast";
import {
  Settings, Save, Trash2, Shield, Globe, Lock,
  Users, Crown, Loader2, AlertTriangle, CheckCircle, X,
} from "lucide-react";

export default function ClubSettings() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const {
    club, members, loading, updateClub, deleteClub,
  } = useClub();
  const { toast } = useToast();

  // Form state — initialized from context
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [transferTarget, setTransferTarget] = useState("");

  // Local UI state
  const [saving, setSaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");

  // Sync form when club data arrives
  useEffect(() => {
    if (club) {
      setName(club.name);
      setDescription(club.description || "");
      setIsPublic(club.isPublic);
    }
  }, [club]);

  const handleSave = async () => {
    if (saving || !name.trim()) return;
    setSaving(true);
    const ok = await updateClub({ name, description, isPublic });
    if (ok) {
      setSuccessMsg("Club settings saved successfully.");
      setTimeout(() => setSuccessMsg(""), 3000);
    }
    setSaving(false);
  };

  const handleTransferOwnership = async () => {
    if (!club || !transferTarget || saving) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/clubs/${club.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ownerId: transferTarget }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Failed to transfer ownership");
      }
      setSuccessMsg("Ownership transferred. Redirecting...");
      setTimeout(() => navigate("/club"), 2000);
    } catch (err: any) {
      setSuccessMsg("");
      toast({ title: "Transfer failed", description: err.message || "Failed to transfer ownership", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (deleting) return;
    setDeleting(true);
    const ok = await deleteClub();
    if (ok) {
      setTimeout(() => navigate("/lobby"), 1500);
    } else {
      setShowDeleteConfirm(false);
    }
    setDeleting(false);
  };

  const isOwner = club && user && club.ownerId === user.id;
  const otherMembers = members.filter((m) => m.userId !== user?.id);

  return (
    <DashboardLayout title="Club Settings">
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
            {/* Feedback banners */}
            <AnimatePresence>
              {successMsg && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="flex items-center gap-3 px-4 py-3 rounded-xl bg-primary/[0.08] border border-primary/20"
                >
                  <CheckCircle className="w-4 h-4 text-green-400 shrink-0" />
                  <span className="text-xs text-green-300">{successMsg}</span>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Club Info Section */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-xl overflow-hidden bg-surface-high/50 backdrop-blur-xl border border-primary/15"
            >
              <div
                className="flex items-center gap-3 px-5 py-4 border-b border-b-white/[0.06]"
              >
                <div className="w-9 h-9 rounded-lg bg-primary/15 border border-primary/20 flex items-center justify-center">
                  <Settings className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white tracking-wider uppercase">
                    General Settings
                  </h3>
                  <p className="text-[0.5625rem] text-gray-500">Edit your club details</p>
                </div>
              </div>

              <div className="p-5 space-y-5">
                {/* Club Name */}
                <div className="space-y-1.5">
                  <label className="text-[0.625rem] font-bold uppercase tracking-wider text-gray-400">
                    Club Name
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    maxLength={50}
                    className="w-full px-4 py-2.5 rounded-lg text-sm text-white placeholder-gray-600 outline-none transition-all focus:ring-1 focus:ring-primary/40 bg-surface-highest/50 border border-white/[0.06]"
                    placeholder="Enter club name..."
                  />
                </div>

                {/* Description */}
                <div className="space-y-1.5">
                  <label className="text-[0.625rem] font-bold uppercase tracking-wider text-gray-400">
                    Description
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    maxLength={300}
                    rows={3}
                    className="w-full px-4 py-2.5 rounded-lg text-sm text-white placeholder-gray-600 outline-none resize-none transition-all focus:ring-1 focus:ring-primary/40 bg-surface-highest/50 border border-white/[0.06]"
                    placeholder="Describe your club..."
                  />
                  <div className="text-right text-[0.5625rem] text-gray-600">{description.length}/300</div>
                </div>

                {/* Public / Private Toggle — NOW WIRED TO SERVER */}
                <div className="flex items-center justify-between py-2">
                  <div className="flex items-center gap-3">
                    {isPublic ? (
                      <Globe className="w-4 h-4 text-green-400" />
                    ) : (
                      <Lock className="w-4 h-4 text-primary" />
                    )}
                    <div>
                      <div className="text-xs font-semibold text-white">
                        {isPublic ? "Public Club" : "Private Club"}
                      </div>
                      <div className="text-[0.5625rem] text-gray-500">
                        {isPublic
                          ? "Anyone can find and request to join"
                          : "Invite-only, hidden from search"}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => setIsPublic(!isPublic)}
                    className={`relative w-11 h-6 rounded-full transition-colors ${isPublic ? "bg-primary" : "bg-white/10"}`}
                  >
                    <motion.div
                      layout
                      className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-md"
                      style={{ left: isPublic ? "calc(100% - 22px)" : "2px" }}
                      transition={{ type: "spring", stiffness: 500, damping: 30 }}
                    />
                  </button>
                </div>

                {/* Save Button */}
                <motion.button
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                  onClick={handleSave}
                  disabled={saving || !name.trim()}
                  className="w-full py-3 rounded-lg text-xs font-bold uppercase tracking-wider bg-primary text-black flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  Save Changes
                </motion.button>
              </div>
            </motion.div>

            {/* Ownership Transfer Section (Owner only) */}
            {isOwner && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="rounded-xl overflow-hidden bg-surface-high/50 backdrop-blur-xl border border-amber-500/15"
              >
                <div
                  className="flex items-center gap-3 px-5 py-4 border-b border-b-white/[0.06]"
                >
                  <div className="w-9 h-9 rounded-lg bg-primary/15 border border-primary/20 flex items-center justify-center">
                    <Crown className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white tracking-wider uppercase">
                      Transfer Ownership
                    </h3>
                    <p className="text-[0.5625rem] text-gray-500">Hand the club over to another member</p>
                  </div>
                </div>

                <div className="p-5 space-y-4">
                  <div className="flex items-start gap-3 p-3 rounded-lg bg-amber-500/[0.04] border border-amber-500/15">
                    <AlertTriangle className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                    <p className="text-[0.625rem] text-gray-400 leading-relaxed">
                      Transferring ownership is permanent. You will be demoted to a regular member
                      and the new owner will have full control over the club.
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[0.625rem] font-bold uppercase tracking-wider text-gray-400">
                      New Owner
                    </label>
                    <select
                      value={transferTarget}
                      onChange={(e) => setTransferTarget(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-lg text-sm text-white outline-none transition-all focus:ring-1 focus:ring-primary/40 appearance-none cursor-pointer bg-white/[0.03] border border-white/[0.06]"
                    >
                      <option value="" className="bg-surface-lowest">
                        Select a member...
                      </option>
                      {otherMembers.map((m) => (
                        <option key={m.userId} value={m.userId} className="bg-surface-lowest">
                          {m.displayName} (@{m.username})
                        </option>
                      ))}
                    </select>
                  </div>

                  <motion.button
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.99 }}
                    onClick={handleTransferOwnership}
                    disabled={!transferTarget || saving}
                    className="w-full py-3 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 disabled:opacity-30 disabled:cursor-not-allowed text-primary transition-colors hover:text-primary bg-amber-500/[0.08] border border-amber-500/20"
                  >
                    <Shield className="w-4 h-4" />
                    Transfer Ownership
                  </motion.button>
                </div>
              </motion.div>
            )}

            {/* Danger Zone (Owner only) */}
            {isOwner && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="rounded-xl overflow-hidden bg-surface-high/50 backdrop-blur-xl border border-destructive/15"
              >
                <div
                  className="flex items-center gap-3 px-5 py-4 border-b border-b-white/[0.06]"
                >
                  <div className="w-9 h-9 rounded-lg bg-red-500/15 border border-red-500/20 flex items-center justify-center">
                    <Trash2 className="w-5 h-5 text-red-400" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white tracking-wider uppercase">
                      Danger Zone
                    </h3>
                    <p className="text-[0.5625rem] text-gray-500">Irreversible actions</p>
                  </div>
                </div>

                <div className="p-5">
                  <AnimatePresence mode="wait">
                    {!showDeleteConfirm ? (
                      <motion.button
                        key="delete-btn"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        whileHover={{ scale: 1.01 }}
                        whileTap={{ scale: 0.99 }}
                        onClick={() => setShowDeleteConfirm(true)}
                        className="w-full py-3 rounded-lg text-xs font-bold uppercase tracking-wider text-red-400 flex items-center justify-center gap-2 transition-colors hover:text-red-300 bg-destructive/[0.06] border border-destructive/15"
                      >
                        <Trash2 className="w-4 h-4" />
                        Delete Club
                      </motion.button>
                    ) : (
                      <motion.div
                        key="confirm-panel"
                        initial={{ opacity: 0, scale: 0.98 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.98 }}
                        className="space-y-3"
                      >
                        <div className="flex items-start gap-3 p-3 rounded-lg bg-destructive/[0.06] border border-destructive/15">
                          <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                          <div>
                            <div className="text-xs font-bold text-red-300">Are you sure?</div>
                            <p className="text-[0.625rem] text-gray-400 mt-1 leading-relaxed">
                              This will permanently delete <strong className="text-white">{club.name}</strong> and
                              remove all members. This action cannot be undone.
                            </p>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => setShowDeleteConfirm(false)}
                            className="flex-1 py-2.5 rounded-lg text-[0.625rem] font-bold uppercase tracking-wider text-gray-400 hover:text-white transition-colors bg-white/[0.03] border border-white/[0.06]"
                          >
                            Cancel
                          </button>
                          <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={handleDelete}
                            disabled={deleting}
                            className="flex-1 py-2.5 rounded-lg text-[0.625rem] font-bold uppercase tracking-wider bg-destructive text-white flex items-center justify-center gap-1.5 disabled:opacity-50"
                          >
                            {deleting ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <Trash2 className="w-3 h-3" />
                            )}
                            Confirm Delete
                          </motion.button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </motion.div>
            )}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
