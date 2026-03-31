import * as THREE from "three";

/**
 * Premium felt material — green baize with center-bright / edge-dark falloff.
 * Uses custom onBeforeCompile to inject radial gradient into the standard material.
 * Target palette: #1d8b59 (center) → #145f3c (mid) → #0d452d (edge)
 */
export function createFeltMaterial(): THREE.MeshStandardMaterial {
  const mat = new THREE.MeshStandardMaterial({
    color: new THREE.Color("#145f3c"),
    roughness: 0.92,
    metalness: 0.0,
    side: THREE.FrontSide,
  });

  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uCenter = { value: new THREE.Color("#1d8b59") };
    shader.uniforms.uMid = { value: new THREE.Color("#145f3c") };
    shader.uniforms.uEdge = { value: new THREE.Color("#0d452d") };

    // Inject varyings
    shader.vertexShader = shader.vertexShader.replace(
      "#include <common>",
      `#include <common>
       varying vec2 vFeltUv;`
    );
    shader.vertexShader = shader.vertexShader.replace(
      "#include <begin_vertex>",
      `#include <begin_vertex>
       vFeltUv = position.xz;`
    );

    // Inject fragment color modulation
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <common>",
      `#include <common>
       uniform vec3 uCenter;
       uniform vec3 uMid;
       uniform vec3 uEdge;
       varying vec2 vFeltUv;`
    );
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <color_fragment>",
      `#include <color_fragment>
       // Radial distance from center (0 at center, 1 at edge)
       float dist = length(vFeltUv) / 1.8; // normalized to ellipse semi-axis
       dist = clamp(dist, 0.0, 1.0);

       // Three-stop gradient: center → mid → edge
       vec3 feltColor;
       if (dist < 0.42) {
         feltColor = mix(uCenter, uMid, dist / 0.42);
       } else {
         feltColor = mix(uMid, uEdge, (dist - 0.42) / 0.58);
       }

       // Subtle noise for woven felt texture
       float noise = fract(sin(dot(vFeltUv * 80.0, vec2(12.9898, 78.233))) * 43758.5453);
       feltColor += (noise - 0.5) * 0.012;

       diffuseColor.rgb = feltColor;`
    );
  };

  return mat;
}
