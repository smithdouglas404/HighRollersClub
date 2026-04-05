import { cn } from "@/lib/utils";

interface TablePreviewThumbnailProps {
  size?: number;
  isLive?: boolean;
  playerCount?: number;
  maxPlayers?: number;
  className?: string;
}

export function TablePreviewThumbnail({
  size = 64,
  isLive = false,
  playerCount,
  maxPlayers,
  className,
}: TablePreviewThumbnailProps) {
  return (
    <div
      className={cn("relative flex-shrink-0 group", className)}
      style={{ width: size, height: size }}
    >
      <img
        src="/images/generated/table-preview-thumb.png"
        alt="Table preview"
        className="w-full h-full rounded-full object-cover"
        style={{
          border: "2px solid rgba(212,175,55,0.4)",
          boxShadow: "0 0 12px rgba(212,175,55,0.15)",
        }}
        draggable={false}
      />
      {/* Hover glow */}
      <div
        className="absolute inset-0 rounded-full opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
        style={{
          boxShadow: "0 0 20px rgba(212,175,55,0.3), inset 0 0 10px rgba(212,175,55,0.1)",
        }}
      />
      {/* LIVE badge */}
      {isLive && (
        <div
          className="absolute -top-1 -right-1 flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[0.5rem] font-black uppercase tracking-wider"
          style={{
            background: "rgba(10,10,12,0.9)",
            border: "1px solid rgba(34,197,94,0.5)",
            color: "#22c55e",
          }}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" style={{ willChange: "opacity" }} />
          LIVE
        </div>
      )}
      {/* Player count */}
      {playerCount !== undefined && maxPlayers !== undefined && (
        <div
          className="absolute -bottom-1 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full text-[0.5625rem] font-mono font-bold"
          style={{
            background: "rgba(10,10,12,0.9)",
            border: "1px solid rgba(212,175,55,0.3)",
            color: "#d4af37",
          }}
        >
          {playerCount}/{maxPlayers}
        </div>
      )}
    </div>
  );
}
