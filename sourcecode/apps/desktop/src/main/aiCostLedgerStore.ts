import { app, ipcMain } from "electron";
import type { AiModelTelemetry } from "@seekstar/ai-service";
import { mkdir, readFile, rename, rm, unlink, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

const AI_COST_LEDGER_FILE_NAME = "seekstar-ai-cost-ledger.json";
const MAX_AI_COST_LEDGER_RECORDS = 1000;

export type AiCostLedgerSource = "assistant" | "cartographer";

export interface AiCostLedgerAppendInput {
  intent?: string;
  level_id?: string;
  mode?: string;
  model?: string;
  provider_id?: string;
  seed?: string;
  source: AiCostLedgerSource;
  status: string;
  tab_id?: string;
  telemetry?: AiModelTelemetry;
}

export interface AiCostLedgerRecord {
  attempts: number;
  completed_at: string;
  duration_ms: number;
  estimated_cost_usd?: number;
  id: string;
  input_tokens?: number;
  intent?: string;
  level_id?: string;
  mode?: string;
  model?: string;
  output_tokens?: number;
  provider_id?: string;
  seed?: string;
  source: AiCostLedgerSource;
  started_at: string;
  status: string;
  tab_id?: string;
  total_tokens?: number;
}

export interface AiCostLedgerSummary {
  by_source: Record<AiCostLedgerSource, AiCostLedgerSummaryBucket>;
  estimated_cost_usd: number;
  input_tokens: number;
  output_tokens: number;
  records: number;
  total_tokens: number;
}

export interface AiCostLedgerSummaryBucket {
  estimated_cost_usd: number;
  records: number;
  total_tokens: number;
}

export interface AiCostLedgerSnapshot {
  records: AiCostLedgerRecord[];
  summary: AiCostLedgerSummary;
  updated_at: string;
  version: 1;
}

interface AiCostLedgerFile {
  records: AiCostLedgerRecord[];
  updated_at: string;
  version: 1;
}

let aiCostLedgerSaveChain: Promise<void> = Promise.resolve();

export function registerAiCostLedgerStore(): void {
  ipcMain.removeHandler("ai-cost-ledger:load");
  ipcMain.removeHandler("ai-cost-ledger:clear");
  ipcMain.removeHandler("ai-cost-ledger:export");

  ipcMain.handle("ai-cost-ledger:load", async (): Promise<AiCostLedgerSnapshot> => createAiCostLedgerSnapshot(await loadAiCostLedgerStore()));
  ipcMain.handle("ai-cost-ledger:clear", async (): Promise<AiCostLedgerSnapshot> => {
    const empty = createEmptyAiCostLedgerStore();
    await saveAiCostLedgerStore(empty);

    return createAiCostLedgerSnapshot(empty);
  });
  ipcMain.handle("ai-cost-ledger:export", async (): Promise<string> =>
    JSON.stringify(createAiCostLedgerSnapshot(await loadAiCostLedgerStore()), null, 2),
  );
}

export async function appendAiCostLedgerRecord(input: AiCostLedgerAppendInput): Promise<AiCostLedgerSnapshot> {
  const record = createAiCostLedgerRecord(input);

  if (!record) {
    return createAiCostLedgerSnapshot(await loadAiCostLedgerStore());
  }

  return appendAiCostLedgerRecords([record]);
}

export async function appendAiCostLedgerRecords(inputs: AiCostLedgerAppendInput[]): Promise<AiCostLedgerSnapshot> {
  const records = inputs.flatMap((input) => {
    const record = createAiCostLedgerRecord(input);

    return record ? [record] : [];
  });

  if (records.length === 0) {
    return createAiCostLedgerSnapshot(await loadAiCostLedgerStore());
  }

  const store = await loadAiCostLedgerStore();
  const nextStore: AiCostLedgerFile = {
    version: 1,
    records: [...records, ...store.records].slice(0, MAX_AI_COST_LEDGER_RECORDS),
    updated_at: new Date().toISOString(),
  };

  await saveAiCostLedgerStore(nextStore);

  return createAiCostLedgerSnapshot(nextStore);
}

export function getAiCostLedgerStorePath(): string {
  return join(app.getPath("userData"), AI_COST_LEDGER_FILE_NAME);
}

export async function clearAiCostLedgerData(): Promise<void> {
  await unlinkIfPresent(getAiCostLedgerStorePath());
}

function createAiCostLedgerRecord(input: AiCostLedgerAppendInput): AiCostLedgerRecord | undefined {
  const telemetry = input.telemetry;

  if (!telemetry) {
    return undefined;
  }

  return {
    attempts: Math.max(1, Math.round(telemetry.attempts)),
    completed_at: telemetry.completed_at,
    duration_ms: Math.max(0, Math.round(telemetry.duration_ms)),
    estimated_cost_usd: normalizeOptionalCost(telemetry.estimated_cost_usd),
    id: `ai-cost-${input.source}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    input_tokens: normalizeOptionalTokenCount(telemetry.usage?.input_tokens),
    intent: normalizeOptionalString(input.intent),
    level_id: normalizeOptionalString(input.level_id),
    mode: normalizeOptionalString(input.mode),
    model: normalizeOptionalString(input.model),
    output_tokens: normalizeOptionalTokenCount(telemetry.usage?.output_tokens),
    provider_id: normalizeOptionalString(input.provider_id),
    seed: normalizeOptionalString(input.seed),
    source: input.source,
    started_at: telemetry.started_at,
    status: input.status,
    tab_id: normalizeOptionalString(input.tab_id),
    total_tokens: normalizeOptionalTokenCount(telemetry.usage?.total_tokens),
  };
}

async function loadAiCostLedgerStore(): Promise<AiCostLedgerFile> {
  const storePath = getAiCostLedgerStorePath();

  try {
    const content = await readFile(storePath, "utf8");
    return normalizeAiCostLedgerStore(JSON.parse(content));
  } catch (error) {
    if (isMissingFileError(error) || error instanceof SyntaxError) {
      return createEmptyAiCostLedgerStore();
    }

    throw error;
  }
}

function saveAiCostLedgerStore(store: AiCostLedgerFile): Promise<void> {
  const normalized = normalizeAiCostLedgerStore(store);
  const nextSave = aiCostLedgerSaveChain.catch(() => undefined).then(() => writeAiCostLedgerStore(normalized));
  aiCostLedgerSaveChain = nextSave;
  return nextSave;
}

async function writeAiCostLedgerStore(store: AiCostLedgerFile): Promise<void> {
  const storePath = getAiCostLedgerStorePath();
  const tmpPath = `${storePath}.${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}.tmp`;

  await mkdir(dirname(storePath), { recursive: true });
  await writeFile(tmpPath, JSON.stringify(store, null, 2), "utf8");
  await replaceFile(tmpPath, storePath);
}

function createAiCostLedgerSnapshot(store: AiCostLedgerFile): AiCostLedgerSnapshot {
  const normalized = normalizeAiCostLedgerStore(store);

  return {
    ...normalized,
    summary: summarizeAiCostLedger(normalized.records),
  };
}

function summarizeAiCostLedger(records: AiCostLedgerRecord[]): AiCostLedgerSummary {
  const bySource: AiCostLedgerSummary["by_source"] = {
    assistant: createEmptyAiCostLedgerSummaryBucket(),
    cartographer: createEmptyAiCostLedgerSummaryBucket(),
  };

  let estimatedCostUsd = 0;
  let inputTokens = 0;
  let outputTokens = 0;
  let totalTokens = 0;

  for (const record of records) {
    const cost = record.estimated_cost_usd ?? 0;
    const tokens = record.total_tokens ?? 0;
    const bucket = bySource[record.source];

    estimatedCostUsd += cost;
    inputTokens += record.input_tokens ?? 0;
    outputTokens += record.output_tokens ?? 0;
    totalTokens += tokens;
    bucket.estimated_cost_usd += cost;
    bucket.records += 1;
    bucket.total_tokens += tokens;
  }

  return {
    by_source: {
      assistant: roundSummaryBucket(bySource.assistant),
      cartographer: roundSummaryBucket(bySource.cartographer),
    },
    estimated_cost_usd: roundCost(estimatedCostUsd),
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    records: records.length,
    total_tokens: totalTokens,
  };
}

function createEmptyAiCostLedgerSummaryBucket(): AiCostLedgerSummaryBucket {
  return {
    estimated_cost_usd: 0,
    records: 0,
    total_tokens: 0,
  };
}

function roundSummaryBucket(bucket: AiCostLedgerSummaryBucket): AiCostLedgerSummaryBucket {
  return {
    ...bucket,
    estimated_cost_usd: roundCost(bucket.estimated_cost_usd),
  };
}

function normalizeAiCostLedgerStore(value: unknown): AiCostLedgerFile {
  const candidate = typeof value === "object" && value !== null ? (value as Partial<AiCostLedgerFile>) : {};
  const records = Array.isArray(candidate.records)
    ? candidate.records.flatMap((record) => {
        const normalized = normalizeAiCostLedgerRecord(record);

        return normalized ? [normalized] : [];
      })
    : [];

  return {
    version: 1,
    records: records.slice(0, MAX_AI_COST_LEDGER_RECORDS),
    updated_at: typeof candidate.updated_at === "string" ? candidate.updated_at : new Date().toISOString(),
  };
}

function normalizeAiCostLedgerRecord(value: unknown): AiCostLedgerRecord | undefined {
  const candidate = typeof value === "object" && value !== null ? (value as Partial<AiCostLedgerRecord>) : {};

  if (!candidate.id || !isAiCostLedgerSource(candidate.source) || !candidate.started_at || !candidate.completed_at) {
    return undefined;
  }

  return {
    attempts: normalizePositiveInteger(candidate.attempts, 1),
    completed_at: candidate.completed_at,
    duration_ms: normalizePositiveInteger(candidate.duration_ms, 0),
    estimated_cost_usd: normalizeOptionalCost(candidate.estimated_cost_usd),
    id: String(candidate.id).slice(0, 160),
    input_tokens: normalizeOptionalTokenCount(candidate.input_tokens),
    intent: normalizeOptionalString(candidate.intent),
    level_id: normalizeOptionalString(candidate.level_id),
    mode: normalizeOptionalString(candidate.mode),
    model: normalizeOptionalString(candidate.model),
    output_tokens: normalizeOptionalTokenCount(candidate.output_tokens),
    provider_id: normalizeOptionalString(candidate.provider_id),
    seed: normalizeOptionalString(candidate.seed),
    source: candidate.source,
    started_at: candidate.started_at,
    status: typeof candidate.status === "string" ? candidate.status.slice(0, 80) : "unknown",
    tab_id: normalizeOptionalString(candidate.tab_id),
    total_tokens: normalizeOptionalTokenCount(candidate.total_tokens),
  };
}

function createEmptyAiCostLedgerStore(): AiCostLedgerFile {
  return {
    version: 1,
    records: [],
    updated_at: new Date().toISOString(),
  };
}

function isAiCostLedgerSource(value: unknown): value is AiCostLedgerSource {
  return value === "assistant" || value === "cartographer";
}

function normalizeOptionalCost(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? roundCost(value) : undefined;
}

function normalizeOptionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, 240) : undefined;
}

function normalizeOptionalTokenCount(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? Math.round(value) : undefined;
}

function normalizePositiveInteger(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? Math.round(value) : fallback;
}

function roundCost(value: number): number {
  return Number(value.toFixed(8));
}

async function replaceFile(source: string, target: string): Promise<void> {
  const attempts = 6;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      await rename(source, target);
      return;
    } catch (error) {
      if (!isReplaceRetryableError(error)) {
        throw error;
      }

      try {
        await rm(target, { force: true });
        await rename(source, target);
        return;
      } catch (retryError) {
        if (!isReplaceRetryableError(retryError) || attempt === attempts - 1) {
          throw retryError;
        }

        await delay(40 * (attempt + 1));
      }
    }
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
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

function isMissingFileError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && (error as { code?: string }).code === "ENOENT";
}

function isReplaceRetryableError(error: unknown): boolean {
  if (typeof error !== "object" || error === null || !("code" in error)) {
    return false;
  }

  const code = (error as { code?: string }).code;
  return code === "EPERM" || code === "EACCES" || code === "EBUSY" || code === "EEXIST";
}
