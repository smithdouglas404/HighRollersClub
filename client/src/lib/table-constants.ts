export const TABLE_SEATS = [
  { x: 50, y: 88, scale: 1.0  },
  { x: 15, y: 75, scale: 0.88 },
  { x: 10, y: 50, scale: 0.78 },
  { x: 15, y: 25, scale: 0.68 },
  { x: 35, y: 12, scale: 0.60 },
  { x: 65, y: 12, scale: 0.60 },
  { x: 85, y: 25, scale: 0.68 },
  { x: 90, y: 50, scale: 0.78 },
  { x: 85, y: 75, scale: 0.88 },
];

export const DEALER_POSITIONS = [
  { x: 50, y: 78 },
  { x: 24, y: 68 },
  { x: 18, y: 50 },
  { x: 24, y: 32 },
  { x: 40, y: 22 },
  { x: 60, y: 22 },
  { x: 76, y: 32 },
  { x: 82, y: 50 },
  { x: 76, y: 68 },
];

export type QualityLevel = "low" | "medium" | "high";

export const QUALITY_CONFIG = {
  low: { shadows: false, particles: 0, antialias: false, shadowMapSize: 512, dpr: 1, bloom: false, ao: false },
  medium: { shadows: true, particles: 25, antialias: true, shadowMapSize: 1024, dpr: 1.5, bloom: true, ao: false },
  high: { shadows: true, particles: 50, antialias: true, shadowMapSize: 2048, dpr: 2, bloom: true, ao: true },
};
