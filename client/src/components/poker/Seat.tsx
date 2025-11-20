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
      className="absolute transform -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-2"
      style={{ left: `${position.x}%`, top: `${position.y}%` }}
      data-testid={`seat-${player.id}`}
    >
      {/* Cards */}
      {player.cards && (
        <div className={cn(
            "flex gap-1 absolute transition-all duration-300",
            isHero ? "-top-16 scale-110" : "top-[60%] z-10 scale-90"
        )}>
          <Card card={player.cards[0]} />
          <Card card={player.cards[1]} />
        </div>
      )}

      {/* Avatar Ring */}
      <div className="relative">
        {isTurn && (
            <motion.div 
                className="absolute -inset-1 rounded-full border-2 border-yellow-400 z-0"
                animate={{ opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 1.5, repeat: Infinity }}
            />
        )}
        
        {/* Dealer Button */}
        {player.isDealer && (
            <div className="absolute -right-2 -top-2 w-5 h-5 bg-white rounded-full border border-gray-300 flex items-center justify-center text-[10px] font-bold z-20 shadow-sm text-black">
                D
            </div>
        )}

        <Avatar className={cn(
            "w-16 h-16 border-4 bg-background relative z-10",
            player.status === 'folded' ? "opacity-50 grayscale border-gray-700" : "border-gray-800",
            isTurn && "border-yellow-400"
        )}>
          <AvatarImage src={player.avatar} />
          <AvatarFallback className="bg-gray-800 text-white font-mono">
            {player.name.substring(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>

        {/* Timer Bar (Circular overlay or bar below) */}
        {isTurn && (
             <svg className="absolute inset-0 w-full h-full -rotate-90 z-20 pointer-events-none scale-110">
                <circle
                    cx="50%" cy="50%" r="48%"
                    fill="none"
                    stroke="hsl(var(--primary))"
                    strokeWidth="3"
                    strokeDasharray="100"
                    strokeDashoffset={100 - (player.timeLeft || 100)}
                    className="transition-all duration-1000 ease-linear"
                />
             </svg>
        )}
      </div>

      {/* Player Info Box */}
      <div className="bg-gray-900/90 backdrop-blur-sm rounded-md px-3 py-1 text-center min-w-[100px] border border-gray-800 shadow-lg z-20">
        <div className="text-xs font-medium text-gray-300 truncate max-w-[90px]">{player.name}</div>
        <div className="text-sm font-mono text-primary font-bold">
          {player.chips.toLocaleString()}
        </div>
      </div>
      
      {/* Current Bet / Action Label */}
      {player.currentBet > 0 && (
          <div className="absolute top-full mt-2 bg-black/60 rounded-full px-3 py-0.5 text-xs text-white font-mono flex items-center gap-1">
             <div className="w-3 h-3 rounded-full bg-yellow-500 border border-yellow-600" />
             {player.currentBet.toLocaleString()}
          </div>
      )}
      
       {player.status === 'checked' && (
          <div className="absolute top-full mt-2 bg-black/60 rounded-full px-3 py-0.5 text-xs text-gray-300 font-bold uppercase tracking-wider">
             Check
          </div>
      )}
    </div>
  );
}
