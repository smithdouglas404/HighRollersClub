import { useState, useMemo, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Seat } from "../components/poker/Seat";
import { CommunityCards } from "../components/poker/CommunityCards";
import { PokerControls } from "../components/poker/Controls";
import { ProvablyFairPanel } from "../components/poker/ProvablyFairPanel";
import { AmbientParticles } from "../components/AmbientParticles";
import { AvatarSelect, AVATAR_OPTIONS, AvatarOption } from "../components/poker/AvatarSelect";
import { ShowdownOverlay } from "../components/poker/ShowdownOverlay";
import { EmotePicker } from "../components/poker/EmoteSystem";
import { HandStrengthMeter } from "../components/poker/HandStrengthMeter";
import { ChipAnimation } from "../components/poker/ChipAnimation";
import { Player } from "../lib/poker-types";
import { useGameEngine } from "@/lib/game-engine";
import { SoundProvider, useSoundEngine } from "@/lib/sound-context";
import { soundEngine } from "@/lib/sound-engine";
import { ShieldCheck, Volume2, VolumeX, Settings, Trophy } from "lucide-react";

// Assets
import lionLogo from "@assets/generated_images/Golden_Lion_Logo_for_Poker_Table_961614b0.png";
import feltTexture from "@assets/generated_images/Dark_Teal_Poker_Felt_Texture_83ec2760.png";
import luxuryRail from "@assets/generated_images/luxury_poker_table_surface.png";
import avatar1 from "@assets/generated_images/cyberpunk_poker_player_avatar_1.png";
import avatar2 from "@assets/generated_images/cyberpunk_poker_player_avatar_2.png";
import avatar3 from "@assets/generated_images/cyberpunk_poker_player_avatar_3.png";
import avatar4 from "@assets/generated_images/cyberpunk_poker_player_avatar_4.png";

const HERO_ID = "player-1";

// Bot avatars - each is unique
const BOT_AVATARS = [avatar2, avatar3, avatar4, avatar1, avatar2];
const BOT_NAMES = ["CryptoKing", "Satoshi", "Whale_0x", "HODLer", "Degen"];
const BOT_CHIPS = [3200, 850, 5000, 1200, 2100];

const SEAT_POSITIONS = [
  { x: 50, y: 88 },  // Hero (Bottom center)
  { x: 10, y: 62 },  // Left
  { x: 18, y: 22 },  // Top-left
  { x: 50, y: 10 },  // Top center
  { x: 82, y: 22 },  // Top-right
  { x: 90, y: 62 },  // Right
];

const phaseLabels: Record<string, string> = {
  "pre-flop": "PRE-FLOP",
  flop: "FLOP",
  turn: "TURN",
  river: "RIVER",
  showdown: "SHOWDOWN",
};

function buildPlayers(heroAvatar: AvatarOption, heroName: string): Player[] {
  return [
    {
      id: HERO_ID,
      name: heroName,
      chips: 1540,
      isActive: true,
      isDealer: false,
      currentBet: 0,
      status: "waiting",
      timeLeft: 100,
      avatar: heroAvatar.image || undefined,
    },
    ...BOT_NAMES.map((name, i) => ({
      id: `player-${i + 2}`,
      name,
      chips: BOT_CHIPS[i],
      isActive: true,
      isDealer: i === 0,
      currentBet: 0,
      status: "waiting" as const,
      avatar: BOT_AVATARS[i],
    })),
  ];
}

// The game table component (shown after avatar selection)
function GameTable({ initialPlayers }: { initialPlayers: Player[] }) {
  const { players, gameState, handlePlayerAction, showdown } = useGameEngine(initialPlayers, HERO_ID);
  const [showProvablyFair, setShowProvablyFair] = useState(false);
  const [isMuted, setIsMuted] = useState(() => soundEngine.muted);
  const sound = useSoundEngine();
  const tableRef = useRef<HTMLDivElement>(null);
  const prevHeroTurn = useRef(false);

  const hero = players.find((p) => p.id === HERO_ID);
  const isHeroTurn = gameState.currentTurnPlayerId === HERO_ID;
  const heroCards = hero?.cards;

  // Get unhidden hero cards for hand strength calc
  const heroHoleCards = useMemo(() => {
    if (!heroCards) return undefined;
    return heroCards.map(c => ({ ...c, hidden: false })) as [typeof heroCards[0], typeof heroCards[1]];
  }, [heroCards]);

  // Start ambient music on mount, stop on unmount
  useEffect(() => {
    sound.startAmbient();
    return () => sound.stopAmbient();
  }, [sound]);

  // Play turn notification when it becomes hero's turn
  useEffect(() => {
    if (isHeroTurn && !prevHeroTurn.current) {
      sound.playTurnNotify();
    }
    prevHeroTurn.current = isHeroTurn;
  }, [isHeroTurn, sound]);

  const handleMuteToggle = () => {
    const nowMuted = sound.toggleMute();
    setIsMuted(nowMuted);
  };

  return (
    <div className="min-h-screen bg-[#030508] text-white overflow-hidden relative font-sans flex">

      {/* Ambient background */}
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(0,30,40,0.5)_0%,rgba(0,0,0,0.95)_70%)]" />
        <AmbientParticles />
      </div>

      {/* Chip animation overlay */}
      <ChipAnimation containerRef={tableRef} />

      {/* Showdown overlay */}
      {showdown && (
        <ShowdownOverlay
          visible={!!showdown}
          results={showdown.results}
          players={players}
          pot={showdown.pot}
        />
      )}

      {/* Main game area */}
      <div className="flex-1 relative flex flex-col h-screen overflow-hidden">

        {/* Top bar */}
        <motion.div
          initial={{ y: -60, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2, type: "spring", stiffness: 200, damping: 25 }}
          className="absolute top-0 left-0 right-0 h-14 flex items-center justify-between px-5 z-50"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg gold-gradient flex items-center justify-center shadow-[0_0_15px_rgba(201,168,76,0.3)]">
              <Trophy className="w-5 h-5 text-black" />
            </div>
            <div>
              <div className="font-display font-bold text-sm tracking-widest gold-text leading-none">
                HIGH ROLLERS
              </div>
              <div className="text-[9px] text-gray-500 tracking-[0.2em] font-mono mt-0.5">
                TABLE #802
                <span className="mx-1.5 text-gray-700">|</span>
                <span className="text-cyan-500/70">{phaseLabels[gameState.phase] || gameState.phase.toUpperCase()}</span>
                <span className="mx-1.5 text-gray-700">|</span>
                6-MAX NLH
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleMuteToggle}
              className="glass rounded-lg p-2 hover:bg-white/5 transition-colors"
              title={isMuted ? "Unmute" : "Mute"}
            >
              {isMuted ? (
                <VolumeX className="w-4 h-4 text-red-400" />
              ) : (
                <Volume2 className="w-4 h-4 text-gray-500" />
              )}
            </button>
            <button className="glass rounded-lg p-2 hover:bg-white/5 transition-colors" title="Settings">
              <Settings className="w-4 h-4 text-gray-500" />
            </button>
            <button
              onClick={() => setShowProvablyFair(!showProvablyFair)}
              className={`glass rounded-lg px-3 py-1.5 flex items-center gap-2 transition-all ${
                showProvablyFair ? "neon-border-green" : "hover:bg-white/5"
              }`}
            >
              <ShieldCheck className={`w-3.5 h-3.5 ${showProvablyFair ? "text-green-400" : "text-gray-500"}`} />
              <span className={`text-[10px] font-bold uppercase tracking-wider ${showProvablyFair ? "text-green-400" : "text-gray-500"}`}>
                Verified
              </span>
              {showProvablyFair && (
                <div className="w-1.5 h-1.5 rounded-full bg-green-500 shadow-[0_0_4px_rgba(0,255,157,0.5)]" />
              )}
            </button>
          </div>
        </motion.div>

        {/* 3D Table Scene */}
        <div className="flex-1 relative flex items-center justify-center overflow-hidden" style={{ perspective: "1200px" }}>

          <motion.div
            ref={tableRef}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="relative w-[92%] max-w-[1100px] aspect-[2/1]"
            style={{
              transform: "rotateX(28deg) translateY(40px) scale(0.88)",
              transformStyle: "preserve-3d",
            }}
          >
            {/* Table rail (outer) */}
            <div
              className="absolute -inset-[45px] rounded-[55%] overflow-hidden"
              style={{
                boxShadow: "0 40px 80px -10px rgba(0,0,0,0.9), 0 0 120px rgba(0,0,0,0.5), inset 0 2px 4px rgba(255,255,255,0.08)",
              }}
            >
              <div className="absolute inset-0"
                style={{ backgroundImage: `url(${luxuryRail})`, backgroundSize: "cover", backgroundPosition: "center" }}
              />
              <div className="absolute inset-0 bg-gradient-to-b from-[rgba(30,25,18,0.6)] to-[rgba(10,8,5,0.8)]" />
              <div className="absolute inset-[8px] rounded-[53%] pointer-events-none"
                style={{ border: "1.5px solid rgba(201,168,76,0.25)", boxShadow: "0 0 20px rgba(201,168,76,0.08), inset 0 0 20px rgba(201,168,76,0.05)" }}
              />
            </div>

            {/* Felt surface */}
            <div
              className="absolute inset-0 rounded-[50%] overflow-hidden"
              style={{ boxShadow: "inset 0 0 100px rgba(0,0,0,0.7), inset 0 0 40px rgba(0,0,0,0.5)" }}
            >
              <div className="absolute inset-0"
                style={{ backgroundImage: `url(${feltTexture})`, backgroundSize: "cover", backgroundPosition: "center" }}
              />
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_30%,rgba(0,10,15,0.6)_100%)]" />
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_30%,rgba(255,255,255,0.04)_0%,transparent_60%)]" />

              {/* Center logo */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-36 h-36 pointer-events-none">
                <img src={lionLogo} alt="High Rollers Club"
                  className="w-full h-full object-contain"
                  style={{ opacity: 0.12, filter: "grayscale(30%) brightness(1.2)", mixBlendMode: "overlay" }}
                />
              </div>

              {/* Betting line */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[60%] h-[50%] rounded-[50%] pointer-events-none"
                style={{ border: "1px solid rgba(255,255,255,0.04)", boxShadow: "0 0 8px rgba(255,255,255,0.02)" }}
              />
            </div>

            {/* Community Cards */}
            <div className="absolute top-[44%] left-1/2 z-20"
              style={{ transform: "translate(-50%, -50%) translateZ(25px)" }}
            >
              <CommunityCards cards={gameState.communityCards} pot={gameState.pot} />
            </div>

            {/* Player seats */}
            {players.map((player, index) => (
              <Seat
                key={player.id}
                player={player}
                position={SEAT_POSITIONS[index]}
                isHero={player.id === HERO_ID}
              />
            ))}
          </motion.div>
        </div>

        {/* Emote picker */}
        <EmotePicker heroId={HERO_ID} />

        {/* Hand strength meter */}
        <HandStrengthMeter
          holeCards={heroHoleCards}
          communityCards={gameState.communityCards}
          visible={gameState.phase !== "showdown" && !!heroCards}
        />

        {/* Bottom controls */}
        <div className="z-50 relative">
          <div className={`transition-all duration-300 ${!isHeroTurn || gameState.phase === "showdown" ? "opacity-40 grayscale pointer-events-none" : "opacity-100"}`}>
            <PokerControls
              onAction={handlePlayerAction}
              minBet={gameState.minBet}
              maxBet={hero?.chips || 1000}
            />
          </div>
        </div>
      </div>

      {/* Right side panel */}
      <AnimatePresence>
        {showProvablyFair && <ProvablyFairPanel />}
      </AnimatePresence>
    </div>
  );
}

// Main Game page with lobby flow
export default function Game() {
  const [gameStarted, setGameStarted] = useState(false);
  const [initialPlayers, setInitialPlayers] = useState<Player[]>([]);

  const handleAvatarSelect = (avatar: AvatarOption, playerName: string) => {
    // Initialize AudioContext from user gesture
    soundEngine.init();
    const players = buildPlayers(avatar, playerName);
    setInitialPlayers(players);
    setGameStarted(true);
  };

  if (!gameStarted) {
    return <AvatarSelect onSelect={handleAvatarSelect} />;
  }

  return (
    <SoundProvider>
      <GameTable initialPlayers={initialPlayers} />
    </SoundProvider>
  );
}
