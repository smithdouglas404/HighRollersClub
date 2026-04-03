import { useRef, useEffect, useState } from "react";
import { useThree, useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import { useGameStore, type PlayerState } from "@/store/useGameStore";

/**
 * Blueprint Section 6/9 — PlayerLabelOverlay
 * Player labels as crisp DOM overlays anchored to 3D seat positions.
 * Text stays sharp and responsive. Three.js renders the table, not dense text.
 *
 * From HTML: .player-tag with glassmorphism styling,
 * .avatar with 98x98px, rounded-[22px], cyan border with glow.
 */

interface PlayerLabelProps {
  player: PlayerState;
  position: THREE.Vector3;
}

function PlayerLabel({ player, position }: PlayerLabelProps) {
  const isWinner = player.result === "win";
  const isFolded = player.status === "folded";

  // Border color from HTML: cyan default, gold for winner
  const borderColor = isWinner ? "#f2c660" : "#58f1ff";
  const glowColor = isWinner
    ? "0 0 10px rgba(242,198,96,0.45), 0 0 24px rgba(242,198,96,0.16)"
    : "0 0 10px rgba(88,241,255,0.65), 0 0 25px rgba(88,241,255,0.18)";

  return (
    <group position={position}>
      <Html
        center
        distanceFactor={5}
        style={{
          pointerEvents: "none",
          opacity: isFolded ? 0.5 : 1,
          filter: isFolded ? "grayscale(0.8)" : "none",
          transition: "opacity 0.3s, filter 0.3s",
        }}
      >
        <div style={{ textAlign: "center", width: 126 }}>
          {/* Avatar — from HTML: 98x98, rounded-22px, cyan border */}
          <div
            style={{
              width: 80,
              height: 80,
              margin: "0 auto 6px",
              borderRadius: 18,
              border: `2px solid ${borderColor}`,
              boxShadow: `${glowColor}, inset 0 0 28px rgba(88,241,255,0.12)`,
              overflow: "hidden",
              background: "linear-gradient(180deg, #30384b, #161d29 70%)",
            }}
          >
            {player.avatar ? (
              <img
                src={player.avatar}
                alt={player.displayName}
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  objectPosition: "center 15%",
                }}
              />
            ) : (
              <div
                style={{
                  width: "100%",
                  height: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 24,
                  fontWeight: 900,
                  color: "rgba(255,255,255,0.7)",
                  background: "radial-gradient(circle at 50% 38%, rgba(255,255,255,0.16), transparent 30%), linear-gradient(180deg, #30384b, #161d29 70%)",
                }}
              >
                {player.displayName.charAt(0).toUpperCase()}
              </div>
            )}
          </div>

          {/* Name + stack tag — from HTML: .player-tag */}
          <div
            style={{
              display: "inline-block",
              padding: "6px 8px",
              borderRadius: 10,
              background: "linear-gradient(180deg, rgba(47,60,79,0.88), rgba(23,30,44,0.94))",
              border: "1px solid rgba(255,255,255,0.12)",
              backdropFilter: "blur(8px)",
              boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.04), 0 8px 22px rgba(0,0,0,0.28)",
              color: "#f5f8ff",
              fontSize: 11,
              lineHeight: 1.3,
              textAlign: "left",
            }}
          >
            <div style={{ fontWeight: 900, fontSize: 11, textTransform: "uppercase", marginBottom: 2 }}>
              {player.displayName}
              {player.handLabel ? `: ${player.handLabel}` : ""}
            </div>
            <div>
              Stack: ${player.stackCurrent.toLocaleString()}
              {player.amountDelta !== 0 && (
                <span
                  style={{
                    marginLeft: 6,
                    fontWeight: 900,
                    color: player.amountDelta > 0 ? "#5cff7d" : "#ff6e72",
                  }}
                >
                  {player.amountDelta > 0 ? "+" : ""}${player.amountDelta.toLocaleString()}
                </span>
              )}
            </div>
          </div>
        </div>
      </Html>
    </group>
  );
}

/**
 * Renders all player labels anchored to 3D seat positions.
 */
interface PlayerLabelsGroupProps {
  seatPositions: THREE.Vector3[];
}

export function PlayerLabelsGroup({ seatPositions }: PlayerLabelsGroupProps) {
  const players = useGameStore((s) => s.players);

  return (
    <group>
      {players.map((player) => {
        if (player.seatIndex < 0 || player.seatIndex >= seatPositions.length) return null;
        const pos = seatPositions[player.seatIndex];
        // Offset labels above the seat ring
        const labelPos = new THREE.Vector3(pos.x, pos.y + 0.3, pos.z);
        return (
          <PlayerLabel
            key={player.id}
            player={player}
            position={labelPos}
          />
        );
      })}
    </group>
  );
}
