import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { createFeltMaterial } from "../materials/feltMaterial";

export function FeltSurface() {
  const meshRef = useRef<THREE.Mesh>(null);

  const { geometry, material } = useMemo(() => {
    const geo = new THREE.CylinderGeometry(1, 1, 0.012, 96);
    geo.scale(2.28, 1, 1.5);
    const mat = createFeltMaterial();
    return { geometry: geo, material: mat };
  }, []);

  useFrame(({ clock }) => {
    if (meshRef.current) {
      const mat = meshRef.current.material as THREE.ShaderMaterial;
      if (mat.uniforms?.uTime) {
        mat.uniforms.uTime.value = clock.getElapsedTime();
      }
    }
  });

  return (
    <mesh ref={meshRef} geometry={geometry} material={material} position={[0, 0.007, 0]} receiveShadow />
  );
}
