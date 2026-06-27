import { app, BrowserWindow, ipcMain } from "electron";
import { mkdir, readFile, rename, rm, unlink, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { CartographerChunkLifecycleRecord } from "@seekstar/constellation-engine";

const CARTOGRAPHER_CHUNK_FILE_NAME = "seekstar-cartographer-chunks.json";
const MAX_RECORDS_PER_TAB = 240;

export interface CartographerChunkStoreRecord extends Omit<CartographerChunkLifecycleRecord, "phase"> {
  phase: CartographerChunkLifecycleRecord["phase"] | "queued" | "generating" | "error";
}

export interface CartographerChunkStoreSnapshot {
  records: CartographerChunkStoreRecord[];
  tab_id: string;
  updated_at: string;
}

interface CartographerChunkStoreFile {
  chunks_by_tab_id: Record<string, CartographerChunkStoreSnapshot>;
  version: 1;
}

let cartographerChunkSaveChain: Promise<void> = Promise.resolve();
const cartographerChunkSubscribersByWebContentsId = new Map<number, string>();
const cartographerChunkSubscriberCleanupByWebContentsId = new Map<number, () => void>();

export function registerCartographerChunkStore(): void {
  ipcMain.removeHandler("cartographer-chunks:load");
  ipcMain.removeHandler("cartographer-chunks:save");
  ipcMain.removeHandler("cartographer-chunks:subscribe");
  ipcMain.removeHandler("cartographer-chunks:clear");

  ipcMain.handle("cartographer-chunks:load", async (_event, tabId: unknown): Promise<CartographerChunkStoreSnapshot> => {
    const normalizedTabId = parseTabId(tabId);
    const store = await loadCartographerChunkStore();

    return store.chunks_by_tab_id[normalizedTabId] ?? createEmptyCartographerChunkSnapshot(normalizedTabId);
  });

  ipcMain.handle("cartographer-chunks:save", async (_event, snapshot: unknown): Promise<CartographerChunkStoreSnapshot> => {
    const normalized = normalizeCartographerChunkSnapshot(snapshot);
    const store = await loadCartographerChunkStore();

    await saveCartographerChunkStore({
      version: 1,
      chunks_by_tab_id: {
        ...store.chunks_by_tab_id,
        [normalized.tab_id]: normalized,
      },
    });

    return normalized;
  });

  ipcMain.handle("cartographer-chunks:subscribe", async (event, tabId: unknown): Promise<CartographerChunkStoreSnapshot> => {
    const normalizedTabId = parseTabId(tabId);
    const sender = event.sender;
    const previousCleanup = cartographerChunkSubscriberCleanupByWebContentsId.get(sender.id);

    if (previousCleanup) {
      sender.off("destroyed", previousCleanup);
    }

    const cleanup = (): void => {
      cartographerChunkSubscribersByWebContentsId.delete(sender.id);
      cartographerChunkSubscriberCleanupByWebContentsId.delete(sender.id);
    };

    cartographerChunkSubscribersByWebContentsId.set(sender.id, normalizedTabId);
    cartographerChunkSubscriberCleanupByWebContentsId.set(sender.id, cleanup);
    sender.once("destroyed", cleanup);

    const store = await loadCartographerChunkStore();
    return store.chunks_by_tab_id[normalizedTabId] ?? createEmptyCartographerChunkSnapshot(normalizedTabId);
  });

  ipcMain.handle("cartographer-chunks:clear", async (_event, tabId: unknown): Promise<CartographerChunkStoreSnapshot> => {
    const normalizedTabId = parseTabId(tabId);
    const store = await loadCartographerChunkStore();
    const nextChunksByTabId = { ...store.chunks_by_tab_id };
    delete nextChunksByTabId[normalizedTabId];

    await saveCartographerChunkStore({
      version: 1,
      chunks_by_tab_id: nextChunksByTabId,
    });

    const snapshot = createEmptyCartographerChunkSnapshot(normalizedTabId);
    broadcastCartographerChunkSnapshot(snapshot);

    return snapshot;
  });
}

export async function appendCartographerChunkRecords(
  tabId: string,
  records: CartographerChunkStoreRecord[],
  excludeWebContentsId?: number,
): Promise<CartographerChunkStoreSnapshot> {
  const normalizedTabId = parseTabId(tabId);
  const store = await loadCartographerChunkStore();
  const currentSnapshot = store.chunks_by_tab_id[normalizedTabId] ?? createEmptyCartographerChunkSnapshot(normalizedTabId);
  const nextSnapshot = normalizeCartographerChunkSnapshot({
    tab_id: normalizedTabId,
    records: mergeCartographerChunkRecords(currentSnapshot.records, records),
    updated_at: new Date().toISOString(),
  });

  await saveCartographerChunkStore({
    version: 1,
    chunks_by_tab_id: {
      ...store.chunks_by_tab_id,
      [normalizedTabId]: nextSnapshot,
    },
  });
  broadcastCartographerChunkSnapshot(nextSnapshot, excludeWebContentsId);

  return nextSnapshot;
}

export function getCartographerChunkStorePath(): string {
  return join(app.getPath("userData"), CARTOGRAPHER_CHUNK_FILE_NAME);
}

export async function clearCartographerChunkData(): Promise<void> {
  await unlinkIfPresent(getCartographerChunkStorePath());
}

async function loadCartographerChunkStore(): Promise<CartographerChunkStoreFile> {
  const storePath = getCartographerChunkStorePath();

  try {
    const content = await readFile(storePath, "utf8");

    try {
      return normalizeCartographerChunkStore(JSON.parse(content));
    } catch (error) {
      if (isJsonParseError(error)) {
        await quarantineCorruptJson(storePath, error);
        return createEmptyCartographerChunkStore();
      }

      throw error;
    }
  } catch (error) {
    if (isMissingFileError(error)) {
      return createEmptyCartographerChunkStore();
    }

    throw error;
  }
}

function saveCartographerChunkStore(store: CartographerChunkStoreFile): Promise<void> {
  const normalized = normalizeCartographerChunkStore(store);
  const nextSave = cartographerChunkSaveChain.catch(() => undefined).then(() => writeCartographerChunkStore(normalized));
  cartographerChunkSaveChain = nextSave;
  return nextSave;
}

async function writeCartographerChunkStore(store: CartographerChunkStoreFile): Promise<void> {
  const storePath = getCartographerChunkStorePath();
  const tmpPath = createTempJsonPath(storePath);

  await mkdir(dirname(storePath), { recursive: true });
  await writeFile(tmpPath, JSON.stringify(store, null, 2), "utf8");
  await replaceFile(tmpPath, storePath);
}

function normalizeCartographerChunkStore(value: unknown): CartographerChunkStoreFile {
  const candidate = typeof value === "object" && value !== null ? (value as Partial<CartographerChunkStoreFile>) : {};
  const chunksByTabId = typeof candidate.chunks_by_tab_id === "object" && candidate.chunks_by_tab_id !== null
    ? candidate.chunks_by_tab_id
    : {};
  const normalizedChunksByTabId: Record<string, CartographerChunkStoreSnapshot> = {};

  for (const [key, value] of Object.entries(chunksByTabId)) {
    try {
      const snapshot = normalizeCartographerChunkSnapshot({
        ...(typeof value === "object" && value !== null ? value : {}),
        tab_id: key,
      });

      normalizedChunksByTabId[snapshot.tab_id] = snapshot;
    } catch {
      // Chunk lifecycle records are cache-like runtime UI state. Ignore malformed entries.
    }
  }

  return {
    version: 1,
    chunks_by_tab_id: normalizedChunksByTabId,
  };
}

function normalizeCartographerChunkSnapshot(value: unknown): CartographerChunkStoreSnapshot {
  const candidate = typeof value === "object" && value !== null ? (value as Partial<CartographerChunkStoreSnapshot>) : {};
  const tabId = parseTabId(candidate.tab_id);
  const records = Array.isArray(candidate.records)
    ? candidate.records
        .map(normalizeCartographerChunkRecord)
        .filter((record): record is CartographerChunkStoreRecord => Boolean(record))
        .slice(0, MAX_RECORDS_PER_TAB)
    : [];

  return {
    records,
    tab_id: tabId,
    updated_at: typeof candidate.updated_at === "string" ? candidate.updated_at : new Date().toISOString(),
  };
}

function normalizeCartographerChunkRecord(value: unknown): CartographerChunkStoreRecord | undefined {
  const candidate = typeof value === "object" && value !== null ? (value as Partial<CartographerChunkStoreRecord>) : {};

  if (!candidate.chunkKey || !isCartographerChunkPhase(candidate.phase) || !isCartographerChunkRole(candidate.role)) {
    return undefined;
  }

  const levelId = typeof candidate.levelId === "string" ? candidate.levelId : undefined;
  const mode = typeof candidate.mode === "string" ? candidate.mode : undefined;

  if (!levelId || !mode) {
    return undefined;
  }

  return {
    cacheStatus: isCartographerCacheStatus(candidate.cacheStatus) ? candidate.cacheStatus : undefined,
    chunkKey: String(candidate.chunkKey).slice(0, 120),
    levelId: levelId as CartographerChunkStoreRecord["levelId"],
    message: typeof candidate.message === "string" ? candidate.message.slice(0, 400) : "",
    mode: mode as CartographerChunkStoreRecord["mode"],
    phase: candidate.phase,
    ring: normalizeFiniteNumber(candidate.ring),
    role: candidate.role,
    updatedAt: typeof candidate.updatedAt === "string" ? candidate.updatedAt : new Date().toISOString(),
    x: normalizeFiniteNumber(candidate.x),
    y: normalizeFiniteNumber(candidate.y),
    z: normalizeFiniteNumber(candidate.z),
  };
}

function mergeCartographerChunkRecords(
  current: CartographerChunkStoreRecord[],
  incoming: CartographerChunkStoreRecord[],
): CartographerChunkStoreRecord[] {
  const byKey = new Map<string, CartographerChunkStoreRecord>();

  for (const record of [...current, ...incoming]) {
    const normalized = normalizeCartographerChunkRecord(record);

    if (normalized) {
      byKey.set(createCartographerChunkRecordKey(normalized), normalized);
    }
  }

  return Array.from(byKey.values())
    .sort(compareCartographerChunkRecords)
    .slice(0, MAX_RECORDS_PER_TAB);
}

function createCartographerChunkRecordKey(record: CartographerChunkStoreRecord): string {
  return `${record.levelId}:${record.chunkKey}`;
}

function compareCartographerChunkRecords(left: CartographerChunkStoreRecord, right: CartographerChunkStoreRecord): number {
  const updatedCompare = right.updatedAt.localeCompare(left.updatedAt);

  if (updatedCompare !== 0) {
    return updatedCompare;
  }

  return createCartographerChunkRecordKey(left).localeCompare(createCartographerChunkRecordKey(right));
}

function broadcastCartographerChunkSnapshot(snapshot: CartographerChunkStoreSnapshot, excludeWebContentsId?: number): void {
  for (const targetWebContents of BrowserWindow.getAllWindows().map((window) => window.webContents)) {
    if (targetWebContents.id === excludeWebContentsId || targetWebContents.isDestroyed()) {
      continue;
    }

    if (cartographerChunkSubscribersByWebContentsId.get(targetWebContents.id) !== snapshot.tab_id) {
      continue;
    }

    targetWebContents.send("cartographer-chunks:changed", snapshot);
  }
}

function createEmptyCartographerChunkSnapshot(tabId: string): CartographerChunkStoreSnapshot {
  return {
    records: [],
    tab_id: tabId,
    updated_at: new Date().toISOString(),
  };
}

function createEmptyCartographerChunkStore(): CartographerChunkStoreFile {
  return {
    version: 1,
    chunks_by_tab_id: {},
  };
}

function parseTabId(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error("Cartographer chunk tab id must be a non-empty string.");
  }

  return value.trim().slice(0, 240);
}

function normalizeFiniteNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function isCartographerChunkPhase(value: unknown): value is CartographerChunkStoreRecord["phase"] {
  return value === "queued" || value === "generating" || value === "applied" || value === "error" || value === "cancelled";
}

function isCartographerChunkRole(value: unknown): value is CartographerChunkStoreRecord["role"] {
  return value === "active" || value === "preload";
}

function isCartographerCacheStatus(value: unknown): value is CartographerChunkStoreRecord["cacheStatus"] {
  return value === "hit" || value === "miss" || value === "refresh";
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

function isMissingFileError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
}

function isJsonParseError(error: unknown): boolean {
  return error instanceof SyntaxError;
}

async function quarantineCorruptJson(path: string, error: unknown): Promise<void> {
  const quarantinePath = `${path}.corrupt-${Date.now()}`;

  try {
    await rename(path, quarantinePath);
    console.warn(`[SeekStar] Ignored corrupt Cartographer chunk JSON and moved it to ${quarantinePath}: ${getErrorMessage(error)}`);
  } catch (renameError) {
    console.warn(`[SeekStar] Failed to quarantine corrupt Cartographer chunk JSON at ${path}: ${getErrorMessage(renameError)}`);
  }
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
