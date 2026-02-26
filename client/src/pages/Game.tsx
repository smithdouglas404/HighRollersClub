import { useState, useMemo, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Seat } from "../components/poker/Seat";
import { Card } from "../components/poker/Card";
import { ImageTable } from "../components/poker/ImageTable";

import { PokerControls } from "../components/poker/Controls";
import { ProvablyFairPanel } from "../components/poker/ProvablyFairPanel";
import { AmbientParticles } from "../components/AmbientParticles";
import { MatrixRain } from "../components/MatrixRain";
import { AVATAR_OPTIONS, type AvatarOption } from "../components/poker/AvatarSelect";
import { GameSetup, type GameSetupConfig } from "../components/game/GameSetup";
import { ShowdownOverlay } from "../components/poker/ShowdownOverlay";
import { EmotePicker } from "../components/poker/EmoteSystem";
import { ChatPanel } from "../components/poker/ChatPanel";
import { HandHistoryDrawer } from "../components/poker/HandHistoryDrawer";
import { VideoControlBar, VideoThumbnail } from "../components/poker/VideoOverlay";
import { HandStrengthMeter } from "../components/poker/HandStrengthMeter";
import { ChipAnimation } from "../components/poker/ChipAnimation";
import { InsurancePanel } from "../components/poker/InsurancePanel";
import { RunItVotePanel, RunItResults } from "../components/poker/RunItMultiple";
import { CardSqueeze } from "../components/poker/CardSqueeze";
import { useIsMobile } from "@/hooks/use-mobile";
import { TournamentStatsPanel } from "@/components/game/TournamentStatsPanel";
import { PlayerAnalyticsPanel } from "@/components/game/PlayerAnalyticsPanel";
import { AIAnalysisPanel } from "@/components/game/AIAnalysisPanel";
import { Player } from "../lib/poker-types";
import { TABLE_SEATS } from "@/lib/table-constants";
import { useGameEngine, type GameEngineConfig } from "@/lib/game-engine";
import { useMultiplayerGame } from "@/lib/multiplayer-engine";
import { useAuth } from "@/lib/auth-context";
import { SoundProvider, useSoundEngine } from "@/lib/sound-context";
import { soundEngine } from "@/lib/sound-engine";
import { GameUIProvider, useGameUI, FELT_PRESETS } from "@/lib/game-ui-context";
import { useOpponentStats, type OpponentHudStats } from "@/lib/useOpponentStats";
import type { VerificationStatus, FormatInfo } from "@/lib/multiplayer-engine";
import { ShieldCheck, Volume2, VolumeX, Trophy, ArrowLeft, Bot, Wifi, WifiOff, Users, AlertTriangle, Minimize2, Maximize2, BarChart2, Music, Play, Pause, X } from "lucide-react";
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


const phaseLabels: Record<string, string> = {
  "pre-flop": "PRE-FLOP",
  flop: "FLOP",
  turn: "TURN",
  river: "RIVER",
  showdown: "SHOWDOWN",
};

function buildPlayersFromConfig(heroAvatar: AvatarOption, heroName: string, config: GameSetupConfig): Player[] {
  const playerCount = config.maxPlayers;
  const heroChips = (config.gameFormat === "sng" || config.gameFormat === "tournament")
    ? config.startingChips
    : config.minBuyIn + Math.floor((config.maxBuyIn - config.minBuyIn) * 0.6);
  const botCount = playerCount - 1;

  const bots: Player[] = [];
  for (let i = 0; i < botCount && i < BOT_NAMES.length; i++) {
    const botChips = (config.gameFormat === "sng" || config.gameFormat === "tournament")
      ? config.startingChips
      : config.minBuyIn + Math.floor(Math.random() * (config.maxBuyIn - config.minBuyIn));
    bots.push({
      id: `player-${i + 2}`,
      name: BOT_NAMES[i],
      chips: botChips,
      isActive: true,
      isDealer: i === 0,
      currentBet: 0,
      status: "waiting" as const,
      avatar: BOT_AVATARS[i % BOT_AVATARS.length],
    });
  }

  return [
    {
      id: HERO_ID,
      name: heroName,
      chips: heroChips,
      isActive: true,
      isDealer: false,
      currentBet: 0,
      status: "waiting",
      timeLeft: 100,
      avatar: heroAvatar.image || undefined,
    },
    ...bots,
  ];
}

// Shared game table renderer
function GameTable({
  players, gameState, handlePlayerAction, showdown, heroId, tableName, tableId,
  onBack, isMultiplayer, connected, waiting, addBots, leaveTable,
  commitmentHash, shuffleProof, verificationStatus, sendChat,
  playerSeedStatus, onChainCommitTx, onChainRevealTx,
  formatInfo, bombPotActive, tournamentComplete, dismissTournamentComplete,
  blindIncrease, elimination, startingChips,
  buyTime, acceptInsurance, declineInsurance, voteRunIt,
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
  startingChips?: number;
  buyTime?: () => void;
  acceptInsurance?: () => void;
  declineInsurance?: () => void;
  voteRunIt?: (count: 1 | 2 | 3) => void;
}) {
  const [showProvablyFair, setShowProvablyFair] = useState(false);
  const [isMuted, setIsMuted] = useState(() => soundEngine.muted);
  const [showBgmPanel, setShowBgmPanel] = useState(false);
  const [bgmUrl, setBgmUrl] = useState(() => soundEngine.bgmUrl);
  const [bgmPlaying, setBgmPlaying] = useState(() => soundEngine.bgmPlaying);
  const [bgmVolume, setBgmVolume] = useState(() => soundEngine.bgmVolume);
  const sound = useSoundEngine();
  const winStreaks = useRef<Map<string, number>>(new Map());
  const isMobile = useIsMobile();
  const { compactMode, toggleCompactMode, feltPreset, setFeltColor } = useGameUI();
  const { opponentStats, hudEnabled, setHudEnabled } = useOpponentStats(gameState, players, heroId);
  const tableRef = useRef<HTMLDivElement>(null);
  const prevHeroTurn = useRef(false);

  // Fetch real player stats for analytics panel (debounced to avoid rapid re-fetches)
  const [playerStats, setPlayerStats] = useState({ handsPlayed: 0, potsWon: 0, vpip: 0, pfr: 0, showdownCount: 0 });
  useEffect(() => {
    if (!isMultiplayer) return;
    const timer = setTimeout(() => {
      fetch("/api/stats/me").then(r => r.ok ? r.json() : null).then(s => {
        if (s) setPlayerStats({ handsPlayed: s.handsPlayed || 0, potsWon: s.potsWon || 0, vpip: s.vpip || 0, pfr: s.pfr || 0, showdownCount: s.showdownCount || 0 });
      }).catch(() => {});
    }, 2000);
    return () => clearTimeout(timer);
  }, [isMultiplayer, gameState.handNumber]);

  // Track win streaks from showdown results
  useEffect(() => {
    if (showdown?.results) {
      const winnerIds = new Set(showdown.results.filter((r: any) => r.isWinner).map((r: any) => r.playerId));
      for (const p of players) {
        if (winnerIds.has(p.id)) {
          winStreaks.current.set(p.id, (winStreaks.current.get(p.id) || 0) + 1);
        } else {
          winStreaks.current.set(p.id, 0);
        }
      }
    }
  }, [showdown, players]);

  const hero = players.find((p) => p.id === heroId);
  const isHeroTurn = gameState.currentTurnPlayerId === heroId;
  const heroCards = hero?.cards;

  const heroHoleCards = useMemo(() => {
    if (!heroCards) return undefined;
    return heroCards.map(c => ({ ...c, hidden: false })) as [typeof heroCards[0], typeof heroCards[1]];
  }, [heroCards]);

  // Adaptive music — responds to game state
  useEffect(() => {
    sound.startAdaptiveMusic();
    return () => sound.stopAdaptiveMusic();
  }, [sound]);

  // Adaptive music state tracking
  const prevPhaseRef = useRef(gameState.phase);
  useEffect(() => {
    const heroFolded = hero?.status === "folded";
    const anyAllIn = players.some(p => p.status === "all-in");
    const phase = gameState.phase;

    if (phase === "showdown") {
      sound.setMusicState("showdown");
    } else if (anyAllIn) {
      sound.setMusicState("all_in");
    } else if (!heroFolded && phase !== "pre-flop" && phase !== "waiting") {
      sound.setMusicState("in_hand", { potSize: gameState.pot, blindLevel: gameState.minBet });
    } else {
      sound.setMusicState("idle");
    }
    prevPhaseRef.current = phase;
  }, [gameState.phase, gameState.pot, gameState.minBet, hero?.status, players, sound]);

  // Spatial sound for opponent actions
  const prevActionNumberRef = useRef<number | undefined>(undefined);
  useEffect(() => {
    const la = gameState.lastAction;
    const actionNum = gameState.actionNumber;
    if (!la || actionNum === prevActionNumberRef.current) return;
    prevActionNumberRef.current = actionNum;
    if (la.playerId === heroId) return; // hero sounds handled by Controls

    // Find the seat position of the acting player
    const playerIdx = players.findIndex(p => p.id === la.playerId);
    if (playerIdx < 0) return;
    const seat = TABLE_SEATS[playerIdx] || TABLE_SEATS[playerIdx % TABLE_SEATS.length];
    const seatX = seat.x;
    const seatScale = seat.scale;

    switch (la.action) {
      case "fold": sound.playFoldAt(seatX, seatScale); break;
      case "check": sound.playCheckAt(seatX, seatScale); break;
      case "call": sound.playCallAt(seatX, seatScale); break;
      case "raise": sound.playRaiseAt(seatX, seatScale); break;
    }
  }, [gameState.lastAction, gameState.actionNumber, heroId, players, sound]);

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
    <div className="h-screen bg-[#0a1022] text-white overflow-hidden relative font-sans flex flex-col">
      {/* Background layers */}
      <div className="absolute inset-0">
        <img src={casinoBg} alt="" className="absolute inset-0 w-full h-full object-cover opacity-45" style={{ filter: "brightness(0.6) saturate(1.5) blur(1px)" }} />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(30,43,75,0.25)_0%,rgba(10,16,34,0.7)_80%)]" />
        {!compactMode && <AmbientParticles />}
      </div>

      {!compactMode && (
        <MatrixRain side="both" color="#00ff9d" opacity={0.08} density={0.25} className="absolute inset-0 z-[1]" />
      )}

      <ChipAnimation containerRef={tableRef} />

      {showdown && (
        <ShowdownOverlay visible={!!showdown} results={showdown.results} players={players} pot={showdown.pot} />
      )}

      {/* ═══ TOP BAR ═══ */}
      <div className="relative z-50 h-10 flex items-center justify-between px-4 bg-black/60 backdrop-blur-md border-b border-white/5 shrink-0">
        <div className="flex items-center gap-3">
          {onBack && (
            <button onClick={leaveTable || onBack} className="p-1.5 hover:bg-white/10 rounded-lg transition-colors" title="Back to lobby">
              <ArrowLeft className="w-4 h-4 text-gray-400" />
            </button>
          )}
          <span className="font-bold text-sm tracking-wider" style={{ background: "linear-gradient(135deg, #ff4444, #ff8800)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            CYBERPOKER
          </span>
          <span className="text-xs font-bold gold-text tracking-wider">{tableName || "HIGH ROLLERS MAIN"}</span>
          <span className="text-[10px] text-gray-500 font-mono">
            {formatInfo?.smallBlind && formatInfo?.bigBlind
              ? <span className="text-emerald-400/80">${formatInfo.smallBlind}/${formatInfo.bigBlind} NLH</span>
              : <>{players.length}-MAX</>
            }
          </span>
          <span className="text-[10px] text-cyan-500/80 font-mono">Round: {phaseLabels[gameState.phase] || gameState.phase?.toUpperCase()}</span>
          <span className="text-[10px] text-gray-400 font-mono">
            {(gameState as any).handNumber
              ? <>Hand: ${gameState.pot?.toLocaleString() || "0"}</>
              : <>{tableId ? `#${tableId.slice(0, 6).toUpperCase()}` : ""}</>
            }
          </span>
        </div>

        <div className="flex items-center gap-3">
          <div className="px-3 py-1 rounded-lg bg-black/40 border border-amber-500/20">
            <span className="text-[10px] text-gray-400 mr-1">POT:</span>
            <span className="text-sm font-bold text-amber-400 font-mono">${gameState.pot?.toLocaleString() || "0"}</span>
          </div>

          {showdown?.results?.some((r: any) => r.isWinner && r.playerId === heroId) && (
            <span className="text-[10px] font-bold text-cyan-400">
              WINNER: YOU ({showdown.results.find((r: any) => r.isWinner && r.playerId === heroId)?.handName || ""})
            </span>
          )}

          {isMultiplayer && (
            <div className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold ${
              connected ? "text-green-400 bg-green-500/10" : "text-red-400 bg-red-500/10"
            }`}>
              {connected ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
              {connected ? "LIVE" : "OFF"}
            </div>
          )}

          {waiting && addBots && (
            <button onClick={addBots} className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 hover:bg-amber-500/20">
              <Bot className="w-3 h-3" /> BOTS
            </button>
          )}

          <button onClick={handleMuteToggle} className="p-1.5 hover:bg-white/5 rounded transition-colors" title={isMuted ? "Unmute" : "Mute"}>
            {isMuted ? <VolumeX className="w-3.5 h-3.5 text-red-400" /> : <Volume2 className="w-3.5 h-3.5 text-gray-500" />}
          </button>

          <button onClick={() => setShowProvablyFair(!showProvablyFair)} className="p-1.5 hover:bg-white/5 rounded transition-colors">
            <ShieldCheck className={`w-3.5 h-3.5 ${verificationStatus === "verified" ? "text-green-400" : "text-gray-500"}`} />
          </button>

          {gameState.phase === "showdown" && (
            <button className="px-3 py-1 rounded-lg border border-green-500/30 text-[10px] font-bold text-green-400 hover:bg-green-500/10 transition-colors">
              + NEW HAND
            </button>
          )}
        </div>
      </div>

      {/* ═══ 3-COLUMN BODY ═══ */}
      <div className="flex-1 relative z-10 flex overflow-hidden">

        {/* ── LEFT SIDEBAR: Hand History ── */}
        <div className="w-52 shrink-0 bg-black/40 backdrop-blur-sm border-r border-white/5 flex flex-col overflow-hidden">
          <div className="px-3 py-2 border-b border-white/5 flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
              Hand #{(gameState as any).handNumber || "—"}
            </span>
          </div>
          <div className="flex-1 overflow-y-auto px-3 py-2 space-y-3 text-[10px] scrollbar-thin">
            {["pre-flop", "flop", "turn", "river", "showdown"].map((street) => {
              const actions = (gameState as any).actionLog?.filter((a: any) => a.street === street) || [];
              const isCurrentStreet = gameState.phase === street;
              if (actions.length === 0 && !isCurrentStreet) return null;
              return (
                <div key={street}>
                  <div className="font-bold uppercase tracking-wider text-red-400 mb-1">
                    <span className="mr-1">&bull;</span>{street.replace("-", "-").toUpperCase()}
                  </div>
                  {actions.length > 0 ? actions.map((a: any, i: number) => (
                    <div key={i} className="text-gray-400 leading-relaxed pl-2">
                      <span className="text-white font-medium">{a.playerName || "Player"}</span>{" "}
                      <span className={a.action === "fold" ? "text-red-400" : a.action === "raise" ? "text-cyan-400" : "text-green-400"}>
                        {a.action?.toUpperCase()}
                      </span>
                      {a.amount > 0 && <span className="text-amber-400 ml-1">${a.amount}</span>}
                    </div>
                  )) : (
                    <div className="text-gray-600 pl-2 italic">...</div>
                  )}
                </div>
              );
            })}
            {showdown?.results && (
              <div>
                <div className="font-bold uppercase tracking-wider text-red-400 mb-1">
                  <span className="mr-1">&bull;</span>SHOWDOWN
                </div>
                {showdown.results.filter((r: any) => r.isWinner).map((r: any, i: number) => (
                  <div key={i} className="text-green-400 pl-2 font-bold">
                    {r.playerId === heroId ? "YOU" : players.find(p => p.id === r.playerId)?.name || "Player"} WIN!
                    <div className="text-gray-400 font-normal text-[9px]">({r.handName})</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── CENTER: Table + Hero Cards + Controls ── */}
        <div className="flex-1 flex flex-col overflow-hidden relative">
          {/* Table area */}
          <div className="flex-1 relative overflow-hidden">
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse at 50% 50%, #1e2b4b 0%, #0a1022 70%)" }} />

              <div
                ref={tableRef}
                className="relative w-full"
                style={{ aspectRatio: "16 / 9", maxHeight: "85vh", maxWidth: "min(100%, 160vh)" }}
              >
                <ImageTable
                  communityCards={gameState.communityCards}
                  pot={gameState.pot}
                  playerCount={players.length}
                  maxSeats={10}
                  players={players}
                  dealerSeatIndex={players.findIndex(p => p.isDealer)}
                />

                {isMultiplayer && waiting && players.length < 2 && (
                  <div className="absolute inset-0 flex items-center justify-center" style={{ zIndex: 30 }}>
                    <div className="glass rounded-xl px-6 py-4 text-center border border-white/10 pointer-events-auto">
                      <Users className="w-8 h-8 text-cyan-400 mx-auto mb-2" />
                      <p className="text-sm text-gray-300 mb-1">Waiting for players...</p>
                      <p className="text-xs text-gray-500">{players.length} / 2 minimum</p>
                    </div>
                  </div>
                )}

                {players.map((player, index) => {
                  const seat = TABLE_SEATS[index] || TABLE_SEATS[index % TABLE_SEATS.length];
                  const avatarOpt = player.avatar ? AVATAR_OPTIONS.find(a => a.image === player.avatar) : undefined;
                  return (
                    <Seat
                      key={player.id}
                      player={player}
                      position={{ x: seat.x, y: seat.y }}
                      isHero={player.id === heroId}
                      isWinner={showdown?.results?.some((r: any) => r.playerId === player.id && r.isWinner)}
                      seatIndex={index}
                      perspectiveScale={seat.scale}
                      hudStats={player.id !== heroId && hudEnabled ? opponentStats.get(player.id) : undefined}
                      avatarTier={avatarOpt?.tier}
                      winStreak={winStreaks.current.get(player.id) || 0}
                      showVideo={isMultiplayer && !player.isBot}
                    />
                  );
                })}
              </div>
            </div>
          </div>

          {/* Hero hole cards — below the table */}
          <div className="relative z-20 flex justify-center py-1 shrink-0" style={{ minHeight: heroCards && gameState.phase !== "waiting" ? 80 : 0 }}>
            {heroCards && gameState.phase !== "waiting" && (
              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.3, type: "spring", stiffness: 200, damping: 22 }}
                className="flex gap-3"
                style={{ filter: "drop-shadow(0 6px 20px rgba(0,0,0,0.5))" }}
              >
                {isMobile && heroHoleCards ? (
                  <CardSqueeze cards={heroHoleCards} />
                ) : (
                  heroCards.map((card, i) => (
                    <Card
                      key={`hero-${i}`}
                      card={{ ...card, hidden: false }}
                      size={compactMode ? "lg" : "xl"}
                      isHero={true}
                      delay={compactMode ? 0 : 0.3 + i * 0.15}
                    />
                  ))
                )}
              </motion.div>
            )}
          </div>

          {/* Bottom controls — inline, not fixed */}
          <div className="relative z-30 shrink-0">
            <div className={`transition-all duration-300 ${!isHeroTurn || gameState.phase === "showdown" ? "opacity-40 grayscale pointer-events-none" : "opacity-100"}`}>
              <PokerControls
                onAction={handlePlayerAction}
                minBet={gameState.minBet}
                maxBet={hero?.chips || 1000}
                pot={gameState.pot}
                phase={gameState.phase}
                currentTurnSeat={players.findIndex(p => p.id === gameState.currentTurnPlayerId)}
                isHeroTurn={isHeroTurn}
                onBuyTime={buyTime}
                bigBlind={formatInfo?.bigBlind || gameState.minBet || undefined}
                heroTimeLeft={hero?.timeLeft}
                heroStatus={hero?.status}
              />
            </div>
          </div>
        </div>

        {/* ── RIGHT SIDEBAR: Chat + Analytics + Stats ── */}
        <div className="w-52 shrink-0 bg-black/40 backdrop-blur-sm border-l border-white/5 flex flex-col overflow-hidden">
          {/* Chat section */}
          <div className="flex-1 flex flex-col border-b border-white/5 min-h-0">
            <div className="px-3 py-2 border-b border-white/5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Chat</span>
            </div>
            <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1 text-[10px] scrollbar-thin">
              {(gameState as any).chatMessages?.map((msg: any, i: number) => (
                <div key={i} className="leading-relaxed">
                  <span className="font-bold text-cyan-400">{msg.playerName}:</span>{" "}
                  <span className="text-gray-300">{msg.message}</span>
                </div>
              )) || <div className="text-gray-600 italic">No messages yet</div>}
            </div>
            {sendChat && (
              <div className="px-2 py-2 border-t border-white/5">
                <form onSubmit={(e) => {
                  e.preventDefault();
                  const input = (e.target as HTMLFormElement).elements.namedItem("chatInput") as HTMLInputElement;
                  if (input.value.trim()) { sendChat(input.value.trim()); input.value = ""; }
                }} className="flex gap-1">
                  <input
                    name="chatInput"
                    placeholder="Type a message..."
                    className="flex-1 text-[10px] px-2 py-1.5 rounded bg-white/5 border border-white/8 text-white placeholder-gray-600 outline-none"
                  />
                  <button type="submit" className="px-2 py-1.5 rounded bg-cyan-500/20 text-cyan-400 text-[10px] font-bold hover:bg-cyan-500/30">
                    &gt;
                  </button>
                </form>
              </div>
            )}
          </div>

          {/* Player Analytics section */}
          <div className="border-b border-white/5">
            <div className="px-3 py-2 border-b border-white/5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Player Analytics</span>
            </div>
            <div className="px-3 py-2 space-y-1.5">
              {players.filter(p => p.id !== heroId).slice(0, 3).map((p, i) => {
                const stats = opponentStats.get(p.id);
                const vpip = stats && stats.handsPlayed > 0 ? Math.round((stats.vpipCount / stats.handsPlayed) * 100) : 0;
                return (
                  <div key={p.id} className="flex items-center gap-2 text-[10px]">
                    <div className="w-5 h-5 rounded-full overflow-hidden bg-gray-700 shrink-0">
                      {p.avatar ? <img src={p.avatar} alt="" className="w-full h-full object-cover" /> : (
                        <div className="w-full h-full flex items-center justify-center text-[8px] text-gray-400">{p.name[0]}</div>
                      )}
                    </div>
                    <span className="text-gray-300 truncate flex-1">{p.name}</span>
                    <span className="text-amber-400 font-mono font-bold">{vpip}%</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Tournament Stats section */}
          <div>
            <div className="px-3 py-2 border-b border-white/5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Tournament Stats</span>
            </div>
            <div className="px-3 py-2 space-y-1 text-[10px]">
              <div className="flex justify-between"><span className="text-gray-500">Chips</span><span className="text-white font-mono">{hero?.chips?.toLocaleString() || "—"}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Players</span><span className="text-white font-mono">{formatInfo?.playersRemaining || players.length}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Current Bet</span><span className="text-white font-mono">${gameState.minBet || 0}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Round</span><span className="text-cyan-400 font-mono uppercase">{gameState.phase}</span></div>
            </div>
          </div>
        </div>
      </div>

      {/* ═══ FLOATING OVERLAYS (keep existing) ═══ */}
      <EmotePicker heroId={heroId} isMultiplayer={isMultiplayer} />

      {formatInfo && (formatInfo.gameFormat === "sng" || formatInfo.gameFormat === "tournament") && (
        <BlindLevelIndicator
          currentLevel={formatInfo.currentBlindLevel}
          sb={gameState.minBet ? Math.floor(gameState.minBet / 2) : 10}
          bb={gameState.minBet || 20}
          ante={0}
          nextLevelIn={formatInfo.nextLevelIn}
        />
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

      <AnimatePresence>
        {gameState.insuranceOffer && acceptInsurance && declineInsurance && (
          <InsurancePanel
            offer={gameState.insuranceOffer}
            onAccept={acceptInsurance}
            onDecline={declineInsurance}
          />
        )}
      </AnimatePresence>

      {/* Run It Vote Panel */}
      <AnimatePresence>
        {gameState.runItPending && voteRunIt && (
          <RunItVotePanel onVote={voteRunIt} />
        )}
      </AnimatePresence>

      {/* Run It Multiple Boards Results */}
      <AnimatePresence>
        {gameState.runItBoards && gameState.runItBoards.length > 1 && (
          <RunItResults boards={gameState.runItBoards} heroId={heroId} />
        )}
      </AnimatePresence>

      <HandStrengthMeter
        holeCards={heroHoleCards}
        communityCards={gameState.communityCards}
        visible={gameState.phase !== "showdown" && !!heroCards}
      />

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
  const [selectedSeat, setSelectedSeat] = useState<number | undefined>(undefined);

  const {
    players, gameState, handlePlayerAction, showdown,
    connected, error: mpError, waiting, joinTable, leaveTable, addBots, sendChat,
    commitmentHash, shuffleProof, verificationStatus, playerSeedStatus,
    onChainCommitTx, onChainRevealTx,
    formatInfo, blindIncrease, elimination, tournamentComplete,
    dismissTournamentComplete, bombPotActive, notifications,
    buyTime, acceptInsurance, declineInsurance, voteRunIt,
  } = useMultiplayerGame(tableId, user?.id || "");

  // Fetch table info
  useEffect(() => {
    fetch(`/api/tables/${tableId}`)
      .then(r => r.json())
      .then(setTableInfo)
      .catch(() => {});
  }, [tableId]);

  const isSNG = tableInfo?.gameFormat === "sng" || tableInfo?.gameFormat === "tournament";

  // Reset joined state if server rejects the join
  useEffect(() => {
    if (mpError && joined) {
      setJoined(false);
    }
  }, [mpError, joined]);

  const handleJoin = () => {
    const amount = isSNG ? (tableInfo?.buyInAmount || buyIn) : buyIn;
    joinTable(amount, selectedSeat);
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
      <div className="min-h-screen bg-[#0a1022] text-white flex items-center justify-center relative overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(30,43,75,0.4)_0%,rgba(10,16,34,0.9)_70%)]" />
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
                {tableInfo.smallBlind}/{tableInfo.bigBlind} &middot; {tableInfo.maxPlayers} seats
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

          {/* Seat Selection */}
          {tableInfo && (
            <div className="mb-4">
              <label className="text-[10px] font-bold uppercase tracking-wider text-gray-500 block mb-2">
                Pick Your Seat (optional)
              </label>
              <div className="flex flex-wrap gap-2 justify-center">
                {Array.from({ length: tableInfo.maxPlayers || 6 }, (_, i) => {
                  const isOccupied = (tableInfo.occupiedSeats || []).includes(i);
                  const isSelected = selectedSeat === i;
                  return (
                    <motion.button
                      key={i}
                      whileHover={!isOccupied ? { scale: 1.1 } : {}}
                      whileTap={!isOccupied ? { scale: 0.95 } : {}}
                      onClick={() => {
                        if (isOccupied) return;
                        setSelectedSeat(isSelected ? undefined : i);
                      }}
                      disabled={isOccupied}
                      className={`w-10 h-10 rounded-full text-xs font-bold border-2 transition-all ${
                        isOccupied
                          ? "bg-red-500/10 border-red-500/20 text-red-400/40 cursor-not-allowed"
                          : isSelected
                            ? "bg-cyan-500/25 border-cyan-400 text-cyan-400 shadow-[0_0_10px_rgba(0,240,255,0.3)]"
                            : "bg-white/5 border-white/10 text-gray-400 hover:border-cyan-500/30 hover:text-white"
                      }`}
                    >
                      {i + 1}
                    </motion.button>
                  );
                })}
              </div>
              <p className="text-center text-[9px] text-gray-600 mt-1.5">
                {selectedSeat !== undefined ? `Seat ${selectedSeat + 1} selected` : "Auto-assign if none selected"}
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
      <GameUIProvider>
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
        startingChips={tableInfo?.startingChips}
        buyTime={buyTime}
        acceptInsurance={acceptInsurance}
        declineInsurance={declineInsurance}
        voteRunIt={voteRunIt}
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
      </GameUIProvider>
    </SoundProvider>
  );
}

// ─── Offline Game (Original) ──────────────────────────────────────────────────
function OfflineGameTable({ initialPlayers, engineConfig }: { initialPlayers: Player[]; engineConfig?: GameEngineConfig }) {
  const { players, gameState, handlePlayerAction, showdown } = useGameEngine(initialPlayers, HERO_ID, engineConfig);
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
  const [engineConfig, setEngineConfig] = useState<GameEngineConfig | undefined>(undefined);

  // Multiplayer mode
  if (tableId) {
    return <MultiplayerGame tableId={tableId} />;
  }

  // Offline mode
  const handleGameSetup = (avatar: AvatarOption, name: string, config: GameSetupConfig) => {
    soundEngine.init();
    const players = buildPlayersFromConfig(avatar, name, config);
    setInitialPlayers(players);
    setEngineConfig({
      smallBlind: config.smallBlind,
      bigBlind: config.bigBlind,
      ante: config.ante,
    });
    setGameStarted(true);
  };

  if (!gameStarted) {
    return (
      <GameSetup
        mode="offline"
        onStartOffline={handleGameSetup}
      />
    );
  }

  return (
    <SoundProvider>
      <GameUIProvider>
        <OfflineGameTable initialPlayers={initialPlayers} engineConfig={engineConfig} />
      </GameUIProvider>
    </SoundProvider>
  );
}
