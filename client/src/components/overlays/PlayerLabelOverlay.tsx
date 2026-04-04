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

  // Border color: gold default, brighter gold for winner
  const borderColor = isWinner ? "#ffd700" : "#d4af37";
  const glowColor = isWinner
    ? "0 0 10px rgba(255,215,0,0.5), 0 0 24px rgba(255,215,0,0.2)"
    : "0 0 8px rgba(212,175,55,0.35), 0 0 20px rgba(212,175,55,0.12)";

  return (
    <group position={position}>
      <Html
        center
        distanceFactor={3.2}
        style={{
          pointerEvents: "none",
          opacity: isFolded ? 0.45 : 1,
          filter: isFolded ? "grayscale(0.8) brightness(0.7)" : "none",
          transition: "opacity 0.4s, filter 0.4s",
        }}
      >
        <div style={{ textAlign: "center", width: 150 }}>
          {/* Avatar — large, visible, with colored ring border */}
          <div
            style={{
              width: 110,
              height: 110,
              margin: "0 auto 8px",
              borderRadius: 22,
              border: `3px solid ${borderColor}`,
              boxShadow: `${glowColor}, inset 0 0 32px rgba(88,241,255,0.10)`,
              overflow: "hidden",
              background: "linear-gradient(145deg, #30384b 0%, #161d29 60%, #0d1118 100%)",
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
                  fontSize: 36,
                  fontWeight: 900,
                  letterSpacing: 1,
                  color: "rgba(255,255,255,0.85)",
                  textShadow: `0 0 12px ${borderColor}40`,
                  background: `radial-gradient(circle at 50% 35%, ${borderColor}18, transparent 55%), linear-gradient(145deg, #30384b 0%, #161d29 60%, #0d1118 100%)`,
                }}
              >
                {player.displayName.charAt(0).toUpperCase()}
              </div>
            )}
          </div>

          {/* Name + stack tag */}
          <div
            style={{
              display: "inline-block",
              padding: "7px 12px",
              borderRadius: 12,
              background: "linear-gradient(180deg, rgba(47,60,79,0.92), rgba(23,30,44,0.96))",
              border: `1px solid ${borderColor}30`,
              backdropFilter: "blur(10px)",
              boxShadow: `inset 0 0 0 1px rgba(255,255,255,0.06), 0 8px 24px rgba(0,0,0,0.35), 0 0 8px ${borderColor}15`,
              color: "#f5f8ff",
              fontSize: 12,
              lineHeight: 1.4,
              textAlign: "center",
              minWidth: 90,
            }}
          >
            <div style={{ fontWeight: 900, fontSize: 12, textTransform: "uppercase", marginBottom: 3, letterSpacing: 0.5 }}>
              {player.displayName}
              {player.handLabel ? (
                <span style={{ color: "#58f1ff", marginLeft: 4, fontSize: 10 }}>{player.handLabel}</span>
              ) : null}
            </div>
            <div style={{ fontSize: 13, fontWeight: 700 }}>
              ${player.stackCurrent.toLocaleString()}
              {player.amountDelta !== 0 && (
                <span
                  style={{
                    marginLeft: 6,
                    fontWeight: 900,
                    fontSize: 11,
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
        // Offset labels well above the seat ring so they're clearly visible
        const labelPos = new THREE.Vector3(pos.x, pos.y + 0.5, pos.z);
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
