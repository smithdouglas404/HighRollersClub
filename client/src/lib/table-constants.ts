// Seat positions as % of the poker-table-container (16:9 aspect ratio).
// Positioned around the table ellipse (80% wide × 65% tall, centered).
// `scale` drives CSS custom property --seat-scale which the portrait-card
// clamp uses, so everything shrinks proportionally with the container.
// Seat positions as % of the table-image overlay div (1408x768 aspect).
// Seats sit on/just outside the rail edge of the poker table image.
export const TABLE_SEATS = [
  { x: 50.0, y: 91.0, scale: 1.0  },  // 0: Hero (6 o'clock) — full size
  { x: 17.0, y: 80.0, scale: 0.95 },  // 1: bottom-left (7 o'clock)
  { x: 3.5,  y: 50.0, scale: 0.92 },  // 2: left (9 o'clock)
  { x: 13.0, y: 18.0, scale: 0.88 },  // 3: top-left (11 o'clock)
  { x: 33.0, y: 4.0,  scale: 0.86 },  // 4: top-left-center
  { x: 50.0, y: 0.0,  scale: 0.85 },  // 5: top-center (12 o'clock) — smallest
  { x: 67.0, y: 4.0,  scale: 0.86 },  // 6: top-right-center
  { x: 87.0, y: 18.0, scale: 0.88 },  // 7: top-right (1 o'clock)
  { x: 96.5, y: 50.0, scale: 0.92 },  // 8: right (3 o'clock)
  { x: 83.0, y: 80.0, scale: 0.95 },  // 9: bottom-right (5 o'clock)
];

// Dealer button sits between the seat and the felt center
export const DEALER_POSITIONS = [
  { x: 50.0, y: 80 },
  { x: 25,   y: 72 },
  { x: 14,   y: 50 },
  { x: 22,   y: 28 },
  { x: 38,   y: 15 },
  { x: 50,   y: 12 },
  { x: 62,   y: 15 },
  { x: 78,   y: 28 },
  { x: 86,   y: 50 },
  { x: 75,   y: 72 },
];

export type QualityLevel = "low" | "medium" | "high";

export const QUALITY_CONFIG = {
  low: { shadows: false, particles: 0, antialias: false, shadowMapSize: 512, dpr: 1, bloom: false, ao: false },
  medium: { shadows: true, particles: 25, antialias: true, shadowMapSize: 1024, dpr: 1.5, bloom: true, ao: false },
  high: { shadows: true, particles: 50, antialias: true, shadowMapSize: 2048, dpr: 2, bloom: true, ao: true },
};
