import type { Browser, BrowserContext, Page, Response } from "playwright";
import type { ScoutObservation, ScoutPlan, ScoutRunRequest, ScoutRunResult, SourceType } from "@seekstar/core-schema";

export interface SourceSnapshot {
  url: string;
  finalUrl: string;
  title: string;
  visibleText: string;
  sourceType: SourceType;
  retrievedAt: string;
}

export interface ScoutDataService {
  run(request: ScoutRunRequest): Promise<ScoutRunResult>;
  snapshotUrl(tabId: string, url: string): Promise<SourceSnapshot>;
  dispose(): Promise<void>;
}

export class PlaywrightScoutService implements ScoutDataService {
  private browser: Browser | undefined;
  private readonly contextsByTabId = new Map<string, BrowserContext>();

  async run(request: ScoutRunRequest): Promise<ScoutRunResult> {
    const completedAt = new Date().toISOString();
    const context = await this.getContext(request.tab_id);
    const observations: ScoutObservation[] = [];

    for (const [index, query] of request.plan.candidate_queries.slice(0, 5).entries()) {
      const url = parseHttpUrl(query);

      if (!url) {
        observations.push(createFailedObservation(request.plan, request.tab_id, query, completedAt, "Scout requires direct HTTP(S) URLs in the package CLI.", index));
        continue;
      }

      observations.push(await observeUrl(context, request.plan, request.tab_id, query, url, completedAt, index));
    }

    return {
      adapter: "playwright",
      observations,
      completed_at: completedAt,
    };
  }

  async snapshotUrl(tabId: string, urlValue: string): Promise<SourceSnapshot> {
    const url = parseHttpUrl(urlValue);

    if (!url) {
      throw new Error("snapshotUrl requires an HTTP(S) URL.");
    }

    const context = await this.getContext(tabId);
    let page: Page | undefined;

    try {
      page = await context.newPage();
      page.setDefaultTimeout(8_000);
      const response = await page.goto(url.href, {
        timeout: 15_000,
        waitUntil: "domcontentloaded",
      });

      return {
        url: url.href,
        finalUrl: page.url(),
        title: normalizeWhitespace(await page.title()),
        visibleText: normalizeWhitespace(await page.locator("body").innerText({ timeout: 5_000 }).catch(() => "")),
        sourceType: inferSourceType(url, response),
        retrievedAt: new Date().toISOString(),
      };
    } finally {
      await page?.close().catch(() => undefined);
    }
  }

  async dispose(): Promise<void> {
    await Promise.all(Array.from(this.contextsByTabId.values()).map((context) => context.close().catch(() => undefined)));
    this.contextsByTabId.clear();
    await this.browser?.close().catch(() => undefined);
    this.browser = undefined;
  }

  private async getContext(tabId: string): Promise<BrowserContext> {
    const existing = this.contextsByTabId.get(tabId);

    if (existing) {
      return existing;
    }

    if (!this.browser?.isConnected()) {
      const { chromium } = await import("playwright");
      this.browser = await chromium.launch({ headless: true });
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
}

async function observeUrl(
  context: BrowserContext,
  plan: ScoutPlan,
  tabId: string,
  query: string,
  url: URL,
  timestamp: string,
  index: number,
): Promise<ScoutObservation> {
  try {
    const snapshot = await snapshotWithContext(context, url);

    return {
      id: `observation-${plan.id}-${toSlug(url.hostname)}-${Date.now()}-${index + 1}`,
      tab_id: tabId,
      plan_id: plan.id,
      status: "source_candidate",
      adapter: "playwright",
      discovery_mode: plan.discovery_mode,
      query,
      title: snapshot.title || `Observed page: ${url.hostname}`,
      target_node_ids: plan.target_node_ids,
      url: snapshot.finalUrl,
      snippet: snapshot.visibleText ? snapshot.visibleText.slice(0, 420) : "Playwright observed the page, but no body text was available.",
      source_type: snapshot.sourceType,
      retrieved_at: timestamp,
      created_at: timestamp,
      updated_at: timestamp,
    };
  } catch (error) {
    return createFailedObservation(plan, tabId, query, timestamp, `Playwright could not observe this URL: ${getErrorMessage(error)}`, index);
  }
}

async function snapshotWithContext(context: BrowserContext, url: URL): Promise<SourceSnapshot> {
  let page: Page | undefined;

  try {
    page = await context.newPage();
    page.setDefaultTimeout(8_000);
    const response = await page.goto(url.href, {
      timeout: 15_000,
      waitUntil: "domcontentloaded",
    });

    return {
      url: url.href,
      finalUrl: page.url(),
      title: normalizeWhitespace(await page.title()),
      visibleText: normalizeWhitespace(await page.locator("body").innerText({ timeout: 5_000 }).catch(() => "")),
      sourceType: inferSourceType(url, response),
      retrievedAt: new Date().toISOString(),
    };
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

function toSlug(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
