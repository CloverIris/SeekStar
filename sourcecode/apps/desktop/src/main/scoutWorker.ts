import { ScoutWorkerRuntime } from "./scoutWorkerRuntime";
import type { ScoutWorkerInboundMessage, ScoutWorkerOutboundMessage } from "./scoutWorkerProtocol";

const runtime = new ScoutWorkerRuntime();
const parentPort = process.parentPort;
const keepAliveInterval = setInterval(() => undefined, 30_000);

if (!parentPort) {
  throw new Error("Scout worker must run inside Electron utilityProcess.");
}

parentPort.on("message", (message: unknown) => {
  void handleMessage(message);
});

process.on("exit", () => {
  clearInterval(keepAliveInterval);
});

async function handleMessage(message: unknown): Promise<void> {
  if (!isWorkerInboundMessage(message)) {
    return;
  }

  try {
    const result = await runtime.run(message.request, message.content_providers);
    postMessage({
      type: "scout:result",
      request_id: message.request_id,
      result,
    });
  } catch (error) {
    postMessage({
      type: "scout:error",
      request_id: message.request_id,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

function postMessage(message: ScoutWorkerOutboundMessage): void {
  parentPort.postMessage(message);
}

function isWorkerInboundMessage(value: unknown): value is ScoutWorkerInboundMessage {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Partial<ScoutWorkerInboundMessage>;
  return candidate.type === "scout:run" && typeof candidate.request_id === "string" && typeof candidate.request === "object" && candidate.request !== null;
}
