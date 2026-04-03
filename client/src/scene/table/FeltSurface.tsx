import { useMemo } from "react";
import * as THREE from "three";
import { createFeltMaterial } from "../materials/feltMaterial";

export function FeltSurface() {
  const { geometry, material } = useMemo(() => {
    const geo = new THREE.CylinderGeometry(1, 1, 0.012, 96);
    geo.scale(2.28, 1, 1.5);
    const mat = createFeltMaterial();
    return { geometry: geo, material: mat };
  }, []);

  return (
    <mesh geometry={geometry} material={material} position={[0, 0.007, 0]} receiveShadow />
  );
}
