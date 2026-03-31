import { Canvas } from "@react-three/fiber";
import { Suspense, useState } from "react";
import * as THREE from "three";
import { SceneRoot } from "./SceneRoot";

interface PokerSceneCanvasProps {
  quality?: "low" | "medium" | "high" | "cinematic";
  activeSeat?: number;
  winnerSeat?: number;
  className?: string;
}

export function PokerSceneCanvas({
  quality = "high",
  activeSeat,
  winnerSeat,
  className,
}: PokerSceneCanvasProps) {
  const [error, setError] = useState(false);
  const dpr = quality === "cinematic" ? 2 : quality === "high" ? 1.5 : quality === "medium" ? 1.25 : 1;

  if (error) {
    return (
      <div className={className} style={{ display: "flex", alignItems: "center", justifyContent: "center", color: "#ff6e72" }}>
        <p>3D rendering failed. Your browser may not support WebGL.</p>
      </div>
    );
  }

  return (
    <div className={className} style={{ width: "100%", height: "100%" }}>
      <Canvas
        dpr={dpr}
        shadows={quality !== "low"}
        gl={{
          antialias: quality !== "low",
          alpha: false,
          powerPreference: "high-performance",
        }}
        onCreated={({ gl }) => {
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          gl.toneMappingExposure = 1.1;
          gl.setClearColor(new THREE.Color("#070a10"), 1);
        }}
        onError={() => setError(true)}
      >
        <Suspense fallback={null}>
          <SceneRoot
            quality={quality}
            activeSeat={activeSeat}
            winnerSeat={winnerSeat}
          />
        </Suspense>
      </Canvas>
    </div>
  );
}
