import type { ScoutObservation, TerrainNode, TerrainRelation, TerrainScene, ViewportState } from "@seekstar/core-schema";

export interface TerrainPixiProjection {
  candidateObservations: ScoutObservation[];
  renderedNodes: TerrainNode[];
  visibleNodes: TerrainNode[];
  visibleNodeIds: Set<string>;
  visibleRelations: TerrainRelation[];
}

const candidateStatuses = new Set<ScoutObservation["status"]>(["pending", "observed", "source_candidate", "failed"]);

export function createTerrainPixiProjection(scene: TerrainScene, viewport: ViewportState): TerrainPixiProjection {
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

  return {
    candidateObservations,
    renderedNodes,
    visibleNodes: layerNodes,
    visibleNodeIds: layerNodeIds,
    visibleRelations: scene.relations.filter((relation) => renderedNodeIds.has(relation.from) && renderedNodeIds.has(relation.to)),
  };
}
