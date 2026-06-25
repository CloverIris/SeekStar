import type {
  ContentProviderSettings,
  ScoutObservation,
  ScoutPlan,
  ScoutRunRequest,
  ScoutRunResult,
} from "@seekstar/core-schema";
import { PlaywrightScoutService } from "@seekstar/scout-service";

export class ScoutWorkerRuntime {
  private readonly service = new PlaywrightScoutService();
  private contentProviderFingerprint = "";

  run(request: ScoutRunRequest, contentProviders?: readonly ContentProviderSettings[]): Promise<ScoutRunResult> {
    this.applyContentProviders(contentProviders);
    return this.service.run(request);
  }

  dispose(): Promise<void> {
    return this.service.dispose();
  }

  private applyContentProviders(contentProviders?: readonly ContentProviderSettings[]): void {
    const fingerprint = JSON.stringify(
      (contentProviders ?? [])
        .map((provider) => ({
          id: provider.id,
          enabled: provider.enabled,
          priority: provider.priority,
          languages: provider.languages,
          region: provider.region,
          base_url: provider.base_url,
          api_key_env_var: provider.api_key_env_var,
        }))
        .sort((left, right) => left.id.localeCompare(right.id)),
    );

    if (fingerprint === this.contentProviderFingerprint) {
      return;
    }

    this.contentProviderFingerprint = fingerprint;
    this.service.applyContentProviderSettings(contentProviders);
  }
}

export function parseScoutRunRequest(value: unknown): ScoutRunRequest {
  if (!isRecord(value)) {
    throw new Error("Invalid Scout request.");
  }

  const tabId = value.tab_id;
  const requestedAt = value.requested_at;
  const plan = value.plan;

  if (typeof tabId !== "string" || typeof requestedAt !== "string" || !isScoutPlan(plan)) {
    throw new Error("Invalid Scout request payload.");
  }

  return {
    tab_id: tabId,
    requested_at: requestedAt,
    plan,
  };
}

export function createFailedScoutRunResult(
  request: ScoutRunRequest,
  failureReason: string,
  timestamp = new Date().toISOString(),
): ScoutRunResult {
  return {
    adapter: "playwright",
    observations: [
      createFailedObservation(
        request.plan,
        request.tab_id,
        request.plan.candidate_queries[0] ?? request.plan.title,
        timestamp,
        failureReason,
        0,
      ),
    ],
    completed_at: timestamp,
  };
}

function createFailedObservation(
  plan: ScoutPlan,
  tabId: string,
  query: string,
  timestamp: string,
  failureReason: string,
  index: number,
): ScoutObservation {
  return {
    id: `observation-${plan.id}-failed-${Date.now()}-${index + 1}`,
    tab_id: tabId,
    plan_id: plan.id,
    status: "failed",
    adapter: "playwright",
    discovery_mode: plan.discovery_mode,
    query,
    title: `Failed Scout observation: ${query || plan.title}`,
    target_node_ids: plan.target_node_ids,
    failure_reason: failureReason,
    created_at: timestamp,
    updated_at: timestamp,
  };
}

function isScoutPlan(value: unknown): value is ScoutPlan {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.id === "string" &&
    typeof value.title === "string" &&
    Array.isArray(value.target_node_ids) &&
    value.target_node_ids.every((nodeId) => typeof nodeId === "string") &&
    Array.isArray(value.candidate_queries) &&
    value.candidate_queries.every((query) => typeof query === "string") &&
    Array.isArray(value.source_type_targets) &&
    value.source_type_targets.every((sourceType) => typeof sourceType === "string")
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
