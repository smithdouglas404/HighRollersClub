import { Link } from "wouter";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Lock, Smartphone, CreditCard, Bitcoin, Cpu, Users, Trophy } from "lucide-react";

// Assets
import lionLogo from '@assets/generated_images/Golden_Lion_Logo_for_Poker_Table_961614b0.png';
import serverBg from '@assets/generated_images/blurred_server_room_background.png';
import entropyHud from '@assets/generated_images/holographic_network_graph_green.png';
import allianceHud from '@assets/generated_images/holographic_player_alliance_ui.png';

export default function Landing() {
  return (
    <div className="min-h-screen bg-black text-white font-sans relative overflow-hidden selection:bg-cyan-500 selection:text-black">
      
      {/* Background Layer - Server Room */}
      <div className="absolute inset-0 z-0">
         <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/60 to-black/90 z-10" />
         <img 
            src={serverBg} 
            alt="Server Room" 
            className="w-full h-full object-cover opacity-40 blur-sm scale-110" 
         />
      </div>

      {/* Content Container - Centered Grid */}
      <div className="relative z-10 container mx-auto h-screen flex flex-col justify-center px-6 lg:px-12">
        
        <div className="w-full max-w-7xl mx-auto relative">
            
            {/* Diagonal Divider Line Effect - Positioned to split the content */}
            <div className="absolute left-[45%] -top-[50vh] -bottom-[50vh] w-[1px] bg-gradient-to-b from-transparent via-cyan-500/50 to-transparent skew-x-[-15deg] hidden lg:block z-0" />

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center relative z-10">
                
                {/* LEFT COLUMN - Hero Text */}
                <div className="lg:col-span-5 flex flex-col items-start space-y-6 pr-8">
                    {/* Logo Group */}
                    <motion.div 
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6 }}
                        className="flex flex-col items-start"
                    >
                        <div className="w-24 h-28 mb-6 relative">
                            <div className="absolute inset-0 bg-yellow-500/20 blur-xl rounded-full" />
                            {/* Shield/Lion Logo */}
                            <img src={lionLogo} alt="Lion Logo" className="w-full h-full object-contain drop-shadow-[0_0_15px_rgba(234,179,8,0.5)]" />
                        </div>
                        
                        <h1 className="text-6xl lg:text-7xl font-black tracking-tighter uppercase leading-[0.9]">
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
                        <h2 className="text-lg font-medium text-gray-200">Advanced Clubs & Leagues.</h2>
                        <h2 className="text-lg font-medium text-gray-400">Inter-Club Alliances. Real-Time Glory.</h2>
                    </motion.div>

                    <motion.div 
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6, delay: 0.4 }}
                        className="pt-4"
                    >
                        <Link href="/game">
                            <Button className="h-12 px-8 text-lg font-bold bg-[#00ff9d] hover:bg-[#00cc7d] text-black rounded-[4px] shadow-[0_0_30px_rgba(0,255,157,0.4)] tracking-wide uppercase transition-all hover:scale-105 border-0 cursor-pointer">
                                Play Now
                            </Button>
                        </Link>
                    </motion.div>
                </div>

                {/* RIGHT COLUMN - Feature Visualization */}
                <div className="lg:col-span-7 relative h-[500px] flex items-center justify-center lg:justify-end">
                    
                    {/* Card 1: Alliance UI (Left/Back) */}
                    <motion.div 
                        initial={{ opacity: 0, x: -30, y: 20 }}
                        animate={{ opacity: 1, x: 0, y: 0 }}
                        transition={{ duration: 0.8, delay: 0.3 }}
                        className="absolute left-0 lg:left-10 top-10 w-[320px] bg-black/60 backdrop-blur-md border border-cyan-500/20 rounded-xl overflow-hidden z-10 transform -rotate-2 hover:z-30 transition-all hover:scale-105"
                    >
                         {/* Header */}
                         <div className="flex items-center justify-between p-3 border-b border-white/10 bg-white/5">
                            <div className="flex items-center gap-2 text-cyan-400 text-[10px] font-mono uppercase">
                                <Users className="w-3 h-3" />
                                <span>Club Alliance Network</span>
                            </div>
                            <div className="flex gap-1">
                                <div className="w-1 h-1 bg-cyan-500 rounded-full" />
                                <div className="w-1 h-1 bg-cyan-500 rounded-full" />
                                <div className="w-1 h-1 bg-cyan-500 rounded-full" />
                            </div>
                         </div>
                         {/* Content Image */}
                         <div className="aspect-[4/3] relative">
                            <img src={allianceHud} className="w-full h-full object-cover opacity-90" />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
                            <div className="absolute bottom-3 left-3 right-3 flex justify-between items-end">
                                <div>
                                    <div className="text-[10px] text-gray-400">Total Members</div>
                                    <div className="text-lg font-bold text-white">2,849</div>
                                </div>
                                <div className="px-2 py-1 bg-cyan-500/20 rounded text-cyan-400 text-[10px] font-bold border border-cyan-500/30">ACTIVE</div>
                            </div>
                         </div>
                    </motion.div>

                    {/* Card 2: Entropy HUD (Right/Front) */}
                    <motion.div 
                        initial={{ opacity: 0, x: 30, y: -20 }}
                        animate={{ opacity: 1, x: 0, y: 0 }}
                        transition={{ duration: 0.8, delay: 0.5 }}
                        className="absolute right-0 lg:right-10 top-20 w-[340px] bg-black/60 backdrop-blur-md border border-[#00ff9d]/20 rounded-xl overflow-hidden z-20 transform rotate-2 shadow-2xl hover:scale-105 transition-all"
                    >
                         {/* Header */}
                         <div className="flex items-center justify-between p-3 border-b border-white/10 bg-white/5">
                            <div className="flex items-center gap-2 text-[#00ff9d] text-[10px] font-mono uppercase">
                                <Lock className="w-3 h-3" />
                                <span>HIKETI-SOLRBS ENTROPY</span>
                            </div>
                            <Lock className="w-3 h-3 text-[#00ff9d]" />
                         </div>
                         {/* Content Image */}
                         <div className="aspect-[16/9] relative bg-black/80">
                            <div className="absolute inset-0 bg-[linear-gradient(transparent_50%,rgba(0,255,157,0.05)_50%)] bg-[length:100%_4px] pointer-events-none z-10" />
                            <img src={entropyHud} className="w-full h-full object-cover opacity-80 mix-blend-screen" />
                            
                            {/* Floating Data Points */}
                            <div className="absolute top-4 right-4 flex flex-col items-end gap-1">
                                <div className="text-[8px] font-mono text-[#00ff9d] opacity-70">SHA-256 VERIFIED</div>
                                <div className="text-[8px] font-mono text-[#00ff9d] opacity-70">BLOCK #892101</div>
                            </div>
                         </div>
                    </motion.div>

                    {/* Central Lock Feature - Floating in middle/bottom */}
                    <motion.div 
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.6, delay: 0.7 }}
                        className="absolute -bottom-10 lg:bottom-0 left-1/2 lg:left-[40%] transform -translate-x-1/2 z-30 flex items-center gap-4 bg-black/80 border border-[#00ff9d]/30 rounded-lg p-4 backdrop-blur-xl shadow-[0_0_40px_rgba(0,255,157,0.1)]"
                    >
                         <div className="relative">
                            <div className="absolute inset-0 bg-[#00ff9d] blur-md opacity-40 animate-pulse" />
                            <Lock className="w-10 h-10 text-[#00ff9d] relative z-10" />
                         </div>
                         <div className="flex flex-col">
                            <div className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-0.5">Multi-Source Entropy</div>
                            <div className="text-lg font-bold text-white leading-none uppercase tracking-tight">Provably Fair Shuffle</div>
                            <div className="text-[9px] text-gray-500 font-mono mt-1">Fisher-Yates • Blockchain-Seeded</div>
                         </div>
                    </motion.div>

                </div>
            </div>
        </div>

        {/* FOOTER BAR */}
        <motion.div 
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.8 }}
            className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black via-black to-transparent h-24 flex items-end pb-6"
        >
            <div className="container mx-auto px-6 lg:px-12 flex flex-wrap items-center justify-center md:justify-between w-full max-w-7xl border-t border-white/10 pt-4">
                
                {/* Platform Icons */}
                <div className="flex items-center gap-6 text-white opacity-60 scale-90 origin-left">
                    <div className="flex items-center gap-1">
                        <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24"><path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-.98-.5-2.08-.52-3.08.06-1.2.6-2.15.54-3.08-.4C4.2 16.46 2.9 11.1 5.3 7.28c1.1-1.8 3.04-2.7 4.43-2.6 1.22.1 2.2.75 2.9.75.7 0 2.08-.8 3.34-.7 1.4.1 2.68.66 3.5 1.77-3.1 1.8-2.5 6.12.5 7.37-.67 1.76-1.6 3.5-2.92 6.4zm-4.6-17.2c.7-1 1.27-2.3 1.1-3.48-1.2.1-2.7 1.05-3.3 2.1-.5.8-.9 2.03.1 3.07.95.15 1.62-.7 2.1-1.7z"/></svg>
                        <span className="font-semibold text-xs">iOS</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <Smartphone className="w-5 h-5" />
                        <span className="font-semibold text-xs">Android</span>
                    </div>
                    <div className="h-3 w-[1px] bg-white/20 mx-2" />
                    <div className="flex items-center gap-1">
                         <span className="font-semibold text-xs">USDT</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <Bitcoin className="w-5 h-5" />
                    </div>
                    <div className="flex items-center gap-1">
                        <CreditCard className="w-5 h-5" />
                    </div>
                </div>

                {/* AI Badge */}
                <div className="flex items-center gap-3 mt-4 md:mt-0 opacity-80">
                    <div className="flex flex-col items-end text-right">
                        <span className="text-[8px] text-gray-500 uppercase tracking-widest">Powered By</span>
                        <span className="text-[10px] font-bold text-gray-300 uppercase tracking-widest">Adaptive AI</span>
                    </div>
                    <div className="w-8 h-8 border border-white/20 rounded flex items-center justify-center bg-white/5">
                        <Cpu className="w-4 h-4 text-white/80" />
                    </div>
                </div>

            </div>
        </motion.div>
      </div>
    </div>
  );
}
