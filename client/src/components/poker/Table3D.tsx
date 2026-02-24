import { useRef, useMemo, useState, useCallback, Suspense } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { ContactShadows, useTexture, Float, Sparkles, OrbitControls } from "@react-three/drei";
import { EffectComposer, Bloom, Vignette, N8AO } from "@react-three/postprocessing";
import * as THREE from "three";
import type { CardType, Suit, Rank } from "@/lib/poker-types";

import feltTexture from "@assets/generated_images/poker_table_top_cinematic.png";
import lionLogo from "@assets/generated_images/lion_crest_gold_emblem.png";
import cardBackImg from "@assets/generated_images/card_back_premium.png";

// ─── Quality Settings ────────────────────────────────────────────────────────
export type QualityLevel = "low" | "medium" | "high";

const QUALITY_CONFIG = {
  low: { shadows: false, particles: 0, antialias: false, shadowMapSize: 512, dpr: 1, bloom: false, ao: false },
  medium: { shadows: true, particles: 25, antialias: true, shadowMapSize: 1024, dpr: 1.5, bloom: true, ao: false },
  high: { shadows: true, particles: 50, antialias: true, shadowMapSize: 2048, dpr: 2, bloom: true, ao: true },
};

// ─── Card Texture Generator ─────────────────────────────────────────────────
const suitSymbols: Record<Suit, string> = { hearts: "♥", diamonds: "♦", clubs: "♣", spades: "♠" };
const suitHex: Record<Suit, string> = { hearts: "#ef4444", diamonds: "#38bdf8", clubs: "#34d399", spades: "#e2e8f0" };

const cardTextureCache = new Map<string, THREE.CanvasTexture>();

function generateCardFaceTexture(rank: Rank, suit: Suit): THREE.CanvasTexture {
  const key = `${rank}-${suit}`;
  if (cardTextureCache.has(key)) return cardTextureCache.get(key)!;

  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 384;
  const ctx = canvas.getContext("2d")!;

  // Card background with subtle gradient
  const bgGrad = ctx.createLinearGradient(0, 0, 0, 384);
  bgGrad.addColorStop(0, "#ffffff");
  bgGrad.addColorStop(1, "#f0eeea");
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, 256, 384);

  // Rounded corner mask
  ctx.globalCompositeOperation = "destination-in";
  roundRect(ctx, 0, 0, 256, 384, 16);
  ctx.fill();
  ctx.globalCompositeOperation = "source-over";

  // Gold border
  ctx.strokeStyle = "#c9a84c";
  ctx.lineWidth = 5;
  roundRect(ctx, 3, 3, 250, 378, 14);
  ctx.stroke();

  // Inner subtle border
  ctx.strokeStyle = "#e8dbb8";
  ctx.lineWidth = 1;
  roundRect(ctx, 9, 9, 238, 366, 10);
  ctx.stroke();

  const color = suitHex[suit];
  const sym = suitSymbols[suit];

  // Top-left rank
  ctx.fillStyle = color;
  ctx.font = "bold 44px 'Segoe UI', Arial, sans-serif";
  ctx.textAlign = "left";
  ctx.fillText(rank, 16, 54);

  // Top-left suit
  ctx.font = "34px 'Segoe UI', Arial, sans-serif";
  ctx.fillText(sym, 18, 88);

  // Center suit (large, watermark)
  ctx.globalAlpha = 0.1;
  ctx.font = "150px 'Segoe UI', Arial, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(sym, 128, 240);
  ctx.globalAlpha = 1;

  // Bottom-right (rotated)
  ctx.save();
  ctx.translate(256, 384);
  ctx.rotate(Math.PI);
  ctx.fillStyle = color;
  ctx.font = "bold 44px 'Segoe UI', Arial, sans-serif";
  ctx.textAlign = "left";
  ctx.fillText(rank, 16, 54);
  ctx.font = "34px 'Segoe UI', Arial, sans-serif";
  ctx.fillText(sym, 18, 88);
  ctx.restore();

  // Top shine
  const shine = ctx.createLinearGradient(0, 0, 0, 140);
  shine.addColorStop(0, "rgba(255,255,255,0.3)");
  shine.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = shine;
  ctx.fillRect(10, 10, 236, 130);

  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  cardTextureCache.set(key, tex);
  return tex;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

// ─── 3D Card with flip animation ────────────────────────────────────────────
function Card3D({
  card,
  position,
  rotation = [0, 0, 0],
  faceDown = false,
  scale = 1,
  flipDelay = 0,
}: {
  card?: CardType;
  position: [number, number, number];
  rotation?: [number, number, number];
  faceDown?: boolean;
  scale?: number;
  flipDelay?: number;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const flipRef = useRef({ progress: faceDown ? 0 : 1, target: faceDown ? 0 : 1, started: false, timer: 0 });
  const backTexture = useTexture(cardBackImg);

  const faceTex = useMemo(() => {
    if (!card || card.hidden) return null;
    return generateCardFaceTexture(card.rank, card.suit);
  }, [card]);

  const showFace = !faceDown && faceTex && card && !card.hidden;

  // Animate flip
  useFrame((_, delta) => {
    const flip = flipRef.current;
    flip.timer += delta;
    if (flip.timer < flipDelay) return;
    if (!flip.started) {
      flip.started = true;
      flip.target = showFace ? 1 : 0;
    }

    flip.target = showFace ? 1 : 0;
    const speed = delta * 4;
    flip.progress += (flip.target - flip.progress) * speed;

    if (meshRef.current) {
      // Map progress 0→1 to rotation 0→PI for flip
      const baseRotX = rotation[0];
      meshRef.current.rotation.set(baseRotX, rotation[1], rotation[2]);

      // Slight hover float
      const hoverY = Math.sin(Date.now() * 0.001 + position[0] * 3) * 0.005;
      meshRef.current.position.y = position[1] + hoverY;
    }
  });

  const materials = useMemo(() => {
    const back = new THREE.MeshStandardMaterial({
      map: backTexture,
      roughness: 0.35,
      metalness: 0.15,
    });
    const face = faceTex
      ? new THREE.MeshStandardMaterial({ map: faceTex, roughness: 0.25, metalness: 0.08 })
      : back.clone();
    const edge = new THREE.MeshStandardMaterial({
      color: "#e8d8a8",
      roughness: 0.25,
      metalness: 0.4,
    });

    // BoxGeometry face order: +x, -x, +y, -y, +z (front/face), -z (back)
    return [edge, edge, edge, edge, face, back];
  }, [faceTex, backTexture]);

  return (
    <mesh
      ref={meshRef}
      position={position}
      rotation={rotation}
      scale={[scale, scale, scale]}
      castShadow
      receiveShadow
      material={materials}
    >
      <boxGeometry args={[0.65, 0.92, 0.012]} />
    </mesh>
  );
}

// ─── Community Cards ────────────────────────────────────────────────────────
function CommunityCards3D({ cards }: { cards: CardType[] }) {
  const spacing = 0.78;
  const count = Math.min(cards.length, 5);
  const startX = -((count - 1) * spacing) / 2;

  return (
    <group position={[0, 0.17, 0]}>
      {cards.map((card, i) => (
        <Card3D
          key={`cc-${i}`}
          card={card}
          position={[startX + i * spacing, 0, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
          faceDown={!!card.hidden}
          scale={0.9}
          flipDelay={i * 0.15}
        />
      ))}
    </group>
  );
}

// ─── Player Hole Cards ──────────────────────────────────────────────────────
function PlayerHoleCards3D({
  cards,
  position,
  isHero,
}: {
  cards?: [CardType, CardType];
  position: [number, number, number];
  isHero?: boolean;
}) {
  if (!cards || cards.length < 2) return null;

  const spread = isHero ? 0.28 : 0.18;
  const tilt = isHero ? -0.12 : 0;
  const cardScale = isHero ? 0.85 : 0.6;
  // Offset cards toward center of table
  const offsetZ = isHero ? -0.6 : 0.3 * Math.sign(position[2]);

  return (
    <group position={[position[0], 0.18, position[2] + offsetZ]}>
      <Card3D
        card={cards[0]}
        position={[-spread, 0, 0]}
        rotation={[-Math.PI / 2, 0, tilt]}
        faceDown={!!cards[0].hidden}
        scale={cardScale}
        flipDelay={0}
      />
      <Card3D
        card={cards[1]}
        position={[spread, 0, 0]}
        rotation={[-Math.PI / 2, 0, -tilt]}
        faceDown={!!cards[1].hidden}
        scale={cardScale}
        flipDelay={0.1}
      />
    </group>
  );
}

// ─── Felt Surface ───────────────────────────────────────────────────────────
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
    return new THREE.ExtrudeGeometry(shape, {
      depth: 0.15,
      bevelEnabled: true,
      bevelThickness: 0.05,
      bevelSize: 0.05,
      bevelSegments: 3,
    });
  }, []);

  return (
    <mesh geometry={feltGeometry} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
      <meshStandardMaterial map={texture} color="#1a3a3a" roughness={0.85} metalness={0.05} />
    </mesh>
  );
}

// ─── Table Rail ─────────────────────────────────────────────────────────────
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
      <meshStandardMaterial color="#1a0f08" roughness={0.3} metalness={0.6} />
    </mesh>
  );
}

// ─── Gold Trim Ring ─────────────────────────────────────────────────────────
function GoldTrim() {
  const geometry = useMemo(() => {
    const curve = new THREE.EllipseCurve(0, 0, 5.55, 3.05, 0, Math.PI * 2, false, 0);
    const points = curve.getPoints(128);
    const pts3d = points.map(p => new THREE.Vector3(p.x, 0.18, p.y));
    return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts3d, true), 128, 0.035, 8, true);
  }, []);

  return (
    <mesh geometry={geometry} position={[0, 0, 0]}>
      <meshStandardMaterial
        color="#c9a84c"
        roughness={0.15}
        metalness={0.95}
        emissive="#c9a84c"
        emissiveIntensity={0.25}
      />
    </mesh>
  );
}

// ─── Center Logo ────────────────────────────────────────────────────────────
function CenterLogo() {
  const texture = useTexture(lionLogo);

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.16, 0]}>
      <planeGeometry args={[1.5, 1.5]} />
      <meshStandardMaterial
        map={texture}
        transparent
        opacity={0.12}
        roughness={1}
        metalness={0}
        depthWrite={false}
      />
    </mesh>
  );
}

// ─── Safe Avatar (crash-proof) ──────────────────────────────────────────────
function SafeAvatarDisc({
  avatarUrl, isActive, glowColor,
}: {
  avatarUrl?: string; isActive?: boolean; glowColor?: string;
}) {
  const [texError, setTexError] = useState(false);

  if (!avatarUrl || texError) {
    return (
      <Float speed={1.5} rotationIntensity={0} floatIntensity={isActive ? 0.15 : 0.05}>
        <mesh position={[0, 0.9, 0]} castShadow>
          <cylinderGeometry args={[0.45, 0.45, 0.05, 32]} />
          <meshStandardMaterial
            color={glowColor || "#444"}
            roughness={0.4}
            metalness={0.5}
            emissive={isActive ? (glowColor || "#00f0ff") : "#000000"}
            emissiveIntensity={isActive ? 0.3 : 0}
          />
        </mesh>
      </Float>
    );
  }

  return (
    <AvatarTextured
      avatarUrl={avatarUrl}
      isActive={isActive}
      glowColor={glowColor}
      onError={() => setTexError(true)}
    />
  );
}

function AvatarTextured({
  avatarUrl, isActive, glowColor, onError,
}: {
  avatarUrl: string; isActive?: boolean; glowColor?: string; onError: () => void;
}) {
  let texture: THREE.Texture | null = null;
  try {
    texture = useTexture(avatarUrl);
  } catch {
    onError();
    return null;
  }

  return (
    <Float speed={1.5} rotationIntensity={0} floatIntensity={isActive ? 0.15 : 0.05}>
      <mesh position={[0, 0.9, 0]} castShadow>
        <cylinderGeometry args={[0.45, 0.45, 0.05, 32]} />
        <meshStandardMaterial
          map={texture}
          roughness={0.4}
          metalness={0.3}
          emissive={isActive ? (glowColor || "#00f0ff") : "#000000"}
          emissiveIntensity={isActive ? 0.35 : 0}
        />
      </mesh>
    </Float>
  );
}

// ─── Player Seat ────────────────────────────────────────────────────────────
function PlayerSeat({
  position, avatarUrl, isActive, glowColor = "#00f0ff",
}: {
  position: [number, number, number]; avatarUrl?: string; isActive?: boolean; glowColor?: string;
}) {
  return (
    <group position={position}>
      {/* Seat base */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.08, 0]} receiveShadow>
        <cylinderGeometry args={[0.5, 0.55, 0.06, 32]} />
        <meshStandardMaterial color="#0a0f18" roughness={0.5} metalness={0.7} />
      </mesh>

      {/* Avatar */}
      <SafeAvatarDisc avatarUrl={avatarUrl} isActive={isActive} glowColor={glowColor} />

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

// ─── Chip Stack ─────────────────────────────────────────────────────────────
function ChipStack3D({ position, count = 5 }: { position: [number, number, number]; count?: number }) {
  const colors = ["#c9a84c", "#e74c3c", "#2ecc71", "#c9a84c", "#3498db"];

  return (
    <group position={position}>
      {Array.from({ length: Math.min(count, 8) }).map((_, i) => (
        <mesh key={i} position={[0, i * 0.055, 0]} rotation={[0, i * 0.3, 0]} castShadow>
          <cylinderGeometry args={[0.18, 0.18, 0.04, 24]} />
          <meshStandardMaterial color={colors[i % colors.length]} roughness={0.25} metalness={0.75} />
        </mesh>
      ))}
    </group>
  );
}

// ─── Pot Display ────────────────────────────────────────────────────────────
function PotChips3D({ pot }: { pot: number }) {
  if (pot <= 0) return null;
  const stackCount = Math.min(Math.ceil(pot / 200), 4);

  return (
    <group position={[0, 0.17, 0.8]}>
      {Array.from({ length: stackCount }).map((_, i) => (
        <ChipStack3D
          key={i}
          position={[(i - (stackCount - 1) / 2) * 0.45, 0, 0]}
          count={Math.min(Math.ceil(pot / (stackCount * 100)), 6)}
        />
      ))}
    </group>
  );
}

// ─── Ambient Particles ──────────────────────────────────────────────────────
function AmbientGlow({ quality }: { quality: QualityLevel }) {
  const cfg = QUALITY_CONFIG[quality];
  if (cfg.particles === 0) return null;

  return (
    <>
      <Sparkles count={cfg.particles} scale={15} size={1.5} speed={0.3} opacity={0.25} color="#00ff9d" />
      <Sparkles count={Math.floor(cfg.particles * 0.4)} scale={15} size={1} speed={0.2} opacity={0.15} color="#c9a84c" />
    </>
  );
}

// ─── Lighting Rig ───────────────────────────────────────────────────────────
function Lighting({ quality }: { quality: QualityLevel }) {
  const cfg = QUALITY_CONFIG[quality];

  return (
    <>
      {/* Main overhead spotlight — warm white */}
      <spotLight
        position={[0, 8, 0]}
        angle={0.5}
        penumbra={0.8}
        intensity={2.2}
        color="#fff5e6"
        castShadow={cfg.shadows}
        shadow-mapSize-width={cfg.shadowMapSize}
        shadow-mapSize-height={cfg.shadowMapSize}
        shadow-bias={-0.001}
      />
      {/* Rim lights */}
      <pointLight position={[-8, 3, 0]} intensity={0.35} color="#00f0ff" />
      <pointLight position={[8, 3, 0]} intensity={0.35} color="#c9a84c" />
      <pointLight position={[0, 3, -5]} intensity={0.25} color="#00ff9d" />
      {/* Subtle fill from below */}
      <pointLight position={[0, -2, 4]} intensity={0.1} color="#0a2030" />
      {/* Ambient fill */}
      <ambientLight intensity={0.12} color="#0a1520" />
    </>
  );
}

// ─── Cinematic Camera ───────────────────────────────────────────────────────
function CinematicCamera({
  heroPosition,
  isHeroTurn,
  joinPhase,
}: {
  heroPosition?: [number, number, number];
  isHeroTurn?: boolean;
  joinPhase: boolean;
}) {
  const { camera } = useThree();
  const targetPos = useRef(new THREE.Vector3(0, 12, 14));
  const targetLookAt = useRef(new THREE.Vector3(0, 0, 0));
  const currentLookAt = useRef(new THREE.Vector3(0, 0, 0));
  const startTime = useRef(Date.now());

  useFrame((_, delta) => {
    const elapsed = (Date.now() - startTime.current) / 1000;

    if (joinPhase && elapsed < 2.5) {
      // Cinematic sweep: start high and far, sweep down to table
      const t = Math.min(elapsed / 2.5, 1);
      const ease = 1 - Math.pow(1 - t, 3); // easeOutCubic
      targetPos.current.set(
        Math.sin(t * 0.5) * 2,
        12 - ease * 5, // 12 → 7
        14 - ease * 6, // 14 → 8
      );
      targetLookAt.current.set(0, 0, 0);
    } else if (isHeroTurn && heroPosition) {
      // Ease toward hero's perspective
      targetPos.current.set(
        heroPosition[0] * 0.35,
        5.8,
        heroPosition[2] * 0.25 + 6.5,
      );
      targetLookAt.current.set(0, 0.15, -0.3);
    } else {
      // Default overview with idle breathing
      const breathX = Math.sin(elapsed * 0.15) * 0.15;
      const breathY = Math.sin(elapsed * 0.1) * 0.08;
      const breathZ = Math.cos(elapsed * 0.12) * 0.1;
      targetPos.current.set(0 + breathX, 7 + breathY, 8 + breathZ);
      targetLookAt.current.set(0, 0, 0);
    }

    const speed = delta * (joinPhase && elapsed < 2.5 ? 3 : 1.5);
    camera.position.lerp(targetPos.current, speed);
    currentLookAt.current.lerp(targetLookAt.current, speed);
    camera.lookAt(currentLookAt.current);
  });

  return null;
}

// ─── Post Processing ────────────────────────────────────────────────────────
function PostProcessing({ quality }: { quality: QualityLevel }) {
  const cfg = QUALITY_CONFIG[quality];
  if (!cfg.bloom && !cfg.ao) return null;

  return (
    <EffectComposer multisampling={0}>
      {cfg.bloom && (
        <Bloom
          intensity={0.35}
          luminanceThreshold={0.6}
          luminanceSmoothing={0.4}
          mipmapBlur
        />
      )}
      {cfg.ao && (
        <N8AO
          aoRadius={0.8}
          intensity={1.5}
          distanceFalloff={0.5}
        />
      )}
      <Vignette eskil={false} offset={0.15} darkness={0.6} />
    </EffectComposer>
  );
}

// ─── Main 3D Scene ──────────────────────────────────────────────────────────
interface PlayerData3D {
  position: [number, number, number];
  avatarUrl?: string;
  isActive?: boolean;
  glowColor?: string;
  cards?: [CardType, CardType];
  isHero?: boolean;
}

interface Table3DSceneProps {
  playerAvatars?: PlayerData3D[];
  chipPositions?: [number, number, number][];
  communityCards?: CardType[];
  pot?: number;
  quality?: QualityLevel;
  heroPosition?: [number, number, number];
  isHeroTurn?: boolean;
  enableOrbit?: boolean;
}

function Scene({
  playerAvatars = [], chipPositions = [], communityCards = [], pot = 0,
  quality = "high", heroPosition, isHeroTurn, enableOrbit,
}: Table3DSceneProps) {
  const joinPhaseRef = useRef(true);
  const joinTimerRef = useRef(Date.now());

  useFrame(() => {
    if (joinPhaseRef.current && Date.now() - joinTimerRef.current > 3000) {
      joinPhaseRef.current = false;
    }
  });

  return (
    <>
      <Lighting quality={quality} />
      <CinematicCamera
        heroPosition={heroPosition}
        isHeroTurn={isHeroTurn}
        joinPhase={joinPhaseRef.current}
      />

      {enableOrbit && (
        <OrbitControls
          enablePan={false}
          minPolarAngle={0.3}
          maxPolarAngle={Math.PI / 2.2}
          minDistance={5}
          maxDistance={18}
          enableDamping
          dampingFactor={0.05}
        />
      )}

      <FeltSurface />
      <TableRail />
      <GoldTrim />
      <CenterLogo />

      {/* Community cards on felt */}
      {communityCards.length > 0 && <CommunityCards3D cards={communityCards} />}

      {/* Pot chip stacks */}
      <PotChips3D pot={pot} />

      {/* Player seats + hole cards */}
      {playerAvatars.map((p, i) => (
        <group key={i}>
          <PlayerSeat
            position={p.position}
            avatarUrl={p.avatarUrl}
            isActive={p.isActive}
            glowColor={p.glowColor}
          />
          <PlayerHoleCards3D
            cards={p.cards}
            position={p.position}
            isHero={p.isHero}
          />
        </group>
      ))}

      {/* Bet chip stacks */}
      {chipPositions.map((pos, i) => (
        <ChipStack3D key={`bet-${i}`} position={pos} count={3 + (i % 4)} />
      ))}

      <AmbientGlow quality={quality} />

      {quality !== "low" && (
        <ContactShadows
          position={[0, -0.12, 0]}
          opacity={0.6}
          scale={20}
          blur={2}
          far={4}
          color="#000000"
        />
      )}

      <PostProcessing quality={quality} />
    </>
  );
}

// ─── Exported Canvas Component ──────────────────────────────────────────────
export function Table3D({
  playerAvatars = [], chipPositions = [], communityCards = [], pot = 0,
  quality = "high", heroPosition, isHeroTurn, enableOrbit = false,
  className = "",
}: Table3DSceneProps & { className?: string }) {
  const cfg = QUALITY_CONFIG[quality];

  return (
    <div className={`w-full h-full ${className}`}>
      <Canvas
        shadows={cfg.shadows}
        camera={{ position: [0, 12, 14], fov: 45, near: 0.1, far: 100 }}
        gl={{ antialias: cfg.antialias, alpha: true, powerPreference: "high-performance" }}
        dpr={cfg.dpr}
        style={{ background: "transparent" }}
      >
        <Suspense fallback={null}>
          <Scene
            playerAvatars={playerAvatars}
            chipPositions={chipPositions}
            communityCards={communityCards}
            pot={pot}
            quality={quality}
            heroPosition={heroPosition}
            isHeroTurn={isHeroTurn}
            enableOrbit={enableOrbit}
          />
        </Suspense>
      </Canvas>
    </div>
  );
}

export { QUALITY_CONFIG };
export type { PlayerData3D };
