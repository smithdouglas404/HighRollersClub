import { AVATAR_OPTIONS } from "@/components/poker/AvatarSelect";

interface MemberAvatarProps {
  avatarId: string | null;
  displayName: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const SIZE_CLASSES = {
  sm: "w-8 h-8",
  md: "w-11 h-11",
  lg: "w-14 h-14",
};

export function MemberAvatar({ avatarId, displayName, size = "md", className = "" }: MemberAvatarProps) {
  const avatar = avatarId ? AVATAR_OPTIONS.find(a => a.id === avatarId) : null;
  const sizeClass = SIZE_CLASSES[size];

  if (avatar) {
    return (
      <div
        className={`${sizeClass} rounded-full overflow-hidden shrink-0 ${className}`}
        style={{
          border: `2px solid ${avatar.borderColor}`,
          boxShadow: `0 0 12px ${avatar.glowColor}`,
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
  return (
    <div
      className={`${sizeClass} rounded-full overflow-hidden border-2 border-white/10 flex items-center justify-center bg-gradient-to-br from-cyan-500/30 to-purple-500/30 shadow-[0_0_12px_rgba(0,200,255,0.15)] shrink-0 ${className}`}
    >
      <span className={`font-bold text-white ${size === "sm" ? "text-[10px]" : size === "lg" ? "text-base" : "text-sm"}`}>
        {displayName.charAt(0).toUpperCase()}
      </span>
    </div>
  );
}
