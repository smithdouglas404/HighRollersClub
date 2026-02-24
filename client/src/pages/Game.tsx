import { useState, useMemo, useEffect, useRef } from "react";
import { useLocation } from "wouter";
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
import { useMultiplayerGame } from "@/lib/multiplayer-engine";
import { useAuth } from "@/lib/auth-context";
import { MatrixRain } from "@/components/MatrixRain";
import { SoundProvider, useSoundEngine } from "@/lib/sound-context";
import { soundEngine } from "@/lib/sound-engine";
import { ShieldCheck, Volume2, VolumeX, Settings, Trophy, ArrowLeft, Bot, Wifi, WifiOff, Users } from "lucide-react";

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

// Shared game table renderer
function GameTable({
  players, gameState, handlePlayerAction, showdown, heroId, tableName, tableId,
  onBack, isMultiplayer, connected, waiting, addBots, leaveTable,
}: {
  players: Player[];
  gameState: any;
  handlePlayerAction: (action: string, amount?: number) => void;
  showdown: any;
  heroId: string;
  tableName?: string;
  tableId?: string;
  onBack?: () => void;
  isMultiplayer?: boolean;
  connected?: boolean;
  waiting?: boolean;
  addBots?: () => void;
  leaveTable?: () => void;
}) {
  const [showProvablyFair, setShowProvablyFair] = useState(false);
  const [isMuted, setIsMuted] = useState(() => soundEngine.muted);
  const sound = useSoundEngine();
  const tableRef = useRef<HTMLDivElement>(null);
  const prevHeroTurn = useRef(false);

  const hero = players.find((p) => p.id === heroId);
  const isHeroTurn = gameState.currentTurnPlayerId === heroId;
  const heroCards = hero?.cards;

  const heroHoleCards = useMemo(() => {
    if (!heroCards) return undefined;
    return heroCards.map(c => ({ ...c, hidden: false })) as [typeof heroCards[0], typeof heroCards[1]];
  }, [heroCards]);

  useEffect(() => {
    sound.startAmbient();
    return () => sound.stopAmbient();
  }, [sound]);

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

  // Seat positions adjusted for number of players
  const seatPositions = SEAT_POSITIONS.slice(0, Math.max(players.length, 2));

  return (
    <div className="min-h-screen bg-[#020508] text-white overflow-hidden relative font-sans flex">
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(0,30,40,0.5)_0%,rgba(0,0,0,0.95)_70%)]" />
        <AmbientParticles />
      </div>

      {/* Matrix rain on edges */}
      <MatrixRain
        side="both"
        color="#00ff9d"
        opacity={0.08}
        density={0.25}
        className="absolute inset-0 z-[1]"
      />

      <ChipAnimation containerRef={tableRef} />

      {showdown && (
        <ShowdownOverlay
          visible={!!showdown}
          results={showdown.results}
          players={players}
          pot={showdown.pot}
        />
      )}

      <div className="flex-1 relative flex flex-col h-screen overflow-hidden">
        {/* Top bar */}
        <motion.div
          initial={{ y: -60, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2, type: "spring", stiffness: 200, damping: 25 }}
          className="absolute top-0 left-0 right-0 h-14 flex items-center justify-between px-5 z-50"
        >
          <div className="flex items-center gap-3">
            {onBack && (
              <button
                onClick={leaveTable || onBack}
                className="glass rounded-lg p-2 hover:bg-white/5 transition-colors mr-1"
                title="Back to lobby"
              >
                <ArrowLeft className="w-4 h-4 text-gray-400" />
              </button>
            )}
            <div className="w-9 h-9 rounded-lg gold-gradient flex items-center justify-center shadow-[0_0_15px_rgba(201,168,76,0.3)]">
              <Trophy className="w-5 h-5 text-black" />
            </div>
            <div>
              <div className="font-display font-bold text-sm tracking-widest gold-text leading-none">
                {tableName || "HIGH ROLLERS"}
              </div>
              <div className="text-[9px] text-gray-500 tracking-[0.2em] font-mono mt-0.5">
                {tableId ? `TABLE #${tableId.slice(0, 6).toUpperCase()}` : "TABLE #802"}
                <span className="mx-1.5 text-gray-700">|</span>
                <span className="text-cyan-500/70">{phaseLabels[gameState.phase] || gameState.phase?.toUpperCase()}</span>
                <span className="mx-1.5 text-gray-700">|</span>
                {players.length}-MAX NLH
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Multiplayer indicators */}
            {isMultiplayer && (
              <>
                <div className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold ${
                  connected ? "text-green-400 bg-green-500/10" : "text-red-400 bg-red-500/10"
                }`}>
                  {connected ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
                  {connected ? "LIVE" : "OFFLINE"}
                </div>
                {waiting && addBots && (
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={addBots}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[10px] font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 hover:bg-amber-500/20 transition-colors"
                  >
                    <Bot className="w-3 h-3" />
                    FILL WITH BOTS
                  </motion.button>
                )}
              </>
            )}

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
            {!isMultiplayer && (
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
              </button>
            )}
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
            {/* Table rail */}
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

              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-36 h-36 pointer-events-none">
                <img src={lionLogo} alt="High Rollers Club"
                  className="w-full h-full object-contain"
                  style={{ opacity: 0.12, filter: "grayscale(30%) brightness(1.2)", mixBlendMode: "overlay" }}
                />
              </div>

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

            {/* Waiting overlay */}
            {isMultiplayer && waiting && players.length < 2 && (
              <div className="absolute inset-0 flex items-center justify-center z-30">
                <div className="glass rounded-xl px-6 py-4 text-center border border-white/10">
                  <Users className="w-8 h-8 text-cyan-400 mx-auto mb-2" />
                  <p className="text-sm text-gray-300 mb-1">Waiting for players...</p>
                  <p className="text-xs text-gray-500">{players.length} / 2 minimum</p>
                </div>
              </div>
            )}

            {/* Player seats */}
            {players.map((player, index) => (
              <Seat
                key={player.id}
                player={player}
                position={seatPositions[index] || SEAT_POSITIONS[index % SEAT_POSITIONS.length]}
                isHero={player.id === heroId}
              />
            ))}
          </motion.div>
        </div>

        <EmotePicker heroId={heroId} />

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

      <AnimatePresence>
        {showProvablyFair && <ProvablyFairPanel onClose={() => setShowProvablyFair(false)} />}
      </AnimatePresence>
    </div>
  );
}

// ─── Multiplayer Game Wrapper ─────────────────────────────────────────────────
function MultiplayerGame({ tableId }: { tableId: string }) {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [joined, setJoined] = useState(false);
  const [buyIn, setBuyIn] = useState(500);
  const [tableInfo, setTableInfo] = useState<any>(null);

  const {
    players, gameState, handlePlayerAction, showdown,
    connected, waiting, joinTable, leaveTable, addBots,
  } = useMultiplayerGame(tableId, user?.id || "");

  // Fetch table info
  useEffect(() => {
    fetch(`/api/tables/${tableId}`)
      .then(r => r.json())
      .then(setTableInfo)
      .catch(() => {});
  }, [tableId]);

  const handleJoin = () => {
    joinTable(buyIn);
    setJoined(true);
    soundEngine.init();
  };

  const handleLeave = () => {
    leaveTable();
    navigate("/lobby");
  };

  if (!joined) {
    return (
      <div className="min-h-screen bg-[#030508] text-white flex items-center justify-center relative overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(0,30,40,0.5)_0%,rgba(0,0,0,0.95)_70%)]" />
          <AmbientParticles />
        </div>

        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="relative z-10 glass rounded-2xl p-8 w-full max-w-sm border border-white/10"
        >
          <div className="text-center mb-6">
            <h2 className="font-bold text-lg tracking-wider gold-text mb-1">
              {tableInfo?.name || "Join Table"}
            </h2>
            {tableInfo && (
              <p className="text-xs text-gray-500 font-mono">
                {tableInfo.smallBlind}/{tableInfo.bigBlind} NLH &middot; {tableInfo.maxPlayers} seats
              </p>
            )}
          </div>

          <div className="mb-6">
            <label className="text-[10px] font-bold uppercase tracking-wider text-gray-500 block mb-2">
              Buy-In Amount
            </label>
            <input
              type="range"
              min={tableInfo?.minBuyIn || 200}
              max={Math.min(tableInfo?.maxBuyIn || 2000, user?.chipBalance || 2000)}
              value={buyIn}
              onChange={(e) => setBuyIn(parseInt(e.target.value))}
              className="w-full mb-2"
            />
            <div className="flex justify-between text-xs text-gray-500">
              <span>{tableInfo?.minBuyIn || 200}</span>
              <span className="text-lg font-bold text-amber-400">{buyIn}</span>
              <span>{Math.min(tableInfo?.maxBuyIn || 2000, user?.chipBalance || 2000)}</span>
            </div>
            <p className="text-center text-[10px] text-gray-600 mt-1">
              Balance: {user?.chipBalance?.toLocaleString()} chips
            </p>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => navigate("/lobby")}
              className="flex-1 glass rounded-lg py-3 text-sm font-bold tracking-wider text-gray-400 hover:text-white border border-white/10 hover:border-white/20 transition-all"
            >
              BACK
            </button>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleJoin}
              disabled={!connected || buyIn > (user?.chipBalance || 0)}
              className="flex-1 gold-gradient rounded-lg py-3 text-sm font-bold tracking-wider text-black disabled:opacity-50"
            >
              SIT DOWN
            </motion.button>
          </div>

          {!connected && (
            <p className="text-center text-xs text-red-400 mt-3">Connecting to server...</p>
          )}
        </motion.div>
      </div>
    );
  }

  return (
    <SoundProvider>
      <GameTable
        players={players}
        gameState={gameState}
        handlePlayerAction={handlePlayerAction}
        showdown={showdown}
        heroId={user?.id || ""}
        tableName={tableInfo?.name}
        tableId={tableId}
        onBack={() => navigate("/lobby")}
        isMultiplayer={true}
        connected={connected}
        waiting={waiting}
        addBots={addBots}
        leaveTable={handleLeave}
      />
    </SoundProvider>
  );
}

// ─── Offline Game (Original) ──────────────────────────────────────────────────
function OfflineGameTable({ initialPlayers }: { initialPlayers: Player[] }) {
  const { players, gameState, handlePlayerAction, showdown } = useGameEngine(initialPlayers, HERO_ID);
  const [, navigate] = useLocation();

  return (
    <GameTable
      players={players}
      gameState={gameState}
      handlePlayerAction={handlePlayerAction}
      showdown={showdown}
      heroId={HERO_ID}
      onBack={() => navigate("/lobby")}
    />
  );
}

// ─── Main Game Page ───────────────────────────────────────────────────────────
export default function Game({ tableId }: { tableId?: string }) {
  const [gameStarted, setGameStarted] = useState(false);
  const [initialPlayers, setInitialPlayers] = useState<Player[]>([]);

  // Multiplayer mode
  if (tableId) {
    return <MultiplayerGame tableId={tableId} />;
  }

  // Offline mode
  const handleAvatarSelect = (avatar: AvatarOption, playerName: string) => {
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
      <OfflineGameTable initialPlayers={initialPlayers} />
    </SoundProvider>
  );
}
