import { app, ipcMain } from "electron";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

const STORE_FILE_NAME = "seekstar-workspace-snapshot.json";

export function registerWorkspaceStore(): void {
  ipcMain.handle("workspace:load", async () => {
    try {
      const content = await readFile(getStorePath(), "utf8");
      return JSON.parse(content) as unknown;
    } catch (error) {
      if (isMissingFileError(error)) {
        return undefined;
      }

      throw error;
    }
  });

  ipcMain.handle("workspace:save", async (_event, snapshot: unknown) => {
    const storePath = getStorePath();
    const tmpPath = `${storePath}.tmp`;

    await mkdir(dirname(storePath), { recursive: true });
    await writeFile(tmpPath, JSON.stringify(snapshot, null, 2), "utf8");
    await rename(tmpPath, storePath);
  });
}

function getStorePath(): string {
  return join(app.getPath("userData"), STORE_FILE_NAME);
}

function isMissingFileError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
}
