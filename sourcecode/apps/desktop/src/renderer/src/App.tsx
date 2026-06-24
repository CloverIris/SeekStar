import type { ExplorationTab, LayerId, ScoutObservation, ScoutPlan, SourceRef, TerrainNode, TerrainScene } from "@seekstar/core-schema";
import type { CanvasTool, SourceIngestionInput } from "@seekstar/constellation-engine";
import type { SeekStarSettings } from "../../main/appSettingsStore";
import type { TabRuntimeSnapshot } from "../../main/tabRuntimeManager";
import type { ChangeEvent, KeyboardEvent, ReactElement } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { DetachedTabTitleBar, ShellDockWorkbench, SidebarRail, WindowTitleBar } from "./components/AppChrome";
import { ObservatorySidebar } from "./components/ObservatorySidebar";
import { TerrainCanvas } from "./components/TerrainCanvas";
import { CommandComposer, SelectionActionCard, StatusStrip, WorkbenchHeader } from "./components/WorkbenchChrome";
import { InspectorSidebar } from "./components/inspector/InspectorSidebar";
import { SettingsPage } from "./components/settings/SettingsPage";
import {
  getActiveLayer,
  getActiveLayerLabel,
  getActiveTab,
  getAgentJobState,
  getRelationNodes,
  getSourceForNode,
} from "./exploration/types";
import { useExplorationSession } from "./exploration/useExplorationSession";
import { type SearchResult, searchScene } from "./search/localSceneSearch";
import { type SelectionBasketItem, createSelectionBasketItem } from "./selection/selectionBasket";

export function App(): ReactElement {
  const runtimeParams = useMemo(() => new URLSearchParams(window.location.search), []);
  const runtimeTabId = runtimeParams.get("runtimeTabId") ?? undefined;
  const runtimeSurface = runtimeParams.get("runtimeSurface");
  const isDockedTabView = Boolean(runtimeTabId && runtimeSurface === "docked");
  const isDetachedTabWindow = Boolean(runtimeTabId && !isDockedTabView);
  const isShellWindow = !runtimeTabId;
  const exploration = useExplorationSession({ runtimeTabId });
  const {
    scene,
    activeTabId,
    scenesByTabId,
    basketByTabId,
    setBasketByTabId,
    persistenceStatus,
    workspaceHydrated,
    hydratedSelection,
    syncWorkspaceFromStore,
    syncSceneSelection,
    syncSceneViewport,
    handleLayerSelect: selectLayer,
    handleExploreInCurrentTab: exploreInCurrentTab,
    handleApplyDomainLexiconToDefaultSeek: applyDomainLexiconToDefaultSeek,
    handleUseAsSeed: createSeedTab,
    handleTabSelect: selectTab,
    handleCloseTab: closeTab,
    handleReorderTabs: reorderTabs,
    handleBacklinkFocus: focusBacklink,
    handleAddSource: ingestSource,
    handleRunScoutPlan,
    handleScoutSourceLinks,
    handleCanvasFrontierDiscovery,
    handleConvertScoutObservation: convertScoutObservation,
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
  const [rightSidebarCollapsed, setRightSidebarCollapsed] = useState(false);
  const [splashVisible, setSplashVisible] = useState(true);
  const [splashFading, setSplashFading] = useState(false);
  const [activeCanvasTool, setActiveCanvasTool] = useState<CanvasTool>("pointer");
  const [isSelectionActionCardOpen, setIsSelectionActionCardOpen] = useState(false);
  const [tabRuntimeSnapshot, setTabRuntimeSnapshot] = useState<TabRuntimeSnapshot | undefined>();
  const [pendingRuntimeActiveTabId, setPendingRuntimeActiveTabId] = useState<string | undefined>();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settings, setSettings] = useState<SeekStarSettings | undefined>();
  const [storePaths, setStorePaths] = useState<Record<string, string>>({});
  const commandInputRef = useRef<HTMLInputElement>(null);
  const dockHostRef = useRef<HTMLElement | null>(null);
  const activeTabIdRef = useRef(activeTabId);
  const runtimeWorkspaceSyncInFlightRef = useRef(false);
  const lastMissingRuntimeSceneKeyRef = useRef("");

  useEffect(() => {
    activeTabIdRef.current = activeTabId;
  }, [activeTabId]);

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
  }, [isShellWindow, leftSidebarCollapsed, settingsOpen, tabRuntimeSnapshot?.active_tab_id]);

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

  useEffect(() => {
    if (!workspaceHydrated || !hydratedSelection) {
      return;
    }

    setSelectedNodeIds(hydratedSelection.selectedNodeIds);
    setViewportFocusNodeId(hydratedSelection.focusNodeId);
  }, [hydratedSelection, workspaceHydrated]);

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
  const activeLayer = getActiveLayer(scene);
  const activeLayerLabel = getActiveLayerLabel(scene);
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
  const visibleNodeCount = scene.nodes.filter((node) => node.layer === scene.viewport.layer).length || scene.nodes.length;
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

    if (nextSelectedNodeIds.length !== selectedNodeIds.length) {
      setSelectedNodeIds(nextSelectedNodeIds);
      setSelectedRelationId(undefined);
      setSelectedObservationId(undefined);
      setViewportFocusNodeId(nextSelectedNodeIds[0]);
      setIsSelectionActionCardOpen(false);
    }
  }

  function handleLayerSelect(layer: LayerId, focusNodeId?: string): void {
    applySelection(selectLayer(layer, focusNodeId));
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
      handleAddKeywordToCurrentPage();
    }
  }

  function handleAddKeywordToCurrentPage(): void {
    const seed = commandValue.trim();

    if (!seed) {
      return;
    }

    const result = exploreInCurrentTab(seed);

    resetCommandAndSearch();
    resetSelection();

    if (result) {
      applySelection(result);
    }
    setRightSidebarCollapsed(false);
  }

  function handleUseAsSeed(): void {
    const seed = commandValue.trim();

    if (!seed) {
      return;
    }

    createSeedTab(seed);
    resetCommandAndSearch();
    resetSelection();
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
    setRightSidebarCollapsed(false);
  }

  function handleNodeSelect(nodeId: string): void {
    const node = scene.nodes.find((candidate) => candidate.id === nodeId);

    if (node && selectedNodeIds.length === 1 && selectedNodeIds[0] === nodeId && node.zoom_target) {
      handleLayerSelect(node.zoom_target.layer, node.zoom_target.node_id);
      return;
    }

    handleSceneSelection([nodeId], nodeId);
    setRightSidebarCollapsed(false);
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
    setRightSidebarCollapsed(false);
  }

  function handleSearchResultSelect(nodeId: string): void {
    handleSceneSelection([nodeId], nodeId);
    setRightSidebarCollapsed(false);
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
    setRightSidebarCollapsed(false);
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
    setRightSidebarCollapsed(false);
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

  function handleUseSelectionAsSeedTab(): void {
    handleUseSelectionAsSeed(selectedNodes);
    resetCommandAndSearch();
    resetSelection();
  }

  function handleUseNodeAsSeedTab(node: TerrainNode): void {
    handleUseNodeAsSeed(node, getSourceForNode(scene, node));
    resetCommandAndSearch();
    resetSelection();
  }

  function handleAddSource(input: SourceIngestionInput): void {
    const result = ingestSource(input);
    applySelection(result);
    setSearchQuery("");
    setSearchResults([]);
    setIsSelectionActionCardOpen(false);
    setRightSidebarCollapsed(false);
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

    setRightSidebarCollapsed(false);
  }

  async function handleScoutSourceLinksWithUi(node: TerrainNode, source: SourceRef): Promise<void> {
    await handleScoutSourceLinks(node, source);
    setRightSidebarCollapsed(false);
  }

  function handleScoutObservationSelect(observationId: string): void {
    setSelectedObservationId(observationId);
    setSelectedNodeIds([]);
    setSelectedRelationId(undefined);
    setViewportFocusNodeId(undefined);
    setIsSelectionActionCardOpen(false);
    setRightSidebarCollapsed(false);
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
    setRightSidebarCollapsed(false);
  }

  async function handleResetWorkspace(): Promise<void> {
    const result = await resetWorkspace();

    resetCommandAndSearch();
    applySelection(result);
    setSelectedRelationId(undefined);
    setSelectedObservationId(undefined);
    setIsSelectionActionCardOpen(false);
    setRightSidebarCollapsed(false);
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
          onToggleRightSidebar={() => setRightSidebarCollapsed((current) => !current)}
          rightSidebarExpanded={!rightSidebarCollapsed}
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
          <SidebarRail collapsed={leftSidebarCollapsed} label="Observatory" side="left">
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
              onToolSelect={setActiveCanvasTool}
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
              breadcrumb={activeLayer?.breadcrumb ?? [activeTab.seed, activeLayerLabel]}
              jobState={jobState}
              layer={scene.viewport.layer}
              layerLabel={activeLayerLabel}
              layers={scene.layers}
              onLayerSelect={handleLayerSelect}
              onToggleRightSidebar={() => setRightSidebarCollapsed((current) => !current)}
              rightSidebarExpanded={!rightSidebarCollapsed}
            />
            <div className="workbench-canvas-wrap">
              <TerrainCanvas
                activeTool={activeCanvasTool}
                focusedNodeId={viewportFocusNodeId}
                highlightedNodeIds={highlightedNodeIds}
                onFrontierDiscovery={(viewport) => {
                  handleCanvasFrontierDiscovery(viewport);
                  setRightSidebarCollapsed(false);
                }}
                onNodeSelect={handleNodeSelect}
                onObservationSelect={handleScoutObservationSelect}
                onRelationSelect={handleRelationSelect}
                onSelectionChange={handleSceneSelection}
                onViewportChange={handleSceneViewport}
                scene={scene}
                selectedNodeIds={selectedNodeIds}
                selectedObservationId={selectedObservationId}
                selectedRelationId={selectedRelationId}
                viewport={scene.viewport}
              />
              {selectedNodeIds.length === 0 ? (
                <div className="workbench-prompt" aria-hidden="true">
                  <h1>What should we explore in {activeTab.title}?</h1>
                </div>
              ) : null}
              {isSelectionActionCardOpen && selectedNodes.length > 0 ? (
                <SelectionActionCard
                  nodeCount={selectedNodes.length}
                  onDismiss={() => setIsSelectionActionCardOpen(false)}
                  onSaveSelection={handleSaveSelectionToTray}
                  onUseAsSeed={handleUseSelectionAsSeedTab}
                />
              ) : null}
            </div>
          </div>
          <CommandComposer
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

        {!isShellWindow ? (
        <SidebarRail collapsed={rightSidebarCollapsed} label="Inspector" side="right">
          <InspectorSidebar
            activeTab={activeTab}
            basketItems={activeBasketItems}
            onAddSource={handleAddSource}
            onClearBasket={handleClearBasket}
            onClearSelection={handleClearSelection}
            onConvertScoutObservation={handleConvertScoutObservation}
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
