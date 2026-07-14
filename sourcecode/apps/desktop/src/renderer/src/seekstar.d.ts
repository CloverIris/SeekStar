import type { AiAssistantInput, AiAssistantOutput } from "@seekstar/ai-service";
import type { ExplorationCommand, ExplorationOpenResult, ExplorationViewState, ExplorationWorldEvent, ScoutPlan, ScoutRunResult } from "@seekstar/core-schema";
import type { ProviderTestRequest, ProviderTestResult, SeekStarSettings, SettingsSaveRequest, SettingsSaveResult } from "../../shared/settings";
import type { CanvasTool, TabCanvasToolChangeEvent, TabRuntimeSnapshot, TabWorkspaceSyncInput } from "../../main/tabRuntimeManager";
import type { TileSurfaceLinkEvent, TileSurfaceThumbnailEvent } from "../../main/tileSurfaceManager";

export type WindowAction = "reload" | "force-reload" | "quit" | "undo" | "redo" | "cut" | "copy" | "paste" | "select-all" | "toggle-devtools" | "zoom-in" | "zoom-out" | "zoom-reset" | "toggle-fullscreen" | "about";

interface SeekStarBridge {
  appName: string;
  scaffoldVersion: string;
  data: { getPaths: () => Promise<Record<string, string>>; clearExploration: () => Promise<void> };
  tabs: {
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
  };
  settings: {
    load: () => Promise<SeekStarSettings>;
    save: (request: SettingsSaveRequest) => Promise<SettingsSaveResult>;
    testProvider: (request: ProviderTestRequest) => Promise<ProviderTestResult>;
  };
  scout: { runPlan: (tabId: string, plan: ScoutPlan) => Promise<ScoutRunResult> };
  exploration: {
    open: (tabId: string) => Promise<ExplorationOpenResult>;
    subscribe: (leaseId: string, callback: (event: ExplorationWorldEvent) => void) => () => void;
    reportView: (leaseId: string, viewRevision: number, view: ExplorationViewState) => Promise<void>;
    command: (leaseId: string, command: ExplorationCommand) => Promise<void>;
    close: (leaseId: string) => Promise<void>;
  };
  ai: { assist: (input: AiAssistantInput) => Promise<AiAssistantOutput> };
  tiles: {
    clear: (tabId: string) => Promise<void>;
    onLinkActivated: (callback: (event: TileSurfaceLinkEvent) => void) => () => void;
    onThumbnailUpdated: (callback: (event: TileSurfaceThumbnailEvent) => void) => () => void;
    sync: (input: unknown) => Promise<void>;
  };
  window: { goBack: () => Promise<void>; goForward: () => Promise<void>; executeAction: (action: WindowAction) => Promise<void> };
}

declare global { interface Window { seekstar: SeekStarBridge } }
export {};
