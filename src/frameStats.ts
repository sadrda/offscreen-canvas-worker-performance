/**
 * Lightweight per-context frame metrics tracker.
 *
 * Used identically on the main thread and inside the worker so both canvases
 * are measured the same way. Call `tick(now)` once per rendered frame.
 */

export interface StatsSnapshot {
  /** Rolling frames-per-second. */
  fps: number;
  /** Most recent frame delta in milliseconds. */
  lastMs: number;
  /** Average frame time over the rolling window, in milliseconds. */
  avgMs: number;
  /** Total frames whose delta blew the 60fps budget. */
  dropped: number;
}

// A frame "drops" when it takes longer than 1.5x the 60fps budget (~25ms).
const TARGET_FRAME_MS = 1000 / 60;
const DROP_THRESHOLD_MS = TARGET_FRAME_MS * 1.5;

export class FrameStats {
  private last = 0;
  private frames = 0;
  private accumMs = 0;
  private windowMs = 0;
  private dropped = 0;
  private snap: StatsSnapshot = { fps: 0, lastMs: 0, avgMs: 0, dropped: 0 };

  /** Record a frame at time `now` (a `performance.now()` value, in ms). */
  tick(now: number): void {
    if (this.last === 0) {
      this.last = now;
      return;
    }

    const delta = now - this.last;
    this.last = now;

    this.frames++;
    this.accumMs += delta;
    this.windowMs += delta;
    if (delta > DROP_THRESHOLD_MS) this.dropped++;

    if (this.windowMs >= 250) {
      this.snap = {
        fps: (this.frames * 1000) / this.windowMs,
        lastMs: delta,
        avgMs: this.accumMs / this.frames,
        dropped: this.dropped,
      };
      this.frames = 0;
      this.accumMs = 0;
      this.windowMs = 0;
    }
  }

  snapshot(): StatsSnapshot {
    return this.snap;
  }
}
