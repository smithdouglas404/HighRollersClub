import { useThree, useFrame } from "@react-three/fiber";
import { useCallback, useRef } from "react";
import * as THREE from "three";

function getSeatPositions3D(count: number, rx: number, rz: number): THREE.Vector3[] {
  const positions: THREE.Vector3[] = [];
  for (let i = 0; i < count; i++) {
    const angle = (Math.PI / 2) + (2 * Math.PI * i) / count;
    const x = rx * Math.cos(angle);
    const z = rz * Math.sin(angle);
    positions.push(new THREE.Vector3(x, 0.05, z));
  }
  return positions;
}

const SEAT_POSITIONS_3D = getSeatPositions3D(10, 2.62, 1.72);

interface SeatProjectionProps {
  onUpdate: (positions: { x: number; y: number }[]) => void;
}

export function SeatProjection({ onUpdate }: SeatProjectionProps) {
  const { camera, size } = useThree();
  const lastRef = useRef<string>("");

  useFrame(() => {
    const projected: { x: number; y: number }[] = [];
    for (const pos3d of SEAT_POSITIONS_3D) {
      const v = pos3d.clone().project(camera);
      const x = ((v.x + 1) / 2) * 100;
      const y = ((1 - v.y) / 2) * 100;
      projected.push({ x, y });
    }

    const key = projected.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join("|");
    if (key !== lastRef.current) {
      lastRef.current = key;
      onUpdate(projected);
    }
  });

  return null;
}

export { SEAT_POSITIONS_3D };
