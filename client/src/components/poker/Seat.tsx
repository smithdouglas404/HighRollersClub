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
  
  // In a 3D rotated table, elements further "back" (lower Y value visually on screen, which corresponds to top of table)
  // might need to be scaled down slightly or adjusted to look correct.
  // However, since we are children of a rotated div, we inherit the rotation.
  // To make the avatars "stand up" and face the user, we need to counter-rotate them.
  // Table is rotateX(25deg). So we need rotateX(-25deg).
  
  return (
    <div
      className="absolute transform -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-2 transition-all duration-500"
      style={{ 
          left: `${position.x}%`, 
          top: `${position.y}%`,
          transform: 'translate(-50%, -50%) rotateX(-25deg)', // Counter-rotate to face camera
          zIndex: position.y < 50 ? 10 : 30 // Top players behind, bottom players in front
      }}
      data-testid={`seat-${player.id}`}
    >
      {/* Character/Avatar Container */}
      <div className="relative group">
        
        {/* Glow Effect for Active Player */}
        {isTurn && (
            <div className="absolute -inset-4 bg-yellow-500/20 rounded-full blur-xl animate-pulse" />
        )}

        <div className="relative">
            {/* Dealer Button */}
            {player.isDealer && (
                <div className="absolute -right-2 top-0 w-6 h-6 bg-white rounded-full border-2 border-gray-300 flex items-center justify-center text-[10px] font-bold z-20 shadow-lg text-black">
                    D
                </div>
            )}

            {/* Avatar Frame - Hex or Circle */}
            <div className={cn(
                "w-20 h-20 relative z-10 transition-transform duration-300",
                isTurn ? "scale-110" : "scale-100"
            )}>
                {/* Sci-Fi Border/Ring */}
                <svg className="absolute inset-0 w-full h-full -rotate-90 drop-shadow-[0_0_10px_rgba(0,255,100,0.5)]">
                    <circle cx="50%" cy="50%" r="46%" fill="none" stroke="#0f2e35" strokeWidth="4" />
                    {isTurn && (
                        <circle
                            cx="50%" cy="50%" r="46%"
                            fill="none"
                            stroke="#cfb53b"
                            strokeWidth="2"
                            strokeDasharray="100"
                            strokeDashoffset={100 - (player.timeLeft || 100)}
                            strokeLinecap="round"
                            className="transition-all duration-1000 ease-linear"
                        />
                    )}
                </svg>
                
                <Avatar className="w-full h-full p-1.5 bg-transparent">
                    <AvatarImage src={player.avatar} className="rounded-full object-cover border-2 border-felt-accent/50" />
                    <AvatarFallback className="bg-gray-900 text-white border-2 border-gray-700">
                        {player.name.substring(0, 2).toUpperCase()}
                    </AvatarFallback>
                </Avatar>
            </div>
        </div>
        
        {/* Player Name Plate */}
        <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 bg-black/80 border border-felt-accent/30 backdrop-blur-md px-3 py-1 rounded-sm flex flex-col items-center min-w-[90px] shadow-xl z-20">
            <span className="text-[10px] text-gray-400 uppercase tracking-wider font-bold">{player.name}</span>
            <span className="text-sm font-mono text-felt-accent font-bold leading-none">${player.chips.toLocaleString()}</span>
        </div>

      </div>

      {/* Cards - Positioned relative to the avatar but "on" the table */}
      {player.cards && (
        <div 
            className={cn(
                "flex gap-1 absolute transition-all duration-500",
                isHero 
                    ? "-top-24 scale-125 z-50" // Hero cards floating up clearly
                    : "top-[80%] scale-75 z-0 opacity-90" // Opponent cards tucked in
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
          <div className="absolute top-[140%] flex flex-col items-center gap-1">
             <div className="bg-black/60 px-2 py-0.5 rounded text-xs font-mono text-white border border-white/10">
                 {player.currentBet.toLocaleString()}
             </div>
             {/* 3D Chip Stack Simulation */}
             <div className="relative h-6 w-6">
                 <div className="absolute bottom-0 w-full h-full rounded-full bg-red-600 border-2 border-dashed border-white/50 shadow-lg transform translate-y-0" />
                 <div className="absolute bottom-1 w-full h-full rounded-full bg-red-600 border-2 border-dashed border-white/50 shadow-lg transform -translate-y-1" />
                 <div className="absolute bottom-2 w-full h-full rounded-full bg-red-600 border-2 border-dashed border-white/50 shadow-lg transform -translate-y-2" />
             </div>
          </div>
      )}
      
       {player.status === 'checked' && (
          <div className="absolute top-[120%] bg-black/60 rounded px-2 py-1 text-[10px] text-gray-300 font-bold uppercase tracking-wider border border-white/10">
             Check
          </div>
      )}
    </div>
  );
}
