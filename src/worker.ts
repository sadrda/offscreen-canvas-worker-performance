import { createParticleScene, type ParticleScene } from "./scene";
import { FrameStats } from "./frameStats";
import type { ToWorker, FromWorker } from "./messages";

let particleScene: ParticleScene | null = null;
const stats = new FrameStats();

let lastFrame = 0;
let lastPost = 0;

function post(msg: FromWorker) {
  (self as unknown as Worker).postMessage(msg);
}

function loop(now: number) {
  const dt = lastFrame === 0 ? 0 : (now - lastFrame) / 1000;
  lastFrame = now;

  particleScene?.render(dt);
  stats.tick(now);

  // Throttle metric posts to ~4x/sec so messaging overhead stays negligible.
  if (now - lastPost >= 250) {
    lastPost = now;
    post({ type: "stats", stats: stats.snapshot() });
  }

  requestAnimationFrame(loop);
}

self.onmessage = (e: MessageEvent<ToWorker>) => {
  const msg = e.data;
  if (msg.type === "init") {
    particleScene = createParticleScene(
      msg.canvas,
      msg.width,
      msg.height,
      msg.dpr,
    );
    requestAnimationFrame(loop);
  } else if (msg.type === "resize") {
    particleScene?.resize(msg.width, msg.height);
  }
};
