import { useState, useEffect, useRef } from "react";
import { Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Check, Shirt, Sparkles } from "lucide-react";

/* -- Render Stages -------------------------------------------------------- */

const STAGES = [
  { label: "Initializing...",            threshold: 0 },
  { label: "Generating base model...",   threshold: 15 },
  { label: "Applying textures...",       threshold: 40 },
  { label: "Rendering lighting...",      threshold: 65 },
  { label: "Finalizing...",             threshold: 85 },
] as const;

const TOTAL_DURATION_MS = 8000;

/* -- Glowing Silhouette --------------------------------------------------- */

function GlowingSilhouette({ progress, done }: { progress: number; done: boolean }) {
  return (
    <div className="relative w-48 h-48 flex items-center justify-center">
      {/* Outer pulse ring */}
      <div
        className="absolute inset-0 rounded-full transition-all duration-700"
        style={{
          background: done
            ? "radial-gradient(circle, rgba(63,255,139,0.15) 0%, transparent 70%)"
            : "radial-gradient(circle, rgba(129,236,255,0.12) 0%, transparent 70%)",
          animation: done ? "none" : "avatarGlowPulse 2s ease-in-out infinite",
        }}
      />

      {/* Inner silhouette container */}
      <div
        className={`relative w-36 h-36 rounded-2xl border-2 flex items-center justify-center transition-all duration-500 ${
          done
            ? "border-green-500/40 bg-green-500/5"
            : "border-primary/30 bg-primary/5"
        }`}
        style={{
          boxShadow: done
            ? "0 0 40px rgba(63,255,139,0.2), inset 0 0 30px rgba(63,255,139,0.08)"
            : `0 0 ${20 + progress * 0.3}px rgba(129,236,255,${0.1 + progress * 0.002}), inset 0 0 20px rgba(129,236,255,0.05)`,
        }}
      >
        <AnimatePresence mode="wait">
          {done ? (
            <motion.div
              key="done"
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 200, damping: 15 }}
              className="flex flex-col items-center"
            >
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-green-500/20 to-primary/20 border border-green-500/30 flex items-center justify-center mb-2">
                <Check className="w-8 h-8 text-green-400" />
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center"
            >
              {/* Animated silhouette figure */}
              <svg
                className="w-20 h-20"
                viewBox="0 0 80 80"
                fill="none"
                style={{ filter: `drop-shadow(0 0 8px rgba(129,236,255,${0.2 + progress * 0.005}))` }}
              >
                {/* Head */}
                <circle
                  cx="40" cy="22" r="12"
                  className="transition-all duration-300"
                  fill={`rgba(129,236,255,${0.08 + progress * 0.003})`}
                  stroke="rgba(129,236,255,0.4)"
                  strokeWidth="1.5"
                />
                {/* Body */}
                <path
                  d="M24 45 C24 36, 56 36, 56 45 L58 70 C58 72, 56 74, 54 74 L26 74 C24 74, 22 72, 22 70 Z"
                  className="transition-all duration-300"
                  fill={`rgba(129,236,255,${0.05 + progress * 0.002})`}
                  stroke="rgba(129,236,255,0.35)"
                  strokeWidth="1.5"
                />
              </svg>
              {/* Scanning line effect */}
              <div
                className="absolute left-4 right-4 h-px bg-gradient-to-r from-transparent via-primary/60 to-transparent"
                style={{
                  animation: "avatarScanLine 2s linear infinite",
                  top: `${30 + (progress % 40)}%`,
                }}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

/* -- Progress Bar --------------------------------------------------------- */

function ProgressBar({ progress }: { progress: number }) {
  return (
    <div className="w-full max-w-md">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[0.5625rem] text-gray-500 uppercase tracking-wider font-bold">
          Rendering
        </span>
        <span className="text-[0.625rem] font-bold text-primary tabular-nums">
          {Math.round(progress)}%
        </span>
      </div>
      <div className="h-2 rounded-full bg-surface-highest/80 border border-white/[0.06] overflow-hidden">
        <motion.div
          className="h-full rounded-full relative"
          style={{
            width: `${progress}%`,
            background: progress >= 100
              ? "linear-gradient(90deg, #38A169, #3fff8b)"
              : "linear-gradient(90deg, #00d4ff, #81ecff)",
            boxShadow: progress >= 100
              ? "0 0 12px rgba(63,255,139,0.4)"
              : "0 0 12px rgba(129,236,255,0.4)",
          }}
          initial={false}
          transition={{ duration: 0.3, ease: "easeOut" }}
        >
          {/* Shimmer overlay */}
          {progress < 100 && (
            <div
              className="absolute inset-0"
              style={{
                background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.25), transparent)",
                backgroundSize: "200% 100%",
                animation: "shimmer 1.5s ease-in-out infinite",
              }}
            />
          )}
        </motion.div>
      </div>
    </div>
  );
}

/* -- Main Component ------------------------------------------------------- */

export default function AvatarRenderProgress() {
  const [progress, setProgress] = useState(0);
  const [done, setDone] = useState(false);
  const startRef = useRef<number | null>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const animate = (timestamp: number) => {
      if (startRef.current === null) {
        startRef.current = timestamp;
      }
      const elapsed = timestamp - startRef.current;
      const pct = Math.min((elapsed / TOTAL_DURATION_MS) * 100, 100);

      setProgress(pct);

      if (pct >= 100) {
        setDone(true);
      } else {
        rafRef.current = requestAnimationFrame(animate);
      }
    };

    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  // Determine current stage label
  const currentStage = [...STAGES]
    .reverse()
    .find((s) => progress >= s.threshold);

  return (
    <DashboardLayout title="Rendering Avatar">
      {/* Inject component-scoped keyframes */}
      <style>{`
        @keyframes avatarGlowPulse {
          0%, 100% { transform: scale(1); opacity: 0.7; }
          50% { transform: scale(1.08); opacity: 1; }
        }
        @keyframes avatarScanLine {
          0% { top: 15%; opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { top: 85%; opacity: 0; }
        }
      `}</style>

      <div className="px-4 md:px-8 pb-8">
        <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-8">
          {/* Glowing silhouette */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1, duration: 0.5 }}
          >
            <GlowingSilhouette progress={progress} done={done} />
          </motion.div>

          {/* Status text */}
          <AnimatePresence mode="wait">
            {done ? (
              <motion.div
                key="complete"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-center"
              >
                <div className="flex items-center justify-center gap-2 mb-2">
                  <Sparkles className="w-5 h-5 text-green-400" />
                  <h2 className="text-xl font-display font-bold text-green-400 tracking-tight">
                    Avatar Ready!
                  </h2>
                  <Sparkles className="w-5 h-5 text-green-400" />
                </div>
                <p className="text-[0.625rem] text-gray-500">
                  Your AI avatar has been rendered successfully.
                </p>
              </motion.div>
            ) : (
              <motion.div
                key={currentStage?.label}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                transition={{ duration: 0.3 }}
                className="text-center"
              >
                <h2 className="text-base font-display font-bold text-primary tracking-tight neon-text-glow">
                  {currentStage?.label}
                </h2>
                <p className="text-[0.5625rem] text-gray-600 mt-1">
                  Please wait while your avatar is being generated
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Progress bar */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="w-full flex justify-center"
          >
            <ProgressBar progress={progress} />
          </motion.div>

          {/* Completion actions */}
          <AnimatePresence>
            {done && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="flex flex-col sm:flex-row items-center gap-3 pt-4"
              >
                <Link href="/wardrobe">
                  <button className="flex items-center gap-2 px-8 py-3 rounded-lg text-sm font-bold uppercase tracking-wider gradient-gold text-black border border-[#c9a84c]/40 hover:opacity-90 transition-all shadow-[0_0_15px_rgba(212,168,67,0.2)] btn-neon">
                    <Shirt className="w-4 h-4" />
                    View in Wardrobe
                  </button>
                </Link>
                <Link href="/avatar-customizer">
                  <button className="flex items-center gap-2 px-6 py-3 rounded-lg text-[0.625rem] font-bold uppercase tracking-wider bg-white/5 text-gray-400 border border-white/10 hover:bg-white/10 hover:text-white transition-all">
                    Create Another
                  </button>
                </Link>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </DashboardLayout>
  );
}
