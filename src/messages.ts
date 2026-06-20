import type { StatsSnapshot } from "./frameStats";

export type ToWorker =
  | {
      type: "init";
      canvas: OffscreenCanvas;
      width: number;
      height: number;
      dpr: number;
    }
  | { type: "resize"; width: number; height: number };

export type FromWorker = { type: "stats"; stats: StatsSnapshot };
