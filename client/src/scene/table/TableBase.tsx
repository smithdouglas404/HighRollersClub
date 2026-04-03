import { useMemo } from "react";
import * as THREE from "three";
import { createUnderbodyMaterial } from "../materials/metalMaterial";

export function TableBase() {
  const { geometry, material } = useMemo(() => {
    const shape = new THREE.Shape();
    const rx = 2.5, rz = 1.65;
    const segments = 64;
    for (let i = 0; i <= segments; i++) {
      const angle = (i / segments) * Math.PI * 2;
      const x = rx * Math.cos(angle);
      const z = rz * Math.sin(angle);
      if (i === 0) shape.moveTo(x, z);
      else shape.lineTo(x, z);
    }
    const extrudeSettings = {
      depth: 0.14,
      bevelEnabled: true,
      bevelThickness: 0.02,
      bevelSize: 0.02,
      bevelSegments: 3,
    };
    const geo = new THREE.ExtrudeGeometry(shape, extrudeSettings);
    geo.rotateX(-Math.PI / 2);
    geo.translate(0, -0.14, 0);
    const mat = createUnderbodyMaterial();
    return { geometry: geo, material: mat };
  }, []);

  return <mesh geometry={geometry} material={material} receiveShadow castShadow />;
}
