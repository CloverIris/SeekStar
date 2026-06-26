import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { isWorkspaceSnapshot, type CartographerLevelRuntimeOutput, type WorkspaceSnapshot } from "@seekstar/constellation-engine";

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

export type WorkspaceChangeKind = "saved" | "cleared" | "development_data_cleared";

export interface WorkspaceChangeEvent {
  kind: WorkspaceChangeKind;
  revision: number;
  source: "storage-service";
  updated_at: string;
}

export interface SeekStarStorageService<TBasketItem = unknown> {
  health(): Promise<StorageHealth>;
  loadWorkspaceSnapshot(): Promise<WorkspaceSnapshot<TBasketItem> | undefined>;
  saveWorkspaceSnapshot(snapshot: WorkspaceSnapshot<TBasketItem>): Promise<void>;
  clearWorkspaceSnapshot(): Promise<void>;
}

export interface WorkspaceSnapshotInspection {
  active_tab_id?: string;
  error_message?: string;
  path: string;
  quarantine_path?: string;
  schema_revision?: number;
  status: "missing" | "valid" | "invalid_json" | "invalid_schema";
  tab_count?: number;
  updated_at?: string;
}

export interface JsonWorkspaceStorageOptions {
  quarantineInvalidJson?: boolean;
  quarantineInvalidSchema?: boolean;
}

export interface LevelChunkCacheInput {
  mode: string;
  level_id: string;
  seed: string;
  chunk_key: string;
  chunk_policy_key?: string;
  focus_key?: string;
  prompt_profile_id?: string;
}

export interface LevelChunkCacheRecord {
  access_count: number;
  bytes_estimate: number;
  cache_key: string;
  created_at: string;
  input: LevelChunkCacheInput;
  last_accessed_at: string;
  output: CartographerLevelRuntimeOutput;
}

export interface LevelChunkCacheSnapshot {
  version: 1;
  schema_revision: 1 | 2;
  records_by_key: Record<string, LevelChunkCacheRecord>;
  updated_at: string;
}

export interface LevelChunkCachePruneResult {
  evicted: string[];
  remaining: number;
}

export interface SeekStarLevelChunkStorage {
  clearChunks(): Promise<void>;
  deleteChunk(cacheKey: string): Promise<void>;
  listChunks(): Promise<LevelChunkCacheRecord[]>;
  loadChunk(cacheKey: string): Promise<LevelChunkCacheRecord | undefined>;
  pruneChunks(maxEntries: number): Promise<LevelChunkCachePruneResult>;
  saveChunk(record: LevelChunkCacheRecord): Promise<void>;
}

export class JsonWorkspaceStorage<TBasketItem = unknown> implements SeekStarStorageService<TBasketItem> {
  private saveChain: Promise<void> = Promise.resolve();

  constructor(
    private readonly snapshotPath: string,
    private readonly options: JsonWorkspaceStorageOptions = {},
  ) {}

  async health(): Promise<StorageHealth> {
    return {
      adapter: "json",
      available: true,
      path: this.snapshotPath,
    };
  }

  async loadWorkspaceSnapshot(): Promise<WorkspaceSnapshot<TBasketItem> | undefined> {
    const inspection = await this.inspectWorkspaceSnapshot();

    if (inspection.status !== "valid") {
      return undefined;
    }

    const parsed = JSON.parse(await readFile(this.snapshotPath, "utf8")) as unknown;
    return isWorkspaceSnapshot<TBasketItem>(parsed) ? parsed : undefined;
  }

  async saveWorkspaceSnapshot(snapshot: WorkspaceSnapshot<TBasketItem>): Promise<void> {
    const nextSave = this.saveChain.catch(() => undefined).then(() => this.writeWorkspaceSnapshot(snapshot));
    this.saveChain = nextSave;
    return nextSave;
  }

  async clearWorkspaceSnapshot(): Promise<void> {
    await rm(this.snapshotPath, { force: true });
  }

  async inspectWorkspaceSnapshot(): Promise<WorkspaceSnapshotInspection> {
    let content: string;

    try {
      content = await readFile(this.snapshotPath, "utf8");
    } catch (error) {
      if (isMissingFileError(error)) {
        return {
          path: this.snapshotPath,
          status: "missing",
        };
      }

      throw error;
    }

    let parsed: unknown;

    try {
      parsed = JSON.parse(content) as unknown;
    } catch (error) {
      const inspection: WorkspaceSnapshotInspection = {
        error_message: getErrorMessage(error),
        path: this.snapshotPath,
        status: "invalid_json",
      };

      if (this.options.quarantineInvalidJson ?? true) {
        inspection.quarantine_path = await quarantineJsonFile(this.snapshotPath);
      }

      return inspection;
    }

    if (!isWorkspaceSnapshot<TBasketItem>(parsed)) {
      const inspection: WorkspaceSnapshotInspection = {
        error_message: "Workspace snapshot failed schema validation.",
        path: this.snapshotPath,
        status: "invalid_schema",
      };

      if (this.options.quarantineInvalidSchema ?? false) {
        inspection.quarantine_path = await quarantineJsonFile(this.snapshotPath);
      }

      return inspection;
    }

    return {
      active_tab_id: parsed.active_tab_id,
      path: this.snapshotPath,
      schema_revision: parsed.schema_revision,
      status: "valid",
      tab_count: Object.keys(parsed.scenes_by_tab_id).length,
      updated_at: parsed.updated_at,
    };
  }

  private async writeWorkspaceSnapshot(snapshot: WorkspaceSnapshot<TBasketItem>): Promise<void> {
    const tempPath = createTempJsonPath(this.snapshotPath);

    await mkdir(dirname(this.snapshotPath), { recursive: true });
    await writeFile(tempPath, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
    await replaceJsonFile(tempPath, this.snapshotPath);
  }
}

export class JsonLevelChunkStorage implements SeekStarLevelChunkStorage {
  constructor(private readonly chunkCachePath: string) {}

  async clearChunks(): Promise<void> {
    rmSync(this.chunkCachePath, { force: true });
  }

  async deleteChunk(cacheKey: string): Promise<void> {
    const snapshot = this.loadSnapshot();

    if (!snapshot.records_by_key[cacheKey]) {
      return;
    }

    delete snapshot.records_by_key[cacheKey];
    this.saveSnapshot(snapshot);
  }

  async listChunks(): Promise<LevelChunkCacheRecord[]> {
    return Object.values(this.loadSnapshot().records_by_key).sort((left, right) => left.cache_key.localeCompare(right.cache_key));
  }

  async loadChunk(cacheKey: string): Promise<LevelChunkCacheRecord | undefined> {
    return this.loadSnapshot().records_by_key[cacheKey];
  }

  async pruneChunks(maxEntries: number): Promise<LevelChunkCachePruneResult> {
    const snapshot = this.loadSnapshot();
    const limit = Math.max(0, Math.floor(maxEntries));
    const records = Object.values(snapshot.records_by_key);

    if (records.length <= limit) {
      return { evicted: [], remaining: records.length };
    }

    const keep = new Set(
      records
        .sort((left, right) => {
          if (left.access_count !== right.access_count) {
            return right.access_count - left.access_count;
          }

          return right.last_accessed_at.localeCompare(left.last_accessed_at);
        })
        .slice(0, limit)
        .map((record) => record.cache_key),
    );
    const evicted = records.filter((record) => !keep.has(record.cache_key)).map((record) => record.cache_key);
    snapshot.records_by_key = Object.fromEntries(records.filter((record) => keep.has(record.cache_key)).map((record) => [record.cache_key, record]));
    this.saveSnapshot(snapshot);

    return { evicted, remaining: Object.keys(snapshot.records_by_key).length };
  }

  async saveChunk(record: LevelChunkCacheRecord): Promise<void> {
    const snapshot = this.loadSnapshot();
    const normalizedRecord = normalizeChunkCacheRecord(record);

    snapshot.records_by_key[normalizedRecord.cache_key] = normalizedRecord;
    this.saveSnapshot(snapshot);
  }

  private loadSnapshot(): LevelChunkCacheSnapshot {
    try {
      const parsed = JSON.parse(readFileSync(this.chunkCachePath, "utf8")) as unknown;

      return isLevelChunkCacheSnapshot(parsed) ? parsed : createEmptyChunkCacheSnapshot();
    } catch {
      return createEmptyChunkCacheSnapshot();
    }
  }

  private saveSnapshot(snapshot: LevelChunkCacheSnapshot): void {
    mkdirSync(dirname(this.chunkCachePath), { recursive: true });
    writeFileSync(
      this.chunkCachePath,
      `${JSON.stringify(
        {
          ...snapshot,
          schema_revision: 2,
          updated_at: new Date().toISOString(),
        },
        null,
        2,
      )}\n`,
      "utf8",
    );
  }
}

export function createLevelChunkCacheRecord(input: {
  accessCount?: number;
  cacheKey: string;
  createdAt?: string;
  input: LevelChunkCacheInput;
  lastAccessedAt?: string;
  output: CartographerLevelRuntimeOutput;
}): LevelChunkCacheRecord {
  const now = new Date().toISOString();
  const outputText = JSON.stringify(input.output);

  return normalizeChunkCacheRecord({
    access_count: input.accessCount ?? 1,
    bytes_estimate: outputText.length,
    cache_key: input.cacheKey,
    created_at: input.createdAt ?? now,
    input: input.input,
    last_accessed_at: input.lastAccessedAt ?? now,
    output: input.output,
  });
}

function createEmptyChunkCacheSnapshot(): LevelChunkCacheSnapshot {
  return {
    version: 1,
    schema_revision: 2,
    records_by_key: {},
    updated_at: new Date().toISOString(),
  };
}

function isLevelChunkCacheSnapshot(value: unknown): value is LevelChunkCacheSnapshot {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Partial<LevelChunkCacheSnapshot>;

  return (
    candidate.version === 1 &&
    (candidate.schema_revision === 1 || candidate.schema_revision === 2) &&
    typeof candidate.records_by_key === "object" &&
    candidate.records_by_key !== null
  );
}

function normalizeChunkCacheRecord(record: LevelChunkCacheRecord): LevelChunkCacheRecord {
  return {
    access_count: Math.max(0, Math.floor(record.access_count)),
    bytes_estimate: Math.max(0, Math.floor(record.bytes_estimate)),
    cache_key: record.cache_key.trim(),
    created_at: record.created_at,
    input: {
        mode: record.input.mode,
        level_id: record.input.level_id,
        seed: record.input.seed,
        chunk_key: record.input.chunk_key,
        chunk_policy_key: record.input.chunk_policy_key,
        focus_key: record.input.focus_key,
        prompt_profile_id: record.input.prompt_profile_id,
      },
    last_accessed_at: record.last_accessed_at,
    output: record.output,
  };
}

function createTempJsonPath(path: string): string {
  return `${path}.${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}.tmp`;
}

async function replaceJsonFile(sourcePath: string, destinationPath: string): Promise<void> {
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

async function quarantineJsonFile(path: string): Promise<string | undefined> {
  const quarantinePath = `${path}.corrupt-${Date.now()}`;

  try {
    await rename(path, quarantinePath);
    return quarantinePath;
  } catch {
    return undefined;
  }
}

function isMissingFileError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
}

function isReplaceFailure(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && (error.code === "EPERM" || error.code === "EEXIST");
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
