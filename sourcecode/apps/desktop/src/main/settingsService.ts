import { app, ipcMain, safeStorage } from "electron";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { AiCartographerService, type AiProviderConfig } from "@seekstar/ai-service";
import type {
  AiProviderSecretChange,
  AiProviderSettings,
  ProviderTestRequest,
  ProviderTestResult,
  SeekStarSettings,
  SettingsSaveRequest,
  SettingsSaveResult,
} from "../shared/settings.js";
import {
  DEFAULT_AI_PROVIDER_SETTINGS,
  DEFAULT_ASSISTANT_ACTION_PERMISSION_RULES,
  defaultSettings,
} from "../shared/settings.js";
import { DEFAULT_CONTENT_PROVIDER_SETTINGS } from "@seekstar/core-schema";
import {
  DEFAULT_DOMAIN_LEXICON_ID,
  DEFAULT_DOMAIN_LEXICONS,
  cloneDomainLexicons,
} from "@seekstar/constellation-engine";

interface PersistedProvider extends Omit<AiProviderSettings, "api_key_configured" | "api_key_source"> {
  encrypted_api_key?: string;
}

interface PersistedSettings extends Omit<SeekStarSettings, "ai_providers"> {
  schema_version: 2;
  ai_providers: PersistedProvider[];
}

type LegacyProvider = Partial<PersistedProvider> & { api_key_value?: string };
type SettingsListener = (settings: SeekStarSettings) => Promise<void> | void;

export interface SettingsSecretStore {
  decrypt(value: string): string;
  encrypt(value: string): string;
  isAvailable(): boolean;
}

export interface SettingsServiceOptions {
  path?: string;
  secretStore?: SettingsSecretStore;
}

const SETTINGS_FILE_NAME = "seekstar-settings.json";

export class SettingsService {
  private readonly listeners = new Map<string, SettingsListener>();
  private readonly encryptedKeysByProviderId = new Map<string, string>();
  private current: SeekStarSettings | undefined;
  private loadPromise: Promise<SeekStarSettings> | undefined;
  private saveChain: Promise<void> = Promise.resolve();

  constructor(private readonly options: SettingsServiceOptions = {}) {}

  registerIpc(): void {
    ipcMain.removeHandler("settings:load");
    ipcMain.removeHandler("settings:save");
    ipcMain.removeHandler("settings:test-provider");
    ipcMain.handle("settings:load", () => this.load());
    ipcMain.handle("settings:save", (_event, value) => this.save(parseSaveRequest(value)));
    ipcMain.handle("settings:test-provider", (_event, value) => this.testProvider(parseProviderTestRequest(value)));
  }

  subscribe(name: string, listener: SettingsListener): () => void {
    this.listeners.set(name, listener);
    return () => this.listeners.delete(name);
  }

  async load(): Promise<SeekStarSettings> {
    if (this.current) return structuredClone(this.current);
    if (!this.loadPromise) this.loadPromise = this.loadFromDisk();
    this.current = await this.loadPromise;
    return structuredClone(this.current);
  }

  async save(request: SettingsSaveRequest): Promise<SettingsSaveResult> {
    let result: SettingsSaveResult | undefined;
    const operation = this.saveChain.catch(() => undefined).then(async () => {
      const nextSettings = normalizeSettings(request.settings);
      validateSettings(nextSettings);
      await this.load();
      this.applySecretChanges(nextSettings.ai_providers, request.secret_changes);
      const publicSettings = this.applySecretState(nextSettings);
      await this.writePersisted(publicSettings);
      this.current = publicSettings;
      const warnings: string[] = [];
      for (const [name, listener] of this.listeners.entries()) {
        try {
          await listener(structuredClone(publicSettings));
        } catch (error) {
          warnings.push(`${name} 未能立即应用设置：${getErrorMessage(error)}`);
        }
      }
      result = { settings: structuredClone(publicSettings), warnings };
    });
    this.saveChain = operation;
    await operation;
    if (!result) throw new Error("设置保存未完成。");
    return result;
  }

  async testProvider(request: ProviderTestRequest): Promise<ProviderTestResult> {
    const provider = normalizeProvider(request.provider, 0);
    validateProvider(provider);
    const config = await this.resolveProviderConfig(provider, request.api_key, request.secret_action !== "clear");
    const output = await new AiCartographerService(config).generateWorldSegment({
      seed: "SeekStar connection test",
      segment: { key: "0:0", x: 0, y: 0 },
      nearby_anchors: [],
      prompt_revision: "settings-connection-test-v1",
    });
    if (output.status === "ok") {
      return { status: "ok", model: output.model ?? provider.model, message: "连接成功" };
    }
    return { status: "error", model: output.model ?? provider.model, message: output.diagnostics[0]?.message ?? "连接测试失败" };
  }

  async resolveActiveProviderConfig(settings?: SeekStarSettings): Promise<AiProviderConfig> {
    const resolvedSettings = settings ?? await this.load();
    const provider = resolvedSettings.ai_providers.find((item) => item.id === resolvedSettings.active_ai_provider_id && item.enabled)
      ?? resolvedSettings.ai_providers.find((item) => item.enabled)
      ?? DEFAULT_AI_PROVIDER_SETTINGS[0];
    return this.resolveProviderConfig(provider);
  }

  getPath(): string {
    return this.options.path ?? join(app.getPath("userData"), SETTINGS_FILE_NAME);
  }

  private async loadFromDisk(): Promise<SeekStarSettings> {
    let raw: Record<string, unknown> | undefined;
    try {
      raw = JSON.parse(await readFile(this.getPath(), "utf8")) as Record<string, unknown>;
    } catch {
      const defaults = this.applySecretState(structuredClone(defaultSettings));
      this.current = defaults;
      return defaults;
    }

    const rawProviders = Array.isArray(raw.ai_providers) ? raw.ai_providers as LegacyProvider[] : [];
    let requiresRewrite = false;
    for (const provider of rawProviders) {
      const providerId = cleanText(provider.id, "");
      if (!providerId) continue;
      if (typeof provider.encrypted_api_key === "string" && provider.encrypted_api_key) {
        this.encryptedKeysByProviderId.set(providerId, provider.encrypted_api_key);
      } else if (typeof provider.api_key_value === "string" && provider.api_key_value.trim()) {
        requiresRewrite = true;
        if (!this.getSecretStore().isAvailable()) {
          console.warn("[SeekStar][settings] module=secret event=migration_deferred reason=encryption_unavailable");
          continue;
        }
        this.encryptedKeysByProviderId.set(providerId, this.getSecretStore().encrypt(provider.api_key_value.trim()));
      }
    }

    const normalized = this.applySecretState(normalizeSettings(raw));
    this.current = normalized;
    if (requiresRewrite) await this.writePersisted(normalized);
    return normalized;
  }

  private applySecretChanges(providers: AiProviderSettings[], changes: AiProviderSecretChange[]): void {
    const providerIds = new Set(providers.map((provider) => provider.id));
    for (const providerId of Array.from(this.encryptedKeysByProviderId.keys())) {
      if (!providerIds.has(providerId)) this.encryptedKeysByProviderId.delete(providerId);
    }
    const changesById = new Map(changes.map((change) => [change.provider_id, change]));
    for (const provider of providers) {
      const change = changesById.get(provider.id);
      if (!change || change.action === "preserve") continue;
      if (change.action === "clear") {
        this.encryptedKeysByProviderId.delete(provider.id);
        continue;
      }
      const value = change.value.trim();
      if (!value) throw new Error(`${provider.label} 的 API Key 不能为空。`);
      if (!this.getSecretStore().isAvailable()) throw new Error("系统加密当前不可用。请改用环境变量配置 API Key。");
      this.encryptedKeysByProviderId.set(provider.id, this.getSecretStore().encrypt(value));
    }
  }

  private applySecretState(settings: SeekStarSettings): SeekStarSettings {
    const providers = settings.ai_providers.map((provider) => {
      const encrypted = this.encryptedKeysByProviderId.has(provider.id);
      const environmentName = provider.api_key_env_var?.trim();
      const environment = Boolean(environmentName && process.env[environmentName]?.trim());
      const source = encrypted ? "encrypted" as const : environment ? "environment" as const : "none" as const;
      return {
        ...provider,
        api_key_configured: encrypted || environment,
        api_key_source: source,
        health_status: provider.enabled === false ? "disabled" as const : source === "none" ? "missing_key" as const : "ready" as const,
      };
    });
    return { ...settings, ai_providers: providers };
  }

  private async resolveProviderConfig(provider: AiProviderSettings, transientKey?: string, allowStoredKey = true): Promise<AiProviderConfig> {
    let storedKey: string | undefined;
    const encrypted = this.encryptedKeysByProviderId.get(provider.id);
    if (encrypted && allowStoredKey) {
      if (!this.getSecretStore().isAvailable()) throw new Error("系统加密当前不可用，无法读取已保存的 API Key。");
      storedKey = this.getSecretStore().decrypt(encrypted);
    }
    return {
      id: provider.id,
      kind: provider.kind,
      base_url: provider.base_url,
      model: provider.model,
      api_key_ref: provider.api_key_env_var ? { kind: "env", name: provider.api_key_env_var } : undefined,
      api_key_value: transientKey?.trim() || storedKey,
      input_cost_per_million_tokens_usd: provider.input_cost_per_million_tokens_usd,
      output_cost_per_million_tokens_usd: provider.output_cost_per_million_tokens_usd,
      timeout_ms: provider.timeout_ms,
      retry: { attempts: provider.retry_attempts, backoff_ms: provider.retry_backoff_ms },
    };
  }

  private getSecretStore(): SettingsSecretStore {
    return this.options.secretStore ?? electronSecretStore;
  }

  private async writePersisted(settings: SeekStarSettings): Promise<void> {
    const path = this.getPath();
    const temporary = `${path}.${process.pid}.${Date.now()}.tmp`;
    const persisted: PersistedSettings = {
      ...settings,
      schema_version: 2,
      ai_providers: settings.ai_providers.map(({ api_key_configured: _configured, api_key_source: _source, ...provider }) => ({
        ...provider,
        encrypted_api_key: this.encryptedKeysByProviderId.get(provider.id),
      })),
    };
    await mkdir(dirname(path), { recursive: true });
    try {
      await writeFile(temporary, `${JSON.stringify(persisted, null, 2)}\n`, "utf8");
      await rename(temporary, path);
    } finally {
      await rm(temporary, { force: true }).catch(() => undefined);
    }
  }
}

export const settingsService = new SettingsService();

const electronSecretStore: SettingsSecretStore = {
  decrypt: (value) => safeStorage.decryptString(Buffer.from(value, "base64")),
  encrypt: (value) => safeStorage.encryptString(value).toString("base64"),
  isAvailable: () => safeStorage.isEncryptionAvailable(),
};

function normalizeSettings(value: unknown): SeekStarSettings {
  const input = value && typeof value === "object" ? value as Partial<SeekStarSettings> : {};
  const inputProviders = Array.isArray(input.ai_providers) && input.ai_providers.length ? input.ai_providers : DEFAULT_AI_PROVIDER_SETTINGS;
  let providers = inputProviders.map(normalizeProvider);
  if (!providers.some((provider) => provider.enabled)) providers = providers.map((provider, index) => index === 0 ? { ...provider, enabled: true } : provider);
  const requestedActive = cleanText(input.active_ai_provider_id, "");
  const active = providers.find((provider) => provider.id === requestedActive && provider.enabled) ?? providers.find((provider) => provider.enabled)!;
  const lexicons = Array.isArray(input.domain_lexicons) && input.domain_lexicons.length ? input.domain_lexicons : cloneDomainLexicons(DEFAULT_DOMAIN_LEXICONS);
  return {
    assistant_action_permission_mode: input.assistant_action_permission_mode === "allow_low_risk" || input.assistant_action_permission_mode === "block_all" ? input.assistant_action_permission_mode : "ask_each_time",
    assistant_action_permission_rules: Array.isArray(input.assistant_action_permission_rules) ? input.assistant_action_permission_rules : structuredClone(DEFAULT_ASSISTANT_ACTION_PERMISSION_RULES),
    exploration_language: cleanText(input.exploration_language, defaultSettings.exploration_language),
    exploration_density: input.exploration_density === "normal" || input.exploration_density === "rich" ? input.exploration_density : "compact",
    generation_concurrency: integer(input.generation_concurrency, 1, 2, 2),
    scout_concurrency: integer(input.scout_concurrency, 1, 2, 2),
    tab_cache_max_bytes: integer(input.tab_cache_max_bytes, 32 * 1024 * 1024, 2048 * 1024 * 1024, defaultSettings.tab_cache_max_bytes),
    inactive_grace_ms: integer(input.inactive_grace_ms, 60_000, 86_400_000, defaultSettings.inactive_grace_ms),
    tile_live_surface_limit: integer(input.tile_live_surface_limit, 1, 8, 1),
    tile_field_target_count: integer(input.tile_field_target_count, 4, 80, 25),
    tile_thumbnail_prewarm_concurrency: integer(input.tile_thumbnail_prewarm_concurrency, 1, 6, 2),
    domain_hint_mode: input.domain_hint_mode === "pure_ai" ? "pure_ai" : "guided",
    active_domain_lexicon_id: cleanText(input.active_domain_lexicon_id, DEFAULT_DOMAIN_LEXICON_ID),
    domain_lexicons: lexicons,
    content_providers: Array.isArray(input.content_providers) ? input.content_providers : structuredClone(DEFAULT_CONTENT_PROVIDER_SETTINGS),
    active_ai_provider_id: active.id,
    ai_providers: providers,
  };
}

function normalizeProvider(value: Partial<AiProviderSettings>, index: number): AiProviderSettings {
  const enabled = value.enabled !== false;
  return {
    id: cleanText(value.id, `provider-${index + 1}`),
    label: cleanText(value.label, `AI Provider ${index + 1}`),
    kind: "openai_compatible",
    enabled,
    base_url: cleanText(value.base_url, "https://api.openai.com/v1"),
    model: cleanText(value.model, "gpt-4o-mini"),
    api_key_env_var: typeof value.api_key_env_var === "string" ? value.api_key_env_var.trim() || undefined : undefined,
    api_key_configured: value.api_key_configured === true,
    api_key_source: value.api_key_source === "encrypted" || value.api_key_source === "environment" ? value.api_key_source : "none",
    input_cost_per_million_tokens_usd: optionalNumber(value.input_cost_per_million_tokens_usd),
    output_cost_per_million_tokens_usd: optionalNumber(value.output_cost_per_million_tokens_usd),
    timeout_ms: integer(value.timeout_ms, 1_000, 120_000, 60_000),
    retry_attempts: integer(value.retry_attempts, 0, 2, 1),
    retry_backoff_ms: integer(value.retry_backoff_ms, 0, 5_000, 500),
    health_status: enabled ? value.api_key_configured || value.api_key_env_var ? "ready" : "missing_key" : "disabled",
    health_message: typeof value.health_message === "string" ? value.health_message : undefined,
  };
}

function validateSettings(settings: SeekStarSettings): void {
  if (settings.ai_providers.length === 0) throw new Error("至少需要一个 AI Provider。");
  const ids = new Set<string>();
  for (const provider of settings.ai_providers) {
    validateProvider(provider);
    if (ids.has(provider.id)) throw new Error(`Provider ID 重复：${provider.id}`);
    ids.add(provider.id);
  }
  const active = settings.ai_providers.find((provider) => provider.id === settings.active_ai_provider_id);
  if (!active?.enabled) throw new Error("活动 Provider 必须存在并处于启用状态。");
}

function validateProvider(provider: AiProviderSettings): void {
  if (!provider.id.trim()) throw new Error("Provider ID 不能为空。");
  if (!/^[a-z0-9][a-z0-9._-]*$/i.test(provider.id)) throw new Error(`${provider.label} 的 ID 只能包含字母、数字、点、下划线和连字符。`);
  if (!provider.label.trim()) throw new Error(`${provider.id} 的名称不能为空。`);
  if (!provider.model.trim()) throw new Error(`${provider.label} 的模型不能为空。`);
  let url: URL;
  try { url = new URL(provider.base_url); } catch { throw new Error(`${provider.label} 的 Base URL 无效。`); }
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error(`${provider.label} 的 Base URL 必须使用 HTTP 或 HTTPS。`);
}

function parseSaveRequest(value: unknown): SettingsSaveRequest {
  if (!value || typeof value !== "object") throw new Error("设置保存请求无效。");
  const input = value as Partial<SettingsSaveRequest>;
  return { settings: normalizeSettings(input.settings), secret_changes: Array.isArray(input.secret_changes) ? input.secret_changes.map(parseSecretChange) : [] };
}

function parseSecretChange(value: unknown): AiProviderSecretChange {
  if (!value || typeof value !== "object") throw new Error("API Key 修改请求无效。");
  const input = value as Partial<AiProviderSecretChange>;
  const providerId = cleanText(input.provider_id, "");
  if (!providerId || (input.action !== "preserve" && input.action !== "replace" && input.action !== "clear")) throw new Error("API Key 修改请求无效。");
  if (input.action === "replace") return { provider_id: providerId, action: "replace", value: typeof input.value === "string" ? input.value : "" };
  return { provider_id: providerId, action: input.action };
}

function parseProviderTestRequest(value: unknown): ProviderTestRequest {
  if (!value || typeof value !== "object") throw new Error("Provider 测试请求无效。");
  const input = value as Partial<ProviderTestRequest>;
  return {
    provider: normalizeProvider(input.provider ?? {}, 0),
    api_key: typeof input.api_key === "string" ? input.api_key : undefined,
    secret_action: input.secret_action === "replace" || input.secret_action === "clear" ? input.secret_action : "preserve",
  };
}

function cleanText(value: unknown, fallback: string): string { return typeof value === "string" && value.trim() ? value.trim() : fallback; }
function integer(value: unknown, min: number, max: number, fallback: number): number { return typeof value === "number" && Number.isFinite(value) ? Math.min(max, Math.max(min, Math.round(value))) : fallback; }
function optionalNumber(value: unknown): number | undefined { return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : undefined; }
function getErrorMessage(error: unknown): string { return error instanceof Error ? error.message : String(error); }
