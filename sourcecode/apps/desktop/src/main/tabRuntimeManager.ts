import { app, BaseWindow, WebContentsView, clipboard, ipcMain, shell, webContents } from "electron";
import type { IpcMainInvokeEvent, Rectangle } from "electron";
import type { TabCachePolicy, TabCrashReport, TabRecord, TabRuntimeStatus, WorkspaceFolder } from "@seekstar/core-schema";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { defaultSettings, loadSettings } from "./appSettingsStore";
import type { SeekStarSettings } from "./appSettingsStore";

const TAB_RUNTIME_FILE_NAME = "seekstar-tab-runtime.json";
const DEFAULT_TAB_ID = "tab-default-new-seek";
const DEFAULT_TAB_TITLE = "New Seek";
const DEFAULT_WORKSPACE_NAME = "SeekStar local workspace";
const TAB_RUNTIME_SCHEMA_REVISION = 59;

export interface TabRuntimeSnapshot {
  version: 1;
  schema_revision: typeof TAB_RUNTIME_SCHEMA_REVISION;
  workspace_name: string;
  active_tab_id: string;
  tabs: TabRecord[];
  folders: WorkspaceFolder[];
  updated_at: string;
}

interface RuntimeEntry {
  record: TabRecord;
  view?: WebContentsView;
  viewSurface?: TabViewSurface;
  owner?: BaseWindow;
}

interface DetachedWindowEntry {
  window: BaseWindow;
  tabId: string;
}

type TabViewSurface = "docked" | "detached";

export class TabObjectCache {
  private readonly entriesByTabId = new Map<string, Array<{ key: string; bytes: number; hits: number; lastAccessedAt: number }>>();

  touch(tabId: string, key: string, bytes: number, policy: TabCachePolicy): number {
    const now = Date.now();
    const entries = this.entriesByTabId.get(tabId) ?? [];
    const existing = entries.find((entry) => entry.key === key);

    if (existing) {
      existing.bytes = bytes;
      existing.hits += 1;
      existing.lastAccessedAt = now;
    } else {
      entries.push({ key, bytes, hits: 1, lastAccessedAt: now });
    }

    this.entriesByTabId.set(tabId, entries);
    this.evict(tabId, policy.max_bytes);
    return this.getUsage(tabId);
  }

  clear(tabId?: string): void {
    if (tabId) {
      this.entriesByTabId.delete(tabId);
      return;
    }

    this.entriesByTabId.clear();
  }

  enforcePolicy(tabId: string, policy: TabCachePolicy): number {
    this.evict(tabId, policy.max_bytes);
    return this.getUsage(tabId);
  }

  getUsage(tabId: string): number {
    return (this.entriesByTabId.get(tabId) ?? []).reduce((sum, entry) => sum + entry.bytes, 0);
  }

  private evict(tabId: string, maxBytes: number): void {
    const entries = this.entriesByTabId.get(tabId) ?? [];
    let totalBytes = entries.reduce((sum, entry) => sum + entry.bytes, 0);

    if (totalBytes <= maxBytes) {
      return;
    }

    entries.sort((a, b) => a.hits - b.hits || a.lastAccessedAt - b.lastAccessedAt);

    while (entries.length > 0 && totalBytes > maxBytes) {
      const evicted = entries.shift();
      totalBytes -= evicted?.bytes ?? 0;
    }
  }
}

export class TabRuntimeManager {
  private readonly entriesByTabId = new Map<string, RuntimeEntry>();
  private readonly detachedWindowsById = new Map<number, DetachedWindowEntry>();
  private readonly cache = new TabObjectCache();
  private readonly foldersById = new Map<string, WorkspaceFolder>();
  private activeTabId = DEFAULT_TAB_ID;
  private workspaceName = DEFAULT_WORKSPACE_NAME;
  private mainWindow: BaseWindow | undefined;
  private dockBounds: Rectangle | undefined;
  private rendererUrl: string | undefined;
  private saveChain: Promise<void> = Promise.resolve();

  registerIpc(): void {
    this.registerHandler("tabs:list", async () => this.getSnapshot());
    this.registerHandler("tabs:create", async (_event, input) => this.createTab(parseTabCreateInput(input)));
    this.registerHandler("tabs:activate", async (_event, tabId) => this.activateTab(parseTabId(tabId)));
    this.registerHandler("tabs:close", async (_event, tabId) => this.closeTab(parseTabId(tabId)));
    this.registerHandler("tabs:reorder", async (_event, input) => this.reorderTabs(parseTabReorderInput(input)));
    this.registerHandler("tabs:refresh", async (_event, tabId) => this.refreshTab(parseTabId(tabId)));
    this.registerHandler("tabs:toggle-pin", async (_event, tabId) => this.toggleTabFlag(parseTabId(tabId), "pinned"));
    this.registerHandler("tabs:toggle-favorite", async (_event, tabId) => this.toggleTabFlag(parseTabId(tabId), "favorite"));
    this.registerHandler("tabs:create-folder", async (_event, input) => this.createFolder(parseFolderCreateInput(input)));
    this.registerHandler("tabs:delete-folder", async (_event, folderId) => this.deleteFolder(parseOptionalFolderId(folderId)));
    this.registerHandler("tabs:assign-folder", async (_event, input) => this.assignTabToFolder(parseFolderAssignInput(input)));
    this.registerHandler("tabs:rename-workspace", async (_event, name) => this.renameWorkspace(parseWorkspaceName(name)));
    this.registerHandler("tabs:detach", async (_event, tabId) => this.detachTab(parseTabId(tabId)));
    this.registerHandler("tabs:attach", async (_event, tabId) => this.attachTab(parseTabId(tabId)));
    this.registerHandler("tabs:set-dock-bounds", async (_event, bounds) => this.setDockBounds(parseDockBounds(bounds)));
    this.registerHandler("tabs:clear-cache", async (_event, tabId) => {
      this.cache.clear(typeof tabId === "string" ? tabId : undefined);
      await this.updateCacheUsage();
      return this.getSnapshot();
    });
    this.registerHandler("tabs:copy-crash-log", (_event, tabId) => {
      const report = this.entriesByTabId.get(parseTabId(tabId))?.record.crash_report;

      if (report) {
        clipboard.writeText(formatCrashReport(report));
      }
    });
  }

  setRendererUrl(rendererUrl: string): void {
    this.rendererUrl = rendererUrl;
  }

  setMainWindow(window: BaseWindow): void {
    this.mainWindow = window;
    window.on("closed", () => {
      if (this.mainWindow === window) {
        this.mainWindow = undefined;
        this.dockBounds = undefined;
      }
    });
  }

  async load(): Promise<void> {
    const snapshot = await this.loadSnapshot();
    this.activeTabId = snapshot.active_tab_id;
    this.workspaceName = snapshot.workspace_name;
    this.entriesByTabId.clear();
    this.foldersById.clear();

    for (const tab of snapshot.tabs) {
      this.entriesByTabId.set(tab.id, { record: tab });
    }

    for (const folder of snapshot.folders) {
      this.foldersById.set(folder.id, folder);
    }

    if (!this.entriesByTabId.has(this.activeTabId)) {
      this.activeTabId = snapshot.tabs[0]?.id ?? DEFAULT_TAB_ID;
    }
  }

  async getSnapshot(): Promise<TabRuntimeSnapshot> {
    await this.ensureLoaded();

    return {
      version: 1,
      schema_revision: TAB_RUNTIME_SCHEMA_REVISION,
      workspace_name: this.workspaceName,
      active_tab_id: this.activeTabId,
      tabs: this.getOrderedRecords(),
      folders: this.getOrderedFolders(),
      updated_at: new Date().toISOString(),
    };
  }

  async createTab(input: { tabId?: string; title: string; seed: string; activate: boolean }): Promise<TabRuntimeSnapshot> {
    await this.ensureLoaded();

    const now = new Date().toISOString();
    const id = input.tabId?.trim() || `tab-${toSlug(input.seed || input.title)}-${Date.now()}`;
    const existing = this.entriesByTabId.get(id);
    const shouldActivate = input.activate;

    if (existing) {
      existing.record = {
        ...existing.record,
        title: input.title,
        seed: input.seed,
        runtime_status: shouldActivate ? "active" : existing.record.runtime_status,
        last_accessed_at: shouldActivate ? now : existing.record.last_accessed_at,
        updated_at: now,
      };
    } else {
      const settings = await loadSettings().catch(() => defaultSettings);
      const record = createTabRecord({
        id,
        order: this.entriesByTabId.size,
        seed: input.seed,
        title: input.title,
        timestamp: now,
        maxBytes: settings.tab_cache_max_bytes,
        inactiveGraceMs: settings.inactive_grace_ms,
      });
      this.entriesByTabId.set(id, { record });
    }

    if (shouldActivate) {
      this.activeTabId = id;
      this.markActive(id);
      this.dockActiveTabView();
    }
    await this.save();
    this.broadcastChange();
    return this.getSnapshot();
  }

  async activateTab(tabId: string): Promise<TabRuntimeSnapshot> {
    await this.ensureLoaded();

    if (!this.entriesByTabId.has(tabId)) {
      return this.getSnapshot();
    }

    this.activeTabId = tabId;
    this.markActive(tabId);
    this.dockActiveTabView();
    await this.save();
    this.broadcastChange();
    return this.getSnapshot();
  }

  async closeTab(tabId: string): Promise<TabRuntimeSnapshot> {
    await this.ensureLoaded();

    const entry = this.entriesByTabId.get(tabId);

    if (!entry || this.entriesByTabId.size <= 1) {
      return this.getSnapshot();
    }

    entry.record.runtime_status = "closing";
    entry.record.window_state = "hidden";
    this.removeViewFromOwner(entry);
    this.closeDetachedWindow(tabId);
    this.closeEntryWebContents(entry);
    this.cache.clear(tabId);
    this.entriesByTabId.delete(tabId);

    if (this.activeTabId === tabId) {
      this.activeTabId = this.getOrderedRecords()[0]?.id ?? DEFAULT_TAB_ID;
    }

    this.normalizeOrder();
    this.markActive(this.activeTabId);
    this.dockActiveTabView();
    await this.save();
    this.broadcastChange();
    return this.getSnapshot();
  }

  async reorderTabs(input: { sourceTabId: string; targetTabId: string }): Promise<TabRuntimeSnapshot> {
    await this.ensureLoaded();

    const records = this.getOrderedRecords();
    const sourceIndex = records.findIndex((record) => record.id === input.sourceTabId);
    const targetIndex = records.findIndex((record) => record.id === input.targetTabId);

    if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) {
      return this.getSnapshot();
    }

    const [source] = records.splice(sourceIndex, 1);
    records.splice(targetIndex, 0, source);
    records.forEach((record, order) => {
      const entry = this.entriesByTabId.get(record.id);

      if (entry) {
        entry.record = { ...entry.record, order, updated_at: new Date().toISOString() };
      }
    });

    await this.save();
    this.broadcastChange();
    return this.getSnapshot();
  }

  async refreshTab(tabId: string): Promise<TabRuntimeSnapshot> {
    await this.ensureLoaded();
    const entry = this.entriesByTabId.get(tabId);

    if (!entry) {
      return this.getSnapshot();
    }

    const view = this.ensureTabView(tabId, entry.record.window_state === "detached" ? "detached" : "docked");
    const now = new Date().toISOString();
    entry.record.runtime_status = tabId === this.activeTabId ? "active" : "inactive";
    entry.record.last_accessed_at = now;
    entry.record.updated_at = now;
    entry.record.crash_report = undefined;
    void view.webContents.loadURL(this.buildTabUrl(tabId, entry.record.window_state === "detached" ? "detached" : "docked")).catch(() => undefined);

    await this.save();
    this.broadcastChange();
    return this.getSnapshot();
  }

  async toggleTabFlag(tabId: string, flag: "pinned" | "favorite"): Promise<TabRuntimeSnapshot> {
    await this.ensureLoaded();
    const entry = this.entriesByTabId.get(tabId);

    if (!entry) {
      return this.getSnapshot();
    }

    entry.record = {
      ...entry.record,
      [flag]: !entry.record[flag],
      updated_at: new Date().toISOString(),
    };

    await this.save();
    this.broadcastChange();
    return this.getSnapshot();
  }

  async renameWorkspace(name: string): Promise<TabRuntimeSnapshot> {
    await this.ensureLoaded();
    this.workspaceName = name;
    await this.save();
    this.broadcastChange();
    return this.getSnapshot();
  }

  async createFolder(input: { title: string }): Promise<TabRuntimeSnapshot> {
    await this.ensureLoaded();
    const now = new Date().toISOString();
    const id = `folder-${toSlug(input.title)}-${Date.now()}`;
    const folder: WorkspaceFolder = {
      id,
      title: input.title,
      order: this.foldersById.size,
      created_at: now,
      updated_at: now,
    };

    this.foldersById.set(folder.id, folder);
    await this.save();
    this.broadcastChange();
    return this.getSnapshot();
  }

  async deleteFolder(folderId: string | undefined): Promise<TabRuntimeSnapshot> {
    await this.ensureLoaded();

    if (!folderId || !this.foldersById.has(folderId)) {
      return this.getSnapshot();
    }

    this.foldersById.delete(folderId);
    for (const entry of this.entriesByTabId.values()) {
      if (entry.record.folder_id === folderId) {
        entry.record = {
          ...entry.record,
          folder_id: undefined,
          updated_at: new Date().toISOString(),
        };
      }
    }

    this.normalizeFolderOrder();
    await this.save();
    this.broadcastChange();
    return this.getSnapshot();
  }

  async assignTabToFolder(input: { tabId: string; folderId?: string }): Promise<TabRuntimeSnapshot> {
    await this.ensureLoaded();
    const entry = this.entriesByTabId.get(input.tabId);

    if (!entry || (input.folderId && !this.foldersById.has(input.folderId))) {
      return this.getSnapshot();
    }

    entry.record = {
      ...entry.record,
      folder_id: input.folderId,
      updated_at: new Date().toISOString(),
    };
    await this.save();
    this.broadcastChange();
    return this.getSnapshot();
  }

  async applySettings(settings: SeekStarSettings): Promise<TabRuntimeSnapshot> {
    await this.ensureLoaded();
    const now = new Date().toISOString();

    for (const [tabId, entry] of this.entriesByTabId.entries()) {
      const cachePolicy: TabCachePolicy = {
        max_bytes: settings.tab_cache_max_bytes,
        inactive_grace_ms: settings.inactive_grace_ms,
        eviction: "lru_lfu",
      };

      entry.record = {
        ...entry.record,
        cache_policy: cachePolicy,
        cache_bytes: this.cache.enforcePolicy(tabId, cachePolicy),
        updated_at: now,
      };
    }

    await this.save();
    this.broadcastChange();
    return this.getSnapshot();
  }

  async resetDevelopmentState(): Promise<TabRuntimeSnapshot> {
    await this.ensureLoaded();

    for (const [tabId, entry] of this.entriesByTabId.entries()) {
      entry.record.window_state = "hidden";
      this.closeDetachedWindow(tabId);
      this.removeViewFromOwner(entry);
      this.closeEntryWebContents(entry);
    }

    const snapshot = createDefaultSnapshot();
    this.cache.clear();
    this.entriesByTabId.clear();
    this.foldersById.clear();
    this.workspaceName = snapshot.workspace_name;
    this.activeTabId = snapshot.active_tab_id;

    for (const tab of snapshot.tabs) {
      this.entriesByTabId.set(tab.id, { record: tab });
    }

    await this.save();
    this.broadcastChange();
    return this.getSnapshot();
  }

  async detachTab(tabId: string): Promise<TabRuntimeSnapshot> {
    await this.ensureLoaded();
    const entry = this.entriesByTabId.get(tabId);

    if (!entry) {
      return this.getSnapshot();
    }

    const existing = Array.from(this.detachedWindowsById.entries()).find(([, candidate]) => candidate.tabId === tabId);
    if (existing) {
      const [existingWindowId, existingEntry] = existing;

      if (!isWindowDestroyed(existingEntry.window)) {
        try {
          existingEntry.window.focus();
          return this.getSnapshot();
        } catch {
          this.detachedWindowsById.delete(existingWindowId);
        }
      } else {
        this.detachedWindowsById.delete(existingWindowId);
      }
    }

    const window = createRuntimeWindow(entry.record.title);
    const detachedWindowId = window.id;
    const view = this.ensureTabView(tabId, "detached");
    let showFallback: NodeJS.Timeout | undefined;
    let detachedWindowShown = false;
    const showDetachedWindow = (): void => {
      if (detachedWindowShown || isWindowDestroyed(window)) {
        return;
      }

      detachedWindowShown = true;
      if (showFallback) {
        clearTimeout(showFallback);
        showFallback = undefined;
      }
      window.show();
    };
    const handleResize = (): void => {
      if (isWindowDestroyed(window) || view.webContents.isDestroyed()) {
        return;
      }

      try {
        view.setBounds(getWindowViewBounds(window));
      } catch (error) {
        logRuntimeWarning(`Failed to resize detached tab view for ${tabId}.`, error);
      }
    };

    this.removeViewFromOwner(entry);
    entry.owner = window;
    entry.record = {
      ...entry.record,
      window_state: "detached",
      updated_at: new Date().toISOString(),
    };
    window.contentView.addChildView(view);
    handleResize();
    window.on("resize", handleResize);
    window.on("closed", () => {
      if (showFallback) {
        clearTimeout(showFallback);
        showFallback = undefined;
      }
      try {
        window.off("resize", handleResize);
      } catch {
        // The native window may already have completed teardown.
      }
      this.detachedWindowsById.delete(detachedWindowId);
      const current = this.entriesByTabId.get(tabId);
      if (current?.record.window_state === "detached") {
        current.owner = undefined;
        current.view = undefined;
        current.viewSurface = undefined;
        if (this.entriesByTabId.size <= 1) {
          current.record = {
            ...current.record,
            window_state: "main",
            runtime_status: "active",
            updated_at: new Date().toISOString(),
          };
          this.activeTabId = tabId;
          void this.save().catch((error) => logRuntimeWarning("Failed to save last-tab detached close recovery.", error));
          this.broadcastChange();
          this.focusMainWindow();
          return;
        }

        current.record.window_state = "hidden";
        void this.closeTab(tabId);
      }
    });
    this.detachedWindowsById.set(detachedWindowId, { window, tabId });
    view.webContents.once("did-finish-load", showDetachedWindow);
    view.webContents.once("did-fail-load", showDetachedWindow);
    if (view.webContents.isLoadingMainFrame()) {
      showFallback = setTimeout(showDetachedWindow, 1500);
    } else {
      showDetachedWindow();
    }

    await this.save();
    this.broadcastChange();
    return this.getSnapshot();
  }

  async attachTab(tabId: string): Promise<TabRuntimeSnapshot> {
    await this.ensureLoaded();
    const entry = this.entriesByTabId.get(tabId);

    if (!entry) {
      return this.getSnapshot();
    }

    entry.record.window_state = "main";
    entry.record.updated_at = new Date().toISOString();
    this.closeDetachedWindow(tabId, true);
    entry.owner = undefined;
    this.activeTabId = tabId;
    this.markActive(tabId);
    this.focusMainWindow();
    this.dockActiveTabView();
    await this.save();
    this.broadcastChange();
    return this.getSnapshot();
  }

  async setDockBounds(bounds: Rectangle | undefined): Promise<TabRuntimeSnapshot> {
    await this.ensureLoaded();

    if (!bounds || bounds.width <= 0 || bounds.height <= 0) {
      this.dockBounds = undefined;
      this.removeMainDockedViews();
      return this.getSnapshot();
    }

    this.dockBounds = bounds;
    this.dockActiveTabView();
    return this.getSnapshot();
  }

  focusMainWindow(): void {
    if (!this.mainWindow || isWindowDestroyed(this.mainWindow)) {
      return;
    }

    try {
      if (this.mainWindow.isMinimized()) {
        this.mainWindow.restore();
      }

      this.mainWindow.show();
      this.mainWindow.focus();
    } catch {
      this.mainWindow = undefined;
    }
  }

  private ensureTabView(tabId: string, surface: TabViewSurface = "docked"): WebContentsView {
    const entry = this.entriesByTabId.get(tabId);

    if (!entry) {
      throw new Error(`Unknown tab runtime: ${tabId}`);
    }

    if (entry.view && !entry.view.webContents.isDestroyed()) {
      if (entry.viewSurface !== surface) {
        entry.viewSurface = surface;
        void entry.view.webContents.loadURL(this.buildTabUrl(tabId, surface)).catch((error) =>
          logRuntimeWarning(`Failed to switch tab renderer surface for ${tabId}.`, error),
        );
      }
      return entry.view;
    }

    const view = new WebContentsView({
      webPreferences: {
        preload: join(__dirname, "../preload/index.cjs"),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        partition: entry.record.session_partition,
      },
    });
    view.setBackgroundColor("#00000000");

    view.webContents.setWindowOpenHandler(({ url }) => {
      void shell.openExternal(url);
      return { action: "deny" };
    });
    view.webContents.on("will-navigate", (event, url) => {
      const crashAction = parseCrashActionUrl(url, tabId);

      if (!crashAction) {
        return;
      }

      event.preventDefault();
      if (crashAction === "reload") {
        void this.refreshTab(tabId);
        return;
      }

      void this.closeTab(tabId);
    });
    view.webContents.on("render-process-gone", (_event, details) => {
      this.recordCrash(tabId, {
        tab_id: tabId,
        reason: details.reason,
        exit_code: details.exitCode,
        last_event: "render-process-gone",
        occurred_at: new Date().toISOString(),
        details: JSON.stringify(details),
      });
    });
    view.webContents.on("unresponsive", () => {
      this.recordStatus(tabId, "suspended", "unresponsive");
    });
    view.webContents.on("responsive", () => {
      this.recordStatus(tabId, tabId === this.activeTabId ? "active" : "inactive", "responsive");
    });

    const targetUrl = this.buildTabUrl(tabId, surface);
    void view.webContents.loadURL(targetUrl).catch((error) => logRuntimeWarning(`Failed to load tab renderer for ${tabId}.`, error));
    entry.view = view;
    entry.viewSurface = surface;
    return view;
  }

  private buildTabUrl(tabId: string, surface: TabViewSurface): string {
    const rendererUrl = this.rendererUrl ?? process.env.ELECTRON_RENDERER_URL;

    if (rendererUrl) {
      const url = new URL(rendererUrl);
      url.searchParams.set("runtimeTabId", tabId);
      url.searchParams.set("runtimeSurface", surface);
      return url.toString();
    }

    return `file://${join(__dirname, "../renderer/index.html")}?runtimeTabId=${encodeURIComponent(tabId)}&runtimeSurface=${surface}`;
  }

  private dockActiveTabView(): void {
    if (!this.mainWindow || !this.dockBounds || isWindowDestroyed(this.mainWindow)) {
      return;
    }

    const entry = this.entriesByTabId.get(this.activeTabId);

    if (!entry || entry.record.window_state === "detached") {
      return;
    }

    const view = this.ensureTabView(this.activeTabId, "docked");
    this.removeMainDockedViews(this.activeTabId);

    if (entry.owner !== this.mainWindow) {
      this.removeViewFromOwner(entry);
      this.mainWindow.contentView.addChildView(view);
      entry.owner = this.mainWindow;
    }

    view.setBounds(this.dockBounds);
    entry.record = {
      ...entry.record,
      window_state: "main",
      runtime_status: entry.record.runtime_status === "crashed" ? "crashed" : "active",
      updated_at: new Date().toISOString(),
    };
  }

  private recordCrash(tabId: string, report: TabCrashReport): void {
    const entry = this.entriesByTabId.get(tabId);

    if (!entry) {
      return;
    }

    entry.record = {
      ...entry.record,
      runtime_status: "crashed",
      crash_report: report,
      updated_at: report.occurred_at,
    };

    entry.view?.webContents.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(renderCrashHtml(report))}`).catch(() => undefined);
    void this.save().catch((error) => logRuntimeWarning(`Failed to save crash report for ${tabId}.`, error));
    this.broadcastChange();
  }

  private recordStatus(tabId: string, status: TabRuntimeStatus, lastEvent?: string): void {
    const entry = this.entriesByTabId.get(tabId);

    if (!entry) {
      return;
    }

    entry.record = {
      ...entry.record,
      runtime_status: status,
      updated_at: new Date().toISOString(),
      crash_report: entry.record.crash_report
        ? {
            ...entry.record.crash_report,
            last_event: lastEvent ?? entry.record.crash_report.last_event,
          }
        : undefined,
    };
    void this.save().catch((error) => logRuntimeWarning(`Failed to save runtime status for ${tabId}.`, error));
    this.broadcastChange();
  }

  private markActive(tabId: string): void {
    const now = new Date().toISOString();

    for (const [id, entry] of this.entriesByTabId.entries()) {
      entry.record = {
        ...entry.record,
        runtime_status: entry.record.runtime_status === "crashed" ? "crashed" : id === tabId ? "active" : "inactive",
        last_accessed_at: id === tabId ? now : entry.record.last_accessed_at,
        updated_at: id === tabId ? now : entry.record.updated_at,
      };
    }

    this.ensureTabView(tabId, this.entriesByTabId.get(tabId)?.record.window_state === "detached" ? "detached" : "docked");
    this.cache.touch(tabId, "scene-read-model", 128 * 1024, this.entriesByTabId.get(tabId)?.record.cache_policy ?? defaultCachePolicy());
    void this.updateCacheUsage().catch((error) => logRuntimeWarning("Failed to update tab cache usage.", error));
  }

  private removeMainDockedViews(exceptTabId?: string): void {
    for (const [tabId, entry] of this.entriesByTabId.entries()) {
      if (tabId === exceptTabId || entry.owner !== this.mainWindow || !entry.view) {
        continue;
      }

      this.removeViewFromOwner(entry);
    }
  }

  private async updateCacheUsage(): Promise<void> {
    for (const [tabId, entry] of this.entriesByTabId.entries()) {
      entry.record.cache_bytes = this.cache.getUsage(tabId);
    }

    await this.save();
  }

  private closeDetachedWindow(tabId: string, closeWindow = true): void {
    for (const [windowId, entry] of this.detachedWindowsById.entries()) {
      if (entry.tabId !== tabId) {
        continue;
      }

      const runtimeEntry = this.entriesByTabId.get(tabId);
      if (runtimeEntry?.view && runtimeEntry.owner === entry.window) {
        safeRemoveChildView(entry.window, runtimeEntry.view);
      }
      this.detachedWindowsById.delete(windowId);
      if (closeWindow && !isWindowDestroyed(entry.window)) {
        try {
          entry.window.close();
        } catch {
          // The OS may already be tearing the detached window down.
        }
      }
    }
  }

  private removeViewFromOwner(entry: RuntimeEntry): void {
    if (!entry.owner || !entry.view) {
      return;
    }

    safeRemoveChildView(entry.owner, entry.view);
    entry.owner = undefined;
  }

  private closeEntryWebContents(entry: RuntimeEntry): void {
    if (!entry.view) {
      return;
    }

    try {
      if (!entry.view.webContents.isDestroyed()) {
        entry.view.webContents.close();
      }
    } catch {
      // Closing a detached window can destroy its view before the runtime record is updated.
    }

    entry.view = undefined;
    entry.viewSurface = undefined;
  }

  private normalizeOrder(): void {
    this.getOrderedRecords().forEach((record, order) => {
      const entry = this.entriesByTabId.get(record.id);
      if (entry) {
        entry.record.order = order;
      }
    });
  }

  private normalizeFolderOrder(): void {
    this.getOrderedFolders().forEach((folder, order) => {
      this.foldersById.set(folder.id, {
        ...folder,
        order,
        updated_at: new Date().toISOString(),
      });
    });
  }

  private getOrderedRecords(): TabRecord[] {
    return Array.from(this.entriesByTabId.values())
      .map((entry) => entry.record)
      .sort((a, b) => Number(b.pinned) - Number(a.pinned) || a.order - b.order || a.created_at.localeCompare(b.created_at));
  }

  private getOrderedFolders(): WorkspaceFolder[] {
    return Array.from(this.foldersById.values()).sort((a, b) => a.order - b.order || a.created_at.localeCompare(b.created_at));
  }

  private async ensureLoaded(): Promise<void> {
    if (this.entriesByTabId.size === 0) {
      await this.load();
    }
  }

  private async loadSnapshot(): Promise<TabRuntimeSnapshot> {
    const runtimePath = getRuntimePath();

    try {
      const content = await readFile(runtimePath, "utf8");

      try {
        return normalizeSnapshot(JSON.parse(content));
      } catch (error) {
        if (isJsonParseError(error)) {
          await quarantineCorruptJson(runtimePath, error);
          return createDefaultSnapshot();
        }

        throw error;
      }
    } catch (error) {
      if (isMissingFileError(error)) {
        return createDefaultSnapshot();
      }

      throw error;
    }
  }

  private save(): Promise<void> {
    const nextSave = this.saveChain.catch(() => undefined).then(() => this.writeSnapshot());
    this.saveChain = nextSave;
    return nextSave;
  }

  private async writeSnapshot(): Promise<void> {
    const snapshot: TabRuntimeSnapshot = {
      version: 1,
      schema_revision: TAB_RUNTIME_SCHEMA_REVISION,
      workspace_name: this.workspaceName,
      active_tab_id: this.activeTabId,
      tabs: this.getOrderedRecords(),
      folders: this.getOrderedFolders(),
      updated_at: new Date().toISOString(),
    };
    const storePath = getRuntimePath();
    const tmpPath = createTempJsonPath(storePath);

    await mkdir(dirname(storePath), { recursive: true });
    await writeFile(tmpPath, JSON.stringify(snapshot, null, 2), "utf8");
    await replaceFile(tmpPath, storePath);
  }

  private broadcastChange(): void {
    const snapshot = {
      version: 1,
      schema_revision: TAB_RUNTIME_SCHEMA_REVISION,
      workspace_name: this.workspaceName,
      active_tab_id: this.activeTabId,
      tabs: this.getOrderedRecords(),
      folders: this.getOrderedFolders(),
      updated_at: new Date().toISOString(),
    } satisfies TabRuntimeSnapshot;

    for (const contents of webContents.getAllWebContents()) {
      contents.send("tabs:changed", snapshot);
    }
  }

  private registerHandler(channel: string, handler: (event: IpcMainInvokeEvent, ...args: unknown[]) => unknown): void {
    ipcMain.removeHandler(channel);
    ipcMain.handle(channel, handler);
  }
}

function createRuntimeWindow(title: string): BaseWindow {
  const window = new BaseWindow({
    width: 1180,
    height: 760,
    minWidth: 980,
    minHeight: 620,
    title,
    backgroundColor: "#00000000",
    show: false,
    roundedCorners: true,
    titleBarStyle: "hidden",
    ...(process.platform !== "darwin"
      ? {
          titleBarOverlay: {
            color: "#00000000",
            symbolColor: "#9aa5b5",
            height: 36,
          },
        }
      : {}),
    ...(process.platform === "win32" ? { backgroundMaterial: "acrylic" as const } : {}),
  });
  if (process.platform === "win32") {
    window.setBackgroundColor("#00000000");
    window.setBackgroundMaterial("acrylic");
  }

  return window;
}

function safeRemoveChildView(window: BaseWindow, view: WebContentsView): void {
  if (isWindowDestroyed(window)) {
    return;
  }

  try {
    window.contentView.removeChildView(view);
  } catch {
    // The view may already have been removed by native window teardown.
  }
}

function isWindowDestroyed(window: BaseWindow): boolean {
  try {
    return window.isDestroyed();
  } catch {
    return true;
  }
}

function getWindowViewBounds(window: BaseWindow): Rectangle {
  const [width, height] = window.getContentSize();
  return { x: 0, y: 0, width, height };
}

function createDefaultSnapshot(): TabRuntimeSnapshot {
  const now = new Date().toISOString();
  const record = createTabRecord({
    id: DEFAULT_TAB_ID,
    order: 0,
    seed: DEFAULT_TAB_TITLE,
    title: DEFAULT_TAB_TITLE,
    timestamp: now,
    maxBytes: defaultSettings.tab_cache_max_bytes,
    inactiveGraceMs: defaultSettings.inactive_grace_ms,
  });

  return {
    version: 1,
    schema_revision: TAB_RUNTIME_SCHEMA_REVISION,
    workspace_name: DEFAULT_WORKSPACE_NAME,
    active_tab_id: DEFAULT_TAB_ID,
    tabs: [record],
    folders: [],
    updated_at: now,
  };
}

function createTabRecord(input: {
  id: string;
  order: number;
  seed: string;
  title: string;
  timestamp: string;
  maxBytes: number;
  inactiveGraceMs: number;
}): TabRecord {
  return {
    id: input.id,
    title: input.title,
    seed: input.seed,
    order: input.order,
    pinned: false,
    favorite: false,
    window_state: "main",
    runtime_status: "inactive",
    session_partition: `persist:seekstar-tab-${input.id}`,
    cache_policy: {
      max_bytes: input.maxBytes,
      inactive_grace_ms: input.inactiveGraceMs,
      eviction: "lru_lfu",
    },
    cache_bytes: 0,
    last_accessed_at: input.timestamp,
    created_at: input.timestamp,
    updated_at: input.timestamp,
  };
}

function normalizeSnapshot(value: unknown): TabRuntimeSnapshot {
  if (typeof value !== "object" || value === null) {
    return createDefaultSnapshot();
  }

  const candidate = value as Partial<TabRuntimeSnapshot>;
  if (candidate.version !== 1 || candidate.schema_revision !== TAB_RUNTIME_SCHEMA_REVISION) {
    return createDefaultSnapshot();
  }
  const tabs = Array.isArray(candidate.tabs) && candidate.tabs.length > 0 ? candidate.tabs.map(normalizeTabRecord) : createDefaultSnapshot().tabs;
  const folders = Array.isArray(candidate.folders) ? candidate.folders.map(normalizeFolderRecord).filter((folder): folder is WorkspaceFolder => Boolean(folder)) : [];
  const folderIds = new Set(folders.map((folder) => folder.id));
  const normalizedTabs = tabs.map((tab) => ({
    ...tab,
    folder_id: tab.folder_id && folderIds.has(tab.folder_id) ? tab.folder_id : undefined,
  }));
  const activeTabId = typeof candidate.active_tab_id === "string" && tabs.some((tab) => tab.id === candidate.active_tab_id)
    ? candidate.active_tab_id
    : normalizedTabs[0].id;

  return {
    version: 1,
    schema_revision: TAB_RUNTIME_SCHEMA_REVISION,
    workspace_name: typeof candidate.workspace_name === "string" && candidate.workspace_name.trim() ? candidate.workspace_name.trim() : DEFAULT_WORKSPACE_NAME,
    active_tab_id: activeTabId,
    tabs: normalizedTabs,
    folders,
    updated_at: typeof candidate.updated_at === "string" ? candidate.updated_at : new Date().toISOString(),
  };
}

function normalizeFolderRecord(value: unknown, order: number): WorkspaceFolder | undefined {
  const candidate = typeof value === "object" && value !== null ? (value as Partial<WorkspaceFolder>) : {};
  const title = typeof candidate.title === "string" && candidate.title.trim() ? candidate.title.trim() : "";

  if (!title) {
    return undefined;
  }

  const id = typeof candidate.id === "string" && candidate.id.trim() ? candidate.id.trim() : `folder-${toSlug(title)}-${Date.now()}-${order}`;
  const timestamp = typeof candidate.created_at === "string" ? candidate.created_at : new Date().toISOString();

  return {
    id,
    title,
    parent_id: typeof candidate.parent_id === "string" ? candidate.parent_id : undefined,
    order: typeof candidate.order === "number" ? candidate.order : order,
    created_at: timestamp,
    updated_at: typeof candidate.updated_at === "string" ? candidate.updated_at : timestamp,
  };
}

function normalizeTabRecord(value: unknown, order: number): TabRecord {
  const candidate = typeof value === "object" && value !== null ? (value as Partial<TabRecord>) : {};
  const id = typeof candidate.id === "string" && candidate.id.trim() ? candidate.id : `tab-runtime-${Date.now()}-${order}`;
  const timestamp = typeof candidate.created_at === "string" ? candidate.created_at : new Date().toISOString();

  return {
    id,
    title: typeof candidate.title === "string" && candidate.title.trim() ? candidate.title : "Untitled exploration",
    seed: typeof candidate.seed === "string" && candidate.seed.trim() ? candidate.seed : "Untitled exploration",
    order: typeof candidate.order === "number" ? candidate.order : order,
    pinned: Boolean(candidate.pinned),
    favorite: Boolean(candidate.favorite),
    folder_id: typeof candidate.folder_id === "string" ? candidate.folder_id : undefined,
    workspace_id: typeof candidate.workspace_id === "string" ? candidate.workspace_id : undefined,
    window_state: candidate.window_state === "detached" ? "detached" : candidate.window_state === "hidden" ? "hidden" : "main",
    runtime_status: candidate.runtime_status === "crashed" ? "crashed" : "inactive",
    session_partition: typeof candidate.session_partition === "string" ? candidate.session_partition : `persist:seekstar-tab-${id}`,
    cache_policy: candidate.cache_policy ?? defaultCachePolicy(),
    cache_bytes: typeof candidate.cache_bytes === "number" ? candidate.cache_bytes : 0,
    last_accessed_at: typeof candidate.last_accessed_at === "string" ? candidate.last_accessed_at : timestamp,
    crash_report: candidate.crash_report,
    created_at: timestamp,
    updated_at: typeof candidate.updated_at === "string" ? candidate.updated_at : timestamp,
  };
}

function defaultCachePolicy(): TabCachePolicy {
  return {
    max_bytes: defaultSettings.tab_cache_max_bytes,
    inactive_grace_ms: defaultSettings.inactive_grace_ms,
    eviction: "lru_lfu",
  };
}

function parseTabCreateInput(value: unknown): { tabId?: string; title: string; seed: string; activate: boolean } {
  const candidate = typeof value === "object" && value !== null ? (value as { activate?: unknown; tabId?: unknown; title?: unknown; seed?: unknown }) : {};
  const title = typeof candidate.title === "string" && candidate.title.trim() ? candidate.title.trim() : "Untitled exploration";
  const seed = typeof candidate.seed === "string" && candidate.seed.trim() ? candidate.seed.trim() : title;

  return {
    activate: candidate.activate !== false,
    tabId: typeof candidate.tabId === "string" && candidate.tabId.trim() ? candidate.tabId.trim() : undefined,
    title,
    seed,
  };
}

function parseTabReorderInput(value: unknown): { sourceTabId: string; targetTabId: string } {
  const candidate = typeof value === "object" && value !== null ? (value as { sourceTabId?: unknown; targetTabId?: unknown }) : {};
  return {
    sourceTabId: parseTabId(candidate.sourceTabId),
    targetTabId: parseTabId(candidate.targetTabId),
  };
}

function parseFolderCreateInput(value: unknown): { title: string } {
  const candidate = typeof value === "object" && value !== null ? (value as { title?: unknown }) : {};
  const title = typeof candidate.title === "string" && candidate.title.trim() ? candidate.title.trim() : "New folder";

  return { title };
}

function parseFolderAssignInput(value: unknown): { tabId: string; folderId?: string } {
  const candidate = typeof value === "object" && value !== null ? (value as { tabId?: unknown; folderId?: unknown }) : {};

  return {
    tabId: parseTabId(candidate.tabId),
    folderId: parseOptionalFolderId(candidate.folderId),
  };
}

function parseOptionalFolderId(value: unknown): string | undefined {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  if (typeof value !== "string" || !value.trim()) {
    throw new Error("Folder id must be a string.");
  }

  return value.trim();
}

function parseWorkspaceName(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) {
    return DEFAULT_WORKSPACE_NAME;
  }

  return value.trim().slice(0, 80);
}

function parseDockBounds(value: unknown): Rectangle | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (typeof value !== "object") {
    throw new Error("Dock bounds must be an object.");
  }

  const candidate = value as Partial<Rectangle>;
  const x = Math.round(typeof candidate.x === "number" && Number.isFinite(candidate.x) ? candidate.x : 0);
  const y = Math.round(typeof candidate.y === "number" && Number.isFinite(candidate.y) ? candidate.y : 0);
  const width = Math.round(typeof candidate.width === "number" && Number.isFinite(candidate.width) ? candidate.width : 0);
  const height = Math.round(typeof candidate.height === "number" && Number.isFinite(candidate.height) ? candidate.height : 0);

  if (width <= 0 || height <= 0) {
    return undefined;
  }

  return { x, y, width, height };
}

function parseTabId(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error("Tab id is required.");
  }

  return value.trim();
}

function getRuntimePath(): string {
  return join(app.getPath("userData"), TAB_RUNTIME_FILE_NAME);
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
    console.warn(`[SeekStar] Ignored corrupt tab runtime JSON and moved it to ${quarantinePath}: ${getErrorMessage(error)}`);
  } catch (renameError) {
    console.warn(`[SeekStar] Failed to quarantine corrupt tab runtime JSON at ${path}: ${getErrorMessage(renameError)}`);
  }
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function logRuntimeWarning(message: string, error: unknown): void {
  console.warn(`[SeekStar] ${message} ${getErrorMessage(error)}`);
}

function toSlug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "exploration";
}

function renderCrashHtml(report: TabCrashReport): string {
  const escaped = escapeHtml(formatCrashReport(report));
  const encodedTabId = encodeURIComponent(report.tab_id);

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #0b0d12; color: #f2f4f8; font: 13px ui-monospace, SFMono-Regular, Consolas, monospace; }
    main { width: min(760px, calc(100vw - 48px)); border: 1px solid rgb(255 255 255 / 12%); border-radius: 8px; padding: 20px; background: rgb(18 20 26 / 92%); }
    h1 { margin: 0 0 10px; font: 600 18px Inter, system-ui, sans-serif; }
    pre { overflow: auto; padding: 12px; border-radius: 6px; background: rgb(0 0 0 / 36%); white-space: pre-wrap; }
    button { margin-right: 8px; border: 1px solid rgb(255 255 255 / 16%); border-radius: 6px; padding: 8px 10px; color: inherit; background: rgb(255 255 255 / 7%); }
  </style>
</head>
<body>
  <main>
    <h1>This SeekStar tab crashed</h1>
    <pre id="log">${escaped}</pre>
    <button onclick="navigator.clipboard.writeText(document.getElementById('log').innerText)">Copy log</button>
    <button onclick="location.href='seekstar-crash://reload/${encodedTabId}'">Reload</button>
    <button onclick="location.href='seekstar-crash://close/${encodedTabId}'">Close</button>
  </main>
</body>
</html>`;
}

function parseCrashActionUrl(urlString: string, tabId: string): "reload" | "close" | undefined {
  try {
    const url = new URL(urlString);

    if (url.protocol !== "seekstar-crash:") {
      return undefined;
    }

    const action = url.hostname;
    const actionTabId = decodeURIComponent(url.pathname.replace(/^\/+/, ""));

    if (actionTabId !== tabId) {
      return undefined;
    }

    return action === "reload" || action === "close" ? action : undefined;
  } catch {
    return undefined;
  }
}

function formatCrashReport(report: TabCrashReport): string {
  return [
    `tab_id: ${report.tab_id}`,
    `reason: ${report.reason}`,
    `exit_code: ${report.exit_code ?? "unknown"}`,
    `last_event: ${report.last_event ?? "unknown"}`,
    `occurred_at: ${report.occurred_at}`,
    report.details ? `details: ${report.details}` : undefined,
  ]
    .filter(Boolean)
    .join("\n");
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
