import { useThree } from "@react-three/fiber";
import { useEffect } from "react";
import * as THREE from "three";

/**
 * Blueprint Section 4 — Camera modes
 * Hero Overview: default mode, slightly elevated cinematic angle,
 * all players and board visible.
 * Fixed. No orbit controls. Directed, premium, legible.
 */
export function CameraRig() {
  const { camera } = useThree();

  useEffect(() => {
    if (camera instanceof THREE.PerspectiveCamera) {
      camera.fov = 38;
      camera.near = 0.1;
      camera.far = 50;
      camera.updateProjectionMatrix();
    }

    // Hero Overview — 3/4 top-down, slightly in front, looking at table center
    camera.position.set(0, 5.5, 4.0);
    camera.lookAt(0, 0, -0.1);
  }, [camera]);

  return null;
}
