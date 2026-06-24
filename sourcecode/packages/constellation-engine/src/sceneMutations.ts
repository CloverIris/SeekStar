import { normalizeTerrainScene, validateTerrainScene } from "@seekstar/core-schema";
import type { LayerId, ScoutObservation, TerrainScene, ViewportState } from "@seekstar/core-schema";
import { WORKSPACE_SCHEMA_REVISION, type HydratedWorkspace, type WorkspaceSnapshot } from "./types.js";
import { resolveZoomForLayer } from "./lens.js";
import { createSourceTerrainPatch, type SourceIngestionInput } from "./sourceTerrain.js";

export function ensureDefaultScenes(
  scenesByTabId: Record<string, TerrainScene>,
  fallbackScene: TerrainScene,
): Record<string, TerrainScene> {
  const next = { ...scenesByTabId };

  if (!next[fallbackScene.active_tab_id]) {
    next[fallbackScene.active_tab_id] = fallbackScene;
  }

  return Object.fromEntries(
    Object.entries(next).map(([tabId, scene]) => {
      const normalized = normalizeTerrainScene(scene);
      const validation = validateTerrainScene(normalized);

      if (!validation.valid) {
        console.warn(`[SeekStar] Scene for tab ${tabId} failed validation; using normalized copy.`, validation.issues);
      }

      return [tabId, normalized];
    }),
  );
}

export function buildWorkspaceSnapshot<TBasketItem>(input: {
  activeTabId: string;
  scenesByTabId: Record<string, TerrainScene>;
  basketByTabId: Record<string, TBasketItem[]>;
  fallbackScene: TerrainScene;
}): WorkspaceSnapshot<TBasketItem> {
  const scenes = ensureDefaultScenes(input.scenesByTabId, input.fallbackScene);

  for (const scene of Object.values(scenes)) {
    const validation = validateTerrainScene(scene);

    if (!validation.valid) {
      throw new Error(`Refusing to save invalid scene ${scene.id}`);
    }
  }

  return {
    version: 1,
    schema_revision: WORKSPACE_SCHEMA_REVISION,
    active_tab_id: input.activeTabId,
    scenes_by_tab_id: scenes,
    basket_by_tab_id: input.basketByTabId,
    updated_at: new Date().toISOString(),
  };
}

export function hydrateWorkspaceSnapshot<TBasketItem>(
  snapshot: WorkspaceSnapshot<TBasketItem>,
  fallbackScene: TerrainScene,
): HydratedWorkspace {
  const scenesByTabId = ensureDefaultScenes(snapshot.scenes_by_tab_id, fallbackScene);
  const activeTabId = scenesByTabId[snapshot.active_tab_id]
    ? snapshot.active_tab_id
    : Object.keys(scenesByTabId)[0] ?? fallbackScene.active_tab_id;

  return { activeTabId, scenesByTabId };
}

export function isWorkspaceSnapshot<TBasketItem = unknown>(value: unknown): value is WorkspaceSnapshot<TBasketItem> {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Partial<WorkspaceSnapshot<TBasketItem>>;

  return (
    candidate.version === 1 &&
    candidate.schema_revision === WORKSPACE_SCHEMA_REVISION &&
    typeof candidate.active_tab_id === "string" &&
    typeof candidate.scenes_by_tab_id === "object" &&
    candidate.scenes_by_tab_id !== null &&
    typeof candidate.basket_by_tab_id === "object" &&
    candidate.basket_by_tab_id !== null
  );
}

export function applySceneSelection(
  scene: TerrainScene,
  nodeIds: string[],
  focusNodeId?: string,
): { scene: TerrainScene; focusNodeId?: string } {
  const focusNode = focusNodeId ? scene.nodes.find((node) => node.id === focusNodeId) : undefined;
  const nextViewport: ViewportState = {
    ...scene.viewport,
    x: focusNode?.position_hint?.x ?? scene.viewport.x,
    y: focusNode?.position_hint?.y ?? scene.viewport.y,
  };

  return {
    focusNodeId,
    scene: withSceneViewport(
      {
        ...scene,
        selection: {
          ...scene.selection,
          node_ids: nodeIds,
        },
      },
      nextViewport,
    ),
  };
}

export function applySceneViewport(scene: TerrainScene, viewport: ViewportState, selectedNodeIds: string[]): TerrainScene {
  const layerSelectedNodeIds = selectedNodeIds.filter(
    (nodeId) => scene.nodes.find((node) => node.id === nodeId)?.layer === viewport.layer,
  );

  return withSceneViewport(
    {
      ...scene,
      selection: {
        ...scene.selection,
        node_ids: layerSelectedNodeIds,
      },
    },
    viewport,
  );
}

export function applyLayerSelect(
  scene: TerrainScene,
  layer: LayerId,
  focusNodeId?: string,
): { scene: TerrainScene; selectedNodeIds: string[]; focusNodeId?: string } {
  const focusNode = focusNodeId
    ? scene.nodes.find((node) => node.id === focusNodeId)
    : scene.nodes.find((node) => node.layer === layer);
  const nextViewport: ViewportState = {
    ...scene.viewport,
    x: focusNode?.position_hint?.x ?? scene.viewport.x,
    y: focusNode?.position_hint?.y ?? scene.viewport.y,
    layer,
    zoom: resolveZoomForLayer(layer),
  };
  const selectedNodeIds = focusNode ? [focusNode.id] : [];

  return {
    focusNodeId: focusNode?.id,
    selectedNodeIds,
    scene: withSceneViewport(
      {
        ...scene,
        selection: {
          ...scene.selection,
          node_ids: selectedNodeIds,
        },
      },
      nextViewport,
    ),
  };
}

export function appendScoutObservations(
  scene: TerrainScene,
  observations: ScoutObservation[],
  options?: { viewport?: ViewportState; description?: string },
): TerrainScene {
  const updatedAt = new Date().toISOString();

  return normalizeTerrainScene({
    ...scene,
    scout_observations: [...(scene.scout_observations ?? []), ...observations],
    viewport: options?.viewport ?? scene.viewport,
    metadata: {
      ...scene.metadata,
      updated_at: updatedAt,
      description: options?.description ?? scene.metadata.description,
    },
  });
}

export function ingestSourceSnapshot(
  scene: TerrainScene,
  input: SourceIngestionInput,
): { scene: TerrainScene; focusNodeId?: string; selectedNodeIds: string[] } {
  const patch = createSourceTerrainPatch(input, scene);
  const sourceNode = patch.nodes[0];
  const updatedAt = patch.nodes[0]?.updated_at ?? new Date().toISOString();
  const nextViewport = sourceNode?.position_hint
    ? {
        ...scene.viewport,
        x: sourceNode.position_hint.x,
        y: sourceNode.position_hint.y,
        layer: "L2" as LayerId,
        zoom: Math.max(scene.viewport.zoom, 1.35),
      }
    : scene.viewport;
  const nextScene = normalizeTerrainScene({
    ...scene,
    sources: [...scene.sources, patch.source],
    nodes: [...scene.nodes, ...patch.nodes],
    relations: [...scene.relations, ...patch.relations],
    scout_observations: input.observationId
      ? (scene.scout_observations ?? []).map((observation) =>
          observation.id === input.observationId
            ? {
                ...observation,
                status: "converted",
                updated_at: updatedAt,
              }
            : observation,
        )
      : scene.scout_observations,
    selection: {
      ...scene.selection,
      node_ids: sourceNode ? [sourceNode.id] : scene.selection.node_ids,
      source_ids: [patch.source.id],
    },
    viewport: nextViewport,
    tabs: scene.tabs.map((tab) =>
      tab.id === scene.active_tab_id
        ? {
            ...tab,
            current_layer: nextViewport.layer,
            node_ids: [...tab.node_ids, ...patch.nodes.map((node) => node.id)],
            relation_ids: [...tab.relation_ids, ...patch.relations.map((relation) => relation.id)],
            source_ids: [...tab.source_ids, patch.source.id],
            updated_at: updatedAt,
            viewport: nextViewport,
          }
        : tab,
    ),
    metadata: {
      ...scene.metadata,
      updated_at: updatedAt,
      description: `${scene.metadata.title} includes source-backed terrain from source intake.`,
    },
  });

  return {
    scene: nextScene,
    focusNodeId: sourceNode?.id,
    selectedNodeIds: sourceNode ? [sourceNode.id] : [],
  };
}

function withSceneViewport(scene: TerrainScene, viewport: ViewportState): TerrainScene {
  return {
    ...scene,
    viewport,
    tabs: scene.tabs.map((tab) =>
      tab.id === scene.active_tab_id
        ? {
            ...tab,
            current_layer: viewport.layer,
            viewport,
          }
        : tab,
    ),
  };
}
