import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { ExplorationViewCheckpoint, WorldDocument } from "@seekstar/core-schema";

export interface WorldRepositorySnapshot {
  version: 1;
  worlds_by_tab_id: Record<string, WorldDocument>;
  view_checkpoints_by_tab_id: Record<string, ExplorationViewCheckpoint>;
  updated_at: string;
}

export class JsonWorldRepository {
  private snapshot: WorldRepositorySnapshot | undefined;
  private saveChain: Promise<void> = Promise.resolve();
  private mutationChain: Promise<void> = Promise.resolve();
  private saveTimer: NodeJS.Timeout | undefined;
  private pendingResolvers: Array<{ resolve: () => void; reject: (error: unknown) => void }> = [];

  constructor(private readonly repositoryPath: string, private readonly saveDelayMs = 500) {}

  async load(): Promise<WorldRepositorySnapshot> {
    if (this.snapshot) return structuredClone(this.snapshot);
    try {
      const parsed = JSON.parse(await readFile(this.repositoryPath, "utf8")) as unknown;
      this.snapshot = isSnapshot(parsed) ? parsed : emptySnapshot();
    } catch {
      this.snapshot = emptySnapshot();
    }
    return structuredClone(this.snapshot);
  }

  async getWorld(tabId: string): Promise<WorldDocument | undefined> { return (await this.load()).worlds_by_tab_id[tabId]; }
  async getViewCheckpoint(tabId: string): Promise<ExplorationViewCheckpoint | undefined> { return (await this.load()).view_checkpoints_by_tab_id[tabId]; }

  async saveWorld(world: WorldDocument): Promise<void> {
    return this.mutate((next) => { next.worlds_by_tab_id[world.tab_id] = structuredClone(world); });
  }

  async saveViewCheckpoint(checkpoint: ExplorationViewCheckpoint): Promise<void> {
    return this.mutate((next) => {
      const current = next.view_checkpoints_by_tab_id[checkpoint.tab_id];
      if (!current || current.view_revision < checkpoint.view_revision) next.view_checkpoints_by_tab_id[checkpoint.tab_id] = structuredClone(checkpoint);
    });
  }

  async deleteWorld(tabId: string): Promise<void> {
    return this.mutate((next) => { delete next.worlds_by_tab_id[tabId]; delete next.view_checkpoints_by_tab_id[tabId]; });
  }

  async clear(): Promise<void> {
    return this.mutate((next) => { next.worlds_by_tab_id = {}; next.view_checkpoints_by_tab_id = {}; });
  }

  async flush(): Promise<void> {
    await this.mutationChain.catch(() => undefined);
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
      this.saveTimer = undefined;
      this.commitPendingSave();
    }
    await this.saveChain;
  }

  private queueSave(): Promise<void> {
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => {
      this.saveTimer = undefined;
      this.commitPendingSave();
    }, this.saveDelayMs);
    return new Promise<void>((resolve, reject) => this.pendingResolvers.push({ resolve, reject }));
  }

  private async mutate(update: (snapshot: WorldRepositorySnapshot) => void): Promise<void> {
    let persisted = Promise.resolve();
    const mutation = this.mutationChain.catch(() => undefined).then(async () => {
      const next = await this.load();
      update(next);
      next.updated_at = new Date().toISOString();
      this.snapshot = next;
      persisted = this.queueSave();
    });
    this.mutationChain = mutation;
    await mutation;
    await persisted;
  }

  private commitPendingSave(): void {
    const snapshot = structuredClone(this.snapshot ?? emptySnapshot());
    const waiters = this.pendingResolvers.splice(0);
    this.saveChain = this.saveChain.catch(() => undefined).then(async () => {
      const temporary = `${this.repositoryPath}.${process.pid}.${Date.now()}.tmp`;
      await mkdir(dirname(this.repositoryPath), { recursive: true });
      await writeFile(temporary, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
      await replaceFile(temporary, this.repositoryPath);
    });
    void this.saveChain.then(() => waiters.forEach((waiter) => waiter.resolve()), (error) => waiters.forEach((waiter) => waiter.reject(error)));
  }
}

function emptySnapshot(): WorldRepositorySnapshot { return { version: 1, worlds_by_tab_id: {}, view_checkpoints_by_tab_id: {}, updated_at: new Date().toISOString() }; }
function isSnapshot(value: unknown): value is WorldRepositorySnapshot {
  if (!value || typeof value !== "object") return false;
  const input = value as Partial<WorldRepositorySnapshot>;
  return input.version === 1 && !!input.worlds_by_tab_id && typeof input.worlds_by_tab_id === "object" && !!input.view_checkpoints_by_tab_id && typeof input.view_checkpoints_by_tab_id === "object";
}
async function replaceFile(source: string, destination: string): Promise<void> {
  try { await rename(source, destination); } catch (error) {
    if (!error || typeof error !== "object" || !("code" in error) || !["EPERM", "EEXIST"].includes(String(error.code))) throw error;
    await rm(destination, { force: true });
    await rename(source, destination);
  }
}
