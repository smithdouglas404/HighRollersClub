import { EffectComposer, Bloom, Vignette } from "@react-three/postprocessing";

/**
 * Blueprint Section 12 — Performance strategy
 * Bloom emphasizes focus points, not decoration.
 * Quality presets: low / medium / high / cinematic.
 */

interface PostFxProps {
  quality?: "low" | "medium" | "high" | "cinematic";
}

export function PostFx({ quality = "high" }: PostFxProps) {
  if (quality === "low") return null;

  const bloomIntensity = quality === "cinematic" ? 0.7 : quality === "high" ? 0.5 : 0.3;
  const bloomThreshold = quality === "cinematic" ? 0.6 : 0.7;

  return (
    <EffectComposer multisampling={quality === "cinematic" ? 4 : 2}>
      <Bloom
        intensity={bloomIntensity}
        luminanceThreshold={bloomThreshold}
        luminanceSmoothing={0.25}
        mipmapBlur
      />
      <Vignette offset={0.25} darkness={0.55} />
    </EffectComposer>
  );
}
