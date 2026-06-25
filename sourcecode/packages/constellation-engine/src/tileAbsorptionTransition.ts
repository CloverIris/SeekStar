import type { TileAbsorptionTrigger, ViewportState } from "@seekstar/core-schema";
import { resolveZoomForLayer } from "./lens.js";
import type { ProjectionRect, ProjectionViewportBounds, TerrainTileSurface } from "./pixiRuntime.js";

export interface TileAbsorptionTransitionInput {
  surface: TerrainTileSurface;
  viewport: ViewportState;
  viewportBounds: ProjectionViewportBounds;
  trigger: TileAbsorptionTrigger;
  topInsetPx?: number;
  durationMs?: number;
}

export interface TileAbsorptionTransition {
  nodeId: string;
  trigger: TileAbsorptionTrigger;
  durationMs: number;
  fromScreenBounds: ProjectionRect;
  targetScreenBounds: ProjectionRect;
  targetViewport: ViewportState;
  completedEvent: {
    type: "tile.absorption.entered";
    nodeId: string;
    trigger: TileAbsorptionTrigger;
  };
}

const DEFAULT_ABSORPTION_DURATION_MS = 260;
const DEFAULT_BROWSER_EXIT_LABEL_HEIGHT = 34;

export function createTileAbsorptionTransition(input: TileAbsorptionTransitionInput): TileAbsorptionTransition {
  const topInsetPx = input.topInsetPx ?? DEFAULT_BROWSER_EXIT_LABEL_HEIGHT;
  const targetBounds = {
    x: 0,
    y: topInsetPx,
    width: Math.max(1, input.viewportBounds.width),
    height: Math.max(1, input.viewportBounds.height - topInsetPx),
  };
  const surfaceCenter = {
    x: input.surface.worldBounds.x + input.surface.worldBounds.width / 2,
    y: input.surface.worldBounds.y + input.surface.worldBounds.height / 2,
  };

  return {
    nodeId: input.surface.nodeId,
    trigger: input.trigger,
    durationMs: input.durationMs ?? DEFAULT_ABSORPTION_DURATION_MS,
    fromScreenBounds: input.surface.screenBounds ?? projectWorldRect(input.surface.worldBounds, input.viewport, input.viewportBounds),
    targetScreenBounds: targetBounds,
    targetViewport: {
      ...input.viewport,
      x: surfaceCenter.x,
      y: surfaceCenter.y,
      layer: input.surface.layer,
      zoom: Math.max(input.viewport.zoom, resolveZoomForLayer(input.surface.layer)),
    },
    completedEvent: {
      type: "tile.absorption.entered",
      nodeId: input.surface.nodeId,
      trigger: input.trigger,
    },
  };
}

function projectWorldRect(rect: ProjectionRect, viewport: ViewportState, bounds: ProjectionViewportBounds): ProjectionRect {
  return {
    x: bounds.width / 2 + (rect.x - viewport.x) * viewport.zoom,
    y: bounds.height / 2 + (rect.y - viewport.y) * viewport.zoom,
    width: rect.width * viewport.zoom,
    height: rect.height * viewport.zoom,
  };
}
