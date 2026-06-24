import type { ScoutPlan, ScoutRunResult } from "@seekstar/core-schema";
import type { SeekStarSettings } from "../../main/appSettingsStore";
import type { TabRuntimeSnapshot } from "../../main/tabRuntimeManager";

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
  list: () => Promise<TabRuntimeSnapshot>;
  onChanged: (callback: (snapshot: TabRuntimeSnapshot) => void) => () => void;
  refresh: (tabId: string) => Promise<TabRuntimeSnapshot>;
  renameWorkspace: (name: string) => Promise<TabRuntimeSnapshot>;
  reorder: (sourceTabId: string, targetTabId: string) => Promise<TabRuntimeSnapshot>;
  setDockBounds: (bounds?: { x: number; y: number; width: number; height: number }) => Promise<TabRuntimeSnapshot>;
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

export interface SeekStarBridge {
  appName: string;
  scaffoldVersion: string;
  scout: SeekStarScoutApi;
  settings: SeekStarSettingsApi;
  tabs: SeekStarTabsApi;
  workspace: SeekStarWorkspaceApi;
  window: SeekStarWindowApi;
}

declare global {
  interface Window {
    seekstar: SeekStarBridge;
  }
}

export {};
