/**
 * Premium shared components for the Neon Vault design system.
 * Built with GSAP, Framer Motion, and Tailwind — matching the Stitch reference screens.
 */

import { useRef, useEffect, useState, type ReactNode } from "react";
import { motion } from "framer-motion";
import gsap from "gsap";

// ─── Gold Metallic Button (matches the CREATE CLUB full-width gold bar) ──────
export function GoldButton({
  children,
  onClick,
  disabled,
  className = "",
  fullWidth = false,
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
  fullWidth?: boolean;
}) {
  const btnRef = useRef<HTMLButtonElement>(null);

  return (
    <button
      ref={btnRef}
      onClick={onClick}
      disabled={disabled}
      className={`relative overflow-hidden font-black uppercase tracking-wider text-black
        ${fullWidth ? "w-full" : ""} px-6 py-3.5 rounded-lg
        disabled:opacity-40 disabled:cursor-not-allowed
        transition-all hover:shadow-[0_0_30px_rgba(212,175,55,0.4)]
        active:scale-[0.98] ${className}`}
      style={{
        background: "linear-gradient(135deg, #8a6914 0%, #c9a227 20%, #f3e2ad 50%, #d4af37 80%, #8a6914 100%)",
        backgroundSize: "200% 100%",
        textShadow: "0 1px 2px rgba(0,0,0,0.3)",
      }}
      onMouseEnter={() => {
        if (btnRef.current && !disabled) {
          gsap.to(btnRef.current, { backgroundPosition: "100% 0", duration: 0.6, ease: "power2.out" });
        }
      }}
      onMouseLeave={() => {
        if (btnRef.current) {
          gsap.to(btnRef.current, { backgroundPosition: "0% 0", duration: 0.4, ease: "power2.out" });
        }
      }}
    >
      {/* Shimmer sweep */}
      <div
        className="absolute inset-0 pointer-events-none opacity-0 hover:opacity-100 transition-opacity"
        style={{
          background: "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.3) 50%, transparent 100%)",
          animation: "shimmer 2s infinite",
        }}
      />
      <span className="relative z-10">{children}</span>
    </button>
  );
}

// ─── Gold Card with animated border glow ─────────────────────────────────────
export function GoldCard({
  children,
  className = "",
  hover = true,
  glow = false,
  padding = "p-6",
}: {
  children: ReactNode;
  className?: string;
  hover?: boolean;
  glow?: boolean;
  padding?: string;
}) {
  return (
    <motion.div
      whileHover={hover ? { scale: 1.01, y: -2 } : undefined}
      className={`relative rounded-xl ${padding} ${className}`}
      style={{
        background: "linear-gradient(145deg, rgba(20,17,12,0.9) 0%, rgba(15,12,8,0.95) 100%)",
        border: "1px solid rgba(212,175,55,0.2)",
        boxShadow: glow
          ? "0 0 20px rgba(212,175,55,0.15), inset 0 1px 0 rgba(212,175,55,0.1)"
          : "inset 0 1px 0 rgba(255,255,255,0.05)",
        backdropFilter: "blur(20px)",
        transition: "border-color 0.3s, box-shadow 0.3s",
      }}
      onMouseEnter={(e) => {
        if (hover) {
          (e.currentTarget as HTMLElement).style.borderColor = "rgba(212,175,55,0.4)";
          (e.currentTarget as HTMLElement).style.boxShadow = "0 0 25px rgba(212,175,55,0.2), inset 0 1px 0 rgba(212,175,55,0.15)";
        }
      }}
      onMouseLeave={(e) => {
        if (hover) {
          (e.currentTarget as HTMLElement).style.borderColor = "rgba(212,175,55,0.2)";
          (e.currentTarget as HTMLElement).style.boxShadow = glow
            ? "0 0 20px rgba(212,175,55,0.15), inset 0 1px 0 rgba(212,175,55,0.1)"
            : "inset 0 1px 0 rgba(255,255,255,0.05)";
        }
      }}
    >
      {children}
    </motion.div>
  );
}

// ─── Animated Number Ticker (GSAP-powered, for chip counts, revenue, etc.) ───
export function NumberTicker({
  value,
  prefix = "",
  suffix = "",
  className = "",
  duration = 1.5,
}: {
  value: number;
  prefix?: string;
  suffix?: string;
  className?: string;
  duration?: number;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const prevValue = useRef(0);

  useEffect(() => {
    if (!ref.current) return;
    const obj = { val: prevValue.current };
    gsap.to(obj, {
      val: value,
      duration,
      ease: "power2.out",
      onUpdate: () => {
        if (ref.current) {
          ref.current.textContent = `${prefix}${Math.round(obj.val).toLocaleString()}${suffix}`;
        }
      },
    });
    prevValue.current = value;
  }, [value, prefix, suffix, duration]);

  return (
    <span ref={ref} className={className}>
      {prefix}{value.toLocaleString()}{suffix}
    </span>
  );
}

// ─── Gold Section Divider (thick gold gradient line) ─────────────────────────
export function GoldDivider({ className = "" }: { className?: string }) {
  return (
    <div
      className={`h-[2px] w-full my-6 ${className}`}
      style={{
        background: "linear-gradient(90deg, transparent 0%, rgba(212,175,55,0.4) 20%, rgba(212,175,55,0.6) 50%, rgba(212,175,55,0.4) 80%, transparent 100%)",
      }}
    />
  );
}

// ─── Gold Section Header ─────────────────────────────────────────────────────
export function SectionHeader({
  icon: Icon,
  title,
  subtitle,
  className = "",
}: {
  icon?: any;
  title: string;
  subtitle?: string;
  className?: string;
}) {
  return (
    <div className={`mb-4 ${className}`}>
      <div className="flex items-center gap-2">
        {Icon && (
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: "rgba(212,175,55,0.1)", border: "1px solid rgba(212,175,55,0.2)" }}
          >
            <Icon className="w-4 h-4" style={{ color: "#d4af37" }} />
          </div>
        )}
        <h2
          className="text-sm font-black uppercase tracking-wider"
          style={{
            background: "linear-gradient(180deg, #f0d060 0%, #d4af37 50%, #9a7b2c 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}
        >
          {title}
        </h2>
      </div>
      {subtitle && <p className="text-xs text-gray-500 mt-1 ml-10">{subtitle}</p>}
    </div>
  );
}

// ─── Vault Background (golden bokeh/blur behind content) ─────────────────────
export function VaultBackground({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`relative min-h-screen ${className}`} style={{ background: "#0d0b08" }}>
      {/* Golden bokeh orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div
          className="absolute top-[-10%] right-[15%] w-[500px] h-[500px] rounded-full blur-[150px]"
          style={{ background: "rgba(212,175,55,0.04)" }}
        />
        <div
          className="absolute bottom-[-5%] left-[10%] w-[400px] h-[400px] rounded-full blur-[120px]"
          style={{ background: "rgba(180,140,30,0.03)" }}
        />
        <div
          className="absolute top-[30%] left-[50%] w-[600px] h-[300px] rounded-full blur-[180px]"
          style={{ background: "rgba(212,175,55,0.02)" }}
        />
      </div>
      {/* Subtle vault grid pattern overlay */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.03]"
        style={{
          backgroundImage: `linear-gradient(rgba(212,175,55,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(212,175,55,0.3) 1px, transparent 1px)`,
          backgroundSize: "60px 60px",
        }}
      />
      <div className="relative z-10">{children}</div>
    </div>
  );
}

// ─── Stat Card (gold-bordered stat display for dashboards) ───────────────────
export function StatCard({
  label,
  value,
  trend,
  trendUp,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  trend?: string;
  trendUp?: boolean;
  icon?: any;
}) {
  return (
    <GoldCard padding="p-4" glow>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[0.625rem] uppercase tracking-wider text-gray-500 font-semibold">{label}</p>
          <p className="text-2xl font-black text-white mt-1">
            {typeof value === "number" ? <NumberTicker value={value} prefix="$" /> : value}
          </p>
          {trend && (
            <p className={`text-[0.625rem] mt-1 font-semibold ${trendUp ? "text-green-400" : "text-red-400"}`}>
              {trendUp ? "↑" : "↓"} {trend}
            </p>
          )}
        </div>
        {Icon && (
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: "rgba(212,175,55,0.08)", border: "1px solid rgba(212,175,55,0.15)" }}
          >
            <Icon className="w-4 h-4" style={{ color: "#d4af37" }} />
          </div>
        )}
      </div>
    </GoldCard>
  );
}

// ─── 3D Tilt Card (Aceternity-style mouse-tracking tilt) ─────────────────────
export function TiltCard({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  const cardRef = useRef<HTMLDivElement>(null);

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const rotateX = ((y - centerY) / centerY) * -8;
    const rotateY = ((x - centerX) / centerX) * 8;

    gsap.to(cardRef.current, {
      rotateX,
      rotateY,
      duration: 0.3,
      ease: "power2.out",
      transformPerspective: 1000,
    });
  };

  const handleMouseLeave = () => {
    if (!cardRef.current) return;
    gsap.to(cardRef.current, {
      rotateX: 0,
      rotateY: 0,
      duration: 0.5,
      ease: "elastic.out(1, 0.5)",
    });
  };

  return (
    <div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className={`relative ${className}`}
      style={{ transformStyle: "preserve-3d" }}
    >
      {children}
    </div>
  );
}

// ─── Spotlight Effect (mouse-following spotlight glow on card) ────────────────
export function SpotlightCard({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isHovering, setIsHovering] = useState(false);

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    setPosition({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  };

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
      className={`relative overflow-hidden rounded-xl ${className}`}
      style={{
        background: "linear-gradient(145deg, rgba(20,17,12,0.9) 0%, rgba(15,12,8,0.95) 100%)",
        border: "1px solid rgba(212,175,55,0.2)",
      }}
    >
      {/* Spotlight glow */}
      {isHovering && (
        <div
          className="absolute pointer-events-none transition-opacity duration-300"
          style={{
            width: 300,
            height: 300,
            left: position.x - 150,
            top: position.y - 150,
            background: "radial-gradient(circle, rgba(212,175,55,0.15) 0%, transparent 70%)",
            filter: "blur(20px)",
          }}
        />
      )}
      <div className="relative z-10">{children}</div>
    </div>
  );
}

// ─── CSS Keyframe for shimmer (add to index.css or inline) ───────────────────
// @keyframes shimmer { 0% { transform: translateX(-100%); } 100% { transform: translateX(100%); } }
