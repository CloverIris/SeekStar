import { ipcMain } from "electron";
import type { ScoutDiscoveryMode, ScoutObservation, ScoutPlan, ScoutRunRequest, ScoutRunResult, SourceType } from "@seekstar/core-schema";
import type { Browser, BrowserContext, Page, Response } from "playwright";

const SCOUT_RUN_PLAN_CHANNEL = "scout:run-plan";

export function registerScoutAdapter(): void {
  ipcMain.removeHandler(SCOUT_RUN_PLAN_CHANNEL);
  ipcMain.handle(SCOUT_RUN_PLAN_CHANNEL, async (_event, request: unknown): Promise<ScoutRunResult> => {
    const parsedRequest = parseScoutRunRequest(request);
    const completedAt = new Date().toISOString();
    const hasDirectUrl = parsedRequest.plan.candidate_queries.some((query) => parseHttpUrl(query));

    if (parsedRequest.plan.discovery_mode === "frontier_web_search") {
      return {
        adapter: "playwright",
        observations: await createFrontierSearchObservations(parsedRequest.plan, parsedRequest.tab_id, completedAt),
        completed_at: completedAt,
      };
    }

    if (parsedRequest.plan.discovery_mode === "page_outlinks") {
      return {
        adapter: "playwright",
        observations: await createPageOutlinkObservations(parsedRequest.plan, parsedRequest.tab_id, completedAt),
        completed_at: completedAt,
      };
    }

    if (hasDirectUrl) {
      return {
        adapter: "playwright",
        observations: await createPlaywrightScoutObservations(parsedRequest.plan, parsedRequest.tab_id, completedAt),
        completed_at: completedAt,
      };
    }

    return {
      adapter: "mock",
      observations: createMockScoutObservations(parsedRequest.plan, parsedRequest.tab_id, completedAt),
      completed_at: completedAt,
    };
  });
}

interface LinkCandidate {
  title: string;
  url: string;
  snippet?: string;
}

async function createPlaywrightScoutObservations(plan: ScoutPlan, tabId: string, timestamp: string): Promise<ScoutObservation[]> {
  let browser: Browser | undefined;
  let context: BrowserContext | undefined;

  try {
    const { chromium } = await import("playwright");
    browser = await launchScoutBrowser(chromium);
    context = await browser.newContext({
      javaScriptEnabled: true,
      userAgent: "SeekStarScout/0.1 (+https://seekstar.local)",
    });

    const observations: ScoutObservation[] = [];

    for (const [index, query] of plan.candidate_queries.slice(0, 5).entries()) {
      const url = parseHttpUrl(query);

      if (!url) {
        observations.push(createFailedObservation(plan, tabId, query, timestamp, "P4.5 real Scout only accepts direct HTTP(S) URLs. It does not turn keywords into search-result pages.", index));
        continue;
      }

      observations.push(await observeUrl({ context, index, plan, query, tabId, timestamp, url }));
    }

    return observations;
  } catch (error) {
    return [
      createFailedObservation(
        plan,
        tabId,
        plan.candidate_queries[0] ?? plan.title,
        timestamp,
        `Playwright Scout adapter failed before observing a page: ${getErrorMessage(error)}`,
        0,
      ),
    ];
  } finally {
    await context?.close().catch(() => undefined);
    await browser?.close().catch(() => undefined);
  }
}

async function createFrontierSearchObservations(plan: ScoutPlan, tabId: string, timestamp: string): Promise<ScoutObservation[]> {
  const query = plan.candidate_queries[0] ?? plan.title;
  const searchUrl = `https://duckduckgo.com/html/?q=${encodeURIComponent(query)}`;

  return withScoutPage(plan, tabId, timestamp, async (page) => {
    await page.goto(searchUrl, {
      timeout: 18_000,
      waitUntil: "domcontentloaded",
    });

    const candidates = await page.evaluate<LinkCandidate[]>(() =>
      Array.from(document.querySelectorAll(".result"))
        .slice(0, 10)
        .map((result) => {
          const anchor = result.querySelector<HTMLAnchorElement>("a.result__a");
          const snippet = result.querySelector<HTMLElement>(".result__snippet")?.innerText;

          return {
            title: anchor?.innerText ?? "",
            url: anchor?.href ?? "",
            snippet,
          };
        })
        .filter((candidate) => candidate.title && candidate.url),
    );

    if (candidates.length === 0) {
      return [createFailedObservation(plan, tabId, query, timestamp, "Frontier web search returned no parseable candidates.", 0)];
    }

    return candidates.slice(0, 8).map((candidate, index) =>
      createCandidateObservation({
        discoveryMode: "frontier_web_search",
        index,
        plan,
        query,
        snippet: candidate.snippet,
        tabId,
        timestamp,
        title: candidate.title,
        url: candidate.url,
      }),
    );
  });
}

async function createPageOutlinkObservations(plan: ScoutPlan, tabId: string, timestamp: string): Promise<ScoutObservation[]> {
  const sourceUrl = plan.candidate_queries.map((query) => parseHttpUrl(query)).find(Boolean);

  if (!sourceUrl) {
    return [
      createFailedObservation(
        plan,
        tabId,
        plan.candidate_queries[0] ?? plan.title,
        timestamp,
        "Page outlink Scout requires a direct source URL.",
        0,
      ),
    ];
  }

  return withScoutPage(plan, tabId, timestamp, async (page) => {
    await page.goto(sourceUrl.href, {
      timeout: 18_000,
      waitUntil: "domcontentloaded",
    });

    const candidates = await page.evaluate<LinkCandidate[]>(() =>
      Array.from(document.querySelectorAll<HTMLAnchorElement>("a[href]"))
        .map((anchor) => ({
          title: anchor.innerText || anchor.getAttribute("aria-label") || anchor.href,
          url: anchor.href,
          snippet: anchor.closest("p, li, article, section")?.textContent?.trim().slice(0, 260),
        }))
        .filter((candidate) => candidate.title && candidate.url)
        .slice(0, 24),
    );
    const uniqueCandidates = dedupeCandidates(candidates).slice(0, 10);

    if (uniqueCandidates.length === 0) {
      return [createFailedObservation(plan, tabId, sourceUrl.href, timestamp, "Page outlink Scout found no usable links.", 0)];
    }

    return uniqueCandidates.map((candidate, index) =>
      createCandidateObservation({
        discoveryMode: "page_outlinks",
        index,
        plan,
        query: sourceUrl.href,
        snippet: candidate.snippet,
        tabId,
        timestamp,
        title: candidate.title,
        url: candidate.url,
      }),
    );
  });
}

async function withScoutPage(
  plan: ScoutPlan,
  tabId: string,
  timestamp: string,
  observe: (page: Page) => Promise<ScoutObservation[]>,
): Promise<ScoutObservation[]> {
  let browser: Browser | undefined;
  let context: BrowserContext | undefined;
  let page: Page | undefined;

  try {
    const { chromium } = await import("playwright");
    browser = await launchScoutBrowser(chromium);
    context = await browser.newContext({
      javaScriptEnabled: true,
      userAgent: "SeekStarScout/0.1 (+https://seekstar.local)",
    });
    page = await context.newPage();
    page.setDefaultTimeout(8_000);

    return await observe(page);
  } catch (error) {
    return [
      createFailedObservation(
        plan,
        tabId,
        plan.candidate_queries[0] ?? plan.title,
        timestamp,
        `Playwright Scout failed: ${getErrorMessage(error)}`,
        0,
      ),
    ];
  } finally {
    await page?.close().catch(() => undefined);
    await context?.close().catch(() => undefined);
    await browser?.close().catch(() => undefined);
  }
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

async function observeUrl({
  context,
  index,
  plan,
  query,
  tabId,
  timestamp,
  url,
}: {
  context: BrowserContext;
  index: number;
  plan: ScoutPlan;
  query: string;
  tabId: string;
  timestamp: string;
  url: URL;
}): Promise<ScoutObservation> {
  let page: Page | undefined;

  try {
    page = await context.newPage();
    page.setDefaultTimeout(8_000);
    const response = await page.goto(url.href, {
      timeout: 15_000,
      waitUntil: "domcontentloaded",
    });
    const title = normalizeWhitespace(await page.title());
    const bodyText = normalizeWhitespace(await page.locator("body").innerText({ timeout: 5_000 }).catch(() => ""));
    const snippet = bodyText ? bodyText.slice(0, 420) : "Playwright observed the page, but no body text was available.";

    return {
      id: `observation-${plan.id}-${toSlug(url.hostname)}-${Date.now()}-${index + 1}`,
      tab_id: tabId,
      plan_id: plan.id,
      status: "source_candidate",
      adapter: "playwright",
      query,
      title: title || `Observed page: ${url.hostname}`,
      target_node_ids: plan.target_node_ids,
      url: url.href,
      snippet,
      source_type: inferSourceType(url, response),
      retrieved_at: timestamp,
      created_at: timestamp,
      updated_at: timestamp,
    };
  } catch (error) {
    return createFailedObservation(plan, tabId, query, timestamp, `Playwright could not observe this URL: ${getErrorMessage(error)}`, index);
  } finally {
    await page?.close().catch(() => undefined);
  }
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

function createCandidateObservation({
  discoveryMode,
  index,
  plan,
  query,
  snippet,
  tabId,
  timestamp,
  title,
  url,
}: {
  discoveryMode: ScoutDiscoveryMode;
  index: number;
  plan: ScoutPlan;
  query: string;
  snippet?: string;
  tabId: string;
  timestamp: string;
  title: string;
  url: string;
}): ScoutObservation {
  return {
    id: `observation-${plan.id}-${toSlug(title || url)}-${Date.now()}-${index + 1}`,
    tab_id: tabId,
    plan_id: plan.id,
    status: "source_candidate",
    adapter: "playwright",
    discovery_mode: discoveryMode,
    query,
    title,
    target_node_ids: plan.target_node_ids,
    url,
    snippet: snippet ? normalizeWhitespace(snippet).slice(0, 420) : `Playwright Scout found "${title}". Candidate only; not source-backed terrain.`,
    source_type: "webpage",
    retrieved_at: timestamp,
    confidence: 0.68,
    created_at: timestamp,
    updated_at: timestamp,
  };
}

function parseScoutRunRequest(value: unknown): ScoutRunRequest {
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

function createMockScoutObservations(plan: ScoutPlan, tabId: string, timestamp: string): ScoutObservation[] {
  const sourceTypes = plan.source_type_targets.length > 0 ? plan.source_type_targets : (["webpage"] satisfies SourceType[]);

  return plan.candidate_queries.slice(0, 5).map<ScoutObservation>((query, index) => {
    const status = resolveMockStatus(index);
    const sourceType = sourceTypes[index % sourceTypes.length];
    const slug = toSlug(query);

    return {
      id: `observation-${plan.id}-${slug}-${Date.now()}-${index + 1}`,
      tab_id: tabId,
      plan_id: plan.id,
      status,
      adapter: "mock",
      discovery_mode: plan.discovery_mode,
      query,
      title: createObservationTitle(query, index),
      target_node_ids: plan.target_node_ids,
      url:
        status === "failed"
          ? undefined
          : `https://example.invalid/seekstar-scout/${slug || `candidate-${index + 1}`}`,
      snippet:
        status === "failed"
          ? undefined
          : `Mock Scout observation for "${query}". This is structured intake only, not source-backed terrain.`,
      source_type: sourceType,
      retrieved_at: status === "failed" ? undefined : timestamp,
      failure_reason: status === "failed" ? "Mock Scout adapter withheld this candidate to exercise failed-state handling." : undefined,
      duplicate_of: status === "duplicate" ? `observation-${plan.id}-candidate-1` : undefined,
      created_at: timestamp,
      updated_at: timestamp,
    };
  });
}

function dedupeCandidates(candidates: LinkCandidate[]): LinkCandidate[] {
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

function resolveMockStatus(index: number): ScoutObservation["status"] {
  if (index === 0) {
    return "source_candidate";
  }

  if (index === 1) {
    return "observed";
  }

  if (index === 2) {
    return "duplicate";
  }

  if (index === 3) {
    return "failed";
  }

  return "pending";
}

function createObservationTitle(query: string, index: number): string {
  const trimmed = query.trim();
  const prefix = index === 0 ? "Candidate source" : "Scout observation";

  return trimmed ? `${prefix}: ${trimmed}` : `${prefix} ${index + 1}`;
}

function toSlug(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function parseHttpUrl(value: string): URL | undefined {
  const trimmed = value.trim();
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

function normalizeWhitespace(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
