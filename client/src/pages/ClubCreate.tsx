import { useState, useRef } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { DashboardLayout } from "@/components/DashboardLayout";
import { PageBackground } from "@/components/shared/PageBackground";
import { useClub } from "@/lib/club-context";
import { useToast } from "@/hooks/use-toast";
import {
  Users, Globe, Lock, Zap, Check, ArrowLeft, ArrowRight,
  Upload, Shield, Crown, CheckCircle, Eye,
} from "lucide-react";

/* ── Logo options ──────────────────────────────────────────────────────────── */

const LOGO_OPTIONS = [
  { id: "lions", label: "Lions", url: "/clubs/club_lions.webp" },
  { id: "sharks", label: "Sharks", url: "/clubs/club_sharks.webp" },
  { id: "eagles", label: "Eagles", url: "/clubs/club_eagles.webp" },
  { id: "dragons", label: "Dragons", url: "/clubs/club_dragons.webp" },
  { id: "wolves", label: "Wolves", url: "/clubs/club_wolves.webp" },
  { id: "aces", label: "Aces", url: "/clubs/club_aces.webp" },
];

const THEME_COLORS = [
  { id: "cyan", label: "Cyan", hex: "#81ecff" },
  { id: "gold", label: "Gold", hex: "#d4af37" },
  { id: "purple", label: "Purple", hex: "#a78bfa" },
  { id: "green", label: "Green", hex: "#3fff8b" },
  { id: "red", label: "Red", hex: "#ff7076" },
  { id: "blue", label: "Blue", hex: "#3b82f6" },
];

const MAX_MEMBER_OPTIONS = [10, 25, 50, 100, 200, 500];

const STEP_LABELS = ["Club Identity", "Configuration", "Privacy & Access", "Review & Create"];

/* ── Slide variants ────────────────────────────────────────────────────────── */

const slideVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? 300 : -300,
    opacity: 0,
  }),
  center: {
    x: 0,
    opacity: 1,
  },
  exit: (direction: number) => ({
    x: direction > 0 ? -300 : 300,
    opacity: 0,
  }),
};

/* ── Card wrapper style helper ─────────────────────────────────────────────── */

const inputStyle = {
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(212,175,55,0.15)",
};

/* ── Main component ────────────────────────────────────────────────────────── */

export default function ClubCreate() {
  const [, navigate] = useLocation();
  const { createClub, updateClub, reload, switchClub } = useClub();
  const { toast } = useToast();

  // Wizard state
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [createSuccess, setCreateSuccess] = useState(false);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Step 1 — Club Identity
  const [clubName, setClubName] = useState("");
  const [clubTag, setClubTag] = useState("");
  const [description, setDescription] = useState("");
  const [selectedLogo, setSelectedLogo] = useState<string | null>(null);
  const [themeColor, setThemeColor] = useState("cyan");

  // Step 2 — Configuration
  const [maxMembers, setMaxMembers] = useState(50);
  const [chipBuyIn, setChipBuyIn] = useState(1000);
  const [creditLimit, setCreditLimit] = useState(10000);

  // Step 3 — Privacy & Access
  const [visibility, setVisibility] = useState<"public" | "semi-private" | "private">("public");
  const [requireApproval, setRequireApproval] = useState(false);

  /* ── Navigation helpers ──────────────────────────────────────────────────── */

  const goNext = () => {
    if (step < 3) {
      setDirection(1);
      setStep(step + 1);
    }
  };

  const goPrev = () => {
    if (step > 0) {
      setDirection(-1);
      setStep(step - 1);
    }
  };

  const canProceed = () => {
    if (step === 0) return clubName.trim().length > 0;
    return true;
  };

  /* ── Submit ──────────────────────────────────────────────────────────────── */

  const handleSubmit = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/clubs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: clubName.trim(),
          tag: clubTag.trim() || undefined,
          description: description.trim() || undefined,
          isPublic: visibility !== "private",
          maxMembers,
          chipBuyIn,
          creditLimit,
          logo: selectedLogo,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({ message: "Failed to create club" }));
        throw new Error(data.message);
      }
      const newClub = await res.json();

      // If a logo was selected, update the club's avatarUrl
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

  /* ── Step indicator ──────────────────────────────────────────────────────── */

  const renderStepIndicator = () => (
    <>
    <div className="flex items-center justify-center gap-2 mb-8">
      {STEP_LABELS.map((label, i) => {
        const isCompleted = i < step;
        const isCurrent = i === step;
        return (
          <div key={i} className="flex items-center gap-2">
            {i > 0 && (
              <div
                className="w-8 h-px"
                style={{
                  background: isCompleted
                    ? "rgba(212,175,55,0.5)"
                    : "rgba(255,255,255,0.1)",
                }}
              />
            )}
            <div className="flex flex-col items-center gap-1.5">
              <motion.div
                animate={{
                  scale: isCurrent ? 1.1 : 1,
                  borderColor: isCompleted
                    ? "rgba(212,175,55,0.8)"
                    : isCurrent
                      ? "rgba(212,175,55,0.5)"
                      : "rgba(255,255,255,0.15)",
                  background: isCompleted
                    ? "rgba(212,175,55,0.15)"
                    : isCurrent
                      ? "rgba(212,175,55,0.08)"
                      : "rgba(255,255,255,0.03)",
                }}
                transition={{ duration: 0.3 }}
                className="w-9 h-9 rounded-full flex items-center justify-center border-2 shrink-0"
              >
                {isCompleted ? (
                  <Check className="w-4 h-4 text-[#d4af37]" />
                ) : (
                  <span
                    className={`text-xs font-bold ${
                      isCurrent ? "text-[#d4af37]" : "text-gray-500"
                    }`}
                  >
                    {i + 1}
                  </span>
                )}
              </motion.div>
              <span
                className={`text-[0.5625rem] font-medium tracking-wide hidden sm:block ${
                  isCurrent
                    ? "text-[#d4af37]"
                    : isCompleted
                      ? "text-[#d4af37]/70"
                      : "text-gray-600"
                }`}
              >
                {label}
              </span>
            </div>
          </div>
        );
      })}
    </div>
    <div className="sm:hidden text-center text-xs text-primary font-bold mt-2">{STEP_LABELS[step] || `Step ${step + 1}`}</div>
    </>
  );

  /* ── Step 1: Club Identity ───────────────────────────────────────────────── */

  const renderStep1 = () => (
    <div className="space-y-6">
      {/* Cover Image Upload Area */}
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) setCoverPreview(URL.createObjectURL(f));
        }}
      />
      <div
        className="relative rounded-xl overflow-hidden cursor-pointer group"
        style={{
          background: "rgba(255,255,255,0.03)",
          border: coverPreview ? "2px solid rgba(212,175,55,0.3)" : "2px dashed rgba(212,175,55,0.2)",
          height: "140px",
        }}
        onClick={() => fileRef.current?.click()}
      >
        {coverPreview ? (
          <img src={coverPreview} alt="Cover preview" className="w-full h-full object-cover" />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 group-hover:bg-white/[0.02] transition-colors">
            <Upload className="w-8 h-8 text-gray-500 group-hover:text-[#d4af37] transition-colors" />
            <span className="text-xs text-gray-500 group-hover:text-gray-400 transition-colors">
              Upload Cover Image (1920x480 recommended)
            </span>
          </div>
        )}
      </div>

      {/* Club Name */}
      <div className="space-y-1.5">
        <label htmlFor="club-name" className="text-[0.625rem] font-bold uppercase tracking-wider text-gray-400">
          Club Name<span className="text-destructive ml-0.5">*</span>
        </label>
        <input
          id="club-name"
          type="text"
          value={clubName}
          onChange={(e) => setClubName(e.target.value)}
          required
          minLength={2}
          maxLength={50}
          placeholder="Enter your club name..."
          className="w-full px-4 py-2.5 rounded-lg text-sm text-white placeholder-gray-600 outline-none transition-all focus:ring-1 focus:ring-[#d4af37]/40"
          style={inputStyle}
        />
      </div>

      {/* Club Tag */}
      <div className="space-y-1.5">
        <label htmlFor="club-tag" className="text-[0.625rem] font-bold uppercase tracking-wider text-gray-400">
          Club Tag
        </label>
        <input
          id="club-tag"
          type="text"
          value={clubTag}
          onChange={(e) => setClubTag(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6))}
          maxLength={6}
          placeholder="e.g. HRPC"
          className="w-full px-4 py-2.5 rounded-lg text-sm text-white placeholder-gray-600 outline-none transition-all focus:ring-1 focus:ring-[#d4af37]/40 font-mono tracking-widest"
          style={inputStyle}
        />
        <p className="text-[0.5625rem] text-gray-500">
          2-6 character identifier shown next to player names ({clubTag.length}/6)
        </p>
      </div>

      {/* Description */}
      <div className="space-y-1.5">
        <label htmlFor="club-description" className="text-[0.625rem] font-bold uppercase tracking-wider text-gray-400">
          Description
        </label>
        <textarea
          id="club-description"
          value={description}
          onChange={(e) => setDescription(e.target.value.slice(0, 300))}
          maxLength={300}
          rows={3}
          placeholder="Describe your club..."
          className="w-full px-4 py-2.5 rounded-lg text-sm text-white placeholder-gray-600 outline-none resize-none transition-all focus:ring-1 focus:ring-[#d4af37]/40"
          style={inputStyle}
        />
        <div className="text-right text-[0.5625rem] text-gray-600">
          {description.length}/300
        </div>
      </div>

      {/* Logo Picker */}
      <div className="space-y-2">
        <label id="club-logo-label" className="text-[0.625rem] font-bold uppercase tracking-wider text-gray-400">
          Club Logo
        </label>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
          {LOGO_OPTIONS.map((logo) => {
            const isSelected = selectedLogo === logo.id;
            return (
              <motion.button
                key={logo.id}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setSelectedLogo(isSelected ? null : logo.id)}
                className="relative rounded-xl overflow-hidden p-3 flex flex-col items-center gap-2 transition-all cursor-pointer hover:scale-105 transition-transform"
                style={{
                  background: isSelected
                    ? "rgba(212,175,55,0.12)"
                    : "rgba(255,255,255,0.03)",
                  border: isSelected
                    ? "2px solid rgba(212,175,55,0.6)"
                    : "2px solid rgba(255,255,255,0.08)",
                  boxShadow: isSelected
                    ? "0 0 24px rgba(212,175,55,0.2), inset 0 0 12px rgba(212,175,55,0.05)"
                    : "none",
                }}
              >
                {isSelected && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-primary flex items-center justify-center z-10"
                    style={{ boxShadow: "0 0 8px rgba(212,175,55,0.5)" }}
                  >
                    <Check className="w-3 h-3 text-black" />
                  </motion.div>
                )}
                <div
                  className={`rounded-lg overflow-hidden transition-all ${
                    isSelected ? "w-14 h-14 ring-2 ring-[#d4af37]/40" : "w-12 h-12"
                  }`}
                >
                  <img
                    src={logo.url}
                    alt={logo.label}
                    className="w-full h-full object-cover"
                  />
                </div>
                <span
                  className={`text-[0.625rem] font-semibold ${
                    isSelected ? "text-[#d4af37]" : "text-gray-400"
                  }`}
                >
                  {logo.label}
                </span>
              </motion.button>
            );
          })}
        </div>
        {selectedLogo && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-3 flex items-center gap-3 px-3 py-2 rounded-lg"
            style={{
              background: "rgba(212,175,55,0.06)",
              border: "1px solid rgba(212,175,55,0.15)",
            }}
          >
            <div className="w-8 h-8 rounded-md overflow-hidden ring-1 ring-[#d4af37]/30 shrink-0">
              <img
                src={LOGO_OPTIONS.find((l) => l.id === selectedLogo)?.url}
                alt="Selected logo"
                className="w-full h-full object-cover"
              />
            </div>
            <span className="text-[0.625rem] text-[#d4af37] font-semibold">
              {LOGO_OPTIONS.find((l) => l.id === selectedLogo)?.label} selected
            </span>
          </motion.div>
        )}
      </div>

      {/* Club Theme Color */}
      <div className="space-y-2">
        <label id="club-theme-color-label" className="text-[0.625rem] font-bold uppercase tracking-wider text-gray-400">
          Club Theme Color
        </label>
        <div className="flex items-center gap-3">
          {THEME_COLORS.map((color) => {
            const isSelected = themeColor === color.id;
            return (
              <motion.button
                key={color.id}
                whileHover={{ scale: 1.15 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => setThemeColor(color.id)}
                className="relative w-9 h-9 rounded-full cursor-pointer transition-all"
                style={{
                  background: color.hex,
                  boxShadow: isSelected
                    ? `0 0 16px ${color.hex}80, 0 0 4px ${color.hex}60`
                    : "none",
                  border: isSelected
                    ? `2px solid ${color.hex}`
                    : "2px solid transparent",
                }}
                title={color.label}
              >
                {isSelected && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="absolute inset-0 flex items-center justify-center"
                  >
                    <Check className="w-4 h-4 text-black drop-shadow-sm" />
                  </motion.div>
                )}
              </motion.button>
            );
          })}
        </div>
        <p className="text-[0.5625rem] text-gray-600">
          Accent color used throughout your club pages
        </p>
      </div>
    </div>
  );

  /* ── Step 2: Configuration ───────────────────────────────────────────────── */

  const renderStep2 = () => (
    <div className="space-y-6">
      {/* Max Members */}
      <div className="space-y-2">
        <label id="club-max-members-label" className="text-[0.625rem] font-bold uppercase tracking-wider text-gray-400 flex items-center gap-1.5">
          <Users className="w-3.5 h-3.5" />
          Max Members
        </label>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
          {MAX_MEMBER_OPTIONS.map((count) => {
            const isSelected = maxMembers === count;
            return (
              <motion.button
                key={count}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => setMaxMembers(count)}
                className="py-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer"
                style={{
                  background: isSelected
                    ? "linear-gradient(135deg, rgba(154,123,44,0.15), rgba(212,175,55,0.1))"
                    : "rgba(255,255,255,0.04)",
                  border: isSelected
                    ? "1px solid rgba(212,175,55,0.4)"
                    : "1px solid rgba(255,255,255,0.08)",
                  color: isSelected ? "#d4af37" : "rgba(255,255,255,0.5)",
                  boxShadow: isSelected
                    ? "0 0 15px rgba(212,175,55,0.1)"
                    : "none",
                }}
              >
                {count}
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* Standard Buy-in */}
      <div className="space-y-1.5">
        <label htmlFor="club-buyin" className="text-[0.625rem] font-bold uppercase tracking-wider text-gray-400 flex items-center gap-1.5">
          <Crown className="w-3.5 h-3.5" />
          Standard Buy-in (chips)
        </label>
        <input
          id="club-buyin"
          type="number"
          value={chipBuyIn}
          onChange={(e) => setChipBuyIn(Math.max(0, parseInt(e.target.value) || 0))}
          min={0}
          placeholder="1000"
          className="w-full px-4 py-2.5 rounded-lg text-sm text-white placeholder-gray-600 outline-none transition-all focus:ring-1 focus:ring-[#d4af37]/40"
          style={inputStyle}
        />
      </div>

      {/* Default Player Credit Limit */}
      <div className="space-y-1.5">
        <label htmlFor="club-credit-limit" className="text-[0.625rem] font-bold uppercase tracking-wider text-gray-400 flex items-center gap-1.5">
          <Shield className="w-3.5 h-3.5" />
          Default Player Credit Limit
        </label>
        <input
          id="club-credit-limit"
          type="number"
          value={creditLimit}
          onChange={(e) => setCreditLimit(Math.max(0, parseInt(e.target.value) || 0))}
          min={0}
          placeholder="10000"
          className="w-full px-4 py-2.5 rounded-lg text-sm text-white placeholder-gray-600 outline-none transition-all focus:ring-1 focus:ring-[#d4af37]/40"
          style={inputStyle}
        />
        <p className="text-[0.5625rem] text-gray-500">Max chips a player can owe before being restricted</p>
      </div>

      {/* Summary info card */}
      <div
        className="rounded-xl p-4"
        style={{
          background: "rgba(212,175,55,0.04)",
          border: "1px solid rgba(212,175,55,0.12)",
        }}
      >
        <div className="flex items-center gap-2 mb-3">
          <Shield className="w-4 h-4 text-[#d4af37]" />
          <span className="text-xs font-bold text-white uppercase tracking-wider">
            Configuration Summary
          </span>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div className="flex flex-col">
            <span className="text-[0.5625rem] text-gray-500 uppercase tracking-wider">
              Capacity
            </span>
            <span className="text-sm font-bold text-[#d4af37] mt-0.5">
              {maxMembers} members
            </span>
          </div>
          <div className="flex flex-col">
            <span className="text-[0.5625rem] text-gray-500 uppercase tracking-wider">
              Buy-in
            </span>
            <span className="text-sm font-bold text-[#d4af37] mt-0.5">
              {chipBuyIn.toLocaleString()} chips
            </span>
          </div>
          <div className="flex flex-col">
            <span className="text-[0.5625rem] text-gray-500 uppercase tracking-wider">
              Credit Limit
            </span>
            <span className="text-sm font-bold text-[#d4af37] mt-0.5">
              {creditLimit.toLocaleString()} chips
            </span>
          </div>
        </div>
      </div>
    </div>
  );

  /* ── Step 3: Privacy & Access ────────────────────────────────────────────── */

  const renderStep3 = () => (
    <div className="space-y-6">
      {/* Visibility radio cards */}
      <div className="space-y-2">
        <label id="club-visibility-label" className="text-[0.625rem] font-bold uppercase tracking-wider text-gray-400">
          Club Visibility
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {([
            { id: "public" as const, icon: Globe, label: "Public", description: "Anyone can discover and join" },
            { id: "semi-private" as const, icon: Eye, label: "Semi-Private", description: "Visible in browse, requires approval to join" },
            { id: "private" as const, icon: Lock, label: "Private", description: "Invite only, hidden from search" },
          ] as const).map((opt) => {
            const isSelected = visibility === opt.id;
            const Icon = opt.icon;
            return (
              <motion.button
                key={opt.id}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setVisibility(opt.id)}
                className="relative rounded-xl p-5 text-left transition-all cursor-pointer"
                style={{
                  background: isSelected
                    ? "rgba(212,175,55,0.08)"
                    : "rgba(255,255,255,0.03)",
                  border: isSelected
                    ? "2px solid rgba(212,175,55,0.4)"
                    : "2px solid rgba(255,255,255,0.08)",
                  boxShadow: isSelected
                    ? "0 0 25px rgba(212,175,55,0.08)"
                    : "none",
                }}
              >
                {isSelected && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="absolute top-3 right-3 w-5 h-5 rounded-full flex items-center justify-center"
                    style={{ background: "#d4af37" }}
                  >
                    <Check className="w-3 h-3 text-black" />
                  </motion.div>
                )}
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center mb-3"
                  style={{
                    background: isSelected
                      ? "rgba(212,175,55,0.15)"
                      : "rgba(255,255,255,0.06)",
                    border: `1px solid ${
                      isSelected ? "rgba(212,175,55,0.3)" : "rgba(255,255,255,0.1)"
                    }`,
                  }}
                >
                  <Icon
                    className={`w-5 h-5 ${
                      isSelected ? "text-[#d4af37]" : "text-gray-500"
                    }`}
                  />
                </div>
                <div
                  className={`text-sm font-bold mb-1 ${
                    isSelected ? "text-white" : "text-gray-400"
                  }`}
                >
                  {opt.label}
                </div>
                <div
                  className={`text-[0.625rem] leading-relaxed ${
                    isSelected ? "text-gray-300" : "text-gray-600"
                  }`}
                >
                  {opt.description}
                </div>
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* Require Admin Approval */}
      <div
        className="rounded-xl p-4 flex items-start gap-3"
        style={{
          background: "rgba(255,255,255,0.03)",
          border: "1px solid rgba(255,255,255,0.08)",
        }}
      >
        <button
          onClick={() => setRequireApproval(!requireApproval)}
          className="relative w-10 h-5 rounded-full transition-colors shrink-0 mt-0.5"
          style={{
            background: requireApproval
              ? "linear-gradient(135deg, #d4af37, #f3e2ad)"
              : "rgba(255,255,255,0.1)",
          }}
        >
          <motion.div
            layout
            className="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-md"
            style={{ left: requireApproval ? "calc(100% - 18px)" : "2px" }}
            transition={{ type: "spring", stiffness: 500, damping: 30 }}
          />
        </button>
        <div className="flex-1 min-w-0">
          <div className="text-xs font-bold text-white">
            Require Admin Approval
          </div>
          <div className="text-[0.5625rem] text-gray-500 mt-0.5 leading-relaxed">
            New members must be approved by an admin before they can join.
            This gives you full control over who enters the club.
          </div>
        </div>
      </div>
    </div>
  );

  /* ── Step 4: Review & Create ─────────────────────────────────────────────── */

  const selectedLogoOption = LOGO_OPTIONS.find((l) => l.id === selectedLogo);

  const renderStep4 = () => (
    <div className="space-y-6">
      {/* Preview card */}
      <div
        className="rounded-xl overflow-hidden"
        style={{
          background: "rgba(212,175,55,0.04)",
          border: "1px solid rgba(212,175,55,0.15)",
        }}
      >
        <div className="p-5 flex items-center gap-4">
          {selectedLogoOption ? (
            <div
              className="w-16 h-16 rounded-xl overflow-hidden ring-2 ring-[#d4af37]/30 shrink-0"
              style={{ boxShadow: "0 0 20px rgba(212,175,55,0.15)" }}
            >
              <img
                src={selectedLogoOption.url}
                alt={selectedLogoOption.label}
                className="w-full h-full object-cover"
              />
            </div>
          ) : (
            <div
              className="w-16 h-16 rounded-xl flex items-center justify-center shrink-0 text-2xl font-black text-white/60"
              style={{
                background: "linear-gradient(135deg, rgba(255,255,255,0.08), rgba(255,255,255,0.03))",
                border: "1px solid rgba(255,255,255,0.1)",
              }}
            >
              {clubName.charAt(0).toUpperCase() || "?"}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-bold text-white truncate">
              {clubName || "Unnamed Club"}
            </h3>
            <p className="text-xs text-gray-400 mt-1 line-clamp-2 leading-relaxed">
              {description || "No description provided."}
            </p>
          </div>
        </div>
      </div>

      {/* Summary table */}
      <div
        className="rounded-xl overflow-hidden bg-[rgba(15,15,20,0.7)] backdrop-blur-xl border border-white/[0.06]"
      >
        <div
          className="px-5 py-3 flex items-center gap-2"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
        >
          <Shield className="w-4 h-4 text-[#d4af37]" />
          <span className="text-xs font-bold text-white uppercase tracking-wider">
            Club Summary
          </span>
        </div>
        <div className="divide-y divide-white/5">
          {[
            { label: "Club Tag", value: clubTag || "None" },
            { label: "Max Members", value: `${maxMembers}` },
            { label: "Standard Buy-in", value: `${chipBuyIn.toLocaleString()} chips` },
            { label: "Credit Limit", value: `${creditLimit.toLocaleString()} chips` },
            { label: "Theme Color", value: THEME_COLORS.find((c) => c.id === themeColor)?.label ?? "Cyan" },
            { label: "Privacy", value: visibility === "public" ? "Public" : visibility === "semi-private" ? "Semi-Private" : "Private" },
            { label: "Approval Required", value: requireApproval ? "Yes" : "No" },
          ].map((row) => (
            <div key={row.label} className="flex items-center justify-between px-5 py-3">
              <span className="text-xs text-gray-500">{row.label}</span>
              <span className="text-xs font-semibold text-white">{row.value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Launch Club button */}
      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={handleSubmit}
        disabled={submitting}
        className="w-full py-3.5 rounded-xl text-sm font-bold uppercase tracking-wider text-black flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        style={{
          background: "linear-gradient(135deg, #9a7b2c 0%, #d4af37 50%, #f3e2ad 100%)",
          boxShadow: "0 0 30px rgba(212,175,55,0.3)",
        }}
      >
        {submitting ? (
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
            className="w-5 h-5 border-2 border-black/30 border-t-black rounded-full"
          />
        ) : (
          <>
            <Zap className="w-5 h-5" />
            Launch Club
          </>
        )}
      </motion.button>
    </div>
  );

  /* ── Step renderers array ────────────────────────────────────────────────── */

  const stepRenderers = [renderStep1, renderStep2, renderStep3, renderStep4];

  /* ── Main render ─────────────────────────────────────────────────────────── */

  return (
    <DashboardLayout title="Create Club">
      <PageBackground image="/images/generated/club-setup-bg.png" />
      <div className="relative z-10 px-4 sm:px-8 pb-8">
        <div className="max-w-2xl mx-auto">
          {/* Step Indicators */}
          {renderStepIndicator()}

          {/* Step Content */}
          <div
            className="rounded-xl overflow-hidden bg-[rgba(15,15,20,0.7)] backdrop-blur-xl border border-white/[0.06]"
          >
            {/* Step header */}
            <div
              className="flex items-center gap-3 px-5 py-4"
              style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
            >
              <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: "rgba(212,175,55,0.12)", border: "1px solid rgba(212,175,55,0.25)" }}>
                <Crown className="w-5 h-5 text-[#d4af37]" />
              </div>
              <div>
                <h3 className="text-sm font-bold tracking-wider uppercase" style={{ background: "linear-gradient(135deg, #f3e2ad 0%, #d4af37 50%, #f3e2ad 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
                  {STEP_LABELS[step]}
                </h3>
                <p className="text-[0.5625rem] text-gray-500">
                  Step {step + 1} of {STEP_LABELS.length}
                </p>
              </div>
            </div>

            {/* Animated step body */}
            <div className="relative overflow-hidden">
              <AnimatePresence mode="wait" custom={direction}>
                <motion.div
                  key={step}
                  custom={direction}
                  variants={slideVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{ duration: 0.3, ease: "easeInOut" }}
                  className="p-5"
                >
                  {stepRenderers[step]()}
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Navigation buttons (not shown on Step 4 since it has its own Launch button) */}
            {step < 3 && (
              <div
                className="flex items-center justify-between px-5 py-4"
                style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}
              >
                <motion.button
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={goPrev}
                  disabled={step === 0}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                  style={{
                    background: "rgba(255,255,255,0.05)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    color: "rgba(255,255,255,0.7)",
                  }}
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  Back
                </motion.button>

                <motion.button
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={goNext}
                  disabled={!canProceed()}
                  className="flex items-center gap-1.5 px-5 py-2 rounded-lg text-xs font-bold uppercase tracking-wider text-black transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                  style={{
                    background: canProceed()
                      ? "linear-gradient(135deg, #9a7b2c 0%, #d4af37 50%, #f3e2ad 100%)"
                      : "rgba(255,255,255,0.1)",
                    boxShadow: canProceed()
                      ? "0 0 15px rgba(212,175,55,0.2)"
                      : "none",
                    color: canProceed() ? "#000" : "rgba(255,255,255,0.3)",
                  }}
                >
                  Next
                  <ArrowRight className="w-3.5 h-3.5" />
                </motion.button>
              </div>
            )}

            {/* Back button on Step 4 */}
            {step === 3 && (
              <div
                className="flex items-center px-5 py-4"
                style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}
              >
                <motion.button
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={goPrev}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all cursor-pointer"
                  style={{
                    background: "rgba(255,255,255,0.05)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    color: "rgba(255,255,255,0.7)",
                  }}
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  Back
                </motion.button>
              </div>
            )}
          </div>
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
