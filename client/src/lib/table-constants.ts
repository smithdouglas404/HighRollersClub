export const TABLE_SEATS = [
  { x: 50, y: 85, scale: 1.0 },  // 0: Hero (bottom center)
  { x: 14, y: 72, scale: 1.0 },  // 1: bottom-left
  { x: 6,  y: 48, scale: 1.0 },  // 2: left
  { x: 14, y: 24, scale: 1.0 },  // 3: top-left
  { x: 32, y: 13, scale: 1.0 },  // 4: top-left-center
  { x: 50, y: 10, scale: 1.0 },  // 5: top-center
  { x: 68, y: 13, scale: 1.0 },  // 6: top-right-center
  { x: 86, y: 24, scale: 1.0 },  // 7: top-right
  { x: 94, y: 48, scale: 1.0 },  // 8: right
  { x: 86, y: 72, scale: 1.0 },  // 9: bottom-right
];

export const DEALER_POSITIONS = [
  { x: 50, y: 75 },
  { x: 23, y: 65 },
  { x: 16, y: 48 },
  { x: 23, y: 32 },
  { x: 38, y: 22 },
  { x: 52, y: 20 },
  { x: 62, y: 22 },
  { x: 77, y: 32 },
  { x: 84, y: 48 },
  { x: 77, y: 65 },
];

export type QualityLevel = "low" | "medium" | "high";

export const QUALITY_CONFIG = {
  low: { shadows: false, particles: 0, antialias: false, shadowMapSize: 512, dpr: 1, bloom: false, ao: false },
  medium: { shadows: true, particles: 25, antialias: true, shadowMapSize: 1024, dpr: 1.5, bloom: true, ao: false },
  high: { shadows: true, particles: 50, antialias: true, shadowMapSize: 2048, dpr: 2, bloom: true, ao: true },
};
