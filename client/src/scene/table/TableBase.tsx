import { useMemo } from "react";
import * as THREE from "three";
import { createUnderbodyMaterial } from "../materials/metalMaterial";

/**
 * Blueprint Section 5 — TableBase
 * Elliptical geometry, dark structural underbody, premium silhouette.
 * Stacked layers for visible vertical depth.
 */
export function TableBase() {
  const parts = useMemo(() => {
    const rx = 2.5;
    const rz = 1.65;

    // Bottom slab — grounds the table
    const bottomGeo = new THREE.CylinderGeometry(1, 1.01, 0.05, 96);
    bottomGeo.scale(rx, 1, rz);
    const bottomMat = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color("#050709"),
      roughness: 0.7,
      metalness: 0.3,
    });

    // Mid body — main structural mass
    const midGeo = new THREE.CylinderGeometry(1, 1, 0.12, 96);
    midGeo.scale(rx * 0.98, 1, rz * 0.98);
    const midMat = createUnderbodyMaterial();

    // Top ledge — where the rail sits
    const topGeo = new THREE.CylinderGeometry(1, 1, 0.04, 96);
    topGeo.scale(rx * 1.01, 1, rz * 1.01);
    const topMat = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color("#0d1118"),
      roughness: 0.45,
      metalness: 0.5,
      clearcoat: 0.2,
      envMapIntensity: 0.5,
    });

    return { bottomGeo, bottomMat, midGeo, midMat, topGeo, topMat };
  }, []);

  return (
    <group position={[0, -0.1, 0]}>
      <mesh geometry={parts.bottomGeo} material={parts.bottomMat} receiveShadow castShadow />
      <mesh geometry={parts.midGeo} material={parts.midMat} position={[0, 0.085, 0]} receiveShadow castShadow />
      <mesh geometry={parts.topGeo} material={parts.topMat} position={[0, 0.165, 0]} receiveShadow castShadow />
    </group>
  );
}
