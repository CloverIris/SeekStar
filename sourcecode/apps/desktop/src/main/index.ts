import { app, BaseWindow, WebContentsView, shell } from "electron";
import { join } from "node:path";
import { registerAppSettingsStore } from "./appSettingsStore";
import { registerScoutAdapter } from "./scoutAdapter";
import { TabRuntimeManager } from "./tabRuntimeManager";
import { registerWindowBridge } from "./windowBridge";
import { registerWorkspaceStore } from "./workspaceStore";

const tabRuntimeManager = new TabRuntimeManager();
const hasSingleInstanceLock = app.requestSingleInstanceLock();

if (!hasSingleInstanceLock) {
  app.quit();
}

registerWindowBridge();
registerWorkspaceStore({
  onClearDevelopmentData: async () => {
    await tabRuntimeManager.resetDevelopmentState();
  },
});
registerScoutAdapter();
registerAppSettingsStore({
  onSave: async (settings) => {
    await tabRuntimeManager.applySettings(settings);
  },
});
tabRuntimeManager.registerIpc();

function createMainWindow(): BaseWindow {
  const window = new BaseWindow({
    width: 1600,
    height: 900,
    minWidth: 1280,
    minHeight: 720,
    title: "SeekStar",
    backgroundColor: "#00000000",
    show: false,
    roundedCorners: true,
    titleBarStyle: "hidden",
    ...(process.platform !== "darwin"
      ? {
          titleBarOverlay: {
            color: "#00000000",
            symbolColor: "#9aa5b5",
            height: 36,
          },
        }
      : {}),
    ...(process.platform === "win32" ? { backgroundMaterial: "acrylic" as const } : {}),
  });
  if (process.platform === "win32") {
    window.setBackgroundColor("#00000000");
    window.setBackgroundMaterial("acrylic");
  }
  const shellView = new WebContentsView({
    webPreferences: {
      preload: join(__dirname, "../preload/index.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  shellView.setBackgroundColor("#00000000");

  window.contentView.addChildView(shellView);
  shellView.setBounds(getWindowContentBounds(window));
  window.on("resize", () => {
    shellView.setBounds(getWindowContentBounds(window));
  });
  window.on("closed", () => {
    closeWebContentsIfAlive(shellView);
  });

  shellView.webContents.once("did-finish-load", () => {
    if (!app.isPackaged) {
      shellView.webContents.openDevTools({ mode: "detach" });
    }
    window.show();
  });

  shellView.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: "deny" };
  });

  if (process.env.ELECTRON_RENDERER_URL) {
    tabRuntimeManager.setRendererUrl(process.env.ELECTRON_RENDERER_URL);
    void shellView.webContents.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    void shellView.webContents.loadFile(join(__dirname, "../renderer/index.html"));
  }

  return window;
}

function getWindowContentBounds(window: BaseWindow): Electron.Rectangle {
  const [width, height] = window.getContentSize();
  return { x: 0, y: 0, width, height };
}

function closeWebContentsIfAlive(view: WebContentsView): void {
  try {
    if (!view.webContents.isDestroyed()) {
      view.webContents.close();
    }
  } catch {
    // BaseWindow owns the view during shutdown; destroyed views are already gone.
  }
}

if (hasSingleInstanceLock) {
  app.on("second-instance", () => {
    tabRuntimeManager.focusMainWindow();
  });

  app.whenReady().then(async () => {
    await tabRuntimeManager.load();
    tabRuntimeManager.setMainWindow(createMainWindow());

    app.on("activate", () => {
      if (BaseWindow.getAllWindows().length === 0) {
        tabRuntimeManager.setMainWindow(createMainWindow());
      }
    });
  });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
      app.quit();
    }
  });
}
