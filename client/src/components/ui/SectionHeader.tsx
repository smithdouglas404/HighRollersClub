import { HEADING_LG, HEADING_SM } from "@/lib/design-tokens";

interface SectionHeaderProps {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  className?: string;
}

export function SectionHeader({ icon, title, subtitle, className }: SectionHeaderProps) {
  return (
    <div className={`flex items-center gap-3 ${className || ""}`}>
      <span className="text-primary">{icon}</span>
      <div>
        <h2 className={HEADING_LG}>{title}</h2>
        {subtitle && <p className={HEADING_SM}>{subtitle}</p>}
      </div>
    </div>
  );
}
