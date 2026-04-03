import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { createCyanEmissiveMaterial } from "../materials/metalMaterial";

/**
 * Blueprint Section 5 — SeatRingGroup
 * 10 seat positions, emissive cyan rings, optional gold highlight for active or winning seat.
 * Positions on the rail perimeter.
 */

function getSeatPositions(count: number, rx: number, rz: number): THREE.Vector3[] {
  const positions: THREE.Vector3[] = [];
  for (let i = 0; i < count; i++) {
    // Start from bottom center (6 o'clock), go clockwise
    const angle = (Math.PI / 2) + (2 * Math.PI * i) / count;
    const x = rx * Math.cos(angle);
    const z = rz * Math.sin(angle);
    positions.push(new THREE.Vector3(x, 0.09, z));
  }
  return positions;
}

interface SeatRingGroupProps {
  count?: number;
  activeSeat?: number;
  winnerSeat?: number;
}

function SeatRing({ position, isActive, isWinner }: { position: THREE.Vector3; isActive: boolean; isWinner: boolean }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const baseIntensity = isWinner ? 0 : isActive ? 2.0 : 0.6;

  const material = useMemo(() => {
    if (isWinner) {
      // Gold highlight — matches --gold from HTML
      return new THREE.MeshStandardMaterial({
        color: new THREE.Color("#3d2e0a"),
        emissive: new THREE.Color("#f2c660"),
        emissiveIntensity: 1.6,
        roughness: 0.25,
        metalness: 0.8,
      });
    }
    return createCyanEmissiveMaterial(baseIntensity);
  }, [isWinner, isActive, baseIntensity]);

  // Larger ring — matches 98px avatar scale from HTML
  const geometry = useMemo(() => new THREE.TorusGeometry(0.15, 0.016, 16, 48), []);

  useFrame(({ clock }) => {
    if (meshRef.current && isActive && !isWinner) {
      const mat = meshRef.current.material as THREE.MeshStandardMaterial;
      const pulse = Math.sin(clock.getElapsedTime() * 3) * 0.4 + 0.6;
      mat.emissiveIntensity = baseIntensity * pulse;
    }
  });

  return (
    <mesh
      ref={meshRef}
      geometry={geometry}
      material={material}
      position={position}
      rotation={[Math.PI / 2, 0, 0]}
    />
  );
}

export function SeatRingGroup({ count = 10, activeSeat, winnerSeat }: SeatRingGroupProps) {
  // On the rail perimeter
  const positions = useMemo(() => getSeatPositions(count, 2.42, 1.58), [count]);

  return (
    <group>
      {positions.map((pos, i) => (
        <SeatRing
          key={i}
          position={pos}
          isActive={activeSeat === i}
          isWinner={winnerSeat === i}
        />
      ))}
    </group>
  );
}
