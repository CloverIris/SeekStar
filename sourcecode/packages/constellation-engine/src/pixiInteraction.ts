import type { TerrainNode, ViewportState } from "@seekstar/core-schema";
import { resolveLayerForZoom } from "./lens.js";
export { resolveZoomForLayer } from "./lens.js";

export type CanvasTool = "pointer" | "pan" | "lens" | "lasso" | "brush";

export interface CanvasPoint {
  x: number;
  y: number;
}

export interface CanvasRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface LassoDraft {
  start: CanvasPoint;
  current: CanvasPoint;
}

export interface ViewportBounds {
  width: number;
  height: number;
}

const MIN_ZOOM = 0.55;
const MAX_ZOOM = 2.45;
const NODE_FIT_HALF_WIDTH = 120;
const NODE_FIT_HALF_HEIGHT = 70;
const DEFAULT_FIT_PADDING = 112;
export function clampZoom(zoom: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));
}

export function screenToWorld(point: CanvasPoint, viewport: ViewportState, bounds: ViewportBounds): CanvasPoint {
  return {
    x: viewport.x + (point.x - bounds.width / 2) / viewport.zoom,
    y: viewport.y + (point.y - bounds.height / 2) / viewport.zoom,
  };
}

export function worldToScreen(point: CanvasPoint, viewport: ViewportState, bounds: ViewportBounds): CanvasPoint {
  return {
    x: bounds.width / 2 + (point.x - viewport.x) * viewport.zoom,
    y: bounds.height / 2 + (point.y - viewport.y) * viewport.zoom,
  };
}

export function zoomViewportAtScreenPoint(
  viewport: ViewportState,
  point: CanvasPoint,
  bounds: ViewportBounds,
  nextZoom: number,
  options: { preserveLayer?: boolean } = {},
): ViewportState {
  const zoom = clampZoom(nextZoom);
  const worldBefore = screenToWorld(point, viewport, bounds);

  return {
    ...viewport,
    x: worldBefore.x - (point.x - bounds.width / 2) / zoom,
    y: worldBefore.y - (point.y - bounds.height / 2) / zoom,
    zoom,
    layer: options.preserveLayer ? viewport.layer : resolveLayerForZoom(zoom),
  };
}

export function normalizeRect(start: CanvasPoint, end: CanvasPoint): CanvasRect {
  const x = Math.min(start.x, end.x);
  const y = Math.min(start.y, end.y);

  return {
    x,
    y,
    width: Math.abs(end.x - start.x),
    height: Math.abs(end.y - start.y),
  };
}

export function rectContainsPoint(rect: CanvasRect, point: CanvasPoint): boolean {
  return point.x >= rect.x && point.x <= rect.x + rect.width && point.y >= rect.y && point.y <= rect.y + rect.height;
}

export function selectNodesInRect(nodes: TerrainNode[], rect: CanvasRect): string[] {
  return nodes
    .filter((node) => {
      const position = node.position_hint;

      if (!position) {
        return false;
      }

      return rectContainsPoint(rect, position);
    })
    .map((node) => node.id);
}

export function getNodeBounds(nodes: TerrainNode[], nodeIds?: string[]): CanvasRect | undefined {
  const allowedNodeIds = nodeIds ? new Set(nodeIds) : undefined;
  const positionedNodes = nodes.filter((node) => {
    if (!node.position_hint) {
      return false;
    }

    return allowedNodeIds ? allowedNodeIds.has(node.id) : true;
  });

  if (positionedNodes.length === 0) {
    return undefined;
  }

  const xs = positionedNodes.map((node) => node.position_hint?.x ?? 0);
  const ys = positionedNodes.map((node) => node.position_hint?.y ?? 0);
  const minX = Math.min(...xs) - NODE_FIT_HALF_WIDTH;
  const maxX = Math.max(...xs) + NODE_FIT_HALF_WIDTH;
  const minY = Math.min(...ys) - NODE_FIT_HALF_HEIGHT;
  const maxY = Math.max(...ys) + NODE_FIT_HALF_HEIGHT;

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

export function fitViewportToNodes(
  nodes: TerrainNode[],
  bounds: ViewportBounds,
  fallback: ViewportState,
  options: {
    maxZoom?: number;
    nodeIds?: string[];
    padding?: number;
    preserveLayer?: boolean;
  } = {},
): ViewportState {
  const nodeBounds = getNodeBounds(nodes, options.nodeIds);

  if (!nodeBounds) {
    return {
      ...fallback,
      x: 0,
      y: 0,
      zoom: 1,
      layer: resolveLayerForZoom(1),
    };
  }

  const padding = options.padding ?? DEFAULT_FIT_PADDING;
  const usableWidth = Math.max(1, bounds.width - padding * 2);
  const usableHeight = Math.max(1, bounds.height - padding * 2);
  const maxZoom = options.maxZoom ?? 1.15;
  const zoom = clampZoom(Math.min(maxZoom, usableWidth / nodeBounds.width, usableHeight / nodeBounds.height));

  return {
    ...fallback,
    x: nodeBounds.x + nodeBounds.width / 2,
    y: nodeBounds.y + nodeBounds.height / 2,
    zoom,
    layer: options.preserveLayer ? fallback.layer : resolveLayerForZoom(zoom),
  };
}

export function resetViewport(fallback: ViewportState): ViewportState {
  return {
    ...fallback,
    x: 0,
    y: 0,
    zoom: 1,
    layer: resolveLayerForZoom(1),
  };
}
