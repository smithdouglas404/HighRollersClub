import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, Bell, X } from "lucide-react";

type Priority = "normal" | "important" | "urgent";

interface BreakingNewsModalProps {
  title: string;
  message: string;
  priority?: Priority;
  onClose: () => void;
}

const PRIORITY_STYLES: Record<Priority, { border: string; icon: typeof Bell; iconColor: string; pulse: boolean }> = {
  normal:    { border: "border-amber-500/50",  icon: Bell,          iconColor: "text-amber-400",  pulse: false },
  important: { border: "border-amber-500/50", icon: AlertTriangle, iconColor: "text-amber-400", pulse: false },
  urgent:    { border: "border-red-500/50",   icon: AlertTriangle, iconColor: "text-red-400",   pulse: true },
};

export function BreakingNewsModal({ title, message, priority = "normal", onClose }: BreakingNewsModalProps) {
  const [visible, setVisible] = useState(true);
  const style = PRIORITY_STYLES[priority];
  const Icon = style.icon;

  // Auto-dismiss after 8 seconds
  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false);
      onClose();
    }, 8000);
    return () => clearTimeout(timer);
  }, [onClose]);

  const dismiss = () => {
    setVisible(false);
    onClose();
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm"
          onClick={dismiss}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ duration: 0.25 }}
            onClick={(e) => e.stopPropagation()}
            className={`relative max-w-md w-full mx-4 rounded-xl bg-surface-low border-2 ${style.border} p-6 shadow-2xl ${
              style.pulse ? "animate-pulse" : ""
            }`}
          >
            {/* Close button */}
            <button
              onClick={dismiss}
              className="absolute top-3 right-3 p-1 rounded-lg hover:bg-white/10 transition-colors"
            >
              <X className="w-4 h-4 text-gray-400" />
            </button>

            {/* Icon */}
            <div className="flex items-center gap-3 mb-4">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                priority === "urgent" ? "bg-red-500/15" : priority === "important" ? "bg-amber-500/15" : "bg-amber-500/15"
              }`}>
                <Icon className={`w-5 h-5 ${style.iconColor}`} />
              </div>
              <h3 className="text-base font-display font-bold text-white tracking-tight">
                {title}
              </h3>
            </div>

            {/* Message */}
            <p className="text-sm text-gray-300 leading-relaxed mb-5">
              {message}
            </p>

            {/* Dismiss button */}
            <button
              onClick={dismiss}
              className="w-full py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider bg-white/10 text-white border border-white/10 hover:bg-white/15 transition-all"
            >
              Dismiss
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
