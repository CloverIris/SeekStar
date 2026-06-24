import type { AgentJob, CartographerOutput, ScoutPlan, ScoutRunResult, TerrainScene } from "@seekstar/core-schema";
import type { SourceIngestionInput } from "./sourceTerrain.js";
import type { WorkspaceSnapshot } from "./types.js";

export interface ConstellationScoutPort {
  runPlan(tabId: string, plan: ScoutPlan): Promise<ScoutRunResult>;
}

export interface ConstellationAiContext {
  scene: TerrainScene;
  selectedNodeIds: string[];
  userPrompt?: string;
}

export interface ConstellationAiPort {
  status(): Promise<"available" | "missing_key" | "disabled" | "error">;
  runCartographer(job: AgentJob, context: ConstellationAiContext): Promise<CartographerOutput>;
}

export interface ConstellationStoragePort<TBasketItem = unknown> {
  loadWorkspaceSnapshot(): Promise<WorkspaceSnapshot<TBasketItem> | undefined>;
  saveWorkspaceSnapshot(snapshot: WorkspaceSnapshot<TBasketItem>): Promise<void>;
  clearWorkspaceSnapshot(): Promise<void>;
}

export interface ConstellationSourceSnapshotPort {
  ingestSource(input: SourceIngestionInput): Promise<SourceIngestionInput>;
}

export interface ConstellationEnginePorts<TBasketItem = unknown> {
  ai?: ConstellationAiPort;
  scout?: ConstellationScoutPort;
  sourceSnapshots?: ConstellationSourceSnapshotPort;
  storage?: ConstellationStoragePort<TBasketItem>;
}
