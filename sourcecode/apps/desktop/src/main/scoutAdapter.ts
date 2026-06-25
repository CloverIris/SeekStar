import { ipcMain, utilityProcess } from "electron";
import type { UtilityProcess } from "electron";
import type { ScoutRunRequest, ScoutRunResult } from "@seekstar/core-schema";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { defaultSettings, loadSettings } from "./appSettingsStore";
import { createFailedScoutRunResult, parseScoutRunRequest, ScoutWorkerRuntime } from "./scoutWorkerRuntime";
import type { ScoutWorkerInboundMessage, ScoutWorkerOutboundMessage } from "./scoutWorkerProtocol";

const SCOUT_RUN_PLAN_CHANNEL = "scout:run-plan";
const SCOUT_WORKER_TIMEOUT_MS = 45_000;

export function registerScoutAdapter(): void {
  ipcMain.removeHandler(SCOUT_RUN_PLAN_CHANNEL);
  ipcMain.handle(SCOUT_RUN_PLAN_CHANNEL, async (_event, request: unknown): Promise<ScoutRunResult> => scoutService.run(parseScoutRunRequest(request)));
}

class ScoutService {
  private readonly fallbackRuntime = new ScoutWorkerRuntime();
  private readonly pendingByRequestId = new Map<
    string,
    {
      request: ScoutRunRequest;
      resolve: (result: ScoutRunResult) => void;
      timeoutId: NodeJS.Timeout;
    }
  >();
  private readonly scoutSlotQueue: Array<() => void> = [];
  private readonly queuesByTabId = new Map<string, Promise<ScoutRunResult>>();
  private activeScoutRuns = 0;
  private worker: UtilityProcess | undefined;
  private workerGeneration = 0;

  run(request: ScoutRunRequest): Promise<ScoutRunResult> {
    const previous = this.queuesByTabId.get(request.tab_id) ?? Promise.resolve({
      adapter: "playwright",
      observations: [],
      completed_at: request.requested_at,
    } satisfies ScoutRunResult);
    const next = previous.catch(() => undefined).then(() => this.runNow(request));
    this.queuesByTabId.set(request.tab_id, next);
    return next;
  }

  private async runNow(request: ScoutRunRequest): Promise<ScoutRunResult> {
    const settings = await loadSettings().catch(() => defaultSettings);

    return this.withScoutSlot(settings.scout_concurrency, async () => {
      try {
        return await this.runInUtilityProcess(request, settings.content_providers);
      } catch (error) {
        console.warn(`[SeekStar] Scout utility process unavailable; falling back in main process. ${getErrorMessage(error)}`);
        return this.fallbackRuntime.run(request, settings.content_providers);
      }
    });
  }

  private async withScoutSlot<T>(scoutConcurrency: number, task: () => Promise<T>): Promise<T> {
    const maxConcurrency = Math.max(1, scoutConcurrency);

    if (this.activeScoutRuns >= maxConcurrency) {
      await new Promise<void>((resolve) => {
        this.scoutSlotQueue.push(resolve);
      });
    }

    this.activeScoutRuns += 1;

    try {
      return await task();
    } finally {
      this.activeScoutRuns = Math.max(0, this.activeScoutRuns - 1);
      this.scoutSlotQueue.shift()?.();
    }
  }

  private runInUtilityProcess(request: ScoutRunRequest, contentProviders: ScoutWorkerInboundMessage["content_providers"]): Promise<ScoutRunResult> {
    const worker = this.ensureWorker();
    const requestId = `scout-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const message: ScoutWorkerInboundMessage = {
      type: "scout:run",
      request_id: requestId,
      request,
      content_providers: contentProviders,
    };

    return new Promise<ScoutRunResult>((resolve) => {
      const timeoutId = setTimeout(() => {
        this.pendingByRequestId.delete(requestId);
        resolve(createFailedScoutRunResult(request, `Scout utility process timed out after ${SCOUT_WORKER_TIMEOUT_MS}ms.`));
        this.restartWorker();
      }, SCOUT_WORKER_TIMEOUT_MS);

      this.pendingByRequestId.set(requestId, {
        request,
        resolve,
        timeoutId,
      });
      worker.postMessage(message);
    });
  }

  private ensureWorker(): UtilityProcess {
    if (this.worker?.pid) {
      return this.worker;
    }

    const workerPath = join(__dirname, "scoutWorker.js");

    if (!existsSync(workerPath)) {
      throw new Error(`Scout utility worker was not built: ${workerPath}`);
    }

    const generation = ++this.workerGeneration;
    const worker = utilityProcess.fork(workerPath, [], {
      serviceName: "SeekStar Scout",
      stdio: "pipe",
    });

    worker.on("message", (message: unknown) => {
      this.handleWorkerMessage(message);
    });
    worker.on("exit", (code) => {
      if (this.workerGeneration === generation) {
        this.worker = undefined;
      }
      this.failPendingRequests(`Scout utility process exited with code ${code}.`);
    });
    worker.stderr?.on("data", (chunk: Buffer) => {
      console.warn(`[SeekStar] Scout utility stderr: ${chunk.toString("utf8").trim()}`);
    });
    this.worker = worker;
    return worker;
  }

  private handleWorkerMessage(message: unknown): void {
    if (!isWorkerOutboundMessage(message)) {
      console.warn("[SeekStar] Ignoring malformed Scout utility message.", message);
      return;
    }

    const pending = this.pendingByRequestId.get(message.request_id);

    if (!pending) {
      return;
    }

    clearTimeout(pending.timeoutId);
    this.pendingByRequestId.delete(message.request_id);

    if (message.type === "scout:result") {
      pending.resolve(message.result);
      return;
    }

    pending.resolve(createFailedScoutRunResult(pending.request, `Scout utility process failed: ${message.error}`));
  }

  private restartWorker(): void {
    const worker = this.worker;
    this.worker = undefined;

    if (worker?.pid) {
      worker.kill();
    }
  }

  private failPendingRequests(reason: string): void {
    for (const [requestId, pending] of this.pendingByRequestId.entries()) {
      clearTimeout(pending.timeoutId);
      pending.resolve(createFailedScoutRunResult(pending.request, reason));
      this.pendingByRequestId.delete(requestId);
    }
  }
}

const scoutService = new ScoutService();

function isWorkerOutboundMessage(value: unknown): value is ScoutWorkerOutboundMessage {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Partial<ScoutWorkerOutboundMessage>;

  if (candidate.type === "scout:result") {
    return typeof candidate.request_id === "string" && typeof candidate.result === "object" && candidate.result !== null;
  }

  if (candidate.type === "scout:error") {
    return typeof candidate.request_id === "string" && typeof candidate.error === "string";
  }

  return false;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
