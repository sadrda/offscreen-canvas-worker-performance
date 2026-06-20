# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm run dev` — start the Vite dev server (HMR).
- `npm run build` — type-check (`tsc`) then produce a production build with Vite. This is also the only type-checking step; there is no separate lint command, so run `npx tsc --noEmit` for a fast type check without bundling.
- `npm run preview` — serve the production build locally.

There is no test suite. Verification is done by running the app and observing the two canvases / metrics in a browser (WebGL required).

## What this project is

A side-by-side performance demo comparing Three.js rendering on the **main thread** (left canvas) versus inside a **Web Worker via `OffscreenCanvas`** (right canvas). A slider burns CPU on the main thread each frame; the point is that the left canvas + page UI stutter while the worker canvas stays smooth. Per-canvas metrics (FPS, avg frame time, dropped frames) plus a main-thread "UI lag" readout quantify the divergence.

## Architecture

The central design goal is a **fair comparison**, achieved by sharing the exact same code between the two execution contexts:

- `src/scene.ts` — `createParticleScene(canvas, w, h, dpr)` builds the Three.js particle field + `WebGLRenderer`. A `WebGLRenderer` accepts either an `HTMLCanvasElement` (main) or a transferred `OffscreenCanvas` (worker), so this one factory runs unchanged in both contexts. Rotation is delta-time driven so motion speed is framerate-independent and the two sides stay visually in sync regardless of their FPS.
- `src/frameStats.ts` — `FrameStats` class, instantiated per context. `tick(now)` each frame; `snapshot()` returns `{ fps, lastMs, avgMs, dropped }`. A frame is "dropped" when its delta exceeds ~1.5× the 60fps budget (~25ms). `dropped` is a cumulative running total that never resets.
- `src/worker.ts` — receives the transferred `OffscreenCanvas` via an `init` message, runs its own `requestAnimationFrame` loop with `createParticleScene` + `FrameStats`, and posts metric snapshots back ~4×/sec (throttled to keep messaging overhead negligible).
- `src/main.ts` — entry point. Builds the left scene directly; for the right side calls `rightCanvas.transferControlToOffscreen()` and spawns the worker via `new Worker(new URL("./worker.ts", import.meta.url), { type: "module" })` (Vite's module-worker pattern). Its main-thread rAF loop also runs the **load slider's busy-wait** (the deliberate CPU hog), measures rAF-gap "UI lag", and drives a JS-animated spinner (intentionally main-thread-driven, not CSS, so it visibly freezes when blocked). Falls back to a message if `transferControlToOffscreen` is unavailable.
- `src/messages.ts` — the typed `postMessage` contract (`ToWorker` / `FromWorker`) shared by `main.ts` and `worker.ts`.

Data flow: main thread owns the DOM and renders the left side + all metric panels; the worker owns only the right canvas and reports numbers back over the message channel.

## TypeScript constraints (from tsconfig.json)

- `verbatimModuleSyntax` is on — import types with `import type { ... }` (see how `messages.ts` / `scene.ts` are imported).
- `erasableSyntaxOnly` — no runtime-emitting TS constructs (no `enum`, no parameter properties, no namespaces); use plain types/unions.
- `noUnusedLocals` / `noUnusedParameters` are enforced and will fail the build.
- The `in`-operator narrowing pitfall: feature-detect `OffscreenCanvas` via `typeof rightCanvas.transferControlToOffscreen === "function"` rather than `"transferControlToOffscreen" in rightCanvas`, which narrows the canvas to `never` in the else branch.
