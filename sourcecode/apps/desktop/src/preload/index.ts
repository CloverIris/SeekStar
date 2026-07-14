import { contextBridge, ipcRenderer } from "electron";
import type { AiAssistantInput, AiAssistantOutput } from "@seekstar/ai-service";
import type { ExplorationCommand, ExplorationOpenResult, ExplorationViewState, ExplorationWorldEvent, ScoutPlan, ScoutRunResult } from "@seekstar/core-schema";
import type { ProviderTestRequest, ProviderTestResult, SeekStarSettings, SettingsSaveRequest, SettingsSaveResult } from "../shared/settings";
import type { CanvasTool, TabCanvasToolChangeEvent, TabRuntimeSnapshot, TabWorkspaceSyncInput } from "../main/tabRuntimeManager";
import type { TileSurfaceLinkEvent, TileSurfaceThumbnailEvent } from "../main/tileSurfaceManager";

export type WindowAction = "reload" | "force-reload" | "quit" | "undo" | "redo" | "cut" | "copy" | "paste" | "select-all" | "toggle-devtools" | "zoom-in" | "zoom-out" | "zoom-reset" | "toggle-fullscreen" | "about";

contextBridge.exposeInMainWorld("seekstar", {
  appName: "SeekStar",
  scaffoldVersion: "0.0.0",
  data: {
    getPaths: (): Promise<Record<string, string>> => ipcRenderer.invoke("app-data:get-paths"),
    clearExploration: (): Promise<void> => ipcRenderer.invoke("app-data:clear-exploration"),
  },
  tabs: {
    activate: (tabId: string): Promise<TabRuntimeSnapshot> => ipcRenderer.invoke("tabs:activate", tabId),
    attach: (tabId: string): Promise<TabRuntimeSnapshot> => ipcRenderer.invoke("tabs:attach", tabId),
    assignFolder: (tabId: string, folderId?: string): Promise<TabRuntimeSnapshot> => ipcRenderer.invoke("tabs:assign-folder", { tabId, folderId }),
    clearCache: (tabId?: string): Promise<TabRuntimeSnapshot> => ipcRenderer.invoke("tabs:clear-cache", tabId),
    close: (tabId: string): Promise<TabRuntimeSnapshot> => ipcRenderer.invoke("tabs:close", tabId),
    copyCrashLog: (tabId: string): Promise<void> => ipcRenderer.invoke("tabs:copy-crash-log", tabId),
    create: (input: { activate?: boolean; tabId?: string; title: string; seed: string }): Promise<TabRuntimeSnapshot> => ipcRenderer.invoke("tabs:create", input),
    createFolder: (title: string): Promise<TabRuntimeSnapshot> => ipcRenderer.invoke("tabs:create-folder", { title }),
    deleteFolder: (folderId: string): Promise<TabRuntimeSnapshot> => ipcRenderer.invoke("tabs:delete-folder", folderId),
    detach: (tabId: string): Promise<TabRuntimeSnapshot> => ipcRenderer.invoke("tabs:detach", tabId),
    getActiveCanvasTool: (tabId: string): Promise<CanvasTool> => ipcRenderer.invoke("tabs:get-active-canvas-tool", tabId),
    list: (): Promise<TabRuntimeSnapshot> => ipcRenderer.invoke("tabs:list"),
    onCanvasToolChanged: (callback: (event: TabCanvasToolChangeEvent) => void): (() => void) => listen("tabs:canvas-tool-changed", callback),
    onChanged: (callback: (snapshot: TabRuntimeSnapshot) => void): (() => void) => listen("tabs:changed", callback),
    refresh: (tabId: string): Promise<TabRuntimeSnapshot> => ipcRenderer.invoke("tabs:refresh", tabId),
    renameWorkspace: (name: string): Promise<TabRuntimeSnapshot> => ipcRenderer.invoke("tabs:rename-workspace", name),
    reorder: (sourceTabId: string, targetTabId: string): Promise<TabRuntimeSnapshot> => ipcRenderer.invoke("tabs:reorder", { sourceTabId, targetTabId }),
    setActiveCanvasTool: (tabId: string, tool: CanvasTool): Promise<CanvasTool> => ipcRenderer.invoke("tabs:set-active-canvas-tool", { tabId, tool }),
    setDockBounds: (bounds?: { x: number; y: number; width: number; height: number }): Promise<TabRuntimeSnapshot> => ipcRenderer.invoke("tabs:set-dock-bounds", bounds),
    syncWorkspaceTabs: (input: TabWorkspaceSyncInput): Promise<TabRuntimeSnapshot> => ipcRenderer.invoke("tabs:sync-workspace-tabs", input),
    toggleFavorite: (tabId: string): Promise<TabRuntimeSnapshot> => ipcRenderer.invoke("tabs:toggle-favorite", tabId),
    togglePin: (tabId: string): Promise<TabRuntimeSnapshot> => ipcRenderer.invoke("tabs:toggle-pin", tabId),
  },
  settings: {
    load: (): Promise<SeekStarSettings> => ipcRenderer.invoke("settings:load"),
    save: (request: SettingsSaveRequest): Promise<SettingsSaveResult> => ipcRenderer.invoke("settings:save", request),
    testProvider: (request: ProviderTestRequest): Promise<ProviderTestResult> => ipcRenderer.invoke("settings:test-provider", request),
  },
  scout: {
    runPlan: (tabId: string, plan: ScoutPlan): Promise<ScoutRunResult> => ipcRenderer.invoke("scout:run-plan", { tab_id: tabId, plan, requested_at: new Date().toISOString() }),
  },
  exploration: {
    open: (tabId: string): Promise<ExplorationOpenResult> => ipcRenderer.invoke("exploration:open", tabId),
    subscribe: (leaseId: string, callback: (event: ExplorationWorldEvent) => void): (() => void) => {
      const channel = `exploration:event:${leaseId}`;
      const dispose = listen(channel, callback);
      void ipcRenderer.invoke("exploration:subscribe", leaseId);
      return dispose;
    },
    reportView: (leaseId: string, viewRevision: number, view: ExplorationViewState): Promise<void> => ipcRenderer.invoke("exploration:report-view", { leaseId, viewRevision, view }),
    command: (leaseId: string, command: ExplorationCommand): Promise<void> => ipcRenderer.invoke("exploration:command", { leaseId, command }),
    close: (leaseId: string): Promise<void> => ipcRenderer.invoke("exploration:close", leaseId),
  },
  ai: {
    assist: (input: AiAssistantInput): Promise<AiAssistantOutput> => ipcRenderer.invoke("ai:assist", input),
  },
  tiles: {
    clear: (tabId: string): Promise<void> => ipcRenderer.invoke("tiles:clear", tabId),
    onLinkActivated: (callback: (event: TileSurfaceLinkEvent) => void): (() => void) => listen("tiles:link-activated", callback),
    onThumbnailUpdated: (callback: (event: TileSurfaceThumbnailEvent) => void): (() => void) => listen("tiles:thumbnail-updated", callback),
    sync: (input: unknown): Promise<void> => ipcRenderer.invoke("tiles:sync", input),
  },
  window: {
    goBack: (): Promise<void> => ipcRenderer.invoke("window:go-back"),
    goForward: (): Promise<void> => ipcRenderer.invoke("window:go-forward"),
    executeAction: (action: WindowAction): Promise<void> => ipcRenderer.invoke("window:execute-action", action),
  },
});

function listen<T>(channel: string, callback: (value: T) => void): () => void {
  const listener = (_event: Electron.IpcRendererEvent, payload: T): void => callback(payload);
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
}
