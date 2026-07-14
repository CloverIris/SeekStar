import type { ExplorationLayerId, ExplorationViewState, LayerId, TerrainNode, TerrainScene, ViewportState } from "@seekstar/core-schema";
import { createDefaultNewSeekScene } from "@seekstar/constellation-engine";
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import type { SelectionBasketItem } from "../selection/selectionBasket";
import { createFogNodes, projectTerrain, reduceExplorationState, type ExplorationRendererState } from "./explorationState";

export interface ExplorationWorkingSetPolicy {
  auto_expand_enabled: boolean;
  auto_preload_ring: number;
  boundary_debounce_ms: number;
  chunk_height: number;
  chunk_width: number;
  manual_preload_range: number;
}

interface UseExplorationRuntimeOptions {
  runtimeTabId?: string;
}

type RuntimeHandler = (...args: any[]) => any;

export interface ExplorationViewModel {
  scene: TerrainScene;
  activeTabId: string;
  basketByTabId: Record<string, SelectionBasketItem[]>;
  setBasketByTabId: React.Dispatch<React.SetStateAction<Record<string, SelectionBasketItem[]>>>;
  runtimeStatus: { message: string; phase: "idle" | "generating" | "error"; updatedAt: string };
  persistenceStatus: "loading" | "saved" | "error" | "unavailable";
  workspaceLoadError?: string;
  workspaceHydrated: boolean;
  hydratedSelection?: { selectedNodeIds: string[]; focusNodeId?: string };
  syncSceneSelection: (...args: any[]) => { selectedNodeIds: string[]; focusNodeId?: string };
  syncSceneViewport: (...args: any[]) => string[];
  handleLayerSelect: RuntimeHandler;
  handleTileAbsorptionEnter: RuntimeHandler;
  handleTileAbsorptionExit: RuntimeHandler;
  handleExploreInCurrentTab: RuntimeHandler;
  handleUseAsSeed: RuntimeHandler;
  handleUseHyperlinkAsSeed: RuntimeHandler;
  handleOpenDirectUrlAsSeek: RuntimeHandler;
  handleObserveCandidateIntoCurrentTab: RuntimeHandler;
  handleCanvasFrontierDiscovery: RuntimeHandler;
  handleEnsureWorkingSet: RuntimeHandler;
  handleReplaceFailedSourceCandidate: RuntimeHandler;
  handleUseSelectionAsSeed: RuntimeHandler;
  handleUseNodeAsSeed: RuntimeHandler;
}

const DEFAULT_VIEW: ExplorationViewState = {
  camera: { x: 0, y: 0, zoom: 1, layer: "L0" },
  selected_node_ids: [],
  browser_absorption: { status: "idle", exit_layer: "L3" },
};

const INITIAL_STATE: ExplorationRendererState = { view: DEFAULT_VIEW, viewRevision: 0, jobsById: {} };

export function useExplorationRuntime(runtimeTabId: string): ExplorationViewModel {
  return useRuntimeModel({ runtimeTabId });
}

export function useShellViewModel(): ExplorationViewModel {
  return useRuntimeModel();
}

function useRuntimeModel(options: UseExplorationRuntimeOptions = {}): ExplorationViewModel {
  const [state, dispatch] = useReducer(reduceExplorationState, INITIAL_STATE);
  const [basketByTabId, setBasketByTabId] = useState<Record<string, SelectionBasketItem[]>>({});
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    if (!options.runtimeTabId) return;
    let disposed = false;
    let unsubscribe: (() => void) | undefined;
    let leaseId: string | undefined;
    void window.seekstar.exploration.open(options.runtimeTabId).then((opened) => {
      if (disposed) {
        void window.seekstar.exploration.close(opened.lease_id).catch(() => undefined);
        return;
      }
      leaseId = opened.lease_id;
      dispatch({
        type: "opened",
        leaseId,
        world: opened.world,
        view: opened.view_checkpoint.view,
        viewRevision: opened.view_checkpoint.view_revision,
        jobs: opened.jobs,
      });
      unsubscribe = window.seekstar.exploration.subscribe(leaseId, (event) => dispatch({ type: "world_event", event }));
    }).catch((error: unknown) => dispatch({ type: "open_failed", message: getErrorMessage(error) }));
    return () => {
      disposed = true;
      unsubscribe?.();
      if (leaseId) void window.seekstar.exploration.close(leaseId).catch(() => undefined);
    };
  }, [options.runtimeTabId]);

  const changeView = useCallback((update: (view: ExplorationViewState) => ExplorationViewState): ExplorationViewState => {
    const current = stateRef.current;
    const nextView = update(current.view);
    const viewRevision = current.viewRevision + 1;
    dispatch({ type: "view_changed", view: nextView, viewRevision });
    if (current.leaseId) void window.seekstar.exploration.reportView(current.leaseId, viewRevision, nextView).catch(() => undefined);
    return nextView;
  }, []);

  const projection = useMemo(() => projectTerrain(state.world, state.view), [state.world, state.view]);
  const scene = useMemo(() => createProjectionScene(state, projection, options.runtimeTabId), [options.runtimeTabId, projection, state]);
  const activeTabId = options.runtimeTabId ?? scene.active_tab_id;
  const jobs = Object.values(state.jobsById);
  const running = jobs.find((job) => job.status === "running" || job.status === "queued");
  const failed = jobs.find((job) => job.status === "failed");
  const runtimeStatus = {
    message: failed?.error ?? (running ? "世界池正在扩展" : "世界池已就绪"),
    phase: failed ? "error" as const : running ? "generating" as const : "idle" as const,
    updatedAt: failed?.updated_at ?? running?.updated_at ?? state.world?.updated_at ?? new Date().toISOString(),
  };

  const syncSceneSelection = useCallback((nodeIds: string[], focusNodeId?: string) => {
    changeView((view) => ({ ...view, selected_node_ids: nodeIds, focused_node_id: focusNodeId }));
    return { selectedNodeIds: nodeIds, focusNodeId };
  }, [changeView]);

  const syncSceneViewport = useCallback((viewport: ViewportState, selectedNodeIds: string[] = []) => {
    changeView((view) => {
      const camera = normalizeCamera(viewport);
      return { ...view, camera, selected_node_ids: selectedNodeIds, focused_node_id: nearestAnchorId(stateRef.current.world, camera) ?? view.focused_node_id };
    });
    return selectedNodeIds;
  }, [changeView]);

  const handleLayerSelect = useCallback((layer: LayerId, focusNodeId?: string) => {
    const cameraLayer = normalizeLayer(layer);
    let resolvedFocusNodeId = focusNodeId;
    changeView((view) => {
      const camera = { ...view.camera, layer: cameraLayer };
      resolvedFocusNodeId ??= nearestAnchorId(stateRef.current.world, camera);
      return { ...view, camera, focused_node_id: resolvedFocusNodeId };
    });
    return { selectedNodeIds: resolvedFocusNodeId ? [resolvedFocusNodeId] : [], focusNodeId: resolvedFocusNodeId };
  }, [changeView]);

  const handleTileAbsorptionEnter = useCallback((value: string | { nodeId?: string; sourceId?: string; sourceUrl?: string; trigger?: "threshold" | "click" | "command" }, trigger?: "threshold" | "click" | "command") => {
    const request = typeof value === "string" ? { nodeId: value, trigger } : value;
    changeView((view) => ({ ...view, browser_absorption: { status: "absorbed", node_id: request.nodeId, source_id: request.sourceId, source_url: request.sourceUrl, trigger: request.trigger, entered_at: new Date().toISOString(), exit_layer: view.camera.layer } }));
    return currentSelection(stateRef.current);
  }, [changeView]);
  const handleTileAbsorptionExit = useCallback(() => {
    changeView((view) => ({ ...view, browser_absorption: { status: "idle", exit_layer: view.browser_absorption.exit_layer } }));
    return currentSelection(stateRef.current);
  }, [changeView]);
  const createTab = useCallback(async (seed: string) => {
    const snapshot = await window.seekstar.tabs.create({ title: seed, seed, activate: true });
    return { createdTabId: snapshot.active_tab_id, originTabId: activeTabId, selectedNodeIds: [], focusNodeId: undefined };
  }, [activeTabId]);

  const reportWorkingSet = useCallback(async (target?: unknown) => {
    const current = stateRef.current;
    const leaseId = current.leaseId;
    let nextView = current.view;
    if (isViewport(target)) {
      const camera = normalizeCamera(target);
      nextView = { ...current.view, camera, focused_node_id: nearestAnchorId(current.world, camera) ?? current.view.focused_node_id };
      const viewRevision = current.viewRevision + 1;
      dispatch({ type: "view_changed", view: nextView, viewRevision });
      if (leaseId) await window.seekstar.exploration.reportView(leaseId, viewRevision, nextView);
    }
    if (leaseId) await window.seekstar.exploration.command(leaseId, { type: "ensure_working_set" });
    const projectedState = { ...current, view: nextView };
    return { scene: createProjectionScene(projectedState, projectTerrain(current.world, nextView), options.runtimeTabId), selectedNodeIds: nextView.selected_node_ids, focusNodeId: nextView.focused_node_id };
  }, [options.runtimeTabId]);

  const handleReplaceFailedSourceCandidate = useCallback(async (candidateId: string) => {
    const leaseId = stateRef.current.leaseId;
    const candidate = stateRef.current.world?.scout_observations[candidateId];
    if (!leaseId || !candidate?.url) return undefined;
    await window.seekstar.exploration.command(leaseId, { type: "observe_candidate", candidate_id: candidateId });
    return currentSelection(stateRef.current);
  }, []);

  const handleObserveCandidate = useCallback(async (candidateId: string) => {
    const leaseId = stateRef.current.leaseId;
    if (!leaseId || !stateRef.current.world?.scout_observations[candidateId]) return undefined;
    await window.seekstar.exploration.command(leaseId, { type: "observe_candidate", candidate_id: candidateId });
    return currentSelection(stateRef.current);
  }, []);

  const handleUseNodeAsSeed = useCallback(async (node: TerrainNode) => createTab(node.title), [createTab]);
  const handleUseSelectionAsSeed = useCallback(async (nodes: TerrainNode[]) => nodes[0] ? createTab(nodes.map((node) => node.title).join(" + ")) : undefined, [createTab]);
  const handleUseHyperlinkAsSeed = useCallback(async (input: string | { title?: string; url?: string }) => createTab(typeof input === "string" ? input : input.title || input.url || "New Seek"), [createTab]);

  return {
    scene,
    activeTabId,
    basketByTabId,
    setBasketByTabId,
    runtimeStatus,
    persistenceStatus: state.error ? "error" as const : state.world ? "saved" as const : options.runtimeTabId ? "loading" as const : "unavailable" as const,
    workspaceLoadError: state.error,
    workspaceHydrated: !options.runtimeTabId || Boolean(state.world),
    hydratedSelection: state.world ? { selectedNodeIds: state.view.selected_node_ids, focusNodeId: state.view.focused_node_id } : undefined,
    syncSceneSelection,
    syncSceneViewport,
    handleLayerSelect,
    handleTileAbsorptionEnter,
    handleTileAbsorptionExit,
    handleExploreInCurrentTab: createTab,
    handleUseAsSeed: createTab,
    handleUseHyperlinkAsSeed,
    handleOpenDirectUrlAsSeek: createTab,
    handleObserveCandidateIntoCurrentTab: handleObserveCandidate,
    handleCanvasFrontierDiscovery: reportWorkingSet,
    handleEnsureWorkingSet: reportWorkingSet,
    handleReplaceFailedSourceCandidate,
    handleUseSelectionAsSeed,
    handleUseNodeAsSeed,
  };
}

function createProjectionScene(state: ExplorationRendererState, projection: ReturnType<typeof projectTerrain>, runtimeTabId?: string): TerrainScene {
  const base = createDefaultNewSeekScene();
  const tabId = runtimeTabId ?? (projection.tab_id || base.active_tab_id);
  const title = state.world?.seed ?? "New Seek";
  const nodes = [...projection.nodes, ...createFogNodes(projection)];
  const timestamp = state.world?.updated_at ?? new Date().toISOString();
  const tab = {
    ...base.tabs[0],
    id: tabId,
    title,
    seed: title,
    current_layer: projection.view.camera.layer,
    viewport: projection.view.camera,
    node_ids: nodes.map((node) => node.id),
    relation_ids: projection.relations.map((relation) => relation.id),
    source_ids: projection.sources.map((source) => source.id),
    updated_at: timestamp,
  };
  return {
    ...base,
    id: state.world?.world_id ?? base.id,
    active_tab_id: tabId,
    tabs: [tab],
    layers: base.layers.filter((layer) => layer.id === "L0" || layer.id === "L1" || layer.id === "L2" || layer.id === "L3"),
    nodes,
    relations: projection.relations,
    sources: projection.sources,
    viewport: projection.view.camera,
    selection: { ...base.selection, tab_id: tabId, node_ids: projection.view.selected_node_ids },
    scout_observations: projection.scout_observations,
    agent_jobs: [],
    runtime: { focused_node_id: projection.view.focused_node_id, browser_absorption: projection.view.browser_absorption, updated_at: timestamp },
    metadata: { ...base.metadata, title, updated_at: timestamp },
  };
}

function normalizeLayer(layer: LayerId): ExplorationLayerId {
  if (layer === "L1") return "L1";
  if (layer === "L2") return "L2";
  if (layer === "L3") return "L3";
  return "L0";
}
function normalizeCamera(viewport: ViewportState): ExplorationViewState["camera"] {
  return { x: viewport.x, y: viewport.y, zoom: viewport.zoom, layer: normalizeLayer(viewport.layer) };
}
function getErrorMessage(error: unknown): string { return error instanceof Error ? error.message : String(error); }
function isViewport(value: unknown): value is ViewportState {
  if (!value || typeof value !== "object") return false;
  const input = value as Partial<ViewportState>;
  return typeof input.x === "number" && typeof input.y === "number" && typeof input.zoom === "number" && typeof input.layer === "string";
}

function currentSelection(state: ExplorationRendererState): { selectedNodeIds: string[]; focusNodeId?: string } {
  return { selectedNodeIds: state.view.selected_node_ids, focusNodeId: state.view.focused_node_id };
}

function nearestAnchorId(world: ExplorationRendererState["world"], camera: ExplorationViewState["camera"]): string | undefined {
  if (!world) return undefined;
  return Object.values(world.segments_by_key).flatMap((segment) => segment.nodes)
    .filter((node) => node.layer === camera.layer && node.position_hint)
    .sort((left, right) => {
      const leftDistance = Math.hypot((left.position_hint?.x ?? 0) - camera.x, (left.position_hint?.y ?? 0) - camera.y);
      const rightDistance = Math.hypot((right.position_hint?.x ?? 0) - camera.x, (right.position_hint?.y ?? 0) - camera.y);
      return leftDistance - rightDistance;
    })[0]?.id;
}
