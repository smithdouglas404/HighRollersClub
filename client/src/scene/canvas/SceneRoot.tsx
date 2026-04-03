import { useMemo } from "react";
import { Environment } from "@react-three/drei";
import * as THREE from "three";
import { CameraRig } from "./CameraRig";
import { TableBase } from "../table/TableBase";
import { FeltSurface } from "../table/FeltSurface";
import { OuterMetalRing } from "../table/OuterMetalRing";
import { InnerGoldRing } from "../table/InnerGoldRing";
import { InnerDecorativeRing } from "../table/InnerDecorativeRing";
import { SeatRingGroup } from "../table/SeatRing";
import { BoardCardsGroup } from "../cards/BoardCardsGroup";
import { PlayersGroup } from "../players/PlayerSeat3D";
import { PlayerLabelsGroup } from "@/components/overlays/PlayerLabelOverlay";
import { PotOverlay } from "@/components/overlays/PotOverlay";
import { PostFx } from "../fx/PostFx";

/**
 * Blueprint Section 5 — Full scene graph.
 *
 * <SceneRoot>
 *   <EnvironmentLights />
 *   <TableRoot> (TableBase, Felt, Rings, SeatRings) </TableRoot>
 *   <PlayersGroup> (PlayerSeat3D × 10) </PlayersGroup>
 *   <BoardCardsGroup />
 *   <PlayerLabelsGroup /> (DOM overlays anchored to 3D)
 *   <PotOverlay /> (DOM overlay)
 *   <CameraRig />
 *   <PostFx />
 * </SceneRoot>
 */

// Generate 10 seat positions on the rail perimeter
function getSeatPositions(count: number, rx: number, rz: number): THREE.Vector3[] {
  const positions: THREE.Vector3[] = [];
  for (let i = 0; i < count; i++) {
    const angle = (Math.PI / 2) + (2 * Math.PI * i) / count;
    const x = rx * Math.cos(angle);
    const z = rz * Math.sin(angle);
    positions.push(new THREE.Vector3(x, 0.09, z));
  }
  return positions;
}

interface SceneRootProps {
  quality?: "low" | "medium" | "high" | "cinematic";
  activeSeat?: number;
  winnerSeat?: number;
}

export function SceneRoot({ quality = "high", activeSeat, winnerSeat }: SceneRootProps) {
  const shadowRes = quality === "low" ? 512 : quality === "medium" ? 1024 : 2048;
  const seatPositions = useMemo(() => getSeatPositions(10, 2.42, 1.58), []);

  return (
    <>
      <CameraRig />

      {/* Environment map — critical for gunmetal + gold metal reflections */}
      <Environment
        preset="night"
        environmentIntensity={0.5}
        environmentRotation={[0, Math.PI / 4, 0]}
      />

      {/* Primary overhead spot — pools light on felt center (matches HTML radial-gradient at 50% 45%) */}
      <spotLight
        position={[0, 8, -0.5]}
        angle={0.5}
        penumbra={0.85}
        intensity={4.0}
        color="#fff5e0"
        castShadow
        shadow-mapSize-width={shadowRes}
        shadow-mapSize-height={shadowRes}
        shadow-bias={-0.0003}
        shadow-normalBias={0.02}
      />

      {/* Secondary fill — slightly angled for depth */}
      <spotLight
        position={[0, 6, 2.5]}
        angle={0.6}
        penumbra={0.9}
        intensity={1.0}
        color="#e8e0d0"
      />

      {/* Ambient — very low, prevents pure black */}
      <ambientLight intensity={0.06} color="#6080a0" />

      {/* Hemisphere — subtle sky/ground separation */}
      <hemisphereLight args={["#1a1a35", "#050508", 0.2]} />

      {/* Cyan rim lights — left & right, catch gunmetal edges (--cyan: #58f1ff) */}
      <pointLight position={[-5, 3, 0]} intensity={0.5} color="#58f1ff" distance={14} decay={2} />
      <pointLight position={[5, 3, 0]} intensity={0.5} color="#58f1ff" distance={14} decay={2} />

      {/* Gold accent — front warm fill (--gold: #f2c660) */}
      <pointLight position={[0, 3.5, -3.5]} intensity={0.3} color="#f2c660" distance={12} decay={2} />

      {/* Back fill — depth */}
      <pointLight position={[0, 2, 4]} intensity={0.1} color="#4040a0" distance={10} decay={2} />

      {/* TableRoot — Blueprint Section 5 */}
      <group>
        <TableBase />
        <FeltSurface />
        <OuterMetalRing />
        <InnerGoldRing />
        <InnerDecorativeRing />
        <SeatRingGroup
          count={10}
          activeSeat={activeSeat}
          winnerSeat={winnerSeat}
        />
      </group>

      {/* PlayersGroup — 3D seat anchors (Blueprint Section 5) */}
      <PlayersGroup seatPositions={seatPositions} />

      {/* BoardCardsGroup — 3D community cards on felt */}
      <BoardCardsGroup />

      {/* DOM overlays anchored to 3D positions (Blueprint Section 9) */}
      <PlayerLabelsGroup seatPositions={seatPositions} />
      <PotOverlay />

      <PostFx quality={quality} />
    </>
  );
}
