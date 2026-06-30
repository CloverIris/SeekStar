import type {
  TerrainNode,
  TerrainRelation,
  TerrainScene,
  TileAbsorptionTrigger,
  ViewportState,
} from "@seekstar/core-schema";
import { isMacroLayer } from "@seekstar/core-schema";
import type { CSSProperties, MouseEvent as ReactMouseEvent, PointerEvent, ReactElement } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { LocateFixed, Maximize2, RotateCcw } from "lucide-react";
import "pixi.js/unsafe-eval";
import { Application, Container, Graphics, Rectangle, Sprite, Text } from "pixi.js";
import {
  createTileAbsorptionTransition,
  type CanvasPoint,
  type LassoDraft,
  type ProjectionViewportBounds,
  type TileAbsorptionTransition,
  type TerrainTileSurface,
  fitViewportToNodes,
  normalizeRect,
  resetViewport,
  screenToWorld,
  selectNodesInRect,
  zoomViewportAtScreenPoint,
} from "@seekstar/constellation-engine";
import type { CartographerChunkRuntimeRecord, CartographerRuntimeStatus } from "../exploration/cartographerRuntimeClient";
import type { CanvasTool } from "./canvasTools";
import { MainContentStatusOverlay, useMainContentRuntime } from "./main-content/MainContentRuntime";

interface TerrainCanvasProps {
  activeTool: CanvasTool;
  chunkBoundaryControls: ChunkBoundaryControls;
  cartographerChunkRecords: CartographerChunkRuntimeRecord[];
  cartographerStatus: CartographerRuntimeStatus;
  focusedNodeId?: string;
  highlightedNodeIds: string[];
  onFrontierDiscovery: (viewport: ViewportState) => void;
  onBrowserModeExit: () => void;
  onCurrentPageDeepLens: (nodeId: string) => void;
  onNodeSelect: (nodeId: string) => void;
  onRelationSelect: (relationId: string) => void;
  onSelectionChange: (nodeIds: string[], focusNodeId?: string, showSelectionActions?: boolean) => void;
  onTileAbsorptionComplete: (nodeId: string, trigger: TileAbsorptionTrigger) => void;
  onViewportChange: (viewport: ViewportState) => void;
  scene: TerrainScene;
  selectedNodeIds: string[];
  selectedRelationId?: string;
  tileAbsorptionRequest?: TileAbsorptionRequest;
  tileFieldTargetCount?: number;
  viewport: ViewportState;
}

export type ChunkBoundaryDirection = "east" | "north" | "south" | "west";

export interface ChunkBoundaryControls {
  autoDiscoveryEnabled: boolean;
  autoPreloadRing: number;
  chunkHeight: number;
  chunkWidth: number;
  manualPreloadRange: number;
  onDirectionExpand: (direction: ChunkBoundaryDirection) => void;
  onCancelCurrent: () => void;
  onRefreshCurrent: () => void;
  onToggleAutoDiscovery: (enabled: boolean) => void;
}

export interface TileAbsorptionRequest {
  nodeId: string;
  requestId: number;
  trigger: TileAbsorptionTrigger;
}

type CanvasDragState =
  | {
      mode: "pan";
      pointerId: number;
      start: CanvasPoint;
      viewport: ViewportState;
    }
  | {
      mode: "lasso";
      pointerId: number;
      draft: LassoDraft;
    };

interface HoverPreviewState {
  title: string;
  type: string;
  state: string;
  summary?: string;
  position: CanvasPoint;
}

interface TileThumbnailState {
  dataUrl?: string;
  error?: string;
  sourceUrl: string;
  status: "loading" | "ready" | "failed";
  title: string;
  updatedAt: string;
}

interface RenderableTileSurface extends TerrainTileSurface {
  resourceKind?: "html" | "image" | "pdf" | "unknown";
  snippet?: string;
  sourceHost?: string;
  sourceTitle?: string;
}

export function TerrainCanvas({
  activeTool,
  focusedNodeId,
  highlightedNodeIds,
  onBrowserModeExit,
  onCurrentPageDeepLens,
  onFrontierDiscovery,
  onNodeSelect,
  onRelationSelect,
  onSelectionChange,
  onTileAbsorptionComplete,
  onViewportChange,
  scene,
  selectedNodeIds,
  selectedRelationId,
  tileAbsorptionRequest,
  tileFieldTargetCount,
  viewport,
}: TerrainCanvasProps): ReactElement {
  const hostRef = useRef<HTMLElement | null>(null);
  const appRef = useRef<Application | null>(null);
  const viewportRef = useRef(viewport);
  const onViewportChangeRef = useRef(onViewportChange);
  const onFrontierDiscoveryRef = useRef(onFrontierDiscovery);
  const onNodeSelectRef = useRef(onNodeSelect);
  const onRelationSelectRef = useRef(onRelationSelect);
  const [pixiReady, setPixiReady] = useState(false);
  const [viewportBounds, setViewportBounds] = useState<ProjectionViewportBounds | undefined>();
  const [dragState, setDragState] = useState<CanvasDragState | undefined>();
  const [hoverPreview, setHoverPreview] = useState<HoverPreviewState | undefined>();
  const [tileThumbnailsByNodeId, setTileThumbnailsByNodeId] = useState<Map<string, TileThumbnailState>>(() => new Map());
  const [activeAbsorptionTransition, setActiveAbsorptionTransition] = useState<TileAbsorptionTransition | undefined>();
  const absorptionTransitionTimeoutRef = useRef<number | undefined>(undefined);
  const lastAbsorptionRequestIdRef = useRef<number | undefined>(undefined);
  const lassoRect = dragState?.mode === "lasso" ? normalizeRect(dragState.draft.start, dragState.draft.current) : undefined;
  const mainContentRuntime = useMainContentRuntime({
    absorbedNodeId: scene.runtime.browser_absorption.status === "absorbed" ? scene.runtime.browser_absorption.node_id : undefined,
    focusedNodeId,
    scene,
    tileFieldTargetCount,
    viewport,
    viewportBounds,
  });
  const {
    candidateObservations,
    mainContent,
    renderedNodes,
    sourceTileSurfaces,
    visibleNodeIds,
    visibleNodes,
    visibleRelations,
  } = mainContentRuntime;
  const tileSurfaces = sourceTileSurfaces as RenderableTileSurface[];
  const isBrowserAbsorbed = scene.runtime.browser_absorption.status === "absorbed";
  const absorbedTileSurface = isBrowserAbsorbed
    ? tileSurfaces.find((surface) => surface.nodeId === scene.runtime.browser_absorption.node_id && surface.sourceUrl)
    : undefined;

  useEffect(() => {
    traceTerrainCanvas("projection.state", {
      active_tab_id: scene.active_tab_id,
      browser_absorbed: isBrowserAbsorbed,
      candidate_observations: candidateObservations.length,
      main_content_mode: mainContent.mode,
      projection_nodes: renderedNodes.length,
      scene_nodes: scene.nodes.length,
      scene_observations: scene.scout_observations?.length ?? 0,
      scene_relations: scene.relations.length,
      selected_nodes: selectedNodeIds.length,
      source_tile_surfaces: tileSurfaces.length,
      tile_field_target_count: tileFieldTargetCount ?? 25,
      viewport: {
        layer: viewport.layer,
        x: Math.round(viewport.x),
        y: Math.round(viewport.y),
        zoom: Number(viewport.zoom.toFixed(3)),
      },
      visible_nodes: visibleNodes.length,
      visible_relations: visibleRelations.length,
    });
  }, [
    candidateObservations.length,
    isBrowserAbsorbed,
    mainContent.mode,
    renderedNodes.length,
    scene.active_tab_id,
    scene.nodes.length,
    scene.relations.length,
    scene.scout_observations?.length,
    selectedNodeIds.length,
    tileFieldTargetCount,
    tileSurfaces.length,
    viewport.layer,
    viewport.x,
    viewport.y,
    viewport.zoom,
    visibleNodes.length,
    visibleRelations.length,
  ]);

  const beginTileAbsorptionTransition = useCallback(
    (nodeId: string, trigger: TileAbsorptionTrigger): void => {
      if (isBrowserAbsorbed || activeAbsorptionTransition) {
        return;
      }

      if (!viewportBounds) {
        onTileAbsorptionComplete(nodeId, trigger);
        return;
      }

      const surface = tileSurfaces.find((candidate) => candidate.nodeId === nodeId && candidate.sourceUrl);

      if (!surface) {
        onTileAbsorptionComplete(nodeId, trigger);
        return;
      }

      const transition = createTileAbsorptionTransition({
        surface,
        trigger,
        viewport,
        viewportBounds,
      });

      if (absorptionTransitionTimeoutRef.current) {
        window.clearTimeout(absorptionTransitionTimeoutRef.current);
      }

      setActiveAbsorptionTransition(transition);
      absorptionTransitionTimeoutRef.current = window.setTimeout(() => {
        setActiveAbsorptionTransition(undefined);
        absorptionTransitionTimeoutRef.current = undefined;
        onTileAbsorptionComplete(transition.nodeId, transition.trigger);
      }, transition.durationMs);
    },
    [activeAbsorptionTransition, isBrowserAbsorbed, onTileAbsorptionComplete, tileSurfaces, viewport, viewportBounds],
  );

  useEffect(() => {
    viewportRef.current = viewport;
    onViewportChangeRef.current = onViewportChange;
    onFrontierDiscoveryRef.current = onFrontierDiscovery;
    onNodeSelectRef.current = onNodeSelect;
    onRelationSelectRef.current = onRelationSelect;
  }, [onFrontierDiscovery, onNodeSelect, onRelationSelect, onViewportChange, viewport]);

  useEffect(() => {
    const host = hostRef.current;

    if (!host) {
      return undefined;
    }

    let cancelled = false;
    let resizeObserver: ResizeObserver | undefined;
    const app = new Application();
    const initialWidth = Math.max(1, host.clientWidth);
    const initialHeight = Math.max(1, host.clientHeight);
    setViewportBounds({ width: initialWidth, height: initialHeight });

    void app
      .init({
        width: initialWidth,
        height: initialHeight,
        backgroundAlpha: 0,
        antialias: true,
        preference: "webgl",
        powerPreference: "high-performance",
      })
      .then(() => {
        if (cancelled) {
          destroyPixiApplication(app);
          return;
        }

        app.canvas.className = "pixi-terrain-canvas";
        host.appendChild(app.canvas);
        appRef.current = app;
        resizeObserver = new ResizeObserver(([entry]) => {
          const { width, height } = entry.contentRect;
          const nextBounds = {
            width: Math.max(1, Math.round(width)),
            height: Math.max(1, Math.round(height)),
          };

          app.renderer.resize(nextBounds.width, nextBounds.height);
          setViewportBounds(nextBounds);
        });
        resizeObserver.observe(host);
        setPixiReady(true);
      });

    return () => {
      cancelled = true;
      resizeObserver?.disconnect();
      setPixiReady(false);
      setViewportBounds(undefined);
      appRef.current = null;
      destroyPixiApplication(app);
    };
  }, []);

  useEffect(
    () => () => {
      if (absorptionTransitionTimeoutRef.current) {
        window.clearTimeout(absorptionTransitionTimeoutRef.current);
      }
    },
    [],
  );

  useEffect(() => {
    const app = appRef.current;
    const host = hostRef.current;

    if (!pixiReady || !app || !host) {
      return;
    }

    renderPixiScene({
      app,
      focusedNodeId,
      highlightedNodeIds,
      host,
      onHover: setHoverPreview,
      onHoverClear: () => setHoverPreview(undefined),
      onNodeSelect: (nodeId) => onNodeSelectRef.current(nodeId),
      onRelationSelect: (relationId) => onRelationSelectRef.current(relationId),
      renderedNodes,
      selectedNodeIds,
      selectedRelationId,
      tileThumbnailsByNodeId,
      tileSurfaces,
      visibleNodeIds,
      visibleRelations,
      viewport,
    });
  }, [
    focusedNodeId,
    highlightedNodeIds,
    pixiReady,
    renderedNodes,
    scene,
    selectedNodeIds,
    selectedRelationId,
    tileThumbnailsByNodeId,
    tileSurfaces,
    viewport,
    visibleNodeIds,
    visibleRelations,
  ]);

  useEffect(() => {
    const host = hostRef.current;

    if (!host) {
      return undefined;
    }

    const target = host;

    function handleNativeWheel(event: WheelEvent): void {
      event.preventDefault();

      const currentViewport = viewportRef.current;
      const bounds = target.getBoundingClientRect();
      const pointer = {
        x: event.clientX - bounds.left,
        y: event.clientY - bounds.top,
      };
      const scaleFactor = event.deltaY > 0 ? 0.9 : 1.1;

      onViewportChangeRef.current(zoomViewportAtScreenPoint(currentViewport, pointer, bounds, currentViewport.zoom * scaleFactor));
    }

    target.addEventListener("wheel", handleNativeWheel, { passive: false });

    return () => {
      target.removeEventListener("wheel", handleNativeWheel);
    };
  }, []);

  useEffect(() => {
    const host = hostRef.current;

    if (!host) {
      return undefined;
    }

    const exitLabelHeight = 34;
    const hostRect = host.getBoundingClientRect();
    const surfaces = tileSurfaces.filter(
      (surface) =>
        surface.sourceUrl &&
        ((isBrowserAbsorbed && surface.nodeId === scene.runtime.browser_absorption.node_id) ||
          surface.visibility === "focused" ||
          surface.visibility === "visible"),
    );
    const syncInput = {
      tabId: scene.active_tab_id,
      surfaces: surfaces.map((surface) => {
        const isAbsorbedSurface = isBrowserAbsorbed && surface.nodeId === scene.runtime.browser_absorption.node_id;

        return {
          bounds: isAbsorbedSurface
            ? {
                x: hostRect.left,
                y: hostRect.top + exitLabelHeight,
                width: hostRect.width,
                height: Math.max(1, hostRect.height - exitLabelHeight),
              }
            : toTileSurfaceSyncBounds(surface.screenBounds),
          loadPriority: surface.loadPriority,
          loadState: isAbsorbedSurface ? ("renderer_focused" as const) : surface.loadState,
          nodeId: surface.nodeId,
          renderMode: isAbsorbedSurface ? ("live" as const) : ("thumbnail" as const),
          sourceId: surface.sourceId,
          sourceUrl: surface.sourceUrl ?? "",
          title: surface.title,
          visibility: surface.visibility,
        };
      }),
    };

    void window.seekstar.tiles.sync(syncInput);
  }, [isBrowserAbsorbed, scene.active_tab_id, scene.runtime.browser_absorption.node_id, tileSurfaces]);

  useEffect(() => {
    if (isBrowserAbsorbed || activeAbsorptionTransition) {
      return;
    }

    const thresholdSurface = tileSurfaces.find((surface) => surface.absorption.shouldAbsorb && surface.sourceUrl);

    if (thresholdSurface) {
      beginTileAbsorptionTransition(thresholdSurface.nodeId, "threshold");
    }
  }, [activeAbsorptionTransition, beginTileAbsorptionTransition, isBrowserAbsorbed, tileSurfaces]);

  useEffect(() => {
    if (!tileAbsorptionRequest || tileAbsorptionRequest.requestId === lastAbsorptionRequestIdRef.current) {
      return;
    }

    lastAbsorptionRequestIdRef.current = tileAbsorptionRequest.requestId;
    beginTileAbsorptionTransition(tileAbsorptionRequest.nodeId, tileAbsorptionRequest.trigger);
  }, [beginTileAbsorptionTransition, tileAbsorptionRequest]);

  useEffect(() => {
    setTileThumbnailsByNodeId(new Map());
  }, [scene.active_tab_id]);

  useEffect(() => {
    return window.seekstar.tiles.onThumbnailUpdated((event) => {
      if (event.tabId !== scene.active_tab_id) {
        return;
      }

      setTileThumbnailsByNodeId((current) => {
        const next = new Map(current);
        next.set(event.nodeId, {
          dataUrl: event.dataUrl,
          error: event.error,
          sourceUrl: event.sourceUrl,
          status: event.status,
          title: event.title,
          updatedAt: event.updatedAt,
        });
        return next;
      });
    });
  }, [scene.active_tab_id]);

  useEffect(() => {
    return () => {
      void window.seekstar.tiles.clear(scene.active_tab_id);
    };
  }, [scene.active_tab_id]);

  function pointFromEvent(event: PointerEvent<HTMLElement>): CanvasPoint {
    const bounds = event.currentTarget.getBoundingClientRect();

    return {
      x: event.clientX - bounds.left,
      y: event.clientY - bounds.top,
    };
  }

  function handlePointerDown(event: PointerEvent<HTMLElement>): void {
    if (!isCanvasPrimaryCompatibleButton(event.button)) {
      return;
    }

    if (activeTool === "lens") {
      const point = pointFromEvent(event);
      const bounds = event.currentTarget.getBoundingClientRect();

      if (!isCanvasEntityAtScreenPoint(point, bounds, visibleNodes, tileSurfaces, viewport)) {
        const zoomFactor = event.shiftKey ? 0.85 : 1.18;

        onViewportChange(zoomViewportAtScreenPoint(viewport, point, bounds, viewport.zoom * zoomFactor));
        setHoverPreview(undefined);
      }
      return;
    }

    if (activeTool === "pan") {
      event.currentTarget.setPointerCapture(event.pointerId);
      setDragState({
        mode: "pan",
        pointerId: event.pointerId,
        start: pointFromEvent(event),
        viewport,
      });
      setHoverPreview(undefined);
      return;
    }

    if (activeTool === "pointer") {
      return;
    }

    if (activeTool === "lasso") {
      const start = pointFromEvent(event);
      event.currentTarget.setPointerCapture(event.pointerId);
      setDragState({
        mode: "lasso",
        pointerId: event.pointerId,
        draft: {
          start,
          current: start,
        },
      });
      setHoverPreview(undefined);
    }
  }

  function handlePointerMove(event: PointerEvent<HTMLElement>): void {
    if (!dragState || dragState.pointerId !== event.pointerId) {
      return;
    }

    const current = pointFromEvent(event);

    if (dragState.mode === "pan") {
      const deltaX = current.x - dragState.start.x;
      const deltaY = current.y - dragState.start.y;
      const nextViewport = {
        ...dragState.viewport,
        x: dragState.viewport.x - deltaX / dragState.viewport.zoom,
        y: dragState.viewport.y - deltaY / dragState.viewport.zoom,
      };

      onViewportChange(nextViewport);
      onFrontierDiscoveryRef.current(nextViewport);
      return;
    }

    setDragState({
      ...dragState,
      draft: {
        ...dragState.draft,
        current,
      },
    });
  }

  function handlePointerUp(event: PointerEvent<HTMLElement>): void {
    if (!dragState || dragState.pointerId !== event.pointerId) {
      return;
    }

    event.currentTarget.releasePointerCapture(event.pointerId);

    if (dragState.mode === "lasso") {
      const screenRect = normalizeRect(dragState.draft.start, dragState.draft.current);

      if (screenRect.width >= 6 && screenRect.height >= 6) {
        const bounds = event.currentTarget.getBoundingClientRect();
        const worldStart = screenToWorld({ x: screenRect.x, y: screenRect.y }, viewport, bounds);
        const worldEnd = screenToWorld(
          {
            x: screenRect.x + screenRect.width,
            y: screenRect.y + screenRect.height,
          },
          viewport,
          bounds,
        );
        const selectedIds = selectNodesInRect(visibleNodes, normalizeRect(worldStart, worldEnd));

        onSelectionChange(selectedIds, undefined, selectedIds.length > 0);
      }
    }

    setDragState(undefined);
  }

  function handlePointerCancel(): void {
    setDragState(undefined);
    setHoverPreview(undefined);
  }

  function getCanvasBounds(): DOMRect | undefined {
    return hostRef.current?.getBoundingClientRect();
  }

  function handleFitScene(): void {
    const bounds = getCanvasBounds();

    if (!bounds) {
      return;
    }

    onViewportChange(fitViewportToNodes(visibleNodes, bounds, viewport));
    setHoverPreview(undefined);
  }

  function handleFocusSelection(): void {
    const bounds = getCanvasBounds();

    if (!bounds || selectedNodeIds.length === 0) {
      return;
    }

    onViewportChange(
      fitViewportToNodes(visibleNodes, bounds, viewport, {
        maxZoom: selectedNodeIds.length === 1 ? 1.35 : 1.2,
        nodeIds: selectedNodeIds,
        padding: 140,
      }),
    );
    setHoverPreview(undefined);
  }

  function handleResetViewport(): void {
    onViewportChange(resetViewport(viewport));
    setHoverPreview(undefined);
  }

  function handleExitBrowserMode(): void {
    void window.seekstar.tiles.clear(scene.active_tab_id);
    onBrowserModeExit();
    setHoverPreview(undefined);
  }

  return (
    <section
      className={`canvas-plane pixi-canvas-plane canvas-tool-${activeTool}`}
      aria-label="Cognitive canvas"
      onContextMenu={preventCanvasContextMenu}
      onPointerCancel={handlePointerCancel}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      ref={hostRef}
    >
      {lassoRect ? (
        <div
          className="lasso-rect"
          style={{
            left: lassoRect.x,
            top: lassoRect.y,
            width: lassoRect.width,
            height: lassoRect.height,
          }}
        />
      ) : null}
      <MainContentStatusOverlay
        candidateObservations={candidateObservations}
        mainContent={mainContent}
      />
      <ViewportControls
        canFocusSelection={selectedNodeIds.length > 0}
        onFitScene={handleFitScene}
        onFocusSelection={handleFocusSelection}
        onResetViewport={handleResetViewport}
      />
      {activeAbsorptionTransition ? (
        <div
          aria-hidden="true"
          className="tile-absorption-transition"
          style={createAbsorptionTransitionStyle(activeAbsorptionTransition)}
        />
      ) : null}
      {absorbedTileSurface ? (
        <div className="browser-absorption-exit" role="toolbar" aria-label="Browser mode">
          <button onClick={handleExitBrowserMode} type="button">
            Exit browser mode
          </button>
          <button onClick={() => onCurrentPageDeepLens(absorbedTileSurface.nodeId)} type="button">
            Open current page in Deep Lens
          </button>
        </div>
      ) : null}
      {hoverPreview ? <NodeHoverPreview preview={hoverPreview} /> : null}
    </section>
  );
}

function createAbsorptionTransitionStyle(transition: TileAbsorptionTransition): CSSProperties {
  const from = transition.fromScreenBounds;
  const target = transition.targetScreenBounds;
  const width = Math.max(1, from.width);
  const height = Math.max(1, from.height);

  return {
    left: `${Math.round(from.x)}px`,
    top: `${Math.round(from.y)}px`,
    width: `${Math.round(width)}px`,
    height: `${Math.round(height)}px`,
    "--tile-absorption-duration": `${transition.durationMs}ms`,
    "--tile-absorption-dx": `${Math.round(target.x - from.x)}px`,
    "--tile-absorption-dy": `${Math.round(target.y - from.y)}px`,
    "--tile-absorption-sx": String(Math.max(0.01, target.width / width)),
    "--tile-absorption-sy": String(Math.max(0.01, target.height / height)),
  } as CSSProperties;
}

function renderPixiScene({
  app,
  focusedNodeId,
  highlightedNodeIds,
  host,
  onHover,
  onHoverClear,
  onNodeSelect,
  onRelationSelect,
  renderedNodes,
  selectedNodeIds,
  selectedRelationId,
  tileThumbnailsByNodeId,
  tileSurfaces,
  visibleNodeIds,
  visibleRelations,
  viewport,
}: {
  app: Application;
  focusedNodeId?: string;
  highlightedNodeIds: string[];
  host: HTMLElement;
  onHover: (preview: HoverPreviewState) => void;
  onHoverClear: () => void;
  onNodeSelect: (nodeId: string) => void;
  onRelationSelect: (relationId: string) => void;
  renderedNodes: TerrainNode[];
  selectedNodeIds: string[];
  selectedRelationId?: string;
  tileThumbnailsByNodeId: Map<string, TileThumbnailState>;
  tileSurfaces: TerrainTileSurface[];
  visibleNodeIds: Set<string>;
  visibleRelations: TerrainRelation[];
  viewport: ViewportState;
}): void {
  const bounds = host.getBoundingClientRect();
  const stage = app.stage;
  const world = new Container();
  const nodesById = new Map(renderedNodes.map((node) => [node.id, node]));

  stage.removeChildren();
  drawPixiBackground(stage, bounds);
  world.position.set(bounds.width / 2 - viewport.x * viewport.zoom, bounds.height / 2 - viewport.y * viewport.zoom);
  world.scale.set(viewport.zoom);

  const relationLayer = new Container();
  const tileSurfaceLayer = new Container();
  const nodeLayer = new Container();

  for (const surface of tileSurfaces) {
    if (surface.visibility === "off_viewport") {
      continue;
    }

    tileSurfaceLayer.addChild(createTileSurfaceFrame(surface, tileThumbnailsByNodeId.get(surface.nodeId)));
  }

  for (const relation of visibleRelations) {
    const fromNode = nodesById.get(relation.from);
    const toNode = nodesById.get(relation.to);
    const from = fromNode?.position_hint;
    const to = toNode?.position_hint;

    if (!from || !to || !fromNode || !toNode) {
      continue;
    }

    relationLayer.addChild(
      createRelationLine({
        from,
        isHighlighted: highlightedNodeIds.includes(fromNode.id) || highlightedNodeIds.includes(toNode.id),
        isSelected: relation.id === selectedRelationId || selectedNodeIds.includes(fromNode.id) || selectedNodeIds.includes(toNode.id),
        onRelationSelect,
        relation,
        to,
      }),
    );
  }

  for (const node of renderedNodes) {
    const position = node.position_hint ?? { x: 0, y: 0 };
    const isMacro = isMacroBubbleNode(node);
    const radius = isMacro ? getMacroBubbleRadius(node, viewport) : 0;
    const displayObject = isMacro
      ? createMacroBubble({
          isFocused: focusedNodeId === node.id,
          isGhost: !visibleNodeIds.has(node.id),
          isHighlighted: highlightedNodeIds.includes(node.id),
          isSelected: selectedNodeIds.includes(node.id),
          node,
          onHover,
          onHoverClear,
          onNodeSelect,
          radius,
          viewport,
        })
      : createDetailCard({
          isFocused: focusedNodeId === node.id,
          isGhost: !visibleNodeIds.has(node.id),
          isHighlighted: highlightedNodeIds.includes(node.id),
          isSelected: selectedNodeIds.includes(node.id),
          node,
          onHover,
          onHoverClear,
          onNodeSelect,
        });

    displayObject.position.set(position.x, position.y);
    nodeLayer.addChild(displayObject);
  }

  world.addChild(tileSurfaceLayer, relationLayer, nodeLayer);
  stage.addChild(world);
}

function createTileSurfaceFrame(surface: RenderableTileSurface, thumbnail?: TileThumbnailState): Container {
  const container = new Container();
  const frame = new Graphics();
  const { x, y, width, height } = surface.worldBounds;
  const isFocused = surface.visibility === "focused";
  const isVisible = surface.visibility === "visible" || isFocused;
  const fillAlpha = isFocused ? 0.24 : isVisible ? 0.14 : 0.07;
  const strokeAlpha = isFocused ? 0.78 : isVisible ? 0.42 : 0.22;
  const strokeWidth = isFocused ? 2.2 : 1.2;
  const thumbnailDataUrl = thumbnail?.status === "ready" ? thumbnail.dataUrl : undefined;
  const hasThumbnail = Boolean(thumbnailDataUrl);
  const contentInset = 14;
  const contentX = x + contentInset;
  const contentY = y + contentInset;
  const contentWidth = Math.max(96, width - contentInset * 2);
  const contentHeight = Math.max(72, height - contentInset * 2);
  const surfaceLabel = resolveTileSurfaceLabel(surface);
  const displayTitle = truncateTileText(surface.title, isFocused ? 74 : 54);
  const displaySnippet = surface.snippet ? truncateTileText(surface.snippet, isFocused ? 96 : 72) : undefined;
  const previewStatus = resolveTilePreviewStatus(surface, thumbnail, hasThumbnail);
  const titleText = createTileSurfaceText(displayTitle, {
    color: 0xf4f7fb,
    fontSize: isFocused ? 18 : 16,
    lineHeight: isFocused ? 22 : 19,
    wordWrapWidth: contentWidth - 18,
  });
  const metaText = createTileSurfaceText(
    surface.sourceHost ? `${surfaceLabel}  ${surface.sourceHost}` : surfaceLabel,
    {
      color: hasThumbnail ? 0xd9ebff : 0x9fb6cf,
      fontSize: 10,
      wordWrapWidth: contentWidth - 18,
    },
  );
  const snippetText = displaySnippet
    ? createTileSurfaceText(displaySnippet, {
        color: hasThumbnail ? 0xf2f7ff : 0xb8c7d9,
        fontSize: 10,
        lineHeight: 14,
        wordWrapWidth: contentWidth - 18,
      })
    : undefined;
  const previewStatusText = previewStatus
    ? createTileSurfaceText(previewStatus, {
        color: previewStatus === "preview failed" ? 0xffb5bd : 0x9fb6cf,
        fontSize: 9,
        wordWrapWidth: contentWidth - 18,
      })
    : undefined;
  const titleBottom = contentY + 30 + titleText.height;
  const snippetTop = Math.min(contentY + contentHeight - 54, titleBottom + 8);
  const contentPanel = new Graphics();
  const metaChip = new Graphics();
  const accentBar = new Graphics();

  frame
    .roundRect(x, y, width, height, 10)
    .fill({ color: getTileSurfaceColor(surface), alpha: hasThumbnail ? 0.32 : fillAlpha })
    .stroke({ color: isFocused ? 0x9bc0ff : 0x31425f, alpha: strokeAlpha, width: strokeWidth });

  if (thumbnailDataUrl) {
    const thumbnailSprite = Sprite.from(thumbnailDataUrl);
    const overlay = new Graphics();

    thumbnailSprite.x = x;
    thumbnailSprite.y = y;
    thumbnailSprite.width = width;
    thumbnailSprite.height = height;
    thumbnailSprite.alpha = isFocused ? 0.92 : 0.74;
    overlay.roundRect(x, y, width, height, 10).fill({
      color: 0x05080d,
      alpha: isFocused ? 0.2 : 0.34,
    });
    container.addChild(thumbnailSprite, overlay);
  } else if (thumbnail?.status === "loading") {
    const shimmer = new Graphics();
    const stripeWidth = Math.max(18, width / 8);

    for (let offset = -width; offset < width * 1.2; offset += stripeWidth * 2.2) {
      shimmer
        .rect(x + offset, y, stripeWidth, height)
        .fill({ color: 0x9bc0ff, alpha: isFocused ? 0.08 : 0.045 });
    }
    container.addChild(shimmer);
  } else if (thumbnail?.status === "failed") {
    frame.roundRect(x + 10, y + 10, Math.max(1, width - 20), 4, 2).fill({
      color: 0xb85d6b,
      alpha: 0.52,
    });
  } else {
    contentPanel.roundRect(contentX, contentY + 18, contentWidth, Math.max(60, contentHeight - 18), 10).fill({
      color: 0x143240,
      alpha: isFocused ? 0.88 : 0.7,
    });
    accentBar.roundRect(contentX, contentY, Math.min(42, contentWidth * 0.22), 5, 2).fill({
      color: 0x8db4ff,
      alpha: isFocused ? 0.92 : 0.7,
    });
    container.addChild(contentPanel, accentBar);
  }

  if (surface.absorption.progress > 0) {
    frame.roundRect(x + 6, y + 6, Math.max(1, (width - 12) * surface.absorption.progress), 4, 2).fill({
      color: 0x9bc0ff,
      alpha: 0.66,
    });
  }

  metaChip.roundRect(contentX, contentY, Math.min(contentWidth, metaText.width + 16), 18, 9).fill({
    color: hasThumbnail ? 0x0b1522 : 0x0f1c2d,
    alpha: hasThumbnail ? 0.42 : 0.92,
  });
  metaText.position.set(contentX + 8, contentY + 4);
  titleText.position.set(contentX + 2, contentY + 28);

  container.addChild(frame, metaChip, metaText, titleText);

  if (snippetText) {
    snippetText.position.set(contentX + 2, snippetTop);
    container.addChild(snippetText);
  }

  if (previewStatusText) {
    previewStatusText.position.set(contentX + 2, y + height - 24);
    container.addChild(previewStatusText);
  }

  return container;
}

function resolveTilePreviewStatus(
  surface: RenderableTileSurface,
  thumbnail: TileThumbnailState | undefined,
  hasThumbnail: boolean,
): string | undefined {
  if (hasThumbnail) {
    return undefined;
  }

  if (thumbnail?.status === "loading") {
    return "capturing preview";
  }

  if (thumbnail?.status === "failed") {
    return "preview failed";
  }

  if (surface.loadState === "renderer_visible" || surface.loadState === "renderer_focused" || surface.loadState === "thumbnail_ready") {
    return "preview queued";
  }

  return undefined;
}

function toTileSurfaceSyncBounds(bounds: RenderableTileSurface["screenBounds"]): { x: number; y: number; width: number; height: number } {
  if (!bounds) {
    return { x: 0, y: 0, width: 1, height: 1 };
  }

  return {
    x: Math.round(bounds.x),
    y: Math.round(bounds.y),
    width: Math.max(1, Math.round(bounds.width)),
    height: Math.max(1, Math.round(bounds.height)),
  };
}

function destroyPixiApplication(app: Application): void {
  const destroyableApp = app as Application & {
    destroy?: (rendererDestroyOptions?: false, options?: { children?: boolean }) => void;
    stop?: () => void;
    renderer?: Application["renderer"] & { canvas?: HTMLCanvasElement };
    stage?: Application["stage"];
  };
  const canvas = destroyableApp.renderer?.canvas;

  try {
    destroyableApp.stop?.();
    destroyableApp.destroy?.(false, { children: true });
  } catch (error) {
    console.warn("[SeekStar] Pixi cleanup skipped after renderer teardown.", error);
  } finally {
    canvas?.remove();
  }
}

function drawPixiBackground(stage: Container, bounds: DOMRect): void {
  const grid = new Graphics();
  const width = Math.max(1, bounds.width);
  const height = Math.max(1, bounds.height);

  for (let x = 0; x <= width; x += 48) {
    grid.moveTo(x, 0).lineTo(x, height);
  }

  for (let y = 0; y <= height; y += 48) {
    grid.moveTo(0, y).lineTo(width, y);
  }

  grid.stroke({ color: 0x6e9fff, alpha: 0.028, width: 1 });
  stage.addChild(grid);
}

function createRelationLine({
  from,
  isHighlighted,
  isSelected,
  onRelationSelect,
  relation,
  to,
}: {
  from: { x: number; y: number };
  isHighlighted: boolean;
  isSelected: boolean;
  onRelationSelect: (relationId: string) => void;
  relation: TerrainRelation;
  to: { x: number; y: number };
}): Container {
  const container = new Container();
  const line = new Graphics();
  const hitLine = new Graphics();
  const alpha = isSelected || isHighlighted ? 0.42 : 0.18;

  line.moveTo(from.x, from.y).lineTo(to.x, to.y).stroke({
    color: relation.source_state === "cartographer_primary" ? 0x46d8c6 : relation.source_state === "fog" ? 0x8b7aaa : 0x6e9fff,
    alpha,
    width: isSelected ? 2 : 1.2,
  });
  hitLine.moveTo(from.x, from.y).lineTo(to.x, to.y).stroke({ color: 0xffffff, alpha: 0.001, width: 12 });
  hitLine.eventMode = "static";
  hitLine.cursor = "pointer";
  bindPrimaryCanvasActivation(hitLine, () => onRelationSelect(relation.id));
  container.addChild(hitLine, line);

  return container;
}

function createMacroBubble({
  isFocused,
  isGhost,
  isHighlighted,
  isSelected,
  node,
  onHover,
  onHoverClear,
  onNodeSelect,
  radius,
  viewport,
}: {
  isFocused: boolean;
  isGhost: boolean;
  isHighlighted: boolean;
  isSelected: boolean;
  node: TerrainNode;
  onHover: (preview: HoverPreviewState) => void;
  onHoverClear: () => void;
  onNodeSelect: (nodeId: string) => void;
  radius: number;
  viewport: ViewportState;
}): Container {
  const container = new Container();
  const distance = getMacroLensDistance(node, viewport);
  const color = getMacroColor(node);
  const circle = new Graphics();
  const highlight = isSelected || isFocused || isHighlighted;
  const isCartographer = isCartographerTerrainNode(node);

  container.alpha = isGhost ? 0.2 : Math.max(0.32, 1 - distance * 0.52);
  circle.circle(0, 0, radius).fill({ color, alpha: 1 });
  circle.circle(-radius * 0.24, -radius * 0.28, radius * 0.36).fill({ color: 0xffffff, alpha: isCartographer ? 0.18 : 0.14 });
  if (isCartographer) {
    circle.circle(radius * 0.28, radius * 0.3, Math.max(4, radius * 0.08)).fill({ color: 0x46d8c6, alpha: 0.82 });
  }
  circle.circle(0, 0, radius).stroke({
    color: highlight ? 0x9bc0ff : isCartographer ? 0x45d0c2 : 0x0b1220,
    alpha: highlight ? 0.75 : isCartographer ? 0.46 : 0.38,
    width: highlight ? 2.4 : isCartographer ? 1.7 : 1.3,
  });

  const title = createPixiText(node.title, {
    color: 0xf4f7fb,
    fontSize: Math.max(10, Math.min(14, radius / 5)),
    wordWrapWidth: radius * 1.45,
  });
  const type = createPixiText(node.type.replace("_", " "), {
    color: isCartographer ? 0xb8f3ec : 0xc4d2e5,
    fontSize: 8,
    wordWrapWidth: radius * 1.3,
  });

  type.y = -radius * 0.22;
  title.y = radius * 0.1;
  container.addChild(circle, type, title);
  container.eventMode = isGhost ? "none" : "static";
  container.cursor = isGhost ? "default" : "pointer";
  container.hitArea = new Rectangle(-radius, -radius, radius * 2, radius * 2);
  bindPrimaryCanvasActivation(container, () => onNodeSelect(node.id));
  container.on("pointerover", (event) => onHover(createHoverPreview(node.title, node.type, node.source_state, node.summary, event.global)));
  container.on("pointerout", onHoverClear);

  return container;
}

function createDetailCard({
  isFocused,
  isGhost,
  isHighlighted,
  isSelected,
  node,
  onHover,
  onHoverClear,
  onNodeSelect,
}: {
  isFocused: boolean;
  isGhost: boolean;
  isHighlighted: boolean;
  isSelected: boolean;
  node: TerrainNode;
  onHover: (preview: HoverPreviewState) => void;
  onHoverClear: () => void;
  onNodeSelect: (nodeId: string) => void;
}): Container {
  const container = new Container();
  const width = getDetailCardWidth(node);
  const height = getDetailCardHeight(node);
  const highlight = isSelected || isFocused || isHighlighted;
  const card = new Graphics();
  const isCartographer = isCartographerTerrainNode(node);

  container.alpha = isGhost ? 0.24 : 1;
  card
    .roundRect(-width / 2, -height / 2, width, height, node.type === "word" || node.type === "phrase" ? height / 2 : 9)
    .fill({ color: getDetailColor(node), alpha: 0.92 })
    .stroke({
      color: highlight ? 0x8db4ff : isCartographer ? 0x45d0c2 : 0x263247,
      alpha: highlight ? 0.78 : isCartographer ? 0.62 : 0.8,
      width: highlight ? 2 : isCartographer ? 1.5 : 1,
    });

  if (isCartographer) {
    card.roundRect(-width / 2 + 10, -height / 2 + 10, 28, 4, 2).fill({ color: 0x46d8c6, alpha: 0.76 });
  }

  const type = createPixiText(node.type.replace("_", " "), {
    color: isCartographer ? 0xa7efe7 : 0x9aa7ba,
    fontSize: 9,
    wordWrapWidth: width - 26,
  });
  const title = createPixiText(node.title, {
    color: 0xf5f7fb,
    fontSize: node.type === "character" ? 34 : 13,
    wordWrapWidth: width - 26,
  });

  type.anchor.set(0, 0);
  title.anchor.set(0, 0);
  type.position.set(-width / 2 + 13, -height / 2 + 11);
  title.position.set(-width / 2 + 13, node.type === "character" ? -22 : -height / 2 + 30);
  container.addChild(card, type, title);
  container.eventMode = isGhost ? "none" : "static";
  container.cursor = isGhost ? "default" : "pointer";
  container.hitArea = new Rectangle(-width / 2, -height / 2, width, height);
  bindPrimaryCanvasActivation(container, () => onNodeSelect(node.id));
  container.on("pointerover", (event) => onHover(createHoverPreview(node.title, node.type, node.source_state, node.summary, event.global)));
  container.on("pointerout", onHoverClear);

  return container;
}

function createPixiText(text: string, options: { color: number; fontSize: number; wordWrapWidth: number }): Text {
  const label = new Text({
    text,
    style: {
      align: "center",
      fill: options.color,
      fontFamily: "Inter, Segoe UI, sans-serif",
      fontSize: options.fontSize,
      fontWeight: "600",
      leading: 1,
      wordWrap: true,
      wordWrapWidth: options.wordWrapWidth,
    },
  });

  label.anchor.set(0.5);

  return label;
}

function createTileSurfaceText(text: string, options: { color: number; fontSize: number; lineHeight?: number; wordWrapWidth: number }): Text {
  return new Text({
    text,
    style: {
      align: "left",
      breakWords: true,
      fill: options.color,
      fontFamily: "Segoe UI, Microsoft YaHei UI, sans-serif",
      fontSize: options.fontSize,
      fontWeight: "600",
      leading: options.lineHeight ?? 2,
      lineHeight: options.lineHeight,
      wordWrap: true,
      wordWrapWidth: options.wordWrapWidth,
    },
  });
}

function bindPrimaryCanvasActivation(target: Container | Graphics, onActivate: () => void): void {
  let lastActivationAt = 0;
  const invoke = (): void => {
    const now = performance.now();

    if (now - lastActivationAt < 40) {
      return;
    }

    lastActivationAt = now;
    onActivate();
  };

  target.on("click", invoke);
  target.on("rightclick", invoke);
}

function isCanvasPrimaryCompatibleButton(button: number): boolean {
  return button === 0 || button === 2;
}

function preventCanvasContextMenu(event: ReactMouseEvent<HTMLElement>): void {
  event.preventDefault();
}

function isCanvasEntityAtScreenPoint(
  point: CanvasPoint,
  bounds: { width: number; height: number },
  nodes: TerrainNode[],
  tileSurfaces: RenderableTileSurface[],
  viewport: ViewportState,
): boolean {
  const worldPoint = screenToWorld(point, viewport, bounds);

  if (
    tileSurfaces.some((surface) => {
      if (surface.visibility === "off_viewport") {
        return false;
      }

      return isPointInRect(worldPoint, surface.worldBounds);
    })
  ) {
    return true;
  }

  return nodes.some((node) => isWorldPointInsideNode(worldPoint, node, viewport));
}

function isWorldPointInsideNode(point: CanvasPoint, node: TerrainNode, viewport: ViewportState): boolean {
  const position = node.position_hint;

  if (!position) {
    return false;
  }

  const dx = point.x - position.x;
  const dy = point.y - position.y;

  if (isMacroBubbleNode(node)) {
    const radius = getMacroBubbleRadius(node, viewport);
    return dx * dx + dy * dy <= radius * radius;
  }

  const width = getDetailCardWidth(node);
  const height = getDetailCardHeight(node);

  return Math.abs(dx) <= width / 2 && Math.abs(dy) <= height / 2;
}

function isPointInRect(point: CanvasPoint, rect: { x: number; y: number; width: number; height: number }): boolean {
  return point.x >= rect.x && point.x <= rect.x + rect.width && point.y >= rect.y && point.y <= rect.y + rect.height;
}

function truncateTileText(value: string, maxCharacters: number): string {
  const normalized = value.replace(/\s+/gu, " ").trim();

  if (normalized.length <= maxCharacters) {
    return normalized;
  }

  return `${normalized.slice(0, Math.max(1, maxCharacters - 1)).trimEnd()}...`;
}

function createHoverPreview(
  title: string,
  type: string,
  state: string,
  summary: string | undefined,
  position: { x: number; y: number },
): HoverPreviewState {
  return {
    title,
    type,
    state,
    summary,
    position: {
      x: Math.max(12, Math.min(position.x + 14, window.innerWidth - 300)),
      y: Math.max(12, Math.min(position.y + 14, window.innerHeight - 190)),
    },
  };
}

function getMacroBubbleRadius(node: TerrainNode, viewport: ViewportState): number {
  const distance = getMacroLensDistance(node, viewport);

  return Math.max(34, 62 - distance * 18);
}

function getMacroColor(node: TerrainNode): number {
  if (isCartographerTerrainNode(node)) {
    return node.layer === "L0" ? 0x2d8f93 : node.layer === "L1" ? 0x3376a8 : node.layer === "L2" ? 0x356ba0 : 0x405eb8;
  }

  if (node.source_state === "fog") {
    return 0x7058b8;
  }

  if (node.source_state === "weak_hypothesis") {
    return 0x6d6ac7;
  }

  if (node.source_state === "source_backed") {
    return 0x2493b8;
  }

  if (node.source_state === "agent_inferred") {
    return 0x2f76b8;
  }

  return 0x5667d8;
}

function getTileSurfaceColor(surface: RenderableTileSurface): number {
  if (surface.resourceKind === "image") {
    return 0x182d34;
  }

  if (surface.resourceKind === "pdf") {
    return 0x1b2a38;
  }

  if (surface.sourceState === "source_backed") {
    return 0x123143;
  }

  if (surface.sourceState === "fog") {
    return 0x211c32;
  }

  if (surface.sourceState === "agent_inferred" || surface.sourceState === "generated") {
    return 0x1c2a48;
  }

  return 0x121a28;
}

function resolveTileSurfaceLabel(surface: RenderableTileSurface): string {
  if (surface.resourceKind === "image") {
    return "image";
  }

  if (surface.resourceKind === "pdf") {
    return "pdf";
  }

  if (surface.type === "document") {
    return "document";
  }

  return "webpage";
}

function getDetailColor(node: TerrainNode): number {
  if (isCartographerTerrainNode(node)) {
    return node.layer === "L3" ? 0x102734 : 0x122736;
  }

  if (node.source_state === "source_backed") {
    return 0x122b34;
  }

  if (node.source_state === "fog") {
    return 0x201b2c;
  }

  return 0x131a26;
}

function isCartographerTerrainNode(node: TerrainNode): boolean {
  return node.source_state === "cartographer_primary" || node.tags?.includes("cartographer") === true;
}

function traceTerrainCanvas(event: string, payload?: unknown): void {
  try {
    if (window.localStorage.getItem("seekstar.trace") === "0") {
      return;
    }

    if (!import.meta.env.DEV && window.localStorage.getItem("seekstar.trace") !== "1") {
      return;
    }
  } catch {
    if (!import.meta.env.DEV) {
      return;
    }
  }

  const suffix = payload === undefined ? "" : ` ${stringifyTerrainCanvasTracePayload(payload)}`;
  console.info(`[SeekStar][terrain-canvas] ${event}${suffix}`);
}

function stringifyTerrainCanvasTracePayload(payload: unknown): string {
  try {
    return JSON.stringify(payload, (_key, value: unknown) => {
      if (typeof value === "string" && value.length > 800) {
        return `${value.slice(0, 800)}...<truncated ${value.length - 800} chars>`;
      }

      return value;
    });
  } catch (error) {
    return JSON.stringify({
      trace_error: error instanceof Error ? error.message : String(error),
    });
  }
}

function getDetailCardWidth(node: TerrainNode): number {
  if (node.type === "paragraph" || node.type === "sentence") {
    return 440;
  }

  if (node.type === "dictionary_entry" || node.type === "unicode") {
    return 330;
  }

  if (node.type === "word" || node.type === "phrase") {
    return 220;
  }

  if (node.type === "character") {
    return 118;
  }

  return 190;
}

function getDetailCardHeight(node: TerrainNode): number {
  if (node.type === "paragraph") {
    return 140;
  }

  if (node.type === "sentence" || node.type === "dictionary_entry" || node.type === "unicode") {
    return 104;
  }

  if (node.type === "character") {
    return 118;
  }

  return 86;
}

function ViewportControls({
  canFocusSelection,
  onFitScene,
  onFocusSelection,
  onResetViewport,
}: {
  canFocusSelection: boolean;
  onFitScene: () => void;
  onFocusSelection: () => void;
  onResetViewport: () => void;
}): ReactElement {
  return (
    <div
      className="viewport-controls"
      aria-label="Viewport controls"
      onPointerDown={(event) => {
        event.stopPropagation();
      }}
    >
      <button aria-label="Fit map to visible terrain" onClick={onFitScene} title="Fit map" type="button">
        <Maximize2 aria-hidden="true" size={14} strokeWidth={1.8} />
      </button>
      <button
        aria-label="Focus selected terrain"
        disabled={!canFocusSelection}
        onClick={onFocusSelection}
        title="Focus selection"
        type="button"
      >
        <LocateFixed aria-hidden="true" size={14} strokeWidth={1.8} />
      </button>
      <button aria-label="Reset viewport" onClick={onResetViewport} title="Reset view" type="button">
        <RotateCcw aria-hidden="true" size={14} strokeWidth={1.8} />
      </button>
    </div>
  );
}

function NodeHoverPreview({ preview }: { preview: HoverPreviewState }): ReactElement {
  return (
    <aside
      className="node-hover-preview"
      style={{
        left: preview.position.x,
        top: preview.position.y,
      }}
      aria-hidden="true"
    >
      <span>{preview.type.replace("_", " ")}</span>
      <strong>{preview.title}</strong>
      {preview.summary ? <p>{preview.summary}</p> : null}
      <dl>
        <div>
          <dt>State</dt>
          <dd>{preview.state.replace("_", " ")}</dd>
        </div>
      </dl>
    </aside>
  );
}

function isMacroBubbleNode(node: TerrainNode): boolean {
  return isMacroLayer(node.layer);
}

function getMacroLensDistance(node: TerrainNode, viewport: ViewportState): number {
  const position = node.position_hint ?? { x: 0, y: 0 };
  const distance = Math.hypot(position.x - viewport.x, position.y - viewport.y);

  return Math.min(1, distance / 620);
}
