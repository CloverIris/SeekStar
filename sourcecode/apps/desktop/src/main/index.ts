import { app, BaseWindow, WebContentsView, shell, webContents } from "electron";
import { readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { defaultSettings } from "../shared/settings";
import { registerAiAssistantBridge } from "./aiAssistantBridge";
import { registerScoutAdapter } from "./scoutAdapter";
import { TabRuntimeManager } from "./tabRuntimeManager";
import { TileSurfaceManager } from "./tileSurfaceManager";
import { registerWindowBridge } from "./windowBridge";
import { createDeterministicExplorationDependencies, ExplorationRuntime } from "./explorationRuntime";
import { deleteLegacyExplorationData, registerAppDataBridge } from "./appDataBridge";
import { SettingsService, settingsService, type SettingsSecretStore } from "./settingsService";

if (process.env.SEEKSTAR_E2E === "1") {
  app.commandLine.appendSwitch("in-process-gpu");
}

if (process.env.SEEKSTAR_E2E_USER_DATA) {
  app.setPath("userData", process.env.SEEKSTAR_E2E_USER_DATA);
}

const tabRuntimeManager = new TabRuntimeManager();
const explorationRuntime = new ExplorationRuntime(
  tabRuntimeManager,
  process.env.SEEKSTAR_E2E_FAKE_WORLD === "1" ? createDeterministicExplorationDependencies() : undefined,
);
tabRuntimeManager.setTabClosedHandler((tabId) => explorationRuntime.deleteTab(tabId));
const tileSurfaceManager = new TileSurfaceManager((tabId) => tabRuntimeManager.getTabSurfaceHost(tabId));
const hasSingleInstanceLock = process.env.SEEKSTAR_E2E === "1" || app.requestSingleInstanceLock();

if (!hasSingleInstanceLock) {
  app.quit();
}

registerWindowBridge();
registerScoutAdapter();
registerAiAssistantBridge();
explorationRuntime.registerIpc();
registerAppDataBridge(explorationRuntime);
settingsService.subscribe("Tab 缓存", async (settings) => { await tabRuntimeManager.applySettings(settings); });
settingsService.subscribe("页面表面", (settings) => tileSurfaceManager.applySettings(settings));
settingsService.registerIpc();
tabRuntimeManager.registerIpc();
tileSurfaceManager.registerIpc();

function createMainWindow(): BaseWindow {
  const window = new BaseWindow({
    width: 1600,
    height: 900,
    minWidth: 1280,
    minHeight: 720,
    title: "SeekStar",
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
  const shellView = new WebContentsView({
    webPreferences: {
      preload: join(__dirname, "../preload/index.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  shellView.setBackgroundColor("#00000000");

  window.contentView.addChildView(shellView);
  shellView.setBounds(getWindowContentBounds(window));
  window.on("resize", () => {
    shellView.setBounds(getWindowContentBounds(window));
  });
  window.on("closed", () => {
    tileSurfaceManager.clearAll();
    closeWebContentsIfAlive(shellView);
  });

  shellView.webContents.once("did-finish-load", () => {
    if (!app.isPackaged) {
      shellView.webContents.openDevTools({ mode: "detach" });
    }
    window.show();
  });

  shellView.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: "deny" };
  });

  if (process.env.ELECTRON_RENDERER_URL) {
    tabRuntimeManager.setRendererUrl(process.env.ELECTRON_RENDERER_URL);
    void shellView.webContents.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    void shellView.webContents.loadFile(join(__dirname, "../renderer/index.html"));
  }

  return window;
}

function getWindowContentBounds(window: BaseWindow): Electron.Rectangle {
  const [width, height] = window.getContentSize();
  return { x: 0, y: 0, width, height };
}

function closeWebContentsIfAlive(view: WebContentsView): void {
  try {
    if (!view.webContents.isDestroyed()) {
      view.webContents.close();
    }
  } catch {
    // BaseWindow owns the view during shutdown; destroyed views are already gone.
  }
}

if (hasSingleInstanceLock) {
  app.on("second-instance", () => {
    tabRuntimeManager.focusMainWindow();
  });

  app.on("before-quit", () => {
    tileSurfaceManager.clearAll();
    void explorationRuntime.flush();
  });

  app.whenReady().then(async () => {
    const settings = await settingsService.load().catch(() => defaultSettings);

    tileSurfaceManager.applySettings(settings);
    await deleteLegacyExplorationData();
    await tabRuntimeManager.load();
    tabRuntimeManager.setMainWindow(createMainWindow());
    if (process.env.SEEKSTAR_E2E_SETTINGS_RESTART_VERIFY === "1") {
      void runSettingsOnlyRestartSelfTest();
    } else if (process.env.SEEKSTAR_E2E_SETTINGS_ONLY === "1") {
      void runSettingsOnlySelfTest();
    } else if (process.env.SEEKSTAR_E2E_RESTART_VERIFY === "1") {
      void runSettingsRestartSelfTest();
    } else if (process.env.SEEKSTAR_E2E_SELF_TEST === "1") {
      void runElectronLifecycleSelfTest();
    }

    app.on("activate", () => {
      if (BaseWindow.getAllWindows().length === 0) {
        tabRuntimeManager.setMainWindow(createMainWindow());
      }
    });
  });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
      app.quit();
    }
  });
}

async function runElectronLifecycleSelfTest(): Promise<void> {
  try {
    const snapshot = await tabRuntimeManager.getSnapshot();
    const tabId = snapshot.active_tab_id;
    const shellContents = await waitForContents((url) => !url.includes("runtimeTabId="));
    let surface = await waitForContents((url) => url.includes(`runtimeTabId=${encodeURIComponent(tabId)}`) && url.includes("runtimeSurface=docked"));
    const layerBefore = await readSurfaceLayer(surface.id);
    await withSelfTestTimeout(shellContents.executeJavaScript(`window.seekstar.tabs.detach(${JSON.stringify(tabId)})`, true), "detach IPC");
    surface = await waitForContents((url) => url.includes(`runtimeTabId=${encodeURIComponent(tabId)}`) && url.includes("runtimeSurface=detached"));
    const detachedLayer = await readSurfaceLayer(surface.id);
    if (detachedLayer !== layerBefore) throw new Error(`Detached view changed layer from ${layerBefore} to ${detachedLayer}.`);
    if (countTabSurfaces(tabId) !== 1) throw new Error("Detach left more than one active tab surface.");
    await withSelfTestTimeout(surface.executeJavaScript(`window.seekstar.tabs.attach(${JSON.stringify(tabId)})`, true), "attach IPC");
    surface = await waitForContents((url) => url.includes(`runtimeTabId=${encodeURIComponent(tabId)}`) && url.includes("runtimeSurface=docked"));
    const attachedLayer = await readSurfaceLayer(surface.id);
    if (attachedLayer !== layerBefore) throw new Error(`Attached view changed layer from ${layerBefore} to ${attachedLayer}.`);
    if (countTabSurfaces(tabId) !== 1) throw new Error("Attach left more than one active tab surface.");
    await waitForWorldCondition(tabId, (world) => Object.values(world.segments_by_key).filter((segment) => segment.phase === "ready").length === 9 && Object.keys(world.sources).length > 0);
    const world = explorationRuntime.getWorldSnapshot(tabId);
    if (!world) throw new Error("Deterministic world was not available after generation.");
    const l3Nodes = Object.values(world.segments_by_key).flatMap((segment) => segment.nodes).filter((node) => node.layer === "L3");
    if (l3Nodes.length === 0 || l3Nodes.some((node) => node.source_state !== "source_backed")) throw new Error("L3 contains a non-observed source tile or no source tile.");
    for (const expectedLayer of ["L1", "L2", "L3"]) {
      await zoomSurfaceIn(surface, expectedLayer);
    }
    const checkpoint = await explorationRuntime.getViewCheckpoint(tabId);
    if (checkpoint?.view.camera.layer !== "L3") throw new Error("L0-L3 view checkpoint was not persisted.");
    if (Math.abs(checkpoint.view.camera.x) > 1 || Math.abs(checkpoint.view.camera.y) > 1) throw new Error("Semantic layer transitions changed the camera XY position.");
    const settingsTests = await runSettingsSurfaceSelfTest(shellContents);
    console.log(`[SeekStarE2E]${JSON.stringify({ status: "ok", tab_id: tabId, layer: "L3", tests: ["shell-no-world-surface", "single-surface", "detach-handoff", "attach-ipc-ack", "attach-handoff", "center-first-world", "nine-segment-working-set", "source-backed-l3", "continuous-l0-l3", ...settingsTests] })}`);
    app.exit(0);
  } catch (error) {
    console.error(`[SeekStarE2E]${JSON.stringify({ status: "error", reason: error instanceof Error ? error.message : String(error) })}`);
    app.exit(1);
  }
}

async function runSettingsSurfaceSelfTest(shellContents: Electron.WebContents): Promise<string[]> {
  const contractTests = await runSettingsServiceContractSelfTest();
  const settings = await settingsService.load();
  const providerId = "e2e-openai-compatible";
  const testSecret = "seekstar-e2e-secret-must-be-encrypted";
  const provider = {
    ...settings.ai_providers[0],
    id: providerId,
    label: "E2E Provider",
    enabled: true,
    base_url: "https://example.invalid/v1",
    model: "e2e-model",
    api_key_configured: false,
    api_key_source: "none",
    api_key_env_var: undefined,
  };
  const request = {
    settings: { ...settings, active_ai_provider_id: providerId, ai_providers: [...settings.ai_providers, provider] },
    secret_changes: [...settings.ai_providers.map((item) => ({ provider_id: item.id, action: "preserve" })), { provider_id: providerId, action: "replace", value: testSecret }],
  };
  const result = await withSelfTestTimeout(shellContents.executeJavaScript(`window.seekstar.settings.save(${JSON.stringify(request)})`, true), "settings save IPC");
  const savedProvider = result?.settings?.ai_providers?.find((item: { id?: string }) => item.id === providerId);
  if (!savedProvider?.api_key_configured || savedProvider.api_key_source !== "encrypted") throw new Error("Saved provider did not report an encrypted key.");
  const persisted = await readFile(settingsService.getPath(), "utf8");
  if (persisted.includes(testSecret) || persisted.includes("api_key_value")) throw new Error("Settings file contains a plaintext API key.");
  if (!persisted.includes("encrypted_api_key")) throw new Error("Settings file does not contain an encrypted key envelope.");

  await shellContents.executeJavaScript(`document.querySelector('.sidebar-settings')?.click()`, true);
  await waitForRendererCondition(shellContents, `Boolean(document.querySelector('.settings-page'))`);
  await shellContents.executeJavaScript(`Array.from(document.querySelectorAll('.settings-nav button')).find((button) => button.textContent?.includes('AI 服务'))?.click()`, true);
  await waitForRendererCondition(shellContents, `Boolean(document.querySelector('.provider-editor input[type="password"]'))`);
  const layout = await shellContents.executeJavaScript(`(() => {
    const page = document.querySelector('.settings-page')?.getBoundingClientRect();
    const sidebar = document.querySelector('.settings-sidebar')?.getBoundingClientRect();
    const main = document.querySelector('.settings-main')?.getBoundingClientRect();
    const secret = document.querySelector('.provider-editor input[type="password"]');
    return { page, sidebar, main, secretValue: secret?.value ?? null, providerCount: document.querySelectorAll('.provider-list > button').length };
  })()`, true) as { page?: Electron.Rectangle; sidebar?: Electron.Rectangle; main?: Electron.Rectangle; secretValue?: string | null; providerCount?: number };
  if (!layout.page || !layout.sidebar || !layout.main) throw new Error("Settings layout did not render its required regions.");
  if (layout.sidebar.width < 180 || layout.main.width < 700 || layout.main.x < layout.sidebar.width - 2) throw new Error("Settings layout regions overlap or collapse.");
  if (layout.secretValue !== "") throw new Error("Settings page exposed a saved API key.");
  if ((layout.providerCount ?? 0) < 2) throw new Error("Saved providers did not render in the provider list.");
  return [...contractTests, "settings-encrypted-save", "settings-ipc-roundtrip", "settings-layout", "settings-secret-redaction"];
}

async function runSettingsServiceContractSelfTest(): Promise<string[]> {
  const root = join(app.getPath("userData"), "settings-contract-smoke");
  const path = join(root, "settings.json");
  const secretStore: SettingsSecretStore = {
    encrypt: (value) => Buffer.from(`vault:${value}`, "utf8").toString("base64"),
    decrypt: (value) => Buffer.from(value, "base64").toString("utf8").replace(/^vault:/, ""),
    isAvailable: () => true,
  };
  await rm(root, { recursive: true, force: true });
  try {
    const service = new SettingsService({ path, secretStore });
    const initial = await service.load();
    const first = { ...initial.ai_providers[0], id: "contract-a", label: "Contract A", enabled: true, api_key_env_var: undefined };
    const second = { ...initial.ai_providers[0], id: "contract-b", label: "Contract B", enabled: true, api_key_env_var: undefined };
    const base = { ...initial, active_ai_provider_id: first.id, ai_providers: [first, second] };
    const replaced = await service.save({ settings: base, secret_changes: [{ provider_id: first.id, action: "replace", value: "contract-secret" }, { provider_id: second.id, action: "preserve" }] });
    if (replaced.settings.ai_providers.length !== 2 || !replaced.settings.ai_providers[0].api_key_configured) throw new Error("Settings CRUD/replace contract failed.");
    const persistedAfterReplace = await readFile(path, "utf8");
    if (persistedAfterReplace.includes("contract-secret") || persistedAfterReplace.includes("api_key_value")) throw new Error("Contract settings persisted plaintext secret material.");

    await Promise.all([
      service.save({ settings: { ...base, exploration_language: "concurrent-first" }, secret_changes: [{ provider_id: first.id, action: "preserve" }] }),
      service.save({ settings: { ...base, exploration_language: "concurrent-second" }, secret_changes: [{ provider_id: first.id, action: "preserve" }] }),
    ]);
    if ((await service.load()).exploration_language !== "concurrent-second") throw new Error("Concurrent settings saves were not serialized.");
    const preserved = await service.save({ settings: { ...(await service.load()), exploration_density: "rich" }, secret_changes: [{ provider_id: first.id, action: "preserve" }] });
    if (!preserved.settings.ai_providers.find((item) => item.id === first.id)?.api_key_configured) throw new Error("Preserve secret action lost the key.");
    const cleared = await service.save({ settings: preserved.settings, secret_changes: [{ provider_id: first.id, action: "clear" }] });
    if (cleared.settings.ai_providers.find((item) => item.id === first.id)?.api_key_configured) throw new Error("Clear secret action retained the key.");

    service.subscribe("故障热应用", () => { throw new Error("expected hot apply failure"); });
    const warningResult = await service.save({ settings: cleared.settings, secret_changes: [] });
    if (warningResult.warnings.length !== 1) throw new Error("Hot apply failure did not become a save warning.");
    JSON.parse(await readFile(path, "utf8"));

    const corruptPath = join(root, "corrupt.json");
    await writeFile(corruptPath, "{broken", "utf8");
    const corruptService = new SettingsService({ path: corruptPath, secretStore });
    const recovered = await corruptService.load();
    await corruptService.save({ settings: recovered, secret_changes: [] });
    JSON.parse(await readFile(corruptPath, "utf8"));

    const unavailablePath = join(root, "unavailable.json");
    await writeFile(unavailablePath, JSON.stringify({ ...defaultSettings, ai_providers: [{ ...first, api_key_value: "plaintext-to-remove" }], active_ai_provider_id: first.id }), "utf8");
    const unavailableStore: SettingsSecretStore = { encrypt: () => { throw new Error("unavailable"); }, decrypt: () => { throw new Error("unavailable"); }, isAvailable: () => false };
    const unavailableService = new SettingsService({ path: unavailablePath, secretStore: unavailableStore });
    const unavailable = await unavailableService.load();
    const scrubbed = await readFile(unavailablePath, "utf8");
    if (scrubbed.includes("plaintext-to-remove") || scrubbed.includes("api_key_value") || unavailable.ai_providers[0].api_key_configured) throw new Error("Encryption-unavailable migration retained plaintext.");
    let replaceRejected = false;
    try {
      await unavailableService.save({ settings: unavailable, secret_changes: [{ provider_id: first.id, action: "replace", value: "must-not-persist" }] });
    } catch {
      replaceRejected = true;
    }
    if (!replaceRejected) throw new Error("Encryption-unavailable secret replacement was accepted.");
    return ["settings-crud", "settings-concurrent-save", "settings-secret-actions", "settings-corrupt-recovery", "settings-encryption-unavailable", "settings-hot-apply-warning"];
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

async function runSettingsOnlySelfTest(): Promise<void> {
  try {
    const shellContents = await waitForContents((url) => !url.includes("runtimeTabId="));
    const tests = await runSettingsSurfaceSelfTest(shellContents);
    console.log(`[SeekStarE2E]${JSON.stringify({ status: "ok", tests })}`);
    app.exit(0);
  } catch (error) {
    console.error(`[SeekStarE2E]${JSON.stringify({ status: "error", reason: error instanceof Error ? error.message : String(error) })}`);
    app.exit(1);
  }
}

async function runSettingsOnlyRestartSelfTest(): Promise<void> {
  try {
    const settings = await settingsService.load();
    const provider = settings.ai_providers.find((item) => item.id === "e2e-openai-compatible");
    if (!provider?.api_key_configured || provider.api_key_source !== "encrypted") throw new Error("Encrypted provider was not restored after restart.");
    const persisted = await readFile(settingsService.getPath(), "utf8");
    if (persisted.includes("seekstar-e2e-secret-must-be-encrypted") || persisted.includes("api_key_value")) throw new Error("Restarted settings contain plaintext key material.");
    console.log(`[SeekStarE2E]${JSON.stringify({ status: "ok", tests: ["settings-restart-restore"] })}`);
    app.exit(0);
  } catch (error) {
    console.error(`[SeekStarE2E]${JSON.stringify({ status: "error", reason: error instanceof Error ? error.message : String(error) })}`);
    app.exit(1);
  }
}

async function runSettingsRestartSelfTest(): Promise<void> {
  try {
    const settings = await settingsService.load();
    const provider = settings.ai_providers.find((item) => item.id === "e2e-openai-compatible");
    if (!provider?.api_key_configured || provider.api_key_source !== "encrypted") throw new Error("Encrypted provider was not restored after restart.");
    const persisted = await readFile(settingsService.getPath(), "utf8");
    if (persisted.includes("seekstar-e2e-secret-must-be-encrypted") || persisted.includes("api_key_value")) throw new Error("Restarted settings contain plaintext key material.");
    const snapshot = await tabRuntimeManager.getSnapshot();
    await waitForWorldCondition(snapshot.active_tab_id, (world) => Object.values(world.segments_by_key).filter((segment) => segment.phase === "ready").length === 9);
    const checkpoint = await explorationRuntime.getViewCheckpoint(snapshot.active_tab_id);
    if (checkpoint?.view.camera.layer !== "L3") throw new Error("Exploration view checkpoint was not restored after restart.");
    if (explorationRuntime.getJobSnapshot(snapshot.active_tab_id).length !== 0) throw new Error("Ready world segments were regenerated after restart.");
    console.log(`[SeekStarE2E]${JSON.stringify({ status: "ok", tests: ["settings-restart-restore", "world-restart-without-generation", "view-checkpoint-restore"] })}`);
    app.exit(0);
  } catch (error) {
    console.error(`[SeekStarE2E]${JSON.stringify({ status: "error", reason: error instanceof Error ? error.message : String(error) })}`);
    app.exit(1);
  }
}

async function waitForRendererCondition(contents: Electron.WebContents, expression: string, timeoutMs = 10_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await contents.executeJavaScript(expression, true)) return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Timed out waiting for renderer condition: ${expression}`);
}

async function waitForWorldCondition(tabId: string, predicate: (world: NonNullable<ReturnType<ExplorationRuntime["getWorldSnapshot"]>>) => boolean, timeoutMs = 15_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const world = explorationRuntime.getWorldSnapshot(tabId);
    if (world && predicate(world)) return;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error("Timed out waiting for deterministic exploration world.");
}

async function zoomSurfaceIn(contents: Electron.WebContents, expectedLayer: string): Promise<void> {
  await contents.executeJavaScript(`(async () => {
    const target = document.querySelector('.canvas-plane');
    if (!target) throw new Error('Canvas plane is unavailable.');
    const rect = target.getBoundingClientRect();
    for (let index = 0; index < 4; index += 1) {
      target.dispatchEvent(new WheelEvent('wheel', { bubbles: true, cancelable: true, clientX: rect.left + rect.width / 2, clientY: rect.top + rect.height / 2, deltaY: -1000 }));
      await new Promise((resolve) => setTimeout(resolve, 60));
    }
  })()`, true);
  await waitForRendererCondition(contents, `document.querySelector('.workbench-context-meta')?.textContent?.startsWith(${JSON.stringify(expectedLayer)}) === true`, 5_000);
  await new Promise((resolve) => setTimeout(resolve, 950));
}

async function waitForContents(predicate: (url: string) => boolean, timeoutMs = 20_000): Promise<Electron.WebContents> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const target = webContents.getAllWebContents().find((item) => !item.isDestroyed() && predicate(item.getURL()));
    if (target) return target;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Timed out waiting for Electron surface. URLs: ${webContents.getAllWebContents().map((item) => item.getURL()).join(", ")}`);
}

function countTabSurfaces(tabId: string): number {
  return webContents.getAllWebContents().filter((item) => !item.isDestroyed() && item.getURL().includes(`runtimeTabId=${encodeURIComponent(tabId)}`)).length;
}

async function readSurfaceLayer(contentsId: number): Promise<string> {
  const target = webContents.fromId(contentsId);
  if (!target || target.isDestroyed()) throw new Error(`Surface ${contentsId} was destroyed before its layer could be read.`);
  return withSelfTestTimeout(target.executeJavaScript(`document.querySelector('.workbench-context-meta')?.textContent ?? ''`, true), "read surface layer");
}

function withSelfTestTimeout<T>(promise: Promise<T>, label: string, timeoutMs = 15_000): Promise<T> {
  return Promise.race([promise, new Promise<T>((_resolve, reject) => setTimeout(() => reject(new Error(`Timed out: ${label}`)), timeoutMs))]);
}
