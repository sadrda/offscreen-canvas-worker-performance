import * as THREE from "three";

/**
 * Builds a particle-field Three.js scene + renderer.
 *
 * The exact same factory runs on the main thread and inside the worker so the
 * two canvases render a provably identical workload. A `WebGLRenderer` accepts
 * either a real `HTMLCanvasElement` or a transferred `OffscreenCanvas`.
 */

const PARTICLE_COUNT = 80_000;

export interface ParticleScene {
  render(dtSeconds: number): void;
  resize(width: number, height: number): void;
}

export function createParticleScene(
  canvas: HTMLCanvasElement | OffscreenCanvas,
  width: number,
  height: number,
  dpr: number,
): ParticleScene {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
  renderer.setPixelRatio(dpr);
  renderer.setSize(width, height, false);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0a0a12);

  const camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 100);
  camera.position.z = 6;

  // Distribute points in a spherical shell with a per-point color gradient.
  const positions = new Float32Array(PARTICLE_COUNT * 3);
  const colors = new Float32Array(PARTICLE_COUNT * 3);
  const color = new THREE.Color();
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const r = 3 + Math.random() * 1.5;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    const x = r * Math.sin(phi) * Math.cos(theta);
    const y = r * Math.sin(phi) * Math.sin(theta);
    const z = r * Math.cos(phi);
    positions.set([x, y, z], i * 3);

    color.setHSL(0.55 + 0.15 * (y / r), 0.7, 0.55);
    colors.set([color.r, color.g, color.b], i * 3);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));

  const material = new THREE.PointsMaterial({
    size: 0.02,
    vertexColors: true,
    sizeAttenuation: true,
    transparent: true,
    opacity: 0.9,
  });

  const points = new THREE.Points(geometry, material);
  scene.add(points);

  return {
    render(dtSeconds: number) {
      // Delta-time driven so rotation speed is framerate-independent and the
      // two sides stay visually in sync regardless of their FPS.
      points.rotation.y += dtSeconds * 0.25;
      points.rotation.x += dtSeconds * 0.1;
      renderer.render(scene, camera);
    },
    resize(w: number, h: number) {
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h, false);
    },
  };
}
