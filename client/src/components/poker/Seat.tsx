import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Player } from "@/lib/poker-types";
import { Card } from "./Card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface SeatProps {
  player: Player;
  position: { x: number; y: number }; // Percentage positions
  isHero?: boolean;
}

export function Seat({ player, position, isHero = false }: SeatProps) {
  const isTurn = player.status === 'thinking';
  
  return (
    <div
      className="absolute transform -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-2 transition-all duration-500"
      style={{ 
          left: `${position.x}%`, 
          top: `${position.y}%`,
          transform: 'translate(-50%, -50%) rotateX(-30deg)', // Counter-rotate to face camera
          zIndex: position.y < 50 ? 10 : 30 // Top players behind, bottom players in front
      }}
      data-testid={`seat-${player.id}`}
    >
      {/* Character/Avatar Container */}
      <div className="relative group">
        
        {/* Glow Effect for Active Player */}
        {isTurn && (
            <div className="absolute -inset-8 bg-yellow-500/10 rounded-full blur-2xl animate-pulse pointer-events-none" />
        )}

        <div className="relative">
            {/* Dealer Button */}
            {player.isDealer && (
                <div className="absolute -right-2 top-0 w-7 h-7 bg-gradient-to-b from-white to-gray-200 rounded-full border-2 border-gray-300 flex items-center justify-center text-[10px] font-black z-20 shadow-[0_2px_5px_rgba(0,0,0,0.3)] text-black">
                    D
                </div>
            )}

            {/* Avatar Frame */}
            <div className={cn(
                "w-24 h-24 relative z-10 transition-transform duration-300 group-hover:scale-105",
                isTurn ? "scale-110" : "scale-100"
            )}>
                {/* Sci-Fi Border/Ring */}
                <svg className="absolute inset-0 w-full h-full -rotate-90 drop-shadow-[0_0_15px_rgba(0,0,0,0.5)] overflow-visible">
                    <defs>
                        <linearGradient id={`grad-${player.id}`} x1="0%" y1="0%" x2="100%" y2="0%">
                            <stop offset="0%" stopColor="#fbbf24" />
                            <stop offset="100%" stopColor="#d97706" />
                        </linearGradient>
                    </defs>
                    
                    {/* Background Ring */}
                    <circle cx="50%" cy="50%" r="46%" fill="#000000" fillOpacity="0.8" stroke="#1f2937" strokeWidth="6" />
                    
                    {/* Timer Ring */}
                    {isTurn && (
                        <circle
                            cx="50%" cy="50%" r="46%"
                            fill="none"
                            stroke={`url(#grad-${player.id})`}
                            strokeWidth="4"
                            strokeDasharray="100"
                            strokeDashoffset={100 - (player.timeLeft || 100)}
                            strokeLinecap="round"
                            className="transition-all duration-1000 ease-linear filter drop-shadow-[0_0_8px_rgba(234,179,8,0.5)]"
                        />
                    )}
                </svg>
                
                <Avatar className="w-full h-full p-2 bg-transparent">
                    <AvatarImage src={player.avatar} className="rounded-full object-cover border-2 border-white/10" />
                    <AvatarFallback className="bg-gray-900 text-white border-2 border-gray-700">
                        {player.name.substring(0, 2).toUpperCase()}
                    </AvatarFallback>
                </Avatar>

                {/* Status Badge (Folded/All-in) */}
                {player.status === 'folded' && (
                    <div className="absolute inset-0 bg-black/60 rounded-full backdrop-blur-sm flex items-center justify-center">
                        <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Folded</span>
                    </div>
                )}
            </div>
        </div>
        
        {/* Player Name Plate */}
        <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 bg-[#0a0a0a] border border-white/10 px-4 py-1.5 rounded-lg flex flex-col items-center min-w-[100px] shadow-xl z-20 before:absolute before:inset-0 before:bg-gradient-to-b before:from-white/5 before:to-transparent before:rounded-lg">
            <span className="text-[10px] text-gray-400 uppercase tracking-widest font-bold mb-0.5">{player.name}</span>
            <div className="flex items-center gap-1 text-yellow-500">
                <span className="text-xs">$</span>
                <span className="text-sm font-mono font-bold leading-none tracking-tight">{player.chips.toLocaleString()}</span>
            </div>
        </div>

      </div>

      {/* Cards - Positioned relative to the avatar but "on" the table */}
      {player.cards && player.status !== 'folded' && (
        <div 
            className={cn(
                "flex gap-1 absolute transition-all duration-500 perspective-[500px]",
                isHero 
                    ? "-top-28 scale-125 z-50" // Hero cards floating up clearly
                    : "top-[85%] scale-75 z-0 opacity-90" // Opponent cards tucked in
            )}
            style={{
                transform: isHero ? 'translateY(0px) rotateX(10deg)' : 'translateY(0px)' 
            }}
        >
          <Card card={player.cards[0]} />
          <Card card={player.cards[1]} />
        </div>
      )}
      
      {/* Bet Chips */}
      {player.currentBet > 0 && (
          <div className="absolute top-[150%] flex flex-col items-center gap-1 z-30">
             <div className="bg-black/80 px-2 py-0.5 rounded text-xs font-mono text-white border border-yellow-500/30 shadow-lg backdrop-blur-md">
                 {player.currentBet.toLocaleString()}
             </div>
             {/* 3D Chip Stack Simulation */}
             <div className="relative h-8 w-8 group perspective-[500px]">
                 {[...Array(3)].map((_, i) => (
                     <div 
                        key={i}
                        className="absolute bottom-0 w-full h-full rounded-full bg-gradient-to-b from-red-500 to-red-700 border-[3px] border-dashed border-white/40 shadow-lg"
                        style={{ 
                            transform: `translateY(-${i * 4}px) rotateX(40deg)`,
                            boxShadow: '0 4px 6px rgba(0,0,0,0.5)'
                        }} 
                     />
                 ))}
             </div>
          </div>
      )}
      
       {player.status === 'checked' && (
          <div className="absolute top-[130%] bg-black/60 rounded px-3 py-1 text-[10px] text-gray-300 font-bold uppercase tracking-wider border border-white/10 shadow-lg backdrop-blur-md">
             Check
          </div>
      )}
    </div>
  );
}
