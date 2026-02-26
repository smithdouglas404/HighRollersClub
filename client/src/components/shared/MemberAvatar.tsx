import { AVATAR_OPTIONS } from "@/components/poker/AvatarSelect";

interface MemberAvatarProps {
  avatarId: string | null;
  displayName: string;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}

const SIZE_CLASSES = {
  sm: "w-8 h-8",
  md: "w-11 h-11",
  lg: "w-14 h-14",
  xl: "w-[72px] h-[72px]",
};

export function MemberAvatar({ avatarId, displayName, size = "md", className = "" }: MemberAvatarProps) {
  const avatar = avatarId ? AVATAR_OPTIONS.find(a => a.id === avatarId) : null;
  const sizeClass = SIZE_CLASSES[size];

  const borderWidth = size === "xl" ? 3 : 2;
  const glowSpread = size === "xl" ? 18 : size === "lg" ? 14 : 12;
  const borderRadius = size === "xl" ? "rounded-2xl" : "rounded-full";

  if (avatar) {
    return (
      <div
        className={`${sizeClass} ${borderRadius} overflow-hidden shrink-0 ${className}`}
        style={{
          border: `${borderWidth}px solid ${avatar.borderColor}`,
          boxShadow: `0 0 ${glowSpread}px ${avatar.glowColor}`,
        }}
      >
        <img
          src={avatar.image}
          alt={avatar.name}
          className="w-full h-full object-cover"
        />
      </div>
    );
  }

  // Fallback: first-initial circle
  const fontSize = size === "sm" ? "text-[10px]" : size === "xl" ? "text-xl" : size === "lg" ? "text-base" : "text-sm";
  return (
    <div
      className={`${sizeClass} ${borderRadius} overflow-hidden flex items-center justify-center bg-gradient-to-br from-cyan-500/30 to-purple-500/30 shrink-0 ${className}`}
      style={{
        border: `${borderWidth}px solid rgba(0,240,255,0.3)`,
        boxShadow: `0 0 ${glowSpread}px rgba(0,200,255,0.2)`,
      }}
    >
      <span className={`font-bold text-white ${fontSize}`}>
        {(displayName || "?").charAt(0).toUpperCase()}
      </span>
    </div>
  );
}
