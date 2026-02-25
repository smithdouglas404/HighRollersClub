import { useState, useMemo, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Seat } from "../components/poker/Seat";
import { Card } from "../components/poker/Card";
// CommunityCards now rendered as 3D objects in Table3D scene
import { PokerControls } from "../components/poker/Controls";
import { ProvablyFairPanel } from "../components/poker/ProvablyFairPanel";
import { AmbientParticles } from "../components/AmbientParticles";
import { AvatarSelect, AVATAR_OPTIONS, AvatarOption } from "../components/poker/AvatarSelect";
import { ShowdownOverlay } from "../components/poker/ShowdownOverlay";
import { EmotePicker } from "../components/poker/EmoteSystem";
import { ChatPanel } from "../components/poker/ChatPanel";
import { HandHistoryDrawer } from "../components/poker/HandHistoryDrawer";
import { HandStrengthMeter } from "../components/poker/HandStrengthMeter";
import { ChipAnimation } from "../components/poker/ChipAnimation";
import { Player } from "../lib/poker-types";
import { useGameEngine } from "@/lib/game-engine";
import { useMultiplayerGame } from "@/lib/multiplayer-engine";
import { useAuth } from "@/lib/auth-context";
import { SoundProvider, useSoundEngine } from "@/lib/sound-context";
import { soundEngine } from "@/lib/sound-engine";
import type { VerificationStatus, FormatInfo } from "@/lib/multiplayer-engine";
import { ShieldCheck, Volume2, VolumeX, Trophy, ArrowLeft, Bot, Wifi, WifiOff, Users, AlertTriangle, Download, Play, ExternalLink } from "lucide-react";
import { WalletBar } from "@/components/wallet/WalletBar";
import { BlindLevelIndicator } from "@/components/game/BlindLevelIndicator";
import { TournamentResults } from "@/components/game/TournamentResults";
import { BombPotIndicator } from "@/components/game/BombPotIndicator";

import casinoBg from "@assets/generated_images/cyberpunk_casino_bg_wide.png";
import avatar1 from "@assets/generated_images/avatars/avatar_red_wolf.png";
import avatar2 from "@assets/generated_images/avatars/avatar_steel_ghost.png";
import avatar3 from "@assets/generated_images/avatars/avatar_dark_ace.png";
import avatar4 from "@assets/generated_images/avatars/avatar_neon_fox.png";
import avatar5 from "@assets/generated_images/avatars/avatar_cyber_punk.png";

const HERO_ID = "player-1";

const BOT_AVATARS = [avatar2, avatar3, avatar4, avatar5, avatar1];
const BOT_NAMES = ["CryptoKing", "Satoshi", "Whale_0x", "HODLer", "Degen"];
const BOT_CHIPS = [3200, 850, 5000, 1200, 2100];

const SEAT_POSITIONS = [
  { x: 50, y: 88 },  // Seat 0: Hero (bottom center)
  { x: 15, y: 72 },  // Seat 1: bottom-left
  { x: 5,  y: 48 },  // Seat 2: left
  { x: 15, y: 25 },  // Seat 3: top-left
  { x: 35, y: 12 },  // Seat 4: top-left-center
  { x: 55, y: 8  },  // Seat 5: top-center
  { x: 75, y: 12 },  // Seat 6: top-right-center
  { x: 90, y: 25 },  // Seat 7: top-right
  { x: 95, y: 48 },  // Seat 8: right
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
  commitmentHash, shuffleProof, verificationStatus, sendChat,
  playerSeedStatus, onChainCommitTx, onChainRevealTx,
  formatInfo, bombPotActive, tournamentComplete, dismissTournamentComplete,
  blindIncrease, elimination,
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
  commitmentHash?: string | null;
  shuffleProof?: any | null;
  verificationStatus?: VerificationStatus;
  sendChat?: (message: string) => void;
  playerSeedStatus?: import("@/lib/multiplayer-engine").PlayerSeedStatus;
  onChainCommitTx?: string | null;
  onChainRevealTx?: string | null;
  // Format extensions
  formatInfo?: FormatInfo;
  bombPotActive?: boolean;
  tournamentComplete?: import("@/lib/multiplayer-engine").TournamentCompleteInfo | null;
  dismissTournamentComplete?: () => void;
  blindIncrease?: import("@/lib/multiplayer-engine").BlindIncreaseInfo | null;
  elimination?: import("@/lib/multiplayer-engine").EliminationInfo | null;
}) {
  const [showProvablyFair, setShowProvablyFair] = useState(false);
  const [isMuted, setIsMuted] = useState(() => soundEngine.muted);
  const [quality, setQuality] = useState<QualityLevel>(() => {
    return (localStorage.getItem("poker-quality") as QualityLevel) || "high";
  });
  const [enableOrbit, setEnableOrbit] = useState(false);
  const [tableMode, setTableMode] = useState<"image" | "3d">(() => {
    return (localStorage.getItem("poker-table-mode") as "image" | "3d") || "image";
  });
  const sound = useSoundEngine();
  const tableRef = useRef<HTMLDivElement>(null);
  const prevHeroTurn = useRef(false);

  // Fetch real player stats for analytics panel
  const [playerStats, setPlayerStats] = useState({ handsPlayed: 0, potsWon: 0, vpip: 0, pfr: 0, showdownCount: 0 });
  useEffect(() => {
    if (!isMultiplayer) return;
    fetch("/api/stats/me").then(r => r.ok ? r.json() : null).then(s => {
      if (s) setPlayerStats({ handsPlayed: s.handsPlayed || 0, potsWon: s.potsWon || 0, vpip: s.vpip || 0, pfr: s.pfr || 0, showdownCount: s.showdownCount || 0 });
    }).catch(() => {});
  }, [isMultiplayer, gameState.handNumber]);

  const cycleQuality = () => {
    const next: Record<QualityLevel, QualityLevel> = { low: "medium", medium: "high", high: "low" };
    const q = next[quality];
    setQuality(q);
    localStorage.setItem("poker-quality", q);
  };

  const hero = players.find((p) => p.id === heroId);
  const isHeroTurn = gameState.currentTurnPlayerId === heroId;
  const heroCards = hero?.cards;

  const heroHoleCards = useMemo(() => {
    if (!heroCards) return undefined;
    return heroCards.map(c => ({ ...c, hidden: false })) as [typeof heroCards[0], typeof heroCards[1]];
  }, [heroCards]);

  // Ambient drone disabled — too distracting
  // useEffect(() => {
  //   sound.startAmbient();
  //   return () => sound.stopAmbient();
  // }, [sound]);

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
    <div className="min-h-screen bg-[#0a1022] text-white overflow-hidden relative font-sans flex">
      <div className="absolute inset-0">
        <img src={casinoBg} alt="" className="absolute inset-0 w-full h-full object-cover opacity-45" style={{ filter: "brightness(0.6) saturate(1.5) blur(1px)" }} />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(30,43,75,0.25)_0%,rgba(10,16,34,0.7)_80%)]" />
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
          className="absolute top-0 left-0 right-0 h-12 flex items-center justify-between px-5 z-50 bg-black/40 backdrop-blur-md border-b border-white/5"
        >
          <div className="flex items-center gap-3">
            {onBack && (
              <button
                onClick={leaveTable || onBack}
                className="rounded-lg p-2 hover:bg-white/10 transition-colors mr-1"
                title="Back to lobby"
              >
                <ArrowLeft className="w-4 h-4 text-gray-400" />
              </button>
            )}
            <div className="w-8 h-8 rounded-lg gold-gradient flex items-center justify-center shadow-[0_0_15px_rgba(201,168,76,0.3)]">
              <Trophy className="w-4 h-4 text-black" />
            </div>
            <div>
              <div className="font-display font-bold text-xs tracking-widest gold-text leading-none">
                {tableName || "HIGH ROLLERS"}
              </div>
              <div className="text-[9px] text-gray-500 tracking-[0.2em] font-mono mt-0.5">
                {formatInfo?.smallBlind && formatInfo?.bigBlind
                  ? <span className="text-emerald-400/80">${formatInfo.smallBlind}/${formatInfo.bigBlind} NLH</span>
                  : <>{players.length}-MAX NLH</>
                }
                <span className="mx-1.5 text-gray-700">|</span>
                <span className="text-cyan-500/70">Round: {phaseLabels[gameState.phase] || gameState.phase?.toUpperCase()}</span>
                <span className="mx-1.5 text-gray-700">|</span>
                {(gameState as any).handNumber
                  ? <span className="text-gray-400">Hand #{(gameState as any).handNumber}</span>
                  : <>{tableId ? `TABLE #${tableId.slice(0, 6).toUpperCase()}` : "TABLE #802"}</>
                }
                {formatInfo && formatInfo.gameFormat !== "cash" && (
                  <>
                    <span className="mx-1.5 text-gray-700">|</span>
                    <span className="text-amber-400/70">
                      {formatInfo.gameFormat === "sng" ? "SIT & GO" :
                       formatInfo.gameFormat === "heads_up" ? "HEADS UP" :
                       formatInfo.gameFormat === "tournament" ? "MTT" :
                       formatInfo.gameFormat === "bomb_pot" ? "BOMB POT" : ""}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <WalletBar />
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
            <button
              onClick={cycleQuality}
              className="glass rounded-lg px-2.5 py-1.5 hover:bg-white/5 transition-colors flex items-center gap-1.5"
              title={`Quality: ${quality}`}
            >
              <span className={`text-[9px] font-bold tracking-wider ${
                quality === "high" ? "text-green-400" : quality === "medium" ? "text-yellow-400" : "text-red-400"
              }`}>
                {quality.toUpperCase()}
              </span>
            </button>
            {tableMode === "3d" && (
              <button
                onClick={() => setEnableOrbit(!enableOrbit)}
                className={`glass rounded-lg p-2 transition-colors ${enableOrbit ? "bg-cyan-500/10 text-cyan-400" : "hover:bg-white/5 text-gray-500"}`}
                title={enableOrbit ? "Disable orbit" : "Enable orbit camera"}
              >
                <Settings className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={() => {
                const next = tableMode === "image" ? "3d" : "image";
                setTableMode(next);
                localStorage.setItem("poker-table-mode", next);
              }}
              className={`glass rounded-lg px-2.5 py-1.5 hover:bg-white/5 transition-colors flex items-center gap-1.5`}
              title={tableMode === "image" ? "Switch to 3D table" : "Switch to Image table"}
            >
              <span className={`text-[9px] font-bold tracking-wider ${
                tableMode === "3d" ? "text-purple-400" : "text-cyan-400"
              }`}>
                {tableMode === "3d" ? "3D" : "2D"}
              </span>
            </button>
            <button
              onClick={() => setShowProvablyFair(!showProvablyFair)}
              className={`glass rounded-lg px-3 py-1.5 flex items-center gap-2 transition-all ${
                showProvablyFair ? "neon-border-green" : "hover:bg-white/5"
              }`}
            >
              <ShieldCheck className={`w-3.5 h-3.5 ${
                verificationStatus === "verified" ? "text-green-400" :
                verificationStatus === "failed" ? "text-red-400" :
                verificationStatus === "verifying" ? "text-blue-400" :
                showProvablyFair ? "text-green-400" : "text-gray-500"
              }`} />
              <span className={`text-[10px] font-bold uppercase tracking-wider ${
                verificationStatus === "verified" ? "text-green-400" :
                verificationStatus === "failed" ? "text-red-400" :
                verificationStatus === "verifying" ? "text-blue-400" :
                showProvablyFair ? "text-green-400" : "text-gray-500"
              }`}>
                {verificationStatus === "verified" ? "Verified" :
                 verificationStatus === "failed" ? "Failed" :
                 verificationStatus === "verifying" ? "Verifying" :
                 "Fair Play"}
              </span>
            </button>
          </div>
        </motion.div>

        {/* Table Area — Image mode or 3D mode */}
        <div className="flex-1 relative flex items-center justify-center overflow-hidden">
          {tableMode === "image" ? (
            <>
              {/* ── The full table (background + game overlay + seats) ── */}
              {/*
                Engineer spec: Responsive aspect-ratio container with
                table-background (z:1) → game-overlay (z:10) → seats (z:20)
                All coordinates are % of the container.
              */}
              <div className="absolute inset-0 flex items-center justify-center overflow-hidden">
                {/* Room bg — dark navy like reference (#0a1022 → #1e2b4b) */}
                <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse at 50% 50%, #1e2b4b 0%, #0a1022 70%)" }} />

                {/* Aspect-ratio locked table container */}
                <div
                  ref={tableRef}
                  className="relative w-full"
                  style={{
                    aspectRatio: "16 / 9",
                    maxHeight: "90vh",
                    maxWidth: "min(100%, 160vh)",
                  }}
                >
                  {/* ImageTable renders: background image + community cards + pot + dealer btn + empty seats */}
                  <ImageTable
                    communityCards={gameState.communityCards}
                    pot={gameState.pot}
                    playerCount={players.length}
                    maxSeats={9}
                    players={players}
                    dealerSeatIndex={players.findIndex(p => p.isDealer)}
                  />

                  {/* Waiting overlay */}
                  {isMultiplayer && waiting && players.length < 2 && (
                    <div className="absolute inset-0 flex items-center justify-center" style={{ zIndex: 30 }}>
                      <div className="glass rounded-xl px-6 py-4 text-center border border-white/10 pointer-events-auto">
                        <Users className="w-8 h-8 text-cyan-400 mx-auto mb-2" />
                        <p className="text-sm text-gray-300 mb-1">Waiting for players...</p>
                        <p className="text-xs text-gray-500">{players.length} / 2 minimum</p>
                      </div>
                    </div>
                  )}

                  {/* Player seats — positioned inside the same container as the table */}
                  {players.map((player, index) => {
                    const seat = TABLE_SEATS[index] || TABLE_SEATS[index % TABLE_SEATS.length];
                    return (
                      <Seat
                        key={player.id}
                        player={player}
                        position={{ x: seat.x, y: seat.y }}
                        isHero={player.id === heroId}
                        isWinner={showdown?.results?.some((r: any) => r.playerId === player.id && r.isWinner)}
                        seatIndex={index}
                        perspectiveScale={seat.scale}
                      />
                    );
                  })}

                  {/* Hero hole cards — displayed ABOVE hero seat, z-index above everything */}
                  {heroCards && gameState.phase !== "waiting" && (
                    <motion.div
                      initial={{ y: 30, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      transition={{ delay: 0.5, type: "spring", stiffness: 200, damping: 22 }}
                      className="absolute left-1/2 flex gap-3"
                      style={{
                        bottom: "1%",
                        transform: "translateX(-50%)",
                        zIndex: 50,
                        filter: "drop-shadow(0 6px 20px rgba(0,0,0,0.5))",
                      }}
                    >
                      {heroCards.map((card, i) => (
                        <Card
                          key={`hero-${i}`}
                          card={{ ...card, hidden: false }}
                          size="xl"
                          isHero={true}
                          delay={0.3 + i * 0.15}
                        />
                      ))}
                    </motion.div>
                  )}
                </div>
              </div>
            </>
          ) : (
            <>
              {/* Three.js 3D Table (full scene — cards, chips, avatars all in 3D) */}
              <div className="absolute inset-0 z-0">
                <Table3D
                  quality={quality}
                  enableOrbit={enableOrbit}
                  communityCards={gameState.communityCards}
                  pot={gameState.pot}
                  isHeroTurn={isHeroTurn}
                  heroPosition={(() => {
                    const pos = seatPositions[0] || SEAT_POSITIONS[0];
                    const x = ((pos.x - 50) / 50) * 5.5;
                    const z = ((pos.y - 50) / 50) * 3.5;
                    return [x, 0.15, z] as [number, number, number];
                  })()}
                  playerAvatars={players.map((p, i) => {
                    const pos = seatPositions[i] || SEAT_POSITIONS[i % SEAT_POSITIONS.length];
                    const x = ((pos.x - 50) / 50) * 5.5;
                    const z = ((pos.y - 50) / 50) * 3.5;
                    return {
                      position: [x, 0.15, z] as [number, number, number],
                      avatarUrl: p.avatar,
                      isActive: p.status === "thinking",
                      glowColor: p.id === heroId ? "#00f0ff" : "#ffd700",
                      cards: p.cards,
                      isHero: p.id === heroId,
                    };
                  })}
                  chipPositions={players
                    .filter(p => p.currentBet > 0)
                    .map((p) => {
                      const pos = seatPositions[players.indexOf(p)] || SEAT_POSITIONS[0];
                      const x = ((pos.x - 50) / 50) * 4;
                      const z = ((pos.y - 50) / 50) * 2.5;
                      return [x * 0.6, 0.2, z * 0.6] as [number, number, number];
                    })}
                  dealerPosition={(() => {
                    const dealerIdx = players.findIndex(p => p.isDealer);
                    if (dealerIdx < 0) return undefined;
                    const pos = seatPositions[dealerIdx] || SEAT_POSITIONS[dealerIdx % SEAT_POSITIONS.length];
                    const x = ((pos.x - 50) / 50) * 5.5;
                    const z = ((pos.y - 50) / 50) * 3.5;
                    return [x * 0.7, 0.15, z * 0.7] as [number, number, number];
                  })()}
                />
              </div>

              {/* HTML Overlay (player names/chips HUD + waiting overlay) */}
              <motion.div
                ref={tableRef}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.8, ease: "easeOut" }}
                className="absolute inset-0 z-10 pointer-events-none"
              >
                {/* Waiting overlay */}
                {isMultiplayer && waiting && players.length < 2 && (
                  <div className="absolute inset-0 flex items-center justify-center z-30 pointer-events-auto">
                    <div className="glass rounded-xl px-6 py-4 text-center border border-white/10">
                      <Users className="w-8 h-8 text-cyan-400 mx-auto mb-2" />
                      <p className="text-sm text-gray-300 mb-1">Waiting for players...</p>
                      <p className="text-xs text-gray-500">{players.length} / 2 minimum</p>
                    </div>
                  </div>
                )}

                {/* Central pot display */}
                {gameState.pot > 0 && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="absolute left-1/2 top-[38%] -translate-x-1/2 -translate-y-1/2 z-20 flex flex-col items-center"
                  >
                    <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-400 mb-0.5">POT</div>
                    <div className="px-4 py-1.5 rounded-lg backdrop-blur-md bg-black/50 border border-amber-500/20"
                      style={{ boxShadow: "0 0 20px rgba(255,215,0,0.1)" }}>
                      <span className="text-lg font-mono font-bold text-amber-400">${gameState.pot.toLocaleString()}</span>
                    </div>
                  </motion.div>
                )}

                {/* Community cards — HTML overlay for 3D mode */}
                {gameState.communityCards && gameState.communityCards.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="absolute left-1/2 top-[48%] -translate-x-1/2 -translate-y-1/2 z-20 flex gap-2"
                  >
                    {gameState.communityCards.map((card: any, i: number) => (
                      <Card key={`cc-${i}`} card={card} size="md" delay={i * 0.12} />
                    ))}
                  </motion.div>
                )}

                {/* Dealer button — HTML overlay for 3D mode */}
                {(() => {
                  const dealerIdx = players.findIndex(p => p.isDealer);
                  if (dealerIdx < 0) return null;
                  const pos = seatPositions[dealerIdx] || SEAT_POSITIONS[dealerIdx % SEAT_POSITIONS.length];
                  return (
                    <div
                      className="absolute z-20 w-7 h-7 rounded-full bg-white text-black flex items-center justify-center text-[10px] font-black shadow-lg border-2 border-amber-400"
                      style={{ left: `${pos.x + 3}%`, top: `${pos.y - 5}%` }}
                    >
                      D
                    </div>
                  );
                })()}

                {/* Player seats (name, chips, timer HUD + face-down card backs for opponents) */}
                {players.map((player, index) => (
                  <Seat
                    key={player.id}
                    player={player}
                    position={seatPositions[index] || SEAT_POSITIONS[index % SEAT_POSITIONS.length]}
                    isHero={player.id === heroId}
                    isWinner={showdown?.results?.some((r: any) => r.playerId === player.id && r.isWinner)}
                    seatIndex={index}
                  />
                ))}
              </motion.div>

              {/* Hero hole cards - large display at bottom */}
              {heroCards && gameState.phase !== "waiting" && (
                <motion.div
                  initial={{ y: 30, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.5, type: "spring" }}
                  className="absolute bottom-28 left-1/2 -translate-x-1/2 z-30 flex gap-2"
                >
                  {heroCards.map((card, i) => (
                    <Card
                      key={`hero-${i}`}
                      card={{ ...card, hidden: false }}
                      size="xl"
                      isHero={true}
                      delay={0.3 + i * 0.15}
                    />
                  ))}
                </motion.div>
              )}
            </>
          )}
        </div>

        <EmotePicker heroId={heroId} isMultiplayer={isMultiplayer} />
        <ChatPanel isMultiplayer={isMultiplayer} sendChat={sendChat} />
        {isMultiplayer && tableId && <HandHistoryDrawer tableId={tableId} />}

        {/* Format-aware HUD overlays */}
        {formatInfo && (formatInfo.gameFormat === "sng" || formatInfo.gameFormat === "tournament") && (
          <BlindLevelIndicator
            currentLevel={formatInfo.currentBlindLevel}
            sb={gameState.minBet ? Math.floor(gameState.minBet / 2) : 10}
            bb={gameState.minBet || 20}
            ante={0}
            nextLevelIn={formatInfo.nextLevelIn}
          />
        )}

        {formatInfo && (formatInfo.gameFormat === "sng" || formatInfo.gameFormat === "tournament") && hero && (
          <TournamentStatsPanel
            chips={hero.chips}
            playersRemaining={formatInfo.playersRemaining || players.length}
            currentBlindLevel={formatInfo.currentBlindLevel}
            sb={gameState.minBet ? Math.floor(gameState.minBet / 2) : 10}
            bb={gameState.minBet || 20}
            ante={0}
            totalPlayers={players.length}
          />
        )}

        {isMultiplayer && hero && (
          <PlayerAnalyticsPanel
            stats={playerStats}
          />
        )}

        {isMultiplayer && hero && heroCards && heroCards.length > 0 && gameState.phase !== "waiting" && (
          <div className="fixed bottom-4 right-4 z-40">
            <AIAnalysisPanel
              holeCards={heroCards}
              communityCards={gameState.communityCards || []}
              pot={gameState.pot || 0}
              position={hero.isDealer ? "button" : hero.isBigBlind ? "early" : "late"}
            />
          </div>
        )}

        <AnimatePresence>
          {bombPotActive && <BombPotIndicator visible={bombPotActive} />}
        </AnimatePresence>

        <AnimatePresence>
          {blindIncrease && (
            <motion.div
              initial={{ y: -50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -50, opacity: 0 }}
              className="fixed top-20 left-1/2 -translate-x-1/2 z-50 glass rounded-xl px-6 py-3 border border-amber-500/30"
              style={{ boxShadow: "0 0 20px rgba(245,158,11,0.2)" }}
            >
              <div className="text-center">
                <div className="text-[10px] font-bold uppercase tracking-wider text-amber-400 mb-1">Blinds Increased</div>
                <div className="text-sm font-bold text-white font-mono">
                  Level {blindIncrease.level}: {blindIncrease.sb}/{blindIncrease.bb}
                  {blindIncrease.ante > 0 && <span className="text-gray-400 ml-1">(ante {blindIncrease.ante})</span>}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {elimination && (
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              className="fixed top-1/3 left-1/2 -translate-x-1/2 z-50 glass rounded-xl px-8 py-4 border border-red-500/30"
              style={{ boxShadow: "0 0 30px rgba(239,68,68,0.2)" }}
            >
              <div className="text-center">
                <AlertTriangle className="w-8 h-8 text-red-400 mx-auto mb-2" />
                <div className="text-sm font-bold text-white mb-1">{elimination.displayName} Eliminated</div>
                <div className="text-xs text-gray-400">
                  Finished #{elimination.finishPlace}
                  {elimination.prizeAmount > 0 && (
                    <span className="text-amber-400 ml-2">Won {elimination.prizeAmount} chips</span>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {tournamentComplete && dismissTournamentComplete && (
            <TournamentResults
              results={tournamentComplete.results}
              prizePool={tournamentComplete.prizePool}
              onClose={dismissTournamentComplete}
            />
          )}
        </AnimatePresence>

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
        {showProvablyFair && (
          <ProvablyFairPanel
            onClose={() => setShowProvablyFair(false)}
            commitmentHash={commitmentHash}
            shuffleProof={shuffleProof}
            verificationStatus={verificationStatus}
            playerSeedStatus={playerSeedStatus}
            onChainCommitTx={onChainCommitTx}
            onChainRevealTx={onChainRevealTx}
          />
        )}
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
    connected, waiting, joinTable, leaveTable, addBots, sendChat,
    commitmentHash, shuffleProof, verificationStatus, playerSeedStatus,
    onChainCommitTx, onChainRevealTx,
    formatInfo, blindIncrease, elimination, tournamentComplete,
    dismissTournamentComplete, bombPotActive, notifications,
  } = useMultiplayerGame(tableId, user?.id || "");

  // Fetch table info
  useEffect(() => {
    fetch(`/api/tables/${tableId}`)
      .then(r => r.json())
      .then(setTableInfo)
      .catch(() => {});
  }, [tableId]);

  const isSNG = tableInfo?.gameFormat === "sng" || tableInfo?.gameFormat === "tournament";

  const handleJoin = () => {
    const amount = isSNG ? (tableInfo?.buyInAmount || buyIn) : buyIn;
    joinTable(amount);
    setJoined(true);
    soundEngine.init();
  };

  const handleLeave = () => {
    if (isSNG) {
      if (!confirm("Leaving a Sit & Go will forfeit your buy-in. Are you sure?")) return;
    }
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
                {isSNG && (
                  <span className="ml-2 text-amber-400">
                    &middot; {tableInfo.gameFormat === "sng" ? "Sit & Go" : "Tournament"}
                  </span>
                )}
              </p>
            )}
          </div>

          {isSNG ? (
            /* SNG: Fixed buy-in display */
            <div className="mb-6">
              <label className="text-[10px] font-bold uppercase tracking-wider text-gray-500 block mb-2">
                Fixed Buy-In
              </label>
              <div className="glass rounded-lg p-4 border border-amber-500/20 text-center">
                <div className="text-2xl font-bold text-amber-400 font-mono">
                  {(tableInfo?.buyInAmount || 500).toLocaleString()}
                </div>
                <div className="text-[10px] text-gray-500 mt-1">
                  Starting chips: {(tableInfo?.startingChips || 1500).toLocaleString()}
                </div>
              </div>
              <p className="text-center text-[10px] text-gray-600 mt-2">
                Balance: {user?.chipBalance?.toLocaleString()} chips
              </p>
            </div>
          ) : (
            /* Cash game: Buy-in slider */
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
          )}

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
              disabled={!connected || (isSNG ? (tableInfo?.buyInAmount || 500) : buyIn) > (user?.chipBalance || 0)}
              className="flex-1 gold-gradient rounded-lg py-3 text-sm font-bold tracking-wider text-black disabled:opacity-50"
            >
              {isSNG ? "REGISTER" : "SIT DOWN"}
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
        commitmentHash={commitmentHash}
        shuffleProof={shuffleProof}
        verificationStatus={verificationStatus}
        sendChat={sendChat}
        playerSeedStatus={playerSeedStatus}
        onChainCommitTx={onChainCommitTx}
        onChainRevealTx={onChainRevealTx}
        formatInfo={formatInfo}
        bombPotActive={bombPotActive}
        tournamentComplete={tournamentComplete}
        dismissTournamentComplete={dismissTournamentComplete}
        blindIncrease={blindIncrease}
        elimination={elimination}
      />
      {/* Join/Leave Notifications */}
      <div className="fixed top-16 right-4 z-[60] flex flex-col gap-2 pointer-events-none">
        <AnimatePresence>
          {notifications.map((n) => (
            <motion.div
              key={n.id}
              initial={{ x: 100, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 100, opacity: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
              className={`px-4 py-2 rounded-lg backdrop-blur-md text-xs font-bold uppercase tracking-wider border ${
                n.type === "join"
                  ? "bg-green-500/15 text-green-400 border-green-500/20"
                  : "bg-red-500/15 text-red-400 border-red-500/20"
              }`}
              style={{ boxShadow: n.type === "join" ? "0 0 15px rgba(34,197,94,0.1)" : "0 0 15px rgba(239,68,68,0.1)" }}
            >
              {n.message}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
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
