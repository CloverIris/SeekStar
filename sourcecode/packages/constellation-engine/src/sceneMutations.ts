import { normalizeTerrainScene, validateTerrainScene } from "@seekstar/core-schema";
import type {
  DeepLensSnapshot,
  DeepLensTextGrainSnapshot,
  LayerId,
  ScoutObservation,
  TerrainNode,
  TerrainRelation,
  TerrainScene,
  TileAbsorptionTrigger,
  ViewportState,
} from "@seekstar/core-schema";
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
  options: { centerOnFocus?: boolean } = {},
): { scene: TerrainScene; focusNodeId?: string } {
  const focusNode = focusNodeId ? scene.nodes.find((node) => node.id === focusNodeId) : undefined;
  const updatedAt = new Date().toISOString();
  const nextViewport: ViewportState = {
    ...scene.viewport,
    x: options.centerOnFocus ? focusNode?.position_hint?.x ?? scene.viewport.x : scene.viewport.x,
    y: options.centerOnFocus ? focusNode?.position_hint?.y ?? scene.viewport.y : scene.viewport.y,
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
      runtime: {
        ...scene.runtime,
        browser_absorption: shouldClearAbsorptionForFocus(scene.runtime.browser_absorption.node_id, focusNode)
          ? createIdleAbsorptionState()
          : scene.runtime.browser_absorption,
        focused_node_id: focusNode?.id,
        updated_at: updatedAt,
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
  const nextFocusedNodeId = resolveContinuousViewportFocusNodeId(scene, viewport, selectedNodeIds, layerSelectedNodeIds);

  return withSceneViewport(
    {
      ...scene,
      selection: {
        ...scene.selection,
        node_ids: layerSelectedNodeIds,
      },
      runtime: {
        ...scene.runtime,
        browser_absorption: createIdleAbsorptionState(),
        focused_node_id: nextFocusedNodeId,
        updated_at: new Date().toISOString(),
      },
    },
    viewport,
  );
}

function resolveContinuousViewportFocusNodeId(
  scene: TerrainScene,
  viewport: ViewportState,
  selectedNodeIds: string[],
  layerSelectedNodeIds: string[],
): string | undefined {
  if (layerSelectedNodeIds[0]) {
    return layerSelectedNodeIds[0];
  }

  const anchorLayer = resolveContinuousFocusAnchorLayer(viewport.layer);
  const nearestAnchor = anchorLayer ? findNearestNodeOnLayer(scene.nodes, anchorLayer, viewport) : undefined;

  // In a deeper band, the nearest visible parent is the active semantic
  // anchor. This lets a lateral L2/L3 move hand focus from (for example) a
  // car neighbourhood to an adjacent aircraft neighbourhood instead of
  // keeping the node that originally opened the band forever.
  if (nearestAnchor) {
    return nearestAnchor.id;
  }

  const currentFocusId = scene.runtime.focused_node_id ?? selectedNodeIds[0] ?? scene.selection.node_ids[0];
  const currentFocusNode = currentFocusId ? scene.nodes.find((node) => node.id === currentFocusId) : undefined;

  if (currentFocusNode && (currentFocusNode.layer === viewport.layer || currentFocusNode.layer === anchorLayer)) {
    return currentFocusNode.id;
  }

  return undefined;
}

function resolveContinuousFocusAnchorLayer(layer: LayerId): LayerId | undefined {
  if (layer === "L1") {
    return "L0";
  }

  if (layer === "L2") {
    return "L1";
  }

  if (layer === "L3") {
    return "L2";
  }

  if (layer === "L0") {
    return "supra_macro";
  }

  return undefined;
}

export function applyLayerSelect(
  scene: TerrainScene,
  layer: LayerId,
  focusNodeId?: string,
): { scene: TerrainScene; selectedNodeIds: string[]; focusNodeId?: string } {
  const requestedFocusNode = focusNodeId ? scene.nodes.find((node) => node.id === focusNodeId) : undefined;
  const anchorLayer = resolveContinuousFocusAnchorLayer(layer);
  const requestedFocusIsAnchor = Boolean(requestedFocusNode && requestedFocusNode.layer === anchorLayer);
  const focusNode = requestedFocusNode?.layer === layer
    ? requestedFocusNode
    : requestedFocusNode
      ? undefined
      : findNearestNodeOnLayer(scene.nodes, layer, scene.viewport);
  const viewportAnchorNode = focusNode ?? requestedFocusNode;
  const nextViewport: ViewportState = {
    ...scene.viewport,
    x: viewportAnchorNode?.position_hint?.x ?? scene.viewport.x,
    y: viewportAnchorNode?.position_hint?.y ?? scene.viewport.y,
    layer,
    zoom: resolveZoomForLayer(layer),
  };
  const selectedNodeIds = focusNode ? [focusNode.id] : [];
  const runtimeFocusNodeId = focusNode?.id ?? (requestedFocusIsAnchor ? requestedFocusNode?.id : undefined);

  return {
    focusNodeId: runtimeFocusNodeId,
    selectedNodeIds,
    scene: withSceneViewport(
      {
        ...scene,
        selection: {
          ...scene.selection,
          node_ids: selectedNodeIds,
        },
        runtime: {
          ...scene.runtime,
          browser_absorption: createIdleAbsorptionState(),
          focused_node_id: runtimeFocusNodeId,
          updated_at: new Date().toISOString(),
        },
      },
      nextViewport,
    ),
  };
}

function findNearestNodeOnLayer(nodes: TerrainNode[], layer: LayerId, viewport: ViewportState): TerrainNode | undefined {
  return nodes
    .map((node, index) => ({ index, node }))
    .filter((item) => item.node.layer === layer)
    .sort((left, right) => {
      const distanceDelta = getViewportDistance(left.node, viewport) - getViewportDistance(right.node, viewport);

      return distanceDelta === 0 ? right.index - left.index : distanceDelta;
    })[0]?.node;
}

function getViewportDistance(node: TerrainNode, viewport: ViewportState): number {
  const x = node.position_hint?.x ?? 0;
  const y = node.position_hint?.y ?? 0;

  return Math.hypot(x - viewport.x, y - viewport.y);
}

export function applyTileFocus(scene: TerrainScene, nodeId: string): { scene: TerrainScene; focusNodeId?: string; selectedNodeIds: string[] } {
  const focusNode = scene.nodes.find((node) => node.id === nodeId);

  if (!focusNode) {
    return {
      focusNodeId: scene.runtime.focused_node_id,
      scene,
      selectedNodeIds: scene.selection.node_ids,
    };
  }

  const updatedAt = new Date().toISOString();
  const nextViewport = {
    ...scene.viewport,
    x: focusNode.position_hint?.x ?? scene.viewport.x,
    y: focusNode.position_hint?.y ?? scene.viewport.y,
    layer: focusNode.layer,
    zoom: Math.max(scene.viewport.zoom, resolveZoomForLayer(focusNode.layer)),
  };
  const nextScene = withSceneViewport(
    {
      ...scene,
      selection: {
        ...scene.selection,
        node_ids: [focusNode.id],
      },
      runtime: {
        ...scene.runtime,
        browser_absorption: shouldClearAbsorptionForFocus(scene.runtime.browser_absorption.node_id, focusNode)
          ? createIdleAbsorptionState()
          : scene.runtime.browser_absorption,
        focused_node_id: focusNode.id,
        updated_at: updatedAt,
      },
    },
    nextViewport,
  );

  return {
    focusNodeId: focusNode.id,
    scene: nextScene,
    selectedNodeIds: [focusNode.id],
  };
}

export function applyTileAbsorptionEnter(
  scene: TerrainScene,
  nodeId: string,
  trigger: TileAbsorptionTrigger,
): { scene: TerrainScene; focusNodeId?: string; selectedNodeIds: string[] } {
  const focusNode = scene.nodes.find((node) => node.id === nodeId);

  if (!focusNode || !isAbsorbableTileNode(focusNode)) {
    return applyTileFocus(scene, nodeId);
  }

  const updatedAt = new Date().toISOString();
  const nextViewport = {
    ...scene.viewport,
    x: focusNode.position_hint?.x ?? scene.viewport.x,
    y: focusNode.position_hint?.y ?? scene.viewport.y,
    layer: focusNode.layer,
  };
  const nextScene = withSceneViewport(
    {
      ...scene,
      selection: {
        ...scene.selection,
        node_ids: [focusNode.id],
      },
      runtime: {
        ...scene.runtime,
        browser_absorption: {
          status: "absorbed",
          node_id: focusNode.id,
          source_id: focusNode.source_id,
          source_url: focusNode.source_url,
          entered_at: updatedAt,
          exit_layer: "L3",
          trigger,
        },
        focused_node_id: focusNode.id,
        updated_at: updatedAt,
      },
    },
    nextViewport,
  );

  return {
    focusNodeId: focusNode.id,
    scene: nextScene,
    selectedNodeIds: [focusNode.id],
  };
}

export function applyTileAbsorptionExit(scene: TerrainScene): { scene: TerrainScene; focusNodeId?: string; selectedNodeIds: string[] } {
  const absorbedNodeId = scene.runtime.browser_absorption.node_id;
  const absorbedNode = absorbedNodeId ? scene.nodes.find((node) => node.id === absorbedNodeId) : undefined;
  const exitLayer = scene.runtime.browser_absorption.exit_layer ?? "L3";
  const updatedAt = new Date().toISOString();
  const nextViewport = {
    ...scene.viewport,
    x: absorbedNode?.position_hint?.x ?? scene.viewport.x,
    y: absorbedNode?.position_hint?.y ?? scene.viewport.y,
    layer: exitLayer,
    zoom: resolveZoomForLayer(exitLayer),
  };
  const selectedNodeIds = absorbedNode ? [absorbedNode.id] : scene.selection.node_ids;
  const nextScene = withSceneViewport(
    {
      ...scene,
      selection: {
        ...scene.selection,
        node_ids: selectedNodeIds,
      },
      runtime: {
        ...scene.runtime,
        browser_absorption: createIdleAbsorptionState(),
        focused_node_id: absorbedNode?.id ?? scene.runtime.focused_node_id,
        updated_at: updatedAt,
      },
    },
    nextViewport,
  );

  return {
    focusNodeId: absorbedNode?.id ?? scene.runtime.focused_node_id,
    scene: nextScene,
    selectedNodeIds,
  };
}

export function enterDeepLensFromSnapshot(
  scene: TerrainScene,
  snapshot: DeepLensSnapshot,
): { scene: TerrainScene; focusNodeId?: string; selectedNodeIds: string[] } {
  const sourceNode = scene.nodes.find((node) => node.id === snapshot.node_id);
  const sourceId = snapshot.source_id ?? sourceNode?.source_id;
  const sourceUrl = snapshot.source_url ?? sourceNode?.source_url;
  const sourceTitle = snapshot.title || sourceNode?.title || "Deep Lens source";
  const updatedAt = new Date().toISOString();
  const previousDeepLensNodeIds = new Set(
    scene.nodes
      .filter((node) => node.tags?.includes("deep-lens") && node.created_from?.node_id === snapshot.node_id)
      .map((node) => node.id),
  );
  const grainNodes = createDeepLensNodes(scene, snapshot, {
    sourceId,
    sourceTitle,
    sourceUrl,
    updatedAt,
  });
  const grainNodeIds = new Set(grainNodes.map((node) => node.id));
  const grainRelations = createDeepLensRelations(snapshot, grainNodes, updatedAt);
  const nextNodes = scene.nodes.filter((node) => !previousDeepLensNodeIds.has(node.id));
  const nextRelations = scene.relations.filter(
    (relation) => !previousDeepLensNodeIds.has(relation.from) && !previousDeepLensNodeIds.has(relation.to),
  );
  const focusNode = grainNodes.find((node) => node.type === "paragraph") ?? grainNodes[0] ?? sourceNode;
  const selectedNodeIds = focusNode ? [focusNode.id] : [];
  const nextViewport: ViewportState = {
    ...scene.viewport,
    x: focusNode?.position_hint?.x ?? sourceNode?.position_hint?.x ?? scene.viewport.x,
    y: focusNode?.position_hint?.y ?? sourceNode?.position_hint?.y ?? scene.viewport.y,
    layer: "L4",
    zoom: resolveZoomForLayer("L4"),
  };

  const nextScene = normalizeTerrainScene(
    withSceneViewport(
      {
        ...scene,
        nodes: [...nextNodes, ...grainNodes],
        relations: [...nextRelations, ...grainRelations],
        selection: {
          ...scene.selection,
          node_ids: selectedNodeIds,
          source_ids: sourceId ? [sourceId] : scene.selection.source_ids,
          text_ranges: grainNodes.slice(0, 24).flatMap((node) =>
            node.source_range && sourceId
              ? [
                  {
                    source_id: sourceId,
                    node_id: node.id,
                    start: node.source_range.start,
                    end: node.source_range.end,
                    excerpt: node.source_range.excerpt ?? node.title,
                  },
                ]
              : [],
          ),
        },
        runtime: {
          ...scene.runtime,
          browser_absorption: createIdleAbsorptionState(),
          focused_node_id: focusNode?.id ?? scene.runtime.focused_node_id,
          updated_at: updatedAt,
        },
        tabs: scene.tabs.map((tab) =>
          tab.id === scene.active_tab_id
            ? {
                ...tab,
                node_ids: [...new Set([...tab.node_ids.filter((nodeId) => !previousDeepLensNodeIds.has(nodeId)), ...grainNodeIds])],
                relation_ids: [...new Set([...tab.relation_ids, ...grainRelations.map((relation) => relation.id)])],
                updated_at: updatedAt,
              }
            : tab,
        ),
        metadata: {
          ...scene.metadata,
          updated_at: updatedAt,
          description: `Deep Lens entered for ${sourceTitle}.`,
        },
      },
      nextViewport,
    ),
  );

  return {
    focusNodeId: focusNode?.id,
    scene: nextScene,
    selectedNodeIds,
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
  const initialLayer = input.initialLayer ?? "L2";
  const focusNode = patch.nodes.find((node) => node.layer === initialLayer) ?? sourceNode;
  const updatedAt = patch.nodes[0]?.updated_at ?? new Date().toISOString();
  const nextViewport = focusNode?.position_hint
    ? {
        ...scene.viewport,
        x: focusNode.position_hint.x,
        y: focusNode.position_hint.y,
        layer: initialLayer,
        zoom: Math.max(scene.viewport.zoom, resolveZoomForLayer(initialLayer)),
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
      node_ids: focusNode ? [focusNode.id] : scene.selection.node_ids,
      source_ids: [patch.source.id],
    },
    runtime: {
      ...scene.runtime,
      browser_absorption: createIdleAbsorptionState(),
      focused_node_id: focusNode?.id ?? scene.runtime.focused_node_id,
      updated_at: updatedAt,
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
    focusNodeId: focusNode?.id,
    selectedNodeIds: focusNode ? [focusNode.id] : [],
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

function createIdleAbsorptionState(): TerrainScene["runtime"]["browser_absorption"] {
  return {
    status: "idle",
    exit_layer: "L3",
  };
}

function shouldClearAbsorptionForFocus(absorbedNodeId: string | undefined, focusNode: TerrainNode | undefined): boolean {
  return Boolean(absorbedNodeId && absorbedNodeId !== focusNode?.id);
}

function createDeepLensNodes(
  scene: TerrainScene,
  snapshot: DeepLensSnapshot,
  context: { sourceId?: string; sourceTitle: string; sourceUrl?: string; updatedAt: string },
): TerrainNode[] {
  const grains = normalizeDeepLensGrains(snapshot);
  const basePosition = scene.nodes.find((node) => node.id === snapshot.node_id)?.position_hint ?? scene.viewport;
  const columns = Math.max(3, Math.ceil(Math.sqrt(Math.max(1, grains.length) * 1.35)));
  const spacingX = 260;
  const spacingY = 150;

  return grains.map((grain, index): TerrainNode => {
    const row = Math.floor(index / columns);
    const column = index % columns;
    const title = grain.kind === "word" || grain.kind === "phrase" ? grain.text : createDeepLensTitle(grain);
    const nodeId = `deep-lens-${slugSegment(snapshot.node_id)}-${grain.kind}-${index + 1}-${grain.start}-${grain.end}`;

    return {
      id: nodeId,
      type: grain.kind === "section" ? "section" : grain.kind,
      title,
      layer: "L4",
      source_state: context.sourceId || context.sourceUrl ? "source_backed" : "agent_inferred",
      confidence: 0.88,
      importance: grain.kind === "paragraph" ? 0.72 : grain.kind === "section" ? 0.8 : 0.52,
      tags: ["deep-lens", grain.kind],
      created_at: context.updatedAt,
      updated_at: context.updatedAt,
      summary: grain.text,
      quote: grain.text,
      source_url: context.sourceUrl,
      source_id: context.sourceId,
      source_title: context.sourceTitle,
      source_type: "webpage",
      position_hint: {
        x: Math.round(basePosition.x + (column - (columns - 1) / 2) * spacingX + (row % 2 ? spacingX / 3 : 0)),
        y: Math.round(basePosition.y + row * spacingY + 360),
      },
      source_range: {
        source_id: context.sourceId,
        locator: grain.locator,
        start: grain.start,
        end: grain.end,
        excerpt: grain.text,
      },
      semantic_breadcrumb: [context.sourceTitle, "Deep Lens", grain.kind],
      can_create_seed: true,
      created_from: {
        tab_id: scene.active_tab_id,
        node_id: snapshot.node_id,
        source_id: context.sourceId,
        layer: "L4",
        label: `Deep Lens ${grain.kind}`,
        excerpt: grain.text,
      },
    };
  });
}

function createDeepLensRelations(snapshot: DeepLensSnapshot, nodes: TerrainNode[], updatedAt: string): TerrainRelation[] {
  const paragraphs = nodes.filter((node) => node.type === "paragraph" || node.type === "section");

  return nodes.flatMap((node, index): TerrainRelation[] => {
    const relations: TerrainRelation[] = [];

    if (index > 0) {
      relations.push({
        id: `deep-lens-relation-next-${slugSegment(snapshot.node_id)}-${index}`,
        from: nodes[index - 1]?.id ?? node.id,
        to: node.id,
        type: "chronological_sequence",
        confidence: 0.82,
        explanation: "Deep Lens reading order.",
        source_state: node.source_state,
      });
    }

    if (node.type === "word" || node.type === "phrase") {
      const parent = paragraphs.find((candidate) => rangesContain(candidate.source_range, node.source_range));

      if (parent) {
        relations.push({
          id: `deep-lens-relation-contains-${slugSegment(snapshot.node_id)}-${index}`,
          from: parent.id,
          to: node.id,
          type: "source_contains",
          confidence: 0.86,
          explanation: "Deep Lens grain belongs to this paragraph or section.",
          source_state: node.source_state,
        });
      }
    }

    void updatedAt;
    return relations;
  });
}

function normalizeDeepLensGrains(snapshot: DeepLensSnapshot): DeepLensTextGrainSnapshot[] {
  const explicitGrains = snapshot.grains.filter((grain) => grain.text.trim().length > 0);

  if (explicitGrains.length > 0) {
    return explicitGrains.slice(0, 96);
  }

  return splitFallbackDeepLensText(snapshot.text);
}

function splitFallbackDeepLensText(text: string): DeepLensTextGrainSnapshot[] {
  const normalized = text.trim().replace(/\s+/g, " ");
  const paragraphs = normalized
    .split(/(?<=[.!?。！？])\s+/u)
    .filter(Boolean)
    .slice(0, 18);
  let cursor = 0;

  return paragraphs.flatMap((paragraph, paragraphIndex): DeepLensTextGrainSnapshot[] => {
    const start = normalized.indexOf(paragraph, cursor);
    const safeStart = start >= 0 ? start : cursor;
    const end = safeStart + paragraph.length;
    cursor = end;
    const words = paragraph
      .split(/\s+/u)
      .filter((word) => word.length >= 4)
      .slice(0, 5);

    return [
      {
        locator: `fallback.paragraph.${paragraphIndex + 1}`,
        kind: "paragraph",
        text: paragraph,
        start: safeStart,
        end,
      },
      ...words.map((word, wordIndex): DeepLensTextGrainSnapshot => {
        const wordStart = normalized.indexOf(word, safeStart);

        return {
          locator: `fallback.paragraph.${paragraphIndex + 1}.word.${wordIndex + 1}`,
          kind: "word",
          text: word,
          start: wordStart >= 0 ? wordStart : safeStart,
          end: (wordStart >= 0 ? wordStart : safeStart) + word.length,
        };
      }),
    ];
  });
}

function createDeepLensTitle(grain: DeepLensTextGrainSnapshot): string {
  const compact = grain.text.replace(/\s+/g, " ").trim();

  return compact.length <= 84 ? compact : `${compact.slice(0, 82)}...`;
}

function rangesContain(
  parent: TerrainNode["source_range"] | undefined,
  child: TerrainNode["source_range"] | undefined,
): boolean {
  return Boolean(parent && child && parent.start <= child.start && parent.end >= child.end);
}

function slugSegment(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "grain";
}

function isAbsorbableTileNode(node: TerrainNode): boolean {
  return Boolean(
    node.layer === "L3" &&
      node.source_state === "source_backed" &&
      node.source_url &&
      (node.type === "webpage" || node.type === "document"),
  );
}
