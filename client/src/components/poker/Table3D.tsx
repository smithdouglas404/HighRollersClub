import { useRef, useMemo, Suspense } from "react";
import { Canvas, useFrame, useLoader, useThree } from "@react-three/fiber";
import { Environment, ContactShadows, useTexture, Float, Sparkles } from "@react-three/drei";
import * as THREE from "three";

import feltTexture from "@assets/generated_images/poker_table_top_cinematic.png";
import lionLogo from "@assets/generated_images/lion_crest_gold_emblem.png";

// ─── Poker Felt (Elliptical Table Surface) ────────────────────────────────────
function FeltSurface() {
  const texture = useTexture(feltTexture);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;

  const feltGeometry = useMemo(() => {
    const shape = new THREE.Shape();
    const rx = 5.5;
    const ry = 3;
    for (let i = 0; i <= 64; i++) {
      const angle = (i / 64) * Math.PI * 2;
      shape.lineTo(Math.cos(angle) * rx, Math.sin(angle) * ry);
    }
    return new THREE.ExtrudeGeometry(shape, { depth: 0.15, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.05, bevelSegments: 3 });
  }, []);

  return (
    <mesh geometry={feltGeometry} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
      <meshStandardMaterial
        map={texture}
        color="#1a3a3a"
        roughness={0.85}
        metalness={0.05}
      />
    </mesh>
  );
}

// ─── Table Rail (Wooden/Leather Rim) ──────────────────────────────────────────
function TableRail() {
  const railGeometry = useMemo(() => {
    const outerRx = 6.0;
    const outerRy = 3.5;
    const innerRx = 5.5;
    const innerRy = 3.0;

    const outerShape = new THREE.Shape();
    for (let i = 0; i <= 64; i++) {
      const angle = (i / 64) * Math.PI * 2;
      outerShape.lineTo(Math.cos(angle) * outerRx, Math.sin(angle) * outerRy);
    }

    const holePath = new THREE.Path();
    for (let i = 0; i <= 64; i++) {
      const angle = (i / 64) * Math.PI * 2;
      holePath.lineTo(Math.cos(angle) * innerRx, Math.sin(angle) * innerRy);
    }
    outerShape.holes.push(holePath);

    return new THREE.ExtrudeGeometry(outerShape, {
      depth: 0.4,
      bevelEnabled: true,
      bevelThickness: 0.08,
      bevelSize: 0.08,
      bevelSegments: 4,
    });
  }, []);

  return (
    <mesh geometry={railGeometry} rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.1, 0]} castShadow receiveShadow>
      <meshStandardMaterial
        color="#1a0f08"
        roughness={0.3}
        metalness={0.6}
      />
    </mesh>
  );
}

// ─── Gold Trim Ring ───────────────────────────────────────────────────────────
function GoldTrim() {
  const geometry = useMemo(() => {
    const curve = new THREE.EllipseCurve(0, 0, 5.55, 3.05, 0, Math.PI * 2, false, 0);
    const points = curve.getPoints(128);
    const pts3d = points.map(p => new THREE.Vector3(p.x, 0.18, p.y));
    return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts3d, true), 128, 0.03, 8, true);
  }, []);

  return (
    <mesh geometry={geometry} position={[0, 0, 0]}>
      <meshStandardMaterial color="#c9a84c" roughness={0.2} metalness={0.9} emissive="#c9a84c" emissiveIntensity={0.15} />
    </mesh>
  );
}

// ─── Center Logo ──────────────────────────────────────────────────────────────
function CenterLogo() {
  const texture = useTexture(lionLogo);

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.16, 0]}>
      <planeGeometry args={[1.5, 1.5]} />
      <meshStandardMaterial
        map={texture}
        transparent
        opacity={0.15}
        roughness={1}
        metalness={0}
        depthWrite={false}
      />
    </mesh>
  );
}

// ─── Player Seat Marker (3D cylinder with avatar texture) ─────────────────────
function PlayerSeat({
  position,
  avatarUrl,
  isActive,
  glowColor = "#00f0ff",
}: {
  position: [number, number, number];
  avatarUrl?: string;
  isActive?: boolean;
  glowColor?: string;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const texture = avatarUrl ? useTexture(avatarUrl) : null;

  useFrame((_, delta) => {
    if (meshRef.current && isActive) {
      meshRef.current.rotation.y += delta * 0.3;
    }
  });

  return (
    <group position={position}>
      {/* Seat base disc */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.08, 0]} receiveShadow>
        <cylinderGeometry args={[0.5, 0.55, 0.06, 32]} />
        <meshStandardMaterial color="#0a0f18" roughness={0.5} metalness={0.7} />
      </mesh>

      {/* Avatar billboard */}
      {texture && (
        <Float speed={1.5} rotationIntensity={0} floatIntensity={isActive ? 0.15 : 0.05}>
          <mesh position={[0, 0.9, 0]} castShadow>
            <cylinderGeometry args={[0.45, 0.45, 0.05, 32]} />
            <meshStandardMaterial
              map={texture}
              roughness={0.4}
              metalness={0.3}
              emissive={isActive ? glowColor : "#000000"}
              emissiveIntensity={isActive ? 0.3 : 0}
            />
          </mesh>
        </Float>
      )}

      {/* Active glow ring */}
      {isActive && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
          <ringGeometry args={[0.48, 0.55, 32]} />
          <meshBasicMaterial color={glowColor} transparent opacity={0.6} />
        </mesh>
      )}
    </group>
  );
}

// ─── Chip Stack (3D) ──────────────────────────────────────────────────────────
function ChipStack3D({ position, count = 5 }: { position: [number, number, number]; count?: number }) {
  const colors = ["#c9a84c", "#e74c3c", "#2ecc71", "#c9a84c", "#3498db"];

  return (
    <group position={position}>
      {Array.from({ length: Math.min(count, 8) }).map((_, i) => (
        <mesh key={i} position={[0, i * 0.06, 0]} rotation={[0, i * 0.3, 0]} castShadow>
          <cylinderGeometry args={[0.18, 0.18, 0.05, 24]} />
          <meshStandardMaterial
            color={colors[i % colors.length]}
            roughness={0.3}
            metalness={0.7}
          />
        </mesh>
      ))}
    </group>
  );
}

// ─── Ambient Particles ────────────────────────────────────────────────────────
function AmbientGlow() {
  return (
    <>
      <Sparkles count={40} scale={15} size={1.5} speed={0.3} opacity={0.3} color="#00ff9d" />
      <Sparkles count={20} scale={15} size={1} speed={0.2} opacity={0.2} color="#c9a84c" />
    </>
  );
}

// ─── Lighting Rig ─────────────────────────────────────────────────────────────
function Lighting() {
  return (
    <>
      {/* Main overhead spotlight */}
      <spotLight
        position={[0, 8, 0]}
        angle={0.5}
        penumbra={0.8}
        intensity={2}
        color="#ffffff"
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-bias={-0.001}
      />
      {/* Rim lights for drama */}
      <pointLight position={[-8, 3, 0]} intensity={0.4} color="#00f0ff" />
      <pointLight position={[8, 3, 0]} intensity={0.4} color="#c9a84c" />
      <pointLight position={[0, 3, -5]} intensity={0.3} color="#00ff9d" />
      {/* Ambient fill */}
      <ambientLight intensity={0.15} color="#0a1520" />
    </>
  );
}

// ─── Main 3D Scene ────────────────────────────────────────────────────────────
interface Table3DSceneProps {
  playerAvatars?: { position: [number, number, number]; avatarUrl?: string; isActive?: boolean; glowColor?: string }[];
  chipPositions?: [number, number, number][];
}

function Scene({ playerAvatars = [], chipPositions = [] }: Table3DSceneProps) {
  return (
    <>
      <Lighting />
      <FeltSurface />
      <TableRail />
      <GoldTrim />
      <CenterLogo />

      {/* Player seats */}
      {playerAvatars.map((p, i) => (
        <PlayerSeat key={i} {...p} />
      ))}

      {/* Chip stacks */}
      {chipPositions.map((pos, i) => (
        <ChipStack3D key={i} position={pos} count={3 + (i % 4)} />
      ))}

      <AmbientGlow />

      {/* Contact shadows under table */}
      <ContactShadows
        position={[0, -0.12, 0]}
        opacity={0.6}
        scale={20}
        blur={2}
        far={4}
        color="#000000"
      />
    </>
  );
}

// ─── Exported Canvas Component ────────────────────────────────────────────────
export function Table3D({
  playerAvatars = [],
  chipPositions = [],
  className = "",
}: Table3DSceneProps & { className?: string }) {
  return (
    <div className={`w-full h-full ${className}`}>
      <Canvas
        shadows
        camera={{ position: [0, 7, 8], fov: 45, near: 0.1, far: 100 }}
        gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
        style={{ background: "transparent" }}
      >
        <Suspense fallback={null}>
          <Scene playerAvatars={playerAvatars} chipPositions={chipPositions} />
        </Suspense>
      </Canvas>
    </div>
  );
}
