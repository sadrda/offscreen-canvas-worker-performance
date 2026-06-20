import "./style.css";
import { createParticleScene } from "./scene";
import { FrameStats, type StatsSnapshot } from "./frameStats";
import type { ToWorker, FromWorker } from "./messages";

const $ = <T extends HTMLElement>(id: string): T => {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing #${id}`);
  return el as T;
};

const leftCanvas = $<HTMLCanvasElement>("left-canvas");
const rightCanvas = $<HTMLCanvasElement>("right-canvas");
const rightFallback = $("right-fallback");
const loadSlider = $<HTMLInputElement>("load");
const loadValue = $("load-value");
const spinner = $("spinner");
const uiLagEl = $("ui-lag");

const TARGET_FRAME_MS = 1000 / 60;
const dpr = Math.min(window.devicePixelRatio || 1, 2);

/** Render a stats snapshot into the panel identified by `prefix`. */
function renderStats(prefix: "left" | "right", s: StatsSnapshot) {
  $(`${prefix}-fps`).textContent = s.fps.toFixed(0);
  $(`${prefix}-avg`).textContent = `${s.avgMs.toFixed(1)} ms`;
  $(`${prefix}-dropped`).textContent = String(s.dropped);
}

// --- Left side: render on the main thread -------------------------------
function sizeOf(canvas: HTMLCanvasElement): { w: number; h: number } {
  const rect = canvas.parentElement!.getBoundingClientRect();
  return { w: Math.max(1, Math.floor(rect.width)), h: Math.max(1, Math.floor(rect.height)) };
}

const left = sizeOf(leftCanvas);
const leftScene = createParticleScene(leftCanvas, left.w, left.h, dpr);
const leftStats = new FrameStats();

// --- Right side: render in a worker via OffscreenCanvas ------------------
let worker: Worker | null = null;
const supportsOffscreen =
  typeof rightCanvas.transferControlToOffscreen === "function";
if (supportsOffscreen) {
  const right = sizeOf(rightCanvas);
  const offscreen = rightCanvas.transferControlToOffscreen();
  worker = new Worker(new URL("./worker.ts", import.meta.url), {
    type: "module",
  });
  worker.onmessage = (e: MessageEvent<FromWorker>) => {
    if (e.data.type === "stats") renderStats("right", e.data.stats);
  };
  const init: ToWorker = {
    type: "init",
    canvas: offscreen,
    width: right.w,
    height: right.h,
    dpr,
  };
  worker.postMessage(init, [offscreen]);
} else {
  rightCanvas.hidden = true;
  rightFallback.hidden = false;
  rightFallback.textContent =
    "This browser does not support OffscreenCanvas (transferControlToOffscreen).";
}

// --- Controls: main-thread load slider ----------------------------------
let loadMs = 0;
loadSlider.addEventListener("input", () => {
  loadMs = Number(loadSlider.value);
  loadValue.textContent = `${loadMs} ms`;
});

// --- Main-thread loop ---------------------------------------------------
let lastFrame = 0;
let lastStatsPaint = 0;
let maxLagThisWindow = 0;
let spinnerAngle = 0;

function frame(now: number) {
  const dt = lastFrame === 0 ? 0 : (now - lastFrame) / 1000;
  // Gap between rAF callbacks beyond the ~16.7ms budget = UI lag.
  const lag = lastFrame === 0 ? 0 : now - lastFrame - TARGET_FRAME_MS;
  lastFrame = now;
  if (lag > maxLagThisWindow) maxLagThisWindow = lag;

  // Burn main-thread CPU to simulate heavy app work. This blocks the left
  // render, the UI, and the spinner — but never the worker.
  if (loadMs > 0) {
    const until = performance.now() + loadMs;
    while (performance.now() < until) {
      /* busy-wait */
    }
  }

  leftScene.render(dt);
  leftStats.tick(now);

  // The spinner is driven by main-thread JS (not CSS) so it visibly freezes
  // when the main thread is blocked — a real responsiveness indicator.
  spinnerAngle = (spinnerAngle + dt * 360) % 360;
  spinner.style.transform = `rotate(${spinnerAngle}deg)`;

  if (now - lastStatsPaint >= 250) {
    lastStatsPaint = now;
    renderStats("left", leftStats.snapshot());
    uiLagEl.textContent = Math.max(0, maxLagThisWindow).toFixed(1);
    maxLagThisWindow = 0;
  }

  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// --- Resize -------------------------------------------------------------
window.addEventListener("resize", () => {
  const l = sizeOf(leftCanvas);
  leftScene.resize(l.w, l.h);
  if (worker) {
    const r = sizeOf(rightCanvas);
    const msg: ToWorker = { type: "resize", width: r.w, height: r.h };
    worker.postMessage(msg);
  }
});
