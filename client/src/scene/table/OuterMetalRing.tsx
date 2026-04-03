import { useMemo } from "react";
import * as THREE from "three";
import { createGunmetalMaterial, createCyanEmissiveMaterial } from "../materials/metalMaterial";

/**
 * Blueprint Section 5 — OuterMetalRing
 * Brushed dark gunmetal + soft cyan edge reflections.
 * From HTML: 5px cyan ring + 17px dark gap
 * Two layers: thick gunmetal rail + thin cyan accent edge.
 */
export function OuterMetalRing() {
  const parts = useMemo(() => {
    // Main rail — thick gunmetal (the 17px dark gap in HTML)
    const railGeo = new THREE.TorusGeometry(1, 0.09, 32, 128);
    railGeo.scale(2.38, 1, 1.56);
    const railMat = createGunmetalMaterial();

    // Cyan accent edge — thin emissive ring (the 5px cyan ring in HTML)
    const cyanGeo = new THREE.TorusGeometry(1, 0.02, 16, 128);
    cyanGeo.scale(2.48, 1, 1.63);
    const cyanMat = createCyanEmissiveMaterial(0.6);

    return { railGeo, railMat, cyanGeo, cyanMat };
  }, []);

  return (
    <group position={[0, 0.075, 0]} rotation={[Math.PI / 2, 0, 0]}>
      <mesh geometry={parts.railGeo} material={parts.railMat} castShadow receiveShadow />
      <mesh geometry={parts.cyanGeo} material={parts.cyanMat} />
    </group>
  );
}
