import { useMemo } from "react";
import * as THREE from "three";
import { createCyanEmissiveMaterial, createGunmetalMaterial } from "../materials/metalMaterial";

/**
 * Inner cyan accent ring — Layer 3.
 * Thin glowing accent matching CSS 5px cyan.
 * rx=2.25 (midpoint), width ~0.05, h=0.05.
 */
function CyanAccentRing() {
  const geometry = useMemo(() => {
    // Hollow cylinder: outer=2.28, inner=2.20, height=0.05
    const shape = new THREE.Shape();
    const outerR = 1; // will be scaled
    const innerR = 0.978; // ratio 2.20/2.25 ≈ 0.978
    shape.absarc(0, 0, outerR, 0, Math.PI * 2, false);
    const hole = new THREE.Path();
    hole.absarc(0, 0, innerR, 0, Math.PI * 2, true);
    shape.holes.push(hole);

    const geo = new THREE.ExtrudeGeometry(shape, {
      depth: 0.05,
      bevelEnabled: false,
      curveSegments: 64,
    });
    // Rotate so extrusion goes up (Y axis)
    geo.rotateX(-Math.PI / 2);
    // Scale to ellipse
    geo.scale(2.25, 1, 1.483);
    return geo;
  }, []);

  const material = useMemo(() => createCyanEmissiveMaterial(0.6), []);

  return (
    <mesh geometry={geometry} material={material} position={[0, 0.0, 0]} />
  );
}

/**
 * Dark gunmetal rail — Layer 4.
 * Wide structural ring matching CSS 12px dark gap.
 * rx midpoint ~2.31, visible width 0.12, h=0.08 (thickest ring).
 */
function GunmetalRail() {
  const geometry = useMemo(() => {
    const shape = new THREE.Shape();
    const outerR = 1;
    const innerR = 0.949; // ratio: inner 2.25 / outer 2.37
    shape.absarc(0, 0, outerR, 0, Math.PI * 2, false);
    const hole = new THREE.Path();
    hole.absarc(0, 0, innerR, 0, Math.PI * 2, true);
    shape.holes.push(hole);

    const geo = new THREE.ExtrudeGeometry(shape, {
      depth: 0.08,
      bevelEnabled: false,
      curveSegments: 64,
    });
    geo.rotateX(-Math.PI / 2);
    geo.scale(2.37, 1, 1.562);
    return geo;
  }, []);

  const material = useMemo(() => createGunmetalMaterial(), []);

  return (
    <mesh geometry={geometry} material={material} position={[0, -0.02, 0]} castShadow receiveShadow />
  );
}

/**
 * Combined outer ring structure: cyan accent + gunmetal rail.
 * Gold ring is handled separately by InnerGoldRing.tsx.
 */
export function OuterMetalRing() {
  return (
    <group>
      <CyanAccentRing />
      <GunmetalRail />
    </group>
  );
}
