import type { DeepLensSnapshot, LayerId, ScoutObservation, TerrainScene, TileAbsorptionTrigger, ViewportState } from "@seekstar/core-schema";
import type { SourceIngestionInput } from "./sourceTerrain.js";
import {
  appendScoutObservations,
  applyLayerSelect,
  applySceneSelection,
  applySceneViewport,
  applyTileAbsorptionEnter,
  applyTileAbsorptionExit,
  applyTileFocus,
  enterDeepLensFromSnapshot,
  ingestSourceSnapshot,
} from "./sceneMutations.js";

export type ExplorationEvent =
  | {
      type: "selection.changed";
      nodeIds: string[];
      focusNodeId?: string;
      intent: "inspect" | "lasso" | "search" | "backlink" | "cartographer";
    }
  | {
      type: "viewport.changed";
      viewport: ViewportState;
      selectedNodeIds: string[];
    }
  | {
      type: "layer.changed";
      layer: LayerId;
      focusNodeId?: string;
    }
  | {
      type: "tile.focused";
      nodeId: string;
    }
  | {
      type: "tile.absorption.entered";
      nodeId: string;
      trigger: TileAbsorptionTrigger;
    }
  | {
      type: "tile.absorption.exited";
    }
  | {
      type: "deep_lens.entered";
      snapshot: DeepLensSnapshot;
    }
  | {
      type: "scout.observations.appended";
      observations: ScoutObservation[];
      viewport?: ViewportState;
      description?: string;
    }
  | {
      type: "source.snapshot.ingested";
      input: SourceIngestionInput;
      description?: string;
    }
  | {
      type: "text.grains.created";
      description?: string;
    }
  | {
      type: "grain.seed.created";
      description?: string;
    }
  | {
      type: "candidate.seed.created";
      description?: string;
    };

export interface ExplorationEventResult {
  scene: TerrainScene;
  selectedNodeIds?: string[];
  focusNodeId?: string;
}

export function applyExplorationEvent(scene: TerrainScene, event: ExplorationEvent): ExplorationEventResult {
  switch (event.type) {
    case "selection.changed":
      return applySceneSelection(scene, event.nodeIds, event.focusNodeId);
    case "viewport.changed":
      return {
        scene: applySceneViewport(scene, event.viewport, event.selectedNodeIds),
      };
    case "layer.changed":
      return applyLayerSelect(scene, event.layer, event.focusNodeId);
    case "tile.focused":
      return applyTileFocus(scene, event.nodeId);
    case "tile.absorption.entered":
      return applyTileAbsorptionEnter(scene, event.nodeId, event.trigger);
    case "tile.absorption.exited":
      return applyTileAbsorptionExit(scene);
    case "deep_lens.entered":
      return enterDeepLensFromSnapshot(scene, event.snapshot);
    case "scout.observations.appended":
      return {
        scene: appendScoutObservations(scene, event.observations, {
          viewport: event.viewport,
          description: event.description,
        }),
      };
    case "source.snapshot.ingested":
      return ingestSourceSnapshot(scene, event.input);
    case "text.grains.created":
    case "grain.seed.created":
    case "candidate.seed.created":
      return {
        scene: {
          ...scene,
          metadata: {
            ...scene.metadata,
            description: event.description ?? scene.metadata.description,
            updated_at: new Date().toISOString(),
          },
        },
      };
    default:
      return assertNever(event);
  }
}

function assertNever(event: never): never {
  throw new Error(`Unhandled exploration event: ${JSON.stringify(event)}`);
}
