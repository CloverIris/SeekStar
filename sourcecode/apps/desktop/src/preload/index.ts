import { contextBridge, ipcRenderer } from "electron";
import type { ScoutPlan, ScoutRunResult } from "@seekstar/core-schema";
import type { SeekStarSettings } from "../main/appSettingsStore";
import type { TabRuntimeSnapshot } from "../main/tabRuntimeManager";

export type WindowAction =
  | "reload"
  | "force-reload"
  | "quit"
  | "undo"
  | "redo"
  | "cut"
  | "copy"
  | "paste"
  | "select-all"
  | "toggle-devtools"
  | "zoom-in"
  | "zoom-out"
  | "zoom-reset"
  | "toggle-fullscreen"
  | "about";

contextBridge.exposeInMainWorld("seekstar", {
  appName: "SeekStar",
  scaffoldVersion: "0.0.0",
  workspace: {
    clearDevelopmentData: (): Promise<void> => ipcRenderer.invoke("workspace:clear-development-data"),
    clearSnapshot: (): Promise<void> => ipcRenderer.invoke("workspace:clear"),
    getStorePaths: (): Promise<Record<string, string>> => ipcRenderer.invoke("workspace:get-store-paths"),
    loadSnapshot: (): Promise<unknown | undefined> => ipcRenderer.invoke("workspace:load"),
    saveSnapshot: (snapshot: unknown): Promise<void> => ipcRenderer.invoke("workspace:save", snapshot),
  },
  tabs: {
    activate: (tabId: string): Promise<TabRuntimeSnapshot> => ipcRenderer.invoke("tabs:activate", tabId),
    attach: (tabId: string): Promise<TabRuntimeSnapshot> => ipcRenderer.invoke("tabs:attach", tabId),
    assignFolder: (tabId: string, folderId?: string): Promise<TabRuntimeSnapshot> =>
      ipcRenderer.invoke("tabs:assign-folder", { tabId, folderId }),
    clearCache: (tabId?: string): Promise<TabRuntimeSnapshot> => ipcRenderer.invoke("tabs:clear-cache", tabId),
    close: (tabId: string): Promise<TabRuntimeSnapshot> => ipcRenderer.invoke("tabs:close", tabId),
    copyCrashLog: (tabId: string): Promise<void> => ipcRenderer.invoke("tabs:copy-crash-log", tabId),
    create: (input: { activate?: boolean; tabId?: string; title: string; seed: string }): Promise<TabRuntimeSnapshot> => ipcRenderer.invoke("tabs:create", input),
    createFolder: (title: string): Promise<TabRuntimeSnapshot> => ipcRenderer.invoke("tabs:create-folder", { title }),
    deleteFolder: (folderId: string): Promise<TabRuntimeSnapshot> => ipcRenderer.invoke("tabs:delete-folder", folderId),
    detach: (tabId: string): Promise<TabRuntimeSnapshot> => ipcRenderer.invoke("tabs:detach", tabId),
    list: (): Promise<TabRuntimeSnapshot> => ipcRenderer.invoke("tabs:list"),
    onChanged: (callback: (snapshot: TabRuntimeSnapshot) => void): (() => void) => {
      const listener = (_event: Electron.IpcRendererEvent, snapshot: TabRuntimeSnapshot): void => callback(snapshot);
      ipcRenderer.on("tabs:changed", listener);
      return () => ipcRenderer.removeListener("tabs:changed", listener);
    },
    refresh: (tabId: string): Promise<TabRuntimeSnapshot> => ipcRenderer.invoke("tabs:refresh", tabId),
    renameWorkspace: (name: string): Promise<TabRuntimeSnapshot> => ipcRenderer.invoke("tabs:rename-workspace", name),
    reorder: (sourceTabId: string, targetTabId: string): Promise<TabRuntimeSnapshot> =>
      ipcRenderer.invoke("tabs:reorder", { sourceTabId, targetTabId }),
    setDockBounds: (bounds?: { x: number; y: number; width: number; height: number }): Promise<TabRuntimeSnapshot> =>
      ipcRenderer.invoke("tabs:set-dock-bounds", bounds),
    toggleFavorite: (tabId: string): Promise<TabRuntimeSnapshot> => ipcRenderer.invoke("tabs:toggle-favorite", tabId),
    togglePin: (tabId: string): Promise<TabRuntimeSnapshot> => ipcRenderer.invoke("tabs:toggle-pin", tabId),
  },
  settings: {
    load: (): Promise<SeekStarSettings> => ipcRenderer.invoke("settings:load"),
    save: (settings: SeekStarSettings): Promise<SeekStarSettings> => ipcRenderer.invoke("settings:save", settings),
  },
  scout: {
    runPlan: (tabId: string, plan: ScoutPlan): Promise<ScoutRunResult> =>
      ipcRenderer.invoke("scout:run-plan", {
        tab_id: tabId,
        plan,
        requested_at: new Date().toISOString(),
      }),
  },
  window: {
    goBack: (): Promise<void> => ipcRenderer.invoke("window:go-back"),
    goForward: (): Promise<void> => ipcRenderer.invoke("window:go-forward"),
    executeAction: (action: WindowAction): Promise<void> => ipcRenderer.invoke("window:execute-action", action),
  },
});
