import { useState, useEffect, useCallback } from "react";

export type ScreenTier = "small" | "medium" | "large" | "ultrawide";

export interface ScreenInfo {
  /** Viewport width in CSS pixels */
  width: number;
  /** Viewport height in CSS pixels */
  height: number;
  /** Device pixel ratio (1 = standard, 2 = retina, etc.) */
  dpr: number;
  /** Physical screen width approximation (viewport * DPR) */
  physicalWidth: number;
  /** Physical screen height approximation (viewport * DPR) */
  physicalHeight: number;
  /** Aspect ratio (width / height) */
  aspectRatio: number;
  /** Screen tier based on viewport width */
  tier: ScreenTier;
  /** Whether sidebars should be shown */
  showSidebars: boolean;
  /** Sidebar width in pixels (0 if hidden) */
  sidebarWidth: number;
  /** Avatar size in pixels */
  avatarSize: number;
  /** Base font scale multiplier (1 = default) */
  fontScale: number;
  /** Card size category for the Card component */
  cardSize: "sm" | "md" | "lg" | "xl" | "2xl" | "3xl";
  /** Table max height as vh */
  tableMaxHeight: string;
  /** Whether the screen is ultra-wide (21:9 or wider) */
  isUltrawide: boolean;
}

function computeScreenInfo(w: number, h: number, dpr: number): ScreenInfo {
  const aspectRatio = w / h;
  const isUltrawide = aspectRatio >= 2.1;

  let tier: ScreenTier;
  if (w < 1024) tier = "small";
  else if (w < 1600) tier = "medium";
  else if (w < 2560 && !isUltrawide) tier = "large";
  else tier = "ultrawide";

  // Sidebar visibility and width — hidden on smaller laptops to reduce clutter
  const showSidebars = w >= 1400;
  let sidebarWidth = 0;
  if (showSidebars) {
    if (tier === "ultrawide") sidebarWidth = Math.min(320, Math.round(w * 0.12));
    else if (tier === "large") sidebarWidth = Math.min(260, Math.round(w * 0.13));
    else sidebarWidth = 208; // w-52 = 208px
  }

  // Avatar size — scales with viewport
  let avatarSize: number;
  if (tier === "small") avatarSize = Math.max(48, Math.round(w * 0.05));
  else if (tier === "medium") avatarSize = Math.max(64, Math.round(w * 0.055));
  else if (tier === "large") avatarSize = Math.max(80, Math.round(w * 0.05));
  else avatarSize = Math.max(100, Math.round(w * 0.04));

  // Font scale
  let fontScale: number;
  if (tier === "small") fontScale = 0.85;
  else if (tier === "medium") fontScale = 1.0;
  else if (tier === "large") fontScale = 1.1;
  else fontScale = 1.2;

  // Card size — hero hole cards scale with screen (bumped up for visibility)
  let cardSize: "sm" | "md" | "lg" | "xl" | "2xl" | "3xl";
  if (tier === "small") cardSize = "lg";
  else if (tier === "medium") cardSize = "xl";
  else if (tier === "large") cardSize = "2xl";
  else cardSize = "3xl";

  // Table max height — give more room on tall screens, but cap to avoid overflow
  let tableMaxHeight: string;
  if (h < 700) tableMaxHeight = "62vh";
  else if (h < 900) tableMaxHeight = "68vh";
  else tableMaxHeight = "74vh";

  return {
    width: w,
    height: h,
    dpr,
    physicalWidth: Math.round(w * dpr),
    physicalHeight: Math.round(h * dpr),
    aspectRatio,
    tier,
    showSidebars,
    sidebarWidth,
    avatarSize,
    fontScale,
    cardSize,
    tableMaxHeight,
    isUltrawide,
  };
}

export function useScreenInfo(): ScreenInfo {
  const [info, setInfo] = useState<ScreenInfo>(() =>
    computeScreenInfo(
      typeof window !== "undefined" ? window.innerWidth : 1920,
      typeof window !== "undefined" ? window.innerHeight : 1080,
      typeof window !== "undefined" ? window.devicePixelRatio : 1
    )
  );

  const handleResize = useCallback(() => {
    setInfo(computeScreenInfo(window.innerWidth, window.innerHeight, window.devicePixelRatio));
  }, []);

  useEffect(() => {
    handleResize();
    window.addEventListener("resize", handleResize);
    // Also listen for DPR changes (e.g. moving to external monitor)
    const dprQuery = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
    dprQuery.addEventListener("change", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
      dprQuery.removeEventListener("change", handleResize);
    };
  }, [handleResize]);

  // Set CSS custom properties on the root element so CSS can also use these values
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--screen-w", `${info.width}px`);
    root.style.setProperty("--screen-h", `${info.height}px`);
    root.style.setProperty("--screen-dpr", `${info.dpr}`);
    root.style.setProperty("--avatar-size", `${info.avatarSize}px`);
    root.style.setProperty("--sidebar-w", `${info.sidebarWidth}px`);
    root.style.setProperty("--font-scale", `${info.fontScale}`);
  }, [info]);

  return info;
}
