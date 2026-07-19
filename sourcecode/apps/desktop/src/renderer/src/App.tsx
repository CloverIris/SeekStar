import type { ExplorationTab, LayerId, ScoutObservation, TerrainNode, TerrainScene } from "@seekstar/core-schema";
import type { TileAbsorptionTrigger } from "@seekstar/core-schema";
import type { AiAssistantAction } from "@seekstar/ai-service";
import { isDirectHttpUrl } from "@seekstar/constellation-engine";
import type { SeekStarSettings, SettingsSaveRequest } from "../../shared/settings";
import type { TabRuntimeSnapshot } from "../../main/tabRuntimeManager";
import type { CSSProperties, ChangeEvent, KeyboardEvent, PointerEvent as ReactPointerEvent, ReactElement } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { DetachedTabTitleBar, ShellDockWorkbench, SidebarRail, WindowTitleBar, type SidebarRailMode } from "./components/AppChrome";
import type { CanvasTool } from "./components/canvasTools";
import { ObservatorySidebar } from "./components/ObservatorySidebar";
import { ShellFeedback, type ShellToast } from "./components/ShellFeedback";
import { TerrainCanvas } from "./components/TerrainCanvas";
import type { NodeActivationContext, SemanticZoomRequest, TileAbsorptionRequest } from "./components/TerrainCanvas";
import { CommandComposer, SelectionActionCard, StatusStrip, WorkbenchHeader } from "./components/WorkbenchChrome";
import { AiMapControlSidebar, type AssistantActionExecutionResult, type AssistantOperationUndoContext } from "./components/ai-map-control/AiMapControlSidebar";
import { SettingsPage } from "./components/settings/SettingsPage";
import { worldSegmentForViewport, type ExplorationRuntimeStatus } from "./exploration/runtimeUi";
import {
  getActiveLayerBreadcrumb,
  getActiveLayerLabel,
  getActiveTab,
  getAgentJobState,
  getRelationNodes,
  getSourceForNode,
} from "./exploration/types";
import { type ExplorationViewModel, type ExplorationWorkingSetPolicy, useExplorationRuntime, useShellViewModel } from "./exploration/useExplorationRuntime";
import { type SearchResult, searchScene } from "./search/localSceneSearch";
import { type SelectionBasketItem, createSelectionBasketItem } from "./selection/selectionBasket";

type RightSidebarMode = Extract<SidebarRailMode, "collapsed" | "compact" | "expanded">;
type SelectionIntent = "backlink" | "cartographer" | "inspect" | "lasso" | "search";

interface SemanticLayerTransitionState {
  direction: "in" | "out";
  focusKind: "interstitial" | "node";
  focusTitle?: string;
  fromLayer: LayerId;
  id: number;
  origin?: { x: number; y: number };
  phase: "exiting" | "revealing";
  toLayer: LayerId;
}

interface SemanticLayerTransitionRequest {
  direction: "in" | "out";
  focusKind: "interstitial" | "node";
  focusNodeId?: string;
  focusTitle?: string;
  fromLayer: LayerId;
  origin?: { x: number; y: number };
  toLayer: LayerId;
}

const RIGHT_SIDEBAR_COMPACT_WIDTH = 340;
const RIGHT_SIDEBAR_EXPANDED_WIDTH = 500;
const SEMANTIC_LAYER_TRANSITION_MS = 460;

export function App(): ReactElement {
  const runtimeParams = useMemo(() => new URLSearchParams(window.location.search), []);
  const runtimeTabId = runtimeParams.get("runtimeTabId") ?? undefined;
  const runtimeSurface = runtimeParams.get("runtimeSurface");
  return runtimeTabId
    ? <TabSurfaceApp runtimeSurface={runtimeSurface} runtimeTabId={runtimeTabId} />
    : <ShellApp />;
}

function ShellApp(): ReactElement {
  const shellViewModel = useShellViewModel();
  return <SeekStarApplication exploration={shellViewModel} />;
}

function TabSurfaceApp({ runtimeSurface, runtimeTabId }: { runtimeSurface: string | null; runtimeTabId: string }): ReactElement {
  const exploration = useExplorationRuntime(runtimeTabId);
  return <SeekStarApplication exploration={exploration} runtimeSurface={runtimeSurface} runtimeTabId={runtimeTabId} />;
}

function SeekStarApplication({ exploration, runtimeSurface = null, runtimeTabId }: { exploration: ExplorationViewModel; runtimeSurface?: string | null; runtimeTabId?: string }): ReactElement {
  const isDockedTabView = Boolean(runtimeTabId && runtimeSurface === "docked");
  const isDetachedTabWindow = Boolean(runtimeTabId && !isDockedTabView);
  const isShellWindow = !runtimeTabId;
  const {
    scene,
    activeTabId,
    basketByTabId,
    setBasketByTabId,
    runtimeStatus,
    persistenceStatus,
    workspaceLoadError,
    workspaceHydrated,
    hydratedSelection,
    syncSceneSelection,
    syncSceneViewport,
    handleLayerSelect: selectLayer,
    handleTileAbsorptionEnter,
    handleTileAbsorptionExit,
    handleExploreInCurrentTab: exploreInCurrentTab,
    handleUseAsSeed: createSeedTab,
    handleUseHyperlinkAsSeed: createHyperlinkTab,
    handleOpenDirectUrlAsSeek: openDirectUrlAsSeek,
    handleObserveCandidateIntoCurrentTab: observeCandidateIntoCurrentTab,
    handleCanvasFrontierDiscovery,
    handleEnsureWorkingSet,
    handleReplaceFailedSourceCandidate: replaceFailedSourceCandidate,
    handleUseSelectionAsSeed,
    handleUseNodeAsSeed,
  } = exploration;

  const [commandValue, setCommandValue] = useState("");
  const [commandIntent, setCommandIntent] = useState<"new_seek" | "search_current" | undefined>();
  const [isCommandModalOpen, setIsCommandModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);
  const [selectedRelationId, setSelectedRelationId] = useState<string | undefined>();
  const [selectedObservationId, setSelectedObservationId] = useState<string | undefined>();
  const [viewportFocusNodeId, setViewportFocusNodeId] = useState<string | undefined>();
  const [leftSidebarCollapsed, setLeftSidebarCollapsed] = useState(false);
  const [rightSidebarMode, setRightSidebarMode] = useState<RightSidebarMode>("compact");
  const [rightSidebarWidth, setRightSidebarWidth] = useState(RIGHT_SIDEBAR_EXPANDED_WIDTH);
  const [splashVisible, setSplashVisible] = useState(true);
  const [splashFading, setSplashFading] = useState(false);
  const [activeCanvasTool, setActiveCanvasTool] = useState<CanvasTool>("pointer");
  const [tileAbsorptionRequest, setTileAbsorptionRequest] = useState<TileAbsorptionRequest | undefined>();
  const [tileActionNodeId, setTileActionNodeId] = useState<string | undefined>();
  const [semanticLayerTransition, setSemanticLayerTransition] = useState<SemanticLayerTransitionState | undefined>();
  const tileAbsorptionRequestCounterRef = useRef(0);
  const semanticLayerTransitionCounterRef = useRef(0);
  const semanticLayerTransitionTimeoutsRef = useRef<number[]>([]);
  const [isSelectionActionCardOpen, setIsSelectionActionCardOpen] = useState(false);
  const [tabRuntimeSnapshot, setTabRuntimeSnapshot] = useState<TabRuntimeSnapshot | undefined>();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settings, setSettings] = useState<SeekStarSettings | undefined>();
  const [storePaths, setStorePaths] = useState<Record<string, string>>({});
  const [shellToasts, setShellToasts] = useState<ShellToast[]>([]);
  const shellToastSequenceRef = useRef(0);
  const commandInputRef = useRef<HTMLInputElement>(null);
  const dockHostRef = useRef<HTMLElement | null>(null);
  const activeTabIdRef = useRef(activeTabId);
  const sceneRef = useRef(scene);
  const lastViewportTraceKeyRef = useRef("");
  const activeCanvasToolTabId = runtimeTabId ?? tabRuntimeSnapshot?.active_tab_id ?? activeTabId;
  const rightSidebarEffectiveWidth = rightSidebarMode === "expanded" ? rightSidebarWidth : RIGHT_SIDEBAR_COMPACT_WIDTH;
  const rightSidebarVisible = rightSidebarMode !== "collapsed";
  const rightSidebarStyle = useMemo(
    () =>
      ({
        "--inspector-width": `${rightSidebarEffectiveWidth}px`,
      }) as CSSProperties,
    [rightSidebarEffectiveWidth],
  );
  const shouldRenderRightSidebar = isShellWindow || isDetachedTabWindow;

  function dismissShellToast(id: string): void {
    setShellToasts((current) => current.filter((toast) => toast.id !== id));
  }

  function pushShellToast(message: string, tone: ShellToast["tone"] = "info"): void {
    const id = `toast-${++shellToastSequenceRef.current}`;
    setShellToasts((current) => [...current.slice(-3), { id, message, tone }]);
    window.setTimeout(() => dismissShellToast(id), tone === "error" ? 7_000 : 4_000);
  }

  useEffect(() => {
    if (runtimeStatus.phase === "error") pushShellToast(runtimeStatus.message, "error");
  }, [runtimeStatus.phase, runtimeStatus.updatedAt]);

  useEffect(() => {
    if (persistenceStatus === "error" || persistenceStatus === "unavailable") pushShellToast("Local workspace could not be saved. Your current view is preserved.", "error");
  }, [persistenceStatus]);

  useEffect(() => {
    activeTabIdRef.current = activeTabId;
  }, [activeTabId]);

  useEffect(() => {
    sceneRef.current = scene;
  }, [scene]);

  useEffect(
    () => () => {
      semanticLayerTransitionTimeoutsRef.current.forEach((timeoutId) => window.clearTimeout(timeoutId));
      semanticLayerTransitionTimeoutsRef.current = [];
    },
    [],
  );

  useEffect(() => {
    return window.seekstar.tiles.onLinkActivated((event) => {
      if (event.tabId !== activeTabIdRef.current) {
        return;
      }

      createHyperlinkTab({
        originNodeId: event.nodeId,
        originSourceId: event.sourceId,
        originTitle: event.title,
        title: event.url,
        url: event.url,
      });
    });
  }, [createHyperlinkTab]);

  useEffect(() => {
    let cancelled = false;

    void window.seekstar.settings.load().then((loadedSettings) => {
      if (!cancelled) {
        setSettings(loadedSettings);
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    void window.seekstar.tabs.list().then((snapshot) => {
      if (!cancelled) {
        setTabRuntimeSnapshot(snapshot);
      }
    });

    const unsubscribe = window.seekstar.tabs.onChanged((snapshot) => {
      setTabRuntimeSnapshot(snapshot);
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [runtimeTabId]);

  useEffect(() => {
    if (!isShellWindow) {
      return undefined;
    }

    if (settingsOpen) {
      void window.seekstar.tabs.setDockBounds(undefined);
      return undefined;
    }

    const host = dockHostRef.current;

    if (!host) {
      return undefined;
    }

    let frameId = 0;

    const syncDockBounds = (): void => {
      window.cancelAnimationFrame(frameId);
      frameId = window.requestAnimationFrame(() => {
        const rect = host.getBoundingClientRect();

        void window.seekstar.tabs.setDockBounds({
          x: Math.round(rect.left),
          y: Math.round(rect.top),
          width: Math.max(1, Math.round(rect.width)),
          height: Math.max(1, Math.round(rect.height)),
        });
      });
    };

    const resizeObserver = new ResizeObserver(syncDockBounds);
    resizeObserver.observe(host);
    window.addEventListener("resize", syncDockBounds);
    syncDockBounds();

    return () => {
      window.cancelAnimationFrame(frameId);
      resizeObserver.disconnect();
      window.removeEventListener("resize", syncDockBounds);
      void window.seekstar.tabs.setDockBounds(undefined);
    };
  }, [isShellWindow, leftSidebarCollapsed, rightSidebarEffectiveWidth, rightSidebarMode, settingsOpen, tabRuntimeSnapshot?.active_tab_id]);

  useEffect(() => {
    if (!settingsOpen) {
      return;
    }

    void window.seekstar.settings.load().then(setSettings);
    void window.seekstar.data.getPaths().then(setStorePaths);
  }, [settingsOpen]);

  function applySelection(result: { selectedNodeIds: string[]; focusNodeId?: string }, showSelectionActions = false): void {
    setSelectedNodeIds(result.selectedNodeIds);
    setSelectedRelationId(undefined);
    setSelectedObservationId(undefined);
    setViewportFocusNodeId(result.focusNodeId);
    setIsSelectionActionCardOpen(result.selectedNodeIds.length > 0 && showSelectionActions);
  }

  function toggleRightSidebar(): void {
    setRightSidebarMode((current) => (current === "collapsed" ? "compact" : "collapsed"));
  }

  function showRightSidebar(): void {
    setRightSidebarMode((current) => (current === "collapsed" ? "compact" : current));
  }

  function handleRightSidebarResizeStart(event: ReactPointerEvent<HTMLElement>): void {
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = rightSidebarMode === "expanded" ? rightSidebarWidth : RIGHT_SIDEBAR_COMPACT_WIDTH;

    setRightSidebarWidth(startWidth);
    setRightSidebarMode("expanded");

    function handlePointerMove(moveEvent: PointerEvent): void {
      const nextWidth = Math.min(560, Math.max(300, startWidth + startX - moveEvent.clientX));
      setRightSidebarWidth(nextWidth);
    }

    function handlePointerUp(): void {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    }

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp, { once: true });
  }

  useEffect(() => {
    if (!workspaceHydrated || !hydratedSelection) {
      return;
    }

    setSelectedNodeIds(hydratedSelection.selectedNodeIds);
    setViewportFocusNodeId(hydratedSelection.focusNodeId);
  }, [hydratedSelection, workspaceHydrated]);

  useEffect(() => {
    let cancelled = false;

    void window.seekstar.tabs.getActiveCanvasTool(activeCanvasToolTabId).then((tool) => {
      if (!cancelled) {
        setActiveCanvasTool(tool);
      }
    });

    const unsubscribe = window.seekstar.tabs.onCanvasToolChanged((event) => {
      if (event.tabId === activeCanvasToolTabId) {
        setActiveCanvasTool(event.tool);
      }
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [activeCanvasToolTabId]);

  useEffect(() => {
    let fadeTimeoutId: number | undefined;

    const hideSplash = (): void => {
      if (!splashVisible || splashFading) {
        return;
      }

      setSplashFading(true);
      fadeTimeoutId = window.setTimeout(() => {
        setSplashVisible(false);
      }, 180);
    };

    const maxTimeoutId = window.setTimeout(hideSplash, 10_000);
    const idleHandle = (window as unknown as { requestIdleCallback?: (cb: () => void) => number }).requestIdleCallback?.(
      () => {
        clearTimeout(maxTimeoutId);
        hideSplash();
      },
    );

    return () => {
      clearTimeout(maxTimeoutId);
      if (fadeTimeoutId !== undefined) {
        clearTimeout(fadeTimeoutId);
      }
      if (idleHandle !== undefined) {
        (window as unknown as { cancelIdleCallback?: (id: number) => void }).cancelIdleCallback?.(idleHandle);
      }
    };
  }, [splashFading, splashVisible]);

  const activeTab = getActiveTab(scene);
  const activeLayerLabel = getActiveLayerLabel(scene);
  const assistantActionPermissionMode = settings?.assistant_action_permission_mode ?? "ask_each_time";
  const assistantActionPermissionRules = settings?.assistant_action_permission_rules ?? createDefaultAssistantActionPermissionRules();
  const workingSetPolicy = createDefaultWorkingSetPolicy();
  const chunkAutoDiscoveryEnabled = workingSetPolicy.auto_expand_enabled;
  const commandKind = isDirectHttpUrl(commandValue.trim()) ? "url" : "keyword";
  const openingSkyStatus = resolveOpeningSkyStatus(scene, activeTab, runtimeStatus);
  const selectedNodes = useMemo(
    () => selectedNodeIds.map((nodeId) => scene.nodes.find((node) => node.id === nodeId)).filter((node): node is TerrainNode => Boolean(node)),
    [scene.nodes, selectedNodeIds],
  );
  const selectedNode = selectedNodeIds.length === 1 ? scene.nodes.find((node) => node.id === selectedNodeIds[0]) : undefined;
  const selectedRelation = selectedRelationId ? scene.relations.find((relation) => relation.id === selectedRelationId) : undefined;
  const selectedRelationNodes = selectedRelation ? getRelationNodes(scene, selectedRelation) : undefined;
  const highlightedNodeIds = useMemo(() => searchResults.map((result) => result.nodeId), [searchResults]);
  const activeBasketItems = basketByTabId[activeTabId] ?? [];
  const jobState = getAgentJobState(scene.agent_jobs.map((job) => job.status));
  const visibleNodeCount = scene.nodes.filter((node) => node.layer === scene.viewport.layer).length;
  const runtimeTabsById = useMemo(() => new Map((tabRuntimeSnapshot?.tabs ?? []).map((tab) => [tab.id, tab])), [tabRuntimeSnapshot]);
  const folderCounts = useMemo(() => {
    const counts = new Map<string, number>();

    for (const tab of tabRuntimeSnapshot?.tabs ?? []) {
      if (tab.folder_id) {
        counts.set(tab.folder_id, (counts.get(tab.folder_id) ?? 0) + 1);
      }
    }

    return counts;
  }, [tabRuntimeSnapshot]);

  function handleSceneSelection(
    nodeIds: string[],
    focusNodeId?: string,
    showSelectionActions = false,
    intent: SelectionIntent = "inspect",
  ): void {
    applySelection(syncSceneSelection(nodeIds, focusNodeId, intent), showSelectionActions);
  }

  function handleSceneViewport(viewport: TerrainScene["viewport"]): void {
    if (semanticLayerTransition && viewport.layer !== scene.viewport.layer) {
      return;
    }

    const nextSelectedNodeIds = syncSceneViewport(viewport, selectedNodeIds);
    const chunk = worldSegmentForViewport(
      viewport,
      workingSetPolicy.chunk_width,
      workingSetPolicy.chunk_height,
    );
    const viewportTraceKey = `${activeTabId}:${viewport.layer}:${chunk.key}:${Math.round(viewport.x / 120)}:${Math.round(viewport.y / 120)}:${Math.round(viewport.zoom * 10)}`;

    if (lastViewportTraceKeyRef.current !== viewportTraceKey) {
      lastViewportTraceKeyRef.current = viewportTraceKey;
      traceTelescopeUi("viewport.changed", {
        chunk,
        layer: viewport.layer,
        selected_count: nextSelectedNodeIds.length,
        tab_id: activeTabId,
        viewport: {
          x: Math.round(viewport.x),
          y: Math.round(viewport.y),
          zoom: Number(viewport.zoom.toFixed(3)),
        },
      });
    }

    if (!areNodeIdArraysEqual(nextSelectedNodeIds, selectedNodeIds)) {
      setSelectedNodeIds(nextSelectedNodeIds);
      setSelectedRelationId(undefined);
      setSelectedObservationId(undefined);
      setViewportFocusNodeId(nextSelectedNodeIds[0]);
      setIsSelectionActionCardOpen(false);
    }
  }

  function handleCanvasToolSelect(tool: CanvasTool): void {
    setActiveCanvasTool(tool);
    void window.seekstar.tabs.setActiveCanvasTool(activeCanvasToolTabId, tool).catch(() => {
      setActiveCanvasTool("pointer");
    });
  }

  function handleLayerSelect(layer: LayerId, focusNodeId?: string): void {
    const result = selectLayer(layer, focusNodeId);
    traceTelescopeUi("layer.select", {
      focus_node_id: focusNodeId,
      from_layer: scene.viewport.layer,
      result_focus_node_id: result.focusNodeId,
      result_selected_count: result.selectedNodeIds.length,
      tab_id: activeTabId,
      to_layer: layer,
    });
    applySelection(result);
  }

  function beginSemanticLayerTransition(request: SemanticLayerTransitionRequest): void {
    const currentScene = sceneRef.current;

    if (currentScene.viewport.layer !== request.fromLayer || request.toLayer === request.fromLayer) {
      return;
    }

    const transitionId = semanticLayerTransitionCounterRef.current + 1;
    semanticLayerTransitionCounterRef.current = transitionId;
    semanticLayerTransitionTimeoutsRef.current.forEach((timeoutId) => window.clearTimeout(timeoutId));
    semanticLayerTransitionTimeoutsRef.current = [];

    setSemanticLayerTransition({
      direction: request.direction,
      focusKind: request.focusKind,
      focusTitle: request.focusTitle,
      fromLayer: request.fromLayer,
      id: transitionId,
      origin: request.origin,
      phase: "revealing",
      toLayer: request.toLayer,
    });
    handleLayerSelect(request.toLayer, request.focusNodeId);
    const clearTimeoutId = window.setTimeout(() => {
      setSemanticLayerTransition((current) => (current?.id === transitionId ? undefined : current));
    }, SEMANTIC_LAYER_TRANSITION_MS);

    semanticLayerTransitionTimeoutsRef.current = [clearTimeoutId];
  }

  function handleSemanticZoomRequest(request: SemanticZoomRequest): void {
    const currentScene = sceneRef.current;

    const toLayer = resolveSemanticZoomTargetLayer(request.fromLayer, request.direction);

    if (!toLayer) {
      return;
    }

    const focusNode = request.focusNodeId ? currentScene.nodes.find((node) => node.id === request.focusNodeId) : undefined;
    beginSemanticLayerTransition({
      direction: request.direction,
      focusKind: request.focusKind,
      focusNodeId: request.direction === "in" ? focusNode?.id : undefined,
      focusTitle: focusNode?.title,
      fromLayer: request.fromLayer,
      origin: request.origin,
      toLayer,
    });
  }

  function handleCommandChange(event: ChangeEvent<HTMLInputElement>): void {
    const nextValue = event.target.value;
    setCommandValue(nextValue);
    setIsCommandModalOpen(nextValue.trim().length > 0);
  }

  function handleCommandKeyDown(event: KeyboardEvent<HTMLInputElement>): void {
    if (event.key === "Escape") {
      setIsCommandModalOpen(false);
      setCommandValue("");
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      if (commandIntent === "new_seek") {
        void handleUseAsSeed();
      } else if (commandIntent === "search_current") {
        handleSearchCurrentTab();
      } else {
        void handleAddKeywordToCurrentPage();
      }
    }
  }

  async function handleAddKeywordToCurrentPage(): Promise<void> {
    const seed = commandValue.trim();

    if (!seed) {
      return;
    }

    if (isDirectHttpUrl(seed)) {
      resetCommandAndSearch();
      resetSelection();
      showRightSidebar();

      const result = await openDirectUrlAsSeek(seed);

      if (result) {
        applySelection(result);
      }
      return;
    }

    const result = await exploreInCurrentTab(seed);

    resetCommandAndSearch();
    resetSelection();

    if (result) {
      applySelection(result);
    }
    showRightSidebar();
  }

  async function handleUseAsSeed(): Promise<void> {
    const seed = commandValue.trim();

    if (!seed) {
      return;
    }

    if (isDirectHttpUrl(seed)) {
      resetCommandAndSearch();
      resetSelection();

      const result = await openDirectUrlAsSeek(seed);

      if (result) {
        applySelection(result);
      }
      return;
    }

    resetCommandAndSearch();
    resetSelection();

    const result = await createSeedTab(seed);

    if (result) {
      applySelection(result);
    }
    showRightSidebar();
  }

  function handleSearchCurrentTab(): void {
    const query = commandValue.trim();
    const results = searchScene(scene, query);
    setSearchQuery(query);
    setSearchResults(results);
    setSelectedRelationId(undefined);
    setSelectedObservationId(undefined);
    setIsSelectionActionCardOpen(false);
    setIsCommandModalOpen(false);
    setCommandValue("");
    showRightSidebar();
  }

  function requestTileAbsorption(nodeId: string, trigger: TileAbsorptionTrigger): void {
    tileAbsorptionRequestCounterRef.current += 1;
    setTileAbsorptionRequest({
      nodeId,
      trigger,
      requestId: tileAbsorptionRequestCounterRef.current,
    });
    setTileActionNodeId(undefined);
  }

  function handleNodeSelect(nodeId: string): void {
    const node = scene.nodes.find((candidate) => candidate.id === nodeId);

    traceTelescopeUi("node.select", {
      layer: scene.viewport.layer,
      node: summarizeNodeForTrace(node),
      selected_again: selectedNodeIds.length === 1 && selectedNodeIds[0] === nodeId,
      tab_id: activeTabId,
    });

    handleSceneSelection([nodeId], nodeId, false, "inspect");
    setTileActionNodeId(undefined);
    showRightSidebar();
  }

  function handleNodeOpen(nodeId: string, activation?: NodeActivationContext): void {
    const node = scene.nodes.find((candidate) => candidate.id === nodeId);

    traceTelescopeUi("node.open", {
      layer: scene.viewport.layer,
      node: summarizeNodeForTrace(node),
      tab_id: activeTabId,
    });

    if (node && isAbsorbableCanvasTile(node)) {
      handleSceneSelection([nodeId], nodeId, false, "inspect");
      setTileActionNodeId(nodeId);
      showRightSidebar();
      return;
    }

    if (node?.zoom_target) {
      traceTelescopeUi("node.zoom_target", {
        node: summarizeNodeForTrace(node),
        target: node.zoom_target,
        tab_id: activeTabId,
      });
      beginSemanticLayerTransition({
        direction: resolveSemanticTransitionDirection(scene.viewport.layer, node.zoom_target.layer),
        focusKind: "node",
        focusNodeId: node.zoom_target.node_id,
        focusTitle: node.title,
        fromLayer: scene.viewport.layer,
        origin: activation?.origin,
        toLayer: node.zoom_target.layer,
      });
      return;
    }

    const continuousZoomLayer = node ? resolveContinuousZoomInLayer(node.layer) : undefined;

    if (node && continuousZoomLayer) {
      traceTelescopeUi("node.zoom_continuous", {
        focus_node_id: node.id,
        from_layer: node.layer,
        tab_id: activeTabId,
        to_layer: continuousZoomLayer,
      });
      beginSemanticLayerTransition({
        direction: "in",
        focusKind: "node",
        focusNodeId: node.id,
        focusTitle: node.title,
        fromLayer: scene.viewport.layer,
        origin: activation?.origin,
        toLayer: continuousZoomLayer,
      });
      return;
    }

    handleSceneSelection([nodeId], nodeId);
    setTileActionNodeId(undefined);
    showRightSidebar();
  }

  function handleRelationSelect(relationId: string): void {
    const relation = scene.relations.find((candidate) => candidate.id === relationId);

    if (!relation) {
      return;
    }

    syncSceneSelection([]);
    setSelectedNodeIds([]);
    setSelectedRelationId(relationId);
    setSelectedObservationId(undefined);
    setViewportFocusNodeId(undefined);
    setIsSelectionActionCardOpen(false);
    showRightSidebar();
  }

  function handleSearchResultSelect(nodeId: string): void {
    handleSceneSelection([nodeId], nodeId, false, "search");
    showRightSidebar();
  }

  function handleTabSelect(tabId: string): void {
    void window.seekstar.tabs.activate(tabId).then(setTabRuntimeSnapshot);
  }

  async function handleTabClose(tabId: string): Promise<void> {
    setTabRuntimeSnapshot(await window.seekstar.tabs.close(tabId));
  }

  async function handleTabRefresh(tabId: string): Promise<void> {
    const snapshot = await window.seekstar.tabs.refresh(tabId);
    setTabRuntimeSnapshot(snapshot);
    pushShellToast("Tab runtime refreshed", "success");
  }

  async function handleTabPin(tabId: string): Promise<void> {
    const snapshot = await window.seekstar.tabs.togglePin(tabId);
    setTabRuntimeSnapshot(snapshot);
    const pinned = snapshot.tabs.find((tab) => tab.id === tabId)?.pinned;
    pushShellToast(pinned ? "Seek pinned" : "Seek unpinned", "success");
  }

  async function handleTabFavorite(tabId: string): Promise<void> {
    const snapshot = await window.seekstar.tabs.toggleFavorite(tabId);
    setTabRuntimeSnapshot(snapshot);
    const favorite = snapshot.tabs.find((tab) => tab.id === tabId)?.favorite;
    pushShellToast(favorite ? "Added to favorites" : "Removed from favorites", "success");
  }

  async function handleTabCopyCrashLog(tabId: string): Promise<void> {
    await window.seekstar.tabs.copyCrashLog(tabId);
  }

  async function handleTabFolderAssign(tabId: string, folderId?: string): Promise<void> {
    setTabRuntimeSnapshot(await window.seekstar.tabs.assignFolder(tabId, folderId));
    pushShellToast(folderId ? "Seek moved to field" : "Seek removed from field", "success");
  }

  async function handleTabDetach(tabId: string): Promise<void> {
    setTabRuntimeSnapshot(await window.seekstar.tabs.detach(tabId));
  }

  async function handleTabReorder(sourceTabId: string, targetTabId: string): Promise<void> {
    setTabRuntimeSnapshot(await window.seekstar.tabs.reorder(sourceTabId, targetTabId));
  }

  async function handleSettingsSave(request: SettingsSaveRequest): Promise<string[]> {
    const result = await window.seekstar.settings.save(request);
    setSettings(result.settings);
    return result.warnings;
  }

  async function handleFolderCreate(): Promise<void> {
    const title = window.prompt("Folder name");

    if (!title?.trim()) {
      return;
    }

    setTabRuntimeSnapshot(await window.seekstar.tabs.createFolder(title.trim()));
    pushShellToast("Field created", "success");
  }

  async function handleFolderDelete(folderId: string): Promise<void> {
    setTabRuntimeSnapshot(await window.seekstar.tabs.deleteFolder(folderId));
    pushShellToast("Field removed", "success");
  }

  async function handleWorkspaceRename(): Promise<void> {
    const title = window.prompt("Workspace name", tabRuntimeSnapshot?.workspace_name ?? "SeekStar local workspace");

    if (!title?.trim()) {
      return;
    }

    setTabRuntimeSnapshot(await window.seekstar.tabs.renameWorkspace(title.trim()));
    pushShellToast("Workspace renamed", "success");
  }

  function handleNewFieldSearch(): void {
    setCommandIntent("new_seek");
    setCommandValue("");
    setIsCommandModalOpen(false);
    window.setTimeout(() => commandInputRef.current?.focus(), 0);
  }

  function handleSearchCurrentMap(): void {
    setCommandIntent("search_current");
    setCommandValue("");
    setIsCommandModalOpen(false);
    window.setTimeout(() => commandInputRef.current?.focus(), 0);
  }

  function handleStarterSeed(seed: string): void {
    setCommandIntent(undefined);
    setCommandValue(seed);
    setIsCommandModalOpen(false);
    void handleCreateStarterSeed(seed);
  }

  async function handleCreateStarterSeed(seed: string): Promise<void> {
    resetCommandAndSearch();
    resetSelection();
    const result = await createSeedTab(seed);

    if (result) {
      applySelection(result);
    }
    showRightSidebar();
  }

  function handleClearSelection(): void {
    handleSceneSelection([]);
    setSearchQuery("");
    setSearchResults([]);
    setIsSelectionActionCardOpen(false);
  }

  function resetCommandAndSearch(): void {
    setCommandIntent(undefined);
    setCommandValue("");
    setIsCommandModalOpen(false);
    setSearchQuery("");
    setSearchResults([]);
  }

  function resetSelection(): void {
    setSelectedNodeIds([]);
    setSelectedRelationId(undefined);
    setSelectedObservationId(undefined);
    setViewportFocusNodeId(undefined);
    setIsSelectionActionCardOpen(false);
  }

  function createActiveSelectionBasketItem(): SelectionBasketItem | undefined {
    if (selectedNodes.length === 0) {
      return undefined;
    }

    return createSelectionBasketItem(activeTab, selectedNodes);
  }

  function handleSaveSelectionToTray(): void {
    const item = createActiveSelectionBasketItem();

    if (!item) {
      return;
    }

    setBasketByTabId((current) => ({
      ...current,
      [activeTabId]: [item, ...(current[activeTabId] ?? [])],
    }));
    setIsSelectionActionCardOpen(false);
  }

  function handleRemoveBasketItem(itemId: string): void {
    setBasketByTabId((current) => ({
      ...current,
      [activeTabId]: (current[activeTabId] ?? []).filter((item) => item.id !== itemId),
    }));
  }

  function handleClearBasket(): void {
    setBasketByTabId((current) => ({
      ...current,
      [activeTabId]: [],
    }));
  }

  async function handleUseSelectionAsSeedTab(): Promise<void> {
    const result = await handleUseSelectionAsSeed(selectedNodes);
    resetCommandAndSearch();
    resetSelection();

    if (result) {
      applySelection(result);
    }
  }

  async function handleUseNodeAsSeedTab(node: TerrainNode) {
    const result = await handleUseNodeAsSeed(node, getSourceForNode(scene, node));
    resetCommandAndSearch();
    resetSelection();

    if (result) {
      applySelection(result);
    }

    return result;
  }

  async function handleObserveCandidateSource(observation: ScoutObservation): Promise<void> {
    const result = await observeCandidateIntoCurrentTab(observation.id);

    if (!result) {
      return;
    }

    applySelection(result);
    setSelectedObservationId(undefined);
    setSearchQuery("");
    setSearchResults([]);
    setIsSelectionActionCardOpen(false);
    showRightSidebar();
  }

  async function handleReplaceFailedSourceCandidate(observation: ScoutObservation): Promise<void> {
    const result = await replaceFailedSourceCandidate(observation.id);

    if (!result) {
      return;
    }

    applySelection(result);
    setSearchQuery("");
    setSearchResults([]);
    setIsSelectionActionCardOpen(false);
    showRightSidebar();
  }

  async function handleAssistantAction(action: AiAssistantAction): Promise<AssistantActionExecutionResult | void> {
    if (resolveAssistantActionPermissionDecision(action, assistantActionPermissionMode, assistantActionPermissionRules) === "block") {
      throw new Error("Assistant action execution is blocked by settings.");
    }

    switch (action.type) {
      case "focus_node": {
        const undoContext = createViewportSelectionUndoContext(activeTab.id, scene, selectedNodeIds, viewportFocusNodeId);
        const targetNode = findAssistantTargetNode(action, scene);

        if (!targetNode) {
          throw new Error("Assistant action target node was not found in this map.");
        }

        if (targetNode.layer !== scene.viewport.layer) {
          handleLayerSelect(targetNode.layer, targetNode.id);
        } else {
          handleSearchResultSelect(targetNode.id);
        }
        showRightSidebar();
        return {
          message: "Focused the requested node.",
          undo: {
            context: undoContext,
            message: "Restore previous viewport and selection.",
          },
        };
      }

      case "request_chunk": {
        const undoContext = createViewportSelectionUndoContext(activeTab.id, scene, selectedNodeIds, viewportFocusNodeId);
        const layer = resolveAssistantActionLayer(action, scene.viewport.layer);
        const viewport = createAssistantChunkViewport(scene.viewport, layer, action, workingSetPolicy);
        const result = await handleEnsureWorkingSet(viewport, workingSetPolicy);

        if (!result?.scene) {
          handleSceneViewport(viewport);
          showRightSidebar();
          return {
            message: "Moved to the requested chunk.",
            undo: {
              context: createViewportSelectionUndoContext(activeTab.id, scene, selectedNodeIds, viewportFocusNodeId),
              message: "Restore previous viewport and selection.",
            },
          };
        }

        applySelection(result);
        showRightSidebar();
        return {
          message: "Moved to the requested world segment.",
          undo: {
            context: undoContext,
            message: "Restore previous viewport and selection.",
          },
        };
      }

      case "observe_source": {
        const observation = findAssistantTargetObservation(action, scene);

        if (observation) {
          if (observation.status === "failed" || observation.failure_reason) {
            await handleReplaceFailedSourceCandidate(observation);
            return {
              message: "Requested replacement candidates for the failed source.",
            };
          }

          const result = await observeCandidateIntoCurrentTab(observation.id);

          if (!result) {
            throw new Error("Source candidate could not be observed.");
          }

          applySelection(result);
          setSelectedObservationId(undefined);
          setSearchQuery("");
          setSearchResults([]);
          setIsSelectionActionCardOpen(false);
          showRightSidebar();
          return {
            message: "Observed the selected source candidate.",
          };
        }
        throw new Error("Assistant action did not target a source candidate in this world.");
      }

      case "create_seed": {
        const targetNode = findAssistantTargetNode(action, scene);
        const undoContextBase = createCloseCreatedTabUndoContext(selectedNodeIds, viewportFocusNodeId);

        if (targetNode) {
          const result = await handleUseNodeAsSeedTab(targetNode);
          showRightSidebar();
          return result
            ? {
              message: "Created a recursive seed tab from the target node.",
              undo: {
                context: {
                  ...undoContextBase,
                  created_tab_id: result.createdTabId,
                  origin_tab_id: result.originTabId,
                },
                message: "Close created seed tab and return to the origin tab.",
              },
            }
            : {
              message: "Created a recursive seed tab from the target node.",
            };
        }

        const seed = (action.seed || action.arguments?.seed || action.label || "").toString().trim();

        if (!seed) {
          throw new Error("Assistant action did not include a seed.");
        }

        const result = await createSeedTab(seed);

        if (result) {
          applySelection(result);
          showRightSidebar();
        }
        return result
          ? {
            message: "Created a recursive seed tab.",
            undo: {
              context: {
                ...undoContextBase,
                created_tab_id: result.createdTabId,
                origin_tab_id: result.originTabId,
              },
              message: "Close created seed tab and return to the origin tab.",
            },
          }
          : {
            message: "Created a recursive seed tab.",
          };
      }

      case "open_settings":
        setSettingsOpen(true);
        return {
          message: "Opened settings.",
        };

      case "none":
        return;

      default:
        throw new Error(`Unsupported assistant action: ${action.type}`);
    }
  }

  async function handleAssistantUndo(context: AssistantOperationUndoContext): Promise<string> {
    if (context.kind === "close_created_tab") {
      setTabRuntimeSnapshot(await window.seekstar.tabs.close(context.created_tab_id));
      setTabRuntimeSnapshot(await window.seekstar.tabs.activate(context.origin_tab_id));
      resetCommandAndSearch();
      setSelectedNodeIds(context.selected_node_ids);
      setSelectedRelationId(undefined);
      setSelectedObservationId(undefined);
      setViewportFocusNodeId(context.focus_node_id ?? context.selected_node_ids[0]);
      setIsSelectionActionCardOpen(false);
      showRightSidebar();

      return "Closed created seed tab.";
    }

    if (context.kind !== "restore_viewport_selection") {
      throw new Error("Unsupported assistant undo operation.");
    }

    if (context.tab_id !== activeTab.id) {
      throw new Error("Undo target is not the active tab.");
    }

    const restoredSelectedNodeIds = syncSceneViewport(context.viewport, context.selected_node_ids);
    setSelectedNodeIds(restoredSelectedNodeIds);
    setSelectedRelationId(undefined);
    setSelectedObservationId(undefined);
    setViewportFocusNodeId(context.focus_node_id ?? restoredSelectedNodeIds[0]);
    setIsSelectionActionCardOpen(false);
    showRightSidebar();

    return "Restored previous viewport and selection.";
  }

  async function handleAttachRuntimeTab(): Promise<void> {
    if (!runtimeTabId) {
      return;
    }

    await window.seekstar.tabs.attach(runtimeTabId);
  }

  async function handleCloseRuntimeTab(): Promise<void> {
    if (!runtimeTabId) {
      return;
    }

    await window.seekstar.tabs.close(runtimeTabId);
  }

  const appShellClass = isDockedTabView
    ? "app-shell docked-tab-shell"
    : isDetachedTabWindow
      ? "app-shell tab-window-shell"
      : "app-shell";

  return (
    <main className={appShellClass}>
      {splashVisible ? (
        <div className={splashFading ? "app-splash-overlay is-fading" : "app-splash-overlay"}>
          <div className="splash-mark" aria-hidden="true">
            <svg fill="none" height="72" viewBox="0 0 72 72" width="72" xmlns="http://www.w3.org/2000/svg">
              <g stroke="currentColor" strokeLinecap="square" strokeLinejoin="miter" strokeWidth="2">
                <path d="M18 50 L50 26" />
                <path d="M16 52 L20 48" />
                <path d="M48 28 L52 24" />
                <path d="M16 52 L12 56" />
                <path d="M52 24 L56 20" />
                <path d="M34 42 L34 58" />
                <path d="M34 58 L24 64" />
                <path d="M34 58 L44 64" />
                <path d="M34 58 L34 64" />
              </g>
            </svg>
          </div>
        </div>
      ) : null}

      {isDetachedTabWindow ? (
        <DetachedTabTitleBar
          activeTab={activeTab}
          onAttach={handleAttachRuntimeTab}
          onClose={handleCloseRuntimeTab}
          onToggleRightSidebar={toggleRightSidebar}
          rightSidebarExpanded={rightSidebarVisible}
        />
      ) : isDockedTabView ? null : (
        <WindowTitleBar
          leftSidebarExpanded={!leftSidebarCollapsed}
          onToggleLeftSidebar={() => setLeftSidebarCollapsed((current) => !current)}
        />
      )}
      {settingsOpen && isShellWindow ? (
        <SettingsPage
          settings={settings}
          storePaths={storePaths}
          onBack={() => setSettingsOpen(false)}
          onClearCache={() => window.seekstar.tabs.clearCache().then(setTabRuntimeSnapshot)}
          onSave={handleSettingsSave}
        />
      ) : (
        <div className={isDetachedTabWindow || isDockedTabView ? "desktop-shell detached-tab-desktop" : "desktop-shell"}>
        {isShellWindow ? (
          <SidebarRail mode={leftSidebarCollapsed ? "collapsed" : "expanded"} label="Observatory" side="left">
            <ObservatorySidebar
              activeTabId={tabRuntimeSnapshot?.active_tab_id ?? activeTabId}
              activeTool={activeCanvasTool}
              onNewFieldSearch={handleNewFieldSearch}
              onSearchCurrentMap={handleSearchCurrentMap}
              onStarterSeed={handleStarterSeed}
              folders={tabRuntimeSnapshot?.folders ?? []}
              folderCounts={folderCounts}
              onOpenSettings={() => setSettingsOpen(true)}
              onTabClose={handleTabClose}
              onTabCopyCrashLog={handleTabCopyCrashLog}
              onTabDetach={handleTabDetach}
              onTabFavorite={handleTabFavorite}
              onTabFolderAssign={handleTabFolderAssign}
              onTabPin={handleTabPin}
              onTabRefresh={handleTabRefresh}
              onTabReorder={handleTabReorder}
              onToolSelect={handleCanvasToolSelect}
              onTabSelect={handleTabSelect}
              onFolderCreate={handleFolderCreate}
              onFolderDelete={handleFolderDelete}
              onWorkspaceRename={handleWorkspaceRename}
              runtimeTabsById={runtimeTabsById}
              tabs={tabRuntimeSnapshot?.tabs ?? []}
              workspaceName={tabRuntimeSnapshot?.workspace_name ?? "SeekStar local workspace"}
            />
          </SidebarRail>
        ) : null}

        {isShellWindow ? (
          <ShellDockWorkbench
            activeRuntimeTab={runtimeTabsById.get(tabRuntimeSnapshot?.active_tab_id ?? activeTabId)}
            dockHostRef={dockHostRef}
          />
        ) : (
        <section className="main-workbench">
          <div className="workbench-body">
            <WorkbenchHeader
              activeTab={activeTab}
              breadcrumb={getActiveLayerBreadcrumb(scene)}
              jobState={jobState}
              layer={scene.viewport.layer}
              layerLabel={activeLayerLabel}
              layers={scene.layers}
              onLayerSelect={handleLayerSelect}
              onToggleRightSidebar={toggleRightSidebar}
              rightSidebarExpanded={rightSidebarVisible}
              showRightSidebarToggle={shouldRenderRightSidebar}
            />
            <div className="workbench-canvas-wrap">
              <TerrainCanvas
                activeTool={activeCanvasTool}
                focusedNodeId={scene.runtime.focused_node_id ?? viewportFocusNodeId}
                highlightedNodeIds={highlightedNodeIds}
                onBrowserModeExit={() => {
                  applySelection(handleTileAbsorptionExit());
                }}
                onFrontierDiscovery={(viewport) => {
                  if (!chunkAutoDiscoveryEnabled) {
                    return;
                  }
                  handleCanvasFrontierDiscovery(viewport, workingSetPolicy);
                  setRightSidebarMode("compact");
                }}
                onSemanticZoomRequest={handleSemanticZoomRequest}
                semanticTransitionActive={Boolean(semanticLayerTransition)}
                semanticTransitionDirection={semanticLayerTransition?.direction}
                semanticTransitionOrigin={semanticLayerTransition?.origin}
                semanticTransitionStage={semanticLayerTransition?.phase ?? "idle"}
                onNodeSelect={handleNodeSelect}
                onNodeOpen={handleNodeOpen}
                onRelationSelect={handleRelationSelect}
                onSelectionChange={handleSceneSelection}
                onTileAbsorptionComplete={(nodeId, trigger) => {
                  applySelection(handleTileAbsorptionEnter(nodeId, trigger));
                }}
                onViewportChange={handleSceneViewport}
                scene={scene}
                selectedNodeIds={selectedNodeIds}
                selectedRelationId={selectedRelationId}
                tileAbsorptionRequest={tileAbsorptionRequest}
                tileFieldTargetCount={settings?.tile_field_target_count}
                viewport={scene.viewport}
              />
              {openingSkyStatus ? <OpeningSkyStatus status={openingSkyStatus} /> : null}
              {workspaceLoadError ? (
                <aside className="workspace-load-error" aria-live="polite">
                  <span>Exploration world needs attention</span>
                  <strong>The current view remains local and stable</strong>
                  <p>{workspaceLoadError}</p>
                  <button
                    onClick={() => {
                      void handleCanvasFrontierDiscovery(scene.viewport, workingSetPolicy);
                    }}
                    type="button"
                  >
                    Retry working set
                  </button>
                </aside>
              ) : null}
              {isSelectionActionCardOpen && selectedNodes.length > 0 ? (
                <SelectionActionCard
                  nodeCount={selectedNodes.length}
                  onDismiss={() => setIsSelectionActionCardOpen(false)}
                  onSaveSelection={handleSaveSelectionToTray}
                  onUseAsSeed={handleUseSelectionAsSeedTab}
                />
              ) : null}
              {tileActionNodeId ? (
                <TileActionChooser
                  node={scene.nodes.find((node) => node.id === tileActionNodeId)}
                  onDismiss={() => setTileActionNodeId(undefined)}
                  onEnterBrowser={() => requestTileAbsorption(tileActionNodeId, "click")}
                />
              ) : null}
            </div>
          </div>
          <CommandComposer
            commandKind={commandKind}
            commandInputRef={commandInputRef}
            commandValue={commandValue}
            intent={commandIntent}
            isCommandModalOpen={isCommandModalOpen}
            onCommandChange={handleCommandChange}
            onCommandFocus={() => setIsCommandModalOpen(commandValue.trim().length > 0)}
            onCommandKeyDown={handleCommandKeyDown}
            onAddToCurrentPage={handleAddKeywordToCurrentPage}
            onSearchCurrentTab={handleSearchCurrentTab}
            onUseAsSeed={handleUseAsSeed}
          />
          <StatusStrip
            jobState={jobState}
            layer={scene.viewport.layer}
            layerLabel={activeLayerLabel}
            nodeCount={scene.nodes.length}
            visibleNodeCount={visibleNodeCount}
            persistenceStatus={persistenceStatus}
            selectedCount={selectedNodeIds.length}
            sourceCount={scene.sources.length}
          />
        </section>
        )}

        {shouldRenderRightSidebar && !rightSidebarVisible ? (
          <button
            aria-label="Restore AI Map Control"
            className="right-sidebar-restore-handle"
            onClick={() => setRightSidebarMode("compact")}
            title="Restore AI Map Control"
            type="button"
          >
            AI
          </button>
        ) : null}
        {shouldRenderRightSidebar ? (
        <SidebarRail
          label="AI Map Control"
          mode={rightSidebarMode}
          onResizePointerDown={rightSidebarVisible ? handleRightSidebarResizeStart : undefined}
          side="right"
          style={rightSidebarStyle}
        >
          <AiMapControlSidebar
            activeTab={activeTab}
            assistantActionPermissionMode={assistantActionPermissionMode}
            assistantActionPermissionRules={assistantActionPermissionRules}
            basketItems={activeBasketItems}
            mode={rightSidebarMode}
            onAssistantAction={handleAssistantAction}
            onAssistantUndo={handleAssistantUndo}
            onClearBasket={handleClearBasket}
            onClearSelection={handleClearSelection}
            onModeChange={setRightSidebarMode}
            onObserveCandidate={handleObserveCandidateSource}
            onReplaceFailedSource={handleReplaceFailedSourceCandidate}
            onRemoveBasketItem={handleRemoveBasketItem}
            onLayerSelect={handleLayerSelect}
            onSaveSelectionToTray={handleSaveSelectionToTray}
            onSearchResultSelect={handleSearchResultSelect}
            onUseNodeAsSeed={handleUseNodeAsSeedTab}
            scene={scene}
            searchQuery={searchQuery}
            searchResults={searchResults}
            selectedNode={selectedNode}
            selectedNodes={selectedNodes}
            selectedObservationId={selectedObservationId}
            selectedRelation={selectedRelation}
            selectedRelationNodes={selectedRelationNodes}
          />
        </SidebarRail>
        ) : null}
        </div>
      )}
      <ShellFeedback
        runtimeStatus={runtimeStatus}
        onDismiss={dismissShellToast}
        persistenceStatus={persistenceStatus}
        toasts={shellToasts}
      />
    </main>
  );
}

function isAbsorbableCanvasTile(node: TerrainNode): boolean {
  return Boolean(
    node.layer === "L3" &&
      node.source_state === "source_backed" &&
      node.source_url &&
      (node.type === "webpage" || node.type === "document"),
  );
}

interface OpeningSkyStatusModel {
  body: string;
  title: string;
  tone: "error" | "generating" | "idle";
}

function OpeningSkyStatus({ status }: { status: OpeningSkyStatusModel }): ReactElement {
  return (
    <aside className={`opening-sky-status opening-sky-status-${status.tone}`} aria-live="polite">
      <span>AI Opening Sky</span>
      <strong>{status.title}</strong>
      <p>{status.body}</p>
    </aside>
  );
}

function resolveOpeningSkyStatus(
  scene: TerrainScene,
  activeTab: ExplorationTab,
  runtimeStatus: ExplorationRuntimeStatus,
): OpeningSkyStatusModel | undefined {
  const hasTerrain = scene.nodes.some((node) => node.source_state === "source_backed" || node.tags?.includes("exploration-world-v2"));

  if (
    activeTab.source_mode !== "opening_sky" ||
    scene.viewport.layer !== "L0" ||
    scene.sources.length > 0 ||
    hasTerrain ||
    isDirectHttpUrl(activeTab.seed)
  ) {
    return undefined;
  }

  if (runtimeStatus.phase === "error") {
    return {
      body: runtimeStatus.message || "世界生成器没有返回可用的初始地形。",
      title: "AI opening sky failed",
      tone: "error",
    };
  }

  if (runtimeStatus.phase === "generating") {
    return {
      body: runtimeStatus.message || "SeekStar 正在生成附近的世界段与来源方向。",
      title: "正在生成今晚星空",
      tone: "generating",
    };
  }

  return {
    body: "SeekStar is preparing the first AI-generated star field. The command bar is only an auxiliary entrance.",
    title: "正在揭开望远镜盖子",
    tone: "idle",
  };
}

function areNodeIdArraysEqual(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every((nodeId, index) => nodeId === right[index]);
}

function resolveContinuousZoomInLayer(layer: LayerId): LayerId | undefined {
  if (layer === "L0") {
    return "L1";
  }

  if (layer === "L1") {
    return "L2";
  }

  if (layer === "L2") {
    return "L3";
  }

  return undefined;
}

function resolveSemanticTransitionDirection(fromLayer: LayerId, toLayer: LayerId): "in" | "out" {
  const layerOrder: Record<string, number> = {
    L0: 0,
    L1: 1,
    L2: 2,
    L3: 3,
  };
  const fromIndex = layerOrder[fromLayer];
  const toIndex = layerOrder[toLayer];

  if (fromIndex === undefined || toIndex === undefined) {
    return "in";
  }

  return toIndex > fromIndex ? "in" : "out";
}

function resolveSemanticZoomTargetLayer(layer: LayerId, direction: "in" | "out"): LayerId | undefined {
  if (direction === "in") {
    return resolveContinuousZoomInLayer(layer);
  }

  if (layer === "L3") {
    return "L2";
  }

  if (layer === "L2") {
    return "L1";
  }

  if (layer === "L1") {
    return "L0";
  }

  return undefined;
}

function traceTelescopeUi(event: string, payload?: unknown): void {
  try {
    if (window.localStorage.getItem("seekstar.trace") !== "1") {
      return;
    }
  } catch {
    return;
  }

  const suffix = payload === undefined ? "" : ` ${stringifyTelescopeTracePayload(payload)}`;
  console.info(`[SeekStar][telescope-ui] ${event}${suffix}`);
}

function stringifyTelescopeTracePayload(payload: unknown): string {
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

function summarizeNodeForTrace(node: TerrainNode | undefined): Record<string, unknown> | undefined {
  if (!node) {
    return undefined;
  }

  return {
    id: node.id,
    layer: node.layer,
    source_state: node.source_state,
    title: node.title,
    type: node.type,
    x: node.position_hint?.x === undefined ? undefined : Math.round(node.position_hint.x),
    y: node.position_hint?.y === undefined ? undefined : Math.round(node.position_hint.y),
  };
}

function TileActionChooser({
  node,
  onDismiss,
  onEnterBrowser,
}: {
  node?: TerrainNode;
  onDismiss: () => void;
  onEnterBrowser: () => void;
}): ReactElement | null {
  if (!node) {
    return null;
  }

  return (
    <aside className="tile-action-chooser" aria-label="Tile actions">
      <button className="tile-action-chooser-backdrop" aria-label="Dismiss tile actions" onClick={onDismiss} type="button" />
      <div className="tile-action-chooser-panel">
        <span>L3 来源</span>
        <strong>{node.title}</strong>
        <div>
          <button onClick={onEnterBrowser} type="button">
            Open browser mode
          </button>
        </div>
      </div>
    </aside>
  );
}

function findAssistantTargetNode(action: AiAssistantAction, scene: TerrainScene): TerrainNode | undefined {
  if (!action.target_id) {
    return undefined;
  }

  return scene.nodes.find((node) => node.id === action.target_id);
}

function findAssistantTargetObservation(action: AiAssistantAction, scene: TerrainScene): ScoutObservation | undefined {
  const observations = scene.scout_observations ?? [];

  if (action.target_id) {
    const targetObservation = observations.find((observation) => observation.id === action.target_id);

    if (targetObservation) {
      return targetObservation;
    }
  }

  const url = getAssistantActionUrl(action);

  if (url) {
    return observations.find(
      (observation) =>
        observation.url === url ||
        observation.source_snapshot?.url === url ||
        observation.source_snapshot?.final_url === url,
    );
  }

  return observations.find((observation) => observation.status === "source_candidate");
}

function getAssistantActionUrl(action: AiAssistantAction): string | undefined {
  const value = action.arguments?.url ?? action.arguments?.source_url ?? action.seed;

  return typeof value === "string" ? value.trim() : undefined;
}

function createViewportSelectionUndoContext(
  tabId: string,
  scene: TerrainScene,
  selectedNodeIds: string[],
  focusNodeId?: string,
): AssistantOperationUndoContext {
  return {
    focus_node_id: focusNodeId,
    kind: "restore_viewport_selection",
    selected_node_ids: [...selectedNodeIds],
    tab_id: tabId,
    viewport: { ...scene.viewport },
  };
}

function createCloseCreatedTabUndoContext(
  selectedNodeIds: string[],
  focusNodeId?: string,
): Omit<Extract<AssistantOperationUndoContext, { kind: "close_created_tab" }>, "created_tab_id" | "origin_tab_id"> {
  return {
    focus_node_id: focusNodeId,
    kind: "close_created_tab",
    selected_node_ids: [...selectedNodeIds],
  };
}

function createDefaultAssistantActionPermissionRules(): SeekStarSettings["assistant_action_permission_rules"] {
  return [
    { action_type: "focus_node", decision: "allow_after_click" },
    { action_type: "request_chunk", decision: "allow_after_click" },
    { action_type: "open_settings", decision: "allow_after_click" },
    { action_type: "observe_source", decision: "ask_each_time" },
    { action_type: "create_seed", decision: "ask_each_time" },
  ];
}

function createDefaultWorkingSetPolicy(): ExplorationWorkingSetPolicy {
  return {
    auto_expand_enabled: true,
    auto_preload_ring: 1,
    boundary_debounce_ms: 520,
    chunk_height: 900,
    chunk_width: 1200,
    manual_preload_range: 1,
  };
}

function resolveAssistantActionPermissionDecision(
  action: AiAssistantAction,
  mode: SeekStarSettings["assistant_action_permission_mode"],
  rules: SeekStarSettings["assistant_action_permission_rules"],
): SeekStarSettings["assistant_action_permission_rules"][number]["decision"] {
  if (action.type === "none") {
    return "allow_after_click";
  }

  if (mode === "block_all") {
    return "block";
  }

  const rule = rules.find((candidate) => candidate.action_type === action.type);

  if (rule?.decision === "block") {
    return "block";
  }

  if (mode === "allow_low_risk" && (rule?.decision === "allow_after_click" || (!rule && isLowRiskAssistantAction(action.type)))) {
    return "allow_after_click";
  }

  return "ask_each_time";
}

function isLowRiskAssistantAction(actionType: AiAssistantAction["type"]): boolean {
  return actionType === "focus_node" || actionType === "request_chunk" || actionType === "open_settings";
}

function resolveAssistantActionLayer(action: AiAssistantAction, fallback: LayerId): LayerId {
  const value = action.level_id?.trim();

  return value ? (value as LayerId) : fallback;
}

function createAssistantChunkViewport(
  viewport: TerrainScene["viewport"],
  layer: LayerId,
  action: AiAssistantAction,
  scheduling: ExplorationWorkingSetPolicy = createDefaultWorkingSetPolicy(),
): TerrainScene["viewport"] {
  const direction = typeof action.arguments?.direction === "string" ? action.arguments.direction : "right";
  const chunkWidth = typeof action.arguments?.chunk_width === "number" ? action.arguments.chunk_width : scheduling.chunk_width;
  const chunkHeight = typeof action.arguments?.chunk_height === "number" ? action.arguments.chunk_height : scheduling.chunk_height;
  const nextViewport = { ...viewport, layer };

  switch (direction) {
    case "left":
    case "west":
      return { ...nextViewport, x: viewport.x - chunkWidth };
    case "up":
    case "north":
      return { ...nextViewport, y: viewport.y - chunkHeight };
    case "down":
    case "south":
      return { ...nextViewport, y: viewport.y + chunkHeight };
    case "right":
    case "east":
    default:
      return { ...nextViewport, x: viewport.x + chunkWidth };
  }
}
