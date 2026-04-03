import * as THREE from "three";

/**
 * Blueprint Section 10 — Metal materials
 * Colors from poker-table-ui.html box-shadow ring system:
 *   Cyan ring: rgba(88,241,255,0.9)
 *   Dark gap: rgba(20,26,35,0.96)
 *   Gold ring: rgba(242,198,96,0.98)
 */

// Gunmetal outer ring — brushed dark metal, soft cyan edge reflections
export function createGunmetalMaterial(): THREE.MeshPhysicalMaterial {
  return new THREE.MeshPhysicalMaterial({
    color: new THREE.Color("#141a23"),   // rgba(20,26,35) from dark gap
    roughness: 0.32,
    metalness: 0.95,
    clearcoat: 0.3,
    clearcoatRoughness: 0.4,
    reflectivity: 0.8,
    envMapIntensity: 1.2,
  });
}

// Gold inner ring — rgba(242,198,96,0.98) from HTML
export function createGoldMaterial(): THREE.MeshPhysicalMaterial {
  return new THREE.MeshPhysicalMaterial({
    color: new THREE.Color("#f2c660"),   // exact gold from HTML
    roughness: 0.22,
    metalness: 0.98,
    emissive: new THREE.Color("#3d2e0a"),
    emissiveIntensity: 0.12,
    clearcoat: 0.5,
    clearcoatRoughness: 0.2,
    reflectivity: 1.0,
    envMapIntensity: 1.8,
  });
}

// Cyan emissive — rgba(88,241,255,0.9) from HTML for seat rings and accents
export function createCyanEmissiveMaterial(intensity = 0.8): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: new THREE.Color("#1a3040"),
    emissive: new THREE.Color("#58f1ff"),   // exact cyan from HTML
    emissiveIntensity: intensity,
    roughness: 0.35,
    metalness: 0.5,
    transparent: true,
    opacity: 0.95,
  });
}

// Dark table underbody
export function createUnderbodyMaterial(): THREE.MeshPhysicalMaterial {
  return new THREE.MeshPhysicalMaterial({
    color: new THREE.Color("#080a0f"),
    roughness: 0.6,
    metalness: 0.4,
    clearcoat: 0.15,
    clearcoatRoughness: 0.8,
    envMapIntensity: 0.3,
  });
}
