import { useState, type ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/lib/auth-context";
import { useLocation } from "wouter";
import { AmbientParticles } from "@/components/AmbientParticles";
import {
  Trophy,
  User,
  Lock,
  Zap,
  Check,
  ChevronRight,
  Users,
  Plus,
  SkipForward,
  Eye,
  EyeOff,
  ShieldCheck,
} from "lucide-react";
import { AVATAR_OPTIONS, type AvatarOption } from "@/components/poker/AvatarSelect";

// ─── Password strength helper ──────────────────────────────────────────────
type StrengthLevel = "weak" | "medium" | "strong";

function getPasswordStrength(pw: string): { level: StrengthLevel; score: number } {
  if (!pw) return { level: "weak", score: 0 };
  let score = 0;
  if (pw.length >= 6) score++;
  if (pw.length >= 10) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  if (score <= 1) return { level: "weak", score: Math.min(score / 5, 0.33) };
  if (score <= 3) return { level: "medium", score: score / 5 };
  return { level: "strong", score: score / 5 };
}

const STRENGTH_COLORS: Record<StrengthLevel, string> = {
  weak: "#ef4444",
  medium: "#f59e0b",
  strong: "#22c55e",
};

// ─── Step indicator ────────────────────────────────────────────────────────
function StepDots({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center justify-center gap-2 mb-6">
      {Array.from({ length: total }, (_, i) => {
        const stepNum = i + 1;
        const isActive = stepNum === current;
        const isCompleted = stepNum < current;
        return (
          <div key={i} className="flex items-center gap-2">
            <motion.div
              layout
              className={`rounded-full flex items-center justify-center transition-all duration-300 ${
                isActive
                  ? "w-8 h-2.5 bg-cyan-500 shadow-[0_0_10px_rgba(0,200,255,0.4)]"
                  : isCompleted
                    ? "w-2.5 h-2.5 bg-cyan-500/60"
                    : "w-2.5 h-2.5 bg-white/10"
              }`}
            />
          </div>
        );
      })}
    </div>
  );
}

// ─── Slide animation variants ──────────────────────────────────────────────
const slideVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? 80 : -80,
    opacity: 0,
  }),
  center: {
    x: 0,
    opacity: 1,
  },
  exit: (direction: number) => ({
    x: direction > 0 ? -80 : 80,
    opacity: 0,
  }),
};

// ─── Main component ───────────────────────────────────────────────────────
export function AuthGate({ children }: { children: ReactNode }) {
  const { user, loading, loginAsGuest, login, register, error, refreshUser } = useAuth();
  const [, navigate] = useLocation();

  // Onboarding step: 1 = auth, 2 = profile, 3 = club prompt
  const [step, setStep] = useState(1);
  const [direction, setDirection] = useState(1);

  // Auth form state
  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  // Profile setup state
  const [profileDisplayName, setProfileDisplayName] = useState("");
  const [selectedAvatar, setSelectedAvatar] = useState<AvatarOption | null>(null);
  const [profileSaving, setProfileSaving] = useState(false);

  // Track if onboarding should show (new registration or guest)
  const [showOnboarding, setShowOnboarding] = useState(false);

  // ─── Loading state ───────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a1022] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin" />
      </div>
    );
  }

  // ─── Already authenticated & onboarding done ────────────────────────────
  if (user && !showOnboarding) {
    return <>{children}</>;
  }

  // ─── Validation helpers ──────────────────────────────────────────────────
  const usernameError =
    touched.username && username.length > 0 && username.length < 3
      ? "Username must be at least 3 characters"
      : null;

  const passwordError =
    touched.password && password.length > 0 && password.length < 6
      ? "Password must be at least 6 characters"
      : null;

  const confirmError =
    touched.confirmPassword && confirmPassword.length > 0 && confirmPassword !== password
      ? "Passwords do not match"
      : null;

  const isFormValid =
    mode === "login"
      ? username.length >= 3 && password.length >= 6
      : username.length >= 3 &&
        password.length >= 6 &&
        confirmPassword === password;

  const passwordStrength = getPasswordStrength(password);

  // ─── Handlers ────────────────────────────────────────────────────────────
  const goToStep = (next: number) => {
    setDirection(next > step ? 1 : -1);
    setStep(next);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFormValid) return;
    setSubmitting(true);
    try {
      if (mode === "login") {
        await login(username, password);
        // Returning user — skip onboarding
      } else {
        await register(username, password, displayName || username);
        setProfileDisplayName(displayName || username);
        setShowOnboarding(true);
        goToStep(2);
      }
    } catch {
      // error is shown via context
    } finally {
      setSubmitting(false);
    }
  };

  const handleGuest = async () => {
    setSubmitting(true);
    try {
      await loginAsGuest();
      setShowOnboarding(true);
      goToStep(2);
    } catch {
      // error is shown via context
    } finally {
      setSubmitting(false);
    }
  };

  const handleProfileContinue = async () => {
    setProfileSaving(true);
    try {
      if (selectedAvatar) {
        await fetch("/api/profile/avatar", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ avatarId: selectedAvatar.id }),
        });
        await refreshUser();
      }
    } catch {
      // best-effort
    } finally {
      setProfileSaving(false);
    }

    // Check if onboarding-complete was already set (unlikely here, but safe)
    const alreadyOnboarded = localStorage.getItem("onboarding-complete");
    if (alreadyOnboarded) {
      setShowOnboarding(false);
    } else {
      goToStep(3);
    }
  };

  const handleProfileSkip = () => {
    const alreadyOnboarded = localStorage.getItem("onboarding-complete");
    if (alreadyOnboarded) {
      setShowOnboarding(false);
    } else {
      goToStep(3);
    }
  };

  const handleClubAction = (path: string) => {
    localStorage.setItem("onboarding-complete", "true");
    setShowOnboarding(false);
    navigate(path);
  };

  const handleClubSkip = () => {
    localStorage.setItem("onboarding-complete", "true");
    setShowOnboarding(false);
  };

  // ─── Render ──────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#0a1022] text-white flex items-center justify-center relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(0,30,40,0.5)_0%,rgba(0,0,0,0.95)_70%)]" />
        <AmbientParticles />
      </div>

      <div className="relative z-10 w-full max-w-md px-4">
        {/* Step indicator */}
        {showOnboarding && <StepDots current={step} total={3} />}

        <AnimatePresence mode="wait" custom={direction}>
          {/* ════════════════════════════════════════════════════════════════
              STEP 1: Authentication
             ════════════════════════════════════════════════════════════════ */}
          {step === 1 && (
            <motion.div
              key="step-auth"
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.3, ease: "easeInOut" }}
              className="bg-white/[0.03] backdrop-blur-xl rounded-2xl p-8 border border-white/10 shadow-2xl"
            >
              {/* Logo */}
              <div className="text-center mb-8">
                <div className="w-14 h-14 rounded-xl gold-gradient flex items-center justify-center mx-auto mb-3 shadow-[0_0_25px_rgba(201,168,76,0.3)]">
                  <Trophy className="w-7 h-7 text-black" />
                </div>
                <h1 className="font-display font-bold text-lg tracking-widest gold-text">
                  HIGH ROLLERS
                </h1>
                <p className="text-[10px] text-gray-500 tracking-[0.2em] font-mono mt-1">
                  MULTIPLAYER POKER
                </p>
              </div>

              {/* Quick Guest */}
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleGuest}
                disabled={submitting}
                className="w-full gold-gradient rounded-lg py-3 text-sm font-bold tracking-wider text-black flex items-center justify-center gap-2 mb-4 shadow-[0_0_15px_rgba(201,168,76,0.25)] disabled:opacity-50"
              >
                <Zap className="w-4 h-4" />
                PLAY AS GUEST
              </motion.button>

              <div className="flex items-center gap-3 my-4">
                <div className="flex-1 h-px bg-white/10" />
                <span className="text-[10px] text-gray-600 uppercase tracking-wider">or</span>
                <div className="flex-1 h-px bg-white/10" />
              </div>

              {/* Login/Register form */}
              <form onSubmit={handleSubmit} className="space-y-3">
                {mode === "register" && (
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-wider text-gray-500 block mb-1">
                      Display Name
                    </label>
                    <input
                      type="text"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="NeonAce"
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-cyan-500/50 transition-colors"
                    />
                  </div>
                )}

                {/* Username */}
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-gray-500 flex items-center gap-1 mb-1">
                    <User className="w-3 h-3" /> Username
                  </label>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    onBlur={() => setTouched((t) => ({ ...t, username: true }))}
                    placeholder="username"
                    className={`w-full bg-white/5 border rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none transition-colors ${
                      usernameError
                        ? "border-red-500/50 focus:border-red-500/70"
                        : "border-white/10 focus:border-cyan-500/50"
                    }`}
                    required
                  />
                  {usernameError && (
                    <p className="text-[10px] text-red-400 mt-1">{usernameError}</p>
                  )}
                </div>

                {/* Password */}
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-gray-500 flex items-center gap-1 mb-1">
                    <Lock className="w-3 h-3" /> Password
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      onBlur={() => setTouched((t) => ({ ...t, password: true }))}
                      placeholder="••••••"
                      className={`w-full bg-white/5 border rounded-lg px-3 py-2 pr-9 text-sm text-white placeholder-gray-600 focus:outline-none transition-colors ${
                        passwordError
                          ? "border-red-500/50 focus:border-red-500/70"
                          : "border-white/10 focus:border-cyan-500/50"
                      }`}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                  {passwordError && (
                    <p className="text-[10px] text-red-400 mt-1">{passwordError}</p>
                  )}

                  {/* Password strength indicator (register mode only) */}
                  {mode === "register" && password.length > 0 && (
                    <div className="mt-2 space-y-1">
                      <div className="flex gap-1">
                        {[0, 1, 2].map((i) => (
                          <div
                            key={i}
                            className="flex-1 h-1 rounded-full overflow-hidden bg-white/10"
                          >
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{
                                width:
                                  (passwordStrength.level === "weak" && i === 0) ||
                                  (passwordStrength.level === "medium" && i <= 1) ||
                                  passwordStrength.level === "strong"
                                    ? "100%"
                                    : "0%",
                              }}
                              transition={{ duration: 0.3 }}
                              className="h-full rounded-full"
                              style={{
                                backgroundColor: STRENGTH_COLORS[passwordStrength.level],
                              }}
                            />
                          </div>
                        ))}
                      </div>
                      <p
                        className="text-[10px] font-medium capitalize"
                        style={{ color: STRENGTH_COLORS[passwordStrength.level] }}
                      >
                        {passwordStrength.level}
                      </p>
                    </div>
                  )}
                </div>

                {/* Confirm password (register only) */}
                {mode === "register" && (
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-wider text-gray-500 flex items-center gap-1 mb-1">
                      <ShieldCheck className="w-3 h-3" /> Confirm Password
                    </label>
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      onBlur={() => setTouched((t) => ({ ...t, confirmPassword: true }))}
                      placeholder="••••••"
                      className={`w-full bg-white/5 border rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none transition-colors ${
                        confirmError
                          ? "border-red-500/50 focus:border-red-500/70"
                          : "border-white/10 focus:border-cyan-500/50"
                      }`}
                      required
                    />
                    {confirmError && (
                      <p className="text-[10px] text-red-400 mt-1">{confirmError}</p>
                    )}
                    {touched.confirmPassword &&
                      confirmPassword.length > 0 &&
                      confirmPassword === password && (
                        <p className="text-[10px] text-green-400 mt-1 flex items-center gap-1">
                          <Check className="w-3 h-3" /> Passwords match
                        </p>
                      )}
                  </div>
                )}

                {error && (
                  <p className="text-xs text-red-400 bg-red-400/10 rounded-lg px-3 py-2">
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={submitting || !isFormValid}
                  className="w-full bg-cyan-500/20 border border-cyan-500/30 rounded-lg py-2.5 text-sm font-bold tracking-wider text-cyan-400 hover:bg-cyan-500/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? (
                    <div className="w-4 h-4 border-2 border-cyan-400/30 border-t-cyan-400 rounded-full animate-spin mx-auto" />
                  ) : mode === "login" ? (
                    "LOGIN"
                  ) : (
                    "CREATE ACCOUNT"
                  )}
                </button>
              </form>

              <p className="text-center mt-4 text-xs text-gray-500">
                {mode === "login" ? (
                  <>
                    No account?{" "}
                    <button
                      onClick={() => {
                        setMode("register");
                        setTouched({});
                        setConfirmPassword("");
                      }}
                      className="text-cyan-400 hover:text-cyan-300"
                    >
                      Register
                    </button>
                  </>
                ) : (
                  <>
                    Have an account?{" "}
                    <button
                      onClick={() => {
                        setMode("login");
                        setTouched({});
                        setConfirmPassword("");
                      }}
                      className="text-cyan-400 hover:text-cyan-300"
                    >
                      Login
                    </button>
                  </>
                )}
              </p>
            </motion.div>
          )}

          {/* ════════════════════════════════════════════════════════════════
              STEP 2: Profile Setup
             ════════════════════════════════════════════════════════════════ */}
          {step === 2 && (
            <motion.div
              key="step-profile"
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.3, ease: "easeInOut" }}
              className="bg-white/[0.03] backdrop-blur-xl rounded-2xl p-8 border border-white/10 shadow-2xl"
            >
              <div className="text-center mb-6">
                <div className="w-12 h-12 rounded-xl bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center mx-auto mb-3">
                  <User className="w-6 h-6 text-cyan-400" />
                </div>
                <h2 className="font-display font-bold text-base tracking-widest text-white">
                  SET UP YOUR PROFILE
                </h2>
                <p className="text-[10px] text-gray-500 tracking-wider font-mono mt-1">
                  CHOOSE AN AVATAR AND DISPLAY NAME
                </p>
              </div>

              {/* Display name */}
              <div className="mb-5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-gray-500 block mb-1">
                  Display Name
                </label>
                <input
                  type="text"
                  value={profileDisplayName}
                  onChange={(e) => setProfileDisplayName(e.target.value)}
                  placeholder="Your display name"
                  maxLength={20}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-cyan-500/50 transition-colors"
                />
              </div>

              {/* Avatar grid (4x3) */}
              <div className="mb-5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-gray-500 block mb-2">
                  Choose Avatar
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {AVATAR_OPTIONS.map((av) => {
                    const isSelected = selectedAvatar?.id === av.id;
                    return (
                      <motion.button
                        key={av.id}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => setSelectedAvatar(av)}
                        className={`relative rounded-lg overflow-hidden aspect-square transition-all duration-200 ${
                          isSelected ? "ring-2 ring-cyan-400 shadow-[0_0_12px_rgba(0,200,255,0.3)]" : "ring-1 ring-white/10 opacity-70 hover:opacity-100"
                        }`}
                      >
                        <img
                          src={av.image}
                          alt={av.name}
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                        {isSelected && (
                          <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            className="absolute top-1 right-1 w-4 h-4 rounded-full bg-cyan-400 flex items-center justify-center"
                          >
                            <Check className="w-2.5 h-2.5 text-black" />
                          </motion.div>
                        )}
                        <div className="absolute bottom-0 left-0 right-0 px-1 pb-0.5">
                          <p className="text-[7px] font-bold text-white truncate drop-shadow-lg">
                            {av.name}
                          </p>
                        </div>
                      </motion.button>
                    );
                  })}
                </div>
              </div>

              {/* Continue */}
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleProfileContinue}
                disabled={profileSaving}
                className="w-full gold-gradient rounded-lg py-3 text-sm font-bold tracking-wider text-black flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(201,168,76,0.25)] disabled:opacity-50"
              >
                {profileSaving ? (
                  <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                ) : (
                  <>
                    CONTINUE
                    <ChevronRight className="w-4 h-4" />
                  </>
                )}
              </motion.button>

              {/* Skip */}
              <button
                onClick={handleProfileSkip}
                className="w-full mt-3 text-xs text-gray-500 hover:text-gray-300 transition-colors flex items-center justify-center gap-1"
              >
                <SkipForward className="w-3 h-3" />
                Skip for now
              </button>
            </motion.div>
          )}

          {/* ════════════════════════════════════════════════════════════════
              STEP 3: Club Prompt
             ════════════════════════════════════════════════════════════════ */}
          {step === 3 && (
            <motion.div
              key="step-club"
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.3, ease: "easeInOut" }}
              className="bg-white/[0.03] backdrop-blur-xl rounded-2xl p-8 border border-white/10 shadow-2xl"
            >
              <div className="text-center mb-6">
                <div className="w-12 h-12 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center mx-auto mb-3">
                  <Users className="w-6 h-6 text-amber-400" />
                </div>
                <h2 className="font-display font-bold text-base tracking-widest text-white">
                  JOIN A CLUB
                </h2>
                <p className="text-xs text-gray-400 mt-2 leading-relaxed">
                  Join a club to play with friends!
                </p>
              </div>

              <div className="space-y-3">
                {/* Browse Clubs */}
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => handleClubAction("/clubs/browse")}
                  className="w-full bg-cyan-500/20 border border-cyan-500/30 rounded-lg py-3 text-sm font-bold tracking-wider text-cyan-400 hover:bg-cyan-500/30 transition-colors flex items-center justify-center gap-2"
                >
                  <Users className="w-4 h-4" />
                  BROWSE CLUBS
                </motion.button>

                {/* Create Club */}
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => handleClubAction("/club")}
                  className="w-full gold-gradient rounded-lg py-3 text-sm font-bold tracking-wider text-black flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(201,168,76,0.25)]"
                >
                  <Plus className="w-4 h-4" />
                  CREATE CLUB
                </motion.button>
              </div>

              {/* Skip */}
              <button
                onClick={handleClubSkip}
                className="w-full mt-4 text-xs text-gray-500 hover:text-gray-300 transition-colors flex items-center justify-center gap-1"
              >
                <SkipForward className="w-3 h-3" />
                Skip for now
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
