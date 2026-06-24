import { app, BrowserWindow, shell } from "electron";
import { join } from "node:path";
import { registerScoutAdapter } from "./scoutAdapter";
import { registerWindowBridge } from "./windowBridge";
import { registerWorkspaceStore } from "./workspaceStore";

app.disableHardwareAcceleration();

registerWindowBridge();
registerWorkspaceStore();
registerScoutAdapter();

function createMainWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: 1600,
    height: 900,
    minWidth: 1280,
    minHeight: 720,
    title: "SeekStar",
    backgroundColor: "#00000000",
    show: false,
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
    webPreferences: {
      preload: join(__dirname, "../preload/index.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  window.webContents.once("did-finish-load", () => {
    if (!app.isPackaged) {
      window.webContents.openDevTools({ mode: "detach" });
    }
  });

  window.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: "deny" };
  });

  if (process.env.ELECTRON_RENDERER_URL) {
    void window.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    void window.loadFile(join(__dirname, "../renderer/index.html"));
  }

  return window;
}

app.whenReady().then(() => {
  const window = createMainWindow();

  window.once("ready-to-show", () => {
    window.show();
  });

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      const nextWindow = createMainWindow();
      nextWindow.once("ready-to-show", () => {
        nextWindow.show();
      });
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
