import * as THREE from "three";

/**
 * Dark gunmetal rail material — wide structural ring.
 * MeshPhysicalMaterial for environment map reflections.
 * Roughness 0.35 gives brushed-metal look, metalness 0.92 for full metal response.
 */
export function createGunmetalMaterial(): THREE.MeshPhysicalMaterial {
  return new THREE.MeshPhysicalMaterial({
    color: new THREE.Color("#141a23"),
    roughness: 0.35,
    metalness: 0.92,
    envMapIntensity: 0.8,
  });
}

/**
 * Premium gold outer ring — prestige accent.
 * High metalness + low roughness + clearcoat for sharp reflections.
 */
export function createGoldMaterial(): THREE.MeshPhysicalMaterial {
  return new THREE.MeshPhysicalMaterial({
    color: new THREE.Color("#c9942e"),
    roughness: 0.25,
    metalness: 0.95,
    envMapIntensity: 1.2,
    clearcoat: 0.3,
    clearcoatRoughness: 0.1,
  });
}

/**
 * Cyan emissive material for seat rings and accent rings.
 * Self-illuminating — bloom picks this up above the luminance threshold.
 */
export function createCyanEmissiveMaterial(intensity = 0.6): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: new THREE.Color("#1a3040"),
    emissive: new THREE.Color("#58f1ff"),
    emissiveIntensity: intensity,
    roughness: 0.3,
    metalness: 0.5,
  });
}

/**
 * Dark structural underbody material — table base.
 */
export function createUnderbodyMaterial(): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: new THREE.Color("#0a0c10"),
    roughness: 0.7,
    metalness: 0.3,
  });
}
