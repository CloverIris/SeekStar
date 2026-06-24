import { contextBridge, ipcRenderer } from "electron";
import type { ScoutPlan, ScoutRunResult } from "@seekstar/core-schema";

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
    loadSnapshot: (): Promise<unknown | undefined> => ipcRenderer.invoke("workspace:load"),
    saveSnapshot: (snapshot: unknown): Promise<void> => ipcRenderer.invoke("workspace:save", snapshot),
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
