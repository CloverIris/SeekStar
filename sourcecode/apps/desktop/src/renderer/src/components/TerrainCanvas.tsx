import type { LayerId, TerrainLayer, TerrainNode, TerrainRelation, TerrainScene, ViewportState } from "@seekstar/core-schema";
import type { PointerEvent, ReactElement } from "react";
import { useEffect, useRef, useState } from "react";
import { LocateFixed, Maximize2, RotateCcw } from "lucide-react";
import {
  type CanvasPoint,
  type CanvasTool,
  type LassoDraft,
  fitViewportToNodes,
  normalizeRect,
  resetViewport,
  resolveZoomForLayer,
  screenToWorld,
  selectNodesInRect,
  zoomViewportAtScreenPoint,
} from "../canvas/interaction";

interface TerrainCanvasProps {
  activeTool: CanvasTool;
  focusedNodeId?: string;
  highlightedNodeIds: string[];
  onNodeSelect: (nodeId: string) => void;
  onRelationSelect: (relationId: string) => void;
  onSelectionChange: (nodeIds: string[], focusNodeId?: string, showSelectionActions?: boolean) => void;
  onViewportChange: (viewport: ViewportState) => void;
  scene: TerrainScene;
  selectedNodeIds: string[];
  selectedRelationId?: string;
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
  node: TerrainNode;
  relationCount: number;
  position: CanvasPoint;
}

export function TerrainCanvas({
  activeTool,
  focusedNodeId,
  highlightedNodeIds,
  onNodeSelect,
  onRelationSelect,
  onSelectionChange,
  onViewportChange,
  scene,
  selectedNodeIds,
  selectedRelationId,
  viewport,
}: TerrainCanvasProps): ReactElement {
  const canvasRef = useRef<HTMLElement | null>(null);
  const viewportRef = useRef(viewport);
  const onViewportChangeRef = useRef(onViewportChange);
  const [dragState, setDragState] = useState<CanvasDragState | undefined>();
  const [hoverPreview, setHoverPreview] = useState<HoverPreviewState | undefined>();
  const lassoRect = dragState?.mode === "lasso" ? normalizeRect(dragState.draft.start, dragState.draft.current) : undefined;

  useEffect(() => {
    viewportRef.current = viewport;
    onViewportChangeRef.current = onViewportChange;
  }, [onViewportChange, viewport]);

  useEffect(() => {
    const element = canvasRef.current;

    if (!element) {
      return undefined;
    }

    const target = element;

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

  function pointFromEvent(event: PointerEvent<HTMLElement>): CanvasPoint {
    const bounds = event.currentTarget.getBoundingClientRect();

    return {
      x: event.clientX - bounds.left,
      y: event.clientY - bounds.top,
    };
  }

  function previewPositionFromEvent(event: PointerEvent<HTMLElement>): CanvasPoint | undefined {
    const bounds = canvasRef.current?.getBoundingClientRect();

    if (!bounds) {
      return undefined;
    }

    const width = 260;
    const height = 138;

    return {
      x: Math.max(12, Math.min(event.clientX - bounds.left + 14, bounds.width - width - 12)),
      y: Math.max(12, Math.min(event.clientY - bounds.top + 14, bounds.height - height - 12)),
    };
  }

  function isCanvasPanTarget(event: PointerEvent<HTMLElement>): boolean {
    const target = event.target;

    if (!(target instanceof Element)) {
      return true;
    }

    return !target.closest(".terrain-node, .terrain-relation-hit");
  }

  function handlePointerDown(event: PointerEvent<HTMLElement>): void {
    if (event.button !== 0) {
      return;
    }

    if (activeTool === "pan" || (activeTool === "pointer" && isCanvasPanTarget(event))) {
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

      onViewportChange({
        ...dragState.viewport,
        x: dragState.viewport.x - deltaX / dragState.viewport.zoom,
        y: dragState.viewport.y - deltaY / dragState.viewport.zoom,
      });
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
        const selectedIds = selectNodesInRect(scene.nodes, normalizeRect(worldStart, worldEnd));

        onSelectionChange(selectedIds, undefined, selectedIds.length > 0);
      }
    }

    setDragState(undefined);
  }

  function handlePointerCancel(): void {
    setDragState(undefined);
    setHoverPreview(undefined);
  }

  function handleNodePreview(node: TerrainNode, event: PointerEvent<HTMLElement>): void {
    if (activeTool !== "pointer" || dragState) {
      return;
    }

    const position = previewPositionFromEvent(event);

    if (!position) {
      return;
    }

    setHoverPreview({
      node,
      position,
      relationCount: scene.relations.filter((relation) => relation.from === node.id || relation.to === node.id).length,
    });
  }

  function handleNodePreviewClear(): void {
    setHoverPreview(undefined);
  }

  function getCanvasBounds(): DOMRect | undefined {
    return canvasRef.current?.getBoundingClientRect();
  }

  function handleFitScene(): void {
    const bounds = getCanvasBounds();

    if (!bounds) {
      return;
    }

    onViewportChange(fitViewportToNodes(scene.nodes, bounds, viewport));
    setHoverPreview(undefined);
  }

  function handleFocusSelection(): void {
    const bounds = getCanvasBounds();

    if (!bounds || selectedNodeIds.length === 0) {
      return;
    }

    onViewportChange(
      fitViewportToNodes(scene.nodes, bounds, viewport, {
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

  return (
    <section
      className={`canvas-plane canvas-tool-${activeTool}`}
      aria-label="Cognitive canvas"
      onPointerCancel={handlePointerCancel}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      ref={canvasRef}
    >
      <div
        className="canvas-world"
        style={{
          transform: `matrix(${viewport.zoom}, 0, 0, ${viewport.zoom}, ${-viewport.x * viewport.zoom}, ${-viewport.y * viewport.zoom})`,
        }}
      >
        <TerrainRelations
          highlightedNodeIds={highlightedNodeIds}
          nodes={scene.nodes}
          onRelationSelect={onRelationSelect}
          relations={scene.relations}
          selectedRelationId={selectedRelationId}
          selectedNodeIds={selectedNodeIds}
          tool={activeTool}
          viewportLayer={viewport.layer}
        />
        {scene.nodes.map((node) => (
          <TerrainNodeCard
            isFocused={focusedNodeId === node.id}
            isHighlighted={highlightedNodeIds.includes(node.id)}
            isLayerMuted={node.layer !== viewport.layer}
            isSelected={selectedNodeIds.includes(node.id)}
            key={node.id}
            node={node}
            onPreview={handleNodePreview}
            onPreviewClear={handleNodePreviewClear}
            onSelect={onNodeSelect}
            tool={activeTool}
          />
        ))}
      </div>
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
      {hoverPreview ? <NodeHoverPreview preview={hoverPreview} /> : null}
    </section>
  );
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

function TerrainRelations({
  highlightedNodeIds,
  nodes,
  onRelationSelect,
  relations,
  selectedRelationId,
  selectedNodeIds,
  tool,
  viewportLayer,
}: {
  highlightedNodeIds: string[];
  nodes: TerrainNode[];
  onRelationSelect: (relationId: string) => void;
  relations: TerrainRelation[];
  selectedRelationId?: string;
  selectedNodeIds: string[];
  tool: CanvasTool;
  viewportLayer: string;
}): ReactElement {
  const nodesById = new Map(nodes.map((node) => [node.id, node]));

  return (
    <svg aria-hidden="true" className="terrain-relations" focusable="false">
      {relations.map((relation) => {
        const fromNode = nodesById.get(relation.from);
        const toNode = nodesById.get(relation.to);
        const from = fromNode?.position_hint;
        const to = toNode?.position_hint;

        if (!fromNode || !toNode || !from || !to) {
          return null;
        }

        const isSelected = relation.id === selectedRelationId || selectedNodeIds.includes(fromNode.id) || selectedNodeIds.includes(toNode.id);
        const isHighlighted = highlightedNodeIds.includes(fromNode.id) || highlightedNodeIds.includes(toNode.id);
        const isLayerMuted = fromNode.layer !== viewportLayer && toNode.layer !== viewportLayer;

        return (
          <g className="terrain-relation-group" key={relation.id}>
            <line
              className="terrain-relation-hit"
              onClick={(event) => {
                if (tool !== "pointer") {
                  return;
                }

                event.stopPropagation();
                onRelationSelect(relation.id);
              }}
              x1={from.x}
              x2={to.x}
              y1={from.y}
              y2={to.y}
            />
            <line
              className={`terrain-relation${isSelected ? " is-selected" : ""}${isHighlighted ? " is-highlighted" : ""}${isLayerMuted ? " is-layer-muted" : ""}`}
              data-relation-type={relation.type}
              data-source-state={relation.source_state}
              x1={from.x}
              x2={to.x}
              y1={from.y}
              y2={to.y}
            >
              <title>{`${relation.type.replace("_", " ")}: ${fromNode.title} -> ${toNode.title}`}</title>
            </line>
          </g>
        );
      })}
    </svg>
  );
}

function TerrainNodeCard({
  isFocused,
  isHighlighted,
  isLayerMuted,
  isSelected,
  node,
  onPreview,
  onPreviewClear,
  onSelect,
  tool,
}: {
  isFocused: boolean;
  isHighlighted: boolean;
  isLayerMuted: boolean;
  isSelected: boolean;
  node: TerrainNode;
  onPreview: (node: TerrainNode, event: PointerEvent<HTMLElement>) => void;
  onPreviewClear: () => void;
  onSelect: (nodeId: string) => void;
  tool: CanvasTool;
}): ReactElement {
  return (
    <button
      className={`terrain-node ${nodeClassName(node)}${isSelected ? " is-selected" : ""}${isHighlighted ? " is-highlighted" : ""}${isFocused ? " is-focused" : ""}${isLayerMuted ? " is-layer-muted" : ""}`}
      data-layer={node.layer}
      data-source-state={node.source_state}
      onClick={(event) => {
        if (tool !== "pointer") {
          return;
        }

        event.stopPropagation();
        onSelect(node.id);
      }}
      onPointerEnter={(event) => onPreview(node, event)}
      onPointerLeave={onPreviewClear}
      onPointerMove={(event) => onPreview(node, event)}
      style={{
        left: node.position_hint?.x ?? 0,
        top: node.position_hint?.y ?? 0,
      }}
      type="button"
    >
      <span className="node-type">{node.type.replace("_", " ")}</span>
      <h2>{node.title}</h2>
      {node.summary ? <p>{node.summary}</p> : null}
    </button>
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
      <span>{preview.node.type.replace("_", " ")}</span>
      <strong>{preview.node.title}</strong>
      {preview.node.summary ? <p>{preview.node.summary}</p> : null}
      <dl>
        <div>
          <dt>State</dt>
          <dd>{preview.node.source_state.replace("_", " ")}</dd>
        </div>
        <div>
          <dt>Confidence</dt>
          <dd>{Math.round(preview.node.confidence * 100)}%</dd>
        </div>
        <div>
          <dt>Relations</dt>
          <dd>{preview.relationCount}</dd>
        </div>
      </dl>
    </aside>
  );
}

function nodeClassName(node: TerrainNode): string {
  if (node.type === "fog_region") {
    return "terrain-node-fog";
  }

  if (node.tags.includes("seed")) {
    return "terrain-node-seed";
  }

  return "terrain-node-default";
}
