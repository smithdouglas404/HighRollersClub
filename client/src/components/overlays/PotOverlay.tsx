import { Html } from "@react-three/drei";
import { useGameStore } from "@/store/useGameStore";

/**
 * Blueprint Section 6 — PotOverlay
 * Pot amount as crisp DOM overlay anchored to table center.
 */
export function PotOverlay() {
  const pot = useGameStore((s) => s.pot);

  if (pot <= 0) return null;

  return (
    <group position={[0, 0.12, -0.35]}>
      <Html center distanceFactor={5} style={{ pointerEvents: "none" }}>
        <div
          style={{
            padding: "5px 14px",
            borderRadius: 12,
            background: "linear-gradient(180deg, rgba(47,60,79,0.9), rgba(23,30,44,0.95))",
            border: "1px solid rgba(242,198,96,0.4)",
            boxShadow: "0 0 10px rgba(242,198,96,0.2), 0 4px 16px rgba(0,0,0,0.4)",
            color: "#f2c660",
            fontSize: 14,
            fontWeight: 900,
            textAlign: "center",
            textTransform: "uppercase",
            letterSpacing: "0.04em",
            whiteSpace: "nowrap",
          }}
        >
          Pot: ${pot.toLocaleString()}
        </div>
      </Html>
    </group>
  );
}
