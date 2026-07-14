import type { ViewportState } from "@seekstar/core-schema";

export interface ExplorationRuntimeStatus {
  message: string;
  phase: "idle" | "generating" | "error";
  updatedAt: string;
}

export interface WorldSegmentAddress {
  key: string;
  x: number;
  y: number;
}

export function worldSegmentForViewport(viewport: ViewportState, width = 1200, height = 900): WorldSegmentAddress {
  const x = Math.round(viewport.x / width);
  const y = Math.round(viewport.y / height);
  return { x, y, key: `${x}:${y}` };
}
