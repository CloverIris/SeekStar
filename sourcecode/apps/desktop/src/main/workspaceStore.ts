import { app, ipcMain, webContents } from "electron";
import { readdir, rm, unlink } from "node:fs/promises";
import { join, resolve, sep } from "node:path";
import { isWorkspaceSnapshot, type WorkspaceSnapshot } from "@seekstar/constellation-engine";
import { JsonWorkspaceStorage, type WorkspaceChangeEvent, type WorkspaceChangeKind } from "@seekstar/storage-service";
import { getAssistantSessionStorePath } from "./assistantSessionStore";
import { getCartographerChunkStorePath } from "./cartographerChunkStore";

const STORE_FILE_NAME = "seekstar-workspace-snapshot.json";
const TAB_RUNTIME_FILE_NAME = "seekstar-tab-runtime.json";
const SETTINGS_FILE_NAME = "seekstar-settings.json";

export interface WorkspaceStorePaths {
  assistant_sessions: string;
  cartographer_chunks: string;
  workspace_snapshot: string;
  tab_runtime: string;
  settings: string;
}

export interface WorkspaceStore {
  clearDevelopmentData: () => Promise<void>;
  clearSnapshot: () => Promise<void>;
  getStorePaths: () => WorkspaceStorePaths;
  loadSnapshot: () => Promise<unknown | undefined>;
  saveSnapshot: (snapshot: unknown) => Promise<void>;
}

export interface RegisterWorkspaceStoreOptions {
  onClearDevelopmentData?: () => Promise<void> | void;
  store?: WorkspaceStore;
}

export class JsonWorkspaceStore implements WorkspaceStore {
  private readonly storage = new JsonWorkspaceStorage(getStorePath(), {
    quarantineInvalidJson: true,
    quarantineInvalidSchema: false,
  });

  async loadSnapshot(): Promise<WorkspaceSnapshot<unknown> | undefined> {
    const inspection = await this.storage.inspectWorkspaceSnapshot();

    if (inspection.status === "invalid_json" || inspection.status === "invalid_schema") {
      const quarantineNote = inspection.quarantine_path ? ` moved to ${inspection.quarantine_path}` : "";
      console.warn(`[SeekStar] Ignored ${inspection.status.replace(/_/g, " ")} workspace snapshot at ${inspection.path}${quarantineNote}: ${inspection.error_message ?? "unknown error"}`);
    }

    return this.storage.loadWorkspaceSnapshot();
  }

  saveSnapshot(snapshot: unknown): Promise<void> {
    if (!isWorkspaceSnapshot(snapshot)) {
      throw new Error("Refusing to save invalid SeekStar workspace snapshot.");
    }

    return this.storage.saveWorkspaceSnapshot(snapshot);
  }

  async clearSnapshot(): Promise<void> {
    await this.storage.clearWorkspaceSnapshot();
  }

  async clearDevelopmentData(): Promise<void> {
    await Promise.all([
      unlinkIfPresent(getStorePath()),
      unlinkIfPresent(getUserDataPath(TAB_RUNTIME_FILE_NAME)),
      unlinkIfPresent(getUserDataPath(SETTINGS_FILE_NAME)),
      clearSeekStarTabPartitions(),
    ]);
  }

  getStorePaths(): WorkspaceStorePaths {
    return {
      assistant_sessions: getAssistantSessionStorePath(),
      cartographer_chunks: getCartographerChunkStorePath(),
      workspace_snapshot: getStorePath(),
      tab_runtime: getUserDataPath(TAB_RUNTIME_FILE_NAME),
      settings: getUserDataPath(SETTINGS_FILE_NAME),
    };
  }
}

export function registerWorkspaceStore(options: RegisterWorkspaceStoreOptions = {}): void {
  const store = options.store ?? new JsonWorkspaceStore();
  let workspaceRevision = 0;

  ipcMain.handle("workspace:load", async () => {
    return store.loadSnapshot();
  });

  ipcMain.handle("workspace:save", async (event, snapshot: unknown) => {
    await store.saveSnapshot(snapshot);
    broadcastWorkspaceChange(createWorkspaceChangeEvent("saved", ++workspaceRevision), event.sender.id);
  });

  ipcMain.handle("workspace:clear", async (event) => {
    await store.clearSnapshot();
    broadcastWorkspaceChange(createWorkspaceChangeEvent("cleared", ++workspaceRevision), event.sender.id);
  });

  ipcMain.handle("workspace:clear-development-data", async (event) => {
    await store.clearDevelopmentData();
    await options.onClearDevelopmentData?.();
    broadcastWorkspaceChange(createWorkspaceChangeEvent("development_data_cleared", ++workspaceRevision), event.sender.id);
  });

  ipcMain.handle("workspace:get-store-paths", () => {
    return store.getStorePaths();
  });
}

function createWorkspaceChangeEvent(kind: WorkspaceChangeKind, revision: number): WorkspaceChangeEvent {
  return {
    kind,
    revision,
    source: "storage-service",
    updated_at: new Date().toISOString(),
  };
}

function broadcastWorkspaceChange(payload: WorkspaceChangeEvent, excludeWebContentsId: number): void {
  for (const targetWebContents of webContents.getAllWebContents()) {
    if (targetWebContents.id === excludeWebContentsId || targetWebContents.isDestroyed()) {
      continue;
    }

    targetWebContents.send("workspace:changed", payload);
  }
}

function getStorePath(): string {
  return getUserDataPath(STORE_FILE_NAME);
}

function getUserDataPath(fileName: string): string {
  return join(app.getPath("userData"), fileName);
}

async function unlinkIfPresent(path: string): Promise<void> {
  try {
    await unlink(path);
  } catch (error) {
    if (!isMissingFileError(error)) {
      throw error;
    }
  }
}

async function clearSeekStarTabPartitions(): Promise<void> {
  const partitionsPath = getUserDataPath("Partitions");
  let entries: Array<{ isDirectory: () => boolean; name: string }>;

  try {
    entries = await readdir(partitionsPath, { withFileTypes: true });
  } catch (error) {
    if (isMissingFileError(error)) {
      return;
    }

    throw error;
  }

  const resolvedRoot = resolve(partitionsPath);

  await Promise.all(
    entries
      .filter((entry) => entry.isDirectory() && entry.name.startsWith("seekstar-tab-"))
      .map(async (entry) => {
        const partitionPath = resolve(partitionsPath, entry.name);

        if (!partitionPath.startsWith(`${resolvedRoot}${sep}`)) {
          return;
        }

        await rm(partitionPath, { force: true, recursive: true });
      }),
  );
}

function isMissingFileError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
}
