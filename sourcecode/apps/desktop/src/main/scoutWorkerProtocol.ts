import type { ScoutRunRequest, ScoutRunResult } from "@seekstar/core-schema";

export interface ScoutWorkerRunMessage {
  type: "scout:run";
  request_id: string;
  request: ScoutRunRequest;
}

export interface ScoutWorkerResultMessage {
  type: "scout:result";
  request_id: string;
  result: ScoutRunResult;
}

export interface ScoutWorkerErrorMessage {
  type: "scout:error";
  request_id: string;
  error: string;
}

export type ScoutWorkerInboundMessage = ScoutWorkerRunMessage;
export type ScoutWorkerOutboundMessage = ScoutWorkerResultMessage | ScoutWorkerErrorMessage;
