import { CARD_CLASSES, CARD_HOVER, HEADING_SM } from "@/lib/design-tokens";

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  trend?: { value: string; positive: boolean };
  className?: string;
}

export function StatCard({ icon, label, value, trend, className }: StatCardProps) {
  return (
    <div className={`${CARD_CLASSES} ${CARD_HOVER} p-4 flex flex-col gap-2 ${className || ""}`}>
      <div className="flex items-center justify-between">
        <span className={HEADING_SM}>{label}</span>
        <span className="text-gray-400">{icon}</span>
      </div>
      <div className="text-2xl font-black text-white">{value}</div>
      {trend && (
        <span className={`text-xs font-semibold ${trend.positive ? "text-green-400" : "text-red-400"}`}>
          {trend.positive ? "+" : ""}{trend.value}
        </span>
      )}
    </div>
  );
}
