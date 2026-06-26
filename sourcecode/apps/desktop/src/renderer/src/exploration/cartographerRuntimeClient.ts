import type { TerrainScene } from "@seekstar/core-schema";
import type {
  CartographerChunkLifecycleRecord,
  CartographerGenerationMode,
  CartographerLevelBandId,
  CartographerLevelChunkKey,
} from "@seekstar/constellation-engine";

export interface CartographerRuntimeStatus {
  cacheStatus?: "hit" | "miss" | "refresh";
  chunkKey?: string;
  levelId?: CartographerLevelBandId;
  message: string;
  mode?: CartographerGenerationMode;
  phase: "idle" | "generating" | "applied" | "error" | "cancelled";
  updatedAt: string;
}

export interface CartographerChunkRuntimeRecord extends Omit<CartographerChunkLifecycleRecord, "phase"> {
  message: string;
  phase: CartographerChunkLifecycleRecord["phase"] | "queued" | "generating" | "error";
}

export function createCartographerChunkKey(x: number, y: number, ring: number, z = 0): CartographerLevelChunkKey {
  return {
    x,
    y,
    z,
    ring,
    key: `${x}:${y}:${z}:${ring}`,
  };
}

export function createCartographerChunkKeyForViewport(
  viewport: TerrainScene["viewport"],
  chunkWidth = 1200,
  chunkHeight = 900,
): CartographerLevelChunkKey {
  const x = Math.round(viewport.x / chunkWidth);
  const y = Math.round(viewport.y / chunkHeight);
  const ring = Math.max(Math.abs(x), Math.abs(y));

  return createCartographerChunkKey(x, y, ring);
}

export function createQueuedCartographerChunkRecord(input: {
  chunk: CartographerLevelChunkKey;
  levelId: CartographerLevelBandId;
  message: string;
  mode: CartographerGenerationMode;
}): CartographerChunkRuntimeRecord {
  const chunk = normalizeRuntimeChunk(input.chunk);

  return {
    ...chunk,
    chunkKey: chunk.key,
    levelId: input.levelId,
    message: input.message,
    mode: input.mode,
    phase: "queued",
    role: "preload",
    updatedAt: new Date().toISOString(),
  };
}

export function createCartographerRuntimeRecordKey(record: CartographerChunkRuntimeRecord): string {
  return `${record.levelId}:${record.chunkKey}`;
}

export function mergeCartographerChunkRecords(
  current: Record<string, CartographerChunkRuntimeRecord>,
  records: CartographerChunkRuntimeRecord[],
): Record<string, CartographerChunkRuntimeRecord> {
  const next = { ...current };

  for (const record of records) {
    next[createCartographerRuntimeRecordKey(record)] = record;
  }

  return next;
}

export function compareCartographerChunkRecords(left: CartographerChunkRuntimeRecord, right: CartographerChunkRuntimeRecord): number {
  const levelCompare = left.levelId.localeCompare(right.levelId);

  if (levelCompare !== 0) {
    return levelCompare;
  }

  const ringCompare = left.ring - right.ring;

  if (ringCompare !== 0) {
    return ringCompare;
  }

  const yCompare = left.y - right.y;

  if (yCompare !== 0) {
    return yCompare;
  }

  return left.x - right.x;
}

function normalizeRuntimeChunk(chunk: CartographerLevelChunkKey): {
  key: string;
  ring: number;
  x: number;
  y: number;
  z: number;
} {
  return {
    key: chunk.key,
    ring: chunk.ring,
    x: chunk.x,
    y: chunk.y,
    z: chunk.z ?? 0,
  };
}
