import { useMemo } from "react";
import * as THREE from "three";
import { createGoldMaterial } from "../materials/metalMaterial";

/**
 * Blueprint Section 5 — InnerGoldRing
 * Warm metallic contrast, restrained premium accent.
 * From HTML: 23px gold ring at rgba(242,198,96,0.98)
 */
export function InnerGoldRing() {
  const { geometry, material } = useMemo(() => {
    const geo = new THREE.TorusGeometry(1, 0.025, 24, 128);
    geo.scale(2.26, 1, 1.48);
    const mat = createGoldMaterial();
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
