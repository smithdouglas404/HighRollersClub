import { motion } from "framer-motion";
import { Shield, CheckCircle, Lock, Terminal, Download, Eye, Activity, Cpu } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import entropyHud from "@assets/generated_images/holographic_entropy_network_hud.png";

export function ProvablyFairPanel() {
  return (
    <motion.div
      initial={{ x: 320, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 320, opacity: 0 }}
      transition={{ type: "spring", stiffness: 200, damping: 25 }}
      className="w-80 h-full flex flex-col font-mono text-xs z-40 pointer-events-auto relative overflow-hidden scanlines"
      style={{
        background: "linear-gradient(180deg, rgba(0,15,20,0.95) 0%, rgba(0,10,15,0.98) 100%)",
        borderLeft: "1px solid rgba(0,240,255,0.15)",
      }}
    >
      {/* Header */}
      <div className="p-4 flex items-center justify-between relative"
        style={{ borderBottom: "1px solid rgba(0,240,255,0.1)" }}
      >
        <div className="flex items-center gap-2.5 z-10">
          <div className="relative">
            <div className="absolute inset-0 bg-green-500 blur-md opacity-30 animate-pulse" />
            <CheckCircle className="w-5 h-5 text-green-400 relative z-10" />
          </div>
          <div className="flex flex-col">
            <span className="font-bold text-sm text-white tracking-wide">VERIFIED FAIR</span>
            <span className="text-[9px] text-cyan-500/60 font-mono">0x7a3f...c2d9 | SHA-256</span>
          </div>
        </div>
        <div className="flex items-center gap-1.5 z-10">
          <div className="w-2 h-2 bg-green-500 rounded-full shadow-[0_0_6px_rgba(0,255,157,0.5)]" style={{ animation: "neonPulse 2s ease-in-out infinite" }} />
          <span className="text-[9px] text-green-400/70 uppercase">Live</span>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-5">

          {/* Entropy visualization */}
          <div className="relative rounded-lg overflow-hidden" style={{ border: "1px solid rgba(0,240,255,0.15)" }}>
            <div className="aspect-[16/10] relative bg-black">
              {/* Scanline overlay on image */}
              <div className="absolute inset-0 z-10 pointer-events-none"
                style={{
                  background: "repeating-linear-gradient(0deg, transparent, transparent 1px, rgba(0,240,255,0.03) 1px, rgba(0,240,255,0.03) 2px)",
                }}
              />
              <img src={entropyHud} className="w-full h-full object-cover opacity-80 mix-blend-screen" alt="Entropy Network" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-black/30" />

              {/* Overlay data */}
              <div className="absolute bottom-2 left-2 right-2 flex justify-between items-end z-20">
                <div>
                  <div className="text-[8px] text-cyan-400/50 uppercase">Entropy Score</div>
                  <div className="text-sm font-bold neon-text-green">98.7%</div>
                </div>
                <div className="flex items-center gap-1 px-2 py-0.5 rounded border border-green-500/30 bg-green-500/10">
                  <Activity className="w-2.5 h-2.5 text-green-400" />
                  <span className="text-[8px] text-green-400 font-bold">QUANTUM SEEDED</span>
                </div>
              </div>
            </div>
          </div>

          {/* Entropy Sources */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-white font-bold text-xs">
              <Lock className="w-3 h-3 text-cyan-400" />
              <span>ENTROPY SOURCES</span>
            </div>
            <div className="space-y-1.5">
              {[
                { icon: Shield, label: "Hardware RNG (Server)", status: "active", color: "green" },
                { icon: Cpu, label: "User Device Input", status: "seeding", color: "cyan" },
                { icon: Shield, label: "Chainlink VRF v2", status: "verified", color: "green" },
              ].map((source, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between p-2 rounded-md transition-colors hover:bg-cyan-500/5"
                  style={{
                    background: "rgba(0,240,255,0.02)",
                    border: "1px solid rgba(0,240,255,0.08)",
                  }}
                >
                  <div className="flex items-center gap-2 text-gray-300">
                    <source.icon className="w-3 h-3 text-cyan-500/60" />
                    <span className="text-[10px]">{source.label}</span>
                  </div>
                  <span className={`text-[8px] font-bold uppercase ${source.color === "green" ? "text-green-400" : "text-cyan-400"}`}>
                    {source.status}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Verification Data */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-white font-bold text-xs">
              <Terminal className="w-3 h-3 text-cyan-400" />
              <span>VERIFICATION</span>
            </div>
            <div className="space-y-1.5">
              {[
                { icon: CheckCircle, label: "Commitment Hash", detail: "Pre-deal locked" },
                { icon: Eye, label: "Reveal Seed", detail: "Post-showdown" },
                { icon: Download, label: "Audit Script", detail: "Python / JS" },
              ].map((item, i) => (
                <button
                  key={i}
                  className="w-full flex items-center justify-between p-2 rounded-md text-left transition-all hover:bg-cyan-500/5 group"
                  style={{
                    background: "rgba(0,240,255,0.02)",
                    border: "1px solid rgba(0,240,255,0.08)",
                  }}
                >
                  <div className="flex items-center gap-2 text-gray-300">
                    <item.icon className="w-3 h-3 text-cyan-500/60 group-hover:text-cyan-400 transition-colors" />
                    <span className="text-[10px]">{item.label}</span>
                  </div>
                  <span className="text-[8px] text-gray-600 group-hover:text-gray-400 transition-colors">{item.detail}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Live log */}
          <div className="space-y-1.5"
            style={{ borderTop: "1px solid rgba(0,240,255,0.08)", paddingTop: "12px" }}
          >
            <div className="text-[9px] text-gray-600 uppercase tracking-wider font-bold mb-2">Shuffle Log</div>
            {[
              { text: "Initializing Fisher-Yates...", color: "text-gray-500" },
              { text: "Entropy pool: 3 sources merged", color: "text-gray-500" },
              { text: "Seed: 0x7a3f...c2d9", color: "text-cyan-500/60" },
              { text: "Deck sliced [0..52]", color: "text-gray-500" },
              { text: "Commitment hash locked", color: "text-green-500/70" },
              { text: "Block #892,102 confirmed", color: "text-green-400" },
            ].map((log, i) => (
              <div key={i} className={`text-[9px] font-mono ${log.color} flex items-start gap-1.5`}>
                <span className="text-gray-700 select-none">&gt;</span>
                <span>{log.text}</span>
              </div>
            ))}
          </div>
        </div>
      </ScrollArea>

      {/* Footer */}
      <div className="p-2.5 text-center relative" style={{ borderTop: "1px solid rgba(0,240,255,0.1)" }}>
        <div className="text-[9px] text-gray-600">
          Algorithm: <span className="text-cyan-500/50">Fisher-Yates + QuadResidue</span>
        </div>
      </div>
    </motion.div>
  );
}
