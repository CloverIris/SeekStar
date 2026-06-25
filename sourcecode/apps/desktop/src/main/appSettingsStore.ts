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
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

export interface SeekStarSettings {
  tab_cache_max_bytes: number;
  inactive_grace_ms: number;
  scout_concurrency: number;
  tile_live_surface_limit: number;
  tile_field_target_count: number;
  tile_thumbnail_prewarm_concurrency: number;
  active_domain_lexicon_id: string;
  domain_lexicons: DomainLexicon[];
  content_providers: ContentProviderSettings[];
}

export interface AppSettingsStoreOptions {
  onSave?: (settings: SeekStarSettings) => Promise<void> | void;
}

const SETTINGS_FILE_NAME = "seekstar-settings.json";
let settingsSaveChain: Promise<void> = Promise.resolve();

export const defaultSettings: SeekStarSettings = {
  tab_cache_max_bytes: 256 * 1024 * 1024,
  inactive_grace_ms: 30 * 60 * 1000,
  scout_concurrency: 2,
  tile_live_surface_limit: 1,
  tile_field_target_count: 25,
  tile_thumbnail_prewarm_concurrency: 2,
  active_domain_lexicon_id: DEFAULT_DOMAIN_LEXICON_ID,
  domain_lexicons: cloneDomainLexicons(DEFAULT_DOMAIN_LEXICONS),
  content_providers: cloneContentProviderSettings(DEFAULT_CONTENT_PROVIDER_SETTINGS),
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

  return {
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
    domain_lexicons: lexicons,
    content_providers: normalizeContentProviderSettings(candidate.content_providers),
  };
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
  }));
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
