import type {
  AgentJobStatus,
  ExplorationTab,
  LayerId,
  SourceState,
  SourceRef,
  TerrainNode,
  TerrainRelation,
  TerrainScene,
} from "@seekstar/core-schema";
import type { ChangeEvent, FormEvent, KeyboardEvent, ReactElement, RefObject } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Brush,
  Circle,
  Compass,
  Hand,
  Lasso,
  MousePointer2,
  Plus,
  Search,
  Settings,
  Sparkles,
  X,
  type LucideIcon,
} from "lucide-react";
import { CommandActionCard } from "./components/CommandActionCard";
import { SearchResultsPanel } from "./components/SearchResultsPanel";
import { SidebarToggleButton } from "./components/SidebarToggleButton";
import { TitleBarMenus, type AppMenuId } from "./components/TitleBarMenus";
import { TerrainCanvas } from "./components/TerrainCanvas";
import type { CanvasTool } from "./canvas/interaction";
import { createMockSeedScene } from "./fixtures/mockSceneFactory";
import { openingSkyScene } from "./fixtures/openingSkyScene";
import { goBack, goForward } from "./platform/windowApi";
import { type SearchResult, searchScene } from "./search/localSceneSearch";
import {
  type MockRegionActionKind,
  type MockRegionActionResult,
  createMockRegionActionResult,
} from "./selection/mockRegionActions";
import { type SelectionBasketItem, createSelectionBasketItem } from "./selection/selectionBasket";
import { type SourceIngestionInput, createSourceTerrainPatch } from "./sources/sourceTerrainAdapter";

const favoriteSeeds = ["Cognitive maps", "Source trails", "Unknown unknowns"];
const canvasTools: Array<{ id: CanvasTool; label: string; icon: LucideIcon; disabled?: boolean }> = [
  { id: "pointer", label: "Pointer", icon: MousePointer2 },
  { id: "pan", label: "Pan", icon: Hand },
  { id: "lasso", label: "Lasso", icon: Lasso },
  { id: "brush", label: "Brush", icon: Brush, disabled: true },
];

interface WorkspaceSnapshot {
  version: 1;
  active_tab_id: string;
  scenes_by_tab_id: Record<string, TerrainScene>;
  basket_by_tab_id: Record<string, SelectionBasketItem[]>;
  mock_action_results_by_tab_id: Record<string, MockRegionActionResult[]>;
  updated_at: string;
}

type PersistenceStatus = "loading" | "saved" | "saving" | "unsaved" | "unavailable" | "error";

export function App(): ReactElement {
  const initialTabId = openingSkyScene.active_tab_id;
  const [scenesByTabId, setScenesByTabId] = useState<Record<string, TerrainScene>>({
    [initialTabId]: openingSkyScene,
  });
  const [activeTabId, setActiveTabId] = useState(initialTabId);
  const [commandValue, setCommandValue] = useState("");
  const [isCommandModalOpen, setIsCommandModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);
  const [selectedRelationId, setSelectedRelationId] = useState<string | undefined>();
  const [viewportFocusNodeId, setViewportFocusNodeId] = useState<string | undefined>();
  const [leftSidebarCollapsed, setLeftSidebarCollapsed] = useState(false);
  const [rightSidebarCollapsed, setRightSidebarCollapsed] = useState(false);
  const [splashVisible, setSplashVisible] = useState(true);
  const [splashFading, setSplashFading] = useState(false);
  const [activeCanvasTool, setActiveCanvasTool] = useState<CanvasTool>("pointer");
  const [basketByTabId, setBasketByTabId] = useState<Record<string, SelectionBasketItem[]>>({});
  const [mockActionResultsByTabId, setMockActionResultsByTabId] = useState<Record<string, MockRegionActionResult[]>>({});
  const [isSelectionActionCardOpen, setIsSelectionActionCardOpen] = useState(false);
  const [persistenceStatus, setPersistenceStatus] = useState<PersistenceStatus>("loading");
  const [workspaceHydrated, setWorkspaceHydrated] = useState(false);
  const commandInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadWorkspaceSnapshot(): Promise<void> {
      try {
        const snapshot = await window.seekstar.workspace.loadSnapshot();

        if (cancelled) {
          return;
        }

        if (isWorkspaceSnapshot(snapshot)) {
          const nextActiveTabId = snapshot.scenes_by_tab_id[snapshot.active_tab_id]
            ? snapshot.active_tab_id
            : Object.keys(snapshot.scenes_by_tab_id)[0] ?? initialTabId;
          const nextScene = snapshot.scenes_by_tab_id[nextActiveTabId];

          setScenesByTabId(snapshot.scenes_by_tab_id);
          setActiveTabId(nextActiveTabId);
          setBasketByTabId(snapshot.basket_by_tab_id);
          setMockActionResultsByTabId(snapshot.mock_action_results_by_tab_id);
          setSelectedNodeIds(nextScene?.selection.node_ids ?? []);
          setViewportFocusNodeId(nextScene?.selection.node_ids[0]);
        }

        setPersistenceStatus("saved");
      } catch {
        setPersistenceStatus("error");
      } finally {
        if (!cancelled) {
          setWorkspaceHydrated(true);
        }
      }
    }

    void loadWorkspaceSnapshot();

    return () => {
      cancelled = true;
    };
  }, [initialTabId]);

  useEffect(() => {
    if (!workspaceHydrated) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      const snapshot: WorkspaceSnapshot = {
        version: 1,
        active_tab_id: activeTabId,
        scenes_by_tab_id: scenesByTabId,
        basket_by_tab_id: basketByTabId,
        mock_action_results_by_tab_id: mockActionResultsByTabId,
        updated_at: new Date().toISOString(),
      };

      setPersistenceStatus("saving");
      void window.seekstar.workspace
        .saveSnapshot(snapshot)
        .then(() => {
          setPersistenceStatus("saved");
        })
        .catch(() => {
          setPersistenceStatus("error");
        });
    }, 650);

    setPersistenceStatus("unsaved");

    return () => {
      clearTimeout(timeoutId);
    };
  }, [activeTabId, basketByTabId, mockActionResultsByTabId, scenesByTabId, workspaceHydrated]);

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

  const scene = scenesByTabId[activeTabId] ?? openingSkyScene;
  const activeTab = getActiveTab(scene);
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
  const activeMockActionResults = mockActionResultsByTabId[activeTabId] ?? [];
  const jobState = getAgentJobState(scene.agent_jobs.map((job) => job.status));

  function syncSceneSelection(nodeIds: string[], focusNodeId?: string, showSelectionActions = false): void {
    const focusNode = focusNodeId ? scene.nodes.find((node) => node.id === focusNodeId) : undefined;
    const nextViewport = {
      ...scene.viewport,
      x: focusNode?.position_hint?.x ?? scene.viewport.x,
      y: focusNode?.position_hint?.y ?? scene.viewport.y,
    };

    setSelectedNodeIds(nodeIds);
    setSelectedRelationId(undefined);
    setViewportFocusNodeId(focusNodeId);
    setIsSelectionActionCardOpen(nodeIds.length > 0 && showSelectionActions);
    setScenesByTabId((current) => ({
      ...current,
      [activeTabId]: {
        ...scene,
        selection: {
          ...scene.selection,
          node_ids: nodeIds,
        },
        viewport: nextViewport,
        tabs: scene.tabs.map((tab) =>
          tab.id === scene.active_tab_id
            ? {
                ...tab,
                viewport: nextViewport,
              }
            : tab,
        ),
      },
    }));
  }

  function syncSceneViewport(viewport: TerrainScene["viewport"]): void {
    setScenesByTabId((current) => ({
      ...current,
      [activeTabId]: {
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
      },
    }));
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
    }
  }

  function handleUseAsSeed(): void {
    const seed = commandValue.trim();

    if (!seed) {
      return;
    }

    const nextScene = createMockSeedScene(seed);
    const nextTabId = nextScene.active_tab_id;
    setScenesByTabId((current) => ({
      ...current,
      [nextTabId]: nextScene,
    }));
    setActiveTabId(nextTabId);
    setCommandValue("");
    setIsCommandModalOpen(false);
    setSearchQuery("");
    setSearchResults([]);
    setSelectedNodeIds([]);
    setSelectedRelationId(undefined);
    setViewportFocusNodeId(undefined);
    setIsSelectionActionCardOpen(false);
  }

  function handleSearchCurrentTab(): void {
    const query = commandValue.trim();
    const results = searchScene(scene, query);
    setSearchQuery(query);
    setSearchResults(results);
    setSelectedRelationId(undefined);
    setIsSelectionActionCardOpen(false);
    setIsCommandModalOpen(false);
    setCommandValue("");
    setRightSidebarCollapsed(false);
  }

  function handleNodeSelect(nodeId: string): void {
    syncSceneSelection([nodeId], nodeId);
    setRightSidebarCollapsed(false);
  }

  function handleRelationSelect(relationId: string): void {
    const relation = scene.relations.find((candidate) => candidate.id === relationId);

    if (!relation) {
      return;
    }

    setSelectedNodeIds([]);
    setSelectedRelationId(relationId);
    setViewportFocusNodeId(undefined);
    setIsSelectionActionCardOpen(false);
    setScenesByTabId((current) => ({
      ...current,
      [activeTabId]: {
        ...scene,
        selection: {
          ...scene.selection,
          node_ids: [],
        },
      },
    }));
    setRightSidebarCollapsed(false);
  }

  function handleSearchResultSelect(nodeId: string): void {
    syncSceneSelection([nodeId], nodeId);
    setRightSidebarCollapsed(false);
  }

  function handleTabSelect(tabId: string): void {
    const nextScene = scenesByTabId[tabId];

    if (!nextScene) {
      return;
    }

    setActiveTabId(tabId);
    setCommandValue("");
    setIsCommandModalOpen(false);
    setSearchQuery("");
    setSearchResults([]);
    setSelectedNodeIds(nextScene.selection.node_ids);
    setSelectedRelationId(undefined);
    setViewportFocusNodeId(nextScene.selection.node_ids[0]);
    setIsSelectionActionCardOpen(false);
  }

  function handleBacklinkFocus(backlink: NonNullable<ExplorationTab["parent_backlink"]>): void {
    const originScene = scenesByTabId[backlink.tab_id];
    const originNode = backlink.node_id ? originScene?.nodes.find((node) => node.id === backlink.node_id) : undefined;

    if (!originScene) {
      return;
    }

    const nextViewport =
      originNode?.position_hint
        ? {
            ...originScene.viewport,
            x: originNode.position_hint.x,
            y: originNode.position_hint.y,
            layer: originNode.layer,
            zoom: Math.max(originScene.viewport.zoom, 1.35),
          }
        : originScene.viewport;

    setScenesByTabId((current) => ({
      ...current,
      [backlink.tab_id]: {
        ...originScene,
        selection: {
          ...originScene.selection,
          node_ids: originNode ? [originNode.id] : originScene.selection.node_ids,
        },
        viewport: nextViewport,
        tabs: originScene.tabs.map((tab) =>
          tab.id === originScene.active_tab_id
            ? {
                ...tab,
                current_layer: nextViewport.layer,
                viewport: nextViewport,
              }
            : tab,
        ),
      },
    }));
    setActiveTabId(backlink.tab_id);
    setCommandValue("");
    setIsCommandModalOpen(false);
    setSearchQuery("");
    setSearchResults([]);
    setSelectedNodeIds(originNode ? [originNode.id] : originScene.selection.node_ids);
    setSelectedRelationId(undefined);
    setViewportFocusNodeId(originNode?.id);
    setIsSelectionActionCardOpen(false);
    setRightSidebarCollapsed(false);
  }

  function handleFocusCommand(): void {
    commandInputRef.current?.focus();
    setIsCommandModalOpen(commandValue.trim().length > 0);
  }

  function handleClearSelection(): void {
    syncSceneSelection([]);
    setSelectedRelationId(undefined);
    setSearchQuery("");
    setSearchResults([]);
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

  function handleRunBasketAction(item: SelectionBasketItem, kind: MockRegionActionKind): void {
    const result = createMockRegionActionResult(item, kind);

    setMockActionResultsByTabId((current) => ({
      ...current,
      [activeTabId]: [result, ...(current[activeTabId] ?? [])],
    }));
    setRightSidebarCollapsed(false);
  }

  function handleRunSelectionAction(kind: MockRegionActionKind): void {
    const item = createActiveSelectionBasketItem();

    if (!item) {
      return;
    }

    const result = createMockRegionActionResult(item, kind);

    setMockActionResultsByTabId((current) => ({
      ...current,
      [activeTabId]: [result, ...(current[activeTabId] ?? [])],
    }));
    setRightSidebarCollapsed(false);
    setIsSelectionActionCardOpen(false);
  }

  function handleUseSelectionAsSeed(): void {
    if (selectedNodes.length === 0) {
      return;
    }

    const seedTitle =
      selectedNodes.length === 1
        ? selectedNodes[0].title
        : `${selectedNodes[0].title} + ${selectedNodes.length - 1} nearby`;
    const nextScene = createMockSeedScene(seedTitle);
    const nextTabId = nextScene.active_tab_id;

    setScenesByTabId((current) => ({
      ...current,
      [nextTabId]: nextScene,
    }));
    setActiveTabId(nextTabId);
    setCommandValue("");
    setIsCommandModalOpen(false);
    setSearchQuery("");
    setSearchResults([]);
    setSelectedNodeIds([]);
    setSelectedRelationId(undefined);
    setViewportFocusNodeId(undefined);
    setIsSelectionActionCardOpen(false);
  }

  function handleUseNodeAsSeed(node: TerrainNode): void {
    const source = getSourceForNode(scene, node);
    const seedTitle = node.title.trim() || source?.title || "Source-backed seed";
    const excerpt = node.quote ?? node.summary ?? source?.snippet;
    const nextScene = createMockSeedScene(seedTitle, {
      sourceMode: "selection",
      parentBacklink: {
        tab_id: activeTabId,
        node_id: node.id,
        source_id: source?.id ?? node.source_id,
        label: source ? `Source: ${source.title}` : `Node: ${node.title}`,
        excerpt,
      },
    });
    const nextTabId = nextScene.active_tab_id;

    setScenesByTabId((current) => ({
      ...current,
      [nextTabId]: nextScene,
    }));
    setActiveTabId(nextTabId);
    setCommandValue("");
    setIsCommandModalOpen(false);
    setSearchQuery("");
    setSearchResults([]);
    setSelectedNodeIds([]);
    setSelectedRelationId(undefined);
    setViewportFocusNodeId(undefined);
    setIsSelectionActionCardOpen(false);
  }

  function handleAddSource(input: SourceIngestionInput): void {
    const patch = createSourceTerrainPatch(input, scene);
    const sourceNode = patch.nodes[0];
    const nextViewport = sourceNode.position_hint
      ? {
          ...scene.viewport,
          x: sourceNode.position_hint.x,
          y: sourceNode.position_hint.y,
          layer: "L2",
          zoom: Math.max(scene.viewport.zoom, 1.35),
        }
      : scene.viewport;

    setScenesByTabId((current) => ({
      ...current,
      [activeTabId]: {
        ...scene,
        sources: [...scene.sources, patch.source],
        nodes: [...scene.nodes, ...patch.nodes],
        relations: [...scene.relations, ...patch.relations],
        viewport: nextViewport,
        tabs: scene.tabs.map((tab) =>
          tab.id === scene.active_tab_id
            ? {
                ...tab,
                current_layer: nextViewport.layer,
                node_ids: [...tab.node_ids, ...patch.nodes.map((node) => node.id)],
                relation_ids: [...tab.relation_ids, ...patch.relations.map((relation) => relation.id)],
                source_ids: [...tab.source_ids, patch.source.id],
                updated_at: patch.nodes[0].updated_at,
                viewport: nextViewport,
              }
            : tab,
        ),
        metadata: {
          ...scene.metadata,
          updated_at: patch.nodes[0].updated_at,
        },
      },
    }));
    setSelectedNodeIds([sourceNode.id]);
    setSelectedRelationId(undefined);
    setViewportFocusNodeId(sourceNode.id);
    setSearchQuery("");
    setSearchResults([]);
    setIsSelectionActionCardOpen(false);
    setRightSidebarCollapsed(false);
  }

  return (
    <main className="app-shell">
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

      <WindowTitleBar
        leftSidebarExpanded={!leftSidebarCollapsed}
        onToggleLeftSidebar={() => setLeftSidebarCollapsed((current) => !current)}
      />
      <div className="desktop-shell">
        <SidebarRail collapsed={leftSidebarCollapsed} label="Observatory" side="left">
          <ObservatorySidebar
            activeTabId={activeTabId}
            activeTool={activeCanvasTool}
            onFocusCommand={handleFocusCommand}
            onToolSelect={setActiveCanvasTool}
            onTabSelect={handleTabSelect}
            scenes={Object.values(scenesByTabId)}
          />
        </SidebarRail>

        <section className="main-workbench">
          <div className="workbench-body">
            <WorkbenchHeader
              activeTab={activeTab}
              jobState={jobState}
              layer={scene.viewport.layer}
              layerLabel={activeLayerLabel}
              onToggleRightSidebar={() => setRightSidebarCollapsed((current) => !current)}
              rightSidebarExpanded={!rightSidebarCollapsed}
            />
            <div className="workbench-canvas-wrap">
              <TerrainCanvas
                activeTool={activeCanvasTool}
                focusedNodeId={viewportFocusNodeId}
                highlightedNodeIds={highlightedNodeIds}
                onNodeSelect={handleNodeSelect}
                onRelationSelect={handleRelationSelect}
                onSelectionChange={syncSceneSelection}
                onViewportChange={syncSceneViewport}
                scene={scene}
                selectedNodeIds={selectedNodeIds}
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
                  onRunAction={handleRunSelectionAction}
                  onSaveSelection={handleSaveSelectionToTray}
                  onUseAsSeed={handleUseSelectionAsSeed}
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
            onSearchCurrentTab={handleSearchCurrentTab}
            onUseAsSeed={handleUseAsSeed}
          />
          <StatusStrip
            jobState={jobState}
            layer={scene.viewport.layer}
            layerLabel={activeLayerLabel}
            nodeCount={scene.nodes.length}
            persistenceStatus={persistenceStatus}
            selectedCount={selectedNodeIds.length}
            sourceCount={scene.sources.length}
          />
        </section>

        <SidebarRail collapsed={rightSidebarCollapsed} label="Inspector" side="right">
          <InspectorSidebar
            activeTab={activeTab}
            basketItems={activeBasketItems}
            mockActionResults={activeMockActionResults}
            onAddSource={handleAddSource}
            onClearBasket={handleClearBasket}
            onClearSelection={handleClearSelection}
            onRemoveBasketItem={handleRemoveBasketItem}
            onRunBasketAction={handleRunBasketAction}
            onSaveSelectionToTray={handleSaveSelectionToTray}
            onBacklinkFocus={handleBacklinkFocus}
            onSearchResultSelect={handleSearchResultSelect}
            onUseNodeAsSeed={handleUseNodeAsSeed}
            scene={scene}
            searchQuery={searchQuery}
            searchResults={searchResults}
            selectedNode={selectedNode}
            selectedNodes={selectedNodes}
            selectedRelation={selectedRelation}
            selectedRelationNodes={selectedRelationNodes}
          />
        </SidebarRail>
      </div>
    </main>
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
  onFocusCommand,
  onToolSelect,
  onTabSelect,
  scenes,
}: {
  activeTool: CanvasTool;
  activeTabId: string;
  onFocusCommand: () => void;
  onToolSelect: (tool: CanvasTool) => void;
  onTabSelect: (tabId: string) => void;
  scenes: TerrainScene[];
}): ReactElement {
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
            const isActive = tab.id === activeTabId;

            return (
              <button
                className={isActive ? "exploration-tab active" : "exploration-tab"}
                key={tab.id}
                onClick={() => onTabSelect(tab.id)}
                type="button"
              >
                <span className="exploration-tab-icon" aria-hidden="true">
                  <Circle size={12} strokeWidth={2} />
                </span>
                <span className="exploration-tab-label">{tab.title}</span>
                {isActive ? (
                  <span aria-hidden="true" className="exploration-tab-close">
                    <X size={12} strokeWidth={2} />
                  </span>
                ) : null}
              </button>
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

      <button className="sidebar-settings" type="button">
        <span className="sidebar-icon">
          <Settings aria-hidden="true" size={15} strokeWidth={1.8} />
        </span>
        Settings
      </button>
    </div>
  );
}

function WorkbenchHeader({
  activeTab,
  jobState,
  layer,
  layerLabel,
  onToggleRightSidebar,
  rightSidebarExpanded,
}: {
  activeTab: ExplorationTab;
  jobState: string;
  layer: LayerId;
  layerLabel: string;
  onToggleRightSidebar: () => void;
  rightSidebarExpanded: boolean;
}): ReactElement {
  return (
    <header className="workbench-header">
      <div className="workbench-context">
        <span className="workbench-context-label">{activeTab.seed}</span>
        <span className="workbench-context-meta">
          {layer} - {layerLabel}
        </span>
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
  onCommandChange,
  onCommandFocus,
  onCommandKeyDown,
  onSearchCurrentTab,
  onUseAsSeed,
}: {
  commandInputRef: RefObject<HTMLInputElement | null>;
  commandValue: string;
  isCommandModalOpen: boolean;
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
          <CommandActionCard value={commandValue.trim()} onSearchCurrentTab={onSearchCurrentTab} onUseAsSeed={onUseAsSeed} />
        ) : null}
        <label className="command-bar" aria-label="Command input">
          <button aria-label="Add context" className="command-bar-addon" type="button">
            +
          </button>
          <input
            onChange={onCommandChange}
            onFocus={onCommandFocus}
            onKeyDown={onCommandKeyDown}
            placeholder="Enter a direction, word, or search this map"
            ref={commandInputRef}
            type="text"
            value={commandValue}
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
  onRunAction,
  onSaveSelection,
  onUseAsSeed,
}: {
  nodeCount: number;
  onDismiss: () => void;
  onRunAction: (kind: MockRegionActionKind) => void;
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
        <button onClick={() => onRunAction("explain")} type="button">
          Mock explain
        </button>
        <button onClick={() => onRunAction("compare")} type="button">
          Mock compare
        </button>
        <button onClick={() => onRunAction("export")} type="button">
          Mock export
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
  mockActionResults,
  onBacklinkFocus,
  onAddSource,
  onClearBasket,
  onClearSelection,
  onRemoveBasketItem,
  onRunBasketAction,
  onSaveSelectionToTray,
  onSearchResultSelect,
  onUseNodeAsSeed,
  scene,
  searchQuery,
  searchResults,
  selectedNode,
  selectedNodes,
  selectedRelation,
  selectedRelationNodes,
}: {
  activeTab: ExplorationTab;
  basketItems: SelectionBasketItem[];
  mockActionResults: MockRegionActionResult[];
  onBacklinkFocus: (backlink: NonNullable<ExplorationTab["parent_backlink"]>) => void;
  onAddSource: (input: SourceIngestionInput) => void;
  onClearBasket: () => void;
  onClearSelection: () => void;
  onRemoveBasketItem: (itemId: string) => void;
  onRunBasketAction: (item: SelectionBasketItem, kind: MockRegionActionKind) => void;
  onSaveSelectionToTray: () => void;
  onSearchResultSelect: (nodeId: string) => void;
  onUseNodeAsSeed: (node: TerrainNode) => void;
  scene: TerrainScene;
  searchQuery: string;
  searchResults: SearchResult[];
  selectedNode?: TerrainNode;
  selectedNodes: TerrainNode[];
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
            onSaveSelectionToTray={onSaveSelectionToTray}
            onUseNodeAsSeed={onUseNodeAsSeed}
            scene={scene}
          />
        ) : (
          <SceneOverviewPanel activeTab={activeTab} fogCount={fogCount} onBacklinkFocus={onBacklinkFocus} scene={scene} />
        )}
        <SearchResultsPanel query={searchQuery} results={searchResults} onResultSelect={onSearchResultSelect} />
        <SourceIngestionPanel onAddSource={onAddSource} />
        <SideTrayPanel
          items={basketItems}
          onClearBasket={onClearBasket}
          onRemoveItem={onRemoveBasketItem}
          onRunAction={onRunBasketAction}
        />
        <MockRegionOutputPanel results={mockActionResults} />
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

function SceneOverviewPanel({
  activeTab,
  fogCount,
  onBacklinkFocus,
  scene,
}: {
  activeTab: ExplorationTab;
  fogCount: number;
  onBacklinkFocus: (backlink: NonNullable<ExplorationTab["parent_backlink"]>) => void;
  scene: TerrainScene;
}): ReactElement {
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
      {activeTab.parent_backlink ? <BacklinkPanel backlink={activeTab.parent_backlink} onBacklinkFocus={onBacklinkFocus} /> : null}
      <SourceReadinessPanel scene={scene} />
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
        <span>{scene.sources.length === 0 ? "mock only" : `${scene.sources.length} sources`}</span>
      </div>
      <p>
        {sourceBackedCount > 0
          ? "Some terrain is source-backed. Generated and inferred nodes remain visually marked."
          : "This map is source-free mock terrain. No factual node is presented as source-backed yet."}
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
  onSaveSelectionToTray,
  onUseNodeAsSeed,
  scene,
}: {
  node: TerrainNode;
  onNodeSelect: (nodeId: string) => void;
  onSaveSelectionToTray: () => void;
  onUseNodeAsSeed: (node: TerrainNode) => void;
  scene: TerrainScene;
}): ReactElement {
  const source = getSourceForNode(scene, node);
  const sourceRelations = getSourceRelationsForNode(scene, node);
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
          onUseNodeAsSeed={onUseNodeAsSeed}
          relations={sourceRelations}
          source={source}
          sourceChildren={sourceChildren}
        />
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
  onUseNodeAsSeed,
  relations,
  source,
  sourceChildren,
}: {
  node: TerrainNode;
  onNodeSelect: (nodeId: string) => void;
  onUseNodeAsSeed: (node: TerrainNode) => void;
  relations: TerrainRelation[];
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
          <dt>Mock / inferred</dt>
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
  onRunAction,
}: {
  items: SelectionBasketItem[];
  onClearBasket: () => void;
  onRemoveItem: (itemId: string) => void;
  onRunAction: (item: SelectionBasketItem, kind: MockRegionActionKind) => void;
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
        <p>Save selected nodes or lassoed regions here as local mock context.</p>
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
                <div className="side-tray-item-actions" aria-label={`Mock actions for ${item.title}`}>
                  <button onClick={() => onRunAction(item, "explain")} type="button">
                    Explain
                  </button>
                  <button onClick={() => onRunAction(item, "compare")} type="button">
                    Compare
                  </button>
                  <button onClick={() => onRunAction(item, "export")} type="button">
                    Export
                  </button>
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

function MockRegionOutputPanel({ results }: { results: MockRegionActionResult[] }): ReactElement | null {
  if (results.length === 0) {
    return null;
  }

  return (
    <section className="inspect-section mock-output-panel">
      <div className="mock-output-header">
        <h2>Cartographer notes</h2>
        <span>mock generated</span>
      </div>
      <div className="mock-output-list">
        {results.map((result) => (
          <article className="mock-output-item" key={result.id}>
            <div className="mock-output-meta">
              <span>{result.kind}</span>
              <span>{result.nodeCount} nodes</span>
              <span>{result.sourceState.replace("_", " ")}</span>
            </div>
            <h3>{result.title}</h3>
            <p>{result.body}</p>
          </article>
        ))}
      </div>
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
  jobState,
}: {
  layer: LayerId;
  layerLabel: string;
  nodeCount: number;
  persistenceStatus: PersistenceStatus;
  selectedCount: number;
  sourceCount: number;
  jobState: string;
}): ReactElement {
  return (
    <footer className="status-strip">
      <span>
        {layer} - {layerLabel}
      </span>
      <span>{nodeCount} nodes</span>
      <span>{selectedCount} selected</span>
      <span>{sourceCount} sources</span>
      <span>{formatPersistenceStatus(persistenceStatus)}</span>
      <span>{jobState}</span>
    </footer>
  );
}

function getActiveTab(scene: TerrainScene): ExplorationTab {
  return scene.tabs.find((tab) => tab.id === scene.active_tab_id) ?? scene.tabs[0];
}

function getActiveLayerLabel(scene: TerrainScene): string {
  return scene.layers.find((layer) => layer.id === scene.viewport.layer)?.label ?? scene.viewport.layer;
}

function getRelationNodes(scene: TerrainScene, relation: TerrainRelation): { from?: TerrainNode; to?: TerrainNode } {
  return {
    from: scene.nodes.find((node) => node.id === relation.from),
    to: scene.nodes.find((node) => node.id === relation.to),
  };
}

function getSourceForNode(scene: TerrainScene, node: TerrainNode): SourceRef | undefined {
  if (node.source_id) {
    return scene.sources.find((source) => source.id === node.source_id);
  }

  return scene.sources.find((source) => {
    if (node.source_url && source.url === node.source_url) {
      return true;
    }

    return Boolean(node.source_title && source.title === node.source_title);
  });
}

function getSourceRelationsForNode(scene: TerrainScene, node: TerrainNode): TerrainRelation[] {
  return scene.relations.filter((relation) => relation.from === node.id || relation.to === node.id);
}

function getSourceStateCounts(nodes: TerrainNode[]): Partial<Record<SourceState, number>> {
  return nodes.reduce<Partial<Record<SourceState, number>>>((counts, node) => {
    counts[node.source_state] = (counts[node.source_state] ?? 0) + 1;
    return counts;
  }, {});
}

function formatSourceState(state: SourceState): string {
  return state.replace(/_/g, " ");
}

function formatTimestamp(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString(undefined, {
    dateStyle: "short",
    timeStyle: "short",
  });
}

function formatPersistenceStatus(status: PersistenceStatus): string {
  if (status === "loading") {
    return "Loading local trail";
  }

  if (status === "saving") {
    return "Saving trail";
  }

  if (status === "saved") {
    return "Trail saved";
  }

  if (status === "error") {
    return "Trail save issue";
  }

  if (status === "unavailable") {
    return "Trail local only";
  }

  return "Unsaved changes";
}

function isWorkspaceSnapshot(value: unknown): value is WorkspaceSnapshot {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Partial<WorkspaceSnapshot>;

  return (
    candidate.version === 1 &&
    typeof candidate.active_tab_id === "string" &&
    typeof candidate.scenes_by_tab_id === "object" &&
    candidate.scenes_by_tab_id !== null &&
    typeof candidate.basket_by_tab_id === "object" &&
    candidate.basket_by_tab_id !== null &&
    typeof candidate.mock_action_results_by_tab_id === "object" &&
    candidate.mock_action_results_by_tab_id !== null
  );
}

function getAgentJobState(statuses: AgentJobStatus[]): string {
  if (statuses.length === 0) {
    return "Idle";
  }

  if (statuses.some((status) => status === "running")) {
    return "Running";
  }

  if (statuses.some((status) => status === "queued")) {
    return "Queued";
  }

  if (statuses.some((status) => status === "failed")) {
    return "Needs review";
  }

  return "Complete";
}
