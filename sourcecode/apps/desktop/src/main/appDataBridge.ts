import { app, ipcMain } from "electron";
import { readdir, rm } from "node:fs/promises";
import { join } from "node:path";
import type { ExplorationRuntime } from "./explorationRuntime.js";
import { settingsService } from "./settingsService.js";

const LEGACY_FILES = [
  "seekstar-workspace-snapshot.json",
  "seekstar-world-pool.json",
  "seekstar-cartographer-chunks.json",
  "seekstar-tab-runtime.json",
  "seekstar-assistant-sessions.json",
  "seekstar-ai-cost-ledger.json",
] as const;

export function registerAppDataBridge(runtime: ExplorationRuntime): void {
  ipcMain.removeHandler("app-data:get-paths");
  ipcMain.removeHandler("app-data:clear-exploration");
  ipcMain.handle("app-data:get-paths", () => ({
    exploration_worlds: runtime.getRepositoryPath(),
    settings: settingsService.getPath(),
    tab_catalog: join(app.getPath("userData"), "seekstar-tab-catalog-v1.json"),
  }));
  ipcMain.handle("app-data:clear-exploration", async () => {
    await runtime.clearAll();
  });
}

export async function deleteLegacyExplorationData(): Promise<void> {
  const userData = app.getPath("userData");
  await Promise.all(LEGACY_FILES.map((file) => removeLegacyPath(join(userData, file))));
  const partitions = join(userData, "Partitions");
  const entries = await readdir(partitions, { withFileTypes: true }).catch(() => []);
  await Promise.all(entries
    .filter((entry) => entry.isDirectory() && entry.name.startsWith("seekstar-tab-"))
    .map((entry) => removeLegacyPath(join(partitions, entry.name), true)));
}

async function removeLegacyPath(path: string, recursive = false): Promise<void> {
  try {
    await rm(path, { recursive, force: true });
  } catch (error) {
    console.warn(`[SeekStar][cleanup] module=legacy-data event=delete_deferred ${JSON.stringify({ path, reason: error instanceof Error ? error.message : String(error) })}`);
  }
}
