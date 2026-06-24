import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { isWorkspaceSnapshot, type WorkspaceSnapshot } from "@seekstar/constellation-engine";

export interface StorageHealth {
  adapter: "json" | "sqlite";
  available: boolean;
  path?: string;
  details?: string;
}

export interface CachePolicy {
  maxBytes: number;
  inactiveGraceMs: number;
  eviction: "lru_lfu";
}

export interface SeekStarStorageService<TBasketItem = unknown> {
  health(): Promise<StorageHealth>;
  loadWorkspaceSnapshot(): Promise<WorkspaceSnapshot<TBasketItem> | undefined>;
  saveWorkspaceSnapshot(snapshot: WorkspaceSnapshot<TBasketItem>): Promise<void>;
  clearWorkspaceSnapshot(): Promise<void>;
}

export class JsonWorkspaceStorage<TBasketItem = unknown> implements SeekStarStorageService<TBasketItem> {
  constructor(private readonly snapshotPath: string) {}

  async health(): Promise<StorageHealth> {
    return {
      adapter: "json",
      available: true,
      path: this.snapshotPath,
    };
  }

  async loadWorkspaceSnapshot(): Promise<WorkspaceSnapshot<TBasketItem> | undefined> {
    try {
      const parsed = JSON.parse(readFileSync(this.snapshotPath, "utf8")) as unknown;
      return isWorkspaceSnapshot<TBasketItem>(parsed) ? parsed : undefined;
    } catch {
      return undefined;
    }
  }

  async saveWorkspaceSnapshot(snapshot: WorkspaceSnapshot<TBasketItem>): Promise<void> {
    mkdirSync(dirname(this.snapshotPath), { recursive: true });
    writeFileSync(this.snapshotPath, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
  }

  async clearWorkspaceSnapshot(): Promise<void> {
    rmSync(this.snapshotPath, { force: true });
  }
}
