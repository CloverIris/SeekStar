import { app, BrowserWindow, dialog, ipcMain } from "electron";
import type { WebContents } from "electron";

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

function getWindowFromEvent(event: Electron.IpcMainInvokeEvent): BrowserWindow | null {
  return BrowserWindow.fromWebContents(event.sender);
}

function registerHandler(
  channel: string,
  handler: (event: Electron.IpcMainInvokeEvent, ...args: unknown[]) => unknown,
): void {
  ipcMain.removeHandler(channel);
  ipcMain.handle(channel, handler);
}

function executeWindowAction(contents: WebContents, window: BrowserWindow | null, action: WindowAction): void {
  switch (action) {
    case "reload":
      contents.reload();
      break;
    case "force-reload":
      contents.reloadIgnoringCache();
      break;
    case "quit":
      app.quit();
      break;
    case "undo":
      contents.undo();
      break;
    case "redo":
      contents.redo();
      break;
    case "cut":
      contents.cut();
      break;
    case "copy":
      contents.copy();
      break;
    case "paste":
      contents.paste();
      break;
    case "select-all":
      contents.selectAll();
      break;
    case "toggle-devtools":
      contents.toggleDevTools();
      break;
    case "zoom-in":
      contents.setZoomFactor(contents.getZoomFactor() + 0.1);
      break;
    case "zoom-out":
      contents.setZoomFactor(Math.max(0.5, contents.getZoomFactor() - 0.1));
      break;
    case "zoom-reset":
      contents.setZoomFactor(1);
      break;
    case "toggle-fullscreen":
      if (window) {
        window.setFullScreen(!window.isFullScreen());
      }
      break;
    case "about":
      if (window) {
        void dialog.showMessageBox(window, {
          type: "info",
          title: "SeekStar",
          message: "SeekStar",
          detail: "P0 cognitive cartography prototype.",
        });
      } else {
        void dialog.showMessageBox({
          type: "info",
          title: "SeekStar",
          message: "SeekStar",
          detail: "P0 cognitive cartography prototype.",
        });
      }
      break;
    default:
      console.warn(`[SeekStar] Unknown window action: ${String(action)}`);
  }
}

export function registerWindowBridge(): void {
  registerHandler("window:go-back", (event) => {
    if (event.sender.canGoBack()) {
      event.sender.goBack();
    }
  });

  registerHandler("window:go-forward", (event) => {
    if (event.sender.canGoForward()) {
      event.sender.goForward();
    }
  });

  registerHandler("window:execute-action", (event, ...args: unknown[]) => {
    const action = args[0] as WindowAction;
    const window = getWindowFromEvent(event);

    try {
      executeWindowAction(event.sender, window, action);
    } catch (error) {
      console.error(`[SeekStar] Failed to run action "${action}"`, error);
      throw error;
    }
  });
}
