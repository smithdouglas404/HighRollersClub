import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Seat } from "../components/poker/Seat";
import { Card } from "../components/poker/Card";
import { ImageTable } from "../components/poker/ImageTable";

import { PokerControls } from "../components/poker/Controls";
import { ProvablyFairPanel } from "../components/poker/ProvablyFairPanel";
import { AVATAR_OPTIONS, type AvatarOption } from "../components/poker/AvatarSelect";
import { GameSetup, type GameSetupConfig } from "../components/game/GameSetup";
import { ShowdownOverlay } from "../components/poker/ShowdownOverlay";
import { EmotePicker } from "../components/poker/EmoteSystem";
import { TauntPicker, setTauntVoice } from "../components/poker/TauntSystem";
import { ChatPanel } from "../components/poker/ChatPanel";
import { HandHistoryDrawer } from "../components/poker/HandHistoryDrawer";
import { VideoControlBar, VideoThumbnail } from "../components/poker/VideoOverlay";
import { HandStrengthMeter } from "../components/poker/HandStrengthMeter";
import { HandBadge } from "../components/poker/HandBadge";
import { ChipAnimation } from "../components/poker/ChipAnimation";
import { InsurancePanel } from "../components/poker/InsurancePanel";
import { RunItVotePanel, RunItResults } from "../components/poker/RunItMultiple";
import { CardSqueeze } from "../components/poker/CardSqueeze";
import { useIsMobile } from "@/hooks/use-mobile";
import { useScreenInfo } from "@/hooks/use-screen-info";
import { useDealingSequence } from "@/hooks/useDealingSequence";
import { useAnimatedCounter } from "@/hooks/useAnimatedCounter";
import { TournamentStatsPanel } from "@/components/game/TournamentStatsPanel";
import { PlayerAnalyticsPanel } from "@/components/game/PlayerAnalyticsPanel";
import { AIAnalysisPanel } from "@/components/game/AIAnalysisPanel";
import { Player } from "../lib/poker-types";
import { getHandStrength } from "../lib/hand-evaluator";
import { TABLE_SEATS } from "@/lib/table-constants";
import { useGameEngine, type GameEngineConfig } from "@/lib/game-engine";
import { useMultiplayerGame } from "@/lib/multiplayer-engine";
import { useAuth } from "@/lib/auth-context";
import { SoundProvider, useSoundEngine } from "@/lib/sound-context";
import { soundEngine } from "@/lib/sound-engine";
import { GameUIProvider, useGameUI, FELT_PRESETS, CARD_BACK_PRESETS } from "@/lib/game-ui-context";
import { useOpponentStats, type OpponentHudStats } from "@/lib/useOpponentStats";
import type { VerificationStatus, FormatInfo } from "@/lib/multiplayer-engine";
import { ShieldCheck, Volume2, VolumeX, Trophy, ArrowLeft, Bot, Wifi, WifiOff, Users, AlertTriangle, Minimize2, Maximize2, BarChart2, Music, Play, Pause, X, Plus, Wallet, Mic, MicOff, Eye, EyeOff, Link2, Palette, Settings2, LogOut, MoreVertical, DoorOpen } from "lucide-react";
import { InGameAdminPanel, type InGameSettings } from "@/components/game/InGameAdminPanel";
import { WalletBar } from "@/components/wallet/WalletBar";
import { BlindLevelIndicator } from "@/components/game/BlindLevelIndicator";
import { TournamentResults } from "@/components/game/TournamentResults";
import { BombPotIndicator } from "@/components/game/BombPotIndicator";
import { CommentarySubtitles, CommentaryControls } from "@/components/poker/CommentaryOverlay";
import { commentaryPlayer } from "@/lib/commentary-engine";
import { wsClient } from "@/lib/ws-client";

import casinoBg from "@assets/generated_images/cyberpunk_casino_bg_wide.webp";
import avatar1 from "@assets/generated_images/avatars/avatar_red_wolf.webp";
import avatar2 from "@assets/generated_images/avatars/avatar_steel_ghost.webp";
import avatar3 from "@assets/generated_images/avatars/avatar_dark_ace.webp";
import avatar4 from "@assets/generated_images/avatars/avatar_neon_fox.webp";
import avatar5 from "@assets/generated_images/avatars/avatar_cyber_punk.webp";

// Extended avatar pool for bot variety
const EXTRA_AVATAR_URLS = [
  "/attached_assets/generated_images/avatars/avatar_cyber_samurai.webp",
  "/attached_assets/generated_images/avatars/avatar_neon_medic.webp",
  "/attached_assets/generated_images/avatars/avatar_dj_chrome.webp",
  "/attached_assets/generated_images/avatars/avatar_ghost_sniper.webp",
  "/attached_assets/generated_images/avatars/avatar_oracle_seer.webp",
  "/attached_assets/generated_images/avatars/avatar_merchant_boss.webp",
  "/attached_assets/generated_images/avatars/avatar_street_racer.webp",
  "/attached_assets/generated_images/avatars/avatar_void_witch.webp",
  "/attached_assets/generated_images/avatars/avatar_mech_pilot.webp",
  "/attached_assets/generated_images/avatars/avatar_data_thief.webp",
  "/attached_assets/generated_images/avatars/avatar_punk_duchess.webp",
  "/attached_assets/generated_images/avatars/avatar_iron_bull.webp",
];

// Rank frame overlays
export const RANK_FRAMES: Record<string, string> = {
  bronze: "/attached_assets/generated_images/frames/frame_bronze.webp",
  silver: "/attached_assets/generated_images/frames/frame_silver.webp",
  gold: "/attached_assets/generated_images/frames/frame_gold.webp",
  platinum: "/attached_assets/generated_images/frames/frame_platinum.webp",
  diamond: "/attached_assets/generated_images/frames/frame_diamond.webp",
};

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
      isActive: false,
      isDealer: false,
      currentBet: 0,
      status: "sitting-out" as const,
      isSittingOut: true,
      awaitingReady: true,
      timeLeft: 100,
      avatar: heroAvatar.image || undefined,
    },
    ...bots,
  ];
}

// Speech-to-text hook using browser's SpeechRecognition API
function useSpeechToChat(sendChat?: (msg: string) => void, isMultiplayer?: boolean) {
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);

  const toggle = useCallback(() => {
    // Stop if currently listening
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
      setIsListening(false);
      return;
    }

    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR || !sendChat) return;

    const recognition = new SR();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onresult = async (event: any) => {
      const transcript = event.results?.[0]?.[0]?.transcript?.trim();
      if (!transcript) return;

      // Check if non-English (non-ASCII characters present)
      const isLikelyNonEnglish = /[^\x00-\x7F]/.test(transcript);

      if (isLikelyNonEnglish && isMultiplayer) {
        try {
          const resp = await fetch("/api/translate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text: transcript }),
            credentials: "include",
          });
          if (resp.ok) {
            const data = await resp.json();
            sendChat(data.translated !== data.original ? `${data.translated} (translated)` : transcript);
          } else {
            sendChat(transcript);
          }
        } catch {
          sendChat(transcript);
        }
      } else {
        sendChat(transcript);
      }
    };

    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => { setIsListening(false); recognitionRef.current = null; };

    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  }, [sendChat, isMultiplayer]);

  const supported = typeof window !== "undefined" && ("SpeechRecognition" in window || "webkitSpeechRecognition" in window);
  return { isListening, toggle, supported };
}

// Player style classification from VPIP + PFR thresholds
function classifyPlayerStyle(stats: OpponentHudStats): { label: string; color: string; tooltip: string } | null {
  if (stats.handsPlayed < 4) return null;
  const vpip = (stats.vpipCount / stats.handsPlayed) * 100;
  const pfr = (stats.pfrCount / stats.handsPlayed) * 100;
  const tight = vpip < 20, loose = vpip > 35;
  const aggro = pfr > 20, passive = pfr < 10;
  if (tight && aggro) return { label: "TAG", color: "#22c55e", tooltip: "Tight-Aggressive" };
  if (loose && aggro) return { label: "LAG", color: "#f97316", tooltip: "Loose-Aggressive" };
  if (tight && passive) return { label: "Rock", color: "#3b82f6", tooltip: "Tight-Passive" };
  if (loose && passive) return { label: "Fish", color: "#ef4444", tooltip: "Calling Station" };
  if (loose) return { label: "Loose", color: "#eab308", tooltip: "Plays many hands" };
  if (tight) return { label: "Tight", color: "#06b6d4", tooltip: "Selective hand range" };
  if (aggro) return { label: "Aggro", color: "#f97316", tooltip: "Aggressive bettor" };
  if (passive) return { label: "Passive", color: "#3b82f6", tooltip: "Prefers calling" };
  return { label: "Avg", color: "#9ca3af", tooltip: "Average play style" };
}

// Shared game table renderer
function GameTable({
  players, gameState, handlePlayerAction, showdown, heroId, tableName, tableId,
  onBack, isMultiplayer, connected, waiting, addBots, leaveTable,
  commitmentHash, shuffleProof, verificationStatus, sendChat,
  playerSeedStatus, onChainCommitTx, onChainRevealTx,
  formatInfo, bombPotActive, tournamentComplete, dismissTournamentComplete,
  blindIncrease, elimination, startingChips,
  addChips, maxBuyIn, minBuyIn, walletBalance,
  buyTime, acceptInsurance, declineInsurance, voteRunIt,
  sitOut, sitIn, postBlinds, waitForBB,
  rebuyHero, defaultBuyIn, inviteCode,
  isAdmin, currentSettings, onAdminSettingsApply,
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
  addChips?: (amount: number) => void;
  maxBuyIn?: number;
  minBuyIn?: number;
  walletBalance?: number;
  buyTime?: () => void;
  acceptInsurance?: () => void;
  declineInsurance?: () => void;
  voteRunIt?: (count: 1 | 2 | 3) => void;
  sitOut?: () => void;
  sitIn?: () => void;
  postBlinds?: () => void;
  waitForBB?: () => void;
  inviteCode?: string;
  // Practice mode rebuy
  rebuyHero?: (amount: number) => void;
  defaultBuyIn?: number;
  // Admin panel
  isAdmin?: boolean;
  currentSettings?: InGameSettings;
  onAdminSettingsApply?: (settings: InGameSettings) => void;
}) {
  const [showProvablyFair, setShowProvablyFair] = useState(false);
  const [showAddChips, setShowAddChips] = useState(false);
  const [addChipsAmount, setAddChipsAmount] = useState(maxBuyIn || 300);
  const [isMuted, setIsMuted] = useState(() => soundEngine.muted);
  const [showBgmPanel, setShowBgmPanel] = useState(false);
  const [bgmUrl, setBgmUrl] = useState(() => soundEngine.bgmUrl);
  const [bgmPlaying, setBgmPlaying] = useState(() => soundEngine.bgmPlaying);
  const [bgmVolume, setBgmVolume] = useState(() => soundEngine.bgmVolume);
  const [commentaryEnabled, setCommentaryEnabled] = useState(false);
  const [commentaryOmniscient, setCommentaryOmniscient] = useState(false);
  const sound = useSoundEngine();
  const winStreaks = useRef<Map<string, number>>(new Map());
  const isMobile = useIsMobile();
  const screen = useScreenInfo();
  const { compactMode, toggleCompactMode, feltPreset, setFeltColor, cardBack, setCardBack, cardBackPreset } = useGameUI();
  const [showThemePanel, setShowThemePanel] = useState(false);
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [showPlayerMenu, setShowPlayerMenu] = useState(false);
  const speedMultiplier = (gameState as any).speedMultiplier || 1.0;
  const dealing = useDealingSequence(players, gameState, heroId, compactMode, speedMultiplier);
  const { opponentStats, hudEnabled, setHudEnabled } = useOpponentStats(gameState, players, heroId);
  const tableRef = useRef<HTMLDivElement>(null);
  const prevHeroTurn = useRef(false);

  // Animated pot counter for the top bar (smooth count-up/down)
  const { value: topBarPot } = useAnimatedCounter(gameState.pot || 0, 400);
  // Animated hero chip counter for the top bar
  const hero = players.find((p) => p.id === heroId);
  const { value: animatedHeroChips } = useAnimatedCounter(hero?.chips || 0, 400);

  // Stop all audio when leaving the game
  const unmountedRef = useRef(false);
  useEffect(() => {
    return () => {
      unmountedRef.current = true;
      soundEngine.stopBgm();
      commentaryPlayer.stop();
    };
  }, []);

  // Session ledger tracking
  const startingChipsRef = useRef<number | null>(null);
  const biggestPotRef = useRef(0);
  if (startingChipsRef.current === null && hero && hero.chips > 0) {
    startingChipsRef.current = hero.chips;
  }
  // Track biggest pot won by hero
  useEffect(() => {
    if (showdown?.winnerIds?.includes(heroId) && showdown.pot > biggestPotRef.current) {
      biggestPotRef.current = showdown.pot;
    }
  }, [showdown, heroId]);

  // Speech-to-text for chat
  const speech = useSpeechToChat(sendChat, isMultiplayer);

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

  // Auto-play BGM while waiting, stop when hand starts
  const prevPhaseRef = useRef(gameState.phase);
  useEffect(() => {
    if (unmountedRef.current) return;
    const prev = prevPhaseRef.current;
    prevPhaseRef.current = gameState.phase;

    if (gameState.phase === "waiting") {
      // Resume BGM only during waiting phase (between hands)
      if (soundEngine.bgmUrl && !soundEngine.bgmPlaying) {
        soundEngine.playBgm();
        setBgmPlaying(true);
      }
    } else if (prev === "waiting") {
      // Hand started — stop BGM (also stays off during showdown so SFX are clean)
      if (soundEngine.bgmPlaying) {
        soundEngine.stopBgm();
        setBgmPlaying(false);
      }
    }
  }, [gameState.phase]);

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

  const isHeroTurn = gameState.currentTurnPlayerId === heroId;
  const heroCards = hero?.cards;

  const heroHoleCards = useMemo(() => {
    if (!heroCards) return undefined;
    return heroCards.map(c => ({ ...c, hidden: false })) as [typeof heroCards[0], typeof heroCards[1]];
  }, [heroCards]);

  // Spatial sound for opponent actions (chips, fold, check, call, raise)
  const prevActionNumberRef = useRef<number | undefined>(undefined);
  useEffect(() => {
    const la = gameState.lastAction;
    const actionNum = gameState.actionNumber;
    if (!la || actionNum === prevActionNumberRef.current) return;
    prevActionNumberRef.current = actionNum;
    if (la.playerId === heroId) return; // hero sounds handled by Controls

    const playerIdx = players.findIndex(p => p.id === la.playerId);
    if (playerIdx < 0) return;
    // Use visual seat (hero-rotated) for correct spatial audio positioning
    const heroSeatIdx = players.findIndex(p => p.id === heroId);
    const totalSeats = players.length;
    const visualSeat = (playerIdx - heroSeatIdx + totalSeats) % totalSeats;
    const seat = TABLE_SEATS[visualSeat] || TABLE_SEATS[visualSeat % TABLE_SEATS.length];
    const seatX = seat.x;
    const seatScale = seat.scale;

    switch (la.action) {
      case "fold": sound.playFoldAt(seatX, seatScale); break;
      case "check": sound.playCheckAt(seatX, seatScale); break;
      case "call":
        sound.playCallAt(seatX, seatScale);
        sound.playChipClinkAt(seatX, seatScale); // Chips going in
        break;
      case "raise":
        sound.playRaiseAt(seatX, seatScale);
        sound.playChipClinkAt(seatX, seatScale); // Chips going in
        break;
    }
  }, [gameState.lastAction, gameState.actionNumber, heroId, players, sound]);

  useEffect(() => {
    if (isHeroTurn && !prevHeroTurn.current) {
      sound.playTurnNotify();
    }
    prevHeroTurn.current = isHeroTurn;
  }, [isHeroTurn, sound]);

  // Sound: player elimination (dramatic)
  useEffect(() => {
    if (elimination) {
      sound.playPhaseReveal();
    }
  }, [elimination, sound]);

  // Sound: blind level increase
  useEffect(() => {
    if (blindIncrease) {
      sound.playTurnNotify();
    }
  }, [blindIncrease, sound]);

  // Sound: all-in detection — play dramatic sound when any player goes all-in
  const prevAllInPlayers = useRef<Set<string>>(new Set());
  useEffect(() => {
    const currentAllIn = new Set(players.filter(p => p.status === "all-in").map(p => p.id));
    // Check for new all-in players
    for (const id of currentAllIn) {
      if (!prevAllInPlayers.current.has(id)) {
        sound.playShowdownFanfare();
        break; // One sound per batch
      }
    }
    prevAllInPlayers.current = currentAllIn;
  }, [players, sound]);

  const handleMuteToggle = () => {
    const nowMuted = sound.toggleMute();
    setIsMuted(nowMuted);
  };

  return (
    <div className="h-screen bg-[#0e1a2e] text-white overflow-hidden relative font-sans flex flex-col">
      {/* Background layers */}
      <div className="absolute inset-0">
        <img src={casinoBg} alt="" className="absolute inset-0 w-full h-full object-cover opacity-60" style={{ filter: "brightness(0.75) saturate(1.8) blur(1px)" }} />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(40,55,90,0.2)_0%,rgba(12,20,40,0.55)_80%)]" />
      </div>

      <ChipAnimation containerRef={tableRef} />

      {showdown && (
        <ShowdownOverlay visible={!!showdown} results={showdown.results} players={players} pot={showdown.pot} />
      )}

      {/* ═══ TOP BAR ═══ */}
      <div
        className="relative z-50 h-11 flex items-center justify-between px-4 shrink-0"
        style={{
          background: "linear-gradient(180deg, rgba(8,14,28,0.92) 0%, rgba(6,10,22,0.88) 100%)",
          backdropFilter: "blur(16px)",
          borderBottom: "1px solid rgba(0,212,255,0.1)",
          boxShadow: "0 2px 12px rgba(0,0,0,0.3)",
        }}
      >
        <div className="flex items-center gap-3">
          {onBack && (
            <button onClick={leaveTable || onBack} className="p-1.5 hover:bg-white/10 rounded-lg transition-colors" title="Back to lobby">
              <ArrowLeft className="w-4 h-4 text-gray-400" />
            </button>
          )}
          <span className="font-display font-bold text-sm tracking-wider gold-text">
            HIGH ROLLERS
          </span>
          <div className="w-px h-5 bg-white/10" />
          <span className="text-xs font-bold text-gray-300 tracking-wider">{tableName || "HIGH ROLLERS MAIN"}</span>
          <span className="text-[0.625rem] text-gray-500 font-mono">
            {formatInfo?.smallBlind && formatInfo?.bigBlind
              ? <span className="text-emerald-400/80">${formatInfo.smallBlind}/${formatInfo.bigBlind} NLH</span>
              : <>{players.length}-MAX</>
            }
          </span>
          <div className="w-px h-5 bg-white/10" />
          <span className="text-sm font-bold text-cyan-400 font-mono tracking-wider" style={{ textShadow: "0 0 8px rgba(0,212,255,0.4)" }}>{phaseLabels[gameState.phase] || gameState.phase?.toUpperCase()}</span>
          <span className="text-[0.625rem] text-gray-500 font-mono">
            {(gameState as any).handNumber
              ? <>Hand #{(gameState as any).handNumber}</>
              : <>{tableId ? `#${tableId.slice(0, 6).toUpperCase()}` : ""}</>
            }
          </span>
        </div>

        <div className="flex items-center gap-3">
          <div
            className="flex items-center gap-2 px-4 py-1.5 rounded-xl border border-amber-500/30"
            style={{
              background: "linear-gradient(135deg, rgba(20,15,5,0.7) 0%, rgba(10,8,3,0.8) 100%)",
              boxShadow: "0 0 16px rgba(255,215,0,0.12), inset 0 1px 0 rgba(255,255,255,0.05)",
            }}
          >
            <span className="text-[0.625rem] font-bold text-amber-500/60 uppercase tracking-wider">POT</span>
            <span className="text-lg font-black font-mono" style={{ color: "#ffd700", textShadow: "0 0 12px rgba(255,215,0,0.5)" }}>${topBarPot.toLocaleString()}</span>
          </div>

          {showdown?.results?.some((r: any) => r.isWinner && r.playerId === heroId) && (
            <span className="text-[0.625rem] font-bold text-emerald-400">
              WINNER: YOU ({showdown.results.find((r: any) => r.isWinner && r.playerId === heroId)?.handName || ""})
            </span>
          )}

          {isMultiplayer && (
            <div className={`flex items-center gap-1 px-2 py-0.5 rounded text-[0.625rem] font-bold ${
              connected ? "text-green-400 bg-green-500/10" : "text-red-400 bg-red-500/10"
            }`}>
              {connected ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
              {connected ? "LIVE" : "OFF"}
            </div>
          )}

          {isMultiplayer && inviteCode && (
            <button
              onClick={() => {
                const url = `${window.location.origin}/invite/${inviteCode}`;
                navigator.clipboard.writeText(url).catch(() => {});
                const el = document.getElementById("invite-copied");
                if (el) { el.textContent = "Copied!"; setTimeout(() => { el.textContent = "INVITE"; }, 1500); }
              }}
              className="flex items-center gap-1 px-2 py-1 rounded text-[0.625rem] font-bold text-purple-400 bg-purple-500/10 border border-purple-500/20 hover:bg-purple-500/20 transition-colors"
              title="Copy invite link to clipboard"
            >
              <Link2 className="w-3 h-3" /> <span id="invite-copied">INVITE</span>
            </button>
          )}

          {waiting && addBots && (
            <button onClick={addBots} className="flex items-center gap-1 px-2 py-1 rounded text-[0.625rem] font-bold text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 hover:bg-cyan-500/20">
              <Bot className="w-3 h-3" /> BOTS
            </button>
          )}

          {/* Add Chips button — only for cash games when between hands */}
          {isMultiplayer && addChips && maxBuyIn && hero && ((gameState.phase === "pre-flop" && waiting) || gameState.phase === "showdown" || gameState.phase === "waiting") && (
            <button
              onClick={() => { setAddChipsAmount(Math.min(maxBuyIn, walletBalance || maxBuyIn)); setShowAddChips(true); }}
              className="flex items-center gap-1 px-2 py-1 rounded text-[0.625rem] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 hover:bg-emerald-500/20 transition-colors"
              title="Add chips from wallet"
            >
              <Plus className="w-3 h-3" /> ADD CHIPS
            </button>
          )}

          {/* Player Menu — Commentary, Sit Out / Away, Leave Table */}
          {(!hero?.awaitingReady) && (
            <div className="relative">
              <button
                onClick={() => setShowPlayerMenu(!showPlayerMenu)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-[0.625rem] font-bold transition-colors ${
                  hero && (hero.isSittingOut || hero.status === "sitting-out")
                    ? "text-orange-400 bg-orange-500/15 border border-orange-500/30"
                    : "text-gray-300 bg-white/5 border border-white/10 hover:bg-white/10"
                }`}
                title="Player options"
              >
                <MoreVertical className="w-3.5 h-3.5" />
                {hero && (hero.isSittingOut || hero.status === "sitting-out") ? "AWAY" : "MENU"}
              </button>
              {showPlayerMenu && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowPlayerMenu(false)} />
                  <div
                    className="absolute right-0 top-full mt-1.5 z-50 w-52 rounded-lg overflow-hidden"
                    style={{
                      background: "rgba(15,23,35,0.95)",
                      border: "1px solid rgba(255,255,255,0.12)",
                      backdropFilter: "blur(16px)",
                      boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
                    }}
                  >
                    {/* AI Commentary Toggle — multiplayer only */}
                    {isMultiplayer && (
                      <button
                        onClick={() => {
                          const next = !commentaryEnabled;
                          setCommentaryEnabled(next);
                          commentaryPlayer.enabled = next;
                          wsClient.send({ type: "commentary_toggle", enabled: next } as any);
                        }}
                        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-white/8 transition-colors border-b border-white/5"
                      >
                        {commentaryEnabled
                          ? <Mic className="w-4 h-4 text-purple-400" />
                          : <MicOff className="w-4 h-4 text-gray-500" />
                        }
                        <div className="flex-1">
                          <div className={`text-xs font-bold ${commentaryEnabled ? "text-purple-400" : "text-gray-300"}`}>AI Commentary</div>
                          <div className="text-[0.6rem] text-gray-500">Live play-by-play broadcast</div>
                        </div>
                        <div className={`w-7 h-4 rounded-full relative transition-colors ${commentaryEnabled ? "bg-purple-500" : "bg-gray-600"}`}>
                          <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-transform ${commentaryEnabled ? "left-[14px]" : "left-0.5"}`} />
                        </div>
                      </button>
                    )}

                    {/* Show Hole Cards (omniscient) — only when commentary enabled in multiplayer */}
                    {isMultiplayer && commentaryEnabled && (
                      <button
                        onClick={() => {
                          const next = !commentaryOmniscient;
                          setCommentaryOmniscient(next);
                          wsClient.send({ type: "commentary_omniscient", enabled: next } as any);
                        }}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-white/8 transition-colors border-b border-white/5"
                      >
                        {commentaryOmniscient
                          ? <Eye className="w-4 h-4 text-amber-400" />
                          : <EyeOff className="w-4 h-4 text-gray-500" />
                        }
                        <div className="flex-1">
                          <div className={`text-xs font-bold ${commentaryOmniscient ? "text-amber-400" : "text-gray-300"}`}>Show Hole Cards</div>
                          <div className="text-[0.6rem] text-gray-500">Commentators see all cards</div>
                        </div>
                        <div className={`w-7 h-4 rounded-full relative transition-colors ${commentaryOmniscient ? "bg-amber-500" : "bg-gray-600"}`}>
                          <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-transform ${commentaryOmniscient ? "left-[14px]" : "left-0.5"}`} />
                        </div>
                      </button>
                    )}

                    {sitOut && sitIn && hero && (
                      hero.isSittingOut || hero.status === "sitting-out" ? (
                        <button
                          onClick={() => { sitIn(); setShowPlayerMenu(false); }}
                          className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-white/8 transition-colors border-b border-white/5"
                        >
                          <Play className="w-4 h-4 text-green-400" />
                          <div>
                            <div className="text-xs font-bold text-green-400">Sit Back In</div>
                            <div className="text-[0.6rem] text-gray-500">Rejoin the next hand</div>
                          </div>
                        </button>
                      ) : (
                        <button
                          onClick={() => { sitOut(); setShowPlayerMenu(false); }}
                          className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-white/8 transition-colors border-b border-white/5"
                        >
                          <Pause className="w-4 h-4 text-orange-400" />
                          <div>
                            <div className="text-xs font-bold text-orange-400">Sit Out / Away</div>
                            <div className="text-[0.6rem] text-gray-500">Skip hands until you return</div>
                          </div>
                        </button>
                      )
                    )}

                    {leaveTable ? (
                      <button
                        onClick={() => { setShowPlayerMenu(false); leaveTable(); }}
                        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-red-500/10 transition-colors"
                      >
                        <DoorOpen className="w-4 h-4 text-red-400" />
                        <div>
                          <div className="text-xs font-bold text-red-400">Leave Table</div>
                          <div className="text-[0.6rem] text-gray-500">Cash out and leave your seat</div>
                        </div>
                      </button>
                    ) : onBack && (
                      <button
                        onClick={() => { setShowPlayerMenu(false); onBack(); }}
                        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-red-500/10 transition-colors"
                      >
                        <DoorOpen className="w-4 h-4 text-red-400" />
                        <div>
                          <div className="text-xs font-bold text-red-400">Leave Table</div>
                          <div className="text-[0.6rem] text-gray-500">Return to lobby</div>
                        </div>
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Video Chat — inline in top bar for easy access */}
          {isMultiplayer && tableId && (
            <>
              <div className="w-px h-5 bg-white/10" />
              <VideoControlBar heroId={heroId} tableId={tableId} playerIds={players.map(p => p.id)} isAdmin={isAdmin} />
              <div className="w-px h-5 bg-white/10" />
            </>
          )}

          <button onClick={handleMuteToggle} className="p-1.5 hover:bg-white/5 rounded transition-colors" title={isMuted ? "Unmute" : "Mute"}>
            {isMuted ? <VolumeX className="w-3.5 h-3.5 text-red-400" /> : <Volume2 className="w-3.5 h-3.5 text-gray-500" />}
          </button>

          {/* AI Commentary controls — multiplayer only */}
          {isMultiplayer && (
            <CommentaryControls
              enabled={commentaryEnabled}
              omniscientMode={commentaryOmniscient}
              onToggle={(enabled) => {
                setCommentaryEnabled(enabled);
                commentaryPlayer.enabled = enabled;
                wsClient.send({ type: "commentary_toggle", enabled } as any);
              }}
              onOmniscientToggle={(enabled) => {
                setCommentaryOmniscient(enabled);
                wsClient.send({ type: "commentary_omniscient", enabled } as any);
              }}
            />
          )}

          {/* BGM controls */}
          <div className="relative">
            <button
              onClick={() => setShowBgmPanel(!showBgmPanel)}
              className={`p-1.5 rounded transition-colors ${bgmPlaying ? "bg-green-500/15" : "hover:bg-white/5"}`}
              title="Background Music"
            >
              <Music className={`w-3.5 h-3.5 ${bgmPlaying ? "text-green-400" : "text-gray-500"}`} />
            </button>
            {showBgmPanel && (
              <div className="absolute right-0 top-full mt-1 z-50 w-80 rounded-lg p-3 space-y-2.5" style={{ background: "rgba(20,31,40,0.92)", border: "1px solid rgba(0,212,255,0.15)", backdropFilter: "blur(12px)", boxShadow: "0 8px 32px rgba(0,0,0,0.6)" }}>
                <div className="flex items-center justify-between">
                  <span className="text-[0.625rem] font-bold uppercase tracking-wider text-cyan-400">Music Library</span>
                  <button onClick={() => setShowBgmPanel(false)} className="p-0.5 hover:bg-white/10 rounded"><X className="w-3 h-3 text-gray-500" /></button>
                </div>

                {/* Track library */}
                <div className="space-y-1">
                  {[
                    { name: "Fever", artist: "KLICKAUD", url: "/music/Fever_KLICKAUD.mp3" },
                    { name: "Rather Be", artist: "KLICKAUD", url: "/music/Rather_Be_KLICKAUD.mp3" },
                    { name: "There It Is", artist: "Uploaded", url: "/music/02 There It Is.m4a" },
                    { name: "Soar", artist: "KLICKAUD", url: "/music/soar.mp3" },
                  ].map((track) => {
                    const isActive = bgmUrl === track.url || bgmUrl === track.name;
                    return (
                      <button
                        key={track.url}
                        onClick={() => {
                          setBgmUrl(track.url);
                          sound.setBgmUrl(track.url);
                          if (isActive && bgmPlaying) { sound.stopBgm(); setBgmPlaying(false); }
                          else { sound.playBgm(); setBgmPlaying(true); }
                        }}
                        className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left transition-all ${
                          isActive && bgmPlaying ? "bg-cyan-500/15 border border-cyan-500/25" : "bg-white/5 border border-transparent hover:bg-white/8"
                        }`}
                      >
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
                          isActive && bgmPlaying ? "bg-cyan-500/25" : "bg-white/10"
                        }`}>
                          {isActive && bgmPlaying
                            ? <Pause className="w-3 h-3 text-cyan-400" />
                            : <Play className="w-3 h-3 text-gray-400 ml-0.5" />
                          }
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className={`text-[0.6875rem] font-bold truncate ${isActive && bgmPlaying ? "text-cyan-400" : "text-white"}`}>{track.name}</div>
                          <div className="text-[0.5625rem] text-gray-500 truncate">{track.artist}</div>
                        </div>
                        {isActive && bgmPlaying && (
                          <div className="flex items-end gap-[2px] h-3">
                            {[0.6, 1, 0.4, 0.8, 0.5].map((h, i) => (
                              <div key={i} className="w-[2px] bg-cyan-400 rounded-full animate-pulse" style={{ height: `${h * 12}px`, animationDelay: `${i * 0.15}s` }} />
                            ))}
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Custom URL */}
                <div className="flex gap-1.5">
                  <input
                    type="text" value={bgmUrl.startsWith("/music/") ? "" : bgmUrl}
                    onChange={(e) => setBgmUrl(e.target.value)}
                    onBlur={() => { if (bgmUrl && !bgmUrl.startsWith("/music/")) sound.setBgmUrl(bgmUrl); }}
                    onKeyDown={(e) => { if (e.key === 'Enter' && bgmUrl) { sound.setBgmUrl(bgmUrl); sound.playBgm(); setBgmPlaying(true); } }}
                    placeholder="Paste audio URL..."
                    className="flex-1 text-[0.625rem] px-2 py-1.5 rounded text-white placeholder-gray-600 outline-none bg-white/5 border border-white/10"
                  />
                  <button
                    onClick={() => { if (bgmUrl) { sound.setBgmUrl(bgmUrl); if (bgmPlaying) { sound.stopBgm(); setBgmPlaying(false); } else { sound.playBgm(); setBgmPlaying(true); } } }}
                    className={`px-2 py-1.5 rounded text-[0.625rem] font-bold ${bgmPlaying ? "bg-red-500/20 text-red-400" : "bg-cyan-500/20 text-cyan-400"}`}
                  >
                    {bgmPlaying ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                  </button>
                </div>

                {/* Upload */}
                <label className="flex items-center gap-2 px-2.5 py-2 rounded-lg bg-white/5 border border-dashed border-white/10 cursor-pointer hover:bg-white/8 transition-colors">
                  <Music className="w-3 h-3 text-gray-500" />
                  <span className="text-[0.625rem] text-gray-400">Upload from your device...</span>
                  <input type="file" accept="audio/*" className="hidden" onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const localUrl = URL.createObjectURL(file);
                    setBgmUrl(file.name);
                    sound.setBgmUrl(localUrl);
                    sound.playBgm();
                    setBgmPlaying(true);
                  }} />
                </label>

                {/* Volume */}
                <div className="flex items-center gap-2">
                  <span className="text-[0.5625rem] text-gray-500">Vol</span>
                  <input type="range" min={0} max={100} value={Math.round(bgmVolume * 100)}
                    onChange={(e) => { const v = parseInt(e.target.value) / 100; setBgmVolume(v); sound.setBgmVolume(v); }}
                    className="flex-1 h-1 accent-amber-400"
                  />
                  <span className="text-[0.5625rem] text-gray-500 w-6 text-right">{Math.round(bgmVolume * 100)}%</span>
                </div>
              </div>
            )}
          </div>

          {/* Theme picker */}
          <div className="relative">
            <button
              onClick={() => setShowThemePanel(!showThemePanel)}
              className={`p-1.5 rounded transition-colors ${showThemePanel ? "bg-purple-500/15" : "hover:bg-white/5"}`}
              title="Table Theme"
            >
              <Palette className={`w-3.5 h-3.5 ${showThemePanel ? "text-purple-400" : "text-gray-500"}`} />
            </button>
            {showThemePanel && (
              <div className="absolute right-0 top-full mt-1 z-50 w-64 rounded-lg p-3 space-y-3" style={{ background: "rgba(20,31,40,0.92)", border: "1px solid rgba(168,85,247,0.15)", backdropFilter: "blur(12px)", boxShadow: "0 8px 32px rgba(0,0,0,0.6)" }}>
                <div className="flex items-center justify-between">
                  <span className="text-[0.625rem] font-bold uppercase tracking-wider text-purple-400">Table Theme</span>
                  <button onClick={() => setShowThemePanel(false)} className="p-0.5 hover:bg-white/10 rounded"><X className="w-3 h-3 text-gray-500" /></button>
                </div>
                {/* Felt picker */}
                <div>
                  <span className="text-[0.5625rem] text-gray-500 uppercase tracking-wider">Felt Color</span>
                  <div className="grid grid-cols-5 gap-1.5 mt-1.5">
                    {FELT_PRESETS.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => setFeltColor(p.id)}
                        className={`w-8 h-8 rounded-lg border-2 transition-all ${
                          feltPreset.id === p.id ? "border-purple-400 scale-110" : "border-white/10 hover:border-white/30"
                        }`}
                        style={{ background: p.imageUrl ? `url(${p.imageUrl}) center/cover` : p.swatch }}
                        title={p.label}
                      />
                    ))}
                  </div>
                </div>
                {/* Card back picker */}
                <div>
                  <span className="text-[0.5625rem] text-gray-500 uppercase tracking-wider">Card Back</span>
                  <div className="grid grid-cols-5 gap-1.5 mt-1.5">
                    {CARD_BACK_PRESETS.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => setCardBack(p.id)}
                        className={`w-8 h-11 rounded border-2 transition-all overflow-hidden ${
                          cardBackPreset.id === p.id ? "border-purple-400 scale-110" : "border-white/10 hover:border-white/30"
                        }`}
                        title={p.label}
                      >
                        {p.imageUrl ? (
                          <img src={p.imageUrl} alt={p.label} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full" style={{ background: "linear-gradient(145deg, #1a0e3e, #0d0820)" }} />
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          <button
            onClick={() => setShowAdminPanel(!showAdminPanel)}
            className={`p-1.5 rounded transition-colors ${showAdminPanel ? "bg-amber-500/15" : "hover:bg-white/5"}`}
            title={isAdmin ? "Admin Settings" : "Preferences"}
            data-testid="button-admin-settings"
          >
            <Settings2 className={`w-3.5 h-3.5 ${showAdminPanel ? "text-amber-400" : "text-gray-500"}`} />
          </button>

          <button onClick={() => setShowProvablyFair(!showProvablyFair)} className="p-1.5 hover:bg-white/5 rounded transition-colors">
            <ShieldCheck className={`w-3.5 h-3.5 ${verificationStatus === "verified" ? "text-green-400" : "text-gray-500"}`} />
          </button>

          {/* Next hand starts automatically after showdown — show countdown instead of decorative button */}
        </div>
      </div>

      {/* ═══ 3-COLUMN BODY ═══ */}
      <div className="flex-1 relative z-10 flex overflow-hidden">

        {/* ── LEFT SIDEBAR: Live Leaderboard ── */}
        {screen.showSidebars && (
        <div className="sidebar-responsive shrink-0 bg-black/40 backdrop-blur-sm border-r border-white/5 flex flex-col overflow-hidden">
          <div className="px-3 py-2 border-b border-white/5 flex items-center justify-between">
            <span className="text-[0.625rem] font-bold uppercase tracking-wider text-gray-400">
              Leaderboard
            </span>
            <span className="text-[0.5625rem] text-gray-600 font-mono">
              Hand #{(gameState as any).handNumber || "—"}
            </span>
          </div>
          <div className="flex-1 overflow-y-auto scrollbar-thin">
            {(() => {
              // Sort players by chip stack descending
              const sorted = [...players].sort((a, b) => b.chips - a.chips);
              const maxStack = sorted[0]?.chips || 1;
              return sorted.map((p, rank) => {
                const isMe = p.id === heroId;
                const buyIn = isMe ? (startingChipsRef.current || p.chips) : p.chips; // Only hero has accurate P/L
                const pnl = isMe ? p.chips - (startingChipsRef.current || 0) : 0;
                const barWidth = Math.max(4, (p.chips / maxStack) * 100);
                const isFolded = p.status === "folded";
                return (
                  <div
                    key={p.id}
                    className={`px-3 py-1.5 border-b border-white/[0.04] transition-colors ${isMe ? "bg-cyan-500/[0.07]" : "hover:bg-white/[0.02]"}`}
                  >
                    <div className="flex items-center gap-2">
                      {/* Rank badge */}
                      <span className={`w-5 text-center font-black text-[0.6875rem] ${
                        rank === 0 ? "text-amber-400" : rank === 1 ? "text-gray-300" : rank === 2 ? "text-amber-600" : "text-gray-600"
                      }`}>
                        {rank + 1}
                      </span>
                      {/* Avatar mini */}
                      {p.avatar ? (
                        <img src={p.avatar} className="w-6 h-6 rounded-md object-cover border border-white/10" alt="" />
                      ) : (
                        <div className="w-6 h-6 rounded-md bg-gray-700 border border-white/10 flex items-center justify-center text-[0.5rem] font-bold text-white/50">
                          {p.name.charAt(0).toUpperCase()}
                        </div>
                      )}
                      {/* Name + status */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1">
                          <span className={`text-[0.6875rem] font-bold truncate ${
                            isMe ? "text-cyan-300" : isFolded ? "text-gray-600" : "text-gray-200"
                          }`}>
                            {isMe ? "You" : p.name}
                          </span>
                          {p.isDealer && (
                            <span className="text-[0.5rem] font-black px-1 rounded gold-gradient text-black">D</span>
                          )}
                          {isFolded && (
                            <span className="text-[0.5rem] text-red-500/60 font-bold">FOLD</span>
                          )}
                        </div>
                      </div>
                      {/* Stack */}
                      <div className="text-right shrink-0">
                        <div className="text-[0.75rem] font-mono font-black" style={{ color: "#ffd700" }}>
                          ${p.chips.toLocaleString()}
                        </div>
                        {isMe && (
                          <div className={`text-[0.5625rem] font-mono font-bold ${pnl > 0 ? "text-emerald-400" : pnl < 0 ? "text-red-400" : "text-gray-600"}`}>
                            {pnl > 0 ? "+" : ""}{pnl !== 0 ? `$${pnl.toLocaleString()}` : "EVEN"}
                          </div>
                        )}
                      </div>
                    </div>
                    {/* Stack bar */}
                    <div className="mt-1 h-[3px] rounded-full bg-white/[0.04] overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${barWidth}%`,
                          background: rank === 0
                            ? "linear-gradient(90deg, #ffd700, #f59e0b)"
                            : isMe
                            ? "linear-gradient(90deg, #00d4ff, #0891b2)"
                            : "linear-gradient(90deg, rgba(255,255,255,0.15), rgba(255,255,255,0.08))",
                        }}
                      />
                    </div>
                  </div>
                );
              });
            })()}
          </div>

        </div>
        )}

        {/* ── CENTER: Table + Hero Cards + Controls ── */}
        <div className="flex-1 flex flex-col overflow-hidden relative">
          {/* Table area */}
          <div className="flex-1 relative overflow-hidden">
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse at 50% 45%, #1a2744 0%, #131d30 40%, #0e1624 70%, #0a101c 100%)" }} />

              <div
                ref={tableRef}
                className="relative w-full poker-table-container"
                style={{ aspectRatio: "16 / 9", maxHeight: screen.tableMaxHeight, maxWidth: screen.isUltrawide ? "min(90%, 180vh)" : "min(95%, 140vh)" }}
              >
                <ImageTable
                  communityCards={gameState.communityCards}
                  pot={gameState.pot}
                  playerCount={players.length}
                  maxSeats={10}
                  players={players}
                  dealerSeatIndex={players.findIndex(p => p.isDealer)}
                  visibleCommunityCards={dealing.visibleCommunityCards}
                  communityFlipped={dealing.communityFlipped}
                  showBurnCard={dealing.showBurnCard}
                  dealPhase={gameState.phase}
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

                {(() => {
                  // Rotate seating so hero always appears at seat 0 (bottom center / first-person view)
                  const heroIdx = players.findIndex(p => p.id === heroId);
                  const totalSeats = players.length;
                  return players.map((player, index) => {
                    // Rotate: hero goes to visual seat 0, everyone else shifts accordingly
                    const visualSeat = (index - heroIdx + totalSeats) % totalSeats;
                    const seat = TABLE_SEATS[visualSeat] || TABLE_SEATS[visualSeat % TABLE_SEATS.length];
                    const avatarOpt = player.avatar ? AVATAR_OPTIONS.find(a => a.image === player.avatar) : undefined;
                    return (
                      <Seat
                        key={player.id}
                        player={player}
                        position={{ x: seat.x, y: seat.y }}
                        isHero={player.id === heroId}
                        isWinner={showdown?.results?.some((r: any) => r.playerId === player.id && r.isWinner)}
                        seatIndex={visualSeat}
                        perspectiveScale={seat.scale}
                        hudStats={player.id !== heroId && hudEnabled ? opponentStats.get(player.id) : undefined}
                        avatarTier={avatarOpt?.tier}
                        winStreak={winStreaks.current.get(player.id) || 0}
                        showVideo={isMultiplayer && !player.isBot}
                        dealCardCount={dealing.visiblePlayerCards.get(player.id)}
                        turnDeadline={gameState.turnDeadline}
                        turnTimerDuration={gameState.turnTimerDuration}
                      />
                    );
                  });
                })()}
              </div>
            </div>
          </div>

          {/* "I'M READY" banner — shown when player just joined and hasn't started yet */}
          {hero && hero.awaitingReady && sitIn && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="relative z-30 flex items-center justify-center gap-3 py-3 px-6 bg-green-500/15 border border-green-500/30 rounded-lg mx-4 mb-2"
            >
              <span className="text-sm font-bold text-green-300 uppercase tracking-wider">Click to start playing</span>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={sitIn}
                className="px-5 py-2 rounded-lg text-sm font-bold text-black uppercase tracking-wider transition-colors"
                style={{ background: "linear-gradient(to bottom, #22c55e, #16a34a)", boxShadow: "0 0 15px rgba(34,197,94,0.3)" }}
              >
                I'M READY
              </motion.button>
            </motion.div>
          )}

          {/* Waiting for BB banner — player chose to wait for big blind */}
          {hero && hero.waitingForBB && !hero.awaitingReady && postBlinds && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="relative z-30 flex items-center justify-center gap-3 py-2 px-4 bg-blue-500/15 border border-blue-500/25 rounded-lg mx-4 mb-2"
            >
              <span className="text-sm font-bold text-blue-300 uppercase tracking-wider">Waiting for Big Blind</span>
              <button
                onClick={postBlinds}
                className="px-3 py-1 rounded text-xs font-bold text-white bg-green-600 hover:bg-green-500 transition-colors"
              >
                Post Blinds Now
              </button>
            </motion.div>
          )}

          {/* Missed blinds choice — shown when returning with missed blinds */}
          {hero && hero.missedBlinds && !hero.waitingForBB && !hero.isSittingOut && !hero.awaitingReady && postBlinds && waitForBB && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="relative z-30 flex items-center justify-center gap-3 py-2 px-4 bg-yellow-500/15 border border-yellow-500/25 rounded-lg mx-4 mb-2"
            >
              <span className="text-sm font-bold text-yellow-300 uppercase tracking-wider">You missed blinds</span>
              <button
                onClick={postBlinds}
                className="px-3 py-1 rounded text-xs font-bold text-white bg-green-600 hover:bg-green-500 transition-colors"
              >
                Post Now
              </button>
              <button
                onClick={waitForBB}
                className="px-3 py-1 rounded text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 transition-colors"
              >
                Wait for BB
              </button>
            </motion.div>
          )}

          {/* Sitting out banner — voluntary sit-out (not awaiting ready) */}
          {hero && (hero.isSittingOut || hero.status === "sitting-out") && !hero.awaitingReady && !hero.waitingForBB && sitIn && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="relative z-30 flex items-center justify-center gap-3 py-2 px-4 bg-orange-500/15 border border-orange-500/25 rounded-lg mx-4 mb-2"
            >
              <span className="text-sm font-bold text-orange-400 uppercase tracking-wider">You are sitting out</span>
              <button
                onClick={sitIn}
                className="px-3 py-1 rounded text-xs font-bold text-white bg-green-600 hover:bg-green-500 transition-colors"
              >
                Rejoin Game
              </button>
            </motion.div>
          )}

          {/* ═══ UNIFIED BOTTOM PANEL: Hero Cards + Controls ═══ */}
          <div className="relative z-30 shrink-0">
            <div className={`transition-all duration-300 ${gameState.phase === "showdown" || gameState.phase === "collecting-seeds" || !dealing.controlsReady ? "opacity-40 grayscale pointer-events-none" : "opacity-100"}`}>
              <PokerControls
                onAction={handlePlayerAction}
                minBet={Math.max(gameState.minRaise || 0, gameState.minBet || 0, 1)}
                maxBet={(hero?.chips || 0) + (hero?.currentBet || 0)}
                callCost={Math.max(0, (gameState.minBet || 0) - (hero?.currentBet || 0))}
                pot={gameState.pot}
                phase={gameState.phase}
                currentTurnSeat={players.findIndex(p => p.id === gameState.currentTurnPlayerId)}
                isHeroTurn={isHeroTurn}
                onBuyTime={buyTime}
                bigBlind={formatInfo?.bigBlind || gameState.minBet || undefined}
                heroTimeLeft={hero?.timeLeft}
                heroStatus={hero?.status}
                heroCardsSlot={
                  heroCards && gameState.phase !== "waiting" && (dealing.visiblePlayerCards.get(heroId) ?? 2) > 0 ? (
                    <motion.div
                      initial={{ y: 15, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      transition={{ delay: 0.3, type: "spring", stiffness: 200, damping: 22 }}
                      className="flex gap-2.5"
                      style={{ filter: "drop-shadow(0 6px 16px rgba(0,0,0,0.6))" }}
                    >
                      {isMobile && heroHoleCards ? (
                        <CardSqueeze cards={heroHoleCards} />
                      ) : (
                        heroCards.filter((_, i) => i < (dealing.visiblePlayerCards.get(heroId) ?? 2)).map((card, i) => (
                          <Card
                            key={`hero-${i}`}
                            card={{ ...card, hidden: false }}
                            size={compactMode ? "lg" : screen.cardSize}
                            isHero={true}
                            delay={compactMode ? 0 : 0.3 + i * 0.15}
                          />
                        ))
                      )}
                    </motion.div>
                  ) : undefined
                }
                handBadgeSlot={
                  heroCards && gameState.phase !== "waiting" ? (
                    <HandBadge
                      holeCards={heroHoleCards}
                      communityCards={gameState.communityCards}
                      phase={gameState.phase}
                    />
                  ) : undefined
                }
              />
            </div>
          </div>
        </div>

        {/* ── RIGHT SIDEBAR: Chat + Analytics + Stats ── */}
        {screen.showSidebars && (
        <div className="sidebar-responsive shrink-0 bg-black/40 backdrop-blur-sm border-l border-white/5 flex flex-col overflow-hidden">
          {/* Chat section */}
          <div className="flex-1 flex flex-col border-b border-white/5 min-h-0">
            <div className="px-3 py-2 border-b border-white/5">
              <span className="text-[0.625rem] font-bold uppercase tracking-wider text-gray-400">Chat</span>
            </div>
            <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1 text-[0.625rem] scrollbar-thin">
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
                    placeholder="Type or speak..."
                    className="flex-1 text-[0.625rem] px-2 py-1.5 rounded bg-white/5 border border-white/10 text-white placeholder-gray-600 outline-none"
                  />
                  {speech.supported && (
                    <button
                      type="button"
                      onClick={speech.toggle}
                      className={`px-2 py-1.5 rounded text-[0.625rem] font-bold transition-colors ${
                        speech.isListening
                          ? "bg-red-500/20 text-red-400 border border-red-500/30 animate-pulse"
                          : "bg-white/5 text-gray-400 hover:bg-white/10 border border-white/10"
                      }`}
                      title={speech.isListening ? "Stop recording" : "Voice message"}
                    >
                      <Mic className="w-3 h-3" />
                    </button>
                  )}
                  <button type="submit" className="px-2 py-1.5 rounded bg-cyan-500/20 text-cyan-400 text-[0.625rem] font-bold hover:bg-cyan-500/30">
                    &gt;
                  </button>
                </form>
              </div>
            )}
          </div>

          {/* Player Analytics section — V/P/A + style badge */}
          <div className="border-b border-white/5">
            <div className="px-3 py-2 border-b border-white/5">
              <span className="text-[0.625rem] font-bold uppercase tracking-wider text-gray-400">Player Analytics</span>
            </div>
            <div className="px-3 py-2 space-y-2.5">
              {players.filter(p => p.id !== heroId && p.isActive).slice(0, 4).map((p) => {
                const stats = opponentStats.get(p.id);
                const hands = stats?.handsPlayed || 0;
                const vpip = hands > 0 ? Math.round((stats!.vpipCount / hands) * 100) : 0;
                const pfr = hands > 0 ? Math.round((stats!.pfrCount / hands) * 100) : 0;
                const af = stats && stats.passiveActions > 0
                  ? Math.round((stats.aggressiveActions / stats.passiveActions) * 10) / 10
                  : stats && stats.aggressiveActions > 0 ? 99 : 0;
                const style = stats ? classifyPlayerStyle(stats) : null;
                return (
                  <div key={p.id} className="space-y-1">
                    <div className="flex items-center gap-2 text-[0.625rem]">
                      <div className="w-5 h-5 rounded-full overflow-hidden bg-gray-700 shrink-0">
                        {p.avatar ? <img src={p.avatar} alt="" className="w-full h-full object-cover" /> : (
                          <div className="w-full h-full flex items-center justify-center text-[0.5rem] text-gray-400">{p.name[0]}</div>
                        )}
                      </div>
                      <span className="text-gray-300 truncate flex-1">{p.name}</span>
                      {style && (
                        <span
                          className="px-1.5 py-0.5 rounded text-[0.5rem] font-bold uppercase tracking-wider"
                          style={{ color: style.color, background: `${style.color}15`, border: `1px solid ${style.color}30` }}
                          title={style.tooltip}
                        >
                          {style.label}
                        </span>
                      )}
                    </div>
                    {hands > 0 && (
                      <div className="flex items-center gap-2 text-[0.5625rem] pl-7">
                        <span className="text-gray-500" title="VPIP: Voluntarily Put $ In Pot">V:<span className="text-gray-300 font-mono font-bold ml-0.5">{vpip}%</span></span>
                        <span className="text-gray-500" title="PFR: Pre-Flop Raise %">P:<span className="text-gray-300 font-mono font-bold ml-0.5">{pfr}%</span></span>
                        <span className="text-gray-500" title="AF: Aggression Factor (raise/call ratio)">A:<span className="text-gray-300 font-mono font-bold ml-0.5">{af > 10 ? "99+" : af.toFixed(1)}</span></span>
                        <span className="text-gray-600 font-mono">({hands})</span>
                      </div>
                    )}
                  </div>
                );
              })}
              {players.filter(p => p.id !== heroId && p.isActive).length === 0 && (
                <div className="text-gray-600 italic text-[0.5625rem]">No opponents</div>
              )}
            </div>
          </div>

          {/* Hand Strength section (shown in sidebar instead of floating overlay) */}
          {heroHoleCards && gameState.phase !== "showdown" && gameState.phase !== "waiting" && (() => {
            const strength = getHandStrength(heroHoleCards, gameState.communityCards);
            return (
              <div className="border-b border-white/5">
                <div className="px-3 py-2 border-b border-white/5">
                  <span className="text-[0.625rem] font-bold uppercase tracking-wider text-gray-400">Hand Strength</span>
                </div>
                <div className="px-3 py-2">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[0.625rem] font-bold" style={{ color: strength.color }}>{strength.label}</span>
                    <span className="text-[0.625rem] font-mono font-bold" style={{ color: strength.color }}>{strength.percentage}%</span>
                  </div>
                  <div className="w-full h-1.5 rounded-full overflow-hidden bg-white/5">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${strength.percentage}%`, background: strength.color }}
                    />
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Game Stats section */}
          <div className="border-b border-white/5">
            <div className="px-3 py-2 border-b border-white/5">
              <span className="text-[0.625rem] font-bold uppercase tracking-wider text-gray-400">Game Stats</span>
            </div>
            <div className="px-3 py-2 space-y-1 text-[0.625rem]">
              <div className="flex justify-between"><span className="text-gray-500">Chips</span><span className="text-white font-mono">{hero?.chips?.toLocaleString() || "—"}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Players</span><span className="text-white font-mono">{formatInfo?.playersRemaining || players.length}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Current Bet</span><span className="font-mono" style={{ color: "#ffd700" }}>${gameState.minBet || 0}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Round</span><span className="text-gray-300 font-mono uppercase">{gameState.phase}</span></div>
            </div>
          </div>

          {/* Session Ledger */}
          <div>
            <div className="px-3 py-2 border-b border-white/5">
              <span className="text-[0.625rem] font-bold uppercase tracking-wider text-gray-400">Session Ledger</span>
            </div>
            <div className="px-3 py-2 space-y-1 text-[0.625rem]">
              <div className="flex justify-between">
                <span className="text-gray-500">Buy-In</span>
                <span className="text-white font-mono">${(startingChipsRef.current || 0).toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Current Stack</span>
                <span className="text-white font-mono">${(hero?.chips || 0).toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Profit / Loss</span>
                {(() => {
                  const pnl = (hero?.chips || 0) - (startingChipsRef.current || 0);
                  return (
                    <span className={`font-mono font-bold ${pnl > 0 ? "text-emerald-400" : pnl < 0 ? "text-red-400" : "text-gray-400"}`}>
                      {pnl > 0 ? "+" : ""}{pnl.toLocaleString()}
                    </span>
                  );
                })()}
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Hands Played</span>
                <span className="text-white font-mono">{(gameState as any).handNumber || 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Biggest Pot Won</span>
                <span className="font-mono" style={{ color: biggestPotRef.current > 0 ? "#ffd700" : undefined }}>
                  {biggestPotRef.current > 0 ? `$${biggestPotRef.current.toLocaleString()}` : "—"}
                </span>
              </div>
            </div>
          </div>
        </div>
        )}
      </div>

      {/* ═══ AI Commentary Subtitles ═══ */}
      <CommentarySubtitles enabled={commentaryEnabled} />

      {/* ═══ FLOATING OVERLAYS ═══ */}
      <EmotePicker heroId={heroId} isMultiplayer={isMultiplayer} />
      <TauntPicker heroId={heroId} isMultiplayer={isMultiplayer} />

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
              <div className="text-[0.625rem] font-bold uppercase tracking-wider text-amber-400 mb-1">Blinds Increased</div>
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
                  <span className="ml-2" style={{ color: "#ffd700" }}>Won {elimination.prizeAmount} chips</span>
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

      {!screen.showSidebars && (
        <HandStrengthMeter
          holeCards={heroHoleCards}
          communityCards={gameState.communityCards}
          visible={gameState.phase !== "showdown" && !!heroCards}
        />
      )}

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

      {currentSettings && onAdminSettingsApply && (
        <InGameAdminPanel
          isOpen={showAdminPanel}
          onClose={() => setShowAdminPanel(false)}
          settings={currentSettings}
          onApply={onAdminSettingsApply}
          isMultiplayer={isMultiplayer}
          isAdmin={isAdmin}
        />
      )}

      {/* ═══ ADD CHIPS MODAL ═══ */}
      <AnimatePresence>
        {showAddChips && addChips && maxBuyIn && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm"
            onClick={() => setShowAddChips(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="glass rounded-2xl p-6 w-full max-w-xs border border-white/10"
              style={{ boxShadow: "0 0 40px rgba(0,212,255,0.1)" }}
            >
              <div className="text-center mb-5">
                <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-emerald-500/15 border border-emerald-500/30 mb-2">
                  <Wallet className="w-5 h-5 text-emerald-400" />
                </div>
                <h3 className="font-bold text-sm tracking-wider text-white">ADD CHIPS</h3>
                <p className="text-[0.625rem] text-gray-500 mt-1">
                  Wallet: <span className="text-cyan-400 font-mono">{(walletBalance || 0).toLocaleString()}</span> chips
                </p>
              </div>

              {(() => {
                const currentStack = hero?.chips || 0;
                const maxCanAdd = Math.max(0, maxBuyIn - currentStack);
                const sliderMax = Math.min(maxCanAdd, walletBalance || maxCanAdd);
                const clampedAmount = Math.min(addChipsAmount, sliderMax);
                return (
                  <>
                    <div className="mb-4">
                      <label className="text-[0.625rem] font-bold uppercase tracking-wider text-gray-500 block mb-2">
                        Top up to max {maxBuyIn.toLocaleString()} (can add up to {maxCanAdd.toLocaleString()})
                      </label>
                      {sliderMax <= 0 ? (
                        <p className="text-center text-[0.625rem] text-amber-400 py-2">
                          {currentStack >= maxBuyIn ? "Already at max buy-in" : "No chips available to add"}
                        </p>
                      ) : (
                        <>
                          <input
                            type="range"
                            min={1}
                            max={sliderMax}
                            value={clampedAmount}
                            onChange={(e) => setAddChipsAmount(parseInt(e.target.value))}
                            className="w-full mb-2"
                          />
                          <div className="flex justify-between text-xs text-gray-500">
                            <span>1</span>
                            <span className="text-lg font-bold text-emerald-400 font-mono">{clampedAmount.toLocaleString()}</span>
                            <span>{sliderMax.toLocaleString()}</span>
                          </div>
                        </>
                      )}
                    </div>

                    {hero && sliderMax > 0 && (
                      <p className="text-center text-[0.625rem] text-gray-500 mb-4">
                        Current stack: <span className="text-cyan-400 font-mono">{currentStack.toLocaleString()}</span>
                        {" → "}
                        <span className="text-emerald-400 font-mono">{(currentStack + clampedAmount).toLocaleString()}</span>
                        <span className="text-gray-600"> / {maxBuyIn.toLocaleString()} max</span>
                      </p>
                    )}
                  </>
                );
              })()}

              {(walletBalance || 0) <= 0 && (
                <p className="text-center text-[0.625rem] text-red-400 mb-3">Insufficient wallet balance</p>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => setShowAddChips(false)}
                  className="flex-1 glass rounded-lg py-2.5 text-xs font-bold tracking-wider text-gray-400 hover:text-white border border-white/10 hover:border-white/15 transition-all"
                >
                  CANCEL
                </button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => {
                    addChips(addChipsAmount);
                    setShowAddChips(false);
                  }}
                  disabled={addChipsAmount <= 0 || (walletBalance || 0) < addChipsAmount}
                  className="flex-1 rounded-lg py-2.5 text-xs font-bold tracking-wider text-black disabled:opacity-50 transition-all"
                  style={{ background: "linear-gradient(135deg, #00d4ff, #66e5ff)" }}
                >
                  CONFIRM
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══ BUST OVERLAY — practice mode rebuy or exit ═══ */}
      <AnimatePresence>
        {hero && hero.chips <= 0 && !hero.isActive && rebuyHero && gameState.phase !== "showdown" && (
          <motion.div
            key="bust-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.8, y: 30 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.8, y: 30 }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
              className="bg-gradient-to-b from-gray-900 to-gray-950 border border-white/10 rounded-2xl p-8 max-w-sm w-full mx-4 text-center shadow-2xl"
            >
              <div className="text-5xl mb-4">💀</div>
              <h2 className="text-2xl font-black text-white mb-2">You're Busted!</h2>
              <p className="text-gray-400 text-sm mb-6">You ran out of chips. Rebuy to get back in the action or head back to the lobby.</p>
              <div className="flex flex-col gap-3">
                <button
                  onClick={() => rebuyHero(defaultBuyIn || 1000)}
                  className="w-full py-3 rounded-xl font-bold text-sm uppercase tracking-wider text-white transition-all hover:brightness-110"
                  style={{ background: "linear-gradient(to bottom, #10b981, #047857)" }}
                >
                  Rebuy ${(defaultBuyIn || 1000).toLocaleString()}
                </button>
                {onBack && (
                  <button
                    onClick={onBack}
                    className="w-full py-3 rounded-xl font-bold text-sm uppercase tracking-wider text-gray-300 bg-white/5 border border-white/10 hover:bg-white/10 transition-all"
                  >
                    Exit to Lobby
                  </button>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}

// ─── Hand Countdown Overlay ──────────────────────────────────────────────────
function HandCountdownOverlay({ seconds }: { seconds: number | null }) {
  const prevSecondsRef = useRef<number | null>(null);

  // Play countdown beep each time seconds decrements
  useEffect(() => {
    if (seconds !== null && seconds !== prevSecondsRef.current && seconds > 0) {
      soundEngine.playCountdown();
    }
    prevSecondsRef.current = seconds;
  }, [seconds]);

  if (seconds === null || seconds <= 0) return null;

  return (
    <div className="fixed inset-0 z-[55] pointer-events-none flex items-center justify-center">
      <AnimatePresence mode="wait">
        <motion.div
          key={seconds}
          initial={{ scale: 1.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.5, opacity: 0 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          className="flex flex-col items-center"
        >
          <div className="text-[0.625rem] font-bold uppercase tracking-[0.2em] text-cyan-400/70 mb-2">
            Next hand in
          </div>
          <div
            className="text-6xl font-black tabular-nums text-cyan-400"
            style={{
              textShadow: "0 0 30px rgba(0,212,255,0.5), 0 0 60px rgba(0,212,255,0.2)",
            }}
          >
            {seconds}
          </div>
          <div className="mt-3 w-16 h-1 rounded-full bg-cyan-500/20 overflow-hidden">
            <motion.div
              className="h-full bg-cyan-400 rounded-full"
              initial={{ width: "100%" }}
              animate={{ width: "0%" }}
              transition={{ duration: 1, ease: "linear" }}
            />
          </div>
        </motion.div>
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
    connected, error: mpError, waiting, joinTable, leaveTable, addChips, addBots, sendChat,
    commitmentHash, shuffleProof, verificationStatus, playerSeedStatus,
    onChainCommitTx, onChainRevealTx,
    formatInfo, blindIncrease, elimination, tournamentComplete,
    dismissTournamentComplete, bombPotActive, notifications, handCountdown,
    buyTime, acceptInsurance, declineInsurance, voteRunIt,
    walletBalance: liveWalletBalance,
    sitOut, sitIn, postBlinds, waitForBB,
  } = useMultiplayerGame(tableId, user?.id || "");

  // Use live wallet balance from WebSocket when available, fall back to auth context
  const effectiveWalletBalance = liveWalletBalance ?? user?.chipBalance ?? 0;

  // Set taunt voice from user profile preference
  useEffect(() => {
    if (user?.tauntVoice) setTauntVoice(user.tauntVoice);
  }, [user?.tauntVoice]);

  // Fetch table info
  useEffect(() => {
    fetch(`/api/tables/${tableId}`)
      .then(r => r.json())
      .then(setTableInfo)
      .catch(() => {});
  }, [tableId]);

  const isSNG = tableInfo?.gameFormat === "sng" || tableInfo?.gameFormat === "tournament";
  const isTableAdmin = !!(user && tableInfo && (
    String(tableInfo.createdById) === String(user.id) || user.role === "admin"
  ));
  const [mpAdminSettings, setMpAdminSettings] = useState<InGameSettings>({
    straddleEnabled: false, bigBlindAnte: false, runItTwice: "ask",
    rabbitHunting: false, showAllHands: true, autoTopUp: false,
    actionTimerSeconds: 15, speedMultiplier: 1.0, autoStartDelay: 5,
    rakePercent: 5, rakeCap: 0, allowBots: true,
    smallBlind: 10, bigBlind: 20, ante: 0,
    timeBankSeconds: 30, bombPotFrequency: 0, bombPotAnte: 0,
    pokerVariant: "nlhe", useCentsValues: false, showdownSpeed: "normal",
    dealToAwayPlayers: false, timeBankRefillHands: 0, spectatorMode: true,
    doubleBoard: false, sevenTwoBounty: 0, guestChatEnabled: true,
    autoTrimExcessBets: false,
  });

  useEffect(() => {
    if (tableInfo) {
      setMpAdminSettings(prev => ({
        ...prev,
        smallBlind: tableInfo.smallBlind || prev.smallBlind,
        bigBlind: tableInfo.bigBlind || prev.bigBlind,
        ante: tableInfo.ante || 0,
        rakePercent: tableInfo.rakePercent ?? prev.rakePercent,
        rakeCap: tableInfo.rakeCap ?? prev.rakeCap,
      }));
    }
  }, [tableInfo]);

  // Reset joined state only for join-rejection errors (not in-game action errors)
  useEffect(() => {
    if (mpError && joined) {
      const joinErrors = ["Table is full", "No seats available", "Insufficient chips", "Already at this table", "Table not found", "User not found", "Already registered", "Tournament already started"];
      const isJoinError = joinErrors.some(e => mpError.includes(e));
      if (isJoinError) {
        setJoined(false);
      }
    }
  }, [mpError, joined]);

  const handleJoin = () => {
    const amount = isSNG ? (tableInfo?.buyInAmount || buyIn) : buyIn;
    const password = sessionStorage.getItem(`table-password-${tableId}`) || undefined;
    // Check for invite code in URL query params (from /invite/:code redirect)
    const urlParams = new URLSearchParams(window.location.search);
    const inviteCode = urlParams.get("invite") || undefined;
    joinTable(amount, selectedSeat, password, inviteCode);
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
      <div className="min-h-screen bg-[#111b2a] text-white flex items-center justify-center relative overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(30,43,75,0.4)_0%,rgba(20,31,40,0.88)_70%)]" />
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
                  <span className="ml-2 text-cyan-400">
                    &middot; {tableInfo.gameFormat === "sng" ? "Sit & Go" : "Tournament"}
                  </span>
                )}
              </p>
            )}
          </div>

          {isSNG ? (
            /* SNG: Fixed buy-in display */
            <div className="mb-6">
              <label className="text-[0.625rem] font-bold uppercase tracking-wider text-gray-500 block mb-2">
                Fixed Buy-In
              </label>
              <div className="glass rounded-lg p-4 border border-cyan-500/20 text-center">
                <div className="text-2xl font-bold text-cyan-400 font-mono">
                  {(tableInfo?.buyInAmount || 500).toLocaleString()}
                </div>
                <div className="text-[0.625rem] text-gray-500 mt-1">
                  Starting chips: {(tableInfo?.startingChips || 1500).toLocaleString()}
                </div>
              </div>
              <p className="text-center text-[0.625rem] text-gray-600 mt-2">
                Balance: {user?.chipBalance?.toLocaleString()} chips
              </p>
            </div>
          ) : (
            /* Cash game: Buy-in slider */
            <div className="mb-6">
              <label className="text-[0.625rem] font-bold uppercase tracking-wider text-gray-500 block mb-2">
                Buy-In Amount
              </label>
              <input
                type="range"
                min={tableInfo?.returnMinBuyIn || tableInfo?.minBuyIn || 200}
                max={Math.min(tableInfo?.maxBuyIn || 2000, user?.chipBalance || 2000)}
                value={buyIn}
                onChange={(e) => setBuyIn(parseInt(e.target.value))}
                className="w-full mb-2"
              />
              <div className="flex justify-between text-xs text-gray-500">
                <span>{tableInfo?.returnMinBuyIn || tableInfo?.minBuyIn || 200}</span>
                <span className="text-lg font-bold text-cyan-400">{buyIn}</span>
                <span>{Math.min(tableInfo?.maxBuyIn || 2000, user?.chipBalance || 2000)}</span>
              </div>
              <p className="text-center text-[0.625rem] text-gray-600 mt-1">
                Balance: {user?.chipBalance?.toLocaleString()} chips
              </p>
            </div>
          )}

          {/* Seat Selection */}
          {tableInfo && (
            <div className="mb-4">
              <label className="text-[0.625rem] font-bold uppercase tracking-wider text-gray-500 block mb-2">
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
                            ? "bg-cyan-500/25 border-cyan-400 text-cyan-400 shadow-[0_0_10px_rgba(0,212,255,0.3)]"
                            : "bg-white/5 border-white/10 text-gray-400 hover:border-cyan-500/30 hover:text-white"
                      }`}
                    >
                      {i + 1}
                    </motion.button>
                  );
                })}
              </div>
              <p className="text-center text-[0.5625rem] text-gray-600 mt-1.5">
                {selectedSeat !== undefined ? `Seat ${selectedSeat + 1} selected` : "Auto-assign if none selected"}
              </p>
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={() => navigate("/lobby")}
              className="flex-1 glass rounded-lg py-3 text-sm font-bold tracking-wider text-gray-400 hover:text-white border border-white/10 hover:border-white/15 transition-all"
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
        addChips={addChips}
        maxBuyIn={tableInfo?.maxBuyIn}
        minBuyIn={tableInfo?.minBuyIn}
        walletBalance={effectiveWalletBalance}
        buyTime={buyTime}
        acceptInsurance={acceptInsurance}
        declineInsurance={declineInsurance}
        voteRunIt={voteRunIt}
        sitOut={sitOut}
        sitIn={sitIn}
        postBlinds={postBlinds}
        waitForBB={waitForBB}
        inviteCode={tableInfo?.inviteCode}
        isAdmin={isTableAdmin}
        currentSettings={mpAdminSettings}
        onAdminSettingsApply={(newSettings) => setMpAdminSettings(newSettings)}
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
      {/* Hand Starting Countdown Overlay */}
      <HandCountdownOverlay seconds={handCountdown} />
      </GameUIProvider>
    </SoundProvider>
  );
}

// ─── Offline Game (Original) ──────────────────────────────────────────────────
const BOT_CHAT_LINES = [
  "Nice hand!", "Wow, really?", "I'll get you next time",
  "Let's go!", "Too rich for me", "Good fold",
  "Interesting play...", "All day", "Ship it!",
  "That's poker", "I had the nuts, I swear", "GG",
];

function OfflineGameTable({ initialPlayers, engineConfig }: { initialPlayers: Player[]; engineConfig?: GameEngineConfig }) {
  const { players, gameState, handlePlayerAction, showdown, rebuyHero, sitOut, sitIn, updateConfig } = useGameEngine(initialPlayers, HERO_ID, engineConfig);
  const [, navigate] = useLocation();
  const defaultBuyIn = initialPlayers.find(p => p.id === HERO_ID)?.chips || 1000;
  const [chatMessages, setChatMessages] = useState<{ playerName: string; message: string }[]>([]);
  const [adminSettings, setAdminSettings] = useState<InGameSettings>({
    straddleEnabled: false, bigBlindAnte: false, runItTwice: "ask",
    rabbitHunting: false, showAllHands: true, autoTopUp: false,
    actionTimerSeconds: 15, speedMultiplier: 1.0, autoStartDelay: 5,
    rakePercent: 0, rakeCap: 0, allowBots: true,
    smallBlind: engineConfig?.smallBlind || 10,
    bigBlind: engineConfig?.bigBlind || 20,
    ante: engineConfig?.ante || 0,
    timeBankSeconds: 30, bombPotFrequency: 0, bombPotAnte: 0,
    pokerVariant: "nlhe", useCentsValues: false, showdownSpeed: "normal",
    dealToAwayPlayers: false, timeBankRefillHands: 0, spectatorMode: true,
    doubleBoard: false, sevenTwoBounty: 0, guestChatEnabled: true,
    autoTrimExcessBets: false,
  });

  const sendChat = useCallback((message: string) => {
    const hero = players.find(p => p.id === HERO_ID);
    setChatMessages(prev => [...prev.slice(-50), { playerName: hero?.name || "You", message }]);
    // Bot responds occasionally
    if (Math.random() < 0.4) {
      const bots = players.filter(p => p.id !== HERO_ID && p.isActive);
      if (bots.length > 0) {
        const bot = bots[Math.floor(Math.random() * bots.length)];
        setTimeout(() => {
          setChatMessages(prev => [...prev.slice(-50), {
            playerName: bot.name,
            message: BOT_CHAT_LINES[Math.floor(Math.random() * BOT_CHAT_LINES.length)],
          }]);
        }, 1500 + Math.random() * 2000);
      }
    }
  }, [players]);

  // Merge chat messages into gameState for the sidebar
  const gameStateWithChat = useMemo(() => ({
    ...gameState,
    chatMessages,
  }), [gameState, chatMessages]);

  return (
    <GameTable
      players={players}
      gameState={gameStateWithChat}
      handlePlayerAction={handlePlayerAction}
      showdown={showdown}
      heroId={HERO_ID}
      onBack={() => navigate("/lobby")}
      sendChat={sendChat}
      rebuyHero={(amount) => rebuyHero(amount)}
      defaultBuyIn={defaultBuyIn}
      sitOut={sitOut}
      sitIn={sitIn}
      isAdmin={true}
      currentSettings={adminSettings}
      onAdminSettingsApply={(newSettings) => {
        setAdminSettings(newSettings);
        updateConfig({ smallBlind: newSettings.smallBlind, bigBlind: newSettings.bigBlind, ante: newSettings.ante });
      }}
    />
  );
}

// ─── Main Game Page ───────────────────────────────────────────────────────────
export default function Game({ tableId }: { tableId?: string }) {
  const [, navigate] = useLocation();
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
        onExit={() => navigate("/")}
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
