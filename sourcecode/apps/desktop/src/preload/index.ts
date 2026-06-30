import { contextBridge, ipcRenderer } from "electron";
import type { AiAssistantInput, AiAssistantOutput } from "@seekstar/ai-service";
import type { ScoutPlan, ScoutRunResult } from "@seekstar/core-schema";
import type { WorkspaceChangeEvent } from "@seekstar/storage-service";
import type { SeekStarSettings } from "../main/appSettingsStore";
import type {
  AiAdapterTestRequest,
  AiAdapterTestResult,
  AiCartographerPromptPreviewRequest,
  AiCartographerPromptPreviewResult,
} from "../main/aiAssistantBridge";
import type { AiCostLedgerSnapshot } from "../main/aiCostLedgerStore";
import type { AssistantSessionSnapshot } from "../main/assistantSessionStore";
import type { CartographerChunkStoreSnapshot } from "../main/cartographerChunkStore";
import type {
  CartographerRuntimeBootstrapRequest,
  CartographerRuntimeBootstrapResult,
  CartographerRuntimeCancelRequest,
  CartographerRuntimeCancelResult,
  CartographerRuntimeLayerFocusRequest,
  CartographerRuntimeLayerFocusResult,
  CartographerRuntimeSourceReplacementRequest,
  CartographerRuntimeSourceReplacementResult,
  CartographerRuntimeViewportExpansionRequest,
  CartographerRuntimeViewportExpansionResult,
} from "../main/cartographerRuntimeBridge";
import type { CanvasTool, TabCanvasToolChangeEvent, TabRuntimeSnapshot, TabWorkspaceSyncInput } from "../main/tabRuntimeManager";
import type { TileSurfaceDeepLensSnapshot, TileSurfaceLinkEvent, TileSurfaceThumbnailEvent } from "../main/tileSurfaceManager";

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
    onChanged: (callback: (event: WorkspaceChangeEvent) => void): (() => void) => {
      const listener = (_event: Electron.IpcRendererEvent, payload: WorkspaceChangeEvent): void => callback(payload);
      ipcRenderer.on("workspace:changed", listener);
      return () => ipcRenderer.removeListener("workspace:changed", listener);
    },
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
    getActiveCanvasTool: (tabId: string): Promise<CanvasTool> => ipcRenderer.invoke("tabs:get-active-canvas-tool", tabId),
    list: (): Promise<TabRuntimeSnapshot> => ipcRenderer.invoke("tabs:list"),
    onCanvasToolChanged: (callback: (event: TabCanvasToolChangeEvent) => void): (() => void) => {
      const listener = (_event: Electron.IpcRendererEvent, payload: TabCanvasToolChangeEvent): void => callback(payload);
      ipcRenderer.on("tabs:canvas-tool-changed", listener);
      return () => ipcRenderer.removeListener("tabs:canvas-tool-changed", listener);
    },
    onChanged: (callback: (snapshot: TabRuntimeSnapshot) => void): (() => void) => {
      const listener = (_event: Electron.IpcRendererEvent, snapshot: TabRuntimeSnapshot): void => callback(snapshot);
      ipcRenderer.on("tabs:changed", listener);
      return () => ipcRenderer.removeListener("tabs:changed", listener);
    },
    refresh: (tabId: string): Promise<TabRuntimeSnapshot> => ipcRenderer.invoke("tabs:refresh", tabId),
    renameWorkspace: (name: string): Promise<TabRuntimeSnapshot> => ipcRenderer.invoke("tabs:rename-workspace", name),
    reorder: (sourceTabId: string, targetTabId: string): Promise<TabRuntimeSnapshot> =>
      ipcRenderer.invoke("tabs:reorder", { sourceTabId, targetTabId }),
    setActiveCanvasTool: (tabId: string, tool: CanvasTool): Promise<CanvasTool> =>
      ipcRenderer.invoke("tabs:set-active-canvas-tool", { tabId, tool }),
    setDockBounds: (bounds?: { x: number; y: number; width: number; height: number }): Promise<TabRuntimeSnapshot> =>
      ipcRenderer.invoke("tabs:set-dock-bounds", bounds),
    syncWorkspaceTabs: (input: TabWorkspaceSyncInput): Promise<TabRuntimeSnapshot> => ipcRenderer.invoke("tabs:sync-workspace-tabs", input),
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
  cartographer: {
    cancelTransaction: (input: CartographerRuntimeCancelRequest): Promise<CartographerRuntimeCancelResult> =>
      ipcRenderer.invoke("cartographer:cancel-transaction", input),
    clearChunkRecords: (tabId: string): Promise<CartographerChunkStoreSnapshot> => ipcRenderer.invoke("cartographer-chunks:clear", tabId),
    subscribeChunkRecords: (tabId: string, callback: (snapshot: CartographerChunkStoreSnapshot) => void): (() => void) => {
      let active = true;
      const listener = (_event: Electron.IpcRendererEvent, snapshot: CartographerChunkStoreSnapshot): void => {
        if (active && snapshot.tab_id === tabId) {
          callback(snapshot);
        }
      };

      ipcRenderer.on("cartographer-chunks:changed", listener);
      void ipcRenderer.invoke("cartographer-chunks:subscribe", tabId).then((snapshot: CartographerChunkStoreSnapshot) => {
        if (active && snapshot.tab_id === tabId) {
          callback(snapshot);
        }
      });

      return () => {
        active = false;
        ipcRenderer.removeListener("cartographer-chunks:changed", listener);
      };
    },
    runBootstrapTransaction: (input: CartographerRuntimeBootstrapRequest): Promise<CartographerRuntimeBootstrapResult> =>
      ipcRenderer.invoke("cartographer:run-bootstrap-transaction", input),
    runLayerFocusTransaction: (input: CartographerRuntimeLayerFocusRequest): Promise<CartographerRuntimeLayerFocusResult> =>
      ipcRenderer.invoke("cartographer:run-layer-focus-transaction", input),
    runSourceReplacementTransaction: (
      input: CartographerRuntimeSourceReplacementRequest,
    ): Promise<CartographerRuntimeSourceReplacementResult> => ipcRenderer.invoke("cartographer:run-source-replacement-transaction", input),
    runViewportExpansionTransaction: (
      input: CartographerRuntimeViewportExpansionRequest,
    ): Promise<CartographerRuntimeViewportExpansionResult> => ipcRenderer.invoke("cartographer:run-viewport-expansion-transaction", input),
  },
  ai: {
    assist: (input: AiAssistantInput): Promise<AiAssistantOutput> => ipcRenderer.invoke("ai:assist", input),
    clearCostLedger: (): Promise<AiCostLedgerSnapshot> => ipcRenderer.invoke("ai-cost-ledger:clear"),
    clearSession: (tabId: string): Promise<AssistantSessionSnapshot> => ipcRenderer.invoke("assistant-session:clear", tabId),
    exportCostLedger: (): Promise<string> => ipcRenderer.invoke("ai-cost-ledger:export"),
    loadCostLedger: (): Promise<AiCostLedgerSnapshot> => ipcRenderer.invoke("ai-cost-ledger:load"),
    loadSession: (tabId: string): Promise<AssistantSessionSnapshot> => ipcRenderer.invoke("assistant-session:load", tabId),
    previewCartographerPrompt: (input: AiCartographerPromptPreviewRequest): Promise<AiCartographerPromptPreviewResult> =>
      ipcRenderer.invoke("ai:preview-cartographer-prompt", input),
    saveSession: (snapshot: AssistantSessionSnapshot): Promise<AssistantSessionSnapshot> =>
      ipcRenderer.invoke("assistant-session:save", snapshot),
    testAdapter: (input: AiAdapterTestRequest): Promise<AiAdapterTestResult> => ipcRenderer.invoke("ai:test-adapter", input),
  },
  tiles: {
    clear: (tabId: string): Promise<void> => ipcRenderer.invoke("tiles:clear", tabId),
    captureDeepLens: (input: { nodeId: string; tabId: string }): Promise<TileSurfaceDeepLensSnapshot> =>
      ipcRenderer.invoke("tiles:capture-deep-lens", input),
    onLinkActivated: (callback: (event: TileSurfaceLinkEvent) => void): (() => void) => {
      const listener = (_event: Electron.IpcRendererEvent, payload: TileSurfaceLinkEvent): void => callback(payload);
      ipcRenderer.on("tiles:link-activated", listener);
      return () => ipcRenderer.removeListener("tiles:link-activated", listener);
    },
    onThumbnailUpdated: (callback: (event: TileSurfaceThumbnailEvent) => void): (() => void) => {
      const listener = (_event: Electron.IpcRendererEvent, payload: TileSurfaceThumbnailEvent): void => callback(payload);
      ipcRenderer.on("tiles:thumbnail-updated", listener);
      return () => ipcRenderer.removeListener("tiles:thumbnail-updated", listener);
    },
    sync: (input: unknown): Promise<void> => ipcRenderer.invoke("tiles:sync", input),
  },
  window: {
    goBack: (): Promise<void> => ipcRenderer.invoke("window:go-back"),
    goForward: (): Promise<void> => ipcRenderer.invoke("window:go-forward"),
    executeAction: (action: WindowAction): Promise<void> => ipcRenderer.invoke("window:execute-action", action),
  },
});
