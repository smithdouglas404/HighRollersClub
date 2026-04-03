import { useMemo } from "react";
import * as THREE from "three";
import { createGoldMaterial } from "../materials/metalMaterial";

export function InnerGoldRing() {
  const { geometry, material } = useMemo(() => {
    const geo = new THREE.TorusGeometry(1, 0.022, 20, 96);
    geo.scale(2.3, 1, 1.52);
    const mat = createGoldMaterial();
    return { geometry: geo, material: mat };
  }, []);

  return (
    <mesh
      geometry={geometry}
      material={material}
      position={[0, 0.02, 0]}
      rotation={[Math.PI / 2, 0, 0]}
    />
  );
}
