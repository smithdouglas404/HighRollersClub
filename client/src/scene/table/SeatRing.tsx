import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { createCyanEmissiveMaterial } from "../materials/metalMaterial";

function getSeatPositions(count: number, rx: number, rz: number): THREE.Vector3[] {
  const positions: THREE.Vector3[] = [];
  for (let i = 0; i < count; i++) {
    const angle = (Math.PI / 2) + (2 * Math.PI * i) / count;
    const x = rx * Math.cos(angle);
    const z = rz * Math.sin(angle);
    positions.push(new THREE.Vector3(x, 0.025, z));
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
  const baseIntensity = isWinner ? 0 : isActive ? 1.6 : 0.6;

  const material = useMemo(() => {
    if (isWinner) {
      return new THREE.MeshStandardMaterial({
        color: new THREE.Color("#3d2e0a"),
        emissive: new THREE.Color("#f2c660"),
        emissiveIntensity: 1.4,
        roughness: 0.25,
        metalness: 0.8,
      });
    }
    return createCyanEmissiveMaterial(baseIntensity);
  }, [isWinner, isActive, baseIntensity]);

  const geometry = useMemo(() => new THREE.TorusGeometry(0.13, 0.014, 12, 32), []);

  useFrame(({ clock }) => {
    if (meshRef.current && isActive && !isWinner) {
      const mat = meshRef.current.material as THREE.MeshStandardMaterial;
      const pulse = Math.sin(clock.getElapsedTime() * 3) * 0.3 + 0.7;
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
  const positions = useMemo(() => getSeatPositions(count, 2.62, 1.72), [count]);

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
