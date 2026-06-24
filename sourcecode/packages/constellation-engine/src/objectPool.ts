import type { LayerId, ScoutObservation, SourceRef, SourceState, TerrainNode, TerrainRelation, TerrainScene } from "@seekstar/core-schema";

export interface ExplorationObjectPool {
  nodesById: ReadonlyMap<string, TerrainNode>;
  relationsById: ReadonlyMap<string, TerrainRelation>;
  sourcesById: ReadonlyMap<string, SourceRef>;
  scoutObservationsById: ReadonlyMap<string, ScoutObservation>;
  nodesByLayer: ReadonlyMap<LayerId, TerrainNode[]>;
  sourceStateCounts: ReadonlyMap<SourceState, number>;
}

export function createExplorationObjectPool(scene: TerrainScene): ExplorationObjectPool {
  const nodesById = new Map<string, TerrainNode>();
  const relationsById = new Map<string, TerrainRelation>();
  const sourcesById = new Map<string, SourceRef>();
  const scoutObservationsById = new Map<string, ScoutObservation>();
  const nodesByLayer = new Map<LayerId, TerrainNode[]>();
  const sourceStateCounts = new Map<SourceState, number>();

  for (const node of scene.nodes) {
    nodesById.set(node.id, node);
    nodesByLayer.set(node.layer, [...(nodesByLayer.get(node.layer) ?? []), node]);
    sourceStateCounts.set(node.source_state, (sourceStateCounts.get(node.source_state) ?? 0) + 1);
  }

  for (const relation of scene.relations) {
    relationsById.set(relation.id, relation);
  }

  for (const source of scene.sources) {
    sourcesById.set(source.id, source);
  }

  for (const observation of scene.scout_observations ?? []) {
    scoutObservationsById.set(observation.id, observation);
  }

  return {
    nodesById,
    relationsById,
    sourcesById,
    scoutObservationsById,
    nodesByLayer,
    sourceStateCounts,
  };
}
