import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useAuth } from "@/lib/auth-context";
import { useClub } from "@/lib/club-context";
import { useToast } from "@/hooks/use-toast";
import { GoldButton, GoldCard, NumberTicker, StatCard, SectionHeader, GoldDivider } from "@/components/premium/PremiumComponents";
import {
  Settings, Save, Trash2, Shield, Globe, Lock,
  Users, Crown, Loader2, AlertTriangle, CheckCircle, X,
  Languages, DollarSign, ShieldCheck, Palette, Link2, Wallet,
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

  // S11: Timezone & Language
  const [timezone, setTimezone] = useState("UTC");
  const [language, setLanguage] = useState("en");

  // S12: Financial Defaults
  const [rakePercent, setRakePercent] = useState(2.5);
  const [maxBuyIn, setMaxBuyIn] = useState(1000);
  const [defaultCreditLimit, setDefaultCreditLimit] = useState(500);

  // S13: Security
  const [require2FA, setRequire2FA] = useState(false);
  const [adminApproval, setAdminApproval] = useState(false);
  const [antiCollusion, setAntiCollusion] = useState(true);

  // S14: Branding
  const [themeColor, setThemeColor] = useState("gold");
  const THEME_COLORS = [
    { id: "gold", label: "Gold", color: "#d4af37" },
    { id: "gold", label: "Gold", color: "#f59e0b" },
    { id: "purple", label: "Purple", color: "#a855f7" },
    { id: "green", label: "Green", color: "#22c55e" },
    { id: "red", label: "Red", color: "#ef4444" },
    { id: "blue", label: "Blue", color: "#3b82f6" },
  ];

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
    const ok = await updateClub({
      name, description, isPublic,
      timezone, language,
      rakePercent, maxBuyInCap: maxBuyIn, creditLimit: defaultCreditLimit,
      require2fa: require2FA, adminApprovalRequired: adminApproval,
      antiCollusion, themeColor,
    });
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
      <div className="px-4 md:px-8 pb-8">
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
              className="vault-card overflow-hidden"
            >
              <div
                className="flex items-center gap-3 px-5 py-4 border-b border-b-[#d4af37]/10"
              >
                <div className="w-9 h-9 rounded-lg bg-[#d4af37]/15 border border-[#d4af37]/20 flex items-center justify-center">
                  <Settings className="w-5 h-5 text-[#d4af37]" />
                </div>
                <div>
                  <h3 className="text-sm font-bold gold-text tracking-wider uppercase">
                    General Settings
                  </h3>
                  <p className="text-[0.5625rem] text-gray-500">Edit your club details</p>
                </div>
              </div>

              <div className="p-5 space-y-5">
                {/* Club Name */}
                <div className="space-y-1.5">
                  <label htmlFor="settings-club-name" className="text-[0.625rem] font-bold uppercase tracking-wider text-gray-400">
                    Club Name<span className="text-destructive ml-0.5">*</span>
                  </label>
                  <input
                    id="settings-club-name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    minLength={2}
                    maxLength={50}
                    className="w-full px-4 py-2.5 rounded-lg text-sm text-white placeholder-gray-600 outline-none transition-all focus:ring-1 focus:ring-[#d4af37]/50 focus:border-[#d4af37]/40 bg-[#1a1610]/50 gold-border"
                    placeholder="Enter club name..."
                  />
                </div>

                {/* Description */}
                <div className="space-y-1.5">
                  <label htmlFor="settings-club-description" className="text-[0.625rem] font-bold uppercase tracking-wider text-gray-400">
                    Description
                  </label>
                  <textarea
                    id="settings-club-description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    maxLength={300}
                    rows={3}
                    className="w-full px-4 py-2.5 rounded-lg text-sm text-white placeholder-gray-600 outline-none resize-none transition-all focus:ring-1 focus:ring-[#d4af37]/50 focus:border-[#d4af37]/40 bg-[#1a1610]/50 gold-border"
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
                <GoldButton
                  onClick={handleSave}
                  disabled={saving || !name.trim()}
                  className="w-full"
                >
                  {saving ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  Save Changes
                </GoldButton>
              </div>
            </motion.div>

            {/* S11: Timezone & Language */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
              className="vault-card overflow-hidden"
            >
              <div className="flex items-center gap-3 px-5 py-4 border-b border-b-[#d4af37]/10">
                <div className="w-9 h-9 rounded-lg bg-[#d4af37]/15 border border-[#d4af37]/20 flex items-center justify-center">
                  <Languages className="w-5 h-5 text-[#d4af37]" />
                </div>
                <div>
                  <h3 className="text-sm font-bold gold-text tracking-wider uppercase">
                    Timezone & Language
                  </h3>
                  <p className="text-[0.5625rem] text-gray-500">Regional preferences for your club</p>
                </div>
              </div>

              <div className="p-5 space-y-5">
                <div className="space-y-1.5">
                  <label htmlFor="settings-timezone" className="text-[0.625rem] font-bold uppercase tracking-wider text-gray-400">
                    Timezone
                  </label>
                  <select
                    id="settings-timezone"
                    value={timezone}
                    onChange={(e) => setTimezone(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-lg text-sm text-white outline-none transition-all focus:ring-1 focus:ring-primary/40 appearance-none cursor-pointer bg-[#1a1610]/50 border border-white/[0.06]"
                  >
                    <option value="UTC" className="bg-surface-lowest">UTC (Coordinated Universal Time)</option>
                    <option value="America/New_York" className="bg-surface-lowest">EST (Eastern Standard Time)</option>
                    <option value="America/Chicago" className="bg-surface-lowest">CST (Central Standard Time)</option>
                    <option value="America/Denver" className="bg-surface-lowest">MST (Mountain Standard Time)</option>
                    <option value="America/Los_Angeles" className="bg-surface-lowest">PST (Pacific Standard Time)</option>
                    <option value="Europe/London" className="bg-surface-lowest">GMT (Greenwich Mean Time)</option>
                    <option value="Europe/Berlin" className="bg-surface-lowest">CET (Central European Time)</option>
                    <option value="Asia/Tokyo" className="bg-surface-lowest">JST (Japan Standard Time)</option>
                    <option value="Asia/Shanghai" className="bg-surface-lowest">CST (China Standard Time)</option>
                    <option value="America/Sao_Paulo" className="bg-surface-lowest">BRT (Brasilia Time)</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="settings-language" className="text-[0.625rem] font-bold uppercase tracking-wider text-gray-400">
                    Language
                  </label>
                  <select
                    id="settings-language"
                    value={language}
                    onChange={(e) => setLanguage(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-lg text-sm text-white outline-none transition-all focus:ring-1 focus:ring-primary/40 appearance-none cursor-pointer bg-[#1a1610]/50 border border-white/[0.06]"
                  >
                    <option value="en" className="bg-surface-lowest">English</option>
                    <option value="es" className="bg-surface-lowest">Spanish</option>
                    <option value="pt" className="bg-surface-lowest">Portuguese</option>
                    <option value="zh" className="bg-surface-lowest">Chinese</option>
                  </select>
                </div>
              </div>
            </motion.div>

            {/* S12: Financial Defaults */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.08 }}
              className="vault-card overflow-hidden"
            >
              <div className="flex items-center gap-3 px-5 py-4 border-b border-b-[#d4af37]/10">
                <div className="w-9 h-9 rounded-lg bg-[#d4af37]/15 border border-[#d4af37]/20 flex items-center justify-center">
                  <DollarSign className="w-5 h-5 text-[#d4af37]" />
                </div>
                <div>
                  <h3 className="text-sm font-bold gold-text tracking-wider uppercase">
                    Financial Defaults
                  </h3>
                  <p className="text-[0.5625rem] text-gray-500">Default financial settings for tables</p>
                </div>
              </div>

              <div className="p-5 space-y-5">
                <div className="space-y-1.5">
                  <label htmlFor="settings-rake" className="text-[0.625rem] font-bold uppercase tracking-wider text-gray-400">
                    Rake Percentage
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      id="settings-rake"
                      type="range"
                      min={0}
                      max={10}
                      step={0.5}
                      value={rakePercent}
                      onChange={(e) => setRakePercent(parseFloat(e.target.value))}
                      className="flex-1 accent-[hsl(var(--primary))]"
                    />
                    <span className="text-sm font-semibold text-white w-14 text-right">{rakePercent}%</span>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="settings-max-buyin" className="text-[0.625rem] font-bold uppercase tracking-wider text-gray-400">
                    Max Buy-In Cap
                  </label>
                  <input
                    id="settings-max-buyin"
                    type="number"
                    min={0}
                    value={maxBuyIn}
                    onChange={(e) => setMaxBuyIn(Number(e.target.value))}
                    className="w-full px-4 py-2.5 rounded-lg text-sm text-white placeholder-gray-600 outline-none transition-all focus:ring-1 focus:ring-[#d4af37]/50 focus:border-[#d4af37]/40 bg-[#1a1610]/50 gold-border"
                    placeholder="1000"
                  />
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="settings-credit-limit" className="text-[0.625rem] font-bold uppercase tracking-wider text-gray-400">
                    Default Credit Limit
                  </label>
                  <input
                    id="settings-credit-limit"
                    type="number"
                    min={0}
                    value={defaultCreditLimit}
                    onChange={(e) => setDefaultCreditLimit(Number(e.target.value))}
                    className="w-full px-4 py-2.5 rounded-lg text-sm text-white placeholder-gray-600 outline-none transition-all focus:ring-1 focus:ring-[#d4af37]/50 focus:border-[#d4af37]/40 bg-[#1a1610]/50 gold-border"
                    placeholder="500"
                  />
                </div>
              </div>
            </motion.div>

            {/* S13: Security */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="vault-card overflow-hidden"
            >
              <div className="flex items-center gap-3 px-5 py-4 border-b border-b-[#d4af37]/10">
                <div className="w-9 h-9 rounded-lg bg-[#d4af37]/15 border border-[#d4af37]/20 flex items-center justify-center">
                  <ShieldCheck className="w-5 h-5 text-[#d4af37]" />
                </div>
                <div>
                  <h3 className="text-sm font-bold gold-text tracking-wider uppercase">
                    Security
                  </h3>
                  <p className="text-[0.5625rem] text-gray-500">Club-wide security policies</p>
                </div>
              </div>

              <div className="p-5 space-y-4">
                {/* 2FA toggle */}
                <div className="flex items-center justify-between py-2">
                  <div className="flex items-center gap-3">
                    <Shield className="w-4 h-4 text-primary" />
                    <div>
                      <div className="text-xs font-semibold text-white">Require 2FA</div>
                      <div className="text-[0.5625rem] text-gray-500">Require two-factor authentication for all members</div>
                    </div>
                  </div>
                  <button
                    onClick={() => setRequire2FA(!require2FA)}
                    className={`relative w-11 h-6 rounded-full transition-colors ${require2FA ? "bg-primary" : "bg-white/10"}`}
                  >
                    <motion.div
                      layout
                      className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-md"
                      style={{ left: require2FA ? "calc(100% - 22px)" : "2px" }}
                      transition={{ type: "spring", stiffness: 500, damping: 30 }}
                    />
                  </button>
                </div>

                {/* Admin approval toggle */}
                <div className="flex items-center justify-between py-2 border-t border-t-white/[0.04]">
                  <div className="flex items-center gap-3">
                    <Users className="w-4 h-4 text-primary" />
                    <div>
                      <div className="text-xs font-semibold text-white">Admin Approval</div>
                      <div className="text-[0.5625rem] text-gray-500">Require admin approval for new members</div>
                    </div>
                  </div>
                  <button
                    onClick={() => setAdminApproval(!adminApproval)}
                    className={`relative w-11 h-6 rounded-full transition-colors ${adminApproval ? "bg-primary" : "bg-white/10"}`}
                  >
                    <motion.div
                      layout
                      className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-md"
                      style={{ left: adminApproval ? "calc(100% - 22px)" : "2px" }}
                      transition={{ type: "spring", stiffness: 500, damping: 30 }}
                    />
                  </button>
                </div>

                {/* Anti-collusion toggle */}
                <div className="flex items-center justify-between py-2 border-t border-t-white/[0.04]">
                  <div className="flex items-center gap-3">
                    <AlertTriangle className="w-4 h-4 text-primary" />
                    <div>
                      <div className="text-xs font-semibold text-white">Anti-Collusion Detection</div>
                      <div className="text-[0.5625rem] text-gray-500">Automatically detect suspicious play patterns</div>
                    </div>
                  </div>
                  <button
                    onClick={() => setAntiCollusion(!antiCollusion)}
                    className={`relative w-11 h-6 rounded-full transition-colors ${antiCollusion ? "bg-primary" : "bg-white/10"}`}
                  >
                    <motion.div
                      layout
                      className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-md"
                      style={{ left: antiCollusion ? "calc(100% - 22px)" : "2px" }}
                      transition={{ type: "spring", stiffness: 500, damping: 30 }}
                    />
                  </button>
                </div>
              </div>
            </motion.div>

            {/* S14: Branding */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.12 }}
              className="vault-card overflow-hidden"
            >
              <div className="flex items-center gap-3 px-5 py-4 border-b border-b-[#d4af37]/10">
                <div className="w-9 h-9 rounded-lg bg-[#d4af37]/15 border border-[#d4af37]/20 flex items-center justify-center">
                  <Palette className="w-5 h-5 text-[#d4af37]" />
                </div>
                <div>
                  <h3 className="text-sm font-bold gold-text tracking-wider uppercase">
                    Branding
                  </h3>
                  <p className="text-[0.5625rem] text-gray-500">Customize your club's visual identity</p>
                </div>
              </div>

              <div className="p-5 space-y-4">
                <div className="space-y-2">
                  <label id="settings-theme-color-label" className="text-[0.625rem] font-bold uppercase tracking-wider text-gray-400">
                    Theme Color
                  </label>
                  <div className="flex items-center gap-3">
                    {THEME_COLORS.map((tc) => {
                      const isSelected = themeColor === tc.id;
                      return (
                        <button
                          key={tc.id}
                          onClick={() => setThemeColor(tc.id)}
                          className="relative group flex flex-col items-center gap-1.5"
                          title={tc.label}
                        >
                          <div
                            className="w-9 h-9 rounded-full transition-all"
                            style={{
                              background: tc.color,
                              boxShadow: isSelected ? `0 0 16px ${tc.color}60` : "none",
                              border: isSelected ? "3px solid white" : "3px solid transparent",
                              transform: isSelected ? "scale(1.15)" : "scale(1)",
                            }}
                          />
                          <span className={`text-[0.5rem] font-bold uppercase tracking-wider ${isSelected ? "text-white" : "text-gray-600"}`}>
                            {tc.label}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div
                  className="rounded-lg p-3 flex items-center gap-3"
                  style={{
                    background: `${THEME_COLORS.find(c => c.id === themeColor)?.color ?? '#d4af37'}10`,
                    border: `1px solid ${THEME_COLORS.find(c => c.id === themeColor)?.color ?? '#d4af37'}30`,
                  }}
                >
                  <div
                    className="w-4 h-4 rounded-full shrink-0"
                    style={{ background: THEME_COLORS.find(c => c.id === themeColor)?.color ?? '#d4af37' }}
                  />
                  <span className="text-[0.625rem] text-gray-400">
                    Preview: Club elements will use the <strong className="text-white">{THEME_COLORS.find(c => c.id === themeColor)?.label}</strong> theme
                  </span>
                </div>
              </div>
            </motion.div>

            {/* S15: Integration & API */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="vault-card overflow-hidden"
            >
              <div className="flex items-center gap-3 px-5 py-4 border-b border-b-[#d4af37]/10">
                <div className="w-9 h-9 rounded-lg bg-[#d4af37]/15 border border-[#d4af37]/20 flex items-center justify-center">
                  <Link2 className="w-5 h-5 text-[#d4af37]" />
                </div>
                <div>
                  <h3 className="text-sm font-bold gold-text tracking-wider uppercase">
                    Integration & API
                  </h3>
                  <p className="text-[0.5625rem] text-gray-500">External wallet and API connections</p>
                </div>
              </div>

              <div className="p-5 space-y-4">
                <div className="flex items-center justify-between p-3 rounded-lg bg-white/[0.02] border border-white/[0.06]">
                  <div className="flex items-center gap-3">
                    <Wallet className="w-5 h-5 text-primary" />
                    <div>
                      <div className="text-xs font-semibold text-white">External Wallet</div>
                      <div className="text-[0.5625rem] text-gray-500">Connect an external crypto wallet for payouts</div>
                    </div>
                  </div>
                  <button className="px-3 py-1.5 rounded-lg text-[0.625rem] font-bold uppercase tracking-wider bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-colors">
                    Connect
                  </button>
                </div>

                <div className="flex items-center justify-between p-3 rounded-lg bg-white/[0.02] border border-white/[0.06]">
                  <div className="flex items-center gap-3">
                    <Shield className="w-5 h-5 text-amber-400" />
                    <div>
                      <div className="text-xs font-semibold text-white">API Access</div>
                      <div className="text-[0.5625rem] text-gray-500">Generate API keys for third-party integrations</div>
                    </div>
                  </div>
                  <button className="px-3 py-1.5 rounded-lg text-[0.625rem] font-bold uppercase tracking-wider bg-white/[0.04] text-gray-400 border border-white/[0.06] hover:bg-white/[0.08] transition-colors">
                    Generate Key
                  </button>
                </div>

                <p className="text-[0.5625rem] text-gray-600 leading-relaxed">
                  API keys grant full access to club management endpoints. Keep them secure and rotate regularly.
                </p>
              </div>
            </motion.div>

            {/* Ownership Transfer Section (Owner only) */}
            {isOwner && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="vault-card overflow-hidden"
              >
                <div
                  className="flex items-center gap-3 px-5 py-4 border-b border-b-[#d4af37]/10"
                >
                  <div className="w-9 h-9 rounded-lg bg-[#d4af37]/15 border border-[#d4af37]/20 flex items-center justify-center">
                    <Crown className="w-5 h-5 text-[#d4af37]" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold gold-text tracking-wider uppercase">
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
                    <label htmlFor="settings-new-owner" className="text-[0.625rem] font-bold uppercase tracking-wider text-gray-400">
                      New Owner
                    </label>
                    <select
                      id="settings-new-owner"
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
                className="vault-card overflow-hidden !border-red-500/20"
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
