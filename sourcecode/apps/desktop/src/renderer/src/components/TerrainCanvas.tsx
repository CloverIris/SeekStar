import type {
  LayerId,
  ScoutObservation,
  TerrainLayer,
  TerrainNode,
  TerrainRelation,
  TerrainScene,
  ViewportState,
} from "@seekstar/core-schema";
import { isMacroLayer } from "@seekstar/core-schema";
import type { PointerEvent, ReactElement } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { LocateFixed, Maximize2, RotateCcw } from "lucide-react";
import "pixi.js/unsafe-eval";
import { Application, Container, Graphics, Rectangle, Sprite, Text } from "pixi.js";
import {
  createTerrainPixiProjection,
  type CanvasPoint,
  type CanvasTool,
  type LassoDraft,
  type ProjectionViewportBounds,
  type TerrainTileSurface,
  fitViewportToNodes,
  normalizeRect,
  resetViewport,
  resolveZoomForLayer,
  screenToWorld,
  selectNodesInRect,
  zoomViewportAtScreenPoint,
} from "@seekstar/constellation-engine";

interface TerrainCanvasProps {
  activeTool: CanvasTool;
  focusedNodeId?: string;
  highlightedNodeIds: string[];
  onFrontierDiscovery: (viewport: ViewportState) => void;
  onBrowserModeExit: () => void;
  onNodeSelect: (nodeId: string) => void;
  onObservationSelect: (observationId: string) => void;
  onRelationSelect: (relationId: string) => void;
  onSelectionChange: (nodeIds: string[], focusNodeId?: string, showSelectionActions?: boolean) => void;
  onTileAbsorptionThreshold: (nodeId: string) => void;
  onViewportChange: (viewport: ViewportState) => void;
  scene: TerrainScene;
  selectedNodeIds: string[];
  selectedObservationId?: string;
  selectedRelationId?: string;
  tileFieldTargetCount?: number;
  viewport: ViewportState;
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

export function TerrainCanvas({
  activeTool,
  focusedNodeId,
  highlightedNodeIds,
  onBrowserModeExit,
  onFrontierDiscovery,
  onNodeSelect,
  onObservationSelect,
  onRelationSelect,
  onSelectionChange,
  onTileAbsorptionThreshold,
  onViewportChange,
  scene,
  selectedNodeIds,
  selectedObservationId,
  selectedRelationId,
  tileFieldTargetCount,
  viewport,
}: TerrainCanvasProps): ReactElement {
  const hostRef = useRef<HTMLElement | null>(null);
  const appRef = useRef<Application | null>(null);
  const viewportRef = useRef(viewport);
  const onViewportChangeRef = useRef(onViewportChange);
  const onFrontierDiscoveryRef = useRef(onFrontierDiscovery);
  const onNodeSelectRef = useRef(onNodeSelect);
  const onObservationSelectRef = useRef(onObservationSelect);
  const onRelationSelectRef = useRef(onRelationSelect);
  const [pixiReady, setPixiReady] = useState(false);
  const [viewportBounds, setViewportBounds] = useState<ProjectionViewportBounds | undefined>();
  const [dragState, setDragState] = useState<CanvasDragState | undefined>();
  const [hoverPreview, setHoverPreview] = useState<HoverPreviewState | undefined>();
  const [tileThumbnailsByNodeId, setTileThumbnailsByNodeId] = useState<Map<string, TileThumbnailState>>(() => new Map());
  const lassoRect = dragState?.mode === "lasso" ? normalizeRect(dragState.draft.start, dragState.draft.current) : undefined;
  const { candidateObservations, renderedNodes, tileSurfaces, visibleNodes, visibleNodeIds, visibleRelations } = useMemo(
    () =>
      createTerrainPixiProjection(scene, viewport, {
        absorbedNodeId: scene.runtime.browser_absorption.status === "absorbed" ? scene.runtime.browser_absorption.node_id : undefined,
        focusedNodeId,
        tileFieldTargetCount,
        viewportBounds,
      }),
    [focusedNodeId, scene, tileFieldTargetCount, viewport, viewportBounds],
  );
  const absorbedTileSurface = tileSurfaces.find((surface) => surface.absorption.shouldAbsorb && surface.sourceUrl);

  useEffect(() => {
    viewportRef.current = viewport;
    onViewportChangeRef.current = onViewportChange;
    onFrontierDiscoveryRef.current = onFrontierDiscovery;
    onNodeSelectRef.current = onNodeSelect;
    onObservationSelectRef.current = onObservationSelect;
    onRelationSelectRef.current = onRelationSelect;
  }, [onFrontierDiscovery, onNodeSelect, onObservationSelect, onRelationSelect, onViewportChange, viewport]);

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

  useEffect(() => {
    const app = appRef.current;
    const host = hostRef.current;

    if (!pixiReady || !app || !host) {
      return;
    }

    renderPixiScene({
      app,
      candidateObservations,
      focusedNodeId,
      highlightedNodeIds,
      host,
      onHover: setHoverPreview,
      onHoverClear: () => setHoverPreview(undefined),
      onNodeSelect: (nodeId) => onNodeSelectRef.current(nodeId),
      onObservationSelect: (observationId) => onObservationSelectRef.current(observationId),
      onRelationSelect: (relationId) => onRelationSelectRef.current(relationId),
      renderedNodes,
      selectedNodeIds,
      selectedObservationId,
      selectedRelationId,
      tileThumbnailsByNodeId,
      tileSurfaces,
      visibleNodeIds,
      visibleRelations,
      viewport,
    });
  }, [
    candidateObservations,
    focusedNodeId,
    highlightedNodeIds,
    pixiReady,
    renderedNodes,
    scene,
    selectedNodeIds,
    selectedObservationId,
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
      (surface) => surface.sourceUrl && (surface.absorption.shouldAbsorb || surface.visibility === "focused" || surface.visibility === "visible"),
    );
    const syncInput = {
      tabId: scene.active_tab_id,
      surfaces: surfaces.map((surface) => ({
        bounds: surface.absorption.shouldAbsorb
          ? {
              x: hostRect.left,
              y: hostRect.top + exitLabelHeight,
              width: hostRect.width,
              height: Math.max(1, hostRect.height - exitLabelHeight),
            }
          : toTileSurfaceSyncBounds(surface.screenBounds),
        loadPriority: surface.loadPriority,
        loadState: surface.absorption.shouldAbsorb ? ("renderer_focused" as const) : surface.loadState,
        nodeId: surface.nodeId,
        renderMode: surface.absorption.shouldAbsorb ? ("live" as const) : ("thumbnail" as const),
        sourceId: surface.sourceId,
        sourceUrl: surface.sourceUrl ?? "",
        title: surface.title,
        visibility: surface.visibility,
      })),
    };

    void window.seekstar.tiles.sync(syncInput);
  }, [scene.active_tab_id, tileSurfaces]);

  useEffect(() => {
    if (scene.runtime.browser_absorption.status === "absorbed") {
      return;
    }

    const thresholdSurface = tileSurfaces.find((surface) => surface.absorption.shouldAbsorb && surface.sourceUrl);

    if (thresholdSurface) {
      onTileAbsorptionThreshold(thresholdSurface.nodeId);
    }
  }, [onTileAbsorptionThreshold, scene.runtime.browser_absorption.status, tileSurfaces]);

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
    if (event.button !== 0) {
      return;
    }

    if (activeTool === "pan" || activeTool === "pointer") {
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

  function handleLayerSelect(layer: LayerId): void {
    const zoom = resolveZoomForLayer(layer);

    onViewportChange({
      ...viewport,
      zoom,
      layer,
    });
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
      <ViewportControls
        canFocusSelection={selectedNodeIds.length > 0}
        onFitScene={handleFitScene}
        onFocusSelection={handleFocusSelection}
        onResetViewport={handleResetViewport}
      />
      <SemanticLayerRail
        currentLayer={viewport.layer}
        layers={scene.layers}
        onLayerSelect={handleLayerSelect}
        zoom={viewport.zoom}
      />
      <DeepZoomMiniMap currentLayer={viewport.layer} layers={scene.layers} nodes={scene.nodes} onLayerSelect={handleLayerSelect} />
      {absorbedTileSurface ? (
        <button className="browser-absorption-exit" onClick={handleExitBrowserMode} type="button">
          Click exit browser mode to keep exploring downward
        </button>
      ) : null}
      {hoverPreview ? <NodeHoverPreview preview={hoverPreview} /> : null}
    </section>
  );
}

function renderPixiScene({
  app,
  candidateObservations,
  focusedNodeId,
  highlightedNodeIds,
  host,
  onHover,
  onHoverClear,
  onNodeSelect,
  onObservationSelect,
  onRelationSelect,
  renderedNodes,
  selectedNodeIds,
  selectedObservationId,
  selectedRelationId,
  tileThumbnailsByNodeId,
  tileSurfaces,
  visibleNodeIds,
  visibleRelations,
  viewport,
}: {
  app: Application;
  candidateObservations: ScoutObservation[];
  focusedNodeId?: string;
  highlightedNodeIds: string[];
  host: HTMLElement;
  onHover: (preview: HoverPreviewState) => void;
  onHoverClear: () => void;
  onNodeSelect: (nodeId: string) => void;
  onObservationSelect: (observationId: string) => void;
  onRelationSelect: (relationId: string) => void;
  renderedNodes: TerrainNode[];
  selectedNodeIds: string[];
  selectedObservationId?: string;
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
  const observationLayer = new Container();

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

  for (const observation of candidateObservations) {
    const position = observation.position_hint;

    if (!position) {
      continue;
    }

    const displayObject = createObservationStar({
      isSelected: selectedObservationId === observation.id,
      observation,
      onHover,
      onHoverClear,
      onObservationSelect,
      viewport,
    });

    displayObject.position.set(position.x, position.y);
    observationLayer.addChild(displayObject);
  }

  world.addChild(tileSurfaceLayer, relationLayer, observationLayer, nodeLayer);
  stage.addChild(world);
}

function createTileSurfaceFrame(surface: TerrainTileSurface, thumbnail?: TileThumbnailState): Container {
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
  }

  if (surface.absorption.progress > 0) {
    frame.roundRect(x + 6, y + 6, Math.max(1, (width - 12) * surface.absorption.progress), 4, 2).fill({
      color: 0x9bc0ff,
      alpha: 0.66,
    });
  }

  container.addChild(frame);
  return container;
}

function toTileSurfaceSyncBounds(bounds: TerrainTileSurface["screenBounds"]): { x: number; y: number; width: number; height: number } {
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
    color: relation.source_state === "fog" ? 0x8b7aaa : 0x6e9fff,
    alpha,
    width: isSelected ? 2 : 1.2,
  });
  hitLine.moveTo(from.x, from.y).lineTo(to.x, to.y).stroke({ color: 0xffffff, alpha: 0.001, width: 12 });
  hitLine.eventMode = "static";
  hitLine.cursor = "pointer";
  hitLine.on("pointertap", () => onRelationSelect(relation.id));
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

  container.alpha = isGhost ? 0.2 : Math.max(0.32, 1 - distance * 0.52);
  circle.circle(0, 0, radius).fill({ color, alpha: 1 });
  circle.circle(-radius * 0.24, -radius * 0.28, radius * 0.36).fill({ color: 0xffffff, alpha: 0.14 });
  circle.circle(0, 0, radius).stroke({
    color: highlight ? 0x9bc0ff : 0x0b1220,
    alpha: highlight ? 0.75 : 0.38,
    width: highlight ? 2.4 : 1.3,
  });

  const title = createPixiText(node.title, {
    color: 0xf4f7fb,
    fontSize: Math.max(10, Math.min(14, radius / 5)),
    wordWrapWidth: radius * 1.45,
  });
  const type = createPixiText(node.type.replace("_", " "), {
    color: 0xc4d2e5,
    fontSize: 8,
    wordWrapWidth: radius * 1.3,
  });

  type.y = -radius * 0.22;
  title.y = radius * 0.1;
  container.addChild(circle, type, title);
  container.eventMode = isGhost ? "none" : "static";
  container.cursor = isGhost ? "default" : "pointer";
  container.hitArea = new Rectangle(-radius, -radius, radius * 2, radius * 2);
  container.on("pointertap", () => onNodeSelect(node.id));
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

  container.alpha = isGhost ? 0.24 : 1;
  card
    .roundRect(-width / 2, -height / 2, width, height, node.type === "word" || node.type === "phrase" ? height / 2 : 9)
    .fill({ color: getDetailColor(node), alpha: 0.92 })
    .stroke({ color: highlight ? 0x8db4ff : 0x263247, alpha: highlight ? 0.78 : 0.8, width: highlight ? 2 : 1 });

  const type = createPixiText(node.type.replace("_", " "), {
    color: 0x9aa7ba,
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
  container.on("pointertap", () => onNodeSelect(node.id));
  container.on("pointerover", (event) => onHover(createHoverPreview(node.title, node.type, node.source_state, node.summary, event.global)));
  container.on("pointerout", onHoverClear);

  return container;
}

function createObservationStar({
  isSelected,
  observation,
  onHover,
  onHoverClear,
  onObservationSelect,
  viewport,
}: {
  isSelected: boolean;
  observation: ScoutObservation;
  onHover: (preview: HoverPreviewState) => void;
  onHoverClear: () => void;
  onObservationSelect: (observationId: string) => void;
  viewport: ViewportState;
}): Container {
  const container = new Container();
  const position = observation.position_hint ?? { x: 0, y: 0 };
  const distance = Math.min(1, Math.hypot(position.x - viewport.x, position.y - viewport.y) / 720);
  const radius = 30 - distance * 8;
  const color = getObservationColor(observation);
  const star = new Graphics();

  container.alpha = observation.status === "failed" ? 0.46 : Math.max(0.42, 0.92 - distance * 0.34);
  star.circle(0, 0, radius).fill({ color, alpha: 1 });
  star.circle(-radius * 0.22, -radius * 0.24, radius * 0.34).fill({ color: 0xffffff, alpha: 0.16 });
  star.circle(0, 0, radius).stroke({ color: isSelected ? 0xffffff : 0x0b1220, alpha: isSelected ? 0.92 : 0.55, width: isSelected ? 2.4 : 1.2 });

  const label = createPixiText(observation.title, {
    color: 0xf5f7fb,
    fontSize: 9,
    wordWrapWidth: radius * 1.55,
  });

  container.addChild(star, label);
  container.eventMode = "static";
  container.cursor = "pointer";
  container.hitArea = new Rectangle(-radius, -radius, radius * 2, radius * 2);
  container.on("pointertap", () => onObservationSelect(observation.id));
  container.on(
    "pointerover",
    (event) =>
      onHover(
        createHoverPreview(
          observation.title,
          `Scout ${observation.status.replace("_", " ")}`,
          observation.adapter ?? "playwright",
          observation.snippet,
          event.global,
        ),
      ),
  );
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

  return Math.max(42, 76 - distance * 26);
}

function getMacroColor(node: TerrainNode): number {
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

function getObservationColor(observation: ScoutObservation): number {
  if (observation.status === "failed") {
    return 0x515866;
  }

  if (observation.status === "pending") {
    return 0x7674d8;
  }

  if (observation.status === "observed") {
    return 0x2b8fb8;
  }

  return 0x20a6c7;
}

function getTileSurfaceColor(surface: TerrainTileSurface): number {
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

function getDetailColor(node: TerrainNode): number {
  if (node.source_state === "source_backed") {
    return 0x122b34;
  }

  if (node.source_state === "fog") {
    return 0x201b2c;
  }

  return 0x131a26;
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

function SemanticLayerRail({
  currentLayer,
  layers,
  onLayerSelect,
  zoom,
}: {
  currentLayer: LayerId;
  layers: TerrainLayer[];
  onLayerSelect: (layer: LayerId) => void;
  zoom: number;
}): ReactElement {
  return (
    <aside
      className="semantic-layer-rail"
      aria-label="Semantic zoom layers"
      onPointerDown={(event) => {
        event.stopPropagation();
      }}
    >
      <div className="semantic-layer-rail-header">
        <span>Semantic depth</span>
        <strong>{zoom.toFixed(2)}x</strong>
      </div>
      <div className="semantic-layer-list">
        {layers.map((layer) => (
          <button
            aria-pressed={layer.id === currentLayer}
            className={layer.id === currentLayer ? "semantic-layer-item active" : "semantic-layer-item"}
            key={layer.id}
            onClick={() => onLayerSelect(layer.id)}
            type="button"
          >
            <span>{layer.id}</span>
            <strong>{layer.label}</strong>
          </button>
        ))}
      </div>
    </aside>
  );
}

function DeepZoomMiniMap({
  currentLayer,
  layers,
  nodes,
  onLayerSelect,
}: {
  currentLayer: LayerId;
  layers: TerrainLayer[];
  nodes: TerrainNode[];
  onLayerSelect: (layer: LayerId) => void;
}): ReactElement {
  return (
    <aside
      className="deep-zoom-minimap"
      aria-label="Deep zoom mini map"
      onPointerDown={(event) => {
        event.stopPropagation();
      }}
    >
      <div className="deep-zoom-minimap-header">
        <span>Spine</span>
        <strong>{currentLayer}</strong>
      </div>
      <div className="deep-zoom-minimap-track">
        {layers.map((layer) => {
          const nodeCount = nodes.filter((node) => node.layer === layer.id).length;

          return (
            <button
              aria-label={`${layer.id} ${layer.label}, ${nodeCount} nodes`}
              aria-pressed={layer.id === currentLayer}
              className={layer.id === currentLayer ? "deep-zoom-minimap-dot active" : "deep-zoom-minimap-dot"}
              key={layer.id}
              onClick={() => onLayerSelect(layer.id)}
              title={`${layer.id} · ${layer.label} · ${nodeCount} nodes`}
              type="button"
            >
              <span />
            </button>
          );
        })}
      </div>
    </aside>
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
