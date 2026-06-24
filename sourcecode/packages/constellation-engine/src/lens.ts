import { getDeepZoomLayerStops } from "@seekstar/core-schema";
import type { LayerId } from "@seekstar/core-schema";

const ZOOM_LAYERS: Array<{ id: LayerId; zoom: number }> = getDeepZoomLayerStops();

export function resolveZoomForLayer(layer: LayerId): number {
  return ZOOM_LAYERS.find((candidate) => candidate.id === layer)?.zoom ?? 1;
}

export function resolveLayerForZoom(zoom: number): LayerId {
  return ZOOM_LAYERS.reduce((closest, layer) =>
    Math.abs(layer.zoom - zoom) < Math.abs(closest.zoom - zoom) ? layer : closest,
  ).id;
}
