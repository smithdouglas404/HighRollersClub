import { Shield, CheckCircle, Lock, Terminal, Download, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

export function ProvablyFairPanel() {
  return (
    <div className="w-80 bg-black/80 backdrop-blur-md border-l border-green-500/30 h-full flex flex-col text-green-400 font-mono text-xs z-40 pointer-events-auto">
      <div className="p-4 border-b border-green-500/30 flex items-center justify-between bg-green-900/10">
        <div className="flex items-center gap-2">
          <CheckCircle className="w-5 h-5 text-green-400" />
          <div className="flex flex-col">
             <span className="font-bold text-sm text-white">Shuffle Verified: True</span>
             <span className="text-[10px] opacity-70">0x73..........59</span>
          </div>
        </div>
        <Button variant="ghost" size="icon" className="h-6 w-6 hover:bg-green-500/20">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
        </Button>
      </div>

      <ScrollArea className="flex-1 p-4">
        <div className="space-y-6">
            
            {/* Entropy Source Section */}
            <div className="space-y-2">
                <div className="text-white font-bold flex items-center gap-2">
                    <Lock className="w-3 h-3" /> Entropy Source
                </div>
                <div className="bg-black/50 rounded p-2 border border-green-500/20 space-y-1">
                    <div className="flex items-center gap-2">
                        <Shield className="w-3 h-3" /> 
                        <span>Server Hardware RNG</span>
                    </div>
                    <div className="flex items-center gap-2 pl-5 opacity-50">
                        <span>User Device Input</span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                            <Shield className="w-3 h-3" /> 
                            <span>Chainlink VRF</span>
                        </div>
                        <Button size="sm" variant="outline" className="h-5 text-[10px] border-green-500/30 hover:bg-green-500/20 text-green-400">
                            COPY
                        </Button>
                    </div>
                </div>
            </div>

             {/* Verification Details */}
             <div className="space-y-2">
                <div className="text-white font-bold flex items-center gap-2">
                    <Terminal className="w-3 h-3" /> Verification Data
                </div>
                
                <div className="space-y-2">
                    <div className="bg-black/50 p-2 rounded border border-green-500/20 cursor-pointer hover:bg-green-500/10 transition-colors flex items-center gap-2">
                        <CheckCircle className="w-3 h-3" />
                        <span>Commitment Hash</span>
                    </div>
                    <div className="bg-black/50 p-2 rounded border border-green-500/20 cursor-pointer hover:bg-green-500/10 transition-colors flex items-center gap-2">
                        <Eye className="w-3 h-3" />
                        <span>Reveal Seed</span>
                    </div>
                     <div className="bg-black/50 p-2 rounded border border-green-500/20 cursor-pointer hover:bg-green-500/10 transition-colors flex items-center gap-2">
                        <Download className="w-3 h-3" />
                        <span>Download Verification Script</span>
                    </div>
                </div>
            </div>

             {/* Logs Mockup */}
            <div className="pt-4 border-t border-green-500/20">
                <div className="text-[10px] opacity-50 font-mono space-y-1">
                    <p>{'>'} Initializing Fisher-Yates...</p>
                    <p>{'>'} Slicing deck [0..52]</p>
                    <p>{'>'} Hashing seed...</p>
                    <p className="text-green-300">{'>'} Verified block #892102</p>
                </div>
            </div>

        </div>
      </ScrollArea>

      <div className="p-2 border-t border-green-500/30 bg-black/40 text-[10px] text-center opacity-60">
         Algorithm: Fisher Yates + (QuadResidue)
      </div>
    </div>
  );
}
