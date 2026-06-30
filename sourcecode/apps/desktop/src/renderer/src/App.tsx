import type { ExplorationTab, LayerId, ScoutObservation, ScoutPlan, SourceRef, TerrainNode, TerrainScene } from "@seekstar/core-schema";
import type { TileAbsorptionTrigger } from "@seekstar/core-schema";
import type { DeepLensSnapshot } from "@seekstar/core-schema";
import type { AiAssistantAction } from "@seekstar/ai-service";
import { isDirectHttpUrl, type SourceIngestionInput } from "@seekstar/constellation-engine";
import type { SeekStarSettings } from "../../main/appSettingsStore";
import type { TabRuntimeSnapshot } from "../../main/tabRuntimeManager";
import type { CSSProperties, ChangeEvent, KeyboardEvent, PointerEvent as ReactPointerEvent, ReactElement } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { DetachedTabTitleBar, ShellDockWorkbench, SidebarRail, WindowTitleBar, type SidebarRailMode } from "./components/AppChrome";
import type { CanvasTool } from "./components/canvasTools";
import { ObservatorySidebar } from "./components/ObservatorySidebar";
import { TerrainCanvas } from "./components/TerrainCanvas";
import type { TileAbsorptionRequest } from "./components/TerrainCanvas";
import { CommandComposer, SelectionActionCard, StatusStrip, WorkbenchHeader } from "./components/WorkbenchChrome";
import { AiMapControlSidebar, type AssistantActionExecutionResult, type AssistantOperationUndoContext, type AssistantSceneRollbackPatch } from "./components/ai-map-control/AiMapControlSidebar";
import { SettingsPage } from "./components/settings/SettingsPage";
import { createCartographerChunkKeyForViewport, type CartographerRuntimeStatus } from "./exploration/cartographerRuntimeClient";
import {
  getActiveLayerBreadcrumb,
  getActiveLayerLabel,
  getActiveTab,
  getAgentJobState,
  getRelationNodes,
  getSourceForNode,
} from "./exploration/types";
import { type CartographerChunkSchedulingPolicy, useExplorationSession } from "./exploration/useExplorationSession";
import { type SearchResult, searchScene } from "./search/localSceneSearch";
import { type SelectionBasketItem, createSelectionBasketItem } from "./selection/selectionBasket";

type RightSidebarMode = Extract<SidebarRailMode, "collapsed" | "compact" | "expanded">;

const RIGHT_SIDEBAR_COMPACT_WIDTH = 340;
const RIGHT_SIDEBAR_EXPANDED_WIDTH = 500;

export function App(): ReactElement {
  const runtimeParams = useMemo(() => new URLSearchParams(window.location.search), []);
  const runtimeTabId = runtimeParams.get("runtimeTabId") ?? undefined;
  const runtimeSurface = runtimeParams.get("runtimeSurface");
  const isDockedTabView = Boolean(runtimeTabId && runtimeSurface === "docked");
  const isDetachedTabWindow = Boolean(runtimeTabId && !isDockedTabView);
  const isShellWindow = !runtimeTabId;
  const exploration = useExplorationSession({
    enableCartographerAutomation: !isShellWindow,
    runtimeTabId,
  });
  const {
    scene,
    activeTabId,
    scenesByTabId,
    basketByTabId,
    setBasketByTabId,
    cartographerChunkRecords,
    cartographerStatus,
    persistenceStatus,
    workspaceLoadError,
    workspaceHydrated,
    hydratedSelection,
    syncWorkspaceFromStore,
    syncSceneSelection,
    syncSceneViewport,
    handleLayerSelect: selectLayer,
    handleTileFocus,
    handleTileAbsorptionEnter,
    handleTileAbsorptionExit,
    handleEnterDeepLens,
    handleExploreInCurrentTab: exploreInCurrentTab,
    handleApplyDomainLexiconToDefaultSeek: applyDomainLexiconToDefaultSeek,
    handleUseAsSeed: createSeedTab,
    handleUseHyperlinkAsSeed: createHyperlinkTab,
    handleIngestDirectUrlIntoCurrentTab: ingestDirectUrlIntoCurrentTab,
    handleOpenDirectUrlAsSeek: openDirectUrlAsSeek,
    handleObserveCandidateIntoCurrentTab: observeCandidateIntoCurrentTab,
    handleOpenCandidateAsSeek: openCandidateAsSeek,
    handleTabSelect: selectTab,
    handleCloseTab: closeTab,
    handleRestoreSceneSnapshot: restoreSceneSnapshot,
    handleReorderTabs: reorderTabs,
    handleBacklinkFocus: focusBacklink,
    handleAddSource: ingestSource,
    handleRunScoutPlan,
    handleScoutSourceLinks,
    handleCanvasFrontierDiscovery,
    handleAssistantChunkExpansion,
    handleFocusedLayerGeneration,
    handleCartographerChunkDirectionExpand,
    handleCartographerChunkRefresh,
    handleCartographerTransactionCancel,
    handleConvertScoutObservation: convertScoutObservation,
    handleReplaceFailedSourceCandidate: replaceFailedSourceCandidate,
    handleResetWorkspace: resetWorkspace,
    handleUseSelectionAsSeed,
    handleUseNodeAsSeed,
  } = exploration;

  const [commandValue, setCommandValue] = useState("");
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
  const [chunkAutoDiscoveryOverride, setChunkAutoDiscoveryOverride] = useState<boolean | undefined>();
  const tileAbsorptionRequestCounterRef = useRef(0);
  const [isSelectionActionCardOpen, setIsSelectionActionCardOpen] = useState(false);
  const [tabRuntimeSnapshot, setTabRuntimeSnapshot] = useState<TabRuntimeSnapshot | undefined>();
  const [pendingRuntimeActiveTabId, setPendingRuntimeActiveTabId] = useState<string | undefined>();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settings, setSettings] = useState<SeekStarSettings | undefined>();
  const [storePaths, setStorePaths] = useState<Record<string, string>>({});
  const commandInputRef = useRef<HTMLInputElement>(null);
  const dockHostRef = useRef<HTMLElement | null>(null);
  const activeTabIdRef = useRef(activeTabId);
  const autoLayerTerrainRequestsRef = useRef<Set<string>>(new Set());
  const autoLayerTerrainTimerRef = useRef<number | undefined>(undefined);
  const lastViewportTraceKeyRef = useRef("");
  const runtimeWorkspaceSyncInFlightRef = useRef(false);
  const lastMissingRuntimeSceneKeyRef = useRef("");
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

  useEffect(() => {
    activeTabIdRef.current = activeTabId;
  }, [activeTabId]);

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
      if (runtimeTabId) {
        return;
      }
      if (snapshot.active_tab_id !== activeTabIdRef.current) {
        setPendingRuntimeActiveTabId(snapshot.active_tab_id);
      }
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
    void window.seekstar.workspace.getStorePaths().then(setStorePaths);
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
  const cartographerChunkScheduling = settings?.cartographer_chunk_scheduling ?? createDefaultCartographerChunkSchedulingSettings();
  const chunkAutoDiscoveryEnabled = chunkAutoDiscoveryOverride ?? cartographerChunkScheduling.auto_expand_enabled;
  const commandKind = isDirectHttpUrl(commandValue.trim()) ? "url" : "keyword";
  const openingSkyStatus = resolveOpeningSkyStatus(scene, activeTab, cartographerStatus);
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

  useEffect(() => {
    if (isShellWindow || !workspaceHydrated) {
      return;
    }

    const focusNode = resolveRuntimeFocusNode(scene);

    if (!focusNode) {
      if (isOnDemandCartographerLayer(scene.viewport.layer)) {
        traceTelescopeUi("layer.autogen.skip_no_focus", {
          layer: scene.viewport.layer,
          tab_id: activeTabId,
        });
      }
      return;
    }

    if (!shouldAutoGenerateLayerTerrain(scene, cartographerStatus, focusNode)) {
      return;
    }

    const chunk = createCartographerChunkKeyForViewport(
      scene.viewport,
      cartographerChunkScheduling.chunk_width,
      cartographerChunkScheduling.chunk_height,
    );

    const requestKey = [
      activeTabId,
      scene.viewport.layer,
      focusNode?.id ?? scene.runtime.focused_node_id ?? "viewport",
      chunk.key,
    ].join(":");

    if (autoLayerTerrainRequestsRef.current.has(requestKey)) {
      traceTelescopeUi("layer.autogen.skip_dedupe", {
        chunk,
        focus: summarizeNodeForTrace(focusNode),
        layer: scene.viewport.layer,
        request_key: requestKey,
        tab_id: activeTabId,
      });
      return;
    }

    traceTelescopeUi("layer.autogen.schedule", {
      chunk,
      focus: summarizeNodeForTrace(focusNode),
      layer: scene.viewport.layer,
      request_key: requestKey,
      tab_id: activeTabId,
    });

    if (autoLayerTerrainTimerRef.current !== undefined) {
      window.clearTimeout(autoLayerTerrainTimerRef.current);
    }

    autoLayerTerrainTimerRef.current = window.setTimeout(() => {
      autoLayerTerrainTimerRef.current = undefined;

      if (autoLayerTerrainRequestsRef.current.has(requestKey)) {
        return;
      }

      autoLayerTerrainRequestsRef.current.add(requestKey);
      traceTelescopeUi("layer.autogen.trigger", {
        chunk,
        focus: summarizeNodeForTrace(focusNode),
        layer: scene.viewport.layer,
        request_key: requestKey,
        tab_id: activeTabId,
      });
      void handleFocusedLayerGeneration({
        focusNode,
        scene,
        tabId: activeTabId,
        viewport: scene.viewport,
      }).catch(() => undefined);
    }, 720);

    return () => {
      if (autoLayerTerrainTimerRef.current !== undefined) {
        window.clearTimeout(autoLayerTerrainTimerRef.current);
        autoLayerTerrainTimerRef.current = undefined;
      }
    };
  }, [
    activeTabId,
    cartographerChunkScheduling,
    cartographerStatus,
    handleFocusedLayerGeneration,
    isShellWindow,
    scene,
    workspaceHydrated,
  ]);
  const orderedScenes = useMemo(() => {
    const scenes = Object.values(scenesByTabId);
    const ordered = (tabRuntimeSnapshot?.tabs ?? [])
      .map((tab) => scenesByTabId[tab.id])
      .filter((candidate): candidate is TerrainScene => Boolean(candidate));
    const seenSceneIds = new Set(ordered.map((candidate) => candidate.id));
    const leftovers = scenes.filter((candidate) => !seenSceneIds.has(candidate.id));

    return [...ordered, ...leftovers];
  }, [scenesByTabId, tabRuntimeSnapshot]);

  useEffect(() => {
    if (!isShellWindow || !workspaceHydrated || !tabRuntimeSnapshot) {
      return;
    }

    const missingTabIds = tabRuntimeSnapshot.tabs.map((tab) => tab.id).filter((tabId) => !scenesByTabId[tabId]);

    if (missingTabIds.length === 0) {
      lastMissingRuntimeSceneKeyRef.current = "";
      return;
    }

    const missingKey = `${tabRuntimeSnapshot.active_tab_id}:${tabRuntimeSnapshot.updated_at}:${missingTabIds.join(",")}`;

    if (runtimeWorkspaceSyncInFlightRef.current || lastMissingRuntimeSceneKeyRef.current === missingKey) {
      return;
    }

    runtimeWorkspaceSyncInFlightRef.current = true;
    lastMissingRuntimeSceneKeyRef.current = missingKey;

    void syncWorkspaceFromStore({
      preferredActiveTabId: tabRuntimeSnapshot.active_tab_id,
      registerRuntimeTabs: false,
    }).finally(() => {
      runtimeWorkspaceSyncInFlightRef.current = false;
    });
  }, [isShellWindow, scenesByTabId, syncWorkspaceFromStore, tabRuntimeSnapshot, workspaceHydrated]);

  function handleSceneSelection(nodeIds: string[], focusNodeId?: string, showSelectionActions = false): void {
    applySelection(syncSceneSelection(nodeIds, focusNodeId), showSelectionActions);
  }

  function handleSceneViewport(viewport: TerrainScene["viewport"]): void {
    const nextSelectedNodeIds = syncSceneViewport(viewport, selectedNodeIds);
    const chunk = createCartographerChunkKeyForViewport(
      viewport,
      cartographerChunkScheduling.chunk_width,
      cartographerChunkScheduling.chunk_height,
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
      void handleAddKeywordToCurrentPage();
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

      const result = await ingestDirectUrlIntoCurrentTab(seed);

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

  async function enterDeepLensForNode(nodeId: string): Promise<void> {
    const node = scene.nodes.find((candidate) => candidate.id === nodeId);

    if (!node) {
      return;
    }

    setTileActionNodeId(undefined);

    try {
      const snapshot = await window.seekstar.tiles.captureDeepLens({
        tabId: scene.active_tab_id,
        nodeId,
      });
      applySelection(handleEnterDeepLens(snapshot));
      return;
    } catch {
      const fallback = createFallbackDeepLensSnapshot(scene, node);

      if (fallback) {
        applySelection(handleEnterDeepLens(fallback));
      }
    }
  }

  function handleNodeSelect(nodeId: string): void {
    const node = scene.nodes.find((candidate) => candidate.id === nodeId);

    traceTelescopeUi("node.select", {
      layer: scene.viewport.layer,
      node: summarizeNodeForTrace(node),
      selected_again: selectedNodeIds.length === 1 && selectedNodeIds[0] === nodeId,
      tab_id: activeTabId,
    });

    if (node && isAbsorbableCanvasTile(node)) {
      const isSameFocusedTile = scene.runtime.focused_node_id === nodeId || (selectedNodeIds.length === 1 && selectedNodeIds[0] === nodeId);

      if (isSameFocusedTile) {
        setTileActionNodeId(nodeId);
      } else {
        applySelection(handleTileFocus(nodeId));
        setTileActionNodeId(undefined);
      }
      showRightSidebar();
      return;
    }

    if (node && selectedNodeIds.length === 1 && selectedNodeIds[0] === nodeId && node.zoom_target) {
      traceTelescopeUi("node.zoom_target", {
        node: summarizeNodeForTrace(node),
        target: node.zoom_target,
        tab_id: activeTabId,
      });
      handleLayerSelect(node.zoom_target.layer, node.zoom_target.node_id);
      return;
    }

    const continuousZoomLayer = node && selectedNodeIds.length === 1 && selectedNodeIds[0] === nodeId
      ? resolveContinuousZoomInLayer(node.layer)
      : undefined;

    if (node && continuousZoomLayer) {
      traceTelescopeUi("node.zoom_continuous", {
        focus_node_id: node.id,
        from_layer: node.layer,
        tab_id: activeTabId,
        to_layer: continuousZoomLayer,
      });
      handleLayerSelect(continuousZoomLayer, node.id);
      return;
    }

    if (node && isDeepLensRecursiveSeedNode(node)) {
      void handleUseNodeAsSeedTab(node);
      setTileActionNodeId(undefined);
      showRightSidebar();
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
    handleSceneSelection([nodeId], nodeId);
    showRightSidebar();
  }

  function handleTabSelect(tabId: string): void {
    const result = selectTab(tabId);

    if (!result) {
      return;
    }

    resetCommandAndSearch();
    applySelection(result);
    setIsSelectionActionCardOpen(false);
  }

  useEffect(() => {
    if (!pendingRuntimeActiveTabId) {
      return;
    }

    if (pendingRuntimeActiveTabId === activeTabId) {
      setPendingRuntimeActiveTabId(undefined);
      return;
    }

    if (!scenesByTabId[pendingRuntimeActiveTabId]) {
      return;
    }

    const result = selectTab(pendingRuntimeActiveTabId);

    if (!result) {
      return;
    }

    resetCommandAndSearch();
    applySelection(result);
    setIsSelectionActionCardOpen(false);
    setPendingRuntimeActiveTabId(undefined);
  }, [activeTabId, pendingRuntimeActiveTabId, scenesByTabId, selectTab]);

  async function handleTabClose(tabId: string): Promise<void> {
    const result = await closeTab(tabId);

    if (!result) {
      return;
    }

    resetCommandAndSearch();
    applySelection(result);
    setIsSelectionActionCardOpen(false);
  }

  async function handleTabRefresh(tabId: string): Promise<void> {
    const snapshot = await window.seekstar.tabs.refresh(tabId);
    setTabRuntimeSnapshot(snapshot);
  }

  async function handleTabPin(tabId: string): Promise<void> {
    setTabRuntimeSnapshot(await window.seekstar.tabs.togglePin(tabId));
  }

  async function handleTabFavorite(tabId: string): Promise<void> {
    setTabRuntimeSnapshot(await window.seekstar.tabs.toggleFavorite(tabId));
  }

  async function handleTabCopyCrashLog(tabId: string): Promise<void> {
    await window.seekstar.tabs.copyCrashLog(tabId);
  }

  async function handleTabFolderAssign(tabId: string, folderId?: string): Promise<void> {
    setTabRuntimeSnapshot(await window.seekstar.tabs.assignFolder(tabId, folderId));
  }

  async function handleTabDetach(tabId: string): Promise<void> {
    setTabRuntimeSnapshot(await window.seekstar.tabs.detach(tabId));
  }

  async function handleTabReorder(sourceTabId: string, targetTabId: string): Promise<void> {
    await reorderTabs(sourceTabId, targetTabId);
    setTabRuntimeSnapshot(await window.seekstar.tabs.list());
  }

  async function handleSettingsSave(nextSettings: SeekStarSettings): Promise<void> {
    setSettings(await window.seekstar.settings.save(nextSettings));
  }

  async function handleSettingsApplyDomainLexicon(nextSettings: SeekStarSettings): Promise<void> {
    const savedSettings = await window.seekstar.settings.save(nextSettings);
    const result = applyDomainLexiconToDefaultSeek(savedSettings.domain_lexicons, savedSettings.active_domain_lexicon_id);

    setSettings(savedSettings);
    resetCommandAndSearch();
    applySelection(result);
    setIsSelectionActionCardOpen(false);
    showRightSidebar();
    setTabRuntimeSnapshot(await window.seekstar.tabs.list());
  }

  async function handleFolderCreate(): Promise<void> {
    const title = window.prompt("Folder name");

    if (!title?.trim()) {
      return;
    }

    setTabRuntimeSnapshot(await window.seekstar.tabs.createFolder(title.trim()));
  }

  async function handleFolderDelete(folderId: string): Promise<void> {
    setTabRuntimeSnapshot(await window.seekstar.tabs.deleteFolder(folderId));
  }

  async function handleWorkspaceRename(): Promise<void> {
    const title = window.prompt("Workspace name", tabRuntimeSnapshot?.workspace_name ?? "SeekStar local workspace");

    if (!title?.trim()) {
      return;
    }

    setTabRuntimeSnapshot(await window.seekstar.tabs.renameWorkspace(title.trim()));
  }

  function handleBacklinkFocus(backlink: NonNullable<ExplorationTab["parent_backlink"]>): void {
    const result = focusBacklink(backlink);

    if (!result) {
      return;
    }

    resetCommandAndSearch();
    applySelection(result);
    setIsSelectionActionCardOpen(false);
    showRightSidebar();
  }

  function handleFocusCommand(): void {
    commandInputRef.current?.focus();
    setIsCommandModalOpen(commandValue.trim().length > 0);
  }

  function handleClearSelection(): void {
    handleSceneSelection([]);
    setSearchQuery("");
    setSearchResults([]);
    setIsSelectionActionCardOpen(false);
  }

  function resetCommandAndSearch(): void {
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

  function handleAddSource(input: SourceIngestionInput): void {
    const result = ingestSource(input);
    applySelection(result);
    setSearchQuery("");
    setSearchResults([]);
    setIsSelectionActionCardOpen(false);
    showRightSidebar();
  }

  async function handleRunScoutPlanWithUi(
    plan: ScoutPlan,
    placement?: import("./exploration/types").ScoutObservationPlacement,
  ): Promise<void> {
    const observation = await handleRunScoutPlan(plan, placement);

    if (observation) {
      setSelectedObservationId(observation.id);
      resetSelection();
    }

    showRightSidebar();
  }

  async function handleScoutSourceLinksWithUi(node: TerrainNode, source: SourceRef): Promise<void> {
    await handleScoutSourceLinks(node, source);
    showRightSidebar();
  }

  function handleConvertScoutObservation(observation: ScoutObservation): void {
    const result = convertScoutObservation(observation, activeTabId);

    if (!result) {
      return;
    }

    applySelection(result);
    setSearchQuery("");
    setSearchResults([]);
    setIsSelectionActionCardOpen(false);
    showRightSidebar();
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

  async function handleOpenCandidateAsSeek(observation: ScoutObservation): Promise<void> {
    const result = await openCandidateAsSeek(observation.id);

    if (!result) {
      return;
    }

    resetCommandAndSearch();
    resetSelection();
    applySelection(result);
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
        const rollbackChunkScene = structuredClone(scene);
        const layer = resolveAssistantActionLayer(action, scene.viewport.layer);
        const viewport = createAssistantChunkViewport(scene.viewport, layer, action, cartographerChunkScheduling);
        const result = await handleAssistantChunkExpansion(viewport, cartographerChunkScheduling);

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
          message: "Moved to the requested chunk and applied Cartographer terrain.",
          undo: {
            context: createSceneDiffUndoContext(activeTab.id, rollbackChunkScene, result.scene),
            message: "Restore the map before assistant chunk expansion.",
          },
        };
      }

      case "observe_source": {
        const rollbackSourceScene = structuredClone(scene);
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
            undo: {
              context: createSceneDiffUndoContext(activeTab.id, rollbackSourceScene, result.scene ?? rollbackSourceScene),
              message: "Restore the map before source observation.",
            },
          };
        }

        const url = getAssistantActionUrl(action);

        if (url && isDirectHttpUrl(url)) {
          const result = await ingestDirectUrlIntoCurrentTab(url);

          if (result) {
            applySelection(result);
            setSelectedObservationId(undefined);
            showRightSidebar();
            return {
              message: "Observed the direct URL in this Seek.",
              undo: {
                context: createSceneDiffUndoContext(activeTab.id, rollbackSourceScene, result.scene ?? rollbackSourceScene),
                message: "Restore the map before source observation.",
              },
            };
          }
        }

        throw new Error("Assistant action did not include an observable source candidate or URL.");
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
    if (context.kind === "restore_scene_diff") {
      const currentScene = scenesByTabId[context.tab_id];

      if (!currentScene) {
        throw new Error("Undo target scene is no longer available.");
      }

      const result = await restoreSceneSnapshot(context.tab_id, applySceneRollbackPatch(currentScene, context.patch));

      if (!result) {
        throw new Error("Scene diff could not be restored.");
      }

      resetCommandAndSearch();
      applySelection(result);
      setSelectedNodeIds(result.selectedNodeIds);
      setSelectedRelationId(undefined);
      setSelectedObservationId(undefined);
      setViewportFocusNodeId(result.focusNodeId ?? result.selectedNodeIds[0]);
      setIsSelectionActionCardOpen(false);
      showRightSidebar();

      return "Restored map before assistant operation.";
    }

    if (context.kind === "restore_scene_snapshot") {
      const result = await restoreSceneSnapshot(context.tab_id, context.scene_snapshot);

      if (!result) {
        throw new Error("Scene snapshot could not be restored.");
      }

      resetCommandAndSearch();
      applySelection(result);
      setSelectedNodeIds(result.selectedNodeIds);
      setSelectedRelationId(undefined);
      setSelectedObservationId(undefined);
      setViewportFocusNodeId(result.focusNodeId ?? result.selectedNodeIds[0]);
      setIsSelectionActionCardOpen(false);
      showRightSidebar();

      return "Restored map before assistant operation.";
    }

    if (context.kind === "close_created_tab") {
      if (!scenesByTabId[context.created_tab_id]) {
        throw new Error("Created seed tab is no longer available.");
      }

      const result = await closeTab(context.created_tab_id);

      if (!result) {
        throw new Error("Created seed tab could not be closed.");
      }

      resetCommandAndSearch();
      applySelection(result);
      const originSelection = scenesByTabId[context.origin_tab_id] ? selectTab(context.origin_tab_id) : undefined;

      if (originSelection) {
        applySelection(originSelection);
      }

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

  async function handleResetWorkspace(): Promise<void> {
    const result = await resetWorkspace();

    resetCommandAndSearch();
    applySelection(result);
    setSelectedRelationId(undefined);
    setSelectedObservationId(undefined);
    setIsSelectionActionCardOpen(false);
    showRightSidebar();
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
          onApplyDomainLexicon={handleSettingsApplyDomainLexicon}
          onSave={handleSettingsSave}
        />
      ) : (
        <div className={isDetachedTabWindow || isDockedTabView ? "desktop-shell detached-tab-desktop" : "desktop-shell"}>
        {isShellWindow ? (
          <SidebarRail mode={leftSidebarCollapsed ? "collapsed" : "expanded"} label="Observatory" side="left">
            <ObservatorySidebar
              activeTabId={activeTabId}
              activeTool={activeCanvasTool}
              onFocusCommand={handleFocusCommand}
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
              scenes={orderedScenes}
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
                chunkBoundaryControls={{
                  autoDiscoveryEnabled: chunkAutoDiscoveryEnabled,
                  autoPreloadRing: cartographerChunkScheduling.auto_preload_ring,
                  chunkHeight: cartographerChunkScheduling.chunk_height,
                  chunkWidth: cartographerChunkScheduling.chunk_width,
                  manualPreloadRange: cartographerChunkScheduling.manual_preload_range,
                  onDirectionExpand: (direction) => handleCartographerChunkDirectionExpand(direction, scene.viewport, cartographerChunkScheduling),
                  onCancelCurrent: handleCartographerTransactionCancel,
                  onRefreshCurrent: () => handleCartographerChunkRefresh(scene.viewport, cartographerChunkScheduling),
                  onToggleAutoDiscovery: (enabled) => setChunkAutoDiscoveryOverride(enabled),
                }}
                cartographerChunkRecords={cartographerChunkRecords}
                cartographerStatus={cartographerStatus}
                focusedNodeId={scene.runtime.focused_node_id ?? viewportFocusNodeId}
                highlightedNodeIds={highlightedNodeIds}
                onBrowserModeExit={() => {
                  applySelection(handleTileAbsorptionExit());
                }}
                onCurrentPageDeepLens={(nodeId) => {
                  void enterDeepLensForNode(nodeId);
                }}
                onFrontierDiscovery={(viewport) => {
                  if (!chunkAutoDiscoveryEnabled) {
                    return;
                  }
                  handleCanvasFrontierDiscovery(viewport, cartographerChunkScheduling);
                  setRightSidebarMode("compact");
                }}
                onNodeSelect={handleNodeSelect}
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
                  <span>Workspace snapshot unavailable</span>
                  <strong>Trail is protected from overwrite</strong>
                  <p>{workspaceLoadError}</p>
                  <button
                    onClick={() => {
                      void syncWorkspaceFromStore({
                        protectLocalNavigation: false,
                        registerRuntimeTabs: true,
                        suppressAutosave: true,
                      });
                    }}
                    type="button"
                  >
                    Retry load
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
                  onEnterDeepLens={() => {
                    void enterDeepLensForNode(tileActionNodeId);
                  }}
                />
              ) : null}
            </div>
          </div>
          <CommandComposer
            commandKind={commandKind}
            commandInputRef={commandInputRef}
            commandValue={commandValue}
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
            onAddSource={handleAddSource}
            onAssistantAction={handleAssistantAction}
            onAssistantUndo={handleAssistantUndo}
            onClearBasket={handleClearBasket}
            onClearSelection={handleClearSelection}
            onConvertScoutObservation={handleConvertScoutObservation}
            onModeChange={setRightSidebarMode}
            onObserveCandidate={handleObserveCandidateSource}
            onOpenCandidateAsSeek={handleOpenCandidateAsSeek}
            onReplaceFailedSource={handleReplaceFailedSourceCandidate}
            onRemoveBasketItem={handleRemoveBasketItem}
            onRunScoutPlan={handleRunScoutPlanWithUi}
            onScoutSourceLinks={handleScoutSourceLinksWithUi}
            onLayerSelect={handleLayerSelect}
            onSaveSelectionToTray={handleSaveSelectionToTray}
            onBacklinkFocus={handleBacklinkFocus}
            onResetWorkspace={handleResetWorkspace}
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

function isDeepLensRecursiveSeedNode(node: TerrainNode): boolean {
  return Boolean(
    node.can_create_seed &&
      node.tags?.includes("deep-lens") &&
      (node.type === "section" || node.type === "paragraph" || node.type === "phrase" || node.type === "word"),
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
  cartographerStatus: CartographerRuntimeStatus,
): OpeningSkyStatusModel | undefined {
  const hasTerrain = scene.nodes.some((node) => node.source_state === "cartographer_primary" || node.source_state === "source_backed" || node.tags?.includes("cartographer"));

  if (
    activeTab.source_mode !== "opening_sky" ||
    scene.viewport.layer !== "L0" ||
    scene.sources.length > 0 ||
    hasTerrain ||
    isDirectHttpUrl(activeTab.seed)
  ) {
    return undefined;
  }

  if (cartographerStatus.phase === "error") {
    return {
      body: cartographerStatus.message || "Cartographer did not return usable terrain for the opening sky.",
      title: "AI opening sky failed",
      tone: "error",
    };
  }

  if (cartographerStatus.phase === "generating") {
    return {
      body: cartographerStatus.message || "SeekStar is asking the Cartographer for fresh fields, unknown edges, and source directions.",
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

function shouldAutoGenerateLayerTerrain(
  scene: TerrainScene,
  cartographerStatus: CartographerRuntimeStatus,
  focusNode: TerrainNode,
): boolean {
  const layer = scene.viewport.layer;

  if (!isOnDemandCartographerLayer(layer)) {
    return false;
  }

  if (cartographerStatus.phase === "generating") {
    return false;
  }

  if (scene.nodes.some((node) => node.layer === layer && isGeneratedTerrainNodeForLayer(node, layer) && isNodeScopedToFocus(node, focusNode))) {
    return false;
  }

  return !(scene.scout_observations ?? []).some(
    (observation) => observation.layer === layer && isActiveLayerObservation(observation) && isObservationScopedToFocus(observation, focusNode),
  );
}

function isOnDemandCartographerLayer(layer: LayerId): boolean {
  return layer === "L1" || layer === "L2" || layer === "L3";
}

function isGeneratedTerrainNode(node: TerrainNode): boolean {
  return (
    node.source_state === "cartographer_primary" ||
    node.source_state === "source_backed" ||
    node.tags?.includes("cartographer") === true
  );
}

function isGeneratedTerrainNodeForLayer(node: TerrainNode, layer: LayerId): boolean {
  if (layer === "L3") {
    return node.source_state === "source_backed" && Boolean(node.source_url);
  }

  return isGeneratedTerrainNode(node);
}

function isNodeScopedToFocus(node: TerrainNode, focusNode: TerrainNode): boolean {
  return node.created_from?.node_id === focusNode.id;
}

function isObservationScopedToFocus(observation: ScoutObservation, focusNode: TerrainNode): boolean {
  return observation.target_node_ids?.includes(focusNode.id) === true;
}

function isActiveLayerObservation(observation: ScoutObservation): boolean {
  return (
    observation.status === "pending" ||
    observation.status === "source_candidate" ||
    observation.status === "observed" ||
    observation.status === "converted"
  );
}

function resolveRuntimeFocusNode(scene: TerrainScene): TerrainNode | undefined {
  const focusNodeId = scene.runtime.focused_node_id ?? scene.selection.node_ids[0];
  const explicitFocusNode = focusNodeId ? scene.nodes.find((node) => node.id === focusNodeId) : undefined;
  const parentLayer = resolveFocusAnchorLayer(scene.viewport.layer);

  if (explicitFocusNode && (explicitFocusNode.layer === parentLayer || explicitFocusNode.layer === scene.viewport.layer)) {
    return explicitFocusNode;
  }

  return (
    findNearestGeneratedNode(scene.nodes, scene.viewport, parentLayer) ??
    findNearestGeneratedNode(scene.nodes, scene.viewport, scene.viewport.layer)
  );
}

function resolveFocusAnchorLayer(layer: LayerId): LayerId | undefined {
  if (layer === "L0") {
    return "supra_macro";
  }

  if (layer === "L1") {
    return "L0";
  }

  if (layer === "L2") {
    return "L1";
  }

  if (layer === "L3") {
    return "L2";
  }

  return undefined;
}

function findNearestGeneratedNode(
  nodes: TerrainNode[],
  viewport: TerrainScene["viewport"],
  layer: LayerId | undefined,
): TerrainNode | undefined {
  if (!layer) {
    return undefined;
  }

  return nodes
    .filter((node) => node.layer === layer && isGeneratedTerrainNode(node))
    .sort((left, right) => getNodeViewportDistance(left, viewport) - getNodeViewportDistance(right, viewport))[0];
}

function getNodeViewportDistance(node: TerrainNode, viewport: TerrainScene["viewport"]): number {
  const x = node.position_hint?.x ?? 0;
  const y = node.position_hint?.y ?? 0;
  return Math.hypot(x - viewport.x, y - viewport.y);
}

function areNodeIdArraysEqual(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every((nodeId, index) => nodeId === right[index]);
}

function resolveContinuousZoomInLayer(layer: LayerId): LayerId | undefined {
  if (layer === "supra_macro") {
    return "L0";
  }

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

function traceTelescopeUi(event: string, payload?: unknown): void {
  try {
    if (window.localStorage.getItem("seekstar.trace") === "0") {
      return;
    }

    if (!import.meta.env.DEV && window.localStorage.getItem("seekstar.trace") !== "1") {
      return;
    }
  } catch {
    if (!import.meta.env.DEV) {
      return;
    }
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

function createFallbackDeepLensSnapshot(scene: TerrainScene, node: TerrainNode): DeepLensSnapshot | undefined {
  const source = node.source_id ? scene.sources.find((candidate) => candidate.id === node.source_id) : undefined;
  const text = source?.source_snapshot?.visible_text || node.quote || node.summary || source?.snippet || "";

  if (!text.trim()) {
    return undefined;
  }

  return {
    node_id: node.id,
    source_id: node.source_id,
    source_url: node.source_url ?? source?.url,
    title: source?.source_snapshot?.title || source?.title || node.title,
    captured_at: new Date().toISOString(),
    text,
    grains: [],
  };
}

function TileActionChooser({
  node,
  onDismiss,
  onEnterBrowser,
  onEnterDeepLens,
}: {
  node?: TerrainNode;
  onDismiss: () => void;
  onEnterBrowser: () => void;
  onEnterDeepLens: () => void;
}): ReactElement | null {
  if (!node) {
    return null;
  }

  return (
    <aside className="tile-action-chooser" aria-label="Tile actions">
      <button className="tile-action-chooser-backdrop" aria-label="Dismiss tile actions" onClick={onDismiss} type="button" />
      <div className="tile-action-chooser-panel">
        <span>L3 Tile Field</span>
        <strong>{node.title}</strong>
        <div>
          <button onClick={onEnterDeepLens} type="button">
            Open Deep Lens
          </button>
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

function createSceneDiffUndoContext(tabId: string, beforeScene: TerrainScene, afterScene: TerrainScene): AssistantOperationUndoContext {
  return {
    kind: "restore_scene_diff",
    patch: createSceneRollbackPatch(beforeScene, afterScene),
    tab_id: tabId,
  };
}

function createSceneRollbackPatch(beforeScene: TerrainScene, afterScene: TerrainScene): AssistantSceneRollbackPatch {
  return {
    collections: {
      agent_jobs: createCollectionRollback(beforeScene.agent_jobs, afterScene.agent_jobs),
      cartographer_outputs: createCollectionRollback(beforeScene.cartographer_outputs, afterScene.cartographer_outputs),
      nodes: createCollectionRollback(beforeScene.nodes, afterScene.nodes),
      relations: createCollectionRollback(beforeScene.relations, afterScene.relations),
      scout_observations: createCollectionRollback(beforeScene.scout_observations ?? [], afterScene.scout_observations ?? []),
      sources: createCollectionRollback(beforeScene.sources, afterScene.sources),
    },
    scene_fields: {
      active_tab_id: beforeScene.active_tab_id,
      id: beforeScene.id,
      layers: structuredClone(beforeScene.layers),
      metadata: structuredClone(beforeScene.metadata),
      runtime: structuredClone(beforeScene.runtime),
      selection: structuredClone(beforeScene.selection),
      tabs: structuredClone(beforeScene.tabs),
      viewport: structuredClone(beforeScene.viewport),
    },
  };
}

function createCollectionRollback<TItem extends { id: string }>(
  beforeItems: readonly TItem[],
  afterItems: readonly TItem[],
): { added_ids: string[]; order: string[]; restored_items: TItem[] } {
  const beforeIds = new Set(beforeItems.map((item) => item.id));
  const afterById = new Map(afterItems.map((item) => [item.id, item]));

  return {
    added_ids: afterItems.filter((item) => !beforeIds.has(item.id)).map((item) => item.id),
    order: beforeItems.map((item) => item.id),
    restored_items: beforeItems
      .filter((item) => JSON.stringify(afterById.get(item.id)) !== JSON.stringify(item))
      .map((item) => structuredClone(item)),
  };
}

function applySceneRollbackPatch(scene: TerrainScene, patch: AssistantSceneRollbackPatch): TerrainScene {
  return {
    ...scene,
    ...structuredClone(patch.scene_fields),
    agent_jobs: applyCollectionRollback(scene.agent_jobs, patch.collections.agent_jobs),
    cartographer_outputs: applyCollectionRollback(scene.cartographer_outputs, patch.collections.cartographer_outputs),
    nodes: applyCollectionRollback(scene.nodes, patch.collections.nodes),
    relations: applyCollectionRollback(scene.relations, patch.collections.relations),
    scout_observations: applyCollectionRollback(scene.scout_observations ?? [], patch.collections.scout_observations),
    sources: applyCollectionRollback(scene.sources, patch.collections.sources),
  };
}

function applyCollectionRollback<TItem extends { id: string }>(
  currentItems: readonly TItem[],
  rollback: { added_ids: string[]; order: string[]; restored_items: TItem[] },
): TItem[] {
  const nextById = new Map(currentItems.map((item) => [item.id, structuredClone(item)]));

  for (const id of rollback.added_ids) {
    nextById.delete(id);
  }

  for (const item of rollback.restored_items) {
    nextById.set(item.id, structuredClone(item));
  }

  const ordered: TItem[] = [];

  for (const id of rollback.order) {
    const item = nextById.get(id);

    if (item) {
      ordered.push(item);
      nextById.delete(id);
    }
  }

  return [...ordered, ...nextById.values()];
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

function createDefaultCartographerChunkSchedulingSettings(): CartographerChunkSchedulingPolicy {
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
  scheduling: CartographerChunkSchedulingPolicy = createDefaultCartographerChunkSchedulingSettings(),
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
