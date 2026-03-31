import { useMemo } from "react";
import * as THREE from "three";
import { createFeltMaterial } from "../materials/feltMaterial";

/**
 * Felt playing surface — Layer 1.
 * CircleGeometry for radial UVs, elliptically scaled.
 * h=0.03 for visible thickness.
 */
export function FeltSurface() {
  const geometry = useMemo(() => {
    const geo = new THREE.CylinderGeometry(1, 1, 0.03, 64);
    geo.scale(2.20, 1, 1.45);
    return geo;
  }, []);

  const material = useMemo(() => createFeltMaterial(), []);

  // Also need UVs for the gradient — inject radial UVs onto the top face
  useMemo(() => {
    const uv = geometry.attributes.uv;
    const pos = geometry.attributes.position;
    const rx = 2.20, rz = 1.45;
    for (let i = 0; i < uv.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const z = pos.getZ(i);
      // Only remap top face UVs (Y > 0)
      if (y > 0.01) {
        uv.setXY(i, (x / rx + 1) * 0.5, (z / rz + 1) * 0.5);
      }
    }
    uv.needsUpdate = true;
  }, [geometry]);

  return (
    <mesh geometry={geometry} material={material} position={[0, 0.015, 0]} receiveShadow />
  );
}
