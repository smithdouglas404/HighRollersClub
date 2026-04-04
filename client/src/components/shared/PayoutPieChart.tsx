interface PayoutSlice {
  position: number;
  percentage: number;
  label?: string;
}

interface PayoutPieChartProps {
  slices: PayoutSlice[];
  size?: number;
  className?: string;
}

const COLORS = [
  "#d4af37", // 1st - gold
  "#c0c0c0", // 2nd - silver
  "#cd7f32", // 3rd - bronze
  "#d4af37", // 4th - gold
  "#a855f7", // 5th - purple
  "#22c55e", // 6th - green
  "#f59e0b", // 7th - amber
  "#ef4444", // 8th - red
  "#6366f1", // 9th - indigo
  "#ec4899", // 10th - pink
];

export function PayoutPieChart({ slices, size = 160, className }: PayoutPieChartProps) {
  const center = size / 2;
  const radius = size / 2 - 8;
  const innerRadius = radius * 0.55;
  let startAngle = -90;

  const paths = slices.map((slice, i) => {
    const angle = (slice.percentage / 100) * 360;
    const endAngle = startAngle + angle;
    const startRad = (startAngle * Math.PI) / 180;
    const endRad = (endAngle * Math.PI) / 180;
    const largeArc = angle > 180 ? 1 : 0;

    const x1 = center + radius * Math.cos(startRad);
    const y1 = center + radius * Math.sin(startRad);
    const x2 = center + radius * Math.cos(endRad);
    const y2 = center + radius * Math.sin(endRad);
    const ix1 = center + innerRadius * Math.cos(startRad);
    const iy1 = center + innerRadius * Math.sin(startRad);
    const ix2 = center + innerRadius * Math.cos(endRad);
    const iy2 = center + innerRadius * Math.sin(endRad);

    const path = `M${ix1},${iy1} L${x1},${y1} A${radius},${radius} 0 ${largeArc} 1 ${x2},${y2} L${ix2},${iy2} A${innerRadius},${innerRadius} 0 ${largeArc} 0 ${ix1},${iy1}`;
    startAngle = endAngle;

    return (
      <path
        key={i}
        d={path}
        fill={COLORS[i % COLORS.length]}
        stroke="rgba(10,10,12,0.8)"
        strokeWidth={1.5}
        opacity={0.9}
      />
    );
  });

  return (
    <div className={className}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {paths}
        <circle cx={center} cy={center} r={innerRadius - 2} fill="rgba(10,10,12,0.9)" />
        <text x={center} y={center - 6} textAnchor="middle" fill="#d4af37" fontSize="14" fontWeight="800" fontFamily="var(--font-display)">
          PAYOUT
        </text>
        <text x={center} y={center + 10} textAnchor="middle" fill="white" fontSize="10" opacity="0.6">
          Distribution
        </text>
      </svg>
      <div className="mt-3 space-y-1">
        {slices.map((s, i) => (
          <div key={i} className="flex items-center gap-2 text-xs">
            <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: COLORS[i % COLORS.length] }} />
            <span className="text-white/60">{s.label || `${s.position}${s.position === 1 ? "st" : s.position === 2 ? "nd" : s.position === 3 ? "rd" : "th"}`}</span>
            <span className="ml-auto font-mono font-bold text-white/80">{s.percentage}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}
