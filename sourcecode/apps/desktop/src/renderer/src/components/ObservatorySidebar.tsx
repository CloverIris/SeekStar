import type { TabRecord, WorkspaceFolder } from "@seekstar/core-schema";
import type { DragEvent, ReactElement } from "react";
import { useState } from "react";
import {
  Circle,
  Compass,
  Copy,
  ExternalLink,
  Folder,
  FolderPlus,
  Hand,
  Lasso,
  MousePointer2,
  Pin,
  Plus,
  RefreshCw,
  Search,
  Settings,
  Sparkles,
  Star,
  Trash2,
  X,
  ZoomIn,
  type LucideIcon,
} from "lucide-react";
import type { CanvasTool } from "./canvasTools";

interface ObservatorySidebarProps {
  activeTabId: string;
  activeTool: CanvasTool;
  folderCounts: Map<string, number>;
  folders: WorkspaceFolder[];
  onNewFieldSearch: () => void;
  onSearchCurrentMap: () => void;
  onStarterSeed: (seed: string) => void;
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
  onTabSelect: (tabId: string) => void;
  onToolSelect: (tool: CanvasTool) => void;
  onWorkspaceRename: () => void;
  runtimeTabsById: Map<string, TabRecord>;
  tabs: TabRecord[];
  workspaceName: string;
}

const starterFields = ["Cognitive maps", "Source trails", "Domain gallery"];

const canvasTools: Array<{ id: CanvasTool; label: string; icon: LucideIcon }> = [
  { id: "pointer", label: "Pointer", icon: MousePointer2 },
  { id: "pan", label: "Pan", icon: Hand },
  { id: "lens", label: "Lens", icon: ZoomIn },
  { id: "lasso", label: "Lasso", icon: Lasso },
];

export function ObservatorySidebar({
  activeTool,
  activeTabId,
  folderCounts,
  folders,
  onFolderCreate,
  onFolderDelete,
  onOpenSettings,
  onNewFieldSearch,
  onSearchCurrentMap,
  onStarterSeed,
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
  tabs,
  workspaceName,
}: ObservatorySidebarProps): ReactElement {
  const [draggingTabId, setDraggingTabId] = useState<string | undefined>();
  const [dragStartScreenPosition, setDragStartScreenPosition] = useState<{ x: number; y: number } | undefined>();
  const [activeView, setActiveView] = useState<"all" | "favorites" | "pinned" | `folder:${string}`>("all");
  const visibleTabs = tabs.filter((tab) => {
    if (activeView === "favorites") return tab.favorite;
    if (activeView === "pinned") return tab.pinned;
    return activeView === "all" || tab.folder_id === activeView.slice("folder:".length);
  });
  const pinnedCount = tabs.filter((tab) => tab.pinned).length;
  const favoriteCount = tabs.filter((tab) => tab.favorite).length;

  return (
    <div className="observatory-sidebar" aria-label="SeekStar observatory sidebar">
      <section className="sidebar-nav">
        <button className="sidebar-nav-item" onClick={onNewFieldSearch} type="button">
          <span className="sidebar-icon">
            <Compass aria-hidden="true" size={15} strokeWidth={1.8} />
          </span>
          New field search
        </button>
        <button className="sidebar-nav-item" onClick={onSearchCurrentMap} type="button">
          <span className="sidebar-icon">
            <Search aria-hidden="true" size={15} strokeWidth={1.8} />
          </span>
          Search current map
        </button>
      </section>

      <section className="sidebar-section workspace-section">
        <div className="workspace-section-header">
          <h2>Observatory</h2>
          <button aria-label="Rename workspace" onClick={onWorkspaceRename} type="button">
            Rename
          </button>
        </div>
        <button className="workspace-name" onClick={onWorkspaceRename} type="button">
          <span className="sidebar-icon">
            <Folder aria-hidden="true" size={14} strokeWidth={1.8} />
          </span>
          <span className="workspace-name-body">
            <span>Local workspace</span>
            <strong>{workspaceName}</strong>
            <small>
              {tabs.length} seeks / {folders.length} fields
            </small>
          </span>
        </button>
        <div className="folder-list">
          <button
            aria-pressed={activeView === "all"}
            className={activeView === "all" ? "folder-filter active" : "folder-filter"}
            onClick={() => setActiveView("all")}
            type="button"
          >
            <span className="sidebar-icon">
              <Folder aria-hidden="true" size={13} strokeWidth={1.8} />
            </span>
            <span className="folder-row-title">All fields</span>
            <small>{tabs.length}</small>
          </button>
          {folders.map((folder) => (
            <div className="folder-row" key={folder.id}>
              <button
                aria-pressed={activeView === `folder:${folder.id}`}
                className={activeView === `folder:${folder.id}` ? "folder-filter active" : "folder-filter"}
                onClick={() => setActiveView(`folder:${folder.id}`)}
                type="button"
              >
                <span className="sidebar-icon">
                  <Folder aria-hidden="true" size={13} strokeWidth={1.8} />
                </span>
                <span className="folder-row-title">{folder.title}</span>
                <small>{folderCounts.get(folder.id) ?? 0}</small>
              </button>
              <button aria-label={`Delete ${folder.title}`} onClick={() => onFolderDelete(folder.id)} title="Delete folder" type="button">
                <X aria-hidden="true" size={11} strokeWidth={2} />
              </button>
            </div>
          ))}
          <button className="folder-create" onClick={onFolderCreate} type="button">
            <FolderPlus aria-hidden="true" size={13} strokeWidth={1.8} />
            Add field
          </button>
        </div>
      </section>

      <section className="sidebar-section sidebar-quick-views">
        <h2>Quick views</h2>
        <div className="sidebar-list">
          <button className={activeView === "pinned" ? "sidebar-list-item active" : "sidebar-list-item"} onClick={() => setActiveView("pinned")} type="button">
            <span className="sidebar-icon"><Pin aria-hidden="true" size={14} strokeWidth={1.8} /></span>
            <span className="sidebar-label">Pinned Seeks</span><small>{pinnedCount}</small>
          </button>
          <button className={activeView === "favorites" ? "sidebar-list-item active" : "sidebar-list-item"} onClick={() => setActiveView("favorites")} type="button">
            <span className="sidebar-icon"><Star aria-hidden="true" size={14} strokeWidth={1.8} /></span>
            <span className="sidebar-label">Favorites</span><small>{favoriteCount}</small>
          </button>
        </div>
      </section>

      <section className="sidebar-section">
        <h2>Starter fields</h2>
        <div className="sidebar-list">
          {starterFields.map((seed) => (
            <button className="sidebar-list-item" key={seed} onClick={() => onStarterSeed(seed)} type="button">
              <span className="sidebar-icon">
                <Sparkles aria-hidden="true" size={14} strokeWidth={1.8} />
              </span>
              <span className="sidebar-label">{seed}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="sidebar-section">
        <h2>Telescope tools</h2>
        <div className="canvas-tool-list">
          {canvasTools.map((tool) => (
            <button
              aria-pressed={activeTool === tool.id}
              className={activeTool === tool.id ? "canvas-tool active" : "canvas-tool"}
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
          {visibleTabs.map((tab) => {
            const runtimeTab = runtimeTabsById.get(tab.id) ?? tab;
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
                  <button aria-label={`Close ${tab.title}`} disabled={tabs.length <= 1} onClick={() => onTabClose(tab.id)} title="Close" type="button">
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
          {visibleTabs.length === 0 ? <p className="exploration-tab-empty">No Seeks in this field yet.</p> : null}
          <button className="exploration-tab-new" onClick={onNewFieldSearch} type="button">
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
