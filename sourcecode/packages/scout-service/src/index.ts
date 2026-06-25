import type {
  Browser,
  BrowserContext,
  Page,
  Response,
} from "playwright";
import type {
  ContentProviderDefinition,
  ContentProviderSettings,
  DataServiceProviderKind,
  ScoutDiscoveryMode,
  ScoutObservation,
  ScoutPlan,
  ScoutRunRequest,
  ScoutRunResult,
  SearchCandidate,
  SearchCandidateProviderRun,
  SearchCandidateRequest,
  SearchCandidateResult,
  SourceObservationRequest,
  SourceObservationResult,
  SourceSnapshot,
  SourceSnapshotMedia,
  SourceSnapshotOutlink,
  SourceType,
} from "@seekstar/core-schema";
import {
  BUILT_IN_CONTENT_PROVIDER_DEFINITIONS as BUILT_IN_PROVIDERS,
  DEFAULT_CONTENT_PROVIDER_SETTINGS as DEFAULT_PROVIDER_SETTINGS,
} from "@seekstar/core-schema";

export interface ScoutDataService {
  run(request: ScoutRunRequest): Promise<ScoutRunResult>;
  searchCandidates(request: SearchCandidateRequest): Promise<SearchCandidateResult>;
  observeSource(request: SourceObservationRequest): Promise<SourceObservationResult>;
  snapshotUrl(tabId: string, url: string): Promise<SourceSnapshot>;
  dispose(): Promise<void>;
}

export interface SearchCandidateProvider {
  readonly id: string;
  readonly kind: DataServiceProviderKind;
  search(request: SearchCandidateRequest): Promise<SearchCandidate[]>;
  supports(request: SearchCandidateRequest): boolean;
}

export interface SourceObservationProvider {
  readonly id: string;
  readonly kind: DataServiceProviderKind;
  observe(request: SourceObservationRequest): Promise<SourceObservationResult>;
  supports(request: SourceObservationRequest): boolean;
}

interface BrowserContextProvider {
  getContext(tabId: string): Promise<BrowserContext>;
}

interface LinkCandidate {
  title: string;
  url: string;
  snippet?: string;
  sourceType?: SourceType;
  confidence?: number;
  metadata?: Record<string, string | number | boolean>;
}

export class DataServiceProviderRegistry {
  private readonly searchProviders = new Map<string, SearchCandidateProvider>();
  private readonly sourceObservers = new Map<string, SourceObservationProvider>();

  registerSearchProvider(provider: SearchCandidateProvider): void {
    this.searchProviders.set(provider.id, provider);
  }

  registerSourceObserver(provider: SourceObservationProvider): void {
    this.sourceObservers.set(provider.id, provider);
  }

  async searchCandidates(request: SearchCandidateRequest): Promise<SearchCandidateResult> {
    const completedAt = new Date().toISOString();
    const providerRuns: SearchCandidateProviderRun[] = [];
    const providers = this.selectSearchProviders(request);
    const candidates: SearchCandidate[] = [];

    if (providers.length === 0) {
      return {
        candidates: [],
        provider_runs: [
          {
            provider_id: "provider-registry",
            provider_kind: "cache",
            status: "failed",
            candidate_count: 0,
            failure_reason: `No DataService search provider supports ${request.discovery_mode}.`,
          },
        ],
        completed_at: completedAt,
      };
    }

    for (const provider of providers) {
      try {
        const providerCandidates = await provider.search(request);
        const limitedCandidates = providerCandidates.slice(0, Math.max(1, request.limit ?? 8));
        candidates.push(...limitedCandidates);
        providerRuns.push({
          provider_id: provider.id,
          provider_kind: provider.kind,
          status: "completed",
          candidate_count: limitedCandidates.length,
        });
      } catch (error) {
        providerRuns.push({
          provider_id: provider.id,
          provider_kind: provider.kind,
          status: "failed",
          candidate_count: 0,
          failure_reason: getErrorMessage(error),
        });
      }
    }

    return {
      candidates: dedupeSearchCandidates(candidates).slice(0, Math.max(1, request.limit ?? 8)),
      provider_runs: providerRuns,
      completed_at: completedAt,
    };
  }

  async observeSource(request: SourceObservationRequest): Promise<SourceObservationResult> {
    const provider = this.selectSourceObserver(request);
    const completedAt = new Date().toISOString();

    if (!provider) {
      return {
        provider_id: request.provider_id ?? "provider-registry",
        provider_kind: "cache",
        failure_reason: `No DataService source observer supports ${request.url}.`,
        completed_at: completedAt,
      };
    }

    try {
      return await provider.observe(request);
    } catch (error) {
      return {
        provider_id: provider.id,
        provider_kind: provider.kind,
        failure_reason: getErrorMessage(error),
        completed_at: completedAt,
      };
    }
  }

  private selectSearchProviders(request: SearchCandidateRequest): SearchCandidateProvider[] {
    const providerIds = request.provider_ids ? new Set(request.provider_ids) : undefined;

    return Array.from(this.searchProviders.values()).filter((provider) => {
      if (providerIds && !providerIds.has(provider.id)) {
        return false;
      }

      return provider.supports(request);
    });
  }

  private selectSourceObserver(request: SourceObservationRequest): SourceObservationProvider | undefined {
    if (request.provider_id) {
      const provider = this.sourceObservers.get(request.provider_id);
      return provider?.supports(request) ? provider : undefined;
    }

    return Array.from(this.sourceObservers.values()).find((provider) => provider.supports(request));
  }
}

export class PlaywrightScoutService implements ScoutDataService {
  private readonly browserPool = new PlaywrightBrowserPool();
  private registry: DataServiceProviderRegistry;

  constructor(contentProviderSettings?: readonly ContentProviderSettings[]) {
    this.registry = createDefaultDataServiceProviderRegistry(this.browserPool, contentProviderSettings);
  }

  applyContentProviderSettings(contentProviderSettings?: readonly ContentProviderSettings[]): void {
    this.registry = createDefaultDataServiceProviderRegistry(this.browserPool, contentProviderSettings);
  }

  async run(request: ScoutRunRequest): Promise<ScoutRunResult> {
    if (request.plan.discovery_mode === "frontier_web_search" || request.plan.discovery_mode === "page_outlinks") {
      return this.runCandidateDiscoveryPlan(request);
    }

    return this.runSourceObservationPlan(request);
  }

  searchCandidates(request: SearchCandidateRequest): Promise<SearchCandidateResult> {
    return this.registry.searchCandidates(request);
  }

  observeSource(request: SourceObservationRequest): Promise<SourceObservationResult> {
    return this.registry.observeSource(request);
  }

  async snapshotUrl(tabId: string, url: string): Promise<SourceSnapshot> {
    const result = await this.observeSource({
      tab_id: tabId,
      url,
      requested_at: new Date().toISOString(),
    });

    if (!result.snapshot) {
      throw new Error(result.failure_reason ?? "DataService did not return a source snapshot.");
    }

    return result.snapshot;
  }

  async dispose(): Promise<void> {
    await this.browserPool.dispose();
  }

  private async runSourceObservationPlan(request: ScoutRunRequest): Promise<ScoutRunResult> {
    const completedAt = new Date().toISOString();
    const observations: ScoutObservation[] = [];

    for (const [index, query] of request.plan.candidate_queries.slice(0, 5).entries()) {
      const url = parseHttpUrl(query);

      if (!url) {
        observations.push(
          createFailedObservation(
            request.plan,
            request.tab_id,
            query,
            completedAt,
            "Direct URL Scout requires an HTTP(S) URL. Search discovery must use frontier_web_search.",
            index,
          ),
        );
        continue;
      }

      const result = await this.observeSource({
        tab_id: request.tab_id,
        url: url.href,
        requested_at: completedAt,
      });
      observations.push(createObservationFromSourceResult(request.plan, request.tab_id, query, result, completedAt, index));
    }

    return {
      adapter: "playwright",
      observations,
      completed_at: completedAt,
    };
  }

  private async runCandidateDiscoveryPlan(request: ScoutRunRequest): Promise<ScoutRunResult> {
    const completedAt = new Date().toISOString();
    const query = request.plan.candidate_queries[0] ?? request.plan.title;
    const discoveryMode =
      request.plan.discovery_mode === "page_outlinks" ? "page_outlinks" : "frontier_web_search";
    const searchResult = await this.searchCandidates({
      tab_id: request.tab_id,
      query,
      discovery_mode: discoveryMode,
      source_url: discoveryMode === "page_outlinks" ? parseHttpUrl(query)?.href : undefined,
      limit: 8,
      requested_at: completedAt,
    });

    if (searchResult.candidates.length === 0) {
      return {
        adapter: "playwright",
        observations: [
          createFailedObservation(
            request.plan,
            request.tab_id,
            query,
            completedAt,
            createSearchFailureReason(searchResult.provider_runs),
            0,
          ),
        ],
        completed_at: completedAt,
      };
    }

    return {
      adapter: "playwright",
      observations: searchResult.candidates.map((candidate, index) =>
        createObservationFromSearchCandidate(request.plan, request.tab_id, query, candidate, completedAt, index),
      ),
      completed_at: completedAt,
    };
  }
}

export function createDefaultDataServiceProviderRegistry(
  browserPool: BrowserContextProvider,
  contentProviderSettings?: readonly ContentProviderSettings[],
): DataServiceProviderRegistry {
  const registry = new DataServiceProviderRegistry();
  const activeProviders = resolveActiveContentProviderSettings(contentProviderSettings);
  registry.registerSourceObserver(new PlaywrightSourceObserverProvider(browserPool));

  for (const provider of activeProviders) {
    switch (provider.id) {
      case "arxiv":
        registry.registerSearchProvider(new ArxivAuthorityProvider(provider));
        break;
      case "github":
        registry.registerSearchProvider(new GitHubAuthorityProvider(provider));
        break;
      case "wikipedia":
        registry.registerSearchProvider(new WikipediaAuthorityProvider(provider));
        break;
      case "wikidata":
        registry.registerSearchProvider(new WikidataAuthorityProvider(provider));
        break;
      case "browser-assisted-playwright":
        registry.registerSearchProvider(new PlaywrightBrowserSearchProvider(browserPool));
        break;
      case "runoob-url":
        registry.registerSearchProvider(new UrlOnlySiteSearchProvider(browserPool, provider.id, "菜鸟教程", ["runoob.com"]));
        break;
      case "zhihu-url":
        registry.registerSearchProvider(new UrlOnlySiteSearchProvider(browserPool, provider.id, "知乎", ["zhihu.com", "zhida.zhihu.com"]));
        break;
    }
  }

  registry.registerSearchProvider(new PlaywrightPageOutlinksProvider(browserPool));
  return registry;
}

export function resolveActiveContentProviderSettings(
  contentProviderSettings?: readonly ContentProviderSettings[],
): ContentProviderSettings[] {
  const definitionsById = new Map<string, ContentProviderDefinition>(
    BUILT_IN_PROVIDERS.map((provider) => [provider.id, provider as ContentProviderDefinition]),
  );
  const incomingById = new Map<string, ContentProviderSettings>(
    (contentProviderSettings ?? DEFAULT_PROVIDER_SETTINGS).map((provider) => [provider.id, provider]),
  );

  return DEFAULT_PROVIDER_SETTINGS.map((fallback): ContentProviderSettings => {
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
      health_status: enabled ? "ready" : "disabled",
      health_message: normalizeOptionalString(candidate?.health_message),
    };
  })
    .filter((provider) => provider.enabled)
    .sort((left, right) => left.priority - right.priority || left.id.localeCompare(right.id));
}

class PlaywrightBrowserPool implements BrowserContextProvider {
  private browser: Browser | undefined;
  private readonly contextsByTabId = new Map<string, BrowserContext>();

  async getContext(tabId: string): Promise<BrowserContext> {
    const existing = this.contextsByTabId.get(tabId);

    if (existing) {
      return existing;
    }

    if (!this.browser?.isConnected()) {
      const { chromium } = await import("playwright");
      this.browser = await launchScoutBrowser(chromium);
      this.browser.on("disconnected", () => {
        this.browser = undefined;
        this.contextsByTabId.clear();
      });
    }

    const context = await this.browser.newContext({
      javaScriptEnabled: true,
      userAgent: "SeekStarScout/0.1 (+https://seekstar.local)",
    });
    this.contextsByTabId.set(tabId, context);
    return context;
  }

  async dispose(): Promise<void> {
    await Promise.all(Array.from(this.contextsByTabId.values()).map((context) => context.close().catch(() => undefined)));
    this.contextsByTabId.clear();
    await this.browser?.close().catch(() => undefined);
    this.browser = undefined;
  }
}

class PlaywrightSourceObserverProvider implements SourceObservationProvider {
  readonly id = "playwright-source-observer";
  readonly kind = "browser_observer" satisfies DataServiceProviderKind;

  constructor(private readonly browserPool: BrowserContextProvider) {}

  supports(request: SourceObservationRequest): boolean {
    return Boolean(parseHttpUrl(request.url));
  }

  async observe(request: SourceObservationRequest): Promise<SourceObservationResult> {
    const url = parseHttpUrl(request.url);
    const completedAt = new Date().toISOString();

    if (!url) {
      return {
        provider_id: this.id,
        provider_kind: this.kind,
        failure_reason: "Playwright source observer requires an HTTP(S) URL.",
        completed_at: completedAt,
      };
    }

    try {
      const snapshot = await snapshotWithContext(await this.browserPool.getContext(request.tab_id), url, completedAt);

      return {
        provider_id: this.id,
        provider_kind: this.kind,
        snapshot,
        completed_at: completedAt,
      };
    } catch (error) {
      return {
        provider_id: this.id,
        provider_kind: this.kind,
        failure_reason: `Playwright could not observe this URL: ${getErrorMessage(error)}`,
        completed_at: completedAt,
      };
    }
  }
}

class ArxivAuthorityProvider implements SearchCandidateProvider {
  readonly id = "arxiv";
  readonly kind = "authority" satisfies DataServiceProviderKind;

  constructor(private readonly settings: ContentProviderSettings) {}

  supports(request: SearchCandidateRequest): boolean {
    return request.discovery_mode === "frontier_web_search" && request.query.trim().length > 0;
  }

  async search(request: SearchCandidateRequest): Promise<SearchCandidate[]> {
    const query = request.query.trim();
    const timestamp = new Date().toISOString();
    const limit = clampLimit(request.limit, 1, 10);
    const url = new URL("https://export.arxiv.org/api/query");
    url.searchParams.set("search_query", `all:${query}`);
    url.searchParams.set("start", "0");
    url.searchParams.set("max_results", String(limit));
    const xml = await fetchText(url.href, {
      headers: createApiHeaders("application/atom+xml"),
    });
    const entries = parseArxivEntries(xml).slice(0, limit);

    if (entries.length === 0) {
      throw new Error("arXiv returned no candidate entries.");
    }

    return entries.map((entry, index) =>
      createSearchCandidate({
        candidate: {
          title: entry.title,
          url: entry.url,
          snippet: entry.summary,
          sourceType: "article",
          confidence: 0.88,
          metadata: {
            authority: "arxiv",
            pdf_url: entry.pdfUrl ?? "",
            published: entry.published ?? "",
            provider_priority: this.settings.priority,
          },
        },
        discoveryMode: "frontier_web_search",
        index,
        providerId: this.id,
        providerKind: this.kind,
        query,
        timestamp,
      }),
    );
  }
}

class GitHubAuthorityProvider implements SearchCandidateProvider {
  readonly id = "github";
  readonly kind = "authority" satisfies DataServiceProviderKind;

  constructor(private readonly settings: ContentProviderSettings) {}

  supports(request: SearchCandidateRequest): boolean {
    return request.discovery_mode === "frontier_web_search" && request.query.trim().length > 0;
  }

  async search(request: SearchCandidateRequest): Promise<SearchCandidate[]> {
    const query = request.query.trim();
    const timestamp = new Date().toISOString();
    const limit = clampLimit(request.limit, 1, 10);
    const url = new URL("https://api.github.com/search/repositories");
    url.searchParams.set("q", query);
    url.searchParams.set("sort", "stars");
    url.searchParams.set("order", "desc");
    url.searchParams.set("per_page", String(limit));
    const token = getEnvValue(this.settings.api_key_env_var ?? "GITHUB_TOKEN");
    const response = await fetchJson<GitHubRepositorySearchResponse>(url.href, {
      headers: {
        ...createApiHeaders("application/vnd.github+json"),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
    const items = Array.isArray(response.items) ? response.items.slice(0, limit) : [];

    if (items.length === 0) {
      throw new Error(response.message ?? "GitHub returned no repository candidates.");
    }

    return items.map((item, index) =>
      createSearchCandidate({
        candidate: {
          title: item.full_name || item.name || item.html_url,
          url: item.html_url,
          snippet: item.description ?? undefined,
          sourceType: "webpage",
          confidence: 0.84,
          metadata: {
            authority: "github",
            stars: item.stargazers_count ?? 0,
            language: item.language ?? "",
            provider_priority: this.settings.priority,
          },
        },
        discoveryMode: "frontier_web_search",
        index,
        providerId: this.id,
        providerKind: this.kind,
        query,
        timestamp,
      }),
    );
  }
}

class WikipediaAuthorityProvider implements SearchCandidateProvider {
  readonly id = "wikipedia";
  readonly kind = "authority" satisfies DataServiceProviderKind;

  constructor(private readonly settings: ContentProviderSettings) {}

  supports(request: SearchCandidateRequest): boolean {
    return request.discovery_mode === "frontier_web_search" && request.query.trim().length > 0;
  }

  async search(request: SearchCandidateRequest): Promise<SearchCandidate[]> {
    const query = request.query.trim();
    const timestamp = new Date().toISOString();
    const limit = clampLimit(request.limit, 1, 10);
    const languages = resolveProviderLanguages(this.settings, ["zh", "en"]).slice(0, 2);
    const candidates: SearchCandidate[] = [];

    for (const language of languages) {
      const perLanguageLimit = Math.max(1, Math.ceil(limit / languages.length));
      const url = new URL(`https://${language}.wikipedia.org/w/api.php`);
      url.searchParams.set("action", "query");
      url.searchParams.set("list", "search");
      url.searchParams.set("srsearch", query);
      url.searchParams.set("srlimit", String(perLanguageLimit));
      url.searchParams.set("format", "json");
      url.searchParams.set("origin", "*");
      const response = await fetchJson<WikipediaSearchResponse>(url.href, {
        headers: createApiHeaders("application/json"),
      });

      for (const page of response.query?.search ?? []) {
        candidates.push(
          createSearchCandidate({
            candidate: {
              title: page.title,
              url: `https://${language}.wikipedia.org/wiki/${encodeURIComponent(page.title.replace(/\s+/g, "_"))}`,
              snippet: stripHtml(page.snippet),
              sourceType: "article",
              confidence: 0.86,
              metadata: {
                authority: "wikipedia",
                language,
                pageid: page.pageid,
                provider_priority: this.settings.priority,
              },
            },
            discoveryMode: "frontier_web_search",
            index: candidates.length,
            providerId: this.id,
            providerKind: this.kind,
            query,
            timestamp,
          }),
        );
      }
    }

    if (candidates.length === 0) {
      throw new Error("Wikipedia returned no article candidates.");
    }

    return candidates.slice(0, limit);
  }
}

class WikidataAuthorityProvider implements SearchCandidateProvider {
  readonly id = "wikidata";
  readonly kind = "authority" satisfies DataServiceProviderKind;

  constructor(private readonly settings: ContentProviderSettings) {}

  supports(request: SearchCandidateRequest): boolean {
    return request.discovery_mode === "frontier_web_search" && request.query.trim().length > 0;
  }

  async search(request: SearchCandidateRequest): Promise<SearchCandidate[]> {
    const query = request.query.trim();
    const timestamp = new Date().toISOString();
    const limit = clampLimit(request.limit, 1, 10);
    const language = resolveProviderLanguages(this.settings, ["zh", "en"])[0] ?? "en";
    const url = new URL("https://www.wikidata.org/w/api.php");
    url.searchParams.set("action", "wbsearchentities");
    url.searchParams.set("search", query);
    url.searchParams.set("language", language);
    url.searchParams.set("uselang", language);
    url.searchParams.set("limit", String(limit));
    url.searchParams.set("format", "json");
    url.searchParams.set("origin", "*");
    const response = await fetchJson<WikidataSearchResponse>(url.href, {
      headers: createApiHeaders("application/json"),
    });
    const items = Array.isArray(response.search) ? response.search.slice(0, limit) : [];

    if (items.length === 0) {
      throw new Error("Wikidata returned no entity candidates.");
    }

    return items.map((item, index) =>
      createSearchCandidate({
        candidate: {
          title: item.label ? `${item.label} (${item.id})` : item.id,
          url: item.concepturi || `https://www.wikidata.org/wiki/${item.id}`,
          snippet: item.description,
          sourceType: "article",
          confidence: 0.82,
          metadata: {
            authority: "wikidata",
            language,
            entity_id: item.id,
            provider_priority: this.settings.priority,
          },
        },
        discoveryMode: "frontier_web_search",
        index,
        providerId: this.id,
        providerKind: this.kind,
        query,
        timestamp,
      }),
    );
  }
}

class PlaywrightBrowserSearchProvider implements SearchCandidateProvider {
  readonly id = "browser-assisted-playwright";
  readonly kind = "browser_search" satisfies DataServiceProviderKind;

  constructor(private readonly browserPool: BrowserContextProvider) {}

  supports(request: SearchCandidateRequest): boolean {
    return request.discovery_mode === "frontier_web_search" && request.query.trim().length > 0;
  }

  async search(request: SearchCandidateRequest): Promise<SearchCandidate[]> {
    const query = request.query.trim();
    const timestamp = new Date().toISOString();
    const context = await this.browserPool.getContext(request.tab_id);
    const candidates = await searchBrowserEngines(context, query, request.limit ?? 8);

    return candidates.map((candidate, index) =>
      createSearchCandidate({
        candidate,
        discoveryMode: "frontier_web_search",
        index,
        providerId: this.id,
        providerKind: this.kind,
        query,
        timestamp,
      }),
    );
  }
}

class UrlOnlySiteSearchProvider implements SearchCandidateProvider {
  readonly kind = "url_only" satisfies DataServiceProviderKind;

  constructor(
    private readonly browserPool: BrowserContextProvider,
    readonly id: string,
    private readonly label: string,
    private readonly domains: string[],
  ) {}

  supports(request: SearchCandidateRequest): boolean {
    return request.discovery_mode === "frontier_web_search" && request.query.trim().length > 0;
  }

  async search(request: SearchCandidateRequest): Promise<SearchCandidate[]> {
    const query = request.query.trim();
    const timestamp = new Date().toISOString();
    const siteQuery = `${this.domains.map((domain) => `site:${domain}`).join(" OR ")} ${query}`;
    const context = await this.browserPool.getContext(request.tab_id);
    const candidates = await searchBrowserEngines(context, siteQuery, request.limit ?? 8);
    const domainSet = new Set(this.domains);
    const filtered = candidates.filter((candidate) => {
      const url = parseHttpUrl(candidate.url);
      const hostname = url?.hostname.replace(/^www\./, "");
      return hostname ? Array.from(domainSet).some((domain) => hostname === domain || hostname.endsWith(`.${domain}`)) : false;
    });

    if (filtered.length === 0) {
      throw new Error(`${this.label} URL-only provider found no site-restricted candidates.`);
    }

    return filtered.map((candidate, index) =>
      createSearchCandidate({
        candidate: {
          ...candidate,
          confidence: 0.62,
          metadata: {
            site_restricted: true,
            provider_label: this.label,
          },
        },
        discoveryMode: "frontier_web_search",
        index,
        providerId: this.id,
        providerKind: this.kind,
        query,
        timestamp,
      }),
    );
  }
}

class PlaywrightPageOutlinksProvider implements SearchCandidateProvider {
  readonly id = "playwright-page-outlinks";
  readonly kind = "page_outlinks" satisfies DataServiceProviderKind;

  constructor(private readonly browserPool: BrowserContextProvider) {}

  supports(request: SearchCandidateRequest): boolean {
    return request.discovery_mode === "page_outlinks" && Boolean(parseHttpUrl(request.source_url ?? request.query));
  }

  async search(request: SearchCandidateRequest): Promise<SearchCandidate[]> {
    const sourceUrl = parseHttpUrl(request.source_url ?? request.query);

    if (!sourceUrl) {
      throw new Error("Page outlink discovery requires a direct source URL.");
    }

    const context = await this.browserPool.getContext(request.tab_id);
    const timestamp = new Date().toISOString();

    return withPage(context, async (page) => {
      await page.goto(sourceUrl.href, {
        timeout: 18_000,
        waitUntil: "domcontentloaded",
      });
      const candidates = dedupeLinkCandidates(await extractPageOutlinkCandidates(page)).slice(0, request.limit ?? 10);

      if (candidates.length === 0) {
        throw new Error("Page outlink discovery found no usable links.");
      }

      return candidates.map((candidate, index) =>
        createSearchCandidate({
          candidate,
          discoveryMode: "page_outlinks",
          index,
          providerId: this.id,
          providerKind: this.kind,
          query: sourceUrl.href,
          timestamp,
        }),
      );
    });
  }
}

async function snapshotWithContext(context: BrowserContext, url: URL, timestamp: string): Promise<SourceSnapshot> {
  return withPage(context, async (page) => {
    page.setDefaultTimeout(8_000);
    const response = await page.goto(url.href, {
      timeout: 15_000,
      waitUntil: "domcontentloaded",
    });
    const visibleText = normalizeWhitespace(await page.locator("body").innerText({ timeout: 5_000 }).catch(() => ""));

    return {
      url: url.href,
      final_url: page.url(),
      title: normalizeWhitespace(await page.title()),
      content_type: response?.headers()["content-type"],
      visible_text: visibleText,
      excerpt: visibleText.slice(0, 6_000),
      outlinks: await extractOutlinks(page),
      media: await extractMedia(page),
      source_type: inferSourceType(url, response),
      retrieved_at: timestamp,
    };
  });
}

async function withPage<T>(context: BrowserContext, usePage: (page: Page) => Promise<T>): Promise<T> {
  let page: Page | undefined;

  try {
    page = await context.newPage();
    page.setDefaultTimeout(8_000);
    return await usePage(page);
  } finally {
    await page?.close().catch(() => undefined);
  }
}

async function searchBrowserEngines(context: BrowserContext, query: string, limit: number): Promise<LinkCandidate[]> {
  const failures: string[] = [];
  const providers: Array<{
    extract: (page: Page) => Promise<LinkCandidate[]>;
    name: string;
    url: string;
  }> = [
    {
      extract: extractDuckDuckGoCandidates,
      name: "duckduckgo",
      url: `https://duckduckgo.com/html/?q=${encodeURIComponent(query)}`,
    },
    {
      extract: extractBingCandidates,
      name: "bing",
      url: `https://www.bing.com/search?q=${encodeURIComponent(query)}`,
    },
  ];

  return withPage(context, async (page) => {
    for (const provider of providers) {
      try {
        await page.goto(provider.url, {
          timeout: 18_000,
          waitUntil: "domcontentloaded",
        });
        const candidates = dedupeLinkCandidates(await provider.extract(page)).slice(0, limit);

        if (candidates.length > 0) {
          return candidates;
        }

        failures.push(`${provider.name}: no parseable candidates`);
      } catch (error) {
        failures.push(`${provider.name}: ${getErrorMessage(error)}`);
      }
    }

    throw new Error(`Browser search returned no parseable candidates. ${failures.join(" | ")}`);
  });
}

async function extractDuckDuckGoCandidates(page: Page): Promise<LinkCandidate[]> {
  return page.evaluate<LinkCandidate[]>(() => {
    function normalizeDuckDuckGoUrl(href: string): string {
      try {
        const url = new URL(href);
        const encoded = url.searchParams.get("uddg");

        return encoded ? decodeURIComponent(encoded) : href;
      } catch {
        return href;
      }
    }

    return Array.from(document.querySelectorAll(".result"))
      .slice(0, 10)
      .map((result) => {
        const anchor = result.querySelector<HTMLAnchorElement>("a.result__a");
        const snippetElement = result.querySelector<HTMLElement>(".result__snippet");
        const snippet = snippetElement?.textContent?.trim() || snippetElement?.innerText;

        return {
          title: anchor?.textContent?.trim() || anchor?.innerText || "",
          url: anchor ? normalizeDuckDuckGoUrl(anchor.href) : "",
          snippet,
        };
      })
      .filter((candidate) => candidate.title && candidate.url);
  });
}

async function extractBingCandidates(page: Page): Promise<LinkCandidate[]> {
  return page.evaluate<LinkCandidate[]>(() => {
    function normalizeBingUrl(href: string): string {
      try {
        const url = new URL(href);
        const encoded = url.searchParams.get("u");

        if (!encoded) {
          return href;
        }

        const base64 = encoded.startsWith("a1") ? encoded.slice(2) : encoded;
        const decoded = atob(base64.replace(/-/g, "+").replace(/_/g, "/"));

        return decoded || href;
      } catch {
        return href;
      }
    }

    return Array.from(document.querySelectorAll<HTMLElement>("li.b_algo"))
      .slice(0, 10)
      .map((result) => {
        const anchor = result.querySelector<HTMLAnchorElement>("h2 a[href], a[href]");
        const snippetElement = result.querySelector<HTMLElement>(".b_caption p, p");
        const snippet = snippetElement?.textContent?.trim() || snippetElement?.innerText;

        return {
          title: anchor?.textContent?.trim() || anchor?.innerText || "",
          url: anchor ? normalizeBingUrl(anchor.href) : "",
          snippet,
        };
      })
      .filter((candidate) => candidate.title && candidate.url);
  });
}

async function extractPageOutlinkCandidates(page: Page): Promise<LinkCandidate[]> {
  return page.evaluate<LinkCandidate[]>(() =>
    Array.from(document.querySelectorAll<HTMLAnchorElement>("a[href]"))
      .map((anchor) => ({
        title: anchor.innerText || anchor.getAttribute("aria-label") || anchor.href,
        url: anchor.href,
        snippet: anchor.closest("p, li, article, section")?.textContent?.trim().slice(0, 260),
      }))
      .filter((candidate) => candidate.title && candidate.url)
      .slice(0, 24),
  );
}

async function extractOutlinks(page: Page): Promise<SourceSnapshotOutlink[]> {
  return extractPageOutlinkCandidates(page)
    .then((candidates) =>
      candidates.slice(0, 24).map((candidate) => ({
        title: candidate.title.trim(),
        url: candidate.url,
        snippet: candidate.snippet ? normalizeWhitespace(candidate.snippet).slice(0, 260) : undefined,
      })),
    )
    .catch(() => []);
}

async function extractMedia(page: Page): Promise<SourceSnapshotMedia[]> {
  return page
    .evaluate<SourceSnapshotMedia[]>(() =>
      [
        ...Array.from(document.querySelectorAll<HTMLImageElement>("img[src]")).map((image) => ({
          kind: "image" as const,
          url: image.currentSrc || image.src,
          alt: image.alt || undefined,
          title: image.title || undefined,
        })),
        ...Array.from(document.querySelectorAll<HTMLVideoElement>("video[src], video source[src]")).map((video) => ({
          kind: "video" as const,
          url: video.currentSrc || video.getAttribute("src") || "",
          title: video.title || undefined,
        })),
      ]
        .filter((candidate) => candidate.url)
        .slice(0, 24),
    )
    .catch(() => []);
}

async function launchScoutBrowser(chromium: typeof import("playwright").chromium): Promise<Browser> {
  const launchOptions: Array<{ channel?: string; headless: true }> = [
    { headless: true },
    { channel: "msedge", headless: true },
    { channel: "chrome", headless: true },
  ];
  let lastError: unknown;

  for (const options of launchOptions) {
    try {
      return await chromium.launch(options);
    } catch (error) {
      lastError = error;
    }
  }

  throw new Error(`No Playwright-compatible Chromium browser could be launched. ${getErrorMessage(lastError)}`);
}

function createObservationFromSourceResult(
  plan: ScoutPlan,
  tabId: string,
  query: string,
  result: SourceObservationResult,
  timestamp: string,
  index: number,
): ScoutObservation {
  if (!result.snapshot) {
    return createFailedObservation(
      plan,
      tabId,
      query,
      timestamp,
      result.failure_reason ?? "Source observer did not return a snapshot.",
      index,
    );
  }

  const snapshot = result.snapshot;

  return {
    id: `observation-${plan.id}-${toSlug(snapshot.final_url || snapshot.url)}-${Date.now()}-${index + 1}`,
    tab_id: tabId,
    plan_id: plan.id,
    status: "source_candidate",
    adapter: "playwright",
    discovery_mode: plan.discovery_mode,
    query,
    title: snapshot.title || `Observed page: ${new URL(snapshot.final_url || snapshot.url).hostname}`,
    target_node_ids: plan.target_node_ids,
    url: snapshot.final_url,
    snippet: snapshot.excerpt ?? (snapshot.visible_text ? snapshot.visible_text.slice(0, 420) : "Playwright observed the page, but no body text was available."),
    source_snapshot: snapshot,
    source_type: snapshot.source_type,
    retrieved_at: snapshot.retrieved_at,
    confidence: 0.86,
    created_at: timestamp,
    updated_at: timestamp,
  };
}

function createObservationFromSearchCandidate(
  plan: ScoutPlan,
  tabId: string,
  query: string,
  candidate: SearchCandidate,
  timestamp: string,
  index: number,
): ScoutObservation {
  return {
    id: `observation-${plan.id}-${toSlug(candidate.url)}-${Date.now()}-${index + 1}`,
    tab_id: tabId,
    plan_id: plan.id,
    status: "source_candidate",
    adapter: "playwright",
    discovery_mode: candidate.discovery_mode,
    confidence: candidate.confidence,
    query,
    title: candidate.title,
    target_node_ids: plan.target_node_ids,
    url: candidate.url,
    snippet: candidate.snippet ?? `DataService found "${candidate.title}". Candidate only; not source-backed terrain.`,
    source_type: candidate.source_type,
    retrieved_at: candidate.discovered_at,
    created_at: timestamp,
    updated_at: timestamp,
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

function createSearchCandidate({
  candidate,
  discoveryMode,
  index,
  providerId,
  providerKind,
  query,
  timestamp,
}: {
  candidate: LinkCandidate;
  discoveryMode: ScoutDiscoveryMode;
  index: number;
  providerId: string;
  providerKind: DataServiceProviderKind;
  query: string;
  timestamp: string;
}): SearchCandidate {
  return {
    id: `candidate-${providerId}-${toSlug(candidate.url)}-${Date.now()}-${index + 1}`,
    provider_id: providerId,
    provider_kind: providerKind,
    discovery_mode: discoveryMode === "page_outlinks" ? "page_outlinks" : "frontier_web_search",
    query,
    title: normalizeWhitespace(candidate.title),
    url: candidate.url.split("#")[0],
    snippet: candidate.snippet ? normalizeWhitespace(candidate.snippet).slice(0, 420) : undefined,
    rank: index + 1,
    confidence: candidate.confidence ?? inferSearchCandidateConfidence(providerKind),
    source_type: candidate.sourceType ?? "webpage",
    discovered_at: timestamp,
    metadata: candidate.metadata,
  };
}

function inferSearchCandidateConfidence(providerKind: DataServiceProviderKind): number {
  switch (providerKind) {
    case "authority":
      return 0.84;
    case "page_outlinks":
      return 0.74;
    case "url_only":
      return 0.62;
    case "browser_search":
      return 0.68;
    default:
      return 0.6;
  }
}

function createSearchFailureReason(providerRuns: SearchCandidateProviderRun[]): string {
  if (providerRuns.length === 0) {
    return "DataService search returned no providers.";
  }

  return providerRuns
    .map((run) => `${run.provider_id}: ${run.failure_reason ?? `${run.status} with ${run.candidate_count} candidates`}`)
    .join(" | ");
}

function dedupeLinkCandidates(candidates: LinkCandidate[]): LinkCandidate[] {
  const seenUrls = new Set<string>();
  const unique: LinkCandidate[] = [];

  for (const candidate of candidates) {
    const normalizedUrl = candidate.url.split("#")[0];

    if (!normalizedUrl || seenUrls.has(normalizedUrl)) {
      continue;
    }

    seenUrls.add(normalizedUrl);
    unique.push({
      ...candidate,
      url: normalizedUrl,
    });
  }

  return unique;
}

function dedupeSearchCandidates(candidates: SearchCandidate[]): SearchCandidate[] {
  const seenUrls = new Set<string>();
  const unique: SearchCandidate[] = [];

  for (const candidate of candidates.sort((left, right) => left.rank - right.rank || right.confidence - left.confidence)) {
    const normalizedUrl = candidate.url.split("#")[0];

    if (!normalizedUrl || seenUrls.has(normalizedUrl)) {
      continue;
    }

    seenUrls.add(normalizedUrl);
    unique.push({
      ...candidate,
      url: normalizedUrl,
      rank: unique.length + 1,
    });
  }

  return unique;
}

function parseHttpUrl(value: string | undefined): URL | undefined {
  const trimmed = value?.trim();

  if (!trimmed) {
    return undefined;
  }

  const candidate = trimmed.startsWith("www.") ? `https://${trimmed}` : trimmed;

  try {
    const url = new URL(candidate);
    return url.protocol === "http:" || url.protocol === "https:" ? url : undefined;
  } catch {
    return undefined;
  }
}

function inferSourceType(url: URL, response: Response | null): SourceType {
  const contentType = response?.headers()["content-type"] ?? "";

  if (contentType.includes("pdf") || url.pathname.toLowerCase().endsWith(".pdf")) {
    return "document";
  }

  return "webpage";
}

interface ArxivEntry {
  title: string;
  summary?: string;
  url: string;
  pdfUrl?: string;
  published?: string;
}

interface GitHubRepositorySearchResponse {
  items?: Array<{
    name?: string;
    full_name?: string;
    html_url: string;
    description?: string | null;
    stargazers_count?: number;
    language?: string | null;
  }>;
  message?: string;
}

interface WikipediaSearchResponse {
  query?: {
    search?: Array<{
      pageid: number;
      title: string;
      snippet?: string;
    }>;
  };
}

interface WikidataSearchResponse {
  search?: Array<{
    id: string;
    label?: string;
    description?: string;
    concepturi?: string;
  }>;
}

async function fetchText(url: string, init?: RequestInit): Promise<string> {
  const response = await fetch(url, init);
  const text = await response.text();

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${text.slice(0, 240)}`);
  }

  return text;
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const text = await response.text();

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${text.slice(0, 240)}`);
  }

  try {
    return JSON.parse(text) as T;
  } catch (error) {
    throw new Error(`Provider returned invalid JSON: ${getErrorMessage(error)}`);
  }
}

function createApiHeaders(accept: string): Record<string, string> {
  return {
    Accept: accept,
    "User-Agent": "SeekStarScout/0.1 (+https://seekstar.local; contact=local-user)",
  };
}

function parseArxivEntries(xml: string): ArxivEntry[] {
  return (xml.match(/<entry\b[\s\S]*?<\/entry>/g) ?? [])
    .map((entry): ArxivEntry | undefined => {
      const id = readXmlTag(entry, "id");
      const title = normalizeWhitespace(decodeXmlEntities(readXmlTag(entry, "title")));
      const summary = normalizeWhitespace(decodeXmlEntities(readXmlTag(entry, "summary")));
      const published = normalizeWhitespace(readXmlTag(entry, "published"));
      const links = parseXmlLinks(entry);
      const pdfUrl = links.find((link) => link.title === "pdf" || link.type === "application/pdf")?.href;
      const canonicalUrl = id || links.find((link) => link.rel === "alternate")?.href || pdfUrl;

      if (!title || !canonicalUrl) {
        return undefined;
      }

      const parsedEntry: ArxivEntry = {
        title,
        url: canonicalUrl,
      };

      if (summary) {
        parsedEntry.summary = summary;
      }

      if (pdfUrl) {
        parsedEntry.pdfUrl = pdfUrl;
      }

      if (published) {
        parsedEntry.published = published;
      }

      return parsedEntry;
    })
    .filter((entry): entry is ArxivEntry => Boolean(entry));
}

function readXmlTag(xml: string, tag: string): string {
  const match = xml.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return match?.[1]?.trim() ?? "";
}

function parseXmlLinks(xml: string): Array<Record<string, string>> {
  return Array.from(xml.matchAll(/<link\s+([^>]+?)\/?>/gi)).map((match) => {
    const attributes: Record<string, string> = {};

    for (const attribute of match[1].matchAll(/([a-zA-Z:_-]+)=["']([^"']*)["']/g)) {
      attributes[attribute[1]] = decodeXmlEntities(attribute[2]);
    }

    return attributes;
  });
}

function decodeXmlEntities(value: string): string {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'");
}

function stripHtml(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }

  return normalizeWhitespace(value.replace(/<[^>]+>/g, " "));
}

function resolveProviderLanguages(settings: ContentProviderSettings, fallback: readonly string[]): string[] {
  return settings.languages && settings.languages.length > 0 ? settings.languages : [...fallback];
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

function clampLimit(value: unknown, min: number, max: number): number {
  return clampNumber(value, min, max, max);
}

function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, Math.round(value)));
}

function getEnvValue(name: string | undefined): string | undefined {
  return name && typeof process !== "undefined" ? process.env[name] : undefined;
}

function normalizeWhitespace(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function toSlug(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72);
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
