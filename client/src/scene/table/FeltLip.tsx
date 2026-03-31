import { useMemo } from "react";
import * as THREE from "three";

/**
 * Felt lip — Layer 2.
 * Rounded torus at the felt edge giving it visible thickness.
 * Same color as the felt mid-tone so it reads as one continuous surface.
 */
export function FeltLip() {
  const geometry = useMemo(() => {
    const geo = new THREE.TorusGeometry(1, 0.025, 12, 64);
    geo.scale(2.20, 1, 1.45);
    return geo;
  }, []);

  const material = useMemo(() => {
    return new THREE.MeshStandardMaterial({
      color: new THREE.Color("#145f3c"),
      roughness: 0.90,
      metalness: 0.0,
    });
  }, []);

  return (
    <mesh
      geometry={geometry}
      material={material}
      position={[0, 0.03, 0]}
      rotation={[Math.PI / 2, 0, 0]}
    />
  );
}
