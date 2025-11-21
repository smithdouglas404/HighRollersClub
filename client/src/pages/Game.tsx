import { Seat } from "../components/poker/Seat";
import { CommunityCards } from "../components/poker/CommunityCards";
import { PokerControls } from "../components/poker/Controls";
import { ProvablyFairPanel } from "../components/poker/ProvablyFairPanel";
import { MatrixOverlay } from "../components/MatrixOverlay";
import { Player } from "../lib/poker-types"; // GameState is now inferred from engine
import { Button } from "@/components/ui/button";
import { Trophy, ShieldCheck } from "lucide-react";
import { useGameEngine } from "@/lib/game-engine";
import { useState } from "react";

// Assets
import lionLogo from '@assets/generated_images/Golden_Lion_Logo_for_Poker_Table_961614b0.png';
import feltTexture from '@assets/generated_images/luxury_poker_table_surface.png';
import avatar1 from '@assets/generated_images/cyberpunk_poker_player_avatar_1.png';
import avatar2 from '@assets/generated_images/cyberpunk_poker_player_avatar_2.png';
import avatar3 from '@assets/generated_images/cyberpunk_poker_player_avatar_3.png';
import avatar4 from '@assets/generated_images/cyberpunk_poker_player_avatar_4.png';

// Mock Data Setup
const HERO_ID = "player-1";

const INITIAL_PLAYERS: Player[] = [
  {
    id: "player-1",
    name: "Hero",
    chips: 1540,
    isActive: true,
    isDealer: false,
    currentBet: 0,
    status: "waiting",
    timeLeft: 100,
    avatar: avatar1
  },
  {
    id: "player-2",
    name: "CryptoKing",
    chips: 3200,
    isActive: true,
    isDealer: true,
    currentBet: 0,
    status: "waiting",
    avatar: avatar2
  },
  {
    id: "player-3",
    name: "Satoshi",
    chips: 850,
    isActive: true,
    isDealer: false,
    currentBet: 0,
    status: "waiting",
    avatar: avatar3
  },
  {
    id: "player-4",
    name: "Whale_0x",
    chips: 5000,
    isActive: true,
    isDealer: false,
    currentBet: 0,
    status: "waiting",
    avatar: avatar4
  },
  {
    id: "player-5",
    name: "HODLer",
    chips: 1200,
    isActive: true,
    isDealer: false,
    currentBet: 0,
    status: "waiting",
    avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Hodl"
  },
  {
    id: "player-6",
    name: "Degen",
    chips: 2100,
    isActive: true,
    isDealer: false,
    currentBet: 0,
    status: "waiting",
    avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Degen"
  },
];

// 6-Max Table Positions (Percentage x, y) adjusted for 3D perspective view
const SEAT_POSITIONS = [
    { x: 50, y: 88 }, // Hero (Bottom)
    { x: 12, y: 65 }, // Bottom Left
    { x: 20, y: 25 }, // Top Left
    { x: 50, y: 15 }, // Top
    { x: 80, y: 25 }, // Top Right
    { x: 88, y: 65 }, // Bottom Right
];

export default function Game() {
  const { players, gameState, handlePlayerAction } = useGameEngine(INITIAL_PLAYERS);
  const [showProvablyFair, setShowProvablyFair] = useState(true);

  const hero = players.find(p => p.id === HERO_ID);
  const isHeroTurn = gameState.currentTurnPlayerId === HERO_ID;

  return (
    <div className="min-h-screen bg-[#050505] text-white overflow-hidden relative font-sans selection:bg-green-500 selection:text-white flex">
      
      <MatrixOverlay />

      {/* Ambient Background Lighting */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,#1a2e35_0%,#000000_80%)] opacity-50 pointer-events-none" />

      {/* Main Content Area */}
      <div className="flex-1 relative flex flex-col h-screen overflow-hidden">
        
        {/* Header Overlay */}
        <div className="absolute top-0 left-0 right-0 h-16 flex items-center justify-between px-6 z-50 pointer-events-none">
            <div className="pointer-events-auto flex items-center gap-4">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-yellow-400 to-yellow-700 rounded-lg flex items-center justify-center shadow-[0_0_20px_rgba(234,179,8,0.3)]">
                        <Trophy className="w-6 h-6 text-black" />
                    </div>
                    <div>
                        <div className="font-bold text-xl tracking-widest text-transparent bg-clip-text bg-gradient-to-b from-yellow-200 to-yellow-600 drop-shadow-lg font-serif">
                            HIGH ROLLERS
                        </div>
                        <div className="text-[10px] text-yellow-500/70 tracking-[0.3em] font-bold uppercase">
                            VIP Club • Table #802 • {gameState.phase.toUpperCase()}
                        </div>
                    </div>
                </div>
            </div>
            <div className="pointer-events-auto flex gap-2">
                 <Button variant="outline" className="bg-black/50 border-green-500/30 text-green-400 backdrop-blur-md hover:bg-green-500/10" onClick={() => setShowProvablyFair(!showProvablyFair)}>
                    <ShieldCheck className="w-4 h-4 mr-2" />
                    Verified
                 </Button>
            </div>
        </div>

        {/* 3D Game Scene Container */}
        <div className="flex-1 relative flex items-center justify-center perspective-[1200px] overflow-hidden -mt-10">
            
            {/* The Table Group - Rotated in 3D Space */}
            <div 
                className="relative w-[95%] max-w-[1200px] aspect-[1.9/1] transition-transform duration-700 ease-out transform-style-3d"
                style={{ 
                    transform: 'rotateX(30deg) translateY(50px) scale(0.9)',
                }}
            >
                {/* The Rail (Leather/Gold) */}
                <div className="absolute -inset-[40px] rounded-[350px] bg-gradient-to-b from-[#2a2420] to-[#1a1614] shadow-[0_30px_60px_-10px_rgba(0,0,0,0.9),inset_0_2px_5px_rgba(255,255,255,0.1)] border-b-8 border-[#0a0806]">
                    {/* Illuminated Edge Strip */}
                    <div className="absolute inset-[10px] rounded-[320px] border-[2px] border-yellow-500/20 shadow-[0_0_30px_rgba(234,179,8,0.2)]" />
                </div>

                {/* The Felt Surface */}
                <div className="absolute inset-0 rounded-[300px] overflow-hidden shadow-[inset_0_0_80px_rgba(0,0,0,0.8)]">
                    
                    {/* Felt Texture */}
                    <div 
                        className="absolute inset-0 bg-cover bg-center opacity-100"
                        style={{ 
                            backgroundImage: `url(${feltTexture})`,
                            backgroundSize: '100% 100%',
                        }}
                    />
                    
                    {/* Vignette & Lighting */}
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_20%,rgba(0,10,20,0.7)_100%)]" />

                    {/* Center Logo */}
                    <div className="absolute top-[50%] left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 opacity-80 mix-blend-overlay pointer-events-none">
                        <img src={lionLogo} alt="Lion Logo" className="w-full h-full object-contain opacity-50 drop-shadow-[0_2px_20px_rgba(207,181,59,0.2)]" />
                    </div>

                    {/* Betting Line */}
                    <div className="absolute top-[50%] left-1/2 -translate-x-1/2 -translate-y-1/2 w-[65%] h-[55%] rounded-[200px] border border-white/5 shadow-[0_0_10px_rgba(255,255,255,0.05)] pointer-events-none" />
                </div>

                {/* Community Cards - "Floating" above table */}
                <div className="absolute top-[46%] left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-20" style={{ transform: 'translate(-50%, -50%) translateZ(20px)' }}>
                     <CommunityCards cards={gameState.communityCards} pot={gameState.pot} />
                </div>

                {/* Seats - Positioned around */}
                {players.map((player, index) => (
                    <Seat 
                        key={player.id} 
                        player={player} 
                        position={SEAT_POSITIONS[index]} 
                        isHero={player.id === HERO_ID}
                    />
                ))}
            </div>
        </div>

        {/* Bottom Controls */}
        <div className="z-50 relative">
            {/* Hero Hand Shadow/Reflection */}
            <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-black via-black/80 to-transparent pointer-events-none" />
            <div className={`transition-all duration-300 ${!isHeroTurn ? 'opacity-50 grayscale pointer-events-none' : 'opacity-100'}`}>
                <PokerControls 
                    onAction={handlePlayerAction} 
                    minBet={gameState.minBet} 
                    maxBet={hero?.chips || 1000} 
                />
            </div>
        </div>
      </div>

      {/* Right Side Panel - Provably Fair */}
      {showProvablyFair && (
          <ProvablyFairPanel />
      )}

    </div>
  );
}
