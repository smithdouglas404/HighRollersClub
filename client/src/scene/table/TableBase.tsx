import { useMemo } from "react";
import * as THREE from "three";
import { createUnderbodyMaterial } from "../materials/metalMaterial";

/**
 * Table base — Layer 6.
 * Structural underbody that sits beneath all rings.
 * Largest ellipse, darkest material.
 * rx=2.55, rz=1.68, h=0.12.
 */
export function TableBase() {
  const geometry = useMemo(() => {
    const geo = new THREE.CylinderGeometry(1, 1, 0.12, 64);
    geo.scale(2.55, 1, 1.68);
    return geo;
  }, []);

  const material = useMemo(() => createUnderbodyMaterial(), []);

  return (
    <mesh geometry={geometry} material={material} position={[0, -0.06, 0]} receiveShadow />
  );
}
