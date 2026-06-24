import { app, ipcMain, webContents } from "electron";
import { mkdir, readFile, readdir, rename, rm, unlink, writeFile } from "node:fs/promises";
import { dirname, join, resolve, sep } from "node:path";
import type { WorkspaceChangeEvent, WorkspaceChangeKind } from "@seekstar/storage-service";

const STORE_FILE_NAME = "seekstar-workspace-snapshot.json";
const TAB_RUNTIME_FILE_NAME = "seekstar-tab-runtime.json";
const SETTINGS_FILE_NAME = "seekstar-settings.json";

export interface WorkspaceStorePaths {
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
  private saveChain: Promise<void> = Promise.resolve();

  async loadSnapshot(): Promise<unknown | undefined> {
    const storePath = getStorePath();

    try {
      const content = await readFile(storePath, "utf8");

      try {
        return JSON.parse(content) as unknown;
      } catch (error) {
        if (isJsonParseError(error)) {
          await quarantineCorruptJson(storePath, "workspace snapshot", error);
          return undefined;
        }

        throw error;
      }
    } catch (error) {
      if (isMissingFileError(error)) {
        return undefined;
      }

      throw error;
    }
  }

  saveSnapshot(snapshot: unknown): Promise<void> {
    const nextSave = this.saveChain.catch(() => undefined).then(() => this.writeSnapshot(snapshot));
    this.saveChain = nextSave;
    return nextSave;
  }

  private async writeSnapshot(snapshot: unknown): Promise<void> {
    const storePath = getStorePath();
    const tmpPath = createTempJsonPath(storePath);

    await mkdir(dirname(storePath), { recursive: true });
    await writeFile(tmpPath, JSON.stringify(snapshot, null, 2), "utf8");
    await replaceFile(tmpPath, storePath);
  }

  async clearSnapshot(): Promise<void> {
    await unlinkIfPresent(getStorePath());
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

function createTempJsonPath(path: string): string {
  return `${path}.${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}.tmp`;
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

async function replaceFile(sourcePath: string, destinationPath: string): Promise<void> {
  try {
    await rename(sourcePath, destinationPath);
  } catch (error) {
    if (!isReplaceFailure(error)) {
      throw error;
    }

    await rm(destinationPath, { force: true });
    await rename(sourcePath, destinationPath);
  }
}

function isReplaceFailure(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && (error.code === "EPERM" || error.code === "EEXIST");
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

function isJsonParseError(error: unknown): boolean {
  return error instanceof SyntaxError;
}

async function quarantineCorruptJson(path: string, label: string, error: unknown): Promise<void> {
  const quarantinePath = `${path}.corrupt-${Date.now()}`;

  try {
    await rename(path, quarantinePath);
    console.warn(`[SeekStar] Ignored corrupt ${label} JSON and moved it to ${quarantinePath}: ${getErrorMessage(error)}`);
  } catch (renameError) {
    console.warn(`[SeekStar] Failed to quarantine corrupt ${label} JSON at ${path}: ${getErrorMessage(renameError)}`);
  }
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
