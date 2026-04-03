import { EffectComposer, Bloom, Vignette, ChromaticAberration } from "@react-three/postprocessing";
import { BlendFunction } from "postprocessing";
import * as THREE from "three";

interface PostFxProps {
  quality?: "low" | "medium" | "high" | "cinematic";
}

export function PostFx({ quality = "high" }: PostFxProps) {
  if (quality === "low") return null;

  const bloomIntensity = quality === "cinematic" ? 0.7 : quality === "high" ? 0.5 : 0.35;

  return (
    <EffectComposer multisampling={quality === "cinematic" ? 4 : 2}>
      <Bloom
        intensity={bloomIntensity}
        luminanceThreshold={0.7}
        luminanceSmoothing={0.2}
        mipmapBlur
      />
      <Vignette offset={0.35} darkness={0.55} blendFunction={BlendFunction.NORMAL} />
      {quality === "cinematic" && (
        <ChromaticAberration
          offset={new THREE.Vector2(0.0004, 0.0004)}
          blendFunction={BlendFunction.NORMAL}
          radialModulation={false}
          modulationOffset={0}
        />
      )}
    </EffectComposer>
  );
}
