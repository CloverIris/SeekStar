import { app, ipcMain, webContents } from "electron";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { normalizeTerrainScene } from "@seekstar/core-schema";
import type { LayerId, ScoutObservation, SourceRef, TerrainNode, TerrainRelation, TerrainScene, ViewportState } from "@seekstar/core-schema";
import { createDirectUrlScoutPlan, createSourceTerrainPatch } from "@seekstar/constellation-engine";
import { AiCartographerService, type WorldSegmentGenerationOutput } from "@seekstar/ai-service";
import { loadSettings, resolveAiProviderConfigForRoute } from "./appSettingsStore.js";
import { runScoutPlanInMain } from "./scoutAdapter.js";
import { appendAiCostLedgerRecord } from "./aiCostLedgerStore.js";

const WORLD_POOL_FILE_NAME = "seekstar-world-pool.json";
const CHUNK_WIDTH = 1200;
const CHUNK_HEIGHT = 900;
const MAX_AI_CONCURRENCY = 2;
const SAVE_DELAY_MS = 500;

export type WorldSegmentPhase = "queued" | "generating" | "ready" | "error";

export interface WorldSegment {
  key: string;
  x: number;
  y: number;
  phase: WorldSegmentPhase;
  updated_at: string;
  nodes: TerrainNode[];
  relations: TerrainRelation[];
  sources: SourceRef[];
  scout_observations: ScoutObservation[];
  error?: string;
}

export interface WorldPoolSnapshot {
  tab_id: string;
  seed: string;
  scene: TerrainScene;
  segments: WorldSegment[];
  status: "idle" | "expanding" | "ready" | "error";
  updated_at: string;
}

interface WorldPoolTab {
  tab_id: string;
  seed: string;
  base_scene: TerrainScene;
  segments_by_key: Record<string, WorldSegment>;
  status: WorldPoolSnapshot["status"];
  updated_at: string;
  desired_segment_keys: Set<string>;
}

interface PersistedWorldPool {
  version: 2;
  tabs: Record<string, Omit<WorldPoolTab, "base_scene" | "desired_segment_keys">>;
  updated_at: string;
}

interface WorldOpenRequest {
  tabId: string;
  seed: string;
  scene: TerrainScene;
  camera: ViewportState;
}

const worldsByTabId = new Map<string, WorldPoolTab>();
const generationControllersBySegment = new Map<string, AbortController>();
const subscribedTabByWebContentsId = new Map<number, string>();
let persisted: PersistedWorldPool | undefined;
let activeAiJobs = 0;
let saveTimer: NodeJS.Timeout | undefined;
let saveChain: Promise<void> = Promise.resolve();

export function registerWorldPoolCoordinator(): void {
  ipcMain.removeHandler("world-pool:open");
  ipcMain.removeHandler("world-pool:report-camera");
  ipcMain.removeHandler("world-pool:subscribe");
  ipcMain.removeHandler("world-pool:clear");

  ipcMain.handle("world-pool:open", async (_event, value: unknown): Promise<WorldPoolSnapshot> => {
    const request = parseOpenRequest(value);
    const world = await openWorld(request);
    return snapshot(world);
  });
  ipcMain.handle("world-pool:report-camera", async (_event, value: unknown): Promise<void> => {
    const request = parseCameraRequest(value);
    const world = worldsByTabId.get(request.tabId);
    if (!world) {
      return;
    }
    world.base_scene = request.scene
      ? normalizeTerrainScene({ ...stripLegacyTerrain(request.scene), viewport: request.camera })
      : normalizeTerrainScene({ ...world.base_scene, viewport: request.camera });
    cancelDistantGeneration(world, request.camera);
    scheduleWindow(world, request.camera);
    publish(world);
  });
  ipcMain.handle("world-pool:subscribe", async (event, tabId: unknown): Promise<WorldPoolSnapshot | undefined> => {
    if (typeof tabId !== "string" || !tabId.trim()) {
      throw new Error("World pool tab id is required.");
    }
    subscribedTabByWebContentsId.set(event.sender.id, tabId);
    event.sender.once("destroyed", () => subscribedTabByWebContentsId.delete(event.sender.id));
    const world = worldsByTabId.get(tabId);
    return world ? snapshot(world) : undefined;
  });
  ipcMain.handle("world-pool:clear", async (_event, tabId: unknown): Promise<void> => {
    if (typeof tabId === "string") {
      worldsByTabId.delete(tabId);
      const data = await loadPersisted();
      delete data.tabs[tabId];
      await savePersisted(data);
    }
  });
}

export function getWorldPoolStorePath(): string {
  return join(app.getPath("userData"), WORLD_POOL_FILE_NAME);
}

export async function clearWorldPoolData(): Promise<void> {
  worldsByTabId.clear();
  persisted = { version: 2, tabs: {}, updated_at: new Date().toISOString() };
  await savePersisted(persisted);
}

async function openWorld(request: WorldOpenRequest): Promise<WorldPoolTab> {
  const current = worldsByTabId.get(request.tabId);
  if (current && current.seed === request.seed) {
    current.base_scene = stripLegacyTerrain(request.scene);
    current.base_scene = normalizeTerrainScene({ ...current.base_scene, viewport: request.camera });
    scheduleWindow(current, request.camera);
    return current;
  }

  const data = await loadPersisted();
  const stored = data.tabs[request.tabId];
  const world: WorldPoolTab = stored && stored.seed === request.seed
    ? {
        ...stored,
        base_scene: normalizeTerrainScene({ ...stripLegacyTerrain(request.scene), viewport: request.camera }),
        desired_segment_keys: new Set(),
        // A process restart is the boundary for retrying persisted failures. It
        // lets a repaired parser/provider recover without repeatedly spending
        // tokens on the same failing chunk during one live session.
        segments_by_key: Object.fromEntries(Object.entries(stored.segments_by_key).map(([key, segment]) => [key,
          segment.phase === "error" ? { ...segment, phase: "queued", error: undefined, updated_at: new Date().toISOString() } : segment,
        ])),
      }
    : {
        tab_id: request.tabId,
        seed: request.seed,
        base_scene: normalizeTerrainScene({ ...stripLegacyTerrain(request.scene), viewport: request.camera }),
        segments_by_key: {},
        status: "idle",
        updated_at: new Date().toISOString(),
        desired_segment_keys: new Set(),
      };
  worldsByTabId.set(request.tabId, world);
  logWorldPool("ready", "world.open", {
    tab_id: request.tabId,
    restored_segments: stored && stored.seed === request.seed ? Object.keys(stored.segments_by_key).length : 0,
  });
  scheduleWindow(world, request.camera);
  return world;
}

function scheduleWindow(world: WorldPoolTab, camera: ViewportState): void {
  const centerX = Math.round(camera.x / CHUNK_WIDTH);
  const centerY = Math.round(camera.y / CHUNK_HEIGHT);
  const desired = Array.from({ length: 9 }, (_, index) => {
    const dx = (index % 3) - 1;
    const dy = Math.floor(index / 3) - 1;
    return { x: centerX + dx, y: centerY + dy, distance: Math.abs(dx) + Math.abs(dy) };
  }).sort((left, right) => left.distance - right.distance);
  world.desired_segment_keys = new Set(desired.map((target) => segmentKey(target.x, target.y)));

  for (const target of desired) {
    const key = segmentKey(target.x, target.y);
    if (!world.segments_by_key[key]) {
      world.segments_by_key[key] = emptySegment(target.x, target.y, "queued");
    }
  }

  world.status = "expanding";
  world.updated_at = new Date().toISOString();
  queueMicrotask(() => void pumpWorldQueue());
  queueSave();
}

async function pumpWorldQueue(): Promise<void> {
  while (activeAiJobs < MAX_AI_CONCURRENCY) {
    const next = findNextQueuedSegment();
    if (!next) {
      return;
    }
    activeAiJobs += 1;
    void generateSegment(next.world, next.segment).finally(() => {
      activeAiJobs = Math.max(0, activeAiJobs - 1);
      void pumpWorldQueue();
    });
  }
}

function findNextQueuedSegment(): { world: WorldPoolTab; segment: WorldSegment } | undefined {
  const candidates = Array.from(worldsByTabId.values()).flatMap((world) =>
    Object.values(world.segments_by_key)
      .filter((segment) => segment.phase === "queued" && world.desired_segment_keys.has(segment.key))
      .map((segment) => ({ world, segment, distance: distanceToCamera(segment, world.base_scene.viewport) })),
  );
  candidates.sort((left, right) => left.distance - right.distance || left.segment.key.localeCompare(right.segment.key));
  const first = candidates[0];
  return first ? { world: first.world, segment: first.segment } : undefined;
}

async function generateSegment(world: WorldPoolTab, segment: WorldSegment): Promise<void> {
  segment.phase = "generating";
  segment.error = undefined;
  logWorldPool("generating", "segment.generate", { tab_id: world.tab_id, segment: segment.key });
  touch(world);
  publish(world);

  try {
    const settings = await loadSettings();
    const provider = resolveAiProviderConfigForRoute(settings, { level_id: "L0", mode: "bootstrap_seed" });
    const service = new AiCartographerService(provider);
    const controllerKey = `${world.tab_id}:${segment.key}`;
    const controller = new AbortController();
    generationControllersBySegment.set(controllerKey, controller);
    const output = await service.generateWorldSegment({
      seed: world.seed,
      segment: { key: segment.key, x: segment.x, y: segment.y },
      nearby_anchors: nearbyAnchors(world, segment).slice(0, 8),
      prompt_revision: settings.cartographer_prompt_profile.id,
    }, { signal: controller.signal });
    generationControllersBySegment.delete(controllerKey);
    await appendAiCostLedgerRecord({
      level_id: "world_segment",
      mode: "world_pool",
      model: output.model,
      provider_id: output.provider_id,
      seed: world.seed,
      source: "cartographer",
      status: output.status,
      tab_id: world.tab_id,
      telemetry: output.telemetry,
    });

    if (output.status === "cancelled" && controller.signal.aborted) {
      segment.phase = "queued";
      touch(world);
      publish(world);
      return;
    }

    if (output.status !== "ok") {
      throw new Error(output.diagnostics[0]?.message ?? "World segment generation failed.");
    }

    populateSegment(segment, output, world.tab_id);
    segment.phase = "ready";
    world.status = hasQueuedSegments(world) ? "expanding" : "ready";
    logWorldPool("ready", "segment.generated", {
      tab_id: world.tab_id,
      segment: segment.key,
      nodes: segment.nodes.length,
      source_candidates: segment.scout_observations.length,
    });
    touch(world);
    publish(world);
    queueSave();
    for (const observation of segment.scout_observations.filter((candidate) => candidate.status === "source_candidate")) {
      void verifyCandidate(world, segment, observation);
    }
  } catch (error) {
    segment.phase = "error";
    segment.error = error instanceof Error ? error.message : String(error);
    world.status = "error";
    logWorldPool("error", "segment.generate_failed", { tab_id: world.tab_id, segment: segment.key, reason: segment.error });
    touch(world);
    publish(world);
    queueSave();
  } finally {
    generationControllersBySegment.delete(`${world.tab_id}:${segment.key}`);
  }
}

function populateSegment(segment: WorldSegment, output: WorldSegmentGenerationOutput, tabId: string): void {
  const generatedAt = output.generated_at;
  const bands: Array<{ layer: "L0" | "L1" | "L2"; parentLayer?: "L0" | "L1" }> = [
    { layer: "L0" },
    { layer: "L1", parentLayer: "L0" },
    { layer: "L2", parentLayer: "L1" },
  ];
  const nodesByLayer = new Map<LayerId, TerrainNode[]>();
  const nodes: TerrainNode[] = [];
  const relations: TerrainRelation[] = [];

  for (const band of bands) {
    const drafts = output.bands[band.layer].nodes;
    const bandNodes = drafts.map((draft, index) => {
      const parent = band.parentLayer ? nodesByLayer.get(band.parentLayer)?.[index % Math.max(1, nodesByLayer.get(band.parentLayer)?.length ?? 1)] : undefined;
      const id = `world-${segment.key}-${band.layer}-${index + 1}-${slug(draft.title)}`;
      const node: TerrainNode = {
        id,
        type: draft.node_type ?? (band.layer === "L0" ? "domain" : band.layer === "L1" ? "topic" : "concept"),
        title: draft.title,
        layer: band.layer,
        source_state: "cartographer_primary",
        confidence: draft.confidence ?? 0.72,
        importance: draft.importance ?? 0.65,
        tags: ["world-pool", "world-segment", band.layer, ...(draft.tags ?? [])],
        parent_id: parent?.id,
        position_hint: positionFor(segment, band.layer, index, drafts.length),
        created_from: { label: `world-segment:${segment.key}`, layer: band.layer, node_id: parent?.id },
        can_create_seed: true,
        created_at: generatedAt,
        updated_at: generatedAt,
      };
      if (parent) {
        relations.push({
          id: `world-rel-${parent.id}-${id}`,
          from: parent.id,
          to: id,
          type: "parent_child",
          confidence: 0.8,
          explanation: "Continuous multi-scale world segment anchor.",
          source_state: "cartographer_primary",
        });
      }
      return node;
    });
    nodesByLayer.set(band.layer, bandNodes);
    nodes.push(...bandNodes);
  }

  const targets = nodesByLayer.get("L2") ?? [];
  const observations = output.source_candidates.map((candidate, index): ScoutObservation => ({
    id: `world-candidate-${segment.key}-${index + 1}-${slug(candidate.url)}`,
    tab_id: tabId,
    status: "source_candidate",
    layer: "L3",
    position_hint: positionFor(segment, "L3", index, output.source_candidates.length),
    discovery_mode: "direct_url",
    provider_id: candidate.provider_id ?? "ai-cartographer",
    confidence: candidate.confidence ?? 0.55,
    query: candidate.title,
    title: candidate.title,
    target_node_ids: targets.length ? [targets[index % targets.length].id] : [],
    url: candidate.url,
    snippet: candidate.snippet ?? candidate.reason,
    source_type: candidate.source_type,
    created_at: generatedAt,
    updated_at: generatedAt,
  }));

  segment.nodes = nodes;
  segment.relations = relations;
  segment.sources = [];
  segment.scout_observations = observations;
  segment.updated_at = generatedAt;
}

async function verifyCandidate(world: WorldPoolTab, segment: WorldSegment, candidate: ScoutObservation): Promise<void> {
  if (!candidate.url || candidate.status !== "source_candidate") {
    return;
  }
  const result = await runScoutPlanInMain({
    tab_id: world.tab_id,
    requested_at: new Date().toISOString(),
    plan: createDirectUrlScoutPlan(candidate.url, candidate.target_node_ids, new Date().toISOString()),
  }).catch(() => undefined);
  const observation = result?.observations.find((item) => item.source_snapshot);
  if (!observation?.source_snapshot) {
    logWorldPool("unverified", "scout.candidate_failed", { tab_id: world.tab_id, segment: segment.key, candidate: candidate.id });
    return;
  }
  const scene = composeScene(world);
  const patch = createSourceTerrainPatch({
    title: observation.title || candidate.title,
    url: candidate.url,
    snapshot: observation.source_snapshot,
    observationId: candidate.id,
    initialLayer: "L3",
    tags: ["world-pool", "scout-observation"],
    createdFrom: { label: `world-segment:${segment.key}`, node_id: candidate.target_node_ids[0], layer: "L3" },
  }, scene);
  const anchor = candidate.position_hint ?? { x: segment.x * CHUNK_WIDTH, y: segment.y * CHUNK_HEIGHT };
  const original = patch.nodes[0]?.position_hint ?? anchor;
  const shiftedNodes = patch.nodes.map((node) => ({
    ...node,
    tags: Array.from(new Set(["world-pool", ...node.tags])),
    position_hint: node.position_hint ? { x: node.position_hint.x - original.x + anchor.x, y: node.position_hint.y - original.y + anchor.y } : undefined,
  }));
  segment.nodes.push(...shiftedNodes);
  segment.relations.push(...patch.relations);
  segment.sources.push(patch.source);
  segment.scout_observations = segment.scout_observations.map((item) => item.id === candidate.id
    ? { ...item, status: "converted", source_snapshot: observation.source_snapshot, retrieved_at: observation.retrieved_at, updated_at: new Date().toISOString() }
    : item,
  );
  logWorldPool("ready", "scout.source_verified", { tab_id: world.tab_id, segment: segment.key, candidate: candidate.id });
  touch(world);
  publish(world);
  queueSave();
}

function composeScene(world: WorldPoolTab): TerrainScene {
  const allSegments = Object.values(world.segments_by_key);
  const segments = allSegments.filter((segment) => segment.phase === "ready");
  const pendingFog = allSegments
    .filter((segment) => segment.phase === "queued" || segment.phase === "generating")
    .map((segment) => createSegmentFogNode(segment, world.base_scene.viewport.layer));
  const nodes = uniqueById([...world.base_scene.nodes, ...segments.flatMap((segment) => segment.nodes), ...pendingFog]);
  const relations = uniqueById([...world.base_scene.relations, ...segments.flatMap((segment) => segment.relations)]);
  const sources = uniqueById([...world.base_scene.sources, ...segments.flatMap((segment) => segment.sources)]);
  const observations = uniqueById([...(world.base_scene.scout_observations ?? []), ...segments.flatMap((segment) => segment.scout_observations)]);
  const scene = normalizeTerrainScene({
    ...world.base_scene,
    nodes,
    relations,
    sources,
    scout_observations: observations,
    tabs: world.base_scene.tabs.map((tab) =>
      tab.id === world.tab_id
        ? {
            ...tab,
            current_layer: world.base_scene.viewport.layer,
            node_ids: nodes.map((node) => node.id),
            relation_ids: relations.map((relation) => relation.id),
            source_ids: sources.map((source) => source.id),
            updated_at: new Date().toISOString(),
            viewport: world.base_scene.viewport,
          }
        : tab,
    ),
    metadata: { ...world.base_scene.metadata, source_state: "cartographer_primary", updated_at: new Date().toISOString() },
  });
  return scene;
}

function createSegmentFogNode(segment: WorldSegment, layer: LayerId): TerrainNode {
  const visibleLayer = layer === "L3" ? "L2" : layer;
  return {
    id: `world-fog-${segment.key}-${visibleLayer}`,
    type: "fog_region",
    title: segment.phase === "generating" ? "正在生成的地形" : "待展开的地形",
    layer: visibleLayer,
    source_state: "fog",
    confidence: 0.2,
    importance: 0.25,
    tags: ["world-pool", "world-segment-fog", segment.phase],
    summary: `World segment ${segment.key} is ${segment.phase}.`,
    position_hint: { x: segment.x * CHUNK_WIDTH, y: segment.y * CHUNK_HEIGHT },
    created_at: segment.updated_at,
    updated_at: segment.updated_at,
  };
}

function snapshot(world: WorldPoolTab): WorldPoolSnapshot {
  return {
    tab_id: world.tab_id,
    seed: world.seed,
    scene: composeScene(world),
    segments: Object.values(world.segments_by_key).sort((left, right) => left.key.localeCompare(right.key)),
    status: world.status,
    updated_at: world.updated_at,
  };
}

function publish(world: WorldPoolTab): void {
  const next = snapshot(world);
  for (const target of webContents.getAllWebContents()) {
    if (!target.isDestroyed() && subscribedTabByWebContentsId.get(target.id) === world.tab_id) {
      target.send("world-pool:changed", next);
    }
  }
}

function nearbyAnchors(world: WorldPoolTab, target: WorldSegment): Array<{ id: string; layer: string; title: string; x: number; y: number }> {
  return composeScene(world).nodes
    .filter((node) => node.source_state === "cartographer_primary" && node.position_hint)
    .sort((left, right) => distanceToSegment(left, target) - distanceToSegment(right, target))
    .slice(0, 8)
    .map((node) => ({ id: node.id, layer: node.layer, title: node.title, x: node.position_hint?.x ?? 0, y: node.position_hint?.y ?? 0 }));
}

function positionFor(segment: WorldSegment, layer: "L0" | "L1" | "L2" | "L3", index: number, count: number): { x: number; y: number } {
  const columns = Math.max(2, Math.ceil(Math.sqrt(Math.max(1, count))));
  const row = Math.floor(index / columns);
  const column = index % columns;
  const spacing = layer === "L0" ? 250 : layer === "L1" ? 190 : layer === "L2" ? 145 : 260;
  return {
    x: segment.x * CHUNK_WIDTH + Math.round((column - (columns - 1) / 2) * spacing),
    y: segment.y * CHUNK_HEIGHT + Math.round((row - (Math.ceil(count / columns) - 1) / 2) * spacing),
  };
}

function stripLegacyTerrain(scene: TerrainScene): TerrainScene {
  const legacyNodeIds = new Set(scene.nodes.filter((node) => node.tags?.includes("world-pool") || node.source_state === "cartographer_primary" || node.source_state === "cartographer_unverified_source").map((node) => node.id));
  return normalizeTerrainScene({
    ...scene,
    nodes: scene.nodes.filter((node) => !legacyNodeIds.has(node.id)),
    relations: scene.relations.filter((relation) => !legacyNodeIds.has(relation.from) && !legacyNodeIds.has(relation.to)),
    scout_observations: (scene.scout_observations ?? []).filter((observation) => observation.provider_id !== "ai-cartographer"),
  });
}

function emptySegment(x: number, y: number, phase: WorldSegmentPhase): WorldSegment {
  return { key: segmentKey(x, y), x, y, phase, updated_at: new Date().toISOString(), nodes: [], relations: [], sources: [], scout_observations: [] };
}

function segmentKey(x: number, y: number): string { return `${x}:${y}`; }
function hasQueuedSegments(world: WorldPoolTab): boolean {
  return Object.values(world.segments_by_key).some(
    (segment) => world.desired_segment_keys.has(segment.key) && (segment.phase === "queued" || segment.phase === "generating"),
  );
}
function cancelDistantGeneration(world: WorldPoolTab, camera: ViewportState): void {
  const centerX = Math.round(camera.x / CHUNK_WIDTH);
  const centerY = Math.round(camera.y / CHUNK_HEIGHT);
  for (const segment of Object.values(world.segments_by_key)) {
    if (segment.phase !== "generating" || Math.abs(segment.x - centerX) <= 1 && Math.abs(segment.y - centerY) <= 1) {
      continue;
    }
    generationControllersBySegment.get(`${world.tab_id}:${segment.key}`)?.abort();
    segment.phase = "queued";
  }
}
function touch(world: WorldPoolTab): void { world.updated_at = new Date().toISOString(); }
function distanceToCamera(segment: WorldSegment, camera: ViewportState): number { return Math.hypot(segment.x * CHUNK_WIDTH - camera.x, segment.y * CHUNK_HEIGHT - camera.y); }
function distanceToSegment(node: TerrainNode, segment: WorldSegment): number { return Math.hypot((node.position_hint?.x ?? 0) - segment.x * CHUNK_WIDTH, (node.position_hint?.y ?? 0) - segment.y * CHUNK_HEIGHT); }
function slug(value: string): string { return value.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "node"; }
function uniqueById<T extends { id: string }>(items: T[]): T[] { return Array.from(new Map(items.map((item) => [item.id, item])).values()); }

function logWorldPool(state: "ready" | "generating" | "error" | "unverified", event: string, details: Record<string, unknown>): void {
  console.info(`[SeekStar][world-pool] state=${state} event=${event} ${JSON.stringify(details)}`);
}

async function loadPersisted(): Promise<PersistedWorldPool> {
  if (persisted) return persisted;
  try {
    const parsed = JSON.parse(await readFile(getWorldPoolStorePath(), "utf8")) as Partial<PersistedWorldPool>;
    persisted = parsed.version === 2 && parsed.tabs && typeof parsed.tabs === "object"
      ? { version: 2, tabs: parsed.tabs, updated_at: typeof parsed.updated_at === "string" ? parsed.updated_at : new Date().toISOString() }
      : { version: 2, tabs: {}, updated_at: new Date().toISOString() };
  } catch {
    persisted = { version: 2, tabs: {}, updated_at: new Date().toISOString() };
  }
  return persisted;
}

function queueSave(): void {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => { saveTimer = undefined; void persistRuntimeWorlds(); }, SAVE_DELAY_MS);
}

async function persistRuntimeWorlds(): Promise<void> {
  const data = await loadPersisted();
  data.tabs = Object.fromEntries(Array.from(worldsByTabId.values()).map((world) => [world.tab_id, {
    tab_id: world.tab_id,
    seed: world.seed,
    segments_by_key: world.segments_by_key,
    status: world.status,
    updated_at: world.updated_at,
  }]));
  data.updated_at = new Date().toISOString();
  await savePersisted(data);
}

async function savePersisted(data: PersistedWorldPool): Promise<void> {
  persisted = data;
  const path = getWorldPoolStorePath();
  saveChain = saveChain.catch(() => undefined).then(async () => {
    await mkdir(dirname(path), { recursive: true });
    const temporary = `${path}.${process.pid}.${Date.now()}.tmp`;
    await writeFile(temporary, `${JSON.stringify(data, null, 2)}\n`, "utf8");
    await rename(temporary, path);
  });
  return saveChain;
}

function parseOpenRequest(value: unknown): WorldOpenRequest {
  if (!value || typeof value !== "object") throw new Error("Invalid world-pool open request.");
  const input = value as Partial<WorldOpenRequest>;
  if (!input.tabId || !input.seed || !input.scene || !input.camera) throw new Error("World-pool open requires tab, seed, scene, and camera.");
  return input as WorldOpenRequest;
}
function parseCameraRequest(value: unknown): { tabId: string; camera: ViewportState; scene?: TerrainScene } {
  if (!value || typeof value !== "object") throw new Error("Invalid world-pool camera request.");
  const input = value as { tabId?: unknown; camera?: unknown; scene?: unknown };
  if (typeof input.tabId !== "string" || !input.camera || typeof input.camera !== "object") throw new Error("World-pool camera requires tab and camera.");
  return { tabId: input.tabId, camera: input.camera as ViewportState, scene: input.scene as TerrainScene | undefined };
}
