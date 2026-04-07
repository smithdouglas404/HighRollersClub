import { useState, useRef } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { DashboardLayout } from "@/components/DashboardLayout";
import { PageBackground } from "@/components/shared/PageBackground";
import { useClub } from "@/lib/club-context";
import { useToast } from "@/hooks/use-toast";
import {
  Upload, Shield, Crown, CheckCircle, Zap, Check,
} from "lucide-react";

/* -- Logo options ---------------------------------------------------------- */

const LOGO_OPTIONS = [
  { id: "lions", label: "Lions", url: "/clubs/club_lions.webp" },
  { id: "sharks", label: "Sharks", url: "/clubs/club_sharks.webp" },
  { id: "eagles", label: "Eagles", url: "/clubs/club_eagles.webp" },
  { id: "dragons", label: "Dragons", url: "/clubs/club_dragons.webp" },
  { id: "wolves", label: "Wolves", url: "/clubs/club_wolves.webp" },
  { id: "aces", label: "Aces", url: "/clubs/club_aces.webp" },
];

const COLOR_SWATCHES = [
  { id: "gold", label: "Gold", hex: "#d4af37" },
  { id: "teal", label: "Teal", hex: "#2dd4bf" },
  { id: "crimson", label: "Crimson", hex: "#dc2626" },
];

/* -- Main component -------------------------------------------------------- */

export default function ClubCreate() {
  const [, navigate] = useLocation();
  const { createClub, updateClub, reload, switchClub } = useClub();
  const { toast } = useToast();

  const [submitting, setSubmitting] = useState(false);
  const [createSuccess, setCreateSuccess] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

  // Section 1 - Club Identity
  const [clubName, setClubName] = useState("");
  const [clubTag, setClubTag] = useState("");

  // Section 2 - Branding
  const [selectedLogo, setSelectedLogo] = useState<string | null>(null);
  const [themeColor, setThemeColor] = useState("gold");

  // Section 3 - Membership Settings
  const [visibility, setVisibility] = useState<"public" | "semi-private" | "private">("private");
  const [requireApproval, setRequireApproval] = useState(true);

  // Section 4 - Initial Financials
  const [creditLimit, setCreditLimit] = useState(10000);

  /* -- Submit -------------------------------------------------------------- */

  const handleSubmit = async () => {
    if (submitting || !clubName.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/clubs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: clubName.trim(),
          tag: clubTag.trim() || undefined,
          isPublic: visibility !== "private",
          maxMembers: 50,
          chipBuyIn: 1000,
          creditLimit,
          logo: selectedLogo,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({ message: "Failed to create club" }));
        throw new Error(data.message);
      }
      const newClub = await res.json();

      if (selectedLogo) {
        const logoOption = LOGO_OPTIONS.find((l) => l.id === selectedLogo);
        if (logoOption) {
          await fetch(`/api/clubs/${newClub.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ avatarUrl: logoOption.url }),
          });
        }
      }

      toast({ title: "Club created!", description: `"${newClub.name}" is ready to go.` });
      await reload();
      switchClub(newClub.id);
      setCreateSuccess(true);
      setTimeout(() => navigate("/club"), 1000);
    } catch (err: any) {
      toast({
        title: "Failed to create club",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  /* -- Render -------------------------------------------------------------- */

  return (
    <DashboardLayout title="Create Club">
      <PageBackground image="/images/generated/club-setup-bg.png" />
      <div className="relative z-10 px-4 sm:px-8 pb-8">
        <div className="max-w-4xl mx-auto">

          {/* Title with crest */}
          <div className="text-center mb-8">
            <div className="flex justify-center mb-3">
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center"
                style={{
                  background: "linear-gradient(135deg, rgba(212,175,55,0.2), rgba(154,123,44,0.1))",
                  border: "2px solid rgba(212,175,55,0.4)",
                  boxShadow: "0 0 30px rgba(212,175,55,0.15)",
                }}
              >
                <Crown className="w-8 h-8 text-[#d4af37]" />
              </div>
            </div>
            <h1
              className="text-2xl sm:text-3xl font-black uppercase tracking-[0.2em] gold-text"
            >
              Initial Club Setup
            </h1>
          </div>

          {/* 2-column grid with 4 sections */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-6">

            {/* Section 1: Club Identity (top-left) */}
            <div className="vault-card p-5">
              <h2 className="text-xs font-black uppercase tracking-[0.15em] gold-text mb-5 flex items-center gap-2">
                <span
                  className="w-6 h-6 rounded-full flex items-center justify-center text-[0.625rem] font-black text-black shrink-0"
                  style={{ background: "linear-gradient(135deg, #d4af37, #f3e2ad)" }}
                >
                  1
                </span>
                Club Identity
              </h2>

              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[0.625rem] font-bold uppercase tracking-wider text-gray-400">
                    Club Name
                  </label>
                  <input
                    type="text"
                    value={clubName}
                    onChange={(e) => setClubName(e.target.value)}
                    placeholder="High Rollers Club"
                    maxLength={50}
                    className="w-full px-4 py-2.5 rounded-lg text-sm text-white placeholder-gray-600 outline-none transition-all focus:ring-1 focus:ring-[#d4af37]/40 gold-border"
                    style={{ background: "rgba(255,255,255,0.04)" }}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[0.625rem] font-bold uppercase tracking-wider text-gray-400">
                    Club Tag
                  </label>
                  <input
                    type="text"
                    value={clubTag}
                    onChange={(e) => setClubTag(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6))}
                    maxLength={6}
                    placeholder="2-6 characters, e.g. HRC"
                    className="w-full px-4 py-2.5 rounded-lg text-sm text-white placeholder-gray-600 outline-none transition-all focus:ring-1 focus:ring-[#d4af37]/40 font-mono tracking-widest gold-border"
                    style={{ background: "rgba(255,255,255,0.04)" }}
                  />
                </div>
              </div>
            </div>

            {/* Section 3: Membership Settings (top-right) */}
            <div className="vault-card p-5">
              <h2 className="text-xs font-black uppercase tracking-[0.15em] gold-text mb-5 flex items-center gap-2">
                <span
                  className="w-6 h-6 rounded-full flex items-center justify-center text-[0.625rem] font-black text-black shrink-0"
                  style={{ background: "linear-gradient(135deg, #d4af37, #f3e2ad)" }}
                >
                  3
                </span>
                Membership Settings
              </h2>

              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[0.625rem] font-bold uppercase tracking-wider text-gray-400">
                    Club Type
                  </label>
                  <select
                    value={visibility}
                    onChange={(e) => setVisibility(e.target.value as any)}
                    className="w-full px-4 py-2.5 rounded-lg text-sm text-white outline-none transition-all focus:ring-1 focus:ring-[#d4af37]/40 gold-border appearance-none cursor-pointer"
                    style={{ background: "rgba(255,255,255,0.04)" }}
                  >
                    <option value="private" style={{ background: "#1a1a2e" }}>Private</option>
                    <option value="semi-private" style={{ background: "#1a1a2e" }}>Semi-Private</option>
                    <option value="public" style={{ background: "#1a1a2e" }}>Public</option>
                  </select>
                </div>

                <div
                  className="rounded-lg p-4 flex items-center justify-between gold-border"
                  style={{ background: "rgba(255,255,255,0.02)" }}
                >
                  <span className="text-xs font-semibold text-gray-300">
                    Admin Approval Required for New Members
                  </span>
                  <button
                    onClick={() => setRequireApproval(!requireApproval)}
                    className="relative w-12 h-6 rounded-full transition-colors shrink-0 cursor-pointer"
                    style={{
                      background: requireApproval
                        ? "linear-gradient(135deg, #d4af37, #f3e2ad)"
                        : "rgba(255,255,255,0.1)",
                    }}
                  >
                    <motion.div
                      layout
                      className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-md"
                      style={{ left: requireApproval ? "calc(100% - 22px)" : "2px" }}
                      transition={{ type: "spring", stiffness: 500, damping: 30 }}
                    />
                  </button>
                </div>
              </div>
            </div>

            {/* Section 2: Branding (bottom-left) */}
            <div className="vault-card p-5">
              <h2 className="text-xs font-black uppercase tracking-[0.15em] gold-text mb-5 flex items-center gap-2">
                <span
                  className="w-6 h-6 rounded-full flex items-center justify-center text-[0.625rem] font-black text-black shrink-0"
                  style={{ background: "linear-gradient(135deg, #d4af37, #f3e2ad)" }}
                >
                  2
                </span>
                Branding
              </h2>

              <div className="flex items-start gap-6">
                {/* Circular logo upload area */}
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) setLogoPreview(URL.createObjectURL(f));
                  }}
                />
                <div
                  className="w-24 h-24 rounded-full flex flex-col items-center justify-center cursor-pointer group shrink-0 overflow-hidden transition-all hover:border-[#d4af37]/60"
                  style={{
                    background: logoPreview ? "transparent" : "linear-gradient(135deg, rgba(212,175,55,0.12), rgba(154,123,44,0.06))",
                    border: "2px dashed rgba(212,175,55,0.35)",
                  }}
                  onClick={() => fileRef.current?.click()}
                >
                  {logoPreview ? (
                    <img src={logoPreview} alt="Logo preview" className="w-full h-full object-cover" />
                  ) : (
                    <>
                      <Crown className="w-6 h-6 text-[#d4af37]/60 group-hover:text-[#d4af37] transition-colors mb-1" />
                      <span className="text-[0.5rem] text-[#d4af37]/60 group-hover:text-[#d4af37] uppercase font-bold tracking-wider text-center leading-tight transition-colors">
                        Upload<br />Club Logo
                      </span>
                    </>
                  )}
                </div>

                {/* Color Picker swatches */}
                <div className="space-y-2">
                  <label className="text-[0.625rem] font-bold uppercase tracking-wider text-gray-400">
                    Color Picker
                  </label>
                  <div className="flex items-center gap-3">
                    {COLOR_SWATCHES.map((color) => {
                      const isSelected = themeColor === color.id;
                      return (
                        <motion.button
                          key={color.id}
                          whileHover={{ scale: 1.15 }}
                          whileTap={{ scale: 0.9 }}
                          onClick={() => setThemeColor(color.id)}
                          className="relative w-10 h-10 rounded-lg cursor-pointer transition-all"
                          style={{
                            background: color.hex,
                            boxShadow: isSelected
                              ? `0 0 16px ${color.hex}80, 0 0 4px ${color.hex}60`
                              : "none",
                            border: isSelected
                              ? `3px solid white`
                              : "3px solid transparent",
                          }}
                          title={color.label}
                        >
                          {isSelected && (
                            <motion.div
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              className="absolute inset-0 flex items-center justify-center"
                            >
                              <Check className="w-5 h-5 text-white drop-shadow-md" />
                            </motion.div>
                          )}
                        </motion.button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            {/* Section 4: Initial Financials (bottom-right) */}
            <div className="vault-card p-5">
              <h2 className="text-xs font-black uppercase tracking-[0.15em] gold-text mb-5 flex items-center gap-2">
                <span
                  className="w-6 h-6 rounded-full flex items-center justify-center text-[0.625rem] font-black text-black shrink-0"
                  style={{ background: "linear-gradient(135deg, #d4af37, #f3e2ad)" }}
                >
                  4
                </span>
                Initial Financials
              </h2>

              <div className="space-y-1.5">
                <label className="text-[0.625rem] font-bold uppercase tracking-wider text-gray-400 flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5" />
                  Default Player Credit Limit
                </label>
                <input
                  type="number"
                  value={creditLimit}
                  onChange={(e) => setCreditLimit(Math.max(0, parseInt(e.target.value) || 0))}
                  min={0}
                  placeholder="e.g. $10,000"
                  className="w-full px-4 py-2.5 rounded-lg text-sm text-white placeholder-gray-600 outline-none transition-all focus:ring-1 focus:ring-[#d4af37]/40 gold-border"
                  style={{ background: "rgba(255,255,255,0.04)" }}
                />
              </div>
            </div>
          </div>

          {/* Full-width CREATE CLUB button */}
          <motion.button
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            onClick={handleSubmit}
            disabled={submitting || !clubName.trim()}
            className="w-full py-4 rounded-xl text-base font-black uppercase tracking-[0.2em] text-black flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer gold-btn"
            style={{
              boxShadow: "0 0 40px rgba(212,175,55,0.3), 0 4px 15px rgba(0,0,0,0.3)",
              fontSize: "1.1rem",
            }}
          >
            {submitting ? (
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                className="w-5 h-5 border-2 border-black/30 border-t-black rounded-full"
              />
            ) : (
              "Create Club"
            )}
          </motion.button>
        </div>
      </div>

      {/* Success overlay */}
      <AnimatePresence>
        {createSuccess && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          >
            <div className="text-center">
              <div className="w-16 h-16 mx-auto rounded-full bg-secondary/20 border border-secondary/30 flex items-center justify-center mb-3">
                <CheckCircle className="w-8 h-8 text-secondary" />
              </div>
              <p className="text-lg font-bold text-secondary">Club Created Successfully!</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </DashboardLayout>
  );
}
