import { useMemo } from "react";
import * as THREE from "three";
import { createGunmetalMaterial } from "../materials/metalMaterial";

export function OuterMetalRing() {
  const { geometry, material } = useMemo(() => {
    const geo = new THREE.TorusGeometry(1, 0.07, 24, 96);
    geo.scale(2.42, 1, 1.6);
    const mat = createGunmetalMaterial();
    return { geometry: geo, material: mat };
  }, []);

  return (
    <mesh
      geometry={geometry}
      material={material}
      position={[0, 0.015, 0]}
      rotation={[Math.PI / 2, 0, 0]}
      castShadow
      receiveShadow
    />
  );
}
