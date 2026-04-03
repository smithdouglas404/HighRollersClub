import * as THREE from "three";

export function createFeltMaterial(): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: new THREE.Color("#1a7a4a"),
    roughness: 0.92,
    metalness: 0.0,
    side: THREE.FrontSide,
  });
}
