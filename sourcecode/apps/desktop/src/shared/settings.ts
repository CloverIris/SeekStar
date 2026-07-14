import type { AiAssistantActionType, AiProviderKind } from "@seekstar/ai-service";
import {
  DEFAULT_CONTENT_PROVIDER_SETTINGS,
  type ContentProviderSettings,
} from "@seekstar/core-schema";
import {
  DEFAULT_DOMAIN_LEXICON_ID,
  DEFAULT_DOMAIN_LEXICONS,
  cloneDomainLexicons,
  type DomainLexicon,
} from "@seekstar/constellation-engine";

export type AssistantActionPermissionMode = "ask_each_time" | "allow_low_risk" | "block_all";
export type AssistantActionPermissionDecision = "allow_after_click" | "ask_each_time" | "block";
export type ExplorationDensity = "compact" | "normal" | "rich";
export type ApiKeySource = "encrypted" | "environment" | "none";

export interface AssistantActionPermissionRule {
  action_type: Exclude<AiAssistantActionType, "none">;
  decision: AssistantActionPermissionDecision;
}

export interface AiProviderSettings {
  id: string;
  label: string;
  kind: AiProviderKind;
  enabled: boolean;
  base_url: string;
  model: string;
  api_key_env_var?: string;
  api_key_configured: boolean;
  api_key_source: ApiKeySource;
  input_cost_per_million_tokens_usd?: number;
  output_cost_per_million_tokens_usd?: number;
  timeout_ms: number;
  retry_attempts: number;
  retry_backoff_ms: number;
  health_status: "ready" | "missing_key" | "disabled" | "error";
  health_message?: string;
}

export interface SeekStarSettings {
  assistant_action_permission_mode: AssistantActionPermissionMode;
  assistant_action_permission_rules: AssistantActionPermissionRule[];
  exploration_language: string;
  exploration_density: ExplorationDensity;
  generation_concurrency: number;
  scout_concurrency: number;
  tab_cache_max_bytes: number;
  inactive_grace_ms: number;
  tile_live_surface_limit: number;
  tile_field_target_count: number;
  tile_thumbnail_prewarm_concurrency: number;
  domain_hint_mode: "guided" | "pure_ai";
  active_domain_lexicon_id: string;
  domain_lexicons: DomainLexicon[];
  content_providers: ContentProviderSettings[];
  active_ai_provider_id: string;
  ai_providers: AiProviderSettings[];
}

export type AiProviderSecretChange =
  | { provider_id: string; action: "preserve" }
  | { provider_id: string; action: "clear" }
  | { provider_id: string; action: "replace"; value: string };

export interface SettingsSaveRequest {
  settings: SeekStarSettings;
  secret_changes: AiProviderSecretChange[];
}

export interface SettingsSaveResult {
  settings: SeekStarSettings;
  warnings: string[];
}

export interface ProviderTestRequest {
  provider: AiProviderSettings;
  api_key?: string;
  secret_action?: "preserve" | "replace" | "clear";
}

export interface ProviderTestResult {
  status: "ok" | "error";
  model?: string;
  message: string;
}

export const DEFAULT_ASSISTANT_ACTION_PERMISSION_RULES: AssistantActionPermissionRule[] = [
  { action_type: "focus_node", decision: "allow_after_click" },
  { action_type: "request_chunk", decision: "allow_after_click" },
  { action_type: "open_settings", decision: "allow_after_click" },
  { action_type: "observe_source", decision: "ask_each_time" },
  { action_type: "create_seed", decision: "ask_each_time" },
];

export const DEFAULT_AI_PROVIDER_SETTINGS: AiProviderSettings[] = [{
  id: "deepseek-openai-compatible",
  label: "DeepSeek API",
  kind: "openai_compatible",
  enabled: true,
  base_url: "https://api.deepseek.com",
  model: "deepseek-chat",
  api_key_env_var: "DEEPSEEK_API_KEY",
  api_key_configured: false,
  api_key_source: "none",
  timeout_ms: 60_000,
  retry_attempts: 1,
  retry_backoff_ms: 500,
  health_status: "missing_key",
  health_message: "请填写 API Key，或配置 DEEPSEEK_API_KEY。",
}];

export const defaultSettings: SeekStarSettings = {
  assistant_action_permission_mode: "ask_each_time",
  assistant_action_permission_rules: structuredClone(DEFAULT_ASSISTANT_ACTION_PERMISSION_RULES),
  exploration_language: "zh-CN",
  exploration_density: "compact",
  generation_concurrency: 2,
  scout_concurrency: 2,
  tab_cache_max_bytes: 256 * 1024 * 1024,
  inactive_grace_ms: 30 * 60 * 1000,
  tile_live_surface_limit: 1,
  tile_field_target_count: 25,
  tile_thumbnail_prewarm_concurrency: 2,
  domain_hint_mode: "guided",
  active_domain_lexicon_id: DEFAULT_DOMAIN_LEXICON_ID,
  domain_lexicons: cloneDomainLexicons(DEFAULT_DOMAIN_LEXICONS),
  content_providers: structuredClone(DEFAULT_CONTENT_PROVIDER_SETTINGS),
  active_ai_provider_id: DEFAULT_AI_PROVIDER_SETTINGS[0].id,
  ai_providers: structuredClone(DEFAULT_AI_PROVIDER_SETTINGS),
};
