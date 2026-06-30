import type { ScoutPlan, ScoutRunResult } from "@seekstar/core-schema";
import type { AiAssistantInput, AiAssistantOutput } from "@seekstar/ai-service";
import type { WorkspaceChangeEvent } from "@seekstar/storage-service";
import type { SeekStarSettings } from "../../main/appSettingsStore";
import type {
  AiAdapterTestRequest,
  AiAdapterTestResult,
  AiCartographerPromptPreviewRequest,
  AiCartographerPromptPreviewResult,
} from "../../main/aiAssistantBridge";
import type { AiCostLedgerSnapshot } from "../../main/aiCostLedgerStore";
import type { AssistantSessionSnapshot } from "../../main/assistantSessionStore";
import type { CartographerChunkStoreSnapshot } from "../../main/cartographerChunkStore";
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
} from "../../main/cartographerRuntimeBridge";
import type { CanvasTool, TabCanvasToolChangeEvent, TabRuntimeSnapshot, TabWorkspaceSyncInput } from "../../main/tabRuntimeManager";
import type { TileSurfaceDeepLensSnapshot, TileSurfaceLinkEvent, TileSurfaceThumbnailEvent } from "../../main/tileSurfaceManager";

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

export interface SeekStarWindowApi {
  goBack: () => Promise<void>;
  goForward: () => Promise<void>;
  executeAction: (action: WindowAction) => Promise<void>;
}

export interface SeekStarWorkspaceApi {
  clearDevelopmentData: () => Promise<void>;
  clearSnapshot: () => Promise<void>;
  getStorePaths: () => Promise<Record<string, string>>;
  loadSnapshot: () => Promise<unknown | undefined>;
  onChanged: (callback: (event: WorkspaceChangeEvent) => void) => () => void;
  saveSnapshot: (snapshot: unknown) => Promise<void>;
}

export interface SeekStarTabsApi {
  activate: (tabId: string) => Promise<TabRuntimeSnapshot>;
  attach: (tabId: string) => Promise<TabRuntimeSnapshot>;
  assignFolder: (tabId: string, folderId?: string) => Promise<TabRuntimeSnapshot>;
  clearCache: (tabId?: string) => Promise<TabRuntimeSnapshot>;
  close: (tabId: string) => Promise<TabRuntimeSnapshot>;
  copyCrashLog: (tabId: string) => Promise<void>;
  create: (input: { activate?: boolean; tabId?: string; title: string; seed: string }) => Promise<TabRuntimeSnapshot>;
  createFolder: (title: string) => Promise<TabRuntimeSnapshot>;
  deleteFolder: (folderId: string) => Promise<TabRuntimeSnapshot>;
  detach: (tabId: string) => Promise<TabRuntimeSnapshot>;
  getActiveCanvasTool: (tabId: string) => Promise<CanvasTool>;
  list: () => Promise<TabRuntimeSnapshot>;
  onCanvasToolChanged: (callback: (event: TabCanvasToolChangeEvent) => void) => () => void;
  onChanged: (callback: (snapshot: TabRuntimeSnapshot) => void) => () => void;
  refresh: (tabId: string) => Promise<TabRuntimeSnapshot>;
  renameWorkspace: (name: string) => Promise<TabRuntimeSnapshot>;
  reorder: (sourceTabId: string, targetTabId: string) => Promise<TabRuntimeSnapshot>;
  setActiveCanvasTool: (tabId: string, tool: CanvasTool) => Promise<CanvasTool>;
  setDockBounds: (bounds?: { x: number; y: number; width: number; height: number }) => Promise<TabRuntimeSnapshot>;
  syncWorkspaceTabs: (input: TabWorkspaceSyncInput) => Promise<TabRuntimeSnapshot>;
  toggleFavorite: (tabId: string) => Promise<TabRuntimeSnapshot>;
  togglePin: (tabId: string) => Promise<TabRuntimeSnapshot>;
}

export interface SeekStarSettingsApi {
  load: () => Promise<SeekStarSettings>;
  save: (settings: SeekStarSettings) => Promise<SeekStarSettings>;
}

export interface SeekStarScoutApi {
  runPlan: (tabId: string, plan: ScoutPlan) => Promise<ScoutRunResult>;
}

export interface SeekStarCartographerApi {
  cancelTransaction: (input: CartographerRuntimeCancelRequest) => Promise<CartographerRuntimeCancelResult>;
  clearChunkRecords: (tabId: string) => Promise<CartographerChunkStoreSnapshot>;
  subscribeChunkRecords: (tabId: string, callback: (snapshot: CartographerChunkStoreSnapshot) => void) => () => void;
  runBootstrapTransaction: (input: CartographerRuntimeBootstrapRequest) => Promise<CartographerRuntimeBootstrapResult>;
  runLayerFocusTransaction: (input: CartographerRuntimeLayerFocusRequest) => Promise<CartographerRuntimeLayerFocusResult>;
  runSourceReplacementTransaction: (
    input: CartographerRuntimeSourceReplacementRequest,
  ) => Promise<CartographerRuntimeSourceReplacementResult>;
  runViewportExpansionTransaction: (
    input: CartographerRuntimeViewportExpansionRequest,
  ) => Promise<CartographerRuntimeViewportExpansionResult>;
}

export interface SeekStarAiApi {
  assist: (input: AiAssistantInput) => Promise<AiAssistantOutput>;
  clearCostLedger: () => Promise<AiCostLedgerSnapshot>;
  clearSession: (tabId: string) => Promise<AssistantSessionSnapshot>;
  exportCostLedger: () => Promise<string>;
  loadCostLedger: () => Promise<AiCostLedgerSnapshot>;
  loadSession: (tabId: string) => Promise<AssistantSessionSnapshot>;
  previewCartographerPrompt: (input: AiCartographerPromptPreviewRequest) => Promise<AiCartographerPromptPreviewResult>;
  saveSession: (snapshot: AssistantSessionSnapshot) => Promise<AssistantSessionSnapshot>;
  testAdapter: (input: AiAdapterTestRequest) => Promise<AiAdapterTestResult>;
}

export interface TileSurfaceSyncInput {
  surfaces: TileSurfaceSyncItem[];
  tabId: string;
}

export interface TileSurfaceSyncItem {
  bounds: { x: number; y: number; width: number; height: number };
  loadPriority: "none" | "low" | "medium" | "high";
  loadState: "metadata_only" | "thumbnail_ready" | "renderer_visible" | "renderer_focused";
  nodeId: string;
  renderMode: "thumbnail" | "live";
  sourceId?: string;
  sourceUrl: string;
  title: string;
  visibility: "off_viewport" | "near_viewport" | "visible" | "focused";
}

export interface SeekStarTilesApi {
  clear: (tabId: string) => Promise<void>;
  captureDeepLens: (input: { nodeId: string; tabId: string }) => Promise<TileSurfaceDeepLensSnapshot>;
  onLinkActivated: (callback: (event: TileSurfaceLinkEvent) => void) => () => void;
  onThumbnailUpdated: (callback: (event: TileSurfaceThumbnailEvent) => void) => () => void;
  sync: (input: TileSurfaceSyncInput) => Promise<void>;
}

export interface SeekStarBridge {
  ai: SeekStarAiApi;
  appName: string;
  cartographer: SeekStarCartographerApi;
  scaffoldVersion: string;
  scout: SeekStarScoutApi;
  settings: SeekStarSettingsApi;
  tabs: SeekStarTabsApi;
  tiles: SeekStarTilesApi;
  workspace: SeekStarWorkspaceApi;
  window: SeekStarWindowApi;
}

declare global {
  interface Window {
    seekstar: SeekStarBridge;
  }
}

export {};
