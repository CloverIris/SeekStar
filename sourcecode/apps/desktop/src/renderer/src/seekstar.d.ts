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
  loadSnapshot: () => Promise<unknown | undefined>;
  saveSnapshot: (snapshot: unknown) => Promise<void>;
}

export interface SeekStarBridge {
  appName: string;
  scaffoldVersion: string;
  workspace: SeekStarWorkspaceApi;
  window: SeekStarWindowApi;
}

declare global {
  interface Window {
    seekstar: SeekStarBridge;
  }
}

export {};
