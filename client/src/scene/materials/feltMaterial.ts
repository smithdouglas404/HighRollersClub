import * as THREE from "three";

export function createFeltMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uColor1: { value: new THREE.Color("#1d8b59") },
      uColor2: { value: new THREE.Color("#145f3c") },
      uColor3: { value: new THREE.Color("#0d452d") },
      uTime: { value: 0 },
    },
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vWorldPos;
      varying vec3 vNormal;
      void main() {
        vUv = uv;
        vNormal = normalize(normalMatrix * normal);
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorldPos = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: `
      uniform vec3 uColor1;
      uniform vec3 uColor2;
      uniform vec3 uColor3;
      uniform float uTime;
      varying vec2 vUv;
      varying vec3 vWorldPos;
      varying vec3 vNormal;

      float hash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
      }

      float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        float a = hash(i);
        float b = hash(i + vec2(1.0, 0.0));
        float c = hash(i + vec2(0.0, 1.0));
        float d = hash(i + vec2(1.0, 1.0));
        return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
      }

      float fbm(vec2 p) {
        float v = 0.0;
        float a = 0.5;
        for (int i = 0; i < 4; i++) {
          v += a * noise(p);
          p *= 2.0;
          a *= 0.5;
        }
        return v;
      }

      void main() {
        float dist = length(vWorldPos.xz) / 2.4;
        dist = clamp(dist, 0.0, 1.0);

        vec3 col = mix(uColor1, uColor2, smoothstep(0.0, 0.55, dist));
        col = mix(col, uColor3, smoothstep(0.55, 1.0, dist));

        float fiber = fbm(vWorldPos.xz * 45.0);
        float fiber2 = fbm(vWorldPos.xz * 90.0 + 100.0);
        float weave = mix(fiber, fiber2, 0.4);
        col *= 0.88 + weave * 0.24;

        float centerGlow = 1.0 - smoothstep(0.0, 0.7, dist);
        col += vec3(0.02, 0.06, 0.03) * centerGlow;

        float lightResponse = max(0.0, dot(vNormal, normalize(vec3(0.0, 1.0, 0.3))));
        col *= 0.7 + lightResponse * 0.5;

        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
}
