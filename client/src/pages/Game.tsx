import { useState } from "react";
import { Seat } from "../components/poker/Seat";
import { CommunityCards } from "../components/poker/CommunityCards";
import { PokerControls } from "../components/poker/Controls";
import { ProvablyFairPanel } from "../components/poker/ProvablyFairPanel";
import { MatrixOverlay } from "../components/MatrixOverlay";
import { Player, GameState } from "../lib/poker-types";
import { Button } from "@/components/ui/button";
import { Menu, Settings, MessageSquare, History, ShieldCheck } from "lucide-react";

// Assets
import lionLogo from '@assets/generated_images/Golden_Lion_Logo_for_Poker_Table_961614b0.png';
import feltTexture from '@assets/generated_images/Dark_Teal_Poker_Felt_Texture_83ec2760.png';

// Mock Data Setup
const HERO_ID = "player-1";

const INITIAL_PLAYERS: Player[] = [
  {
    id: "player-1",
    name: "Hero",
    chips: 1540,
    cards: [
        { suit: "spades", rank: "A" },
        { suit: "hearts", rank: "K" }
    ],
    isActive: true,
    isDealer: false,
    currentBet: 0,
    status: "thinking",
    timeLeft: 70,
    avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Hero"
  },
  {
    id: "player-2",
    name: "CryptoKing",
    chips: 3200,
    isActive: true,
    isDealer: true,
    currentBet: 0,
    status: "waiting",
    cards: [{ suit: "spades", rank: "A", hidden: true }, { suit: "spades", rank: "A", hidden: true }],
    avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=King"
  },
  {
    id: "player-3",
    name: "Satoshi",
    chips: 850,
    isActive: true,
    isDealer: false,
    currentBet: 50,
    status: "checked",
    cards: [{ suit: "spades", rank: "A", hidden: true }, { suit: "spades", rank: "A", hidden: true }],
    avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Satoshi"
  },
  {
    id: "player-4",
    name: "Whale_0x",
    chips: 5000,
    isActive: true,
    isDealer: false,
    currentBet: 50,
    status: "waiting",
    cards: [{ suit: "spades", rank: "A", hidden: true }, { suit: "spades", rank: "A", hidden: true }],
    avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Whale"
  },
  {
    id: "player-5",
    name: "HODLer",
    chips: 1200,
    isActive: true,
    isDealer: false,
    currentBet: 0,
    status: "folded",
    avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Hodl"
  },
  {
    id: "player-6",
    name: "Degen",
    chips: 2100,
    isActive: true,
    isDealer: false,
    currentBet: 0,
    status: "folded",
    avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Degen"
  },
];

// 6-Max Table Positions (Percentage x, y) adjusted for 3D perspective view
// Top players need to be "further back" in Y
const SEAT_POSITIONS = [
    { x: 50, y: 90 }, // Hero (Bottom)
    { x: 10, y: 60 }, // Bottom Left
    { x: 20, y: 20 }, // Top Left
    { x: 50, y: 10 }, // Top
    { x: 80, y: 20 }, // Top Right
    { x: 90, y: 60 }, // Bottom Right
];

export default function Game() {
  const [players, setPlayers] = useState<Player[]>(INITIAL_PLAYERS);
  const [gameState, setGameState] = useState<GameState>({
    pot: 950,
    communityCards: [
        { suit: "spades", rank: "A" },
        { suit: "clubs", rank: "A" },
        { suit: "diamonds", rank: "A" }
    ],
    currentTurnPlayerId: HERO_ID,
  });

  const hero = players.find(p => p.id === HERO_ID);
  const [showProvablyFair, setShowProvablyFair] = useState(true);

  const handleAction = (action: string, amount?: number) => {
    console.log(`Action: ${action}, Amount: ${amount}`);
  };

  return (
    <div className="min-h-screen bg-black text-white overflow-hidden relative font-sans selection:bg-green-500 selection:text-white flex">
      
      <MatrixOverlay />

      {/* Main Content Area */}
      <div className="flex-1 relative flex flex-col h-screen overflow-hidden">
        
        {/* Header Overlay */}
        <div className="absolute top-0 left-0 right-0 h-16 flex items-center justify-between px-6 z-50 pointer-events-none">
            <div className="pointer-events-auto flex items-center gap-4">
                <div className="font-bold text-xl tracking-widest text-transparent bg-clip-text bg-gradient-to-b from-yellow-300 to-yellow-600 drop-shadow-lg font-serif">
                    HIGH ROLLERS CLUB
                </div>
            </div>
            <div className="pointer-events-auto flex gap-2">
                 <Button variant="outline" className="bg-black/50 border-green-500/30 text-green-400 backdrop-blur-md hover:bg-green-500/10" onClick={() => setShowProvablyFair(!showProvablyFair)}>
                    <ShieldCheck className="w-4 h-4 mr-2" />
                    Verify
                 </Button>
            </div>
        </div>

        {/* 3D Game Scene Container */}
        <div className="flex-1 relative flex items-center justify-center perspective-[1200px] overflow-hidden -mt-10">
            
            {/* The Table Group - Rotated in 3D Space */}
            <div 
                className="relative w-[95%] max-w-[1100px] aspect-[1.8/1] transition-transform duration-700 ease-out transform-style-3d"
                style={{ 
                    transform: 'rotateX(25deg) translateY(40px)',
                }}
            >
                {/* The Felt Surface */}
                <div className="absolute inset-0 rounded-[300px] shadow-[0_50px_80px_-20px_rgba(0,0,0,0.8)] border-[24px] border-[#2a2420] ring-1 ring-white/10 overflow-hidden">
                    
                    {/* Felt Texture */}
                    <div 
                        className="absolute inset-0 bg-felt bg-cover bg-center opacity-100"
                        style={{ backgroundImage: `url(${feltTexture})` }}
                    />
                    
                    {/* Vignette & Lighting */}
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(0,0,0,0.6)_100%)]" />

                    {/* Gold Ring Decoration */}
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[70%] h-[60%] rounded-[200px] border border-felt-accent/30" />
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[65%] h-[55%] rounded-[200px] border border-felt-accent/10" />

                    {/* Center Logo */}
                    <div className="absolute top-[40%] left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 opacity-90 mix-blend-overlay">
                        <img src={lionLogo} alt="Lion Logo" className="w-full h-full object-contain opacity-60 drop-shadow-[0_2px_10px_rgba(207,181,59,0.3)]" />
                    </div>
                    
                    {/* Table Text */}
                    <div className="absolute top-[60%] left-1/2 -translate-x-1/2 text-felt-accent/40 font-serif tracking-[0.3em] text-xs font-bold uppercase">
                        High Rollers Club
                    </div>
                </div>

                {/* Community Cards - "Floating" above table */}
                <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-20" style={{ transform: 'translate(-50%, -50%) translateZ(20px)' }}>
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
        <div className="z-50">
            <PokerControls onAction={handleAction} minBet={20} maxBet={hero?.chips || 1000} />
        </div>
      </div>

      {/* Right Side Panel - Provably Fair */}
      {showProvablyFair && (
          <ProvablyFairPanel />
      )}

    </div>
  );
}
