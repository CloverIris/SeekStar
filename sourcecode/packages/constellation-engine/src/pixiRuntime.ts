import { getLayerFocalBand, isMacroLayer, isTileLayer } from "@seekstar/core-schema";
import type { LayerId, ScoutObservation, SourceState, TerrainNode, TerrainRelation, TerrainScene, ViewportState } from "@seekstar/core-schema";
import { resolveZoomForLayer } from "./lens.js";

export interface TerrainPixiProjection {
  candidateTileSurfaces: CandidateTileSurface[];
  candidateObservations: ScoutObservation[];
  mainContent: MainContentProjection;
  renderedNodes: TerrainNode[];
  tileSurfaces: TerrainTileSurface[];
  visibleNodes: TerrainNode[];
  visibleNodeIds: Set<string>;
  visibleRelations: TerrainRelation[];
}

export type TileSurfaceVisibility = "off_viewport" | "near_viewport" | "visible" | "focused";
export type TileSurfaceLoadPriority = "none" | "low" | "medium" | "high";
export type TileSurfaceLoadState = "metadata_only" | "thumbnail_ready" | "renderer_visible" | "renderer_focused";
export type MainContentMode =
  | "domain_gallery"
  | "source_candidate_field"
  | "source_intake_pending"
  | "source_intake_failed"
  | "source_tile_field"
  | "browser_absorbed"
  | "text_grain"
  | "empty_source_field";

export interface ProjectionRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ProjectionViewportBounds {
  width: number;
  height: number;
}

export interface TileAbsorptionState {
  progress: number;
  shouldAbsorb: boolean;
  threshold: number;
  viewportShare: number;
}

export interface TerrainTileSurface {
  absorption: TileAbsorptionState;
  layer: LayerId;
  loadPriority: TileSurfaceLoadPriority;
  loadState: TileSurfaceLoadState;
  nodeId: string;
  screenBounds?: ProjectionRect;
  sourceId?: string;
  sourceState: SourceState;
  sourceUrl?: string;
  title: string;
  type: TerrainNode["type"];
  visibility: TileSurfaceVisibility;
  worldBounds: ProjectionRect;
}

export interface CandidateTileSurface {
  actionState: "candidate" | "observing" | "failed";
  confidence?: number;
  layer: LayerId;
  observationId: string;
  providerId?: string;
  screenBounds?: ProjectionRect;
  snippet?: string;
  status: ScoutObservation["status"];
  title: string;
  url?: string;
  visibility: TileSurfaceVisibility;
  worldBounds: ProjectionRect;
}

export interface MainContentProjection {
  candidateTileSurfaces: CandidateTileSurface[];
  emptyReason?: string;
  focusedSourceId?: string;
  intakeStatus: "idle" | "pending" | "failed" | "ready";
  mode: MainContentMode;
  sourceTileSurfaces: TerrainTileSurface[];
  statusObservationId?: string;
  statusText?: string;
  statusUrl?: string;
}

export interface TerrainPixiProjectionOptions {
  absorbedNodeId?: string;
  focusedObservationId?: string;
  focusedNodeId?: string;
  tileFieldTargetCount?: number;
  viewportBounds?: ProjectionViewportBounds;
}

const candidateStatuses = new Set<ScoutObservation["status"]>(["pending", "observed", "source_candidate", "failed"]);
const TILE_ABSORPTION_VIEWPORT_SHARE = 0.8;
const DEFAULT_TILE_FIELD_TARGET_COUNT = 25;
const TILE_ASPECT_RATIO = 16 / 10;
const PRELOAD_VIEWPORT_MARGIN = 0.35;

export function createTerrainPixiProjection(
  scene: TerrainScene,
  viewport: ViewportState,
  options: TerrainPixiProjectionOptions = {},
): TerrainPixiProjection {
  const currentLayer = scene.layers.find((layer) => layer.id === viewport.layer);
  const parentLayerId = currentLayer?.parent_layer_id;
  const childLayerIds = currentLayer?.child_layer_ids ?? [];
  const visibleNodes = scene.nodes.filter((node) => node.layer === viewport.layer);
  const layerNodes = visibleNodes.length > 0 ? visibleNodes : scene.nodes;
  const layerNodeIds = new Set(layerNodes.map((node) => node.id));
  const ghostNodes = scene.nodes.filter(
    (node) =>
      node.layer !== viewport.layer &&
      (node.layer === parentLayerId || childLayerIds.includes(node.layer)) &&
      !layerNodeIds.has(node.id),
  );
  const renderedNodes = [...ghostNodes, ...layerNodes];
  const renderedNodeIds = new Set(renderedNodes.map((node) => node.id));
  const candidateObservations = (scene.scout_observations ?? []).filter(
    (observation) =>
      observation.layer === viewport.layer &&
      observation.position_hint &&
      candidateStatuses.has(observation.status) &&
      observation.status !== "converted",
  );
  const tileSurfaces = createTileSurfaces(layerNodes, viewport, options);
  const candidateTileSurfaces = createCandidateTileSurfaces(candidateObservations, viewport, options);

  return {
    candidateTileSurfaces,
    candidateObservations,
    mainContent: createMainContentProjection(scene, viewport, tileSurfaces, candidateTileSurfaces),
    renderedNodes,
    tileSurfaces,
    visibleNodes: layerNodes,
    visibleNodeIds: layerNodeIds,
    visibleRelations: scene.relations.filter((relation) => renderedNodeIds.has(relation.from) && renderedNodeIds.has(relation.to)),
  };
}

export function resolveTileAbsorption(
  viewportShare: number,
  focused: boolean,
  threshold = TILE_ABSORPTION_VIEWPORT_SHARE,
  absorbed = false,
): TileAbsorptionState {
  const normalizedShare = Math.max(0, viewportShare);
  const progress = absorbed ? 1 : focused ? Math.min(1, normalizedShare / threshold) : 0;

  return {
    progress,
    shouldAbsorb: absorbed || (focused && normalizedShare >= threshold),
    threshold,
    viewportShare: normalizedShare,
  };
}

export function clampTileFieldTargetCount(value: number | undefined): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return DEFAULT_TILE_FIELD_TARGET_COUNT;
  }

  return Math.min(80, Math.max(4, Math.round(value)));
}

function createMainContentProjection(
  scene: TerrainScene,
  viewport: ViewportState,
  sourceTileSurfaces: TerrainTileSurface[],
  candidateTileSurfaces: CandidateTileSurface[],
): MainContentProjection {
  const directUrlObservation = getLatestDirectUrlObservation(scene);
  const candidateObservations = getCandidateObservationsForLayer(scene, viewport.layer);

  if (scene.runtime.browser_absorption.status === "absorbed") {
    return {
      focusedSourceId: scene.runtime.browser_absorption.source_id,
      intakeStatus: "ready",
      mode: "browser_absorbed",
      candidateTileSurfaces,
      sourceTileSurfaces,
      statusUrl: scene.runtime.browser_absorption.source_url,
    };
  }

  if (sourceTileSurfaces.length > 0) {
    return {
      focusedSourceId: sourceTileSurfaces.find((surface) => surface.visibility === "focused")?.sourceId ?? sourceTileSurfaces[0]?.sourceId,
      intakeStatus: "ready",
      mode: "source_tile_field",
      candidateTileSurfaces,
      sourceTileSurfaces,
    };
  }

  if (directUrlObservation?.status === "pending") {
    return {
      intakeStatus: "pending",
      mode: "source_intake_pending",
      candidateTileSurfaces,
      sourceTileSurfaces,
      statusObservationId: directUrlObservation.id,
      statusText: "Playwright Scout is observing this source before terrain is created.",
      statusUrl: directUrlObservation.url ?? directUrlObservation.query,
    };
  }

  if (directUrlObservation?.status === "failed") {
    return {
      emptyReason: directUrlObservation.failure_reason ?? "Scout could not observe this URL.",
      intakeStatus: "failed",
      mode: "source_intake_failed",
      candidateTileSurfaces,
      sourceTileSurfaces,
      statusObservationId: directUrlObservation.id,
      statusText: directUrlObservation.failure_reason ?? directUrlObservation.snippet,
      statusUrl: directUrlObservation.url ?? directUrlObservation.query,
    };
  }

  if (candidateTileSurfaces.length > 0 || candidateObservations.length > 0) {
    const candidateCount = candidateTileSurfaces.length || candidateObservations.length;
    const firstCandidateSurface = candidateTileSurfaces[0];
    const firstCandidateObservation = candidateObservations[0];
    const allCandidateSurfacesPending =
      candidateTileSurfaces.length > 0 && candidateTileSurfaces.every((surface) => surface.actionState === "observing");
    const allCandidateSurfacesFailed =
      candidateTileSurfaces.length > 0 && candidateTileSurfaces.every((surface) => surface.actionState === "failed");
    const intakeStatus = allCandidateSurfacesPending ? "pending" : allCandidateSurfacesFailed ? "failed" : "ready";
    const statusText =
      intakeStatus === "pending"
        ? `Discovering candidate URLs. Provider results will replace this pending marker.`
        : intakeStatus === "failed"
          ? `${candidateCount} candidate discovery attempt${candidateCount === 1 ? "" : "s"} failed.`
          : `${candidateCount} candidate source${candidateCount === 1 ? "" : "s"} discovered. Observe one to create a source-backed L3 tile.`;

    return {
      intakeStatus,
      mode: "source_candidate_field",
      candidateTileSurfaces,
      sourceTileSurfaces,
      statusObservationId: firstCandidateSurface?.observationId ?? firstCandidateObservation?.id,
      statusText,
      statusUrl: firstCandidateSurface?.url ?? firstCandidateObservation?.url ?? firstCandidateObservation?.query,
    };
  }

  if (isMacroLayer(viewport.layer)) {
    return {
      intakeStatus: "idle",
      mode: "domain_gallery",
      candidateTileSurfaces,
      sourceTileSurfaces,
    };
  }

  if (viewport.layer === "L2" || viewport.layer === "L3") {
    return {
      emptyReason: "No source-backed webpage/document tile exists on this layer yet.",
      intakeStatus: "idle",
      mode: "empty_source_field",
      candidateTileSurfaces,
      sourceTileSurfaces,
    };
  }

  if (viewport.layer === "L4" || getLayerFocalBand(viewport.layer) === "text_grain" || viewport.layer === "L11") {
    return {
      intakeStatus: "idle",
      mode: "text_grain",
      candidateTileSurfaces,
      sourceTileSurfaces,
    };
  }

  return {
    emptyReason: "This layer has no source-backed surface to render.",
    intakeStatus: "idle",
    mode: "empty_source_field",
    candidateTileSurfaces,
    sourceTileSurfaces,
  };
}

function getCandidateObservationsForLayer(scene: TerrainScene, layer: LayerId): ScoutObservation[] {
  return [...(scene.scout_observations ?? [])]
    .filter(
      (observation) =>
        observation.layer === layer &&
        (observation.status === "source_candidate" || observation.status === "observed"),
    )
    .sort((left, right) => right.updated_at.localeCompare(left.updated_at));
}

function getLatestDirectUrlObservation(scene: TerrainScene): ScoutObservation | undefined {
  return [...(scene.scout_observations ?? [])]
    .filter(
      (observation) =>
        observation.discovery_mode === "direct_url" &&
        (observation.status === "pending" || observation.status === "failed"),
    )
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at))[0];
}

function createTileSurfaces(
  nodes: TerrainNode[],
  viewport: ViewportState,
  options: TerrainPixiProjectionOptions,
): TerrainTileSurface[] {
  if (!isTileLayer(viewport.layer)) {
    return [];
  }

  const viewportWorldBounds = options.viewportBounds ? createViewportWorldBounds(viewport, options.viewportBounds) : undefined;
  const nearWorldBounds = viewportWorldBounds ? inflateRect(viewportWorldBounds, PRELOAD_VIEWPORT_MARGIN) : undefined;
  const tileSize = resolveTileWorldSize(viewport, options.viewportBounds, options.tileFieldTargetCount);

  return nodes
    .filter((node) => node.layer === viewport.layer && isTileSurfaceNode(node))
    .map((node) => {
      const position = node.position_hint ?? { x: 0, y: 0 };
      const worldBounds = {
        x: position.x - tileSize.width / 2,
        y: position.y - tileSize.height / 2,
        width: tileSize.width,
        height: tileSize.height,
      };
      const screenBounds = options.viewportBounds ? projectWorldRect(worldBounds, viewport, options.viewportBounds) : undefined;
      const absorbed = node.id === options.absorbedNodeId;
      const focused = absorbed || node.id === options.focusedNodeId;
      const visible = viewportWorldBounds ? rectsIntersect(worldBounds, viewportWorldBounds) : true;
      const near = nearWorldBounds ? rectsIntersect(worldBounds, nearWorldBounds) : visible;
      const visibility = resolveTileVisibility({ focused, near, visible });
      const viewportShare = screenBounds && options.viewportBounds
        ? (screenBounds.width * screenBounds.height) / Math.max(1, options.viewportBounds.width * options.viewportBounds.height)
        : 0;

      return {
        absorption: resolveTileAbsorption(viewportShare, focused, TILE_ABSORPTION_VIEWPORT_SHARE, absorbed),
        layer: node.layer,
        loadPriority: resolveTileLoadPriority(visibility),
        loadState: resolveTileLoadState(visibility),
        nodeId: node.id,
        screenBounds,
        sourceId: node.source_id,
        sourceState: node.source_state,
        sourceUrl: node.source_url,
        title: node.title,
        type: node.type,
        visibility,
        worldBounds,
      };
    });
}

function createCandidateTileSurfaces(
  observations: ScoutObservation[],
  viewport: ViewportState,
  options: TerrainPixiProjectionOptions,
): CandidateTileSurface[] {
  if (!isTileLayer(viewport.layer)) {
    return [];
  }

  const viewportWorldBounds = options.viewportBounds ? createViewportWorldBounds(viewport, options.viewportBounds) : undefined;
  const nearWorldBounds = viewportWorldBounds ? inflateRect(viewportWorldBounds, PRELOAD_VIEWPORT_MARGIN) : undefined;
  const tileSize = resolveTileWorldSize(viewport, options.viewportBounds, options.tileFieldTargetCount);

  return observations
    .filter((observation) => observation.layer === viewport.layer && observation.position_hint)
    .map((observation) => {
      const position = observation.position_hint ?? { x: 0, y: 0 };
      const worldBounds = {
        x: position.x - tileSize.width / 2,
        y: position.y - tileSize.height / 2,
        width: tileSize.width,
        height: tileSize.height,
      };
      const screenBounds = options.viewportBounds ? projectWorldRect(worldBounds, viewport, options.viewportBounds) : undefined;
      const focused = observation.id === options.focusedObservationId;
      const visible = viewportWorldBounds ? rectsIntersect(worldBounds, viewportWorldBounds) : true;
      const near = nearWorldBounds ? rectsIntersect(worldBounds, nearWorldBounds) : visible;

      return {
        actionState: resolveCandidateActionState(observation),
        confidence: observation.confidence,
        layer: observation.layer ?? viewport.layer,
        observationId: observation.id,
        providerId: observation.provider_id ?? observation.provider_kind ?? observation.adapter ?? observation.discovery_mode,
        screenBounds,
        snippet: observation.failure_reason ?? observation.snippet,
        status: observation.status,
        title: observation.title,
        url: observation.url,
        visibility: resolveTileVisibility({ focused, near, visible }),
        worldBounds,
      };
    });
}

function resolveCandidateActionState(observation: ScoutObservation): CandidateTileSurface["actionState"] {
  if (observation.status === "pending") {
    return "observing";
  }

  if (observation.status === "failed") {
    return "failed";
  }

  return "candidate";
}

function isTileSurfaceNode(node: TerrainNode): boolean {
  return Boolean(
    node.layer === "L3" &&
      node.source_state === "source_backed" &&
      node.source_url &&
      (node.type === "webpage" || node.type === "document"),
  );
}

function resolveTileWorldSize(
  viewport: ViewportState,
  viewportBounds: ProjectionViewportBounds | undefined,
  tileFieldTargetCount: number | undefined,
): { width: number; height: number } {
  if (!viewportBounds) {
    return { width: 360, height: 225 };
  }

  const targetCount = clampTileFieldTargetCount(tileFieldTargetCount);
  const targetScreenArea = Math.max(1, (viewportBounds.width * viewportBounds.height) / targetCount);
  const screenWidth = Math.sqrt(targetScreenArea * TILE_ASPECT_RATIO);
  const screenHeight = screenWidth / TILE_ASPECT_RATIO;
  const baseZoom = resolveZoomForLayer(viewport.layer);

  return {
    width: clamp(screenWidth / baseZoom, 220, 760),
    height: clamp(screenHeight / baseZoom, 140, 520),
  };
}

function createViewportWorldBounds(viewport: ViewportState, bounds: ProjectionViewportBounds): ProjectionRect {
  const width = bounds.width / viewport.zoom;
  const height = bounds.height / viewport.zoom;

  return {
    x: viewport.x - width / 2,
    y: viewport.y - height / 2,
    width,
    height,
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

function resolveTileVisibility(input: { focused: boolean; near: boolean; visible: boolean }): TileSurfaceVisibility {
  if (input.focused) {
    return "focused";
  }

  if (input.visible) {
    return "visible";
  }

  if (input.near) {
    return "near_viewport";
  }

  return "off_viewport";
}

function resolveTileLoadPriority(visibility: TileSurfaceVisibility): TileSurfaceLoadPriority {
  if (visibility === "focused") {
    return "high";
  }

  if (visibility === "visible") {
    return "medium";
  }

  if (visibility === "near_viewport") {
    return "low";
  }

  return "none";
}

function resolveTileLoadState(visibility: TileSurfaceVisibility): TileSurfaceLoadState {
  if (visibility === "focused") {
    return "renderer_focused";
  }

  if (visibility === "visible") {
    return "renderer_visible";
  }

  if (visibility === "near_viewport") {
    return "thumbnail_ready";
  }

  return "metadata_only";
}

function inflateRect(rect: ProjectionRect, ratio: number): ProjectionRect {
  const deltaX = rect.width * ratio;
  const deltaY = rect.height * ratio;

  return {
    x: rect.x - deltaX,
    y: rect.y - deltaY,
    width: rect.width + deltaX * 2,
    height: rect.height + deltaY * 2,
  };
}

function rectsIntersect(a: ProjectionRect, b: ProjectionRect): boolean {
  return a.x <= b.x + b.width && a.x + a.width >= b.x && a.y <= b.y + b.height && a.y + a.height >= b.y;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
