import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { CameraRig } from "./CameraRig";
import { TableBase } from "../table/TableBase";
import { FeltSurface } from "../table/FeltSurface";
import { OuterMetalRing } from "../table/OuterMetalRing";
import { InnerGoldRing } from "../table/InnerGoldRing";
import { SeatRingGroup } from "../table/SeatRing";
import { PostFx } from "../fx/PostFx";
import type * as THREE from "three";

/**
 * Scene graph root — orchestrates all 3D scene children.
 *
 * Lighting strategy:
 * - Warm overhead spotlight on felt center (primary illumination)
 * - Cool ambient fill (low intensity, prevents pure black)
 * - Hemisphere light for subtle sky/ground color differentiation
 * - Environment map for metallic reflections on rings
 */
interface SceneRootProps {
  quality?: "low" | "medium" | "high" | "cinematic";
  activeSeat?: number;
  winnerSeat?: number;
}

export function SceneRoot({ quality = "high", activeSeat, winnerSeat }: SceneRootProps) {
  const feltRef = useRef<THREE.Mesh>(null);

  // Animate felt shimmer
  useFrame(({ clock }) => {
    if (feltRef.current) {
      const mat = feltRef.current.material as THREE.ShaderMaterial;
      if (mat.uniforms?.time) {
        mat.uniforms.time.value = clock.getElapsedTime();
      }
    }
  });

  return (
    <>
      <CameraRig />

      {/* ── Lighting ── */}

      {/* Primary overhead spotlight — warm center illumination on felt */}
      <spotLight
        position={[0, 7, 1]}
        angle={0.45}
        penumbra={0.9}
        intensity={3.0}
        color="#fff5e0"
        castShadow
        shadow-mapSize-width={quality === "low" ? 512 : 1024}
        shadow-mapSize-height={quality === "low" ? 512 : 1024}
        shadow-bias={-0.0005}
        target-position={[0, 0, 0]}
      />

      {/* Secondary fill spotlight — softer, slightly offset */}
      <spotLight
        position={[2, 5, -2]}
        angle={0.6}
        penumbra={1}
        intensity={0.8}
        color="#ffe8c0"
      />

      {/* Cool ambient fill — prevents pure black, adds depth */}
      <ambientLight intensity={0.12} color="#8ecbff" />

      {/* Hemisphere — subtle warm top / cool bottom separation */}
      <hemisphereLight args={["#1a1a30", "#050508", 0.2]} />

      {/* Rim accent lights — cyan fill from sides for metal ring response */}
      <pointLight position={[-4, 2, 0]} intensity={0.4} color="#58f1ff" distance={10} decay={2} />
      <pointLight position={[4, 2, 0]} intensity={0.4} color="#58f1ff" distance={10} decay={2} />

      {/* Back light for depth separation */}
      <pointLight position={[0, 2, -4]} intensity={0.2} color="#4a7fff" distance={8} decay={2} />

      {/* Warm fill from below for metal underside reflections */}
      <pointLight position={[0, -1, 0]} intensity={0.1} color="#1a1205" distance={8} />

      {/* ── Table Construction ── */}
      <group>
        <TableBase />
        <FeltSurface ref={feltRef} />
        <OuterMetalRing />
        <InnerGoldRing />

        {/* Inner decorative ring — matches CSS ::before at 7% inset */}
        <mesh position={[0, 0.018, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[1, 0.006, 8, 64]} />
          <meshStandardMaterial
            color="#1a3040"
            emissive="#58f1ff"
            emissiveIntensity={0.3}
            transparent
            opacity={0.5}
            roughness={0.5}
            metalness={0.4}
          />
        </mesh>

        <SeatRingGroup
          count={10}
          activeSeat={activeSeat}
          winnerSeat={winnerSeat}
        />
      </group>

      {/* ── Board card placeholder positions (5 spots at table center) ── */}
      <group position={[0, 0.02, 0]}>
        {[-0.48, -0.24, 0, 0.24, 0.48].map((xOff, i) => (
          <mesh key={`card-slot-${i}`} position={[xOff, 0, 0]}>
            <boxGeometry args={[0.18, 0.003, 0.26]} />
            <meshStandardMaterial
              color="#0d2818"
              transparent
              opacity={0.25}
              roughness={0.9}
            />
          </mesh>
        ))}
      </group>

      {/* ── Post-processing ── */}
      <PostFx quality={quality} />
    </>
  );
}
