import { motion, AnimatePresence } from "framer-motion";
import { Trophy, Clock, Users, AlertTriangle } from "lucide-react";

interface TournamentAlert {
  id: string;
  type: "registration" | "starting" | "final_table" | "completed";
  title: string;
  message: string;
  timestamp: Date;
}

interface TournamentAlertsProps {
  alerts?: TournamentAlert[];
  className?: string;
}

const ALERT_CONFIG = {
  registration: { icon: Users, color: "#22c55e", label: "Registration" },
  starting: { icon: Clock, color: "#f59e0b", label: "Starting" },
  final_table: { icon: Trophy, color: "#d4af37", label: "Final Table" },
  completed: { icon: AlertTriangle, color: "#ef4444", label: "Completed" },
};

const MOCK_ALERTS: TournamentAlert[] = [
  { id: "1", type: "registration", title: "Final Table Marathon", message: "Registration closes in 15 min", timestamp: new Date() },
  { id: "2", type: "starting", title: "Weekly High Stakes", message: "Tournament starts in 5 min", timestamp: new Date(Date.now() - 120000) },
  { id: "3", type: "final_table", title: "Sunday Special", message: "Final table reached — 6 players remain", timestamp: new Date(Date.now() - 300000) },
];

export function TournamentAlerts({ alerts, className }: TournamentAlertsProps) {
  const items = alerts || MOCK_ALERTS;

  return (
    <div className={className}>
      <h3
        className="text-[0.625rem] font-black uppercase tracking-[0.15em] mb-3"
        style={{ color: "#d4af37" }}
      >
        Tournament Alerts
      </h3>
      <div className="space-y-2">
        <AnimatePresence>
          {items.map((alert) => {
            const config = ALERT_CONFIG[alert.type];
            const Icon = config.icon;
            return (
              <motion.div
                key={alert.id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="rounded-lg p-2.5"
                style={{
                  background: "rgba(15,15,20,0.8)",
                  border: `1px solid ${config.color}25`,
                  backdropFilter: "blur(8px)",
                }}
              >
                <div className="flex items-start gap-2">
                  <div
                    className="w-6 h-6 rounded flex items-center justify-center flex-shrink-0 mt-0.5"
                    style={{ background: `${config.color}15`, border: `1px solid ${config.color}30` }}
                  >
                    <Icon className="w-3 h-3" style={{ color: config.color }} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[0.6875rem] font-bold text-white/90 truncate">{alert.title}</p>
                    <p className="text-[0.625rem] text-white/50 mt-0.5">{alert.message}</p>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}
