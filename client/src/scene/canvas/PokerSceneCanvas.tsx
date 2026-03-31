import { Canvas } from "@react-three/fiber";
import { Suspense } from "react";
import { SceneRoot } from "./SceneRoot";

/**
 * R3F Canvas wrapper — the rendered poker table scene.
 * Sized by parent container. Uses quality presets for DPR and performance.
 * Falls back gracefully on WebGL failure.
 */
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
  const dpr = quality === "cinematic" ? 2 : quality === "high" ? 1.5 : quality === "medium" ? 1.25 : 1;

  return (
    <div className={className} style={{ width: "100%", height: "100%", position: "relative" }}>
      <Canvas
        dpr={dpr}
        shadows={quality !== "low"}
        gl={{
          antialias: quality !== "low",
          alpha: true,
          powerPreference: "high-performance",
          toneMapping: 3, // ACESFilmicToneMapping
          toneMappingExposure: 1.1,
        }}
        style={{ background: "transparent" }}
        onCreated={({ gl }) => {
          gl.setClearColor(0x000000, 0);
        }}
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
