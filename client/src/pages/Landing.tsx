import { Link } from "wouter";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Lock, Smartphone, CreditCard, Bitcoin, Cpu } from "lucide-react";

// Assets
import lionLogo from '@assets/generated_images/Golden_Lion_Logo_for_Poker_Table_961614b0.png';
import serverBg from '@assets/generated_images/blurred_server_room_background.png';
import entropyHud from '@assets/generated_images/holographic_entropy_network_hud.png';

export default function Landing() {
  return (
    <div className="min-h-screen bg-black text-white font-sans relative overflow-hidden selection:bg-cyan-500 selection:text-black">
      
      {/* Background Layer - Server Room */}
      <div className="absolute inset-0 z-0">
         <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/60 to-black/90 z-10" />
         <img 
            src={serverBg} 
            alt="Server Room" 
            className="w-full h-full object-cover opacity-50 blur-sm scale-110" 
         />
      </div>

      {/* Content Container */}
      <div className="relative z-10 container mx-auto h-screen flex flex-col justify-center px-6 lg:px-12">
        
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center w-full max-w-7xl mx-auto">
            
            {/* LEFT COLUMN - Hero Text */}
            <div className="lg:col-span-5 flex flex-col items-start space-y-8">
                {/* Logo Group */}
                <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6 }}
                    className="flex flex-col items-start"
                >
                    <div className="w-24 h-24 mb-6 relative">
                        <div className="absolute inset-0 bg-yellow-500/20 blur-xl rounded-full" />
                        <img src={lionLogo} alt="Lion Logo" className="w-full h-full object-contain drop-shadow-[0_0_15px_rgba(234,179,8,0.5)]" />
                    </div>
                    
                    <h1 className="text-6xl md:text-7xl font-black tracking-tighter uppercase leading-[0.9]">
                        <span className="block text-white">Build Your</span>
                        <span className="block text-transparent bg-clip-text bg-gradient-to-b from-white to-gray-400">Poker Empire</span>
                    </h1>
                </motion.div>

                <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 0.2 }}
                    className="space-y-1"
                >
                    <h2 className="text-xl md:text-2xl font-medium text-gray-200">Advanced Clubs & Leagues.</h2>
                    <h2 className="text-xl md:text-2xl font-medium text-gray-400">Inter-Club Alliances. Real-Time Glory.</h2>
                </motion.div>

                <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 0.4 }}
                >
                    <Link href="/game">
                        <Button className="h-14 px-10 text-xl font-bold bg-[#00ff9d] hover:bg-[#00cc7d] text-black rounded-md shadow-[0_0_30px_rgba(0,255,157,0.4)] tracking-wide uppercase transition-all hover:scale-105 hover:shadow-[0_0_50px_rgba(0,255,157,0.6)] border-0 cursor-pointer">
                            Play Now
                        </Button>
                    </Link>
                </motion.div>
            </div>

            {/* RIGHT COLUMN - Feature Visualization */}
            <div className="lg:col-span-7 relative">
                
                {/* Diagonal Divider Line Effect */}
                <div className="absolute -left-12 top-0 bottom-0 w-[1px] bg-gradient-to-b from-transparent via-cyan-500/50 to-transparent skew-x-[-15deg] hidden lg:block" />

                <div className="grid grid-cols-1 gap-8">
                    {/* HUD Card */}
                    <motion.div 
                        initial={{ opacity: 0, x: 50 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.8, delay: 0.3 }}
                        className="relative bg-black/40 backdrop-blur-md border border-cyan-500/30 rounded-xl p-1 overflow-hidden group"
                    >
                        {/* Scanline */}
                        <div className="absolute inset-0 bg-[linear-gradient(transparent_50%,rgba(0,255,157,0.05)_50%)] bg-[length:100%_4px] pointer-events-none z-20" />
                        
                        <div className="relative z-10 bg-black/60 rounded-lg p-6 border border-white/5">
                             <div className="flex items-center justify-between mb-4 border-b border-white/10 pb-2">
                                <div className="flex items-center gap-2 text-cyan-400 text-xs font-mono">
                                    <Lock className="w-3 h-3" />
                                    <span>HIKETI-SOLRBS ENTROPY</span>
                                </div>
                                <div className="w-2 h-2 bg-cyan-500 rounded-full animate-pulse" />
                             </div>
                             
                             {/* Entropy HUD Image */}
                             <div className="aspect-[2/1] bg-black/50 rounded border border-cyan-500/20 mb-4 relative overflow-hidden">
                                <img src={entropyHud} alt="Entropy Visualization" className="w-full h-full object-cover opacity-80 mix-blend-screen" />
                             </div>

                             <div className="flex items-start gap-4">
                                <div className="p-3 bg-[#00ff9d]/10 rounded-lg border border-[#00ff9d]/30 shadow-[0_0_15px_rgba(0,255,157,0.15)]">
                                    <Lock className="w-8 h-8 text-[#00ff9d]" />
                                </div>
                                <div>
                                    <h3 className="text-white font-bold text-lg uppercase tracking-wider">Multi-Source Entropy</h3>
                                    <h3 className="text-white font-bold text-2xl uppercase tracking-tighter leading-none mb-1">Provably Fair Shuffle</h3>
                                    <p className="text-gray-400 font-mono text-xs">Fisher-Yates. Blockchain-Seeded. Verifiable.</p>
                                </div>
                             </div>
                        </div>
                    </motion.div>

                    {/* 3D Table Preview (Partial/Background element) */}
                    <div className="absolute -bottom-20 -left-20 right-0 h-40 bg-gradient-to-r from-transparent via-[#0f2e35] to-transparent blur-2xl opacity-40 z-0 pointer-events-none" />
                </div>
            </div>
        </div>

        {/* FOOTER BAR */}
        <motion.div 
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.8 }}
            className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black via-black to-transparent h-32 flex items-end pb-8"
        >
            <div className="container mx-auto px-6 lg:px-12 flex flex-wrap items-center justify-center md:justify-between w-full max-w-7xl border-t border-white/10 pt-6">
                
                {/* Platform Icons */}
                <div className="flex items-center gap-6 text-white opacity-80">
                    <div className="flex items-center gap-1">
                        <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24"><path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-.98-.5-2.08-.52-3.08.06-1.2.6-2.15.54-3.08-.4C4.2 16.46 2.9 11.1 5.3 7.28c1.1-1.8 3.04-2.7 4.43-2.6 1.22.1 2.2.75 2.9.75.7 0 2.08-.8 3.34-.7 1.4.1 2.68.66 3.5 1.77-3.1 1.8-2.5 6.12.5 7.37-.67 1.76-1.6 3.5-2.92 6.4zm-4.6-17.2c.7-1 1.27-2.3 1.1-3.48-1.2.1-2.7 1.05-3.3 2.1-.5.8-.9 2.03.1 3.07.95.15 1.62-.7 2.1-1.7z"/></svg>
                        <span className="font-semibold text-sm">iOS</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <Smartphone className="w-5 h-5" />
                        <span className="font-semibold text-sm">Android</span>
                    </div>
                    <div className="h-4 w-[1px] bg-white/20 mx-2" />
                    <div className="flex items-center gap-1">
                         <span className="font-semibold text-sm">USDT</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <Bitcoin className="w-5 h-5" />
                    </div>
                    <div className="flex items-center gap-1">
                        <CreditCard className="w-5 h-5" />
                    </div>
                </div>

                {/* AI Badge */}
                <div className="flex items-center gap-3 mt-4 md:mt-0">
                    <div className="flex flex-col items-end text-right">
                        <span className="text-[10px] text-gray-500 uppercase tracking-widest">Powered By</span>
                        <span className="text-xs font-bold text-gray-300 uppercase tracking-widest">Adaptive AI</span>
                    </div>
                    <div className="w-10 h-10 border border-white/20 rounded flex items-center justify-center bg-white/5">
                        <Cpu className="w-6 h-6 text-white/80" />
                    </div>
                </div>

            </div>
        </motion.div>
      </div>
    </div>
  );
}
