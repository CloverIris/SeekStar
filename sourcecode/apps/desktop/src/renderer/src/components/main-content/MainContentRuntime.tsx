import { isMacroLayer } from "@seekstar/core-schema";
import type { ScoutObservation, TerrainNode, TerrainRelation, TerrainScene, ViewportState } from "@seekstar/core-schema";
import type { ReactElement } from "react";
import { useMemo } from "react";
import {
  createTerrainPixiProjection,
  type CandidateTileSurface,
  type MainContentProjection,
  type ProjectionViewportBounds,
  type TerrainTileSurface,
} from "@seekstar/constellation-engine";

export interface MainContentRuntime {
  candidateObservations: ScoutObservation[];
  candidateTileSurfaces: CandidateTileSurface[];
  mainContent: MainContentProjection;
  renderedNodes: TerrainNode[];
  sourceTileSurfaces: TerrainTileSurface[];
  visibleCandidateObservations: ScoutObservation[];
  visibleCandidateTileSurfaces: CandidateTileSurface[];
  visibleNodeIds: Set<string>;
  visibleNodes: TerrainNode[];
  visibleRelations: TerrainRelation[];
}

export interface MainContentRuntimeInput {
  absorbedNodeId?: string;
  focusedNodeId?: string;
  scene: TerrainScene;
  selectedObservationId?: string;
  tileFieldTargetCount?: number;
  viewport: ViewportState;
  viewportBounds?: ProjectionViewportBounds;
}

export function useMainContentRuntime(input: MainContentRuntimeInput): MainContentRuntime {
  return useMemo(() => {
    const projection = createTerrainPixiProjection(input.scene, input.viewport, {
      absorbedNodeId: input.absorbedNodeId,
      focusedObservationId: input.selectedObservationId,
      focusedNodeId: input.focusedNodeId,
      tileFieldTargetCount: input.tileFieldTargetCount,
      viewportBounds: input.viewportBounds,
    });
    const renderedNodes = filterRenderableMainContentNodes(projection.renderedNodes, projection.mainContent.mode);
    const renderedNodeIds = new Set(renderedNodes.map((node) => node.id));
    const visibleNodeIds = new Set(Array.from(projection.visibleNodeIds).filter((nodeId) => renderedNodeIds.has(nodeId)));
    const visibleNodes = projection.visibleNodes.filter((node) => renderedNodeIds.has(node.id));
    const visibleRelations = projection.visibleRelations.filter(
      (relation) => renderedNodeIds.has(relation.from) && renderedNodeIds.has(relation.to),
    );
    const showCandidateField = projection.mainContent.mode === "source_candidate_field";

    return {
      candidateObservations: projection.candidateObservations,
      candidateTileSurfaces: projection.candidateTileSurfaces,
      mainContent: projection.mainContent,
      renderedNodes,
      sourceTileSurfaces: projection.tileSurfaces,
      visibleCandidateObservations: showCandidateField ? projection.candidateObservations : [],
      visibleCandidateTileSurfaces: showCandidateField ? projection.candidateTileSurfaces : [],
      visibleNodeIds,
      visibleNodes,
      visibleRelations,
    };
  }, [
    input.absorbedNodeId,
    input.focusedNodeId,
    input.scene,
    input.selectedObservationId,
    input.tileFieldTargetCount,
    input.viewport,
    input.viewportBounds,
  ]);
}

export function MainContentStatusOverlay({
  candidateObservations,
  mainContent,
  onObservationSelect,
  selectedObservationId,
}: {
  candidateObservations: ScoutObservation[];
  mainContent: MainContentProjection;
  onObservationSelect: (observationId: string) => void;
  selectedObservationId?: string;
}): ReactElement | null {
  if (
    mainContent.mode !== "source_candidate_field" &&
    mainContent.mode !== "source_intake_pending" &&
    mainContent.mode !== "source_intake_failed" &&
    mainContent.mode !== "empty_source_field"
  ) {
    return null;
  }

  const title =
    mainContent.mode === "source_candidate_field"
      ? mainContent.intakeStatus === "pending"
        ? "Discovering candidate sources"
        : mainContent.intakeStatus === "failed"
          ? "Candidate discovery failed"
          : "Candidate sources found"
      : mainContent.mode === "source_intake_pending"
        ? "Observing source"
        : mainContent.mode === "source_intake_failed"
          ? "Source intake failed"
          : "No source-backed tile";
  const body =
    mainContent.mode === "source_candidate_field"
      ? mainContent.statusText ?? "Scout found candidate sources. Observe one to create an L3 source tile."
      : mainContent.mode === "source_intake_pending"
        ? mainContent.statusText ?? "Scout is observing the source before creating terrain."
        : mainContent.mode === "source_intake_failed"
          ? mainContent.statusText ?? mainContent.emptyReason ?? "Scout could not observe this source."
          : mainContent.emptyReason ?? "Add or observe a source to create a real L3 tile field.";

  return (
    <aside className={`main-content-status main-content-status-${mainContent.mode}`} aria-live="polite">
      <span>{mainContent.mode.replace(/_/g, " ")}</span>
      <strong>{title}</strong>
      <p>{body}</p>
      {mainContent.statusUrl ? <small>{mainContent.statusUrl}</small> : null}
      {mainContent.mode === "source_candidate_field" ? (
        <div className="main-content-candidate-list">
          {candidateObservations.slice(0, 5).map((observation) => (
            <button
              className={observation.id === selectedObservationId ? "active" : ""}
              key={observation.id}
              onClick={() => onObservationSelect(observation.id)}
              type="button"
            >
              <strong>{observation.title}</strong>
              <small>{observation.url ?? observation.query}</small>
            </button>
          ))}
        </div>
      ) : null}
    </aside>
  );
}

function filterRenderableMainContentNodes(nodes: TerrainNode[], mode: MainContentProjection["mode"]): TerrainNode[] {
  if (mode === "domain_gallery") {
    return nodes;
  }

  return nodes.filter((node) => !isMainContentScaffoldPlaceholder(node));
}

function isMainContentScaffoldPlaceholder(node: TerrainNode): boolean {
  if (node.source_state !== "local_only" || isMacroLayer(node.layer)) {
    return false;
  }

  const tags = new Set(node.tags ?? []);
  const hasScaffoldTag =
    tags.has("source-intake") ||
    tags.has("awaiting-scout") ||
    tags.has("awaiting-source") ||
    tags.has("tile-field");
  const normalizedTitle = node.title.toLowerCase();

  return hasScaffoldTag || normalizedTitle.includes(" pending") || normalizedTitle.includes(" intake");
}
