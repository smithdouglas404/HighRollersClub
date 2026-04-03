import * as THREE from "three";

export function createGunmetalMaterial(): THREE.MeshPhysicalMaterial {
  return new THREE.MeshPhysicalMaterial({
    color: new THREE.Color("#1a1d24"),
    roughness: 0.32,
    metalness: 0.95,
    clearcoat: 0.3,
    clearcoatRoughness: 0.4,
    reflectivity: 0.8,
    envMapIntensity: 1.2,
  });
}

export function createGoldMaterial(): THREE.MeshPhysicalMaterial {
  return new THREE.MeshPhysicalMaterial({
    color: new THREE.Color("#c9942e"),
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

export function createCyanEmissiveMaterial(intensity = 0.8): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: new THREE.Color("#1a3040"),
    emissive: new THREE.Color("#58f1ff"),
    emissiveIntensity: intensity,
    roughness: 0.35,
    metalness: 0.5,
    transparent: true,
    opacity: 0.95,
  });
}

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
