export const TABLE_SEATS = [
  { x: 50, y: 88, scale: 1.0  },  // 0: Hero (bottom center)
  { x: 15, y: 75, scale: 0.85 },  // 1: bottom-left
  { x: 8,  y: 50, scale: 0.75 },  // 2: left
  { x: 15, y: 25, scale: 0.65 },  // 3: top-left
  { x: 32, y: 10, scale: 0.58 },  // 4: top-left-center
  { x: 50, y: 6,  scale: 0.55 },  // 5: top-center
  { x: 68, y: 10, scale: 0.58 },  // 6: top-right-center
  { x: 85, y: 25, scale: 0.65 },  // 7: top-right
  { x: 92, y: 50, scale: 0.75 },  // 8: right
  { x: 85, y: 75, scale: 0.85 },  // 9: bottom-right
];

export const DEALER_POSITIONS = [
  { x: 50, y: 78 },
  { x: 24, y: 68 },
  { x: 17, y: 50 },
  { x: 24, y: 32 },
  { x: 38, y: 20 },
  { x: 52, y: 18 },
  { x: 62, y: 20 },
  { x: 76, y: 32 },
  { x: 83, y: 50 },
  { x: 76, y: 68 },
];

export type QualityLevel = "low" | "medium" | "high";

export const QUALITY_CONFIG = {
  low: { shadows: false, particles: 0, antialias: false, shadowMapSize: 512, dpr: 1, bloom: false, ao: false },
  medium: { shadows: true, particles: 25, antialias: true, shadowMapSize: 1024, dpr: 1.5, bloom: true, ao: false },
  high: { shadows: true, particles: 50, antialias: true, shadowMapSize: 2048, dpr: 2, bloom: true, ao: true },
};
