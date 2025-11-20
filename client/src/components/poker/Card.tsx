import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { CardType, Suit, Rank } from "@/lib/poker-types";

interface CardProps {
  card?: CardType;
  className?: string;
  size?: "sm" | "md" | "lg";
}

const suitIcons: Record<Suit, string> = {
  hearts: "♥",
  diamonds: "♦",
  clubs: "♣",
  spades: "♠",
};

const suitColors: Record<Suit, string> = {
  hearts: "text-red-500",
  diamonds: "text-blue-500", // Four-color deck style for better visibility
  clubs: "text-green-600",
  spades: "text-gray-900",
};

export function Card({ card, className, size = "md" }: CardProps) {
  const sizeClasses = {
    sm: "w-8 h-12 text-xs",
    md: "w-12 h-16 text-sm",
    lg: "w-16 h-24 text-lg",
  };

  if (!card || card.hidden) {
    return (
      <motion.div
        layout
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className={cn(
          "relative bg-blue-900 rounded-[4px] border-2 border-white shadow-sm flex items-center justify-center overflow-hidden",
          sizeClasses[size],
          className
        )}
      >
        <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle,_var(--tw-gradient-stops))] from-white to-transparent" />
        <div className="w-full h-full bg-[url('https://www.transparenttextures.com/patterns/diagmonds-light.png')] opacity-50" />
      </motion.div>
    );
  }

  return (
    <motion.div
      layout
      initial={{ rotateY: 90 }}
      animate={{ rotateY: 0 }}
      className={cn(
        "relative bg-white rounded-[4px] shadow-md flex flex-col justify-between p-1 select-none",
        sizeClasses[size],
        className
      )}
    >
      <div className={cn("font-bold leading-none", suitColors[card.suit])}>
        <span className="block">{card.rank}</span>
        <span className="block text-[0.8em]">{suitIcons[card.suit]}</span>
      </div>
      <div className={cn("absolute inset-0 flex items-center justify-center opacity-10 text-4xl", suitColors[card.suit])}>
        {suitIcons[card.suit]}
      </div>
      <div className={cn("font-bold leading-none transform rotate-180", suitColors[card.suit])}>
        <span className="block text-[0.8em]">{suitIcons[card.suit]}</span>
        <span className="block">{card.rank}</span>
      </div>
    </motion.div>
  );
}
