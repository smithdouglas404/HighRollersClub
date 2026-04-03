import { useMemo } from "react";
import * as THREE from "three";

/**
 * From HTML .table::before — inner decorative ring at 7% inset.
 * border: 2px solid rgba(88,241,255,0.35)
 * box-shadow: inset 0 0 16px rgba(88,241,255,0.1)
 */
export function InnerDecorativeRing() {
  const { geometry, material } = useMemo(() => {
    // 7% inset from felt edge
    const geo = new THREE.TorusGeometry(1, 0.008, 12, 96);
    geo.scale(2.04, 1, 1.34);
    const mat = new THREE.MeshStandardMaterial({
      color: new THREE.Color("#1a3040"),
      emissive: new THREE.Color("#58f1ff"),
      emissiveIntensity: 0.35,
      roughness: 0.4,
      metalness: 0.3,
      transparent: true,
      opacity: 0.7,
    });
    return { geometry: geo, material: mat };
  }, []);

  return (
    <mesh
      geometry={geometry}
      material={material}
      position={[0, 0.078, 0]}
      rotation={[Math.PI / 2, 0, 0]}
    />
  );
}
