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
  | "cartographer_chunk_field"
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

const AUTO_CANDIDATE_VERIFICATION_PROVIDER_ID = "seekstar-auto-candidate-verification";
const candidateStatuses = new Set<ScoutObservation["status"]>(["pending", "observed", "source_candidate"]);
const TILE_ABSORPTION_VIEWPORT_SHARE = 0.8;
const DEFAULT_TILE_FIELD_TARGET_COUNT = 25;
const TILE_ASPECT_RATIO = 16 / 10;
const PRELOAD_VIEWPORT_MARGIN = 0.35;

export function createTerrainPixiProjection(
  scene: TerrainScene,
  viewport: ViewportState,
  options: TerrainPixiProjectionOptions = {},
): TerrainPixiProjection {
  const visibleNodes = scene.nodes.filter((node) => node.layer === viewport.layer && isRenderableNodeForLayer(node, viewport.layer));
  const layerNodes = applyMvpLayerLayout(visibleNodes, viewport.layer);
  const layerNodeIds = new Set(layerNodes.map((node) => node.id));
  const renderedNodes = layerNodes;
  const renderedNodeIds = new Set(renderedNodes.map((node) => node.id));
  const candidateObservations = (scene.scout_observations ?? []).filter(
    (observation) =>
      observation.layer === viewport.layer &&
      observation.position_hint &&
      candidateStatuses.has(observation.status) &&
      observation.status !== "converted",
  );
  const tileSurfaces = createTileSurfaces(layerNodes, viewport, options);
  const candidateTileSurfaces: CandidateTileSurface[] = [];
  const nodesById = new Map(renderedNodes.map((node) => [node.id, node]));

  return {
    candidateTileSurfaces,
    candidateObservations,
    mainContent: createMainContentProjection(scene, viewport, tileSurfaces),
    renderedNodes,
    tileSurfaces,
    visibleNodes: layerNodes,
    visibleNodeIds: layerNodeIds,
    visibleRelations: isMacroGalleryLayer(viewport.layer)
      ? []
      : scene.relations.filter(
          (relation) => renderedNodeIds.has(relation.from) && renderedNodeIds.has(relation.to) && isRenderableRelation(relation, nodesById, viewport),
        ),
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
): MainContentProjection {
  const candidateTileSurfaces: CandidateTileSurface[] = [];
  const directUrlObservation = getLatestDirectUrlObservation(scene);
  const candidateObservations = getCandidateObservationsForLayer(scene, viewport.layer);
  const cartographerNodes = getCartographerNodesForLayer(scene, viewport.layer);

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

  if (candidateObservations.length > 0) {
    const candidateCount = candidateObservations.length;
    const firstCandidateObservation = candidateObservations[0];
    const statusText = `${candidateCount} source candidate${candidateCount === 1 ? "" : "s"} queued for DataService verification. Verified sources become L3 tiles.`;

    return {
      intakeStatus: "ready",
      mode: "source_candidate_field",
      candidateTileSurfaces,
      sourceTileSurfaces,
      statusObservationId: firstCandidateObservation?.id,
      statusText,
      statusUrl: firstCandidateObservation?.url ?? firstCandidateObservation?.query,
    };
  }

  if (cartographerNodes.length > 0) {
    return {
      intakeStatus: "ready",
      mode: "cartographer_chunk_field",
      candidateTileSurfaces,
      sourceTileSurfaces,
      statusText: `${cartographerNodes.length} AI Cartographer terrain node${cartographerNodes.length === 1 ? "" : "s"} loaded for this chunk.`,
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

  if (viewport.layer === "L2") {
    return {
      intakeStatus: "idle",
      mode: "cartographer_chunk_field",
      candidateTileSurfaces,
      sourceTileSurfaces,
      statusText: "Source Orientation terrain is waiting for Cartographer generation.",
    };
  }

  if (viewport.layer === "L3") {
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

function isRenderableRelation(relation: TerrainRelation, nodesById: Map<string, TerrainNode>, viewport: ViewportState): boolean {
  const from = nodesById.get(relation.from);
  const to = nodesById.get(relation.to);

  if (!from?.position_hint || !to?.position_hint) {
    return false;
  }

  if (isMacroLayer(viewport.layer)) {
    const dx = from.position_hint.x - to.position_hint.x;
    const dy = from.position_hint.y - to.position_hint.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    return distance <= 360;
  }

  return true;
}

function applyMvpLayerLayout(nodes: TerrainNode[], layer: LayerId): TerrainNode[] {
  if (nodes.length === 0) {
    return nodes;
  }

  if (isMacroGalleryLayer(layer)) {
    return createMvpGalleryNodes(nodes);
  }

  if (layer === "L3") {
    return createMvpTileFieldNodes(nodes);
  }

  return nodes;
}

function isMacroGalleryLayer(layer: LayerId): boolean {
  return layer === "supra_macro" || layer === "L0" || layer === "L1" || layer === "L2";
}

function createMvpGalleryNodes(nodes: TerrainNode[]): TerrainNode[] {
  const sortedNodes = [...nodes].sort(compareGalleryNodes);
  const total = sortedNodes.length;

  return sortedNodes.map((node, index) => ({
    ...node,
    position_hint: createMvpGalleryPosition(index, total),
  }));
}

function createMvpTileFieldNodes(nodes: TerrainNode[]): TerrainNode[] {
  const sortedNodes = [...nodes].sort(compareGalleryNodes);
  const columns = 5;
  const cellWidth = 300;
  const cellHeight = 190;
  let cursorX = 0;
  let cursorY = 0;
  let rowHeight = 1;
  const occupiedRows: Array<Array<boolean>> = [];

  return sortedNodes.map((node, index) => {
    const span = getLiveTileSpan(index);
    const slot = findTileSlot(occupiedRows, columns, cursorX, cursorY, span.width, span.height);

    markTileSlot(occupiedRows, slot.x, slot.y, span.width, span.height);
    cursorX = slot.x + span.width;
    cursorY = slot.y;
    rowHeight = Math.max(rowHeight, span.height);

    if (cursorX >= columns) {
      cursorX = 0;
      cursorY += rowHeight;
      rowHeight = 1;
    }

    return {
      ...node,
      position_hint: {
        x: Math.round((slot.x + span.width / 2 - columns / 2) * cellWidth),
        y: Math.round((slot.y + span.height / 2) * cellHeight),
      },
    };
  });
}

function getLiveTileSpan(index: number): { width: number; height: number } {
  const pattern = [
    { width: 2, height: 2 },
    { width: 1, height: 1 },
    { width: 1, height: 1 },
    { width: 2, height: 1 },
    { width: 1, height: 2 },
    { width: 1, height: 1 },
    { width: 2, height: 1 },
    { width: 1, height: 1 },
  ];

  return pattern[index % pattern.length] ?? { width: 1, height: 1 };
}

function findTileSlot(
  occupiedRows: Array<Array<boolean>>,
  columns: number,
  startX: number,
  startY: number,
  spanWidth: number,
  spanHeight: number,
): { x: number; y: number } {
  for (let y = startY; y < startY + 80; y += 1) {
    for (let x = y === startY ? startX : 0; x <= columns - spanWidth; x += 1) {
      if (isTileSlotFree(occupiedRows, x, y, spanWidth, spanHeight)) {
        return { x, y };
      }
    }
  }

  return { x: 0, y: startY + 1 };
}

function isTileSlotFree(occupiedRows: Array<Array<boolean>>, x: number, y: number, spanWidth: number, spanHeight: number): boolean {
  for (let row = y; row < y + spanHeight; row += 1) {
    for (let column = x; column < x + spanWidth; column += 1) {
      if (occupiedRows[row]?.[column]) {
        return false;
      }
    }
  }

  return true;
}

function markTileSlot(occupiedRows: Array<Array<boolean>>, x: number, y: number, spanWidth: number, spanHeight: number): void {
  for (let row = y; row < y + spanHeight; row += 1) {
    occupiedRows[row] = occupiedRows[row] ?? [];

    for (let column = x; column < x + spanWidth; column += 1) {
      occupiedRows[row][column] = true;
    }
  }
}

function compareGalleryNodes(left: TerrainNode, right: TerrainNode): number {
  const leftChunk = parseNodeChunkKey(left);
  const rightChunk = parseNodeChunkKey(right);
  const leftChunkRank = leftChunk ? leftChunk.x * 10_000 + leftChunk.y : 0;
  const rightChunkRank = rightChunk ? rightChunk.x * 10_000 + rightChunk.y : 0;

  if (leftChunkRank !== rightChunkRank) {
    return leftChunkRank - rightChunkRank;
  }

  const leftCreatedAt = left.created_at ?? "";
  const rightCreatedAt = right.created_at ?? "";

  if (leftCreatedAt !== rightCreatedAt) {
    return leftCreatedAt.localeCompare(rightCreatedAt);
  }

  return left.id.localeCompare(right.id);
}

function parseNodeChunkKey(node: TerrainNode): { x: number; y: number } | undefined {
  const label = node.created_from?.label ?? "";
  const match = /\/\s*(-?\d+):(-?\d+):/u.exec(label);

  if (!match) {
    return undefined;
  }

  return {
    x: Number.parseInt(match[1] ?? "0", 10),
    y: Number.parseInt(match[2] ?? "0", 10),
  };
}

function createMvpGalleryPosition(index: number, total: number): { x: number; y: number } {
  const spacingX = 138;
  const spacingY = 120;
  const columns = Math.max(5, Math.ceil(Math.sqrt(Math.max(1, total) * 1.45)));
  const row = Math.floor(index / columns);
  const column = index % columns;
  const rows = Math.max(1, Math.ceil(total / columns));
  const centerColumn = (columns - 1) / 2;
  const centerRow = (rows - 1) / 2;
  const stagger = row % 2 === 0 ? 0 : spacingX / 2;
  const deterministicJitterX = ((index * 17) % 13) - 6;
  const deterministicJitterY = ((index * 29) % 11) - 5;

  return {
    x: Math.round((column - centerColumn) * spacingX + stagger + deterministicJitterX),
    y: Math.round((row - centerRow) * spacingY + deterministicJitterY),
  };
}

function getCartographerNodesForLayer(scene: TerrainScene, layer: LayerId): TerrainNode[] {
  if (layer === "L3") {
    return [];
  }

  return scene.nodes.filter((node) => node.layer === layer && (node.source_state === "cartographer_primary" || node.tags?.includes("cartographer")));
}

function isRenderableNodeForLayer(node: TerrainNode, layer: LayerId): boolean {
  if (layer !== "L3") {
    return true;
  }

  return isTileSurfaceNode(node);
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
        observation.provider_id !== AUTO_CANDIDATE_VERIFICATION_PROVIDER_ID &&
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
