import { Card } from "./Card";
import { CardType } from "@/lib/poker-types";

interface CommunityCardsProps {
  cards: CardType[];
  pot: number;
}

export function CommunityCards({ cards, pot }: CommunityCardsProps) {
  return (
    <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-4 z-10">
        {/* Pot Display */}
        <div className="bg-black/40 backdrop-blur-md rounded-full px-6 py-1.5 border border-white/10 text-green-400 font-mono font-bold shadow-lg mb-2">
            POT: {pot.toLocaleString()}
        </div>

        {/* Cards Layout */}
        <div className="flex gap-2 p-3 rounded-xl bg-black/20 border border-white/5 shadow-2xl backdrop-blur-sm">
            {[0, 1, 2, 3, 4].map((i) => (
                <div key={i} className="w-12 h-16 sm:w-14 sm:h-20">
                    {cards[i] ? (
                        <Card card={cards[i]} size="md" className="w-full h-full" />
                    ) : (
                        <div className="w-full h-full rounded-[4px] bg-white/5 border-2 border-dashed border-white/10" />
                    )}
                </div>
            ))}
        </div>
    </div>
  );
}
