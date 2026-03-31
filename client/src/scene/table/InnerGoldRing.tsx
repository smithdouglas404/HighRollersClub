import { useMemo } from "react";
import * as THREE from "three";
import { createGoldMaterial } from "../materials/metalMaterial";

/**
 * Gold outer ring — Layer 5.
 * Premium accent matching CSS 6px gold (23px - 17px).
 * rx midpoint ~2.40, visible width 0.06, h=0.06.
 * Slightly thinner than gunmetal — reads as accent, not structure.
 */
export function InnerGoldRing() {
  const geometry = useMemo(() => {
    const shape = new THREE.Shape();
    const outerR = 1;
    const innerR = 0.975; // ratio: inner 2.37 / outer 2.43
    shape.absarc(0, 0, outerR, 0, Math.PI * 2, false);
    const hole = new THREE.Path();
    hole.absarc(0, 0, innerR, 0, Math.PI * 2, true);
    shape.holes.push(hole);

    const geo = new THREE.ExtrudeGeometry(shape, {
      depth: 0.06,
      bevelEnabled: false,
      curveSegments: 64,
    });
    geo.rotateX(-Math.PI / 2);
    geo.scale(2.43, 1, 1.602);
    return geo;
  }, []);

  const material = useMemo(() => createGoldMaterial(), []);

  return (
    <mesh geometry={geometry} material={material} position={[0, -0.01, 0]} castShadow />
  );
}
