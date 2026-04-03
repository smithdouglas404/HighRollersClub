import { create } from "zustand";

/**
 * Blueprint Section 7 — scene slice + UI slice
 * Controls camera, quality, visual state, and UI panel toggles.
 */

type CameraMode = "hero_overview" | "replay_focus" | "showdown_focus" | "verification_focus";
type QualityLevel = "low" | "medium" | "high" | "cinematic";

interface SceneStore {
  // Scene slice
  cameraMode: CameraMode;
  bloomStrength: number;
  qualityLevel: QualityLevel;
  selectedSeat: number;
  hoveredSeat: number;
  showAmbientFx: boolean;

  // UI slice
  selectedPanel: string;
  actionLogExpanded: boolean;
  verificationExpanded: boolean;
  tooltipsEnabled: boolean;

  // Scene actions
  setCameraMode: (mode: CameraMode) => void;
  setBloomStrength: (strength: number) => void;
  setQualityLevel: (level: QualityLevel) => void;
  setSelectedSeat: (seat: number) => void;
  setHoveredSeat: (seat: number) => void;
  setShowAmbientFx: (show: boolean) => void;

  // UI actions
  setSelectedPanel: (panel: string) => void;
  setActionLogExpanded: (expanded: boolean) => void;
  setVerificationExpanded: (expanded: boolean) => void;
  setTooltipsEnabled: (enabled: boolean) => void;

  reset: () => void;
}

const initialState = {
  cameraMode: "hero_overview" as CameraMode,
  bloomStrength: 0.45,
  qualityLevel: "high" as QualityLevel,
  selectedSeat: -1,
  hoveredSeat: -1,
  showAmbientFx: true,
  selectedPanel: "",
  actionLogExpanded: true,
  verificationExpanded: false,
  tooltipsEnabled: true,
};

export const useSceneStore = create<SceneStore>((set) => ({
  ...initialState,

  setCameraMode: (cameraMode) => set({ cameraMode }),
  setBloomStrength: (bloomStrength) => set({ bloomStrength }),
  setQualityLevel: (qualityLevel) => set({ qualityLevel }),
  setSelectedSeat: (selectedSeat) => set({ selectedSeat }),
  setHoveredSeat: (hoveredSeat) => set({ hoveredSeat }),
  setShowAmbientFx: (showAmbientFx) => set({ showAmbientFx }),

  setSelectedPanel: (selectedPanel) => set({ selectedPanel }),
  setActionLogExpanded: (actionLogExpanded) => set({ actionLogExpanded }),
  setVerificationExpanded: (verificationExpanded) =>
    set({ verificationExpanded }),
  setTooltipsEnabled: (tooltipsEnabled) => set({ tooltipsEnabled }),

  reset: () => set(initialState),
}));
