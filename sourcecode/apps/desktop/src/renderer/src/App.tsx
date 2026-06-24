import type {
  AgentJobStatus,
  CartographerOutput,
  ExplorationTab,
  LayerId,
  ScoutObservation,
  ScoutPlan,
  SourceState,
  SourceRef,
  TabRecord,
  TerrainNode,
  TerrainRelation,
  TerrainScene,
  WorkspaceFolder,
} from "@seekstar/core-schema";
import {
  DEFAULT_DOMAIN_LEXICON_ID,
  DEFAULT_DOMAIN_LEXICONS,
  cloneDomainLexicons,
  type CanvasTool,
  type DomainLexicon,
  type DomainLexiconTerm,
  type SourceIngestionInput,
} from "@seekstar/constellation-engine";
import type { SeekStarSettings } from "../../main/appSettingsStore";
import type { TabRuntimeSnapshot } from "../../main/tabRuntimeManager";
import type { ChangeEvent, DragEvent, FormEvent, KeyboardEvent, ReactElement, RefObject } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Brush,
  Circle,
  Compass,
  Copy,
  ExternalLink,
  Folder,
  FolderPlus,
  Hand,
  Lasso,
  MousePointer2,
  PanelLeftOpen,
  Pin,
  Plus,
  RefreshCw,
  Search,
  Settings,
  Sparkles,
  Star,
  Trash2,
  X,
  type LucideIcon,
} from "lucide-react";
import { CommandActionCard } from "./components/CommandActionCard";
import { SearchResultsPanel } from "./components/SearchResultsPanel";
import { SidebarToggleButton } from "./components/SidebarToggleButton";
import { TitleBarMenus, type AppMenuId } from "./components/TitleBarMenus";
import { TerrainCanvas } from "./components/TerrainCanvas";
import {
  formatPersistenceStatus,
  formatSourceState,
  formatTimestamp,
  getActiveLayer,
  getActiveLayerLabel,
  getActiveTab,
  getAgentJobState,
  getJobStatusCounts,
  getRelationNodes,
  getSourceForNode,
  getSourceRelationsForNode,
  getSourceStateCounts,
  type PersistenceStatus,
} from "./exploration/types";
import { useExplorationSession } from "./exploration/useExplorationSession";
import { goBack, goForward } from "./platform/windowApi";
import { type SearchResult, searchScene } from "./search/localSceneSearch";
import { type SelectionBasketItem, createSelectionBasketItem } from "./selection/selectionBasket";

const favoriteSeeds = ["Cognitive maps", "Source trails", "Domain gallery"];
const canvasTools: Array<{ id: CanvasTool; label: string; icon: LucideIcon; disabled?: boolean }> = [
  { id: "pointer", label: "Pointer", icon: MousePointer2 },
  { id: "pan", label: "Pan", icon: Hand },
  { id: "lasso", label: "Lasso", icon: Lasso },
  { id: "brush", label: "Brush", icon: Brush, disabled: true },
];

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

function ShellDockWorkbench({
  activeRuntimeTab,
  dockHostRef,
}: {
  activeRuntimeTab?: TabRecord;
  dockHostRef: RefObject<HTMLElement | null>;
}): ReactElement {
  return (
    <section className="main-workbench shell-dock-workbench" aria-label="Docked telescope tab host">
      <div className="shell-dock-toolbar">
        <div>
          <span>Active telescope tab</span>
          <strong>{activeRuntimeTab?.title ?? "Loading tab runtime"}</strong>
        </div>
      </div>
      <section className="tab-dock-host" ref={dockHostRef}>
        <div className="tab-dock-placeholder" aria-hidden="true">
          <strong>{activeRuntimeTab?.runtime_status === "crashed" ? "Tab crashed" : "Docking telescope runtime"}</strong>
          <span>
            {activeRuntimeTab?.runtime_status === "crashed"
              ? "Use the tab row actions to copy the crash log or refresh the tab."
              : "The active tab is hosted in its own Electron WebContentsView."}
          </span>
        </div>
      </section>
    </section>
  );
}

function SidebarRail({
  children,
  collapsed,
  label,
  side,
}: {
  children: ReactElement;
  collapsed: boolean;
  label: string;
  side: "left" | "right";
}): ReactElement {
  const railClass = collapsed ? `sidebar-rail sidebar-rail-${side} collapsed` : `sidebar-rail sidebar-rail-${side}`;

  return (
    <aside aria-label={label} className={railClass}>
      <div className="sidebar-rail-inner">{children}</div>
    </aside>
  );
}

type SettingsSectionId = "general" | "domainLexicon" | "runtime" | "scout" | "storage" | "development";

const settingsSectionMeta: Record<SettingsSectionId, { title: string; description: string }> = {
  general: {
    title: "General",
    description: "Workspace status and SeekStar shell preferences.",
  },
  domainLexicon: {
    title: "Domain lexicon",
    description: "Configure the L0 field vocabulary used by the default New Seek tab.",
  },
  runtime: {
    title: "Runtime",
    description: "Default tab memory behavior and inactive cooling.",
  },
  scout: {
    title: "Scout service",
    description: "Background Playwright concurrency per app instance.",
  },
  storage: {
    title: "Storage",
    description: "Current local development store paths.",
  },
  development: {
    title: "Development",
    description: "Prototype data controls for clean iteration.",
  },
};

const domainLexiconLanguages = [
  { id: "en", label: "EN" },
  { id: "zh-Hans", label: "简体" },
  { id: "zh-Hant", label: "繁體" },
] as const;

function createSettingsDraft(settings?: SeekStarSettings): SeekStarSettings {
  return {
    tab_cache_max_bytes: settings?.tab_cache_max_bytes ?? 256 * 1024 * 1024,
    inactive_grace_ms: settings?.inactive_grace_ms ?? 30 * 60 * 1000,
    scout_concurrency: settings?.scout_concurrency ?? 2,
    active_domain_lexicon_id: settings?.active_domain_lexicon_id ?? DEFAULT_DOMAIN_LEXICON_ID,
    domain_lexicons: settings?.domain_lexicons ?? cloneDomainLexicons(DEFAULT_DOMAIN_LEXICONS),
  };
}

function createUiId(prefix: string): string {
  const randomId = typeof window.crypto?.randomUUID === "function"
    ? window.crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  return `${prefix}-${randomId}`;
}

function SettingsPage({
  onApplyDomainLexicon,
  onBack,
  onClearCache,
  onSave,
  settings,
  storePaths,
}: {
  onApplyDomainLexicon: (settings: SeekStarSettings) => Promise<void> | void;
  onBack: () => void;
  onClearCache: () => Promise<unknown> | void;
  onSave: (settings: SeekStarSettings) => void;
  settings?: SeekStarSettings;
  storePaths: Record<string, string>;
}): ReactElement {
  const [draft, setDraft] = useState<SeekStarSettings | undefined>(settings);
  const [searchValue, setSearchValue] = useState("");
  const [statusText, setStatusText] = useState("Ready");
  const [activeSection, setActiveSection] = useState<SettingsSectionId>("general");
  const [selectedLexiconId, setSelectedLexiconId] = useState(DEFAULT_DOMAIN_LEXICON_ID);
  const [selectedTermId, setSelectedTermId] = useState<string | undefined>();

  useEffect(() => {
    setDraft(settings);
    setSelectedLexiconId(settings?.active_domain_lexicon_id ?? DEFAULT_DOMAIN_LEXICON_ID);
    setSelectedTermId(undefined);
  }, [settings]);

  const cacheMb = Math.round((draft?.tab_cache_max_bytes ?? 0) / 1024 / 1024);
  const inactiveMinutes = Math.round((draft?.inactive_grace_ms ?? 0) / 60_000);
  const domainLexicons = draft?.domain_lexicons ?? cloneDomainLexicons(DEFAULT_DOMAIN_LEXICONS);
  const selectedLexicon =
    domainLexicons.find((lexicon) => lexicon.id === selectedLexiconId) ??
    domainLexicons.find((lexicon) => lexicon.active) ??
    domainLexicons[0];
  const selectedTerm = selectedLexicon?.terms.find((term) => term.id === selectedTermId) ?? selectedLexicon?.terms[0];

  function updateDraft(patch: Partial<SeekStarSettings>): void {
    setDraft((current) => ({
      ...createSettingsDraft(current),
      ...patch,
    }));
  }

  function updateDomainLexicons(nextLexicons: DomainLexicon[], nextActiveId?: string): void {
    const activeId =
      nextActiveId ??
      nextLexicons.find((lexicon) => lexicon.active)?.id ??
      nextLexicons[0]?.id ??
      DEFAULT_DOMAIN_LEXICON_ID;
    updateDraft({
      active_domain_lexicon_id: activeId,
      domain_lexicons: nextLexicons.map((lexicon) => ({
        ...lexicon,
        active: lexicon.id === activeId,
        updated_at: new Date().toISOString(),
      })),
    });
  }

  function updateSelectedLexicon(patch: Partial<DomainLexicon>): void {
    if (!selectedLexicon) {
      return;
    }

    updateDomainLexicons(
      domainLexicons.map((lexicon) => (lexicon.id === selectedLexicon.id ? { ...lexicon, ...patch } : lexicon)),
      draft?.active_domain_lexicon_id,
    );
  }

  function handleLexiconCreate(): void {
    const now = new Date().toISOString();
    const nextLexicon: DomainLexicon = {
      id: createUiId("domain-lexicon"),
      title: "Custom domain lexicon",
      description: "Custom L0 vocabulary for a New Seek starting field.",
      active: false,
      terms: [],
      updated_at: now,
    };

    updateDomainLexicons([...domainLexicons, nextLexicon], draft?.active_domain_lexicon_id);
    setSelectedLexiconId(nextLexicon.id);
    setSelectedTermId(undefined);
  }

  function handleLexiconDelete(lexiconId: string): void {
    if (domainLexicons.length <= 1) {
      return;
    }

    const nextLexicons = domainLexicons.filter((lexicon) => lexicon.id !== lexiconId);
    const activeId = draft?.active_domain_lexicon_id === lexiconId ? nextLexicons[0]?.id : draft?.active_domain_lexicon_id;

    updateDomainLexicons(nextLexicons, activeId);
    setSelectedLexiconId(activeId ?? nextLexicons[0]?.id ?? DEFAULT_DOMAIN_LEXICON_ID);
    setSelectedTermId(undefined);
  }

  function handleLexiconActivate(lexiconId: string): void {
    updateDomainLexicons(domainLexicons, lexiconId);
    setSelectedLexiconId(lexiconId);
  }

  function handleTermCreate(): void {
    if (!selectedLexicon) {
      return;
    }

    const nextTerm: DomainLexiconTerm = {
      id: createUiId("domain-term"),
      canonical: "New domain",
      enabled: true,
      labels: {
        en: "New domain",
        "zh-Hans": "新领域",
        "zh-Hant": "新領域",
      },
      tags: [],
    };

    updateSelectedLexicon({
      terms: [...selectedLexicon.terms, nextTerm],
    });
    setSelectedTermId(nextTerm.id);
  }

  function handleTermDelete(termId: string): void {
    if (!selectedLexicon) {
      return;
    }

    updateSelectedLexicon({
      terms: selectedLexicon.terms.filter((term) => term.id !== termId),
    });
    setSelectedTermId(undefined);
  }

  function updateSelectedTerm(termId: string, patch: Partial<DomainLexiconTerm>): void {
    if (!selectedLexicon) {
      return;
    }

    updateSelectedLexicon({
      terms: selectedLexicon.terms.map((term) => (term.id === termId ? { ...term, ...patch } : term)),
    });
  }

  function updateTermLabel(term: DomainLexiconTerm, language: string, value: string): void {
    updateSelectedTerm(term.id, {
      labels: {
        ...term.labels,
        [language]: value,
      },
    });
  }

  async function handleClearDevelopmentData(): Promise<void> {
    const confirmed = window.confirm("Clear SeekStar development workspace, tab runtime, and settings data? This cannot be undone.");

    if (!confirmed) {
      return;
    }

    setStatusText("Clearing development data...");
    await window.seekstar.workspace.clearDevelopmentData();
    window.location.reload();
  }

  async function handleClearCache(): Promise<void> {
    setStatusText("Clearing tab cache...");
    await onClearCache();
    setStatusText("Tab cache cleared");
  }

  async function handleSave(): Promise<void> {
    if (!draft) {
      return;
    }

    setStatusText("Saving settings...");
    await onSave(draft);
    setStatusText("Settings saved");
  }

  async function handleApplyDomainLexicon(): Promise<void> {
    if (!draft) {
      return;
    }

    setStatusText("Applying domain lexicon...");
    await onApplyDomainLexicon(draft);
    setStatusText("Domain lexicon applied to New Seek");
  }

  const settingsNavItems: Array<{ id: SettingsSectionId; label: string; icon: LucideIcon }> = [
    { id: "general", label: "General", icon: Settings },
    { id: "domainLexicon", label: "Domain lexicon", icon: Star },
    { id: "runtime", label: "Runtime", icon: Compass },
    { id: "scout", label: "Scout service", icon: Sparkles },
    { id: "storage", label: "Storage", icon: Folder },
    { id: "development", label: "Development", icon: Trash2 },
  ];
  const visibleNavItems = settingsNavItems.filter((item) => item.label.toLowerCase().includes(searchValue.trim().toLowerCase()));
  const resolvedActiveSection = visibleNavItems.some((item) => item.id === activeSection)
    ? activeSection
    : (visibleNavItems[0]?.id ?? "general");
  const activeMeta = settingsSectionMeta[resolvedActiveSection];

  return (
    <section className="settings-page" aria-label="SeekStar settings">
      <aside className="settings-page-sidebar">
        <button className="settings-back" onClick={onBack} type="button">
          <ArrowLeft aria-hidden="true" size={14} strokeWidth={1.8} />
          Back to app
        </button>
        <label className="settings-search">
          <Search aria-hidden="true" size={14} strokeWidth={1.8} />
          <input
            aria-label="Search settings"
            onChange={(event) => setSearchValue(event.target.value)}
            placeholder="Search settings..."
            value={searchValue}
          />
        </label>
        <nav className="settings-nav" aria-label="Settings sections">
          <span>Personal</span>
          {visibleNavItems.map((item) => (
            <button
              aria-current={resolvedActiveSection === item.id ? "page" : undefined}
              className={resolvedActiveSection === item.id ? "active" : ""}
              key={item.id}
              onClick={() => setActiveSection(item.id)}
              type="button"
            >
              <item.icon aria-hidden="true" size={14} strokeWidth={1.8} />
              {item.label}
            </button>
          ))}
        </nav>
      </aside>

      <div className="settings-page-content">
        <div className="settings-content-scroll">
          <div className="settings-panel">
            <header className="settings-hero">
              <p>SeekStar Settings</p>
              <h1>{activeMeta.title}</h1>
              <span>{statusText}</span>
              <p>{activeMeta.description}</p>
            </header>

            {resolvedActiveSection === "general" ? (
              <section className="settings-section">
                <div className="settings-card">
                  <div className="settings-row">
                    <span>
                      <strong>Shell surface</strong>
                      <small>Acrylic-backed observatory shell with glass sidebars and transparent workbench.</small>
                    </span>
                  </div>
                  <div className="settings-row">
                    <span>
                      <strong>Status</strong>
                      <small>Settings changes apply to tab runtime, Scout service, and local workspace stores.</small>
                    </span>
                  </div>
                </div>
              </section>
            ) : null}

            {resolvedActiveSection === "domainLexicon" ? (
              <section className="settings-section domain-lexicon-section">
                <div className="domain-lexicon-toolbar">
                  <div>
                    <strong>{selectedLexicon?.title ?? "No lexicon selected"}</strong>
                    <span>{selectedLexicon?.terms.filter((term) => term.enabled).length ?? 0} active terms</span>
                  </div>
                  <div>
                    <button onClick={handleLexiconCreate} type="button">
                      <Plus aria-hidden="true" size={14} strokeWidth={1.8} />
                      Add lexicon
                    </button>
                    <button className="primary" disabled={!draft} onClick={handleApplyDomainLexicon} type="button">
                      <RefreshCw aria-hidden="true" size={14} strokeWidth={1.8} />
                      Apply to New Seek
                    </button>
                  </div>
                </div>

                <div className="domain-lexicon-workspace">
                  <aside className="domain-lexicon-list" aria-label="Domain lexicons">
                    {domainLexicons.map((lexicon) => (
                      <button
                        className={lexicon.id === selectedLexicon?.id ? "active" : ""}
                        key={lexicon.id}
                        onClick={() => {
                          setSelectedLexiconId(lexicon.id);
                          setSelectedTermId(undefined);
                        }}
                        type="button"
                      >
                        <span>
                          <strong>{lexicon.title}</strong>
                          <small>{lexicon.terms.length} terms</small>
                        </span>
                        {lexicon.active ? <em>Active</em> : null}
                      </button>
                    ))}
                  </aside>

                  <div className="domain-lexicon-editor">
                    {selectedLexicon ? (
                      <>
                        <div className="domain-lexicon-fields">
                          <label>
                            <span>Title</span>
                            <input
                              onChange={(event) => updateSelectedLexicon({ title: event.target.value })}
                              value={selectedLexicon.title}
                            />
                          </label>
                          <label>
                            <span>Description</span>
                            <textarea
                              onChange={(event) => updateSelectedLexicon({ description: event.target.value })}
                              rows={3}
                              value={selectedLexicon.description}
                            />
                          </label>
                          <div className="domain-lexicon-actions">
                            <button
                              disabled={selectedLexicon.active}
                              onClick={() => handleLexiconActivate(selectedLexicon.id)}
                              type="button"
                            >
                              <Star aria-hidden="true" size={14} strokeWidth={1.8} />
                              Activate
                            </button>
                            <button
                              className="danger"
                              disabled={domainLexicons.length <= 1}
                              onClick={() => handleLexiconDelete(selectedLexicon.id)}
                              type="button"
                            >
                              <Trash2 aria-hidden="true" size={14} strokeWidth={1.8} />
                              Delete
                            </button>
                          </div>
                        </div>

                        <div className="domain-term-toolbar">
                          <strong>Terms</strong>
                          <button onClick={handleTermCreate} type="button">
                            <Plus aria-hidden="true" size={14} strokeWidth={1.8} />
                            Add term
                          </button>
                        </div>

                        <div className="domain-term-table" role="table" aria-label="Domain terms">
                          <div className="domain-term-row domain-term-row-head" role="row">
                            <span>On</span>
                            <span>Canonical</span>
                            {domainLexiconLanguages.map((language) => (
                              <span key={language.id}>{language.label}</span>
                            ))}
                            <span />
                          </div>
                          {selectedLexicon.terms.map((term) => (
                            <div
                              className={term.id === selectedTerm?.id ? "domain-term-row active" : "domain-term-row"}
                              key={term.id}
                              role="row"
                            >
                              <label className="domain-term-enabled">
                                <input
                                  checked={term.enabled}
                                  onChange={(event) => updateSelectedTerm(term.id, { enabled: event.target.checked })}
                                  type="checkbox"
                                />
                              </label>
                              <input
                                onChange={(event) => updateSelectedTerm(term.id, { canonical: event.target.value })}
                                onFocus={() => setSelectedTermId(term.id)}
                                value={term.canonical}
                              />
                              {domainLexiconLanguages.map((language) => (
                                <input
                                  key={language.id}
                                  onChange={(event) => updateTermLabel(term, language.id, event.target.value)}
                                  onFocus={() => setSelectedTermId(term.id)}
                                  value={term.labels[language.id] ?? ""}
                                />
                              ))}
                              <button aria-label={`Delete ${term.canonical}`} onClick={() => handleTermDelete(term.id)} type="button">
                                <Trash2 aria-hidden="true" size={14} strokeWidth={1.8} />
                              </button>
                            </div>
                          ))}
                        </div>
                      </>
                    ) : null}
                  </div>
                </div>
              </section>
            ) : null}

            {resolvedActiveSection === "runtime" ? (
              <section className="settings-section">
                <div className="settings-card">
                  <label className="settings-row">
                    <span>
                      <strong>Tab cache limit</strong>
                      <small>Logical memory budget for each tab object cache.</small>
                    </span>
                    <input
                      min={32}
                      max={2048}
                      onChange={(event) => updateDraft({ tab_cache_max_bytes: Number(event.target.value) * 1024 * 1024 })}
                      type="number"
                      value={cacheMb || 256}
                    />
                  </label>
                  <label className="settings-row">
                    <span>
                      <strong>Inactive grace</strong>
                      <small>Minutes before an inactive tab is visually cooled down.</small>
                    </span>
                    <input
                      min={1}
                      max={1440}
                      onChange={(event) => updateDraft({ inactive_grace_ms: Number(event.target.value) * 60_000 })}
                      type="number"
                      value={inactiveMinutes || 30}
                    />
                  </label>
                </div>
              </section>
            ) : null}

            {resolvedActiveSection === "scout" ? (
              <section className="settings-section">
                <div className="settings-card">
                  <label className="settings-row">
                    <span>
                      <strong>Scout concurrency</strong>
                      <small>Maximum background Scout jobs that can run at once.</small>
                    </span>
                    <input
                      min={1}
                      max={8}
                      onChange={(event) => updateDraft({ scout_concurrency: Number(event.target.value) })}
                      type="number"
                      value={draft?.scout_concurrency ?? 2}
                    />
                  </label>
                </div>
              </section>
            ) : null}

            {resolvedActiveSection === "storage" ? (
              <section className="settings-section">
                <div className="settings-card settings-path-list">
                  {Object.entries(storePaths).map(([key, value]) => (
                    <p key={key}>
                      <span>{key.replace(/_/g, " ")}</span>
                      <code>{value}</code>
                    </p>
                  ))}
                </div>
              </section>
            ) : null}

            {resolvedActiveSection === "development" ? (
              <section className="settings-section">
                <div className="settings-card settings-actions-card">
                  <button onClick={handleClearCache} type="button">
                    <RefreshCw aria-hidden="true" size={14} strokeWidth={1.8} />
                    Clear tab cache
                  </button>
                  <button className="danger" onClick={handleClearDevelopmentData} type="button">
                    <Trash2 aria-hidden="true" size={14} strokeWidth={1.8} />
                    Clear development data
                  </button>
                </div>
              </section>
            ) : null}
          </div>
        </div>

        <footer className="settings-savebar">
          <button onClick={onBack} type="button">
            Back
          </button>
          <button className="primary" disabled={!draft} onClick={handleSave} type="button">
            Save settings
          </button>
        </footer>
      </div>
    </section>
  );
}

function DetachedTabTitleBar({
  activeTab,
  onAttach,
  onClose,
  onToggleRightSidebar,
  rightSidebarExpanded,
}: {
  activeTab: ExplorationTab;
  onAttach: () => void;
  onClose: () => void;
  onToggleRightSidebar: () => void;
  rightSidebarExpanded: boolean;
}): ReactElement {
  return (
    <header className="detached-tab-titlebar">
      <div className="detached-tab-title">
        <span>SeekStar tab</span>
        <strong>{activeTab.title}</strong>
      </div>
      <div className="detached-tab-actions">
        <button aria-label="Attach tab to main window" onClick={onAttach} title="Attach to main window" type="button">
          <PanelLeftOpen aria-hidden="true" size={15} strokeWidth={1.8} />
        </button>
        <SidebarToggleButton
          expanded={rightSidebarExpanded}
          label="Inspector"
          onClick={onToggleRightSidebar}
          side="right"
        />
        <button aria-label="Close tab" onClick={onClose} title="Close tab" type="button">
          <X aria-hidden="true" size={15} strokeWidth={1.8} />
        </button>
      </div>
    </header>
  );
}

function WindowTitleBar({
  leftSidebarExpanded,
  onToggleLeftSidebar,
}: {
  leftSidebarExpanded: boolean;
  onToggleLeftSidebar: () => void;
}): ReactElement {
  const [openMenuId, setOpenMenuId] = useState<AppMenuId | null>(null);

  function handleToggleMenu(menuId: AppMenuId): void {
    setOpenMenuId((current) => (current === menuId ? null : menuId));
  }

  return (
    <header className="window-titlebar">
      <div className="window-nav">
        <SidebarToggleButton
          expanded={leftSidebarExpanded}
          label="Observatory"
          onClick={onToggleLeftSidebar}
          side="left"
        />
        <button aria-label="Back" onClick={goBack} type="button">
          <ArrowLeft aria-hidden="true" size={15} strokeWidth={1.8} />
        </button>
        <button aria-label="Forward" onClick={goForward} type="button">
          <ArrowRight aria-hidden="true" size={15} strokeWidth={1.8} />
        </button>
      </div>
      <TitleBarMenus openMenuId={openMenuId} onClose={() => setOpenMenuId(null)} onToggle={handleToggleMenu} />
      <p className="window-titlebar-brand" aria-label="SeekStar AI Explorer lens">
        <span className="window-titlebar-brand-name">SeekStar</span>
        <span className="window-titlebar-brand-lens">AI Explorer lens</span>
      </p>
      <div aria-hidden="true" className="window-drag-region" />
      <div className="window-titlebar-spacer" />
    </header>
  );
}

function ObservatorySidebar({
  activeTool,
  activeTabId,
  folderCounts,
  folders,
  onFocusCommand,
  onFolderCreate,
  onFolderDelete,
  onOpenSettings,
  onTabClose,
  onTabCopyCrashLog,
  onTabDetach,
  onTabFavorite,
  onTabFolderAssign,
  onTabPin,
  onTabRefresh,
  onTabReorder,
  onToolSelect,
  onTabSelect,
  onWorkspaceRename,
  runtimeTabsById,
  scenes,
  workspaceName,
}: {
  activeTool: CanvasTool;
  activeTabId: string;
  folderCounts: Map<string, number>;
  folders: WorkspaceFolder[];
  onFocusCommand: () => void;
  onFolderCreate: () => void;
  onFolderDelete: (folderId: string) => void;
  onOpenSettings: () => void;
  onTabClose: (tabId: string) => void;
  onTabCopyCrashLog: (tabId: string) => void;
  onTabDetach: (tabId: string) => void;
  onTabFavorite: (tabId: string) => void;
  onTabFolderAssign: (tabId: string, folderId?: string) => void;
  onTabPin: (tabId: string) => void;
  onTabRefresh: (tabId: string) => void;
  onTabReorder: (sourceTabId: string, targetTabId: string) => void;
  onToolSelect: (tool: CanvasTool) => void;
  onTabSelect: (tabId: string) => void;
  onWorkspaceRename: () => void;
  runtimeTabsById: Map<string, TabRecord>;
  scenes: TerrainScene[];
  workspaceName: string;
}): ReactElement {
  const [draggingTabId, setDraggingTabId] = useState<string | undefined>();
  const [dragStartScreenPosition, setDragStartScreenPosition] = useState<{ x: number; y: number } | undefined>();

  return (
    <div className="observatory-sidebar" aria-label="SeekStar observatory sidebar">
      <section className="sidebar-nav">
        <button className="sidebar-nav-item" onClick={onFocusCommand} type="button">
          <span className="sidebar-icon">
            <Compass aria-hidden="true" size={15} strokeWidth={1.8} />
          </span>
          New field search
        </button>
        <button className="sidebar-nav-item" onClick={onFocusCommand} type="button">
          <span className="sidebar-icon">
            <Search aria-hidden="true" size={15} strokeWidth={1.8} />
          </span>
          Search current map
        </button>
      </section>

      <section className="sidebar-section workspace-section">
        <div className="workspace-section-header">
          <h2>Workspace</h2>
          <button aria-label="Rename workspace" onClick={onWorkspaceRename} type="button">
            Rename
          </button>
        </div>
        <button className="workspace-name" onClick={onWorkspaceRename} type="button">
          <span className="sidebar-icon">
            <Folder aria-hidden="true" size={14} strokeWidth={1.8} />
          </span>
          <span>{workspaceName}</span>
        </button>
        <div className="folder-list">
          {folders.map((folder) => (
            <div className="folder-row" key={folder.id}>
              <span className="sidebar-icon">
                <Folder aria-hidden="true" size={13} strokeWidth={1.8} />
              </span>
              <span className="folder-row-title">{folder.title}</span>
              <small>{folderCounts.get(folder.id) ?? 0}</small>
              <button aria-label={`Delete ${folder.title}`} onClick={() => onFolderDelete(folder.id)} title="Delete folder" type="button">
                <X aria-hidden="true" size={11} strokeWidth={2} />
              </button>
            </div>
          ))}
          <button className="folder-create" onClick={onFolderCreate} type="button">
            <FolderPlus aria-hidden="true" size={13} strokeWidth={1.8} />
            New folder
          </button>
        </div>
      </section>

      <section className="sidebar-section">
        <h2>Favorites</h2>
        <div className="sidebar-list">
          {favoriteSeeds.map((seed) => (
            <button className="sidebar-list-item" key={seed} onClick={onFocusCommand} type="button">
              <span className="sidebar-icon">
                <Sparkles aria-hidden="true" size={14} strokeWidth={1.8} />
              </span>
              <span className="sidebar-label">{seed}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="sidebar-section">
        <h2>Canvas tools</h2>
        <div className="canvas-tool-list">
          {canvasTools.map((tool) => (
            <button
              aria-pressed={activeTool === tool.id}
              className={activeTool === tool.id ? "canvas-tool active" : "canvas-tool"}
              disabled={tool.disabled}
              key={tool.id}
              onClick={() => onToolSelect(tool.id)}
              type="button"
            >
              <span className="sidebar-icon">
                <tool.icon aria-hidden="true" size={15} strokeWidth={1.8} />
              </span>
              <span className="sidebar-label">{tool.label}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="sidebar-section sidebar-section-tabs">
        <h2>Exploration tabs</h2>
        <div className="exploration-tab-list">
          {scenes.map((scene) => {
            const tab = getActiveTab(scene);
            const runtimeTab = runtimeTabsById.get(tab.id);
            const isActive = tab.id === activeTabId;
            const isInactive = isTabVisuallyInactive(runtimeTab);
            const isCrashed = runtimeTab?.runtime_status === "crashed";

            return (
              <div
                className={[
                  "exploration-tab",
                  isActive ? "active" : "",
                  isInactive ? "inactive" : "",
                  isCrashed ? "crashed" : "",
                  draggingTabId === tab.id ? "dragging" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                draggable
                key={tab.id}
                onDragEnd={(event) => {
                  if (draggingTabId === tab.id && shouldDetachDraggedTab(event, dragStartScreenPosition)) {
                    onTabDetach(tab.id);
                  }
                  setDraggingTabId(undefined);
                  setDragStartScreenPosition(undefined);
                }}
                onDragOver={(event) => {
                  event.preventDefault();
                }}
                onDragStart={(event) => {
                  event.dataTransfer.effectAllowed = "move";
                  event.dataTransfer.setData("text/plain", tab.id);
                  setDraggingTabId(tab.id);
                  setDragStartScreenPosition({ x: event.screenX, y: event.screenY });
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  const sourceTabId = event.dataTransfer.getData("text/plain");

                  if (sourceTabId && sourceTabId !== tab.id) {
                    onTabReorder(sourceTabId, tab.id);
                  }
                  setDraggingTabId(undefined);
                  setDragStartScreenPosition(undefined);
                }}
              >
                <button className="exploration-tab-main" onClick={() => onTabSelect(tab.id)} type="button">
                  <span className="exploration-tab-icon" aria-hidden="true">
                    <Circle size={12} strokeWidth={2} />
                  </span>
                  <span className="exploration-tab-label">{tab.title}</span>
                </button>
                <div className="exploration-tab-actions">
                  <button aria-label={`Pin ${tab.title}`} className={runtimeTab?.pinned ? "active" : ""} onClick={() => onTabPin(tab.id)} title="Pin" type="button">
                    <Pin aria-hidden="true" size={12} strokeWidth={2} />
                  </button>
                  <button aria-label={`Favorite ${tab.title}`} className={runtimeTab?.favorite ? "active" : ""} onClick={() => onTabFavorite(tab.id)} title="Favorite" type="button">
                    <Star aria-hidden="true" size={12} strokeWidth={2} />
                  </button>
                  <button aria-label={`Refresh ${tab.title}`} onClick={() => onTabRefresh(tab.id)} title="Refresh" type="button">
                    <RefreshCw aria-hidden="true" size={12} strokeWidth={2} />
                  </button>
                  {isCrashed ? (
                    <button aria-label={`Copy crash log for ${tab.title}`} onClick={() => onTabCopyCrashLog(tab.id)} title="Copy crash log" type="button">
                      <Copy aria-hidden="true" size={12} strokeWidth={2} />
                    </button>
                  ) : null}
                  <button aria-label={`Open ${tab.title} in new window`} onClick={() => onTabDetach(tab.id)} title="Detach" type="button">
                    <ExternalLink aria-hidden="true" size={12} strokeWidth={2} />
                  </button>
                  <button aria-label={`Close ${tab.title}`} disabled={scenes.length <= 1} onClick={() => onTabClose(tab.id)} title="Close" type="button">
                    <Trash2 aria-hidden="true" size={12} strokeWidth={2} />
                  </button>
                </div>
                {folders.length > 0 ? (
                  <select
                    aria-label={`Folder for ${tab.title}`}
                    className="exploration-tab-folder"
                    onChange={(event) => onTabFolderAssign(tab.id, event.target.value || undefined)}
                    onClick={(event) => event.stopPropagation()}
                    value={runtimeTab?.folder_id ?? ""}
                  >
                    <option value="">No folder</option>
                    {folders.map((folder) => (
                      <option key={folder.id} value={folder.id}>
                        {folder.title}
                      </option>
                    ))}
                  </select>
                ) : null}
              </div>
            );
          })}
          <button className="exploration-tab-new" onClick={onFocusCommand} type="button">
            <span className="exploration-tab-icon" aria-hidden="true">
              <Plus size={13} strokeWidth={2} />
            </span>
            <span className="exploration-tab-label">New tab</span>
          </button>
        </div>
      </section>

      <button className="sidebar-settings" onClick={onOpenSettings} type="button">
        <span className="sidebar-icon">
          <Settings aria-hidden="true" size={15} strokeWidth={1.8} />
        </span>
        Settings
      </button>
    </div>
  );
}

function shouldDetachDraggedTab(event: DragEvent<HTMLElement>, start?: { x: number; y: number }): boolean {
  if (!start) {
    return false;
  }

  const travel = Math.hypot(event.screenX - start.x, event.screenY - start.y);

  if (travel < 96) {
    return false;
  }

  const left = window.screenX;
  const top = window.screenY;
  const right = left + window.outerWidth;
  const bottom = top + window.outerHeight;

  return event.screenX < left - 24 || event.screenX > right + 24 || event.screenY < top - 24 || event.screenY > bottom + 24;
}

function isTabVisuallyInactive(tab?: TabRecord): boolean {
  if (!tab) {
    return false;
  }

  if (tab.runtime_status === "suspended") {
    return true;
  }

  if (tab.runtime_status !== "inactive") {
    return false;
  }

  const lastAccessedAt = Date.parse(tab.last_accessed_at);

  if (!Number.isFinite(lastAccessedAt)) {
    return true;
  }

  return Date.now() - lastAccessedAt >= tab.cache_policy.inactive_grace_ms;
}

function WorkbenchHeader({
  activeTab,
  breadcrumb,
  jobState,
  layer,
  layerLabel,
  layers,
  onLayerSelect,
  onToggleRightSidebar,
  rightSidebarExpanded,
}: {
  activeTab: ExplorationTab;
  breadcrumb: string[];
  jobState: string;
  layer: LayerId;
  layerLabel: string;
  layers: TerrainScene["layers"];
  onLayerSelect: (layer: LayerId) => void;
  onToggleRightSidebar: () => void;
  rightSidebarExpanded: boolean;
}): ReactElement {
  const breadcrumbItems = breadcrumb.map((label, index) => ({
    label,
    layer: index > 0 ? layers[index - 1]?.id : undefined,
  }));

  return (
    <header className="workbench-header">
      <div className="workbench-context">
        <span className="workbench-context-label">{activeTab.seed}</span>
        <span className="workbench-context-meta">
          {layer} - {layerLabel}
        </span>
        <div className="workbench-breadcrumb" aria-label="Semantic breadcrumb">
          {breadcrumbItems.map((item, index) => {
            const itemLayer = item.layer;

            return (
              <span key={`${item.label}-${index}`}>
                {itemLayer ? (
                  <button onClick={() => onLayerSelect(itemLayer)} type="button">
                    {item.label}
                  </button>
                ) : (
                  item.label
                )}
              </span>
            );
          })}
        </div>
      </div>
      <div className="workbench-header-actions">
        <span className="workbench-job">{jobState}</span>
        <SidebarToggleButton
          expanded={rightSidebarExpanded}
          label="Inspector"
          onClick={onToggleRightSidebar}
          side="right"
        />
      </div>
    </header>
  );
}

function CommandComposer({
  commandInputRef,
  commandValue,
  isCommandModalOpen,
  onAddToCurrentPage,
  onCommandChange,
  onCommandFocus,
  onCommandKeyDown,
  onSearchCurrentTab,
  onUseAsSeed,
}: {
  commandInputRef: RefObject<HTMLInputElement | null>;
  commandValue: string;
  isCommandModalOpen: boolean;
  onAddToCurrentPage: () => void;
  onCommandChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onCommandFocus: () => void;
  onCommandKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void;
  onSearchCurrentTab: () => void;
  onUseAsSeed: () => void;
}): ReactElement {
  return (
    <div className="command-composer">
      <div className="command-composer-inner">
        {isCommandModalOpen ? (
          <CommandActionCard
            value={commandValue.trim()}
            onAddToCurrentPage={onAddToCurrentPage}
            onSearchCurrentTab={onSearchCurrentTab}
            onUseAsSeed={onUseAsSeed}
          />
        ) : null}
        <label className="command-bar" aria-label="Command input">
          <button aria-label="Add context" className="command-bar-addon" type="button">
            +
          </button>
          <input
            onChange={onCommandChange}
            onFocus={onCommandFocus}
            onKeyDown={onCommandKeyDown}
            ref={commandInputRef}
            type="text"
            value={commandValue}
            placeholder="Add a keyword, start a new Seek, or search this map"
          />
          <button
            aria-label="Submit"
            className="command-bar-submit"
            disabled={!commandValue.trim()}
            onClick={onCommandFocus}
            type="button"
          >
            {"->"}
          </button>
        </label>
      </div>
    </div>
  );
}

function SelectionActionCard({
  nodeCount,
  onDismiss,
  onSaveSelection,
  onUseAsSeed,
}: {
  nodeCount: number;
  onDismiss: () => void;
  onSaveSelection: () => void;
  onUseAsSeed: () => void;
}): ReactElement {
  return (
    <aside className="selection-action-card" aria-label="Selection actions">
      <div className="selection-action-card-header">
        <span>{nodeCount} selected</span>
        <button aria-label="Dismiss selection actions" onClick={onDismiss} type="button">
          x
        </button>
      </div>
      <div className="selection-action-card-actions">
        <button onClick={onSaveSelection} type="button">
          Save to tray
        </button>
        <button className="selection-action-wide" onClick={onUseAsSeed} type="button">
          Use region as new seed
        </button>
      </div>
    </aside>
  );
}

function InspectorSidebar({
  activeTab,
  basketItems,
  onBacklinkFocus,
  onAddSource,
  onConvertScoutObservation,
  onClearBasket,
  onClearSelection,
  onRemoveBasketItem,
  onRunScoutPlan,
  onScoutSourceLinks,
  onLayerSelect,
  onResetWorkspace,
  onSaveSelectionToTray,
  onSearchResultSelect,
  onUseNodeAsSeed,
  scene,
  searchQuery,
  searchResults,
  selectedNode,
  selectedNodes,
  selectedObservationId,
  selectedRelation,
  selectedRelationNodes,
}: {
  activeTab: ExplorationTab;
  basketItems: SelectionBasketItem[];
  onBacklinkFocus: (backlink: NonNullable<ExplorationTab["parent_backlink"]>) => void;
  onAddSource: (input: SourceIngestionInput) => void;
  onConvertScoutObservation: (observation: ScoutObservation) => void;
  onClearBasket: () => void;
  onClearSelection: () => void;
  onRemoveBasketItem: (itemId: string) => void;
  onRunScoutPlan: (plan: ScoutPlan) => void;
  onScoutSourceLinks: (node: TerrainNode, source: SourceRef) => void;
  onLayerSelect: (layer: LayerId, focusNodeId?: string) => void;
  onResetWorkspace: () => void;
  onSaveSelectionToTray: () => void;
  onSearchResultSelect: (nodeId: string) => void;
  onUseNodeAsSeed: (node: TerrainNode) => void;
  scene: TerrainScene;
  searchQuery: string;
  searchResults: SearchResult[];
  selectedNode?: TerrainNode;
  selectedNodes: TerrainNode[];
  selectedObservationId?: string;
  selectedRelation?: TerrainRelation;
  selectedRelationNodes?: { from?: TerrainNode; to?: TerrainNode };
}): ReactElement {
  const fogCount = scene.nodes.filter((node) => node.type === "fog_region").length;
  const panelTitle = selectedRelation ? "Relation" : selectedNodes.length > 1 ? "Selection" : selectedNode ? "Inspect" : searchQuery ? "Search" : "Overview";

  return (
    <div className="inspector-sidebar">
      <header className="inspector-sidebar-header">
        <span>{panelTitle}</span>
        {selectedRelation || selectedNode || searchQuery ? (
          <button aria-label="Clear selection" onClick={onClearSelection} type="button">
            Clear
          </button>
        ) : null}
      </header>
      <div className="inspector-sidebar-body">
        {selectedRelation ? (
          <SelectedRelationPanel fromNode={selectedRelationNodes?.from} relation={selectedRelation} toNode={selectedRelationNodes?.to} />
        ) : selectedNodes.length > 1 ? (
          <SelectionRegionPanel nodes={selectedNodes} onSaveSelectionToTray={onSaveSelectionToTray} />
        ) : selectedNode ? (
          <SelectedNodePanel
            node={selectedNode}
            onNodeSelect={onSearchResultSelect}
            onScoutSourceLinks={onScoutSourceLinks}
            onLayerSelect={onLayerSelect}
            onSaveSelectionToTray={onSaveSelectionToTray}
            onUseNodeAsSeed={onUseNodeAsSeed}
            scene={scene}
          />
        ) : (
          <SceneOverviewPanel
            activeTab={activeTab}
            fogCount={fogCount}
            onBacklinkFocus={onBacklinkFocus}
            onResetWorkspace={onResetWorkspace}
            scene={scene}
          />
        )}
        <SearchResultsPanel query={searchQuery} results={searchResults} onResultSelect={onSearchResultSelect} />
        <CartographerOutputPanel
          observations={scene.scout_observations ?? []}
          outputs={scene.cartographer_outputs ?? []}
          scene={scene}
          onNodeSelect={onSearchResultSelect}
          onRunScoutPlan={onRunScoutPlan}
        />
        <ScoutObservationPanel
          observations={scene.scout_observations ?? []}
          selectedObservationId={selectedObservationId}
          onConvertObservation={onConvertScoutObservation}
        />
        <SourceIngestionPanel onAddSource={onAddSource} />
        <SideTrayPanel
          items={basketItems}
          onClearBasket={onClearBasket}
          onRemoveItem={onRemoveBasketItem}
        />
      </div>
    </div>
  );
}

function SourceIngestionPanel({ onAddSource }: { onAddSource: (input: SourceIngestionInput) => void }): ReactElement {
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [body, setBody] = useState("");
  const canSubmit = title.trim().length > 0 && body.trim().length > 0;

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();

    if (!canSubmit) {
      return;
    }

    onAddSource({
      title: title.trim(),
      url: url.trim() || undefined,
      body: body.trim(),
    });
    setTitle("");
    setUrl("");
    setBody("");
  }

  return (
    <section className="inspect-section source-ingestion-panel">
      <div className="source-ingestion-header">
        <h2>Add source</h2>
        <span>manual</span>
      </div>
      <p>Paste local text or a source excerpt. It becomes source-backed terrain in this tab.</p>
      <form className="source-ingestion-form" onSubmit={handleSubmit}>
        <label>
          <span>Title</span>
          <input onChange={(event: ChangeEvent<HTMLInputElement>) => setTitle(event.target.value)} value={title} />
        </label>
        <label>
          <span>URL optional</span>
          <input onChange={(event: ChangeEvent<HTMLInputElement>) => setUrl(event.target.value)} value={url} />
        </label>
        <label>
          <span>Excerpt</span>
          <textarea
            onChange={(event: ChangeEvent<HTMLTextAreaElement>) => setBody(event.target.value)}
            rows={4}
            value={body}
          />
        </label>
        <button disabled={!canSubmit} type="submit">
          Add to map
        </button>
      </form>
    </section>
  );
}

function CartographerOutputPanel({
  observations,
  onNodeSelect,
  onRunScoutPlan,
  outputs,
  scene,
}: {
  observations: ScoutObservation[];
  onNodeSelect: (nodeId: string) => void;
  onRunScoutPlan: (plan: ScoutPlan) => void;
  outputs: CartographerOutput[];
  scene: TerrainScene;
}): ReactElement | null {
  if (outputs.length === 0 && scene.agent_jobs.length === 0) {
    return null;
  }

  const recentOutputs = [...outputs].slice(-4).reverse();
  const recentJobs = [...scene.agent_jobs].slice(-4).reverse();
  const jobCounts = getJobStatusCounts(scene.agent_jobs);

  return (
    <section className="inspect-section cartographer-output-panel">
      <div className="cartographer-output-header">
        <h2>Cartographer jobs</h2>
        <span>{scene.agent_jobs.length} structured</span>
      </div>
      <div className="cartographer-job-summary" aria-label="Cartographer job summary">
        {(["queued", "running", "completed", "failed", "cancelled"] satisfies AgentJobStatus[]).map((status) => (
          <span key={status}>
            {status} {jobCounts[status] ?? 0}
          </span>
        ))}
      </div>
      {recentJobs.length > 0 ? (
        <div className="cartographer-job-list">
          {recentJobs.map((job) => (
            <article className="cartographer-job-item" key={job.id}>
              <div className="cartographer-output-meta">
                <span>{job.mode.replace(/_/g, " ")}</span>
                <span>{job.status}</span>
                {typeof job.progress === "number" ? <span>{Math.round(job.progress * 100)}%</span> : null}
              </div>
              <strong>{job.title ?? job.input_summary}</strong>
              <small>{job.input_summary}</small>
              {typeof job.progress === "number" ? (
                <div className="cartographer-job-progress" aria-hidden="true">
                  <span style={{ width: `${Math.max(2, Math.round(job.progress * 100))}%` }} />
                </div>
              ) : null}
              {job.status === "cancelled" ? <small>No terrain patch was applied.</small> : null}
              {job.error_message ? <small className="cartographer-job-error">{job.error_message}</small> : null}
            </article>
          ))}
        </div>
      ) : null}
      {recentOutputs.length > 0 ? (
        <div className="cartographer-output-list">
          {recentOutputs.map((output) => {
            const focusNodeId = output.patch?.nodes[0]?.id;

            return (
              <article className="cartographer-output-item" key={output.id}>
                <div className="cartographer-output-meta">
                  <span>{output.mode.replace(/_/g, " ")}</span>
                  <span>{formatSourceState(output.source_state)}</span>
                  {output.scout_plan ? <span>scout plan</span> : null}
                </div>
                <h3>{output.title}</h3>
                <p>{output.summary}</p>
                {output.scout_plan ? (
                  <div className="scout-plan-card">
                    <strong>{output.scout_plan.title}</strong>
                    {output.scout_plan.candidate_queries.map((query) => (
                      <span key={query}>{query}</span>
                    ))}
                    <button onClick={() => output.scout_plan && onRunScoutPlan(output.scout_plan)} type="button">
                      Run Scout observations
                    </button>
                    <small>
                      {
                        observations.filter((observation) => observation.plan_id === output.scout_plan?.id).length
                      }{" "}
                      observations
                    </small>
                  </div>
                ) : null}
                {focusNodeId ? (
                  <button onClick={() => onNodeSelect(focusNodeId)} type="button">
                    Focus output node
                  </button>
                ) : null}
              </article>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}

function ScoutObservationPanel({
  observations,
  selectedObservationId,
  onConvertObservation,
}: {
  observations: ScoutObservation[];
  selectedObservationId?: string;
  onConvertObservation: (observation: ScoutObservation) => void;
}): ReactElement | null {
  if (observations.length === 0) {
    return null;
  }

  const recentObservations = [...observations].slice(-6).reverse();
  const statusCounts = observations.reduce<Partial<Record<ScoutObservation["status"], number>>>((counts, observation) => {
    counts[observation.status] = (counts[observation.status] ?? 0) + 1;
    return counts;
  }, {});

  return (
    <section className="inspect-section scout-observation-panel">
      <div className="scout-observation-header">
        <h2>Scout observations</h2>
        <span>{observations.length} scout</span>
      </div>
      <p>Structured Scout observations only. They are not source-backed terrain until provenance conversion happens.</p>
      <div className="scout-observation-summary" aria-label="Scout observation summary">
        {(["pending", "source_candidate", "observed", "converted", "duplicate", "failed"] satisfies ScoutObservation["status"][]).map((status) => (
          <span key={status}>
            {status.replace("_", " ")} {statusCounts[status] ?? 0}
          </span>
        ))}
      </div>
      <div className="scout-observation-list">
        {recentObservations.map((observation) => (
          <article
            className={observation.id === selectedObservationId ? "scout-observation-item is-selected" : "scout-observation-item"}
            data-scout-state={observation.status}
            key={observation.id}
          >
            <div className="cartographer-output-meta">
              <span>{observation.status.replace("_", " ")}</span>
              <span>{observation.adapter ?? "local"}</span>
              <span>{observation.source_type ?? "unknown"}</span>
            </div>
            <strong>{observation.title}</strong>
            <small>{observation.query}</small>
            {observation.snippet ? <p>{observation.snippet}</p> : null}
            {observation.failure_reason ? <small>{observation.failure_reason}</small> : null}
            {observation.status === "source_candidate" || observation.status === "observed" ? (
              <button onClick={() => onConvertObservation(observation)} type="button">
                Confirm as source terrain
              </button>
            ) : null}
            {observation.status === "converted" ? <small>Converted into source-backed terrain.</small> : null}
          </article>
        ))}
      </div>
    </section>
  );
}

function SceneOverviewPanel({
  activeTab,
  fogCount,
  onBacklinkFocus,
  onResetWorkspace,
  scene,
}: {
  activeTab: ExplorationTab;
  fogCount: number;
  onBacklinkFocus: (backlink: NonNullable<ExplorationTab["parent_backlink"]>) => void;
  onResetWorkspace: () => void;
  scene: TerrainScene;
}): ReactElement {
  const activeLayer = getActiveLayer(scene);
  const currentLayerNodes = scene.nodes.filter((node) => node.layer === scene.viewport.layer);

  return (
    <section className="inspect-section">
      <h1>{activeTab.title}</h1>
      <p>{scene.metadata.description}</p>
      <dl className="metric-list">
        <div>
          <dt>Nodes</dt>
          <dd>{scene.nodes.length}</dd>
        </div>
        <div>
          <dt>Relations</dt>
          <dd>{scene.relations.length}</dd>
        </div>
        <div>
          <dt>Fog</dt>
          <dd>{fogCount}</dd>
        </div>
      </dl>
      <div className="deep-zoom-overview">
        <div className="deep-zoom-overview-header">
          <h2>Deep zoom</h2>
          <span>{scene.viewport.layer}</span>
        </div>
        <p>
          {activeLayer
            ? `${activeLayer.label}: ${currentLayerNodes.length} visible local terrain node${currentLayerNodes.length === 1 ? "" : "s"}.`
            : "Current layer is not described by this scene."}
        </p>
        {activeLayer?.breadcrumb ? <small>{activeLayer.breadcrumb.join(" / ")}</small> : null}
      </div>
      {activeTab.parent_backlink ? <BacklinkPanel backlink={activeTab.parent_backlink} onBacklinkFocus={onBacklinkFocus} /> : null}
      <SourceReadinessPanel scene={scene} />
      <button className="inspect-action" onClick={onResetWorkspace} type="button">
        Reset local workspace
      </button>
    </section>
  );
}

function BacklinkPanel({
  backlink,
  onBacklinkFocus,
}: {
  backlink: ExplorationTab["parent_backlink"];
  onBacklinkFocus: (backlink: NonNullable<ExplorationTab["parent_backlink"]>) => void;
}): ReactElement | null {
  if (!backlink) {
    return null;
  }

  return (
    <div className="backlink-panel" aria-label="Origin backlink">
      <div className="backlink-header">
        <h2>Origin backlink</h2>
        <span>source context</span>
      </div>
      <strong>{backlink.label}</strong>
      {backlink.excerpt ? <p>{backlink.excerpt}</p> : null}
      <button className="backlink-focus-action" onClick={() => onBacklinkFocus(backlink)} type="button">
        Focus origin
      </button>
    </div>
  );
}

function SourceReadinessPanel({ scene }: { scene: TerrainScene }): ReactElement {
  const nodeCounts = getSourceStateCounts(scene.nodes);
  const sourceBackedCount = nodeCounts.source_backed ?? 0;
  const generatedCount = (nodeCounts.generated ?? 0) + (nodeCounts.agent_inferred ?? 0) + (nodeCounts.weak_hypothesis ?? 0);

  return (
    <div className="source-readiness-panel" aria-label="Source readiness">
      <div className="source-readiness-header">
        <h2>Source readiness</h2>
        <span>{scene.sources.length === 0 ? "local only" : `${scene.sources.length} sources`}</span>
      </div>
      <p>
        {sourceBackedCount > 0
          ? "Some terrain is source-backed. Generated and inferred nodes remain visually marked."
          : "This map is local-only terrain. No factual node is presented as source-backed yet."}
      </p>
      <dl className="source-state-list">
        {(["source_backed", "generated", "agent_inferred", "weak_hypothesis", "fog"] satisfies SourceState[]).map((state) => (
          <div key={state}>
            <dt>{formatSourceState(state)}</dt>
            <dd>{nodeCounts[state] ?? 0}</dd>
          </div>
        ))}
      </dl>
      <div className="source-readiness-note">
        <span>{generatedCount} generated or inferred nodes</span>
        <span>{scene.relations.length} typed relations</span>
      </div>
    </div>
  );
}

function SelectedNodePanel({
  node,
  onNodeSelect,
  onScoutSourceLinks,
  onLayerSelect,
  onSaveSelectionToTray,
  onUseNodeAsSeed,
  scene,
}: {
  node: TerrainNode;
  onNodeSelect: (nodeId: string) => void;
  onScoutSourceLinks: (node: TerrainNode, source: SourceRef) => void;
  onLayerSelect: (layer: LayerId, focusNodeId?: string) => void;
  onSaveSelectionToTray: () => void;
  onUseNodeAsSeed: (node: TerrainNode) => void;
  scene: TerrainScene;
}): ReactElement {
  const source = getSourceForNode(scene, node);
  const currentLayer = scene.layers.find((layer) => layer.id === scene.viewport.layer);
  const parentLayerId = currentLayer?.parent_layer_id;
  const zoomTarget = node.zoom_target;
  const sourceRelations = getSourceRelationsForNode(scene, node);
  const scoutObservation = source?.created_from_observation_id
    ? scene.scout_observations?.find((observation) => observation.id === source.created_from_observation_id)
    : undefined;
  const sourceChildren =
    node.type === "source"
      ? scene.nodes.filter((candidate) => candidate.parent_id === node.id || sourceRelations.some((relation) => relation.to === candidate.id))
      : [];

  return (
    <section className="inspect-section">
      <h1>{node.title}</h1>
      <p>{node.summary}</p>
      <dl className="metric-list">
        <div>
          <dt>Type</dt>
          <dd>{node.type.replace("_", " ")}</dd>
        </div>
        <div>
          <dt>Layer</dt>
          <dd>{node.layer}</dd>
        </div>
        <div>
          <dt>State</dt>
          <dd>{node.source_state.replace("_", " ")}</dd>
        </div>
        <div>
          <dt>Confidence</dt>
          <dd>{Math.round(node.confidence * 100)}%</dd>
        </div>
      </dl>
      <div className="tag-list" aria-label="Node tags">
        {node.tags.map((tag) => (
          <span key={tag}>{tag}</span>
        ))}
      </div>
      {source ? (
        <SourceEvidenceCard
          node={node}
          onNodeSelect={onNodeSelect}
          onScoutSourceLinks={onScoutSourceLinks}
          onUseNodeAsSeed={onUseNodeAsSeed}
          relations={sourceRelations}
          scoutObservation={scoutObservation}
          source={source}
          sourceChildren={sourceChildren}
        />
      ) : null}
      {zoomTarget ? (
        <button className="inspect-action" onClick={() => onLayerSelect(zoomTarget.layer, zoomTarget.node_id)} type="button">
          Zoom in to {zoomTarget.layer}
        </button>
      ) : null}
      {parentLayerId ? (
        <button className="inspect-action" onClick={() => onLayerSelect(parentLayerId)} type="button">
          Zoom out to {parentLayerId}
        </button>
      ) : null}
      {node.can_create_seed ? (
        <button className="inspect-action" onClick={() => onUseNodeAsSeed(node)} type="button">
          Create new seed from this
        </button>
      ) : null}
      <button className="inspect-action" onClick={onSaveSelectionToTray} type="button">
        Save to side tray
      </button>
    </section>
  );
}

function SourceEvidenceCard({
  node,
  onNodeSelect,
  onScoutSourceLinks,
  onUseNodeAsSeed,
  relations,
  scoutObservation,
  source,
  sourceChildren,
}: {
  node: TerrainNode;
  onNodeSelect: (nodeId: string) => void;
  onScoutSourceLinks: (node: TerrainNode, source: SourceRef) => void;
  onUseNodeAsSeed: (node: TerrainNode) => void;
  relations: TerrainRelation[];
  scoutObservation?: ScoutObservation;
  source: SourceRef;
  sourceChildren: TerrainNode[];
}): ReactElement {
  return (
    <div className="source-evidence-card" aria-label="Source evidence">
      <div className="source-evidence-header">
        <h2>Source evidence</h2>
        <span>{source.source_type}</span>
      </div>
      <dl className="source-evidence-meta">
        <div>
          <dt>State</dt>
          <dd>{formatSourceState(node.source_state)}</dd>
        </div>
        <div>
          <dt>Retrieved</dt>
          <dd>{source.retrieved_at ? formatTimestamp(source.retrieved_at) : "manual"}</dd>
        </div>
      </dl>
      {source.url ? <p className="source-url">{source.url}</p> : null}
      {scoutObservation ? (
        <div className="source-origin-card" aria-label="Scout observation origin">
          <div className="source-origin-card-header">
            <h3>Scout origin</h3>
            <span>{scoutObservation.status.replace("_", " ")}</span>
          </div>
          <strong>{scoutObservation.title}</strong>
          <small>{scoutObservation.query}</small>
          <small>{scoutObservation.adapter ?? "local"} adapter</small>
          {scoutObservation.retrieved_at ? <small>Observed {formatTimestamp(scoutObservation.retrieved_at)}</small> : null}
        </div>
      ) : null}
      {node.quote ? (
        <blockquote>{node.quote}</blockquote>
      ) : source.snippet ? (
        <blockquote>{source.snippet}</blockquote>
      ) : null}
      {source.reliability_hints.length > 0 ? (
        <div className="source-reliability-list" aria-label="Reliability hints">
          {source.reliability_hints.map((hint) => (
            <span key={hint}>{hint}</span>
          ))}
        </div>
      ) : null}
      {relations.length > 0 ? (
        <div className="source-relation-list">
          <h3>Evidence relations</h3>
          {relations.map((relation) => (
            <span key={relation.id}>
              {relation.type.replace(/_/g, " ")} · {Math.round(relation.confidence * 100)}%
            </span>
          ))}
        </div>
      ) : null}
      {sourceChildren.length > 0 ? (
        <div className="source-excerpt-list">
          <h3>Mapped excerpts</h3>
          {sourceChildren.map((child) => (
            <button key={child.id} onClick={() => onNodeSelect(child.id)} type="button">
              <strong>{child.title}</strong>
              <span>{child.layer}</span>
            </button>
          ))}
        </div>
      ) : null}
      <button className="source-seed-action" onClick={() => onUseNodeAsSeed(node)} type="button">
        Use as new exploration seed
      </button>
      {source.url && node.source_state === "source_backed" ? (
        <button className="source-seed-action" onClick={() => onScoutSourceLinks(node, source)} type="button">
          Scout linked frontier
        </button>
      ) : null}
    </div>
  );
}

function SelectedRelationPanel({
  fromNode,
  relation,
  toNode,
}: {
  fromNode?: TerrainNode;
  relation: TerrainRelation;
  toNode?: TerrainNode;
}): ReactElement {
  return (
    <section className="inspect-section relation-inspect-panel">
      <h1>{relation.type.replace("_", " ")}</h1>
      <p>{relation.explanation}</p>
      <div className="relation-node-pair" aria-label="Relation endpoints">
        <span>{fromNode?.title ?? relation.from}</span>
        <span aria-hidden="true">{"->"}</span>
        <span>{toNode?.title ?? relation.to}</span>
      </div>
      <dl className="metric-list">
        <div>
          <dt>State</dt>
          <dd>{relation.source_state.replace("_", " ")}</dd>
        </div>
        <div>
          <dt>Confidence</dt>
          <dd>{Math.round(relation.confidence * 100)}%</dd>
        </div>
        <div>
          <dt>From layer</dt>
          <dd>{fromNode?.layer ?? "Unknown"}</dd>
        </div>
        <div>
          <dt>To layer</dt>
          <dd>{toNode?.layer ?? "Unknown"}</dd>
        </div>
      </dl>
      <div className="tag-list" aria-label="Relation state tags">
        <span>{relation.source_state.replace("_", " ")}</span>
        <span>{relation.type.replace("_", " ")}</span>
      </div>
    </section>
  );
}

function SelectionRegionPanel({
  nodes,
  onSaveSelectionToTray,
}: {
  nodes: TerrainNode[];
  onSaveSelectionToTray: () => void;
}): ReactElement {
  const fogCount = nodes.filter((node) => node.type === "fog_region").length;
  const generatedCount = nodes.filter((node) => node.source_state !== "source_backed").length;

  return (
    <section className="inspect-section">
      <h1>Selected region</h1>
      <p>This local spatial selection can become a future explain, compare, seed, or export context.</p>
      <dl className="metric-list">
        <div>
          <dt>Nodes</dt>
          <dd>{nodes.length}</dd>
        </div>
        <div>
          <dt>Fog</dt>
          <dd>{fogCount}</dd>
        </div>
        <div>
          <dt>Local / inferred</dt>
          <dd>{generatedCount}</dd>
        </div>
      </dl>
      <div className="selection-node-list" aria-label="Selected nodes">
        {nodes.map((node) => (
          <span key={node.id}>{node.title}</span>
        ))}
      </div>
      <button className="inspect-action" onClick={onSaveSelectionToTray} type="button">
        Save region to side tray
      </button>
    </section>
  );
}

function SideTrayPanel({
  items,
  onClearBasket,
  onRemoveItem,
}: {
  items: SelectionBasketItem[];
  onClearBasket: () => void;
  onRemoveItem: (itemId: string) => void;
}): ReactElement {
  return (
    <section className="inspect-section side-tray-panel">
      <div className="side-tray-header">
        <h2>Side tray</h2>
        {items.length > 0 ? (
          <button onClick={onClearBasket} type="button">
            Clear
          </button>
        ) : null}
      </div>
      {items.length === 0 ? (
        <p>Save selected nodes or lassoed regions here as local selection context.</p>
      ) : (
        <div className="side-tray-list">
          {items.map((item) => (
            <article className="side-tray-item" key={item.id}>
              <div className="side-tray-item-body">
                <div>
                  <strong>{item.title}</strong>
                  <small>
                    {item.nodeIds.length} nodes - {item.sourceStates.join(", ")}
                  </small>
                </div>
              </div>
              <button aria-label={`Remove ${item.title}`} onClick={() => onRemoveItem(item.id)} type="button">
                x
              </button>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function StatusStrip({
  layer,
  layerLabel,
  nodeCount,
  persistenceStatus,
  selectedCount,
  sourceCount,
  visibleNodeCount,
  jobState,
}: {
  layer: LayerId;
  layerLabel: string;
  nodeCount: number;
  persistenceStatus: PersistenceStatus;
  selectedCount: number;
  sourceCount: number;
  visibleNodeCount: number;
  jobState: string;
}): ReactElement {
  return (
    <footer className="status-strip">
      <span>
        {layer} - {layerLabel}
      </span>
      <span>
        {visibleNodeCount}/{nodeCount} nodes
      </span>
      <span>{selectedCount} selected</span>
      <span>{sourceCount} sources</span>
      <span>{formatPersistenceStatus(persistenceStatus)}</span>
      <span>{jobState}</span>
    </footer>
  );
}
