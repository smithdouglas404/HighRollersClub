import { useMemo } from "react";
import * as THREE from "three";
import { createUnderbodyMaterial } from "../materials/metalMaterial";

export function TableBase() {
  const { geometry, material } = useMemo(() => {
    const geo = new THREE.CylinderGeometry(1, 1, 0.12, 64);
    geo.scale(2.5, 1, 1.65);
    const mat = createUnderbodyMaterial();
    return { geometry: geo, material: mat };
  }, []);

  return (
    <group position={[0, -0.06, 0]}>
      <mesh geometry={geometry} material={material} receiveShadow castShadow />
    </group>
  );
}
