import { useMemo } from "react";
import * as THREE from "three";
import { createFeltMaterial } from "../materials/feltMaterial";

/**
 * Blueprint Section 5 — FeltSurface
 * Custom shader material with woven felt depth and center-weighted lighting falloff.
 * Sits inside the rail, slightly recessed.
 */
export function FeltSurface() {
  const { geometry, material } = useMemo(() => {
    // Slightly smaller than rail to create visible lip
    const geo = new THREE.CylinderGeometry(1, 1, 0.012, 96);
    geo.scale(2.2, 1, 1.44);
    const mat = createFeltMaterial();
    return { geometry: geo, material: mat };
  }, []);

  return (
    <mesh geometry={geometry} material={material} position={[0, 0.07, 0]} receiveShadow />
  );
}
