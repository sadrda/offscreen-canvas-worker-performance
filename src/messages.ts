import type { StatsSnapshot } from "./frameStats";

/** Messages sent from the main thread to the worker. */
export type ToWorker =
  | {
      type: "init";
      canvas: OffscreenCanvas;
      width: number;
      height: number;
      dpr: number;
    }
  | { type: "resize"; width: number; height: number };

/** Messages sent from the worker back to the main thread. */
export type FromWorker = { type: "stats"; stats: StatsSnapshot };
