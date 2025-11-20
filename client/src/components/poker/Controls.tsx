import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { useState } from "react";

interface ControlsProps {
  onAction: (action: string, amount?: number) => void;
  minBet: number;
  maxBet: number;
}

export function PokerControls({ onAction, minBet, maxBet }: ControlsProps) {
  const [betAmount, setBetAmount] = useState(minBet);

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-gray-950 border-t border-gray-800 p-4 pb-8 flex flex-col gap-4 z-50">
      <div className="max-w-4xl mx-auto w-full flex flex-col gap-4">
        {/* Bet Slider */}
        <div className="flex items-center gap-4 px-4">
            <span className="text-xs font-mono text-gray-400">{minBet}</span>
            <Slider 
                defaultValue={[minBet]} 
                max={maxBet} 
                min={minBet} 
                step={10}
                className="flex-1"
                onValueChange={(val) => setBetAmount(val[0])}
            />
             <span className="text-xs font-mono text-gray-400">{maxBet}</span>
             <div className="bg-gray-800 px-3 py-1 rounded text-sm font-mono w-20 text-center">
                {betAmount}
             </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-center gap-3">
            <Button 
                variant="secondary" 
                size="lg" 
                className="min-w-[100px] font-bold bg-gray-800 hover:bg-gray-700 text-gray-200 border-b-4 border-gray-950 active:border-b-0 active:translate-y-1 transition-all"
                onClick={() => onAction('fold')}
            >
                Fold
            </Button>
            <Button 
                variant="secondary" 
                size="lg" 
                className="min-w-[100px] font-bold bg-gray-800 hover:bg-gray-700 text-gray-200 border-b-4 border-gray-950 active:border-b-0 active:translate-y-1 transition-all"
                onClick={() => onAction('check')}
            >
                Check
            </Button>
             <Button 
                size="lg" 
                className="min-w-[120px] font-bold bg-green-600 hover:bg-green-500 text-white border-b-4 border-green-800 active:border-b-0 active:translate-y-1 transition-all"
                onClick={() => onAction('call')}
            >
                Call
            </Button>
            <Button 
                size="lg" 
                className="min-w-[120px] font-bold bg-blue-600 hover:bg-blue-500 text-white border-b-4 border-blue-800 active:border-b-0 active:translate-y-1 transition-all"
                onClick={() => onAction('raise', betAmount)}
            >
                Raise {betAmount}
            </Button>
        </div>
      </div>
    </div>
  );
}
