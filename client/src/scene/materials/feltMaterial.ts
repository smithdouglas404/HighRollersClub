import * as THREE from "three";

/**
 * Blueprint Section 10 — Felt material
 * Colors from poker-table-ui.html:
 *   radial-gradient(circle at 50% 45%, #1d8b59 0%, #145f3c 42%, #0d452d 85%)
 *
 * Rich woven look, subtle procedural noise, center-bright edge-dark.
 */
export function createFeltMaterial(): THREE.MeshStandardMaterial {
  const mat = new THREE.MeshStandardMaterial({
    color: new THREE.Color("#1d8b59"),
    roughness: 0.88,
    metalness: 0.0,
    side: THREE.FrontSide,
  });

  mat.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader.replace(
      "#include <common>",
      `#include <common>
       varying vec3 vWorldPos;`
    );
    shader.vertexShader = shader.vertexShader.replace(
      "#include <worldpos_vertex>",
      `#include <worldpos_vertex>
       vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;`
    );

    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <common>",
      `#include <common>
       varying vec3 vWorldPos;

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
       }`
    );

    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <dithering_fragment>",
      `#include <dithering_fragment>

       // Elliptical radial distance for vignette (matches poker-table-ui.html radial-gradient)
       float dx = vWorldPos.x / 2.28;
       float dz = vWorldPos.z / 1.5;
       float ellipseDist = sqrt(dx * dx + dz * dz);

       // Three-stop gradient from HTML: #1d8b59 (0%) → #145f3c (42%) → #0d452d (85%)
       vec3 center = vec3(0.114, 0.545, 0.349);   // #1d8b59
       vec3 mid    = vec3(0.078, 0.373, 0.235);   // #145f3c
       vec3 edge   = vec3(0.051, 0.271, 0.176);   // #0d452d

       vec3 feltGrad;
       if (ellipseDist < 0.42) {
         feltGrad = mix(center, mid, ellipseDist / 0.42);
       } else {
         feltGrad = mix(mid, edge, clamp((ellipseDist - 0.42) / 0.43, 0.0, 1.0));
       }

       // Woven felt texture — fine grain
       float weave1 = sin(vWorldPos.x * 200.0) * 0.5 + 0.5;
       float weave2 = sin(vWorldPos.z * 200.0) * 0.5 + 0.5;
       float weave = mix(weave1, weave2, 0.5);
       float grain = feltNoise(vWorldPos.xz * 350.0);
       float texture = mix(weave, grain, 0.45);
       float texEffect = mix(0.94, 1.0, texture);

       // Grid overlay from HTML (32px pattern, subtle)
       float gridX = abs(fract(vWorldPos.x * 6.0) - 0.5);
       float gridZ = abs(fract(vWorldPos.z * 6.0) - 0.5);
       float grid = 1.0 - smoothstep(0.48, 0.5, gridX) * 0.06 - smoothstep(0.48, 0.5, gridZ) * 0.04;
       // Mask grid to inner area
       float gridMask = 1.0 - smoothstep(0.5, 0.85, ellipseDist);
       grid = mix(1.0, grid, gridMask * 0.22);

       // Inset shadow from HTML: inset 0 0 80px rgba(0,0,0,0.3)
       float innerShadow = 1.0 - smoothstep(0.6, 1.0, ellipseDist) * 0.3;

       gl_FragColor.rgb = feltGrad * texEffect * grid * innerShadow;
       gl_FragColor.rgb = max(gl_FragColor.rgb, vec3(0.0));`
    );
  };

  return mat;
}
