import { BrowserWindow } from "electron";
import { join } from "node:path";

export const SPLASH_TIMEOUT_MS = 10_000;

export function createSplashWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: 640,
    height: 420,
    minWidth: 640,
    minHeight: 420,
    maxWidth: 640,
    maxHeight: 420,
    center: true,
    resizable: false,
    show: false,
    title: "SeekStar",
    backgroundColor: "#12141a",
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  window.once("ready-to-show", () => {
    window.show();
  });

  void window.loadFile(join(__dirname, "splash.html"));

  return window;
}

export function waitForMainWindowReady(window: BrowserWindow): Promise<void> {
  const loadPromise = window.webContents.isLoading()
    ? new Promise<void>((resolve) => {
        window.webContents.once("did-finish-load", () => resolve());
      })
    : Promise.resolve();

  const showPromise = new Promise<void>((resolve) => {
    window.once("ready-to-show", () => resolve());
  });

  return Promise.all([loadPromise, showPromise]).then(() => undefined);
}

export async function dismissSplashWhenReady(
  splashWindow: BrowserWindow,
  mainWindow: BrowserWindow,
): Promise<void> {
  let finished = false;

  const finish = (): void => {
    if (finished) {
      return;
    }

    finished = true;

    if (!splashWindow.isDestroyed()) {
      splashWindow.close();
    }

    if (!mainWindow.isDestroyed() && !mainWindow.isVisible()) {
      mainWindow.show();
      mainWindow.focus();
    }
  };

  const timeoutId = setTimeout(finish, SPLASH_TIMEOUT_MS);

  try {
    await Promise.race([waitForMainWindowReady(mainWindow), delay(SPLASH_TIMEOUT_MS)]);
  } finally {
    clearTimeout(timeoutId);
    finish();
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
