import { useEffect, useState } from "react";

interface RenderingProgressProps {
  progress: number;
  onComplete: () => void;
  onCancel: () => void;
}

const STAGES = [
  { label: "Anatomy Synthesis", target: 72, color: "#c9a84c" },
  { label: "Armor Forging", target: 50, color: "#d4a84c" },
  { label: "Neural Lighting", target: 79, color: "#e0b84c" },
  { label: "Final Render", target: 30, color: "#c9984c" },
];

export function RenderingProgress({ progress, onComplete, onCancel }: RenderingProgressProps) {
  const [stageValues, setStageValues] = useState(STAGES.map(() => 0));

  useEffect(() => {
    const timers = STAGES.map((stage, i) => {
      return setTimeout(() => {
        setStageValues((prev) => {
          const next = [...prev];
          next[i] = stage.target;
          return next;
        });
      }, 300 + i * 400);
    });
    return () => timers.forEach(clearTimeout);
  }, []);

  useEffect(() => {
    if (progress >= 100) {
      const t = setTimeout(onComplete, 500);
      return () => clearTimeout(t);
    }
  }, [progress, onComplete]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: "rgba(0,0,0,0.85)" }}>
      <div
        className="w-full max-w-md mx-4 rounded-2xl p-6 relative"
        style={{
          background: "linear-gradient(135deg, #1a1510 0%, #0d0b08 100%)",
          border: "1px solid rgba(201,168,76,0.25)",
          boxShadow: "0 0 40px rgba(201,168,76,0.1)",
        }}
      >
        {/* Header */}
        <div className="text-center mb-6">
          <h2 className="text-lg font-bold text-[#c9a84c] font-display tracking-wide">AI Avatar Generation</h2>
          <p className="text-[10px] text-[#c9a84c]/50 uppercase tracking-[0.2em] mt-1">Neural Engine Active</p>
        </div>

        {/* Wireframe Avatar SVG */}
        <div className="flex justify-center mb-6">
          <svg viewBox="0 0 120 160" width="120" height="160" className="opacity-80">
            {/* Head outline */}
            <ellipse cx="60" cy="35" rx="20" ry="24" fill="none" stroke="#c9a84c" strokeWidth="1" opacity="0.6">
              <animate attributeName="opacity" values="0.4;0.8;0.4" dur="2s" repeatCount="indefinite" />
            </ellipse>
            {/* Face cross */}
            <line x1="60" y1="18" x2="60" y2="52" stroke="#c9a84c" strokeWidth="0.5" opacity="0.3" />
            <line x1="44" y1="35" x2="76" y2="35" stroke="#c9a84c" strokeWidth="0.5" opacity="0.3" />
            {/* Neck */}
            <line x1="55" y1="58" x2="55" y2="68" stroke="#c9a84c" strokeWidth="1" opacity="0.5" />
            <line x1="65" y1="58" x2="65" y2="68" stroke="#c9a84c" strokeWidth="1" opacity="0.5" />
            {/* Shoulders */}
            <path d="M55 68 Q40 68 28 80" fill="none" stroke="#c9a84c" strokeWidth="1" opacity="0.5" />
            <path d="M65 68 Q80 68 92 80" fill="none" stroke="#c9a84c" strokeWidth="1" opacity="0.5" />
            {/* Torso */}
            <path d="M28 80 L32 130 Q60 138 88 130 L92 80" fill="none" stroke="#c9a84c" strokeWidth="1" opacity="0.5">
              <animate attributeName="opacity" values="0.3;0.6;0.3" dur="3s" repeatCount="indefinite" />
            </path>
            {/* Arms */}
            <path d="M28 80 L18 110 L22 135" fill="none" stroke="#c9a84c" strokeWidth="1" opacity="0.4" />
            <path d="M92 80 L102 110 L98 135" fill="none" stroke="#c9a84c" strokeWidth="1" opacity="0.4" />
            {/* Legs */}
            <line x1="45" y1="130" x2="40" y2="158" stroke="#c9a84c" strokeWidth="1" opacity="0.4" />
            <line x1="75" y1="130" x2="80" y2="158" stroke="#c9a84c" strokeWidth="1" opacity="0.4" />
            {/* Scan line */}
            <line x1="15" y1="0" x2="105" y2="0" stroke="#c9a84c" strokeWidth="2" opacity="0.6">
              <animate attributeName="y1" values="10;150;10" dur="3s" repeatCount="indefinite" />
              <animate attributeName="y2" values="10;150;10" dur="3s" repeatCount="indefinite" />
            </line>
          </svg>
        </div>

        {/* Stage Progress Bars */}
        <div className="space-y-3 mb-5">
          {STAGES.map((stage, i) => (
            <div key={stage.label}>
              <div className="flex justify-between items-center mb-1">
                <span className="text-[10px] text-[#c9a84c]/70 uppercase tracking-wider font-bold">{stage.label}</span>
                <span className="text-[10px] text-[#c9a84c]/50 font-mono">{stageValues[i]}%</span>
              </div>
              <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: "rgba(201,168,76,0.1)" }}>
                <div
                  className="h-full rounded-full transition-all duration-1000 ease-out"
                  style={{
                    width: `${stageValues[i]}%`,
                    backgroundColor: stage.color,
                    boxShadow: `0 0 8px ${stage.color}40`,
                  }}
                />
              </div>
            </div>
          ))}
        </div>

        {/* Main Progress Bar */}
        <div className="mb-4">
          <div className="flex justify-between items-center mb-1.5">
            <span className="text-[10px] text-[#c9a84c] uppercase tracking-[0.15em] font-bold">
              NANO BANANA ENGINE RENDERING...
            </span>
            <span className="text-xs text-[#c9a84c] font-mono font-bold">{Math.round(progress)}%</span>
          </div>
          <div className="h-3 rounded-full overflow-hidden" style={{ backgroundColor: "rgba(201,168,76,0.1)", border: "1px solid rgba(201,168,76,0.15)" }}>
            <div
              className="h-full rounded-full transition-all duration-300 ease-out"
              style={{
                width: `${progress}%`,
                background: "linear-gradient(90deg, #c9a84c, #e0c068)",
                boxShadow: "0 0 12px rgba(201,168,76,0.4)",
              }}
            />
          </div>
        </div>

        {/* Cancel Button */}
        <div className="text-center">
          <button
            onClick={onCancel}
            className="text-[10px] text-gray-500 hover:text-gray-300 uppercase tracking-wider transition-colors"
          >
            Cancel Rendering
          </button>
        </div>
      </div>
    </div>
  );
}
