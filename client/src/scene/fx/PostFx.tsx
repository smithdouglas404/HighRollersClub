import { EffectComposer, Bloom, Vignette } from "@react-three/postprocessing";

/**
 * Restrained post-processing — bloom for emissive accents only, subtle vignette.
 * Bloom targets seat rings and gold ring, NOT full-scene neon wash.
 */
interface PostFxProps {
  quality?: "low" | "medium" | "high" | "cinematic";
}

export function PostFx({ quality = "high" }: PostFxProps) {
  if (quality === "low") return null;

  const bloomIntensity = quality === "cinematic" ? 0.6 : quality === "high" ? 0.45 : 0.3;
  const bloomThreshold = 0.85; // Only bright emissive elements bloom
  const bloomRadius = 0.4;

  return (
    <EffectComposer multisampling={quality === "cinematic" ? 4 : 2}>
      <Bloom
        intensity={bloomIntensity}
        luminanceThreshold={bloomThreshold}
        luminanceSmoothing={0.15}
        radius={bloomRadius}
        mipmapBlur
      />
      <Vignette
        offset={0.3}
        darkness={0.5}
      />
    </EffectComposer>
  );
}
