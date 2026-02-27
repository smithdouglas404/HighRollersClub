import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Flame } from "lucide-react";

interface BombPotIndicatorProps {
  visible: boolean;
}

export function BombPotIndicator({ visible }: BombPotIndicatorProps) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (visible) {
      setShow(true);
      const timeout = setTimeout(() => setShow(false), 3000);
      return () => clearTimeout(timeout);
    } else {
      setShow(false);
    }
  }, [visible]);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, scale: 0.3 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.5, y: -40 }}
          transition={{ type: "spring", stiffness: 300, damping: 20 }}
          className="fixed inset-0 z-[90] flex items-center justify-center pointer-events-none"
        >
          {/* Radial explosion glow */}
          <motion.div
            className="absolute w-[600px] h-[600px] rounded-full"
            initial={{ scale: 0, opacity: 0.8 }}
            animate={{ scale: [0, 1.5, 1], opacity: [0.8, 0.3, 0] }}
            transition={{ duration: 1.5, ease: "easeOut" }}
            style={{
              background: "radial-gradient(circle, rgba(255,170,0,0.4) 0%, rgba(255,100,0,0.1) 40%, transparent 70%)",
            }}
          />

          {/* Secondary pulse ring */}
          <motion.div
            className="absolute w-[400px] h-[400px] rounded-full"
            animate={{
              scale: [1, 1.3, 1],
              opacity: [0.2, 0.05, 0.2],
            }}
            transition={{ repeat: Infinity, duration: 0.8 }}
            style={{
              border: "2px solid rgba(255,170,0,0.3)",
            }}
          />

          {/* Main content */}
          <div className="relative flex flex-col items-center gap-3">
            {/* Flame icons orbiting */}
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 3, ease: "linear" }}
              className="absolute w-32 h-32"
            >
              {[0, 90, 180, 270].map((deg) => (
                <motion.div
                  key={deg}
                  className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-4"
                  style={{
                    transformOrigin: "50% calc(50% + 64px)",
                    rotate: `${deg}deg`,
                  }}
                >
                  <Flame className="w-5 h-5 text-cyan-400 opacity-60" />
                </motion.div>
              ))}
            </motion.div>

            {/* Central icon */}
            <motion.div
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ repeat: Infinity, duration: 0.6 }}
              className="relative"
            >
              <div
                className="w-20 h-20 rounded-2xl flex items-center justify-center"
                style={{
                  background: "linear-gradient(135deg, rgba(255,170,0,0.3) 0%, rgba(255,100,0,0.15) 100%)",
                  border: "2px solid rgba(255,170,0,0.5)",
                  boxShadow: "0 0 60px rgba(255,170,0,0.3), 0 0 120px rgba(255,100,0,0.15)",
                }}
              >
                <Flame className="w-10 h-10 text-cyan-400" style={{ filter: "drop-shadow(0 0 8px rgba(255,170,0,0.6))" }} />
              </div>
            </motion.div>

            {/* Text */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="text-center"
            >
              <motion.h2
                animate={{ scale: [1, 1.05, 1] }}
                transition={{ repeat: Infinity, duration: 0.8 }}
                className="text-4xl font-black uppercase tracking-[0.2em]"
                style={{
                  background: "linear-gradient(180deg, #FFD700 0%, #FF8C00 50%, #FF4500 100%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  filter: "drop-shadow(0 0 20px rgba(255,170,0,0.5))",
                }}
              >
                BOMB POT!
              </motion.h2>
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4 }}
                className="text-sm font-bold uppercase tracking-wider text-cyan-500/60 mt-1"
              >
                Everyone is in the pot
              </motion.p>
            </motion.div>

            {/* Particle sparks */}
            {Array.from({ length: 8 }).map((_, i) => (
              <motion.div
                key={i}
                className="absolute w-1.5 h-1.5 rounded-full"
                style={{
                  background: i % 2 === 0 ? "#FFD700" : "#FF8C00",
                  boxShadow: `0 0 6px ${i % 2 === 0 ? "#FFD700" : "#FF8C00"}`,
                }}
                initial={{
                  x: 0,
                  y: 0,
                  opacity: 1,
                }}
                animate={{
                  x: Math.cos((i * Math.PI * 2) / 8) * 120,
                  y: Math.sin((i * Math.PI * 2) / 8) * 120,
                  opacity: [1, 0.6, 0],
                  scale: [1, 0.5, 0],
                }}
                transition={{
                  duration: 1.2,
                  delay: 0.2 + i * 0.05,
                  ease: "easeOut",
                }}
              />
            ))}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
