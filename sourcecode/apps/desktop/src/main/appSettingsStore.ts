import { app, ipcMain } from "electron";
import {
  DEFAULT_DOMAIN_LEXICON_ID,
  DEFAULT_DOMAIN_LEXICONS,
  cloneDomainLexicons,
  type DomainLexicon,
  type DomainLexiconTerm,
} from "@seekstar/constellation-engine";
import {
  BUILT_IN_CONTENT_PROVIDER_DEFINITIONS,
  DEFAULT_CONTENT_PROVIDER_SETTINGS,
  type ContentProviderDefinition,
  type ContentProviderSettings,
} from "@seekstar/core-schema";
import type { AiAssistantActionType, AiProviderConfig, AiProviderKind, CartographerGenerationMode } from "@seekstar/ai-service";
import {
  DEFAULT_LEVEL_RUNTIME_PROFILE_ID,
  resolveLevelRuntimeProfile,
  type LevelBandId,
  type LevelRuntimePromptProfileOverride,
  type LevelRuntimeSettings,
} from "@seekstar/level-runtime";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

export interface SeekStarSettings {
  assistant_action_permission_mode: AssistantActionPermissionMode;
  assistant_action_permission_rules: AssistantActionPermissionRule[];
  cartographer_chunk_scheduling: CartographerChunkSchedulingSettings;
  cartographer_prompt_profile: CartographerPromptProfileSettings;
  cartographer_prompt_profile_revisions: CartographerPromptProfileRevisionSettings[];
  tab_cache_max_bytes: number;
  inactive_grace_ms: number;
  scout_concurrency: number;
  tile_live_surface_limit: number;
  tile_field_target_count: number;
  tile_thumbnail_prewarm_concurrency: number;
  domain_hint_mode: "guided" | "pure_ai";
  active_domain_lexicon_id: string;
  domain_lexicons: DomainLexicon[];
  content_providers: ContentProviderSettings[];
  active_ai_provider_id: string;
  ai_providers: AiCartographerProviderSettings[];
  ai_routes: AiCartographerRouteSettings[];
}

export type AssistantActionPermissionMode = "ask_each_time" | "allow_low_risk" | "block_all";
export type AssistantActionPermissionDecision = "allow_after_click" | "ask_each_time" | "block";

export interface AssistantActionPermissionRule {
  action_type: Exclude<AiAssistantActionType, "none">;
  decision: AssistantActionPermissionDecision;
}

export interface AiCartographerProviderSettings {
  id: string;
  label: string;
  kind: AiProviderKind;
  enabled: boolean;
  base_url?: string;
  model?: string;
  api_key_value?: string;
  api_key_env_var?: string;
  input_cost_per_million_tokens_usd?: number;
  output_cost_per_million_tokens_usd?: number;
  timeout_ms: number;
  retry_attempts: number;
  retry_backoff_ms: number;
  health_status: "ready" | "missing_key" | "disabled" | "error";
  health_message?: string;
}

export interface AiCartographerRouteSettings {
  id: string;
  label: string;
  enabled: boolean;
  priority: number;
  level_id: LevelBandId | "default";
  modes?: CartographerGenerationMode[];
  provider_id: string;
  model_override?: string;
}

export interface CartographerChunkSchedulingSettings {
  auto_expand_enabled: boolean;
  auto_preload_ring: number;
  boundary_debounce_ms: number;
  chunk_height: number;
  chunk_width: number;
  manual_preload_range: number;
}

export type CartographerPromptDensity = "compact" | "normal" | "rich";

export interface CartographerPromptModuleSettings {
  level_id: LevelBandId;
  label: string;
  prompt_brief: string;
  prompt_constraints: string[];
  target_count: number;
}

export interface CartographerPromptProfileSettings {
  density: CartographerPromptDensity;
  id: string;
  label: string;
  language: string;
  modules: CartographerPromptModuleSettings[];
}

export interface CartographerPromptProfileRevisionSettings {
  created_at: string;
  id: string;
  label: string;
  profile: CartographerPromptProfileSettings;
  revision: string;
}

export interface AppSettingsStoreOptions {
  onSave?: (settings: SeekStarSettings) => Promise<void> | void;
}

const SETTINGS_FILE_NAME = "seekstar-settings.json";
const DEEPSEEK_AI_PROVIDER_ID = "deepseek-openai-compatible";
const DEFAULT_AI_PROVIDER_ID = DEEPSEEK_AI_PROVIDER_ID;
const DEFAULT_AI_ROUTE_ID = "cartographer-route-default";
const CARTOGRAPHER_LEVEL_ORDER: LevelBandId[] = ["supra_macro", "L0", "L1", "L2", "L3", "deep_lens", "recursive_seed"];
let settingsSaveChain: Promise<void> = Promise.resolve();

export const DEFAULT_ASSISTANT_ACTION_PERMISSION_RULES: AssistantActionPermissionRule[] = [
  { action_type: "focus_node", decision: "allow_after_click" },
  { action_type: "request_chunk", decision: "allow_after_click" },
  { action_type: "open_settings", decision: "allow_after_click" },
  { action_type: "observe_source", decision: "ask_each_time" },
  { action_type: "create_seed", decision: "ask_each_time" },
];

export const DEFAULT_AI_PROVIDER_SETTINGS: AiCartographerProviderSettings[] = [
  {
    id: DEEPSEEK_AI_PROVIDER_ID,
    label: "DeepSeek API",
    kind: "openai_compatible",
    enabled: true,
    base_url: "https://api.deepseek.com",
    model: "deepseek-v4-flash",
    api_key_env_var: "DEEPSEEK_API_KEY",
    input_cost_per_million_tokens_usd: 0.14,
    output_cost_per_million_tokens_usd: 0.28,
    timeout_ms: 60_000,
    retry_attempts: 1,
    retry_backoff_ms: 500,
    health_status: "missing_key",
    health_message: "OpenAI-compatible DeepSeek adapter. Paste an API key in Settings or set DEEPSEEK_API_KEY.",
  },
  {
    id: "openai-compatible-env",
    label: "OpenAI-compatible API",
    kind: "openai_compatible",
    enabled: false,
    base_url: "https://api.openai.com/v1",
    model: "gpt-4o-mini",
    api_key_env_var: "SEEKSTAR_AI_API_KEY",
    timeout_ms: 30_000,
    retry_attempts: 1,
    retry_backoff_ms: 250,
    health_status: "disabled",
    health_message: "Enable and set an env key reference when a real Cartographer model is available.",
  },
];

export const DEFAULT_AI_ROUTE_SETTINGS: AiCartographerRouteSettings[] = [
  {
    id: DEFAULT_AI_ROUTE_ID,
    label: "Default Cartographer route",
    enabled: true,
    priority: 100,
    level_id: "default",
    provider_id: DEFAULT_AI_PROVIDER_ID,
  },
  {
    id: "cartographer-route-l3",
    label: "L3 source candidate route",
    enabled: true,
    priority: 80,
    level_id: "L3",
    modes: ["decompose_down", "expand_horizontal", "replace_failed_source"],
    provider_id: DEFAULT_AI_PROVIDER_ID,
  },
  {
    id: "cartographer-route-deep-lens",
    label: "Deep Lens route",
    enabled: true,
    priority: 90,
    level_id: "deep_lens",
    modes: ["decompose_down", "summarize_up"],
    provider_id: DEFAULT_AI_PROVIDER_ID,
  },
];

export const defaultSettings: SeekStarSettings = {
  assistant_action_permission_mode: "ask_each_time",
  assistant_action_permission_rules: cloneAssistantActionPermissionRules(DEFAULT_ASSISTANT_ACTION_PERMISSION_RULES),
  cartographer_chunk_scheduling: {
    auto_expand_enabled: true,
    auto_preload_ring: 1,
    boundary_debounce_ms: 520,
    chunk_height: 900,
    chunk_width: 1200,
    manual_preload_range: 1,
  },
  cartographer_prompt_profile: createDefaultCartographerPromptProfileSettings(),
  cartographer_prompt_profile_revisions: [],
  tab_cache_max_bytes: 256 * 1024 * 1024,
  inactive_grace_ms: 30 * 60 * 1000,
  scout_concurrency: 2,
  tile_live_surface_limit: 1,
  tile_field_target_count: 25,
  tile_thumbnail_prewarm_concurrency: 2,
  active_domain_lexicon_id: DEFAULT_DOMAIN_LEXICON_ID,
  domain_hint_mode: "guided",
  domain_lexicons: cloneDomainLexicons(DEFAULT_DOMAIN_LEXICONS),
  content_providers: cloneContentProviderSettings(DEFAULT_CONTENT_PROVIDER_SETTINGS),
  active_ai_provider_id: DEFAULT_AI_PROVIDER_ID,
  ai_providers: cloneAiProviderSettings(DEFAULT_AI_PROVIDER_SETTINGS),
  ai_routes: cloneAiRouteSettings(DEFAULT_AI_ROUTE_SETTINGS),
};

export function registerAppSettingsStore(options: AppSettingsStoreOptions = {}): void {
  ipcMain.removeHandler("settings:load");
  ipcMain.removeHandler("settings:save");

  ipcMain.handle("settings:load", async () => loadSettings());
  ipcMain.handle("settings:save", async (_event, patch: unknown) => {
    const settings = await saveSettings(normalizeSettings(patch));
    await options.onSave?.(settings);
    return settings;
  });
}

export async function loadSettings(): Promise<SeekStarSettings> {
  const settingsPath = getSettingsPath();

  try {
    const content = await readFile(settingsPath, "utf8");

    try {
      return normalizeSettings(JSON.parse(content));
    } catch (error) {
      if (isJsonParseError(error)) {
        await quarantineCorruptJson(settingsPath, error);
        return defaultSettings;
      }

      throw error;
    }
  } catch (error) {
    if (isMissingFileError(error)) {
      return defaultSettings;
    }

    throw error;
  }
}

export async function saveSettings(settings: SeekStarSettings): Promise<SeekStarSettings> {
  const normalized = normalizeSettings(settings);
  const nextSave = settingsSaveChain.catch(() => undefined).then(() => writeSettings(normalized));
  settingsSaveChain = nextSave;
  await nextSave;
  return normalized;
}

async function writeSettings(normalized: SeekStarSettings): Promise<void> {
  const storePath = getSettingsPath();
  const tmpPath = createTempJsonPath(storePath);

  await mkdir(dirname(storePath), { recursive: true });
  await writeFile(tmpPath, JSON.stringify(normalized, null, 2), "utf8");
  await replaceFile(tmpPath, storePath);
}

function normalizeSettings(value: unknown): SeekStarSettings {
  const candidate = typeof value === "object" && value !== null ? (value as Partial<SeekStarSettings>) : {};
  const lexicons = normalizeDomainLexicons(candidate.domain_lexicons, candidate.active_domain_lexicon_id);
  const activeDomainLexiconId = lexicons.find((lexicon) => lexicon.active)?.id ?? DEFAULT_DOMAIN_LEXICON_ID;
  const aiProviders = normalizeAiProviderSettings(candidate.ai_providers);
  const activeAiProviderId = normalizeActiveAiProviderId(candidate.active_ai_provider_id, aiProviders);
  const aiRoutes = normalizeAiRouteSettings(candidate.ai_routes, activeAiProviderId, aiProviders);

  return {
    assistant_action_permission_mode: normalizeAssistantActionPermissionMode(candidate.assistant_action_permission_mode),
    assistant_action_permission_rules: normalizeAssistantActionPermissionRules(candidate.assistant_action_permission_rules),
    cartographer_chunk_scheduling: normalizeCartographerChunkSchedulingSettings(candidate.cartographer_chunk_scheduling),
    cartographer_prompt_profile: normalizeCartographerPromptProfileSettings(candidate.cartographer_prompt_profile),
    cartographer_prompt_profile_revisions: normalizeCartographerPromptProfileRevisions(candidate.cartographer_prompt_profile_revisions),
    tab_cache_max_bytes: clampNumber(candidate.tab_cache_max_bytes, 32 * 1024 * 1024, 2048 * 1024 * 1024, defaultSettings.tab_cache_max_bytes),
    inactive_grace_ms: clampNumber(candidate.inactive_grace_ms, 60_000, 24 * 60 * 60 * 1000, defaultSettings.inactive_grace_ms),
    scout_concurrency: clampNumber(candidate.scout_concurrency, 1, 8, defaultSettings.scout_concurrency),
    tile_live_surface_limit: clampNumber(candidate.tile_live_surface_limit, 1, 8, defaultSettings.tile_live_surface_limit),
    tile_field_target_count: clampNumber(candidate.tile_field_target_count, 4, 80, defaultSettings.tile_field_target_count),
    tile_thumbnail_prewarm_concurrency: clampNumber(
      candidate.tile_thumbnail_prewarm_concurrency,
      1,
      6,
      defaultSettings.tile_thumbnail_prewarm_concurrency,
    ),
    active_domain_lexicon_id: activeDomainLexiconId,
    domain_hint_mode: normalizeDomainHintMode(candidate.domain_hint_mode),
    domain_lexicons: lexicons,
    content_providers: normalizeContentProviderSettings(candidate.content_providers),
    active_ai_provider_id: activeAiProviderId,
    ai_providers: aiProviders,
    ai_routes: aiRoutes,
  };
}

export function resolveActiveAiProviderConfig(settings: SeekStarSettings): AiProviderConfig {
  return resolveAiProviderConfigForRoute(settings, {
    level_id: "default",
    mode: "bootstrap_seed",
  });
}

export function resolveAiProviderConfigForRoute(
  settings: SeekStarSettings,
  request: { level_id: LevelBandId | "default"; mode: CartographerGenerationMode },
): AiProviderConfig {
  const providers = normalizeAiProviderSettings(settings.ai_providers);
  const activeId = normalizeActiveAiProviderId(settings.active_ai_provider_id, providers);
  const routes = normalizeAiRouteSettings(settings.ai_routes, activeId, providers);
  const route = selectAiRoute(routes, request) ?? routes.find((candidate) => candidate.id === DEFAULT_AI_ROUTE_ID);
  const providerId = route?.provider_id ?? activeId;
  const activeProvider = providers.find((provider) => provider.id === providerId) ?? providers.find((provider) => provider.id === activeId) ?? providers[0] ?? DEFAULT_AI_PROVIDER_SETTINGS[0];

  return {
    id: activeProvider.id,
    kind: activeProvider.kind,
    base_url: activeProvider.base_url,
    model: route?.model_override ?? activeProvider.model,
    api_key_ref: activeProvider.api_key_env_var ? { kind: "env", name: activeProvider.api_key_env_var } : undefined,
    api_key_value: activeProvider.api_key_value,
    input_cost_per_million_tokens_usd: activeProvider.input_cost_per_million_tokens_usd,
    output_cost_per_million_tokens_usd: activeProvider.output_cost_per_million_tokens_usd,
    timeout_ms: activeProvider.timeout_ms,
    retry: {
      attempts: activeProvider.retry_attempts,
      backoff_ms: activeProvider.retry_backoff_ms,
    },
  };
}

export function resolveCartographerLevelRuntimeSettings(settings: SeekStarSettings): LevelRuntimeSettings {
  const profile = normalizeCartographerPromptProfileSettings(settings.cartographer_prompt_profile);
  const modules = Object.fromEntries(
    profile.modules.map((module) => [
      module.level_id,
      {
        prompt_brief: module.prompt_brief,
        prompt_constraints: module.prompt_constraints,
        target_count: clampCartographerRuntimeTargetCount(module.level_id, module.target_count),
      },
    ]),
  ) as LevelRuntimePromptProfileOverride["modules"];

  return {
    cache_object_limit: settings.cartographer_chunk_scheduling.auto_preload_ring > 1 ? 1600 : 1200,
    chunk_policy: {
      auto_preload_ring: settings.cartographer_chunk_scheduling.auto_preload_ring,
      boundary_debounce_ms: settings.cartographer_chunk_scheduling.boundary_debounce_ms,
      chunk_height: settings.cartographer_chunk_scheduling.chunk_height,
      chunk_width: settings.cartographer_chunk_scheduling.chunk_width,
      manual_preload_range: settings.cartographer_chunk_scheduling.manual_preload_range,
      policy_revision: createCartographerChunkPolicyRevision(settings.cartographer_chunk_scheduling),
    },
    max_concurrent_ai_requests: 2,
    prompt_profile_id: profile.id,
    prompt_profile: {
      density: profile.density,
      id: profile.id,
      label: profile.label,
      language: profile.language,
      modules,
    },
    target_counts: Object.fromEntries(
      profile.modules.map((module) => [module.level_id, clampCartographerRuntimeTargetCount(module.level_id, module.target_count)]),
    ) as LevelRuntimeSettings["target_counts"],
  };
}

function clampCartographerRuntimeTargetCount(levelId: LevelBandId, value: number): number {
  const mvpMaxByLevel: Partial<Record<LevelBandId, number>> = {
    supra_macro: 6,
    L1: 10,
    L2: 8,
    L3: 3,
  };
  const max = mvpMaxByLevel[levelId] ?? 80;

  return clampNumber(value, 1, max, max);
}

function createCartographerChunkPolicyRevision(settings: CartographerChunkSchedulingSettings): string {
  return [
    "chunk-policy:v1",
    `w${settings.chunk_width}`,
    `h${settings.chunk_height}`,
    `ring${settings.auto_preload_ring}`,
    `manual${settings.manual_preload_range}`,
    `debounce${settings.boundary_debounce_ms}`,
  ].join(":");
}

function normalizeAiRouteSettings(
  value: unknown,
  fallbackProviderId: string,
  providers: readonly AiCartographerProviderSettings[],
): AiCartographerRouteSettings[] {
  const providerIds = new Set(providers.map((provider) => provider.id));
  const incomingById = new Map<string, Partial<AiCartographerRouteSettings>>();

  if (Array.isArray(value)) {
    for (const item of value) {
      if (typeof item !== "object" || item === null) {
        continue;
      }

      const candidate = item as Partial<AiCartographerRouteSettings>;

      if (typeof candidate.id === "string" && candidate.id.trim()) {
        incomingById.set(candidate.id.trim(), candidate);
      }
    }
  }

  const defaults = DEFAULT_AI_ROUTE_SETTINGS.map((fallback) => normalizeAiRouteCandidate(incomingById.get(fallback.id), fallback, fallbackProviderId, providerIds));
  const customRoutes = [...incomingById.values()]
    .filter((candidate) => candidate.id && !DEFAULT_AI_ROUTE_SETTINGS.some((route) => route.id === candidate.id))
    .map((candidate) =>
      normalizeAiRouteCandidate(
        candidate,
        {
          id: normalizeOptionalString(candidate.id) ?? createFallbackId("ai-route"),
          label: normalizeOptionalString(candidate.label) ?? "Custom Cartographer route",
          enabled: false,
          priority: 500,
          level_id: "default",
          provider_id: fallbackProviderId,
        },
        fallbackProviderId,
        providerIds,
      ),
    );

  return [...defaults, ...customRoutes].sort((left, right) => left.priority - right.priority || left.id.localeCompare(right.id));
}

function normalizeAiRouteCandidate(
  candidate: Partial<AiCartographerRouteSettings> | undefined,
  fallback: AiCartographerRouteSettings,
  fallbackProviderId: string,
  providerIds: ReadonlySet<string>,
): AiCartographerRouteSettings {
  const providerId = normalizeOptionalString(candidate?.provider_id) ?? fallback.provider_id;

  return {
    id: fallback.id,
    label: normalizeOptionalString(candidate?.label) ?? fallback.label,
    enabled: candidate?.enabled ?? fallback.enabled,
    priority: clampNumber(candidate?.priority, 1, 999, fallback.priority),
    level_id: normalizeRouteLevelId(candidate?.level_id) ?? fallback.level_id,
    modes: normalizeRouteModes(candidate?.modes) ?? fallback.modes,
    provider_id: providerIds.has(providerId) ? providerId : fallbackProviderId,
    model_override: normalizeOptionalString(candidate?.model_override),
  };
}

function selectAiRoute(
  routes: readonly AiCartographerRouteSettings[],
  request: { level_id: LevelBandId | "default"; mode: CartographerGenerationMode },
): AiCartographerRouteSettings | undefined {
  return routes
    .filter((route) => route.enabled)
    .find((route) => {
      const levelMatches = route.level_id === request.level_id || route.level_id === "default";
      const modeMatches = !route.modes?.length || route.modes.includes(request.mode);

      return levelMatches && modeMatches;
    });
}

function normalizeRouteLevelId(value: unknown): AiCartographerRouteSettings["level_id"] | undefined {
  if (
    value === "default" ||
    value === "supra_macro" ||
    value === "L0" ||
    value === "L1" ||
    value === "L2" ||
    value === "L3" ||
    value === "deep_lens" ||
    value === "recursive_seed"
  ) {
    return value;
  }

  return undefined;
}

function normalizeRouteModes(value: unknown): CartographerGenerationMode[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const modes = value.filter((mode): mode is CartographerGenerationMode =>
    mode === "bootstrap_seed" ||
    mode === "expand_horizontal" ||
    mode === "decompose_down" ||
    mode === "summarize_up" ||
    mode === "replace_failed_source",
  );

  return modes.length > 0 ? [...new Set(modes)] : undefined;
}

function normalizeAiProviderSettings(value: unknown): AiCartographerProviderSettings[] {
  const incomingById = new Map<string, Partial<AiCartographerProviderSettings>>();

  if (Array.isArray(value)) {
    for (const item of value) {
      if (typeof item !== "object" || item === null) {
        continue;
      }

      const candidate = item as Partial<AiCartographerProviderSettings>;

      if (typeof candidate.id === "string" && candidate.id.trim()) {
        incomingById.set(candidate.id.trim(), candidate);
      }
    }
  }

  const providers = DEFAULT_AI_PROVIDER_SETTINGS.map((fallback): AiCartographerProviderSettings => {
    const candidate = incomingById.get(fallback.id);
    const kind = "openai_compatible";
    const enabled = candidate?.enabled ?? fallback.enabled;
    const apiKeyValue = normalizeOptionalString(candidate?.api_key_value);
    const apiKeyEnv = normalizeOptionalString(candidate?.api_key_env_var) ?? fallback.api_key_env_var;

    return {
      id: fallback.id,
      label: normalizeOptionalString(candidate?.label) ?? fallback.label,
      kind,
      enabled,
      base_url: normalizeOptionalString(candidate?.base_url) ?? fallback.base_url,
      model: normalizeOptionalString(candidate?.model) ?? fallback.model,
      api_key_value: apiKeyValue,
      api_key_env_var: apiKeyEnv,
      input_cost_per_million_tokens_usd: normalizeOptionalCostRate(candidate?.input_cost_per_million_tokens_usd, fallback.input_cost_per_million_tokens_usd),
      output_cost_per_million_tokens_usd: normalizeOptionalCostRate(candidate?.output_cost_per_million_tokens_usd, fallback.output_cost_per_million_tokens_usd),
      timeout_ms: clampNumber(candidate?.timeout_ms, 5_000, 180_000, fallback.timeout_ms),
      retry_attempts: clampNumber(candidate?.retry_attempts, 0, 5, fallback.retry_attempts),
      retry_backoff_ms: clampNumber(candidate?.retry_backoff_ms, 50, 10_000, fallback.retry_backoff_ms),
      health_status: enabled
        ? !apiKeyValue && !apiKeyEnv
          ? "missing_key"
          : candidate?.health_status === "error"
            ? "error"
            : "ready"
        : "disabled",
      health_message: normalizeOptionalString(candidate?.health_message) ?? fallback.health_message,
    };
  });

  const customProviders = [...incomingById.values()]
    .filter((candidate) => candidate.id && !DEFAULT_AI_PROVIDER_SETTINGS.some((provider) => provider.id === candidate.id))
    .filter((candidate) => {
      const kind = (candidate as { kind?: unknown }).kind;
      return kind === undefined || kind === "openai_compatible";
    })
    .map((candidate): AiCartographerProviderSettings => {
      const kind = "openai_compatible";
      const enabled = candidate.enabled ?? false;
      const apiKeyValue = normalizeOptionalString(candidate.api_key_value);
      const apiKeyEnv = normalizeOptionalString(candidate.api_key_env_var);

      return {
        id: normalizeOptionalString(candidate.id) ?? createFallbackId("ai-provider"),
        label: normalizeOptionalString(candidate.label) ?? "Custom AI provider",
        kind,
        enabled,
        base_url: normalizeOptionalString(candidate.base_url) ?? "https://api.openai.com/v1",
        model: normalizeOptionalString(candidate.model) ?? "gpt-4o-mini",
        api_key_value: apiKeyValue,
        api_key_env_var: apiKeyEnv,
        input_cost_per_million_tokens_usd: normalizeOptionalCostRate(candidate.input_cost_per_million_tokens_usd),
        output_cost_per_million_tokens_usd: normalizeOptionalCostRate(candidate.output_cost_per_million_tokens_usd),
        timeout_ms: clampNumber(candidate.timeout_ms, 5_000, 180_000, 30_000),
        retry_attempts: clampNumber(candidate.retry_attempts, 0, 5, 1),
        retry_backoff_ms: clampNumber(candidate.retry_backoff_ms, 50, 10_000, 250),
        health_status: enabled ? (!apiKeyValue && !apiKeyEnv ? "missing_key" : "ready") : "disabled",
        health_message: normalizeOptionalString(candidate.health_message),
      };
    });

  return [...providers, ...customProviders];
}

function normalizeActiveAiProviderId(value: unknown, providers: readonly AiCartographerProviderSettings[]): string {
  const requestedId = normalizeOptionalString(value);

  if (requestedId && providers.some((provider) => provider.id === requestedId)) {
    return requestedId;
  }

  return providers.find((provider) => provider.enabled)?.id ?? providers[0]?.id ?? DEFAULT_AI_PROVIDER_ID;
}

function normalizeAssistantActionPermissionMode(value: unknown): AssistantActionPermissionMode {
  return value === "allow_low_risk" || value === "block_all" || value === "ask_each_time" ? value : "ask_each_time";
}

function normalizeDomainHintMode(value: unknown): SeekStarSettings["domain_hint_mode"] {
  return value === "pure_ai" ? "pure_ai" : "guided";
}

function normalizeAssistantActionPermissionRules(value: unknown): AssistantActionPermissionRule[] {
  const incoming = new Map<AssistantActionPermissionRule["action_type"], AssistantActionPermissionDecision>();

  if (Array.isArray(value)) {
    for (const item of value) {
      if (typeof item !== "object" || item === null) {
        continue;
      }

      const candidate = item as Partial<AssistantActionPermissionRule>;

      if (isAssistantActionPermissionAction(candidate.action_type) && isAssistantActionPermissionDecision(candidate.decision)) {
        incoming.set(candidate.action_type, candidate.decision);
      }
    }
  }

  return DEFAULT_ASSISTANT_ACTION_PERMISSION_RULES.map((fallback) => ({
    action_type: fallback.action_type,
    decision: incoming.get(fallback.action_type) ?? fallback.decision,
  }));
}

function normalizeCartographerChunkSchedulingSettings(value: unknown): CartographerChunkSchedulingSettings {
  const candidate = typeof value === "object" && value !== null ? value as Partial<CartographerChunkSchedulingSettings> : {};
  const fallback = defaultSettings.cartographer_chunk_scheduling;

  return {
    auto_expand_enabled: typeof candidate.auto_expand_enabled === "boolean" ? candidate.auto_expand_enabled : fallback.auto_expand_enabled,
    auto_preload_ring: clampNumber(candidate.auto_preload_ring, 0, 2, fallback.auto_preload_ring),
    boundary_debounce_ms: clampNumber(candidate.boundary_debounce_ms, 120, 5_000, fallback.boundary_debounce_ms),
    chunk_height: clampNumber(candidate.chunk_height, 480, 3_200, fallback.chunk_height),
    chunk_width: clampNumber(candidate.chunk_width, 480, 3_200, fallback.chunk_width),
    manual_preload_range: clampNumber(candidate.manual_preload_range, 1, 3, fallback.manual_preload_range),
  };
}

function createDefaultCartographerPromptProfileSettings(): CartographerPromptProfileSettings {
  const profile = resolveLevelRuntimeProfile(DEFAULT_LEVEL_RUNTIME_PROFILE_ID);

  return {
    density: profile.density,
    id: profile.id,
    label: profile.label,
    language: profile.language,
    modules: CARTOGRAPHER_LEVEL_ORDER.map((levelId) => {
      const module = profile.modules[levelId];

      return {
        level_id: levelId,
        label: module.label,
        prompt_brief: module.prompt_brief,
        prompt_constraints: [...module.prompt_constraints],
        target_count: module.default_target_count,
      };
    }),
  };
}

function normalizeCartographerPromptProfileSettings(value: unknown): CartographerPromptProfileSettings {
  const fallback = createDefaultCartographerPromptProfileSettings();
  const candidate = typeof value === "object" && value !== null ? (value as Partial<CartographerPromptProfileSettings>) : {};
  const incomingModules = new Map<LevelBandId, Partial<CartographerPromptModuleSettings>>();

  if (Array.isArray(candidate.modules)) {
    for (const item of candidate.modules) {
      if (typeof item !== "object" || item === null) {
        continue;
      }

      const module = item as Partial<CartographerPromptModuleSettings>;

      if (isLevelBandId(module.level_id)) {
        incomingModules.set(module.level_id, module);
      }
    }
  }

  return {
    density: normalizePromptDensity(candidate.density, fallback.density),
    id: normalizeCartographerPromptProfileId(candidate.id, fallback.id),
    label: normalizeOptionalString(candidate.label) ?? fallback.label,
    language: normalizeOptionalString(candidate.language) ?? fallback.language,
    modules: fallback.modules.map((fallbackModule) => {
      const module = incomingModules.get(fallbackModule.level_id);

      return {
        level_id: fallbackModule.level_id,
        label: normalizeOptionalString(module?.label) ?? fallbackModule.label,
        prompt_brief: normalizePromptText(module?.prompt_brief, fallbackModule.prompt_brief, 4_000),
        prompt_constraints: normalizePromptConstraints(module?.prompt_constraints, fallbackModule.prompt_constraints),
        target_count: clampNumber(module?.target_count, 1, 80, fallbackModule.target_count),
      };
    }),
  };
}

function normalizeCartographerPromptProfileId(value: unknown, fallback: string): string {
  const normalized = normalizeOptionalString(value) ?? fallback;

  return normalized === "seekstar-default-p6" || normalized === "seekstar-default-p6-gallery-v2" ? fallback : normalized;
}

function normalizeCartographerPromptProfileRevisions(value: unknown): CartographerPromptProfileRevisionSettings[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const seen = new Set<string>();
  const revisions: CartographerPromptProfileRevisionSettings[] = [];

  for (const item of value) {
    if (typeof item !== "object" || item === null) {
      continue;
    }

    const candidate = item as Partial<CartographerPromptProfileRevisionSettings>;
    const id = normalizeOptionalString(candidate.id) ?? createFallbackId("prompt-revision");

    if (seen.has(id)) {
      continue;
    }

    seen.add(id);
    revisions.push({
      created_at: normalizeIsoTimestamp(candidate.created_at),
      id,
      label: normalizeOptionalString(candidate.label) ?? "Prompt profile revision",
      profile: normalizeCartographerPromptProfileSettings(candidate.profile),
      revision: normalizeOptionalString(candidate.revision) ?? "unknown",
    });
  }

  return revisions
    .sort((left, right) => right.created_at.localeCompare(left.created_at))
    .slice(0, 20);
}

function normalizeIsoTimestamp(value: unknown): string {
  if (typeof value === "string" && value.trim() && !Number.isNaN(Date.parse(value))) {
    return new Date(value).toISOString();
  }

  return new Date().toISOString();
}

function normalizePromptDensity(value: unknown, fallback: CartographerPromptDensity): CartographerPromptDensity {
  return value === "compact" || value === "normal" || value === "rich" ? value : fallback;
}

function normalizePromptText(value: unknown, fallback: string, limit: number): string {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, limit) : fallback;
}

function normalizePromptConstraints(value: unknown, fallback: readonly string[]): string[] {
  if (!Array.isArray(value)) {
    return [...fallback];
  }

  const constraints = value
    .map((item) => (typeof item === "string" ? item.trim().slice(0, 1_000) : ""))
    .filter(Boolean);

  return constraints.length > 0 ? constraints.slice(0, 12) : [...fallback];
}

function isLevelBandId(value: unknown): value is LevelBandId {
  return (
    value === "supra_macro" ||
    value === "L0" ||
    value === "L1" ||
    value === "L2" ||
    value === "L3" ||
    value === "deep_lens" ||
    value === "recursive_seed"
  );
}

function isAssistantActionPermissionAction(value: unknown): value is AssistantActionPermissionRule["action_type"] {
  return (
    value === "focus_node" ||
    value === "request_chunk" ||
    value === "observe_source" ||
    value === "create_seed" ||
    value === "open_settings"
  );
}

function isAssistantActionPermissionDecision(value: unknown): value is AssistantActionPermissionDecision {
  return value === "allow_after_click" || value === "ask_each_time" || value === "block";
}

function cloneAssistantActionPermissionRules(rules: readonly AssistantActionPermissionRule[]): AssistantActionPermissionRule[] {
  return rules.map((rule) => ({ ...rule }));
}

function cloneAiProviderSettings(settings: readonly AiCartographerProviderSettings[]): AiCartographerProviderSettings[] {
  return settings.map((provider) => ({ ...provider }));
}

function cloneAiRouteSettings(settings: readonly AiCartographerRouteSettings[]): AiCartographerRouteSettings[] {
  return settings.map((route) => ({
    ...route,
    modes: route.modes ? [...route.modes] : undefined,
  }));
}

function normalizeContentProviderSettings(value: unknown): ContentProviderSettings[] {
  const definitionsById = new Map<string, ContentProviderDefinition>(
    BUILT_IN_CONTENT_PROVIDER_DEFINITIONS.map((provider) => [provider.id, provider as ContentProviderDefinition]),
  );
  const incomingById = new Map<string, Partial<ContentProviderSettings>>();

  if (Array.isArray(value)) {
    for (const item of value) {
      if (typeof item !== "object" || item === null) {
        continue;
      }

      const candidate = item as Partial<ContentProviderSettings>;

      if (typeof candidate.id === "string" && definitionsById.has(candidate.id)) {
        incomingById.set(candidate.id, candidate);
      }
    }
  }

  return DEFAULT_CONTENT_PROVIDER_SETTINGS.map((fallback): ContentProviderSettings => {
    const definition = definitionsById.get(fallback.id);
    const candidate = incomingById.get(fallback.id);
    const enabled = candidate?.enabled ?? fallback.enabled;

    return {
      id: fallback.id,
      enabled,
      priority: clampNumber(candidate?.priority, 1, 999, fallback.priority),
      languages: normalizeProviderLanguages(candidate?.languages, fallback.languages, definition?.supported_languages),
      region: normalizeOptionalString(candidate?.region),
      base_url: normalizeOptionalString(candidate?.base_url),
      api_key_ref: normalizeContentProviderSecretRef(candidate?.api_key_ref, candidate?.api_key_env_var ?? fallback.api_key_env_var),
      api_key_env_var: normalizeOptionalString(candidate?.api_key_env_var) ?? fallback.api_key_env_var,
      health_status: enabled ? (candidate?.health_status === "requires_key" ? "requires_key" : "ready") : "disabled",
      health_message: normalizeOptionalString(candidate?.health_message),
    };
  }).sort((left, right) => left.priority - right.priority || left.id.localeCompare(right.id));
}

function cloneContentProviderSettings(settings: readonly ContentProviderSettings[]): ContentProviderSettings[] {
  return settings.map((provider) => ({
    ...provider,
    languages: provider.languages ? [...provider.languages] : undefined,
    api_key_ref: provider.api_key_ref ? { ...provider.api_key_ref } : undefined,
  }));
}

function normalizeContentProviderSecretRef(value: unknown, legacyEnvVar?: string): ContentProviderSettings["api_key_ref"] {
  if (typeof value === "object" && value !== null) {
    const candidate = value as Partial<NonNullable<ContentProviderSettings["api_key_ref"]>>;
    const name = normalizeOptionalString(candidate.name);

    if (candidate.kind === "env" && name) {
      return { kind: "env", name };
    }
  }

  const fallbackName = normalizeOptionalString(legacyEnvVar);
  return fallbackName ? { kind: "env", name: fallbackName } : undefined;
}

function normalizeProviderLanguages(
  value: unknown,
  fallback: readonly string[] | undefined,
  supported: readonly string[] | undefined,
): string[] | undefined {
  const fallbackLanguages = fallback ? [...fallback] : undefined;

  if (!Array.isArray(value)) {
    return fallbackLanguages;
  }

  const supportedSet = supported ? new Set(supported) : undefined;
  const languages = value
    .filter((language): language is string => typeof language === "string" && Boolean(language.trim()))
    .map((language) => language.trim())
    .filter((language, index, list) => list.indexOf(language) === index)
    .filter((language) => !supportedSet || supportedSet.has(language));

  return languages.length > 0 ? languages : fallbackLanguages;
}

function normalizeOptionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function normalizeOptionalCostRate(value: unknown, fallback?: number): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return fallback;
  }

  return Math.min(1_000, value);
}

function createFallbackId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}`;
}

function normalizeDomainLexicons(value: unknown, activeLexiconId: unknown): DomainLexicon[] {
  const candidates = Array.isArray(value) ? value.map(normalizeDomainLexicon).filter((lexicon): lexicon is DomainLexicon => Boolean(lexicon)) : [];
  const lexicons = candidates.length > 0 ? candidates : cloneDomainLexicons(DEFAULT_DOMAIN_LEXICONS);
  const requestedActiveId = typeof activeLexiconId === "string" && activeLexiconId.trim() ? activeLexiconId.trim() : undefined;
  const activeId =
    (requestedActiveId && lexicons.some((lexicon) => lexicon.id === requestedActiveId) ? requestedActiveId : undefined) ??
    lexicons.find((lexicon) => lexicon.active)?.id ??
    lexicons[0]?.id ??
    DEFAULT_DOMAIN_LEXICON_ID;

  return lexicons.map((lexicon) => ({
    ...lexicon,
    active: lexicon.id === activeId,
  }));
}

function normalizeDomainLexicon(value: unknown, index: number): DomainLexicon | undefined {
  const candidate = typeof value === "object" && value !== null ? (value as Partial<DomainLexicon>) : {};
  const title = typeof candidate.title === "string" && candidate.title.trim() ? candidate.title.trim() : "";

  if (!title) {
    return undefined;
  }

  const now = new Date().toISOString();
  const terms = Array.isArray(candidate.terms)
    ? candidate.terms.map(normalizeDomainLexiconTerm).filter((term): term is DomainLexiconTerm => Boolean(term))
    : [];

  return {
    id: typeof candidate.id === "string" && candidate.id.trim() ? candidate.id.trim() : `domain-lexicon-${Date.now()}-${index}`,
    title,
    description: typeof candidate.description === "string" ? candidate.description.trim() : "",
    active: Boolean(candidate.active),
    terms,
    updated_at: typeof candidate.updated_at === "string" ? candidate.updated_at : now,
  };
}

function normalizeDomainLexiconTerm(value: unknown, index: number): DomainLexiconTerm | undefined {
  const candidate = typeof value === "object" && value !== null ? (value as Partial<DomainLexiconTerm>) : {};
  const labels = normalizeLanguageLabels(candidate.labels);
  const canonical =
    (typeof candidate.canonical === "string" && candidate.canonical.trim() ? candidate.canonical.trim() : undefined) ??
    labels.en ??
    labels["zh-Hans"] ??
    labels["zh-Hant"] ??
    "";

  if (!canonical) {
    return undefined;
  }

  return {
    id: typeof candidate.id === "string" && candidate.id.trim() ? candidate.id.trim() : `domain-term-${Date.now()}-${index}`,
    canonical,
    labels,
    enabled: candidate.enabled !== false,
    tags: Array.isArray(candidate.tags)
      ? candidate.tags.filter((tag): tag is string => typeof tag === "string" && Boolean(tag.trim())).map((tag) => tag.trim())
      : undefined,
  };
}

function normalizeLanguageLabels(value: unknown): Record<string, string> {
  if (typeof value !== "object" || value === null) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value)
      .filter(([language, label]) => language.trim() && typeof label === "string" && label.trim())
      .map(([language, label]) => [language.trim(), (label as string).trim()]),
  );
}

function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, Math.round(value)));
}

function getSettingsPath(): string {
  return join(app.getPath("userData"), SETTINGS_FILE_NAME);
}

function createTempJsonPath(path: string): string {
  return `${path}.${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}.tmp`;
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
    console.warn(`[SeekStar] Ignored corrupt settings JSON and moved it to ${quarantinePath}: ${getErrorMessage(error)}`);
  } catch (renameError) {
    console.warn(`[SeekStar] Failed to quarantine corrupt settings JSON at ${path}: ${getErrorMessage(renameError)}`);
  }
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
