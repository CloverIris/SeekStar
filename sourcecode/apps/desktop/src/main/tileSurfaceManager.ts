import { BaseWindow, BrowserWindow, WebContentsView, ipcMain, shell, webContents } from "electron";
import type { IpcMainInvokeEvent, Rectangle } from "electron";
import type { DeepLensSnapshot } from "@seekstar/core-schema";
import type { SeekStarSettings } from "./appSettingsStore";

export interface TileSurfaceHost {
  bounds: Rectangle;
  window: BaseWindow;
}

export interface TileSurfaceLinkEvent {
  nodeId: string;
  sourceId?: string;
  tabId: string;
  title: string;
  url: string;
}

export type TileSurfaceThumbnailStatus = "loading" | "ready" | "failed";

export interface TileSurfaceThumbnailEvent {
  dataUrl?: string;
  error?: string;
  nodeId: string;
  sourceId?: string;
  sourceUrl: string;
  status: TileSurfaceThumbnailStatus;
  tabId: string;
  title: string;
  updatedAt: string;
}

export type TileSurfaceDeepLensSnapshot = DeepLensSnapshot;

interface TileSurfaceSyncInput {
  surfaces: TileSurfaceSyncItem[];
  tabId: string;
}

type TileSurfaceLoadPriority = "none" | "low" | "medium" | "high";
type TileSurfaceLoadState = "metadata_only" | "thumbnail_ready" | "renderer_visible" | "renderer_focused";
type TileSurfaceRenderMode = "thumbnail" | "live";
type TileSurfaceVisibility = "off_viewport" | "near_viewport" | "visible" | "focused";

interface TileSurfaceSyncItem {
  bounds: Rectangle;
  loadPriority: TileSurfaceLoadPriority;
  loadState: TileSurfaceLoadState;
  nodeId: string;
  renderMode: TileSurfaceRenderMode;
  sourceId?: string;
  sourceUrl: string;
  title: string;
  visibility: TileSurfaceVisibility;
}

interface LiveTileSurfaceEntry {
  currentUrl?: string;
  expectedUrl?: string;
  item: TileSurfaceSyncItem;
  owner?: BaseWindow;
  tabId: string;
  view: WebContentsView;
}

interface TileThumbnailCacheEntry {
  dataUrl: string;
  height: number;
  item: TileSurfaceSyncItem;
  updatedAt: number;
  width: number;
}

interface TileThumbnailRequest {
  item: TileSurfaceSyncItem;
  key: string;
  requestedAt: number;
  tabId: string;
}

interface TileThumbnailJob {
  cancelled: boolean;
  key: string;
  tabId: string;
  window: BrowserWindow;
}

interface TileSurfaceManagerSettings {
  liveSurfaceLimit: number;
  thumbnailPrewarmConcurrency: number;
}

const HTTP_PROTOCOLS = new Set(["http:", "https:"]);
const THUMBNAIL_CAPTURE_WIDTH = 640;
const THUMBNAIL_CAPTURE_HEIGHT = 400;
const THUMBNAIL_CAPTURE_DELAY_MS = 650;
const THUMBNAIL_LOAD_TIMEOUT_MS = 12_000;
const MAX_THUMBNAIL_CACHE_ENTRIES = 160;
const DEEP_LENS_EXTRACTION_SCRIPT = `
(() => {
  const MAX_PARAGRAPHS = 24;
  const MAX_WORDS_PER_PARAGRAPH = 5;
  const MAX_TEXT = 24000;

  function normalizeText(value) {
    return String(value || "").replace(/\\s+/g, " ").trim();
  }

  function cssPath(element) {
    if (!element || element.nodeType !== Node.ELEMENT_NODE) {
      return "document";
    }

    const parts = [];
    let current = element;

    while (current && current.nodeType === Node.ELEMENT_NODE && parts.length < 8) {
      const tag = current.tagName.toLowerCase();
      const id = current.id ? "#" + current.id.replace(/[^a-zA-Z0-9_-]/g, "") : "";

      if (id) {
        parts.unshift(tag + id);
        break;
      }

      const siblings = Array.from(current.parentElement?.children || []).filter((item) => item.tagName === current.tagName);
      const index = siblings.indexOf(current) + 1;
      parts.unshift(siblings.length > 1 ? tag + ":nth-of-type(" + index + ")" : tag);
      current = current.parentElement;
    }

    return parts.join(" > ") || "document";
  }

  function rectsForElement(element) {
    return Array.from(element.getClientRects()).slice(0, 4).map((rect) => ({
      x: Math.round(rect.x),
      y: Math.round(rect.y),
      width: Math.round(rect.width),
      height: Math.round(rect.height),
    }));
  }

  const candidates = Array.from(document.querySelectorAll("main h1, main h2, main h3, main p, article h1, article h2, article h3, article p, section h1, section h2, section h3, section p, h1, h2, h3, p"))
    .map((element) => ({ element, text: normalizeText(element.innerText || element.textContent) }))
    .filter((item) => item.text.length >= 24)
    .slice(0, MAX_PARAGRAPHS);

  const allText = normalizeText(document.body?.innerText || document.documentElement?.textContent || "").slice(0, MAX_TEXT);
  let cursor = 0;
  const grains = [];

  for (const [index, item] of candidates.entries()) {
    const textStart = allText.indexOf(item.text.slice(0, Math.min(80, item.text.length)), cursor);
    const start = textStart >= 0 ? textStart : cursor;
    const end = Math.min(MAX_TEXT, start + item.text.length);
    const tag = item.element.tagName.toLowerCase();
    const kind = /^h[1-3]$/.test(tag) ? "section" : "paragraph";
    const locator = cssPath(item.element);

    cursor = end;
    grains.push({
      locator,
      kind,
      text: item.text.slice(0, 1200),
      start,
      end,
      rects: rectsForElement(item.element),
    });

    const words = item.text.match(/[\\p{L}\\p{N}][\\p{L}\\p{N}_-]{3,}/gu) || [];
    for (const [wordIndex, word] of Array.from(new Set(words)).slice(0, MAX_WORDS_PER_PARAGRAPH).entries()) {
      const wordStart = allText.indexOf(word, start);
      grains.push({
        locator: locator + "::word(" + (wordIndex + 1) + ")",
        kind: "word",
        text: word,
        start: wordStart >= 0 ? wordStart : start,
        end: (wordStart >= 0 ? wordStart : start) + word.length,
        rects: [],
      });
    }
  }

  return {
    title: normalizeText(document.title) || location.href,
    text: allText,
    grains,
  };
})()
`;

export class TileSurfaceManager {
  private readonly liveEntriesByKey = new Map<string, LiveTileSurfaceEntry>();
  private readonly thumbnailCacheByKey = new Map<string, TileThumbnailCacheEntry>();
  private readonly thumbnailJobsByKey = new Map<string, TileThumbnailJob>();
  private readonly thumbnailRequestsByKey = new Map<string, TileThumbnailRequest>();
  private settings: TileSurfaceManagerSettings = {
    liveSurfaceLimit: 1,
    thumbnailPrewarmConcurrency: 2,
  };

  constructor(private readonly resolveHost: (tabId: string) => TileSurfaceHost | undefined) {}

  applySettings(settings: Pick<SeekStarSettings, "tile_live_surface_limit" | "tile_thumbnail_prewarm_concurrency">): void {
    this.settings = {
      liveSurfaceLimit: clampInteger(settings.tile_live_surface_limit, 1, 8, 1),
      thumbnailPrewarmConcurrency: clampInteger(settings.tile_thumbnail_prewarm_concurrency, 1, 6, 2),
    };
    this.pruneLiveEntriesToLimit();
    this.startThumbnailJobs();
  }

  registerIpc(): void {
    registerHandler("tiles:sync", async (_event, input) => {
      this.syncSurfaces(parseTileSurfaceSyncInput(input));
    });
    registerHandler("tiles:clear", async (_event, tabId) => {
      this.clearTab(parseTabId(tabId));
    });
    registerHandler("tiles:capture-deep-lens", async (_event, input) => {
      return this.captureDeepLensSnapshot(parseTileSurfaceDeepLensRequest(input));
    });
  }

  clearTab(tabId: string): void {
    for (const [key, entry] of this.liveEntriesByKey.entries()) {
      if (entry.tabId === tabId) {
        this.destroyLiveEntry(key, entry);
      }
    }

    for (const [key, job] of this.thumbnailJobsByKey.entries()) {
      if (job.tabId === tabId) {
        this.cancelThumbnailJob(key, job);
      }
    }

    for (const [key, request] of this.thumbnailRequestsByKey.entries()) {
      if (request.tabId === tabId) {
        this.thumbnailRequestsByKey.delete(key);
      }
    }

    for (const [key, cache] of this.thumbnailCacheByKey.entries()) {
      if (cache.item && key.startsWith(`${tabId}:`)) {
        this.thumbnailCacheByKey.delete(key);
      }
    }
  }

  clearAll(): void {
    for (const [key, entry] of this.liveEntriesByKey.entries()) {
      this.destroyLiveEntry(key, entry);
    }

    for (const [key, job] of this.thumbnailJobsByKey.entries()) {
      this.cancelThumbnailJob(key, job);
    }

    this.thumbnailRequestsByKey.clear();
    this.thumbnailCacheByKey.clear();
  }

  syncSurfaces(input: TileSurfaceSyncInput): void {
    const host = this.resolveHost(input.tabId);

    if (!host) {
      this.clearTab(input.tabId);
      return;
    }

    const rankedSurfaces = rankTileSurfaces(input.surfaces);

    this.syncThumbnailRequests(input.tabId, rankedSurfaces);
    this.syncLiveSurfaces(input.tabId, host, rankedSurfaces);
  }

  async captureDeepLensSnapshot(input: { nodeId: string; tabId: string }): Promise<TileSurfaceDeepLensSnapshot> {
    const key = createTileSurfaceKey(input.tabId, input.nodeId);
    const entry = this.liveEntriesByKey.get(key);

    if (!entry || entry.view.webContents.isDestroyed()) {
      throw new Error("No live browser tile is available for Deep Lens capture.");
    }

    const extracted = await entry.view.webContents.executeJavaScript(DEEP_LENS_EXTRACTION_SCRIPT, true) as Partial<DeepLensSnapshot>;
    const capturedAt = new Date().toISOString();
    const text = typeof extracted.text === "string" ? extracted.text : "";
    const grains = Array.isArray(extracted.grains) ? extracted.grains : [];

    return {
      node_id: entry.item.nodeId,
      source_id: entry.item.sourceId,
      source_url: entry.currentUrl ?? entry.expectedUrl ?? entry.item.sourceUrl,
      title: typeof extracted.title === "string" && extracted.title.trim() ? extracted.title.trim() : entry.item.title,
      captured_at: capturedAt,
      text,
      grains: grains
        .map((grain) => normalizeDeepLensGrain(grain))
        .filter((grain): grain is DeepLensSnapshot["grains"][number] => Boolean(grain))
        .slice(0, 96),
    };
  }

  private syncThumbnailRequests(tabId: string, surfaces: TileSurfaceSyncItem[]): void {
    const nextKeys = new Set<string>();

    for (const surface of surfaces) {
      if (!isThumbnailCandidate(surface)) {
        continue;
      }

      const key = createTileSurfaceKey(tabId, surface.nodeId);
      const cached = this.thumbnailCacheByKey.get(key);

      nextKeys.add(key);

      if (cached?.item.sourceUrl === surface.sourceUrl && cached.dataUrl) {
        cached.item = surface;
        cached.updatedAt = Date.now();
        this.emitThumbnailEvent(tabId, surface, "ready", { dataUrl: cached.dataUrl });
        continue;
      }

      if (cached && cached.item.sourceUrl !== surface.sourceUrl) {
        this.thumbnailCacheByKey.delete(key);
      }

      if (this.thumbnailJobsByKey.has(key)) {
        continue;
      }

      this.thumbnailRequestsByKey.set(key, {
        item: surface,
        key,
        requestedAt: Date.now(),
        tabId,
      });
      this.emitThumbnailEvent(tabId, surface, "loading");
    }

    for (const [key, request] of this.thumbnailRequestsByKey.entries()) {
      if (request.tabId === tabId && !nextKeys.has(key)) {
        this.thumbnailRequestsByKey.delete(key);
      }
    }

    for (const [key, job] of this.thumbnailJobsByKey.entries()) {
      if (job.tabId === tabId && !nextKeys.has(key)) {
        this.cancelThumbnailJob(key, job);
      }
    }

    this.startThumbnailJobs();
  }

  private syncLiveSurfaces(tabId: string, host: TileSurfaceHost, surfaces: TileSurfaceSyncItem[]): void {
    const nextKeys = new Set<string>();
    const liveSurfaces = surfaces.filter(isLiveCandidate).slice(0, this.settings.liveSurfaceLimit);

    for (const surface of liveSurfaces) {
      const key = createTileSurfaceKey(tabId, surface.nodeId);
      nextKeys.add(key);
      const entry = this.ensureLiveEntry(key, tabId, surface);

      entry.item = surface;
      this.attachLiveEntry(entry, host, toWindowBounds(host.bounds, surface.bounds));
      this.loadLiveEntryUrl(entry, surface.sourceUrl);
    }

    for (const [key, entry] of this.liveEntriesByKey.entries()) {
      if (entry.tabId === tabId && !nextKeys.has(key)) {
        this.destroyLiveEntry(key, entry);
      }
    }
  }

  private ensureLiveEntry(key: string, tabId: string, item: TileSurfaceSyncItem): LiveTileSurfaceEntry {
    const existing = this.liveEntriesByKey.get(key);

    if (existing && !existing.view.webContents.isDestroyed()) {
      return existing;
    }

    const view = new WebContentsView({
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        partition: `persist:seekstar-webtile-${sanitizePartitionSegment(tabId)}`,
      },
    });
    view.setBackgroundColor("#05080d");

    const entry: LiveTileSurfaceEntry = {
      item,
      tabId,
      view,
    };

    view.webContents.setWindowOpenHandler(({ url: openedUrl }) => {
      this.emitLinkActivated(entry, openedUrl);
      return { action: "deny" };
    });
    view.webContents.on("will-navigate", (event, navigationUrl) => {
      const normalizedNavigationUrl = parseHttpUrl(navigationUrl)?.href;

      if (!normalizedNavigationUrl || normalizedNavigationUrl === entry.expectedUrl || normalizedNavigationUrl === entry.currentUrl) {
        return;
      }

      event.preventDefault();
      this.emitLinkActivated(entry, normalizedNavigationUrl);
    });
    view.webContents.on("did-navigate", (_event, navigatedUrl) => {
      entry.currentUrl = parseHttpUrl(navigatedUrl)?.href ?? navigatedUrl;
      entry.expectedUrl = undefined;
    });
    view.webContents.on("render-process-gone", () => {
      this.destroyLiveEntry(key, entry);
    });
    view.webContents.on("destroyed", () => {
      this.liveEntriesByKey.delete(key);
    });

    this.liveEntriesByKey.set(key, entry);
    return entry;
  }

  private attachLiveEntry(entry: LiveTileSurfaceEntry, host: TileSurfaceHost, bounds: Rectangle): void {
    if (isWindowDestroyed(host.window)) {
      return;
    }

    if (entry.owner !== host.window) {
      this.removeLiveEntryFromOwner(entry);
      host.window.contentView.addChildView(entry.view);
      entry.owner = host.window;
    }

    entry.view.setBounds(bounds);
  }

  private loadLiveEntryUrl(entry: LiveTileSurfaceEntry, url: string): void {
    if (entry.currentUrl === url || entry.expectedUrl === url) {
      return;
    }

    entry.expectedUrl = url;
    void entry.view.webContents.loadURL(url).catch((error) => {
      console.warn(`[SeekStar] Failed to load live web tile ${entry.item.nodeId}: ${getErrorMessage(error)}`);
    });
  }

  private emitLinkActivated(entry: LiveTileSurfaceEntry, url: string): void {
    const parsed = parseHttpUrl(url);

    if (!parsed) {
      void shell.openExternal(url);
      return;
    }

    const event = {
      nodeId: entry.item.nodeId,
      sourceId: entry.item.sourceId,
      tabId: entry.tabId,
      title: entry.item.title,
      url: parsed.href,
    } satisfies TileSurfaceLinkEvent;

    for (const contents of webContents.getAllWebContents()) {
      contents.send("tiles:link-activated", event);
    }
  }

  private destroyLiveEntry(key: string, entry: LiveTileSurfaceEntry): void {
    this.removeLiveEntryFromOwner(entry);

    try {
      if (!entry.view.webContents.isDestroyed()) {
        entry.view.webContents.close();
      }
    } catch {
      // Native view teardown may have already started.
    }

    this.liveEntriesByKey.delete(key);
  }

  private removeLiveEntryFromOwner(entry: LiveTileSurfaceEntry): void {
    if (!entry.owner || isWindowDestroyed(entry.owner)) {
      entry.owner = undefined;
      return;
    }

    try {
      entry.owner.contentView.removeChildView(entry.view);
    } catch {
      // The view may already have been removed by native teardown.
    }

    entry.owner = undefined;
  }

  private startThumbnailJobs(): void {
    while (this.thumbnailJobsByKey.size < this.settings.thumbnailPrewarmConcurrency) {
      const request = this.pickNextThumbnailRequest();

      if (!request) {
        return;
      }

      this.thumbnailRequestsByKey.delete(request.key);
      this.startThumbnailJob(request);
    }
  }

  private pickNextThumbnailRequest(): TileThumbnailRequest | undefined {
    return [...this.thumbnailRequestsByKey.values()]
      .filter((request) => !this.thumbnailJobsByKey.has(request.key))
      .sort(compareThumbnailRequests)[0];
  }

  private startThumbnailJob(request: TileThumbnailRequest): void {
    const window = new BrowserWindow({
      width: THUMBNAIL_CAPTURE_WIDTH,
      height: THUMBNAIL_CAPTURE_HEIGHT,
      show: false,
      paintWhenInitiallyHidden: true,
      backgroundColor: "#05080d",
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        offscreen: true,
        partition: `persist:seekstar-webtile-${sanitizePartitionSegment(request.tabId)}`,
        sandbox: true,
      },
    });
    const job: TileThumbnailJob = {
      cancelled: false,
      key: request.key,
      tabId: request.tabId,
      window,
    };

    window.webContents.setAudioMuted(true);
    window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
    window.webContents.on("render-process-gone", () => {
      if (!job.cancelled) {
        this.emitThumbnailEvent(request.tabId, request.item, "failed", { error: "thumbnail renderer process ended" });
      }
      this.cancelThumbnailJob(request.key, job);
    });
    window.on("closed", () => {
      this.thumbnailJobsByKey.delete(request.key);
      this.startThumbnailJobs();
    });

    this.thumbnailJobsByKey.set(request.key, job);

    void this.runThumbnailJob(request, job)
      .catch((error) => {
        if (!job.cancelled) {
          this.emitThumbnailEvent(request.tabId, request.item, "failed", { error: getErrorMessage(error) });
        }
      })
      .finally(() => {
        if (this.thumbnailJobsByKey.get(request.key) === job) {
          this.thumbnailJobsByKey.delete(request.key);
        }
        destroyBrowserWindowIfAlive(window);
        this.startThumbnailJobs();
      });
  }

  private async runThumbnailJob(request: TileThumbnailRequest, job: TileThumbnailJob): Promise<void> {
    this.emitThumbnailEvent(request.tabId, request.item, "loading");
    await withTimeout(job.window.webContents.loadURL(request.item.sourceUrl), THUMBNAIL_LOAD_TIMEOUT_MS, "thumbnail load timed out");
    await delay(THUMBNAIL_CAPTURE_DELAY_MS);

    if (job.cancelled || job.window.isDestroyed() || job.window.webContents.isDestroyed()) {
      return;
    }

    const image = await job.window.webContents.capturePage();
    const resized = image.resize({
      height: THUMBNAIL_CAPTURE_HEIGHT,
      quality: "good",
      width: THUMBNAIL_CAPTURE_WIDTH,
    });
    const dataUrl = resized.toDataURL();

    this.thumbnailCacheByKey.set(request.key, {
      dataUrl,
      height: THUMBNAIL_CAPTURE_HEIGHT,
      item: request.item,
      updatedAt: Date.now(),
      width: THUMBNAIL_CAPTURE_WIDTH,
    });
    this.pruneThumbnailCache();
    this.emitThumbnailEvent(request.tabId, request.item, "ready", { dataUrl });
  }

  private cancelThumbnailJob(key: string, job: TileThumbnailJob): void {
    job.cancelled = true;
    this.thumbnailJobsByKey.delete(key);
    destroyBrowserWindowIfAlive(job.window);
  }

  private emitThumbnailEvent(
    tabId: string,
    item: TileSurfaceSyncItem,
    status: TileSurfaceThumbnailStatus,
    details: { dataUrl?: string; error?: string } = {},
  ): void {
    const event = {
      dataUrl: details.dataUrl,
      error: details.error,
      nodeId: item.nodeId,
      sourceId: item.sourceId,
      sourceUrl: item.sourceUrl,
      status,
      tabId,
      title: item.title,
      updatedAt: new Date().toISOString(),
    } satisfies TileSurfaceThumbnailEvent;

    for (const contents of webContents.getAllWebContents()) {
      contents.send("tiles:thumbnail-updated", event);
    }
  }

  private pruneLiveEntriesToLimit(): void {
    const entriesByTab = new Map<string, Array<[string, LiveTileSurfaceEntry]>>();

    for (const entry of this.liveEntriesByKey.entries()) {
      const list = entriesByTab.get(entry[1].tabId) ?? [];
      list.push(entry);
      entriesByTab.set(entry[1].tabId, list);
    }

    for (const entries of entriesByTab.values()) {
      const ranked = entries.sort((a, b) => compareTileSurfaces(a[1].item, b[1].item));

      for (const [key, entry] of ranked.slice(this.settings.liveSurfaceLimit)) {
        this.destroyLiveEntry(key, entry);
      }
    }
  }

  private pruneThumbnailCache(): void {
    if (this.thumbnailCacheByKey.size <= MAX_THUMBNAIL_CACHE_ENTRIES) {
      return;
    }

    const entries = [...this.thumbnailCacheByKey.entries()].sort((a, b) => a[1].updatedAt - b[1].updatedAt);

    for (const [key] of entries.slice(0, this.thumbnailCacheByKey.size - MAX_THUMBNAIL_CACHE_ENTRIES)) {
      this.thumbnailCacheByKey.delete(key);
    }
  }
}

function parseTileSurfaceSyncInput(value: unknown): TileSurfaceSyncInput {
  const candidate = typeof value === "object" && value !== null ? (value as Partial<TileSurfaceSyncInput>) : {};
  const tabId = parseTabId(candidate.tabId);
  const surfaces = Array.isArray(candidate.surfaces)
    ? candidate.surfaces.map(parseTileSurfaceSyncItem).filter((surface): surface is TileSurfaceSyncItem => Boolean(surface))
    : [];

  return { tabId, surfaces };
}

function parseTileSurfaceDeepLensRequest(value: unknown): { nodeId: string; tabId: string } {
  const candidate = typeof value === "object" && value !== null ? value as { nodeId?: unknown; tabId?: unknown } : {};
  const tabId = parseTabId(candidate.tabId);
  const nodeId = typeof candidate.nodeId === "string" && candidate.nodeId.trim() ? candidate.nodeId.trim() : undefined;

  if (!nodeId) {
    throw new Error("Deep Lens capture requires a node id.");
  }

  return { nodeId, tabId };
}

function normalizeDeepLensGrain(value: unknown): DeepLensSnapshot["grains"][number] | undefined {
  const candidate = typeof value === "object" && value !== null ? value as Partial<DeepLensSnapshot["grains"][number]> : {};
  const text = typeof candidate.text === "string" ? candidate.text.trim() : "";
  const locator = typeof candidate.locator === "string" && candidate.locator.trim() ? candidate.locator.trim() : undefined;
  const kind =
    candidate.kind === "section" || candidate.kind === "paragraph" || candidate.kind === "phrase" || candidate.kind === "word"
      ? candidate.kind
      : undefined;
  const start = typeof candidate.start === "number" && Number.isFinite(candidate.start) ? Math.max(0, Math.round(candidate.start)) : undefined;
  const end = typeof candidate.end === "number" && Number.isFinite(candidate.end) ? Math.max(start ?? 0, Math.round(candidate.end)) : undefined;

  if (!text || !locator || !kind || start === undefined || end === undefined) {
    return undefined;
  }

  return {
    locator,
    text: text.slice(0, 1_200),
    kind,
    start,
    end,
    rects: Array.isArray(candidate.rects)
      ? candidate.rects.flatMap((rect) => {
          const box = typeof rect === "object" && rect !== null ? rect as { x?: unknown; y?: unknown; width?: unknown; height?: unknown } : {};
          return typeof box.x === "number" &&
            typeof box.y === "number" &&
            typeof box.width === "number" &&
            typeof box.height === "number"
            ? [{ x: box.x, y: box.y, width: box.width, height: box.height }]
            : [];
        }).slice(0, 4)
      : undefined,
  };
}

function parseTileSurfaceSyncItem(value: unknown): TileSurfaceSyncItem | undefined {
  const candidate = typeof value === "object" && value !== null ? (value as Partial<TileSurfaceSyncItem>) : {};
  const sourceUrl = typeof candidate.sourceUrl === "string" ? parseHttpUrl(candidate.sourceUrl)?.href : undefined;
  const nodeId = typeof candidate.nodeId === "string" && candidate.nodeId.trim() ? candidate.nodeId.trim() : undefined;
  const title = typeof candidate.title === "string" && candidate.title.trim() ? candidate.title.trim() : sourceUrl;
  const bounds = parseRectangle(candidate.bounds);

  if (!sourceUrl || !nodeId || !title || !bounds) {
    return undefined;
  }

  return {
    bounds,
    loadPriority: parseLoadPriority(candidate.loadPriority),
    loadState: parseLoadState(candidate.loadState),
    nodeId,
    renderMode: candidate.renderMode === "live" ? "live" : "thumbnail",
    sourceId: typeof candidate.sourceId === "string" && candidate.sourceId.trim() ? candidate.sourceId.trim() : undefined,
    sourceUrl,
    title,
    visibility: parseVisibility(candidate.visibility),
  };
}

function parseLoadPriority(value: unknown): TileSurfaceLoadPriority {
  return value === "high" || value === "medium" || value === "low" || value === "none" ? value : "medium";
}

function parseLoadState(value: unknown): TileSurfaceLoadState {
  return value === "renderer_focused" || value === "renderer_visible" || value === "thumbnail_ready" || value === "metadata_only"
    ? value
    : "thumbnail_ready";
}

function parseVisibility(value: unknown): TileSurfaceVisibility {
  return value === "focused" || value === "visible" || value === "near_viewport" || value === "off_viewport" ? value : "visible";
}

function parseRectangle(value: unknown): Rectangle | undefined {
  const candidate = typeof value === "object" && value !== null ? (value as Partial<Rectangle>) : {};
  const x = clampRectangleNumber(candidate.x);
  const y = clampRectangleNumber(candidate.y);
  const width = clampRectangleNumber(candidate.width);
  const height = clampRectangleNumber(candidate.height);

  if (x === undefined || y === undefined || width === undefined || height === undefined || width < 1 || height < 1) {
    return undefined;
  }

  return {
    x: Math.round(x),
    y: Math.round(y),
    width: Math.round(width),
    height: Math.round(height),
  };
}

function parseTabId(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error("Tile surface sync requires tabId.");
  }

  return value.trim();
}

function parseHttpUrl(value: string): URL | undefined {
  try {
    const url = new URL(value);
    return HTTP_PROTOCOLS.has(url.protocol) ? url : undefined;
  } catch {
    return undefined;
  }
}

function toWindowBounds(hostBounds: Rectangle, surfaceBounds: Rectangle): Rectangle {
  return {
    x: Math.round(hostBounds.x + surfaceBounds.x),
    y: Math.round(hostBounds.y + surfaceBounds.y),
    width: Math.round(surfaceBounds.width),
    height: Math.round(surfaceBounds.height),
  };
}

function createTileSurfaceKey(tabId: string, nodeId: string): string {
  return `${tabId}:${nodeId}`;
}

function sanitizePartitionSegment(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "") || "tab";
}

function isThumbnailCandidate(surface: TileSurfaceSyncItem): boolean {
  return (
    surface.loadPriority !== "none" &&
    surface.renderMode === "thumbnail" &&
    surface.sourceUrl.length > 0 &&
    (surface.visibility === "visible" || surface.visibility === "focused")
  );
}

function isLiveCandidate(surface: TileSurfaceSyncItem): boolean {
  return surface.renderMode === "live" && surface.sourceUrl.length > 0 && surface.visibility === "focused";
}

function rankTileSurfaces(surfaces: TileSurfaceSyncItem[]): TileSurfaceSyncItem[] {
  return [...surfaces].sort(compareTileSurfaces);
}

function compareTileSurfaces(a: TileSurfaceSyncItem, b: TileSurfaceSyncItem): number {
  return (
    getPriorityRank(b.loadPriority) - getPriorityRank(a.loadPriority) ||
    getVisibilityRank(b.visibility) - getVisibilityRank(a.visibility) ||
    getStateRank(b.loadState) - getStateRank(a.loadState) ||
    getArea(b.bounds) - getArea(a.bounds) ||
    a.title.localeCompare(b.title)
  );
}

function compareThumbnailRequests(a: TileThumbnailRequest, b: TileThumbnailRequest): number {
  return compareTileSurfaces(a.item, b.item) || a.requestedAt - b.requestedAt;
}

function getPriorityRank(priority: TileSurfaceLoadPriority): number {
  if (priority === "high") {
    return 3;
  }

  if (priority === "medium") {
    return 2;
  }

  if (priority === "low") {
    return 1;
  }

  return 0;
}

function getVisibilityRank(visibility: TileSurfaceVisibility): number {
  if (visibility === "focused") {
    return 3;
  }

  if (visibility === "visible") {
    return 2;
  }

  if (visibility === "near_viewport") {
    return 1;
  }

  return 0;
}

function getStateRank(state: TileSurfaceLoadState): number {
  if (state === "renderer_focused") {
    return 3;
  }

  if (state === "renderer_visible") {
    return 2;
  }

  if (state === "thumbnail_ready") {
    return 1;
  }

  return 0;
}

function getArea(bounds: Rectangle): number {
  return bounds.width * bounds.height;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  const timeout = new Promise<never>((_resolve, reject) => {
    timeoutId = setTimeout(() => reject(new Error(message)), timeoutMs);
  });

  return Promise.race([promise, timeout]).finally(() => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  });
}

function destroyBrowserWindowIfAlive(window: BrowserWindow): void {
  try {
    if (!window.isDestroyed()) {
      window.destroy();
    }
  } catch {
    // The offscreen window may already be closing after a failed navigation.
  }
}

function clampRectangleNumber(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return undefined;
  }

  return Math.min(32_000, Math.max(-32_000, value));
}

function clampInteger(value: unknown, min: number, max: number, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, Math.round(value)));
}

function registerHandler(channel: string, handler: (event: IpcMainInvokeEvent, ...args: unknown[]) => unknown): void {
  ipcMain.removeHandler(channel);
  ipcMain.handle(channel, handler);
}

function isWindowDestroyed(window: BaseWindow): boolean {
  try {
    return window.isDestroyed();
  } catch {
    return true;
  }
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
