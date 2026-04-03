const cx = 50;
const cy = 46;
const rx = 38;
const ry = 40;
const count = 10;
const startAngle = Math.PI / 2;

export const TABLE_SEATS = Array.from({ length: count }, (_, i) => {
  const angle = startAngle - (2 * Math.PI * i) / count;
  return {
    x: cx + rx * Math.cos(angle),
    y: cy + ry * Math.sin(angle),
    scale: 1.0,
  };
});

export const DEALER_POSITIONS = TABLE_SEATS.map((seat) => {
  const dx = cx - seat.x;
  const dy = cy - seat.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const nx = dx / dist;
  const ny = dy / dist;
  return {
    x: seat.x + nx * 8,
    y: seat.y + ny * 8,
  };
});

export type QualityLevel = "low" | "medium" | "high";

export const QUALITY_CONFIG = {
  low: { shadows: false, particles: 0, antialias: false, shadowMapSize: 512, dpr: 1, bloom: false, ao: false },
  medium: { shadows: true, particles: 25, antialias: true, shadowMapSize: 1024, dpr: 1.5, bloom: true, ao: false },
  high: { shadows: true, particles: 50, antialias: true, shadowMapSize: 2048, dpr: 2, bloom: true, ao: true },
};
