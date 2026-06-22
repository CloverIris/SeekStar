import type { AgentJobStatus, ExplorationTab, LayerId, TerrainNode, TerrainScene } from "@seekstar/core-schema";
import type { ChangeEvent, KeyboardEvent, ReactElement, RefObject } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { CommandActionCard } from "./components/CommandActionCard";
import { SearchResultsPanel } from "./components/SearchResultsPanel";
import { SidebarToggleButton } from "./components/SidebarToggleButton";
import { TitleBarMenus, type AppMenuId } from "./components/TitleBarMenus";
import { TerrainCanvas } from "./components/TerrainCanvas";
import { createMockSeedScene } from "./fixtures/mockSceneFactory";
import { openingSkyScene } from "./fixtures/openingSkyScene";
import { goBack, goForward } from "./platform/windowApi";
import { type SearchResult, searchScene } from "./search/localSceneSearch";

const favoriteSeeds = ["Cognitive maps", "Source trails", "Unknown unknowns"];

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
  const [viewportFocusNodeId, setViewportFocusNodeId] = useState<string | undefined>();
  const [leftSidebarCollapsed, setLeftSidebarCollapsed] = useState(false);
  const [rightSidebarCollapsed, setRightSidebarCollapsed] = useState(false);
  const [splashVisible, setSplashVisible] = useState(true);
  const [splashFading, setSplashFading] = useState(false);
  const commandInputRef = useRef<HTMLInputElement>(null);

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
  const selectedNode = selectedNodeIds.length === 1 ? scene.nodes.find((node) => node.id === selectedNodeIds[0]) : undefined;
  const highlightedNodeIds = useMemo(() => searchResults.map((result) => result.nodeId), [searchResults]);
  const jobState = getAgentJobState(scene.agent_jobs.map((job) => job.status));

  function syncSceneSelection(nodeIds: string[], focusNodeId?: string): void {
    setSelectedNodeIds(nodeIds);
    setViewportFocusNodeId(focusNodeId);
    setScenesByTabId((current) => ({
      ...current,
      [activeTabId]: {
        ...scene,
        selection: {
          ...scene.selection,
          node_ids: nodeIds,
        },
        viewport: {
          ...scene.viewport,
          x: focusNodeId ? scene.nodes.find((node) => node.id === focusNodeId)?.position_hint?.x ?? scene.viewport.x : scene.viewport.x,
          y: focusNodeId ? scene.nodes.find((node) => node.id === focusNodeId)?.position_hint?.y ?? scene.viewport.y : scene.viewport.y,
        },
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
    setViewportFocusNodeId(undefined);
  }

  function handleSearchCurrentTab(): void {
    const query = commandValue.trim();
    const results = searchScene(scene, query);
    setSearchQuery(query);
    setSearchResults(results);
    setIsCommandModalOpen(false);
    setCommandValue("");
    setRightSidebarCollapsed(false);
  }

  function handleNodeSelect(nodeId: string): void {
    syncSceneSelection([nodeId], nodeId);
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
    setViewportFocusNodeId(nextScene.selection.node_ids[0]);
  }

  function handleFocusCommand(): void {
    commandInputRef.current?.focus();
    setIsCommandModalOpen(commandValue.trim().length > 0);
  }

  function handleClearSelection(): void {
    setSelectedNodeIds([]);
    setViewportFocusNodeId(undefined);
    setSearchQuery("");
    setSearchResults([]);
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
            onFocusCommand={handleFocusCommand}
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
                focusedNodeId={viewportFocusNodeId}
                highlightedNodeIds={highlightedNodeIds}
                onNodeSelect={handleNodeSelect}
                scene={scene}
                selectedNodeIds={selectedNodeIds}
              />
              {!selectedNode ? (
                <div className="workbench-prompt" aria-hidden="true">
                  <h1>What should we explore in {activeTab.title}?</h1>
                </div>
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
            selectedCount={selectedNodeIds.length}
            sourceCount={scene.sources.length}
          />
        </section>

        <SidebarRail collapsed={rightSidebarCollapsed} label="Inspector" side="right">
          <InspectorSidebar
            activeTab={activeTab}
            onClearSelection={handleClearSelection}
            onSearchResultSelect={handleSearchResultSelect}
            scene={scene}
            searchQuery={searchQuery}
            searchResults={searchResults}
            selectedNode={selectedNode}
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
          ‹
        </button>
        <button aria-label="Forward" onClick={goForward} type="button">
          ›
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
  activeTabId,
  onFocusCommand,
  onTabSelect,
  scenes,
}: {
  activeTabId: string;
  onFocusCommand: () => void;
  onTabSelect: (tabId: string) => void;
  scenes: TerrainScene[];
}): ReactElement {
  return (
    <div className="observatory-sidebar" aria-label="SeekStar observatory sidebar">
      <section className="sidebar-nav">
        <button className="sidebar-nav-item" onClick={onFocusCommand} type="button">
          <span className="sidebar-icon">＋</span>
          New field search
        </button>
        <button className="sidebar-nav-item" onClick={onFocusCommand} type="button">
          <span className="sidebar-icon">⌕</span>
          Search current map
        </button>
      </section>

      <section className="sidebar-section">
        <h2>Favorites</h2>
        <div className="sidebar-list">
          {favoriteSeeds.map((seed) => (
            <button className="sidebar-list-item" key={seed} onClick={onFocusCommand} type="button">
              <span className="sidebar-icon">☆</span>
              <span className="sidebar-label">{seed}</span>
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
                  ◫
                </span>
                <span className="exploration-tab-label">{tab.title}</span>
                {isActive ? (
                  <span aria-hidden="true" className="exploration-tab-close">
                    ×
                  </span>
                ) : null}
              </button>
            );
          })}
          <button className="exploration-tab-new" onClick={onFocusCommand} type="button">
            <span className="exploration-tab-icon" aria-hidden="true">
              ＋
            </span>
            <span className="exploration-tab-label">New tab</span>
          </button>
        </div>
      </section>

      <button className="sidebar-settings" type="button">
        <span className="sidebar-icon">⚙</span>
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
          {layer} · {layerLabel}
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
            ＋
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
            ↑
          </button>
        </label>
      </div>
    </div>
  );
}

function InspectorSidebar({
  activeTab,
  onClearSelection,
  onSearchResultSelect,
  scene,
  searchQuery,
  searchResults,
  selectedNode,
}: {
  activeTab: ExplorationTab;
  onClearSelection: () => void;
  onSearchResultSelect: (nodeId: string) => void;
  scene: TerrainScene;
  searchQuery: string;
  searchResults: SearchResult[];
  selectedNode?: TerrainNode;
}): ReactElement {
  const fogCount = scene.nodes.filter((node) => node.type === "fog_region").length;
  const panelTitle = selectedNode ? "Inspect" : searchQuery ? "Search" : "Overview";

  return (
    <div className="inspector-sidebar">
      <header className="inspector-sidebar-header">
        <span>{panelTitle}</span>
        {selectedNode || searchQuery ? (
          <button aria-label="Clear selection" onClick={onClearSelection} type="button">
            Clear
          </button>
        ) : null}
      </header>
      <div className="inspector-sidebar-body">
        {selectedNode ? <SelectedNodePanel node={selectedNode} /> : <SceneOverviewPanel activeTab={activeTab} fogCount={fogCount} scene={scene} />}
        <SearchResultsPanel query={searchQuery} results={searchResults} onResultSelect={onSearchResultSelect} />
      </div>
    </div>
  );
}

function SceneOverviewPanel({
  activeTab,
  fogCount,
  scene,
}: {
  activeTab: ExplorationTab;
  fogCount: number;
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
    </section>
  );
}

function SelectedNodePanel({ node }: { node: TerrainNode }): ReactElement {
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
    </section>
  );
}

function StatusStrip({
  layer,
  layerLabel,
  nodeCount,
  selectedCount,
  sourceCount,
  jobState,
}: {
  layer: LayerId;
  layerLabel: string;
  nodeCount: number;
  selectedCount: number;
  sourceCount: number;
  jobState: string;
}): ReactElement {
  return (
    <footer className="status-strip">
      <span>
        {layer} · {layerLabel}
      </span>
      <span>{nodeCount} nodes</span>
      <span>{selectedCount} selected</span>
      <span>{sourceCount} sources</span>
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
