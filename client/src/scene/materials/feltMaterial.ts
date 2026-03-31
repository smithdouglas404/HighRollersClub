import * as THREE from "three";

/**
 * Premium felt material — MeshStandardMaterial with onBeforeCompile injection.
 *
 * Keeps full PBR lighting (diffuse, shadows, AO) while adding:
 * - Radial gradient: #1d8b59 (center) → #145f3c (mid) → #0d452d (edge)
 * - Procedural felt noise: ±8% brightness variation from fiber texture
 * - Roughness variation: 0.88-0.96 for woven light response
 * - No tiling: noise is world-space at scale 60
 *
 * Uses CircleGeometry UVs (center=0.5,0.5 → edge=0/1) for the radial gradient.
 */
export function createFeltMaterial(): THREE.MeshStandardMaterial {
  const mat = new THREE.MeshStandardMaterial({
    color: new THREE.Color("#145f3c"), // mid-tone base (shader overrides this)
    roughness: 0.92,
    metalness: 0.0,
    side: THREE.FrontSide,
  });

  mat.onBeforeCompile = (shader) => {
    // Inject noise function and uniforms
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <common>",
      /* glsl */ `
      #include <common>

      // 2-octave procedural noise for felt fiber texture
      float feltHash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
      }
      float feltNoise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        float a = feltHash(i);
        float b = feltHash(i + vec2(1.0, 0.0));
        float c = feltHash(i + vec2(0.0, 1.0));
        float d = feltHash(i + vec2(1.0, 1.0));
        return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
      }
      float feltFBM(vec2 p) {
        float v = 0.0;
        v += 0.6 * feltNoise(p);
        v += 0.4 * feltNoise(p * 2.1 + 50.0);
        return v;
      }
      `
    );

    // Inject gradient + noise into diffuse color (after color_fragment which sets diffuseColor)
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <color_fragment>",
      /* glsl */ `
      #include <color_fragment>

      // Radial gradient from CircleGeometry UVs
      float feltDist = length((vUv - 0.5) * 2.0);

      vec3 feltCenter = vec3(0.114, 0.545, 0.349); // #1d8b59
      vec3 feltMid    = vec3(0.078, 0.373, 0.235); // #145f3c
      vec3 feltEdge   = vec3(0.051, 0.271, 0.176); // #0d452d

      vec3 feltColor;
      if (feltDist < 0.45) {
        feltColor = mix(feltCenter, feltMid, smoothstep(0.0, 0.45, feltDist));
      } else {
        feltColor = mix(feltMid, feltEdge, smoothstep(0.45, 1.0, feltDist));
      }

      // Edge darkening (inset shadow)
      feltColor *= mix(1.0, 0.65, smoothstep(0.7, 1.0, feltDist));

      // Procedural felt fiber noise — world-space, scale 60, no tiling
      vec2 feltNoiseCoord = vUv * 60.0;
      float feltFiber = feltFBM(feltNoiseCoord);
      feltColor *= 0.92 + 0.16 * feltFiber;

      diffuseColor.rgb = feltColor;
      `
    );

    // Inject roughness variation from same noise (after roughnessmap_fragment)
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <roughnessmap_fragment>",
      /* glsl */ `
      #include <roughnessmap_fragment>
      // Roughness variation from felt fiber pattern
      float feltRoughNoise = feltFBM(vUv * 60.0 + 30.0);
      roughnessFactor = mix(0.88, 0.96, feltRoughNoise);
      `
    );
  };

  return mat;
}
