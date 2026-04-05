interface SparklineProps {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
  fillOpacity?: number;
  className?: string;
}

export function Sparkline({
  data,
  width = 120,
  height = 32,
  color = "#d4af37",
  fillOpacity = 0.15,
  className,
}: SparklineProps) {
  if (!data.length) return null;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const padding = 2;
  const w = width - padding * 2;
  const h = height - padding * 2;

  // Guard: single data point would cause division by zero (data.length - 1 === 0)
  if (data.length < 2) {
    const midY = padding + h / 2;
    const linePath = `M${padding},${midY} L${padding + w},${midY}`;
    const fillPath = `${linePath} L${padding + w},${padding + h} L${padding},${padding + h} Z`;
    return (
      <svg width={width} height={height} className={className} viewBox={`0 0 ${width} ${height}`}>
        <path d={fillPath} fill={color} fillOpacity={fillOpacity} />
        <path d={linePath} fill="none" stroke={color} strokeWidth={1.5} />
      </svg>
    );
  }

  const points = data.map((v, i) => {
    const x = padding + (i / (data.length - 1)) * w;
    const y = padding + h - ((v - min) / range) * h;
    return `${x},${y}`;
  });

  const linePath = `M${points.join(" L")}`;
  const fillPath = `${linePath} L${padding + w},${padding + h} L${padding},${padding + h} Z`;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={className}
      style={{ overflow: "visible" }}
    >
      <defs>
        <linearGradient id={`sparkline-grad-${color.replace("#", "")}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={fillOpacity} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <path
        d={fillPath}
        fill={`url(#sparkline-grad-${color.replace("#", "")})`}
      />
      <path
        d={linePath}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* End dot */}
      {data.length > 0 && (
        <circle
          cx={padding + w}
          cy={padding + h - ((data[data.length - 1] - min) / range) * h}
          r={2.5}
          fill={color}
          style={{ filter: `drop-shadow(0 0 4px ${color})` }}
        />
      )}
    </svg>
  );
}
