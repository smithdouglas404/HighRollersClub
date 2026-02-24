import { useState } from "react";
import { motion } from "framer-motion";
import {
  ShieldCheck, CheckCircle, Copy, Eye, EyeOff,
  Download, Server, Smartphone, Link2, X
} from "lucide-react";

const MOCK_HASH = "0x7a3f92c1d8e4b6a5f0c2d9e8b7a6c5d4e3f2a1b0c9d8e7f6a5b4c3d2e1f0a9b8";
const MOCK_SEED = "f29a3c4d...e8b7 (hidden until showdown)";

export function ProvablyFairPanel({ onClose }: { onClose?: () => void }) {
  const [seedRevealed, setSeedRevealed] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(MOCK_HASH).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <motion.div
      initial={{ x: 320, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 320, opacity: 0 }}
      transition={{ type: "spring", stiffness: 200, damping: 25 }}
      className="w-[320px] h-full flex flex-col z-40 pointer-events-auto relative overflow-hidden"
      style={{
        background: "linear-gradient(180deg, rgba(8,16,24,0.97) 0%, rgba(4,10,16,0.99) 100%)",
        borderLeft: "1px solid rgba(0,240,255,0.12)",
        boxShadow: "-8px 0 40px rgba(0,0,0,0.5)",
      }}
    >
      {/* ─── Header: Shuffle Verified ─────────────────────────── */}
      <div className="p-5 relative" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        {onClose && (
          <button
            onClick={onClose}
            className="absolute top-3 right-3 p-1 rounded hover:bg-white/5 transition-colors"
          >
            <X className="w-4 h-4 text-gray-500" />
          </button>
        )}

        <div className="flex items-start gap-3">
          <div className="relative mt-0.5 shrink-0">
            <div className="absolute inset-0 bg-green-500 blur-lg opacity-30 animate-pulse" />
            <div className="w-10 h-10 rounded-lg bg-green-500/15 border border-green-500/25 flex items-center justify-center relative">
              <ShieldCheck className="w-5 h-5 text-green-400" />
            </div>
          </div>
          <div>
            <div className="text-xs font-bold text-gray-400 tracking-wider uppercase">
              Shuffle Verified:
              <span className="text-green-400 ml-1.5">True</span>
            </div>
            <div className="text-[9px] text-gray-600 font-mono mt-0.5">
              v0.1 | SHA-256
            </div>
          </div>
        </div>
      </div>

      {/* ─── Scrollable Content ────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <div className="p-5 space-y-5">

          {/* ─── Entropy Source (Checkmarks) ──────────────────── */}
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-white mb-3">
              Entropy Source
            </div>
            <div className="space-y-2">
              {[
                { icon: Server, label: "Server Hardware RNG", active: true },
                { icon: Smartphone, label: "User Device Input", active: true },
                { icon: Link2, label: "Chainlink VRF", active: true },
              ].map((source, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2.5 group"
                >
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${
                    source.active
                      ? "bg-green-500/20 border border-green-500/30"
                      : "bg-gray-800 border border-gray-700"
                  }`}>
                    <CheckCircle className={`w-3 h-3 ${
                      source.active ? "text-green-400" : "text-gray-600"
                    }`} />
                  </div>
                  <span className="text-[11px] text-gray-300 font-medium">
                    {source.label}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* ─── Entropy Source Hash ──────────────────────────── */}
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-white mb-2">
              Entropy Source
            </div>
            <div className="flex items-center gap-2">
              <div
                className="flex-1 rounded-lg px-3 py-2.5 text-[9px] font-mono text-cyan-400/80 truncate"
                style={{
                  background: "rgba(0,240,255,0.04)",
                  border: "1px solid rgba(0,240,255,0.1)",
                }}
              >
                {MOCK_HASH.slice(0, 24)}...{MOCK_HASH.slice(-8)}
              </div>
              <button
                onClick={handleCopy}
                className="shrink-0 px-3 py-2.5 rounded-lg text-[9px] font-bold uppercase tracking-wider transition-all"
                style={{
                  background: copied ? "rgba(0,255,157,0.15)" : "rgba(0,240,255,0.08)",
                  border: `1px solid ${copied ? "rgba(0,255,157,0.3)" : "rgba(0,240,255,0.15)"}`,
                  color: copied ? "#00ff9d" : "#8ecae6",
                }}
              >
                {copied ? "COPIED" : "COPY"}
              </button>
            </div>
          </div>

          {/* ─── Verification Actions ────────────────────────── */}
          <div className="space-y-2">
            {/* Commitment Hash */}
            <button
              className="w-full flex items-center gap-3 p-3 rounded-lg transition-all hover:bg-white/[0.02] group"
              style={{
                background: "rgba(255,255,255,0.01)",
                border: "1px solid rgba(255,255,255,0.06)",
              }}
            >
              <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/15 flex items-center justify-center shrink-0">
                <CheckCircle className="w-4 h-4 text-cyan-400" />
              </div>
              <div className="text-left">
                <div className="text-[11px] font-semibold text-white group-hover:text-cyan-300 transition-colors">
                  Commitment Hash
                </div>
                <div className="text-[9px] text-gray-600">Pre-deal locked hash</div>
              </div>
            </button>

            {/* Reveal Seed */}
            <button
              onClick={() => setSeedRevealed(!seedRevealed)}
              className="w-full flex items-center gap-3 p-3 rounded-lg transition-all hover:bg-white/[0.02] group"
              style={{
                background: "rgba(255,255,255,0.01)",
                border: "1px solid rgba(255,255,255,0.06)",
              }}
            >
              <div className="w-8 h-8 rounded-lg bg-purple-500/10 border border-purple-500/15 flex items-center justify-center shrink-0">
                {seedRevealed ? (
                  <EyeOff className="w-4 h-4 text-purple-400" />
                ) : (
                  <Eye className="w-4 h-4 text-purple-400" />
                )}
              </div>
              <div className="text-left flex-1 min-w-0">
                <div className="text-[11px] font-semibold text-white group-hover:text-purple-300 transition-colors">
                  Reveal Seed
                </div>
                <div className="text-[9px] text-gray-600 truncate">
                  {seedRevealed ? MOCK_SEED : "Available after showdown"}
                </div>
              </div>
            </button>
          </div>

          {/* ─── Download Verification Script ────────────────── */}
          <button
            className="w-full flex items-center gap-3 p-3 rounded-lg transition-all hover:bg-green-500/[0.03] group"
            style={{
              background: "rgba(0,255,157,0.02)",
              border: "1px solid rgba(0,255,157,0.1)",
            }}
          >
            <div className="w-8 h-8 rounded-lg bg-green-500/10 border border-green-500/20 flex items-center justify-center shrink-0">
              <Download className="w-4 h-4 text-green-400" />
            </div>
            <div className="text-left">
              <div className="text-[11px] font-semibold text-green-300 group-hover:text-green-200 transition-colors">
                Download Verification Script
              </div>
              <div className="text-[9px] text-gray-600">Python / JavaScript</div>
            </div>
          </button>
        </div>
      </div>

      {/* ─── Footer: Algorithm ─────────────────────────────────── */}
      <div
        className="px-5 py-3 text-center"
        style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}
      >
        <div className="text-[9px] text-gray-600 font-mono">
          Algorithm: <span className="text-cyan-500/60">Fisher-Yates + (Quadruple)</span>
        </div>
      </div>
    </motion.div>
  );
}
