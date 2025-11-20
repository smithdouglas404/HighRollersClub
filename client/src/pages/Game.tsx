import { useState } from "react";
import { Seat } from "../components/poker/Seat";
import { CommunityCards } from "../components/poker/CommunityCards";
import { PokerControls } from "../components/poker/Controls";
import { Player, GameState } from "../lib/poker-types";
import { Button } from "@/components/ui/button";
import { Menu, Settings, MessageSquare, History } from "lucide-react";

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
  },
  {
    id: "player-2",
    name: "AggroFish",
    chips: 3200,
    isActive: true,
    isDealer: true,
    currentBet: 0,
    status: "waiting",
    cards: [{ suit: "spades", rank: "A", hidden: true }, { suit: "spades", rank: "A", hidden: true }]
  },
  {
    id: "player-3",
    name: "NitPlayer",
    chips: 850,
    isActive: true,
    isDealer: false,
    currentBet: 50,
    status: "checked",
    cards: [{ suit: "spades", rank: "A", hidden: true }, { suit: "spades", rank: "A", hidden: true }]
  },
  {
    id: "player-4",
    name: "LooseGoose",
    chips: 5000,
    isActive: true,
    isDealer: false,
    currentBet: 50,
    status: "waiting",
    cards: [{ suit: "spades", rank: "A", hidden: true }, { suit: "spades", rank: "A", hidden: true }]
  },
  {
    id: "player-5",
    name: "CallingStn",
    chips: 1200,
    isActive: true,
    isDealer: false,
    currentBet: 0,
    status: "folded",
  },
  {
    id: "player-6",
    name: "TheShark",
    chips: 2100,
    isActive: true,
    isDealer: false,
    currentBet: 0,
    status: "folded",
  },
];

// 6-Max Table Positions (Percentage x, y)
const SEAT_POSITIONS = [
    { x: 50, y: 85 }, // Hero (Bottom)
    { x: 15, y: 65 }, // Bottom Left
    { x: 15, y: 35 }, // Top Left
    { x: 50, y: 15 }, // Top
    { x: 85, y: 35 }, // Top Right
    { x: 85, y: 65 }, // Bottom Right
];

export default function Game() {
  const [players, setPlayers] = useState<Player[]>(INITIAL_PLAYERS);
  const [gameState, setGameState] = useState<GameState>({
    pot: 150,
    communityCards: [
        { suit: "hearts", rank: "10" },
        { suit: "clubs", rank: "J" },
        { suit: "diamonds", rank: "2" }
    ],
    currentTurnPlayerId: HERO_ID,
  });

  const hero = players.find(p => p.id === HERO_ID);

  const handleAction = (action: string, amount?: number) => {
    console.log(`Action: ${action}, Amount: ${amount}`);
    // In a real app, this would emit a socket event
  };

  return (
    <div className="min-h-screen bg-[#1a1d21] text-white overflow-hidden relative selection:bg-green-500 selection:text-white">
      
      {/* Header / Top Bar */}
      <div className="absolute top-0 left-0 right-0 h-14 bg-[#131518] border-b border-white/5 flex items-center justify-between px-4 z-50">
        <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" className="text-gray-400 hover:text-white">
                <Menu className="w-5 h-5" />
            </Button>
            <div className="font-bold text-lg tracking-tight text-green-500">PokerNow<span className="text-white">.club</span></div>
        </div>
        <div className="flex items-center gap-2">
            <div className="hidden md:flex items-center gap-2 px-3 py-1 bg-white/5 rounded-full text-xs font-mono text-gray-400">
                <span>Blind 10/20</span>
                <span className="text-gray-600">|</span>
                <span>#G-83921</span>
            </div>
            <Button variant="ghost" size="icon" className="text-gray-400 hover:text-white">
                <History className="w-5 h-5" />
            </Button>
             <Button variant="ghost" size="icon" className="text-gray-400 hover:text-white">
                <Settings className="w-5 h-5" />
            </Button>
        </div>
      </div>

      {/* Main Game Area */}
      <div className="absolute inset-0 top-14 bottom-24 flex items-center justify-center p-4 overflow-hidden">
        
        {/* The Table Felt */}
        <div className="relative w-full max-w-[900px] aspect-[2/1] rounded-[200px] bg-[#2c5d45] shadow-[inset_0_0_100px_rgba(0,0,0,0.7),0_20px_50px_rgba(0,0,0,0.5)] border-[16px] border-[#1e2328] ring-1 ring-white/10">
            {/* Inner Felt Texture/Pattern */}
            <div className="absolute inset-0 rounded-[180px] opacity-50 mix-blend-overlay bg-[url('https://www.transparenttextures.com/patterns/felt.png')]" />
            
            {/* Table Logo/Center */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-10">
                <div className="text-4xl font-black tracking-widest text-black transform -rotate-12">POKERNOW</div>
            </div>

            {/* Community Cards & Pot */}
            <CommunityCards cards={gameState.communityCards} pot={gameState.pot} />

            {/* Seats */}
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

      {/* Chat / Log Toggle (Floating) */}
      <div className="fixed bottom-32 right-4 z-40">
          <Button size="icon" className="rounded-full w-12 h-12 bg-gray-800 hover:bg-gray-700 shadow-xl border border-white/10">
              <MessageSquare className="w-5 h-5" />
          </Button>
      </div>

      {/* Controls */}
      <PokerControls onAction={handleAction} minBet={20} maxBet={hero?.chips || 1000} />
    </div>
  );
}
