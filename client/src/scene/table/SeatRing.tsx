import { useMemo } from "react";
import * as THREE from "three";
import { createCyanEmissiveMaterial } from "../materials/metalMaterial";

/**
 * 10 seat positions around the table perimeter with non-uniform angular spacing.
 *
 * Anchor ellipse: rx=2.65, rz=1.75 (just outside gold ring at 2.43/1.602).
 * Seats sit at Y=0.03 (top of the gold ring level).
 *
 * Angular distribution compensates for perspective compression:
 * - Bottom (near camera): wider spacing
 * - Top (far from camera): tighter spacing
 * - So visual gaps between seats appear even on screen
 *
 * Scale compensation by distance from camera:
 * - Near (0,1,9): 1.0x
 * - Mid (2,8): 1.08x
 * - Far-mid (3,7): 1.15x
 * - Far (4,5,6): 1.20x
 */

interface SeatDef {
  angle: number; // degrees
  worldX: number;
  worldZ: number;
  scale: number;
}

// Pre-computed from the approved seat table
const SEAT_DEFS: SeatDef[] = [
  { angle: 90,  worldX:  0.00, worldZ:  1.75, scale: 1.00 }, // 0: Hero
  { angle: 126, worldX: -2.14, worldZ:  1.03, scale: 1.00 }, // 1: Bottom-left
  { angle: 162, worldX: -2.52, worldZ: -0.54, scale: 1.08 }, // 2: Left
  { angle: 198, worldX: -1.32, worldZ: -1.63, scale: 1.15 }, // 3: Top-left
  { angle: 216, worldX: -0.78, worldZ: -1.72, scale: 1.20 }, // 4: Top-left-center
  { angle: 234, worldX:  0.00, worldZ: -1.75, scale: 1.20 }, // 5: Top-center
  { angle: 252, worldX:  0.78, worldZ: -1.72, scale: 1.20 }, // 6: Top-right-center
  { angle: 288, worldX:  1.32, worldZ: -1.63, scale: 1.15 }, // 7: Top-right
  { angle: 306, worldX:  2.52, worldZ: -0.54, scale: 1.08 }, // 8: Right
  { angle: 342, worldX:  2.14, worldZ:  1.03, scale: 1.00 }, // 9: Bottom-right
];

/** Exported for other components to anchor to seat positions */
export { SEAT_DEFS };

interface SeatRingGroupProps {
  count?: number;
  activeSeat?: number;
  winnerSeat?: number;
}

export function SeatRingGroup({ count = 10, activeSeat, winnerSeat }: SeatRingGroupProps) {
  const seatGeo = useMemo(() => new THREE.TorusGeometry(0.12, 0.015, 8, 24), []);

  const defaultMat = useMemo(() => createCyanEmissiveMaterial(0.6), []);
  const activeMat = useMemo(() => createCyanEmissiveMaterial(1.4), []);
  const winnerMat = useMemo(() => {
    return new THREE.MeshStandardMaterial({
      color: new THREE.Color("#3d2e0a"),
      emissive: new THREE.Color("#f2c660"),
      emissiveIntensity: 1.2,
      roughness: 0.3,
      metalness: 0.7,
    });
  }, []);

  const seats = SEAT_DEFS.slice(0, count);

  return (
    <group>
      {seats.map((seat, i) => {
        const isActive = activeSeat === i;
        const isWinner = winnerSeat === i;
        const mat = isWinner ? winnerMat : isActive ? activeMat : defaultMat;

        return (
          <mesh
            key={i}
            geometry={seatGeo}
            material={mat}
            position={[seat.worldX, 0.03, seat.worldZ]}
            rotation={[Math.PI / 2, 0, 0]}
            scale={[seat.scale, seat.scale, seat.scale]}
          />
        );
      })}
    </group>
  );
}
