import { app, ipcMain } from "electron";
import type { IpcMainInvokeEvent, WebContents } from "electron";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { AiCartographerService, type WorldSegmentGenerationInput, type WorldSegmentGenerationOutput } from "@seekstar/ai-service";
import type {
  ExplorationCommand,
  ExplorationJobState,
  ExplorationOpenResult,
  ExplorationViewCheckpoint,
  ExplorationViewState,
  ExplorationWorldEvent,
  ScoutObservation,
  ScoutPlan,
  ScoutRunRequest,
  ScoutRunResult,
  SourceRef,
  TerrainNode,
  TerrainRelation,
  WorldDocument,
  WorldSegment,
} from "@seekstar/core-schema";
import { JsonWorldRepository } from "@seekstar/storage-service";
import { settingsService } from "./settingsService.js";
import { runScoutPlanInMain } from "./scoutAdapter.js";
import type { TabRuntimeManager } from "./tabRuntimeManager.js";

const WORLD_FILE_NAME = "seekstar-exploration-worlds-v1.json";
const POLICY_REVISION = "exploration-world-v1";
const CHUNK_WIDTH = 1200;
const CHUNK_HEIGHT = 900;
const MAX_AI_CONCURRENCY = 2;
const MAX_SCOUT_CONCURRENCY = 2;

interface SurfaceLease {
  id: string;
  tabId: string;
  sender: WebContents;
  subscribed: boolean;
  viewRevision: number;
  view: ExplorationViewState;
}

interface RuntimeWorld {
  document: WorldDocument;
  jobs: Map<string, ExplorationJobState>;
  desiredSegmentKeys: Set<string>;
  centerKey: string;
}

export interface ExplorationRuntimeDependencies {
  generateWorldSegment?: (input: WorldSegmentGenerationInput, signal: AbortSignal) => Promise<WorldSegmentGenerationOutput>;
  runScoutPlan?: (request: ScoutRunRequest) => Promise<ScoutRunResult>;
}

export class ExplorationRuntime {
  private readonly worldsByTabId = new Map<string, RuntimeWorld>();
  private readonly leasesById = new Map<string, SurfaceLease>();
  private readonly activeLeaseByTabId = new Map<string, string>();
  private readonly segmentControllers = new Map<string, AbortController>();
  private activeAiJobs = 0;
  private activeScoutJobs = 0;
  private maxAiConcurrency = MAX_AI_CONCURRENCY;
  private maxScoutConcurrency = MAX_SCOUT_CONCURRENCY;
  private repository: JsonWorldRepository | undefined;

  constructor(private readonly tabs: TabRuntimeManager, private readonly dependencies: ExplorationRuntimeDependencies = {}) {}

  registerIpc(): void {
    this.handle("exploration:open", (event, value) => this.open(event, parseTabId(value)));
    this.handle("exploration:subscribe", (event, value) => this.subscribe(event, parseLeaseId(value)));
    this.handle("exploration:report-view", (event, value) => this.reportView(event, parseViewReport(value)));
    this.handle("exploration:command", (event, value) => this.command(event, parseCommandRequest(value)));
    this.handle("exploration:close", (event, value) => this.close(event, parseLeaseId(value)));
  }

  async flush(): Promise<void> {
    await this.getRepository().flush();
  }

  getRepositoryPath(): string {
    return join(app.getPath("userData"), WORLD_FILE_NAME);
  }

  getWorldSnapshot(tabId: string): WorldDocument | undefined {
    const world = this.worldsByTabId.get(tabId)?.document;
    return world ? structuredClone(world) : undefined;
  }

  getJobSnapshot(tabId: string): ExplorationJobState[] {
    return Array.from(this.worldsByTabId.get(tabId)?.jobs.values() ?? [], (job) => structuredClone(job));
  }

  async getViewCheckpoint(tabId: string): Promise<ExplorationViewCheckpoint | undefined> {
    return this.getRepository().getViewCheckpoint(tabId);
  }

  async clearAll(): Promise<void> {
    for (const controller of this.segmentControllers.values()) controller.abort();
    this.segmentControllers.clear();
    this.worldsByTabId.clear();
    await this.getRepository().clear();
    await this.getRepository().flush();
  }

  async deleteTab(tabId: string): Promise<void> {
    const leaseId = this.activeLeaseByTabId.get(tabId);
    if (leaseId) this.revokeLease(leaseId);
    this.worldsByTabId.delete(tabId);
    await this.getRepository().deleteWorld(tabId);
  }

  private handle(channel: string, handler: (event: IpcMainInvokeEvent, value: unknown) => unknown): void {
    ipcMain.removeHandler(channel);
    ipcMain.handle(channel, handler);
  }

  private async open(event: IpcMainInvokeEvent, tabId: string): Promise<ExplorationOpenResult> {
    const tab = (await this.tabs.getSnapshot()).tabs.find((candidate) => candidate.id === tabId);
    if (!tab) throw new Error(`Unknown exploration tab: ${tabId}`);
    const settings = await settingsService.load();
    const policyRevision = `${POLICY_REVISION}:${settings.exploration_language}:${settings.exploration_density}`;
    this.maxAiConcurrency = Math.min(MAX_AI_CONCURRENCY, Math.max(1, settings.generation_concurrency));
    this.maxScoutConcurrency = Math.min(MAX_SCOUT_CONCURRENCY, Math.max(1, settings.scout_concurrency));

    const previousLeaseId = this.activeLeaseByTabId.get(tabId);
    if (previousLeaseId) this.revokeLease(previousLeaseId);

    const repository = this.getRepository();
    const storedWorld = await repository.getWorld(tabId);
    const world = storedWorld && storedWorld.seed === tab.seed && storedWorld.policy_revision === policyRevision
      ? this.restoreRuntimeWorld(storedWorld)
      : this.createRuntimeWorld(tabId, tab.seed, policyRevision);
    this.worldsByTabId.set(tabId, world);

    const storedView = await repository.getViewCheckpoint(tabId);
    const checkpoint = storedView ?? createDefaultViewCheckpoint(tabId);
    const lease: SurfaceLease = {
      id: randomUUID(),
      tabId,
      sender: event.sender,
      subscribed: false,
      viewRevision: checkpoint.view_revision,
      view: checkpoint.view,
    };
    this.leasesById.set(lease.id, lease);
    this.activeLeaseByTabId.set(tabId, lease.id);
    event.sender.once("destroyed", () => this.revokeLease(lease.id));

    this.ensureWorkingSet(world, checkpoint.view);
    this.log("surface", "opened", { tab_id: tabId, lease_id: lease.id, restored_segments: Object.keys(world.document.segments_by_key).length });
    return {
      lease_id: lease.id,
      tab_id: tabId,
      world: structuredClone(world.document),
      view_checkpoint: structuredClone(checkpoint),
      jobs: Array.from(world.jobs.values()).map((job) => structuredClone(job)),
    };
  }

  private subscribe(event: IpcMainInvokeEvent, leaseId: string): void {
    const lease = this.requireLease(event, leaseId);
    lease.subscribed = true;
  }

  private async reportView(event: IpcMainInvokeEvent, request: { leaseId: string; viewRevision: number; view: ExplorationViewState }): Promise<void> {
    const lease = this.requireLease(event, request.leaseId);
    if (request.viewRevision <= lease.viewRevision) return;
    lease.viewRevision = request.viewRevision;
    lease.view = request.view;
    const checkpoint: ExplorationViewCheckpoint = {
      tab_id: lease.tabId,
      view_revision: request.viewRevision,
      view: structuredClone(request.view),
      updated_at: new Date().toISOString(),
    };
    void this.getRepository().saveViewCheckpoint(checkpoint).catch((error) => {
      this.log("persistence", "view_checkpoint_failed", { tab_id: lease.tabId, reason: getErrorMessage(error) });
    });
    const world = this.worldsByTabId.get(lease.tabId);
    if (world) this.ensureWorkingSet(world, request.view);
  }

  private async command(event: IpcMainInvokeEvent, request: { leaseId: string; command: ExplorationCommand }): Promise<void> {
    const lease = this.requireLease(event, request.leaseId);
    const world = this.worldsByTabId.get(lease.tabId);
    if (!world) throw new Error("Exploration world is not open.");
    switch (request.command.type) {
      case "ensure_working_set":
        this.ensureWorkingSet(world, lease.view);
        break;
      case "retry_segment": {
        const segment = world.document.segments_by_key[request.command.segment_key];
        if (segment?.phase === "failed") {
          segment.phase = "queued";
          segment.error = undefined;
          segment.attempts = 0;
          this.upsertSegment(world, segment);
          this.pumpAiQueue();
        }
        break;
      }
      case "observe_candidate": {
        const candidate = world.document.scout_observations[request.command.candidate_id];
        if (candidate) this.queueScout(world, candidate);
        break;
      }
      case "replace_candidate": {
        const candidate = world.document.scout_observations[request.command.candidate_id];
        if (candidate) {
          candidate.url = request.command.url;
          candidate.status = "source_candidate";
          candidate.failure_reason = undefined;
          candidate.updated_at = now();
          this.queueScout(world, candidate);
        }
        break;
      }
    }
  }

  private close(event: IpcMainInvokeEvent, leaseId: string): void {
    this.requireLease(event, leaseId);
    this.revokeLease(leaseId);
  }

  private requireLease(event: IpcMainInvokeEvent, leaseId: string): SurfaceLease {
    const lease = this.leasesById.get(leaseId);
    if (!lease || lease.sender.id !== event.sender.id || this.activeLeaseByTabId.get(lease.tabId) !== leaseId) {
      throw new Error("Exploration surface lease is stale.");
    }
    return lease;
  }

  private revokeLease(leaseId: string): void {
    const lease = this.leasesById.get(leaseId);
    if (!lease) return;
    this.leasesById.delete(leaseId);
    if (this.activeLeaseByTabId.get(lease.tabId) === leaseId) this.activeLeaseByTabId.delete(lease.tabId);
    this.log("surface", "revoked", { tab_id: lease.tabId, lease_id: leaseId });
  }

  private createRuntimeWorld(tabId: string, seed: string, policyRevision: string): RuntimeWorld {
    const timestamp = now();
    return {
      document: {
        world_id: randomUUID(),
        tab_id: tabId,
        seed,
        policy_revision: policyRevision,
        world_revision: 0,
        segments_by_key: {},
        sources: {},
        scout_observations: {},
        created_at: timestamp,
        updated_at: timestamp,
      },
      jobs: new Map(),
      desiredSegmentKeys: new Set(),
      centerKey: "0:0",
    };
  }

  private restoreRuntimeWorld(document: WorldDocument): RuntimeWorld {
    for (const segment of Object.values(document.segments_by_key)) {
      if (segment.phase === "generating") segment.phase = "queued";
    }
    return { document, jobs: new Map(), desiredSegmentKeys: new Set(), centerKey: "0:0" };
  }

  private ensureWorkingSet(world: RuntimeWorld, view: ExplorationViewState): void {
    const centerX = Math.round(view.camera.x / CHUNK_WIDTH);
    const centerY = Math.round(view.camera.y / CHUNK_HEIGHT);
    const centerKey = segmentKey(centerX, centerY);
    world.centerKey = centerKey;
    world.desiredSegmentKeys = new Set([centerKey]);
    let center = world.document.segments_by_key[centerKey];
    if (!center) {
      center = createEmptySegment(centerX, centerY);
      world.document.segments_by_key[centerKey] = center;
      this.upsertSegment(world, center);
    }
    if (isTerminal(center.phase)) this.ensureNeighborRing(world, centerX, centerY);
    this.pumpAiQueue();
  }

  private ensureNeighborRing(world: RuntimeWorld, centerX: number, centerY: number): void {
    for (let dy = -1; dy <= 1; dy += 1) {
      for (let dx = -1; dx <= 1; dx += 1) {
        const key = segmentKey(centerX + dx, centerY + dy);
        world.desiredSegmentKeys.add(key);
        if (!world.document.segments_by_key[key]) {
          const segment = createEmptySegment(centerX + dx, centerY + dy);
          world.document.segments_by_key[key] = segment;
          this.upsertSegment(world, segment);
        }
      }
    }
  }

  private pumpAiQueue(): void {
    while (this.activeAiJobs < this.maxAiConcurrency) {
      const next = this.findNextSegment();
      if (!next) return;
      this.activeAiJobs += 1;
      void this.generateSegment(next.world, next.segment).finally(() => {
        this.activeAiJobs = Math.max(0, this.activeAiJobs - 1);
        this.pumpAiQueue();
      });
    }
  }

  private findNextSegment(): { world: RuntimeWorld; segment: WorldSegment } | undefined {
    const candidates = Array.from(this.worldsByTabId.values()).flatMap((world) =>
      Object.values(world.document.segments_by_key)
        .filter((segment) => segment.phase === "queued" && world.desiredSegmentKeys.has(segment.key))
        .map((segment) => ({ world, segment, center: segment.key === world.centerKey })),
    );
    candidates.sort((left, right) => Number(right.center) - Number(left.center) || left.segment.key.localeCompare(right.segment.key));
    return candidates[0];
  }

  private async generateSegment(world: RuntimeWorld, segment: WorldSegment): Promise<void> {
    const job = this.changeJob(world, { id: `segment:${segment.key}`, kind: "segment", status: "running", segment_key: segment.key, updated_at: now() });
    segment.phase = "generating";
    segment.attempts += 1;
    this.upsertSegment(world, segment);
    const controllerKey = `${world.document.tab_id}:${segment.key}`;
    const controller = new AbortController();
    this.segmentControllers.set(controllerKey, controller);

    try {
      const input: WorldSegmentGenerationInput = {
        seed: world.document.seed,
        segment: { key: segment.key, x: segment.chunk_x, y: segment.chunk_y },
        nearby_anchors: this.nearbyAnchors(world, segment),
        prompt_revision: world.document.policy_revision,
      };
      const output = this.dependencies.generateWorldSegment
        ? await this.dependencies.generateWorldSegment(input, controller.signal)
        : await this.generateWorldSegment(input, controller.signal);
      if (output.status !== "ok") throw new Error(output.diagnostics[0]?.message ?? "World segment generation failed.");
      this.populateSegment(world, segment, output);
      segment.phase = "ready";
      segment.error = undefined;
      this.upsertSegment(world, segment);
      this.changeJob(world, { ...job, status: "completed", updated_at: now() });
      for (const candidate of segment.source_candidates) this.queueScout(world, candidate);
    } catch (error) {
      segment.error = getErrorMessage(error);
      if (segment.attempts < 2) {
        segment.phase = "queued";
      } else {
        segment.phase = "failed";
        this.changeJob(world, { ...job, status: "failed", error: segment.error, updated_at: now() });
        this.publish(world, { type: "world_error", world_revision: world.document.world_revision, code: "segment_failed", message: segment.error, segment_key: segment.key });
      }
      this.upsertSegment(world, segment);
    } finally {
      this.segmentControllers.delete(controllerKey);
      if (segment.key === world.centerKey && isTerminal(segment.phase)) {
        this.ensureNeighborRing(world, segment.chunk_x, segment.chunk_y);
      }
    }
  }

  private populateSegment(world: RuntimeWorld, segment: WorldSegment, output: WorldSegmentGenerationOutput): void {
    const nodesByLayer = new Map<string, TerrainNode[]>();
    const nodes: TerrainNode[] = [];
    const relations: TerrainRelation[] = [];
    for (const layer of ["L0", "L1", "L2"] as const) {
      const drafts = output.bands[layer].nodes.slice(0, 4);
      const parentLayer = layer === "L1" ? "L0" : layer === "L2" ? "L1" : undefined;
      const parentNodes = parentLayer ? nodesByLayer.get(parentLayer) ?? [] : [];
      const bandNodes = drafts.map((draft, index): TerrainNode => {
        const parent = parentNodes[index % Math.max(1, parentNodes.length)];
        const id = `node:${segment.key}:${layer}:${index}:${slug(draft.title)}`;
        if (parent) relations.push({ id: `relation:${parent.id}:${id}`, from: parent.id, to: id, type: "parent_child", confidence: 0.8, explanation: "Shared multi-scale world anchor.", source_state: "generated" });
        return {
          id,
          type: layer === "L0" ? "domain" : layer === "L1" ? "topic" : "concept",
          title: draft.title,
          layer,
          source_state: "generated",
          confidence: draft.confidence ?? 0.72,
          importance: draft.importance ?? 0.65,
          tags: ["exploration-world", layer, ...(draft.tags ?? [])],
          parent_id: parent?.id,
          position_hint: positionFor(segment, layer, index, drafts.length),
          can_create_seed: true,
          created_at: output.generated_at,
          updated_at: output.generated_at,
        };
      });
      nodesByLayer.set(layer, bandNodes);
      nodes.push(...bandNodes);
    }
    const targets = nodesByLayer.get("L2") ?? [];
    const candidates = output.source_candidates.slice(0, 2).map((candidate, index): ScoutObservation => ({
      id: `candidate:${segment.key}:${index}:${slug(candidate.url)}`,
      tab_id: world.document.tab_id,
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
      created_at: output.generated_at,
      updated_at: output.generated_at,
    }));
    segment.nodes = nodes;
    segment.relations = relations;
    segment.source_candidates = candidates;
    for (const candidate of candidates) world.document.scout_observations[candidate.id] = candidate;
  }

  private queueScout(world: RuntimeWorld, candidate: ScoutObservation): void {
    const jobId = `scout:${candidate.id}`;
    const current = world.jobs.get(jobId);
    if (current && (current.status === "queued" || current.status === "running" || current.status === "completed")) return;
    this.changeJob(world, { id: jobId, kind: "scout", status: "queued", candidate_id: candidate.id, updated_at: now() });
    this.pumpScoutQueue();
  }

  private pumpScoutQueue(): void {
    while (this.activeScoutJobs < this.maxScoutConcurrency) {
      const next = Array.from(this.worldsByTabId.values()).flatMap((world) =>
        Array.from(world.jobs.values()).filter((job) => job.kind === "scout" && job.status === "queued").map((job) => ({ world, job })),
      )[0];
      if (!next) return;
      this.activeScoutJobs += 1;
      void this.observeCandidate(next.world, next.job).finally(() => {
        this.activeScoutJobs = Math.max(0, this.activeScoutJobs - 1);
        this.pumpScoutQueue();
      });
    }
  }

  private async observeCandidate(world: RuntimeWorld, job: ExplorationJobState): Promise<void> {
    const candidate = job.candidate_id ? world.document.scout_observations[job.candidate_id] : undefined;
    if (!candidate?.url) return;
    this.changeJob(world, { ...job, status: "running", updated_at: now() });
    const plan: ScoutPlan = {
      id: `plan:${candidate.id}`,
      title: `Observe ${candidate.title}`,
      target_node_ids: candidate.target_node_ids,
      candidate_queries: [candidate.url],
      source_type_targets: [candidate.source_type ?? "webpage"],
      discovery_mode: "direct_url",
      priority: "medium",
      stop_conditions: ["Observe the requested URL once."],
      deduplication_notes: ["Canonicalize final URL."],
      created_at: now(),
    };
    try {
      const request = { tab_id: world.document.tab_id, plan, requested_at: now() };
      const result = this.dependencies.runScoutPlan ? await this.dependencies.runScoutPlan(request) : await runScoutPlanInMain(request);
      const observed = result.observations.find((item) => item.source_snapshot);
      if (!observed?.source_snapshot) throw new Error(result.observations[0]?.failure_reason ?? "Source could not be observed.");
      candidate.status = "converted";
      candidate.source_snapshot = observed.source_snapshot;
      candidate.retrieved_at = observed.retrieved_at;
      candidate.updated_at = now();
      const source = createSource(candidate);
      world.document.sources[source.id] = source;
      const segment = this.segmentForCandidate(world, candidate.id);
      if (segment) {
        segment.nodes.push(createSourceNode(candidate, source));
        this.upsertSegment(world, segment);
      }
      this.publish(world, { type: "source_upsert", world_revision: this.bumpWorld(world), source: structuredClone(source), observation: structuredClone(candidate) });
      this.changeJob(world, { ...job, status: "completed", updated_at: now() });
      this.persist(world);
    } catch (error) {
      candidate.status = "failed";
      candidate.failure_reason = getErrorMessage(error);
      candidate.updated_at = now();
      const segment = this.segmentForCandidate(world, candidate.id);
      if (segment) this.upsertSegment(world, segment);
      this.changeJob(world, { ...job, status: "failed", error: candidate.failure_reason, updated_at: now() });
      this.persist(world);
    }
  }

  private nearbyAnchors(world: RuntimeWorld, target: WorldSegment): Array<{ id: string; layer: string; title: string; x: number; y: number }> {
    return Object.values(world.document.segments_by_key).flatMap((segment) => segment.nodes)
      .filter((node) => node.position_hint && node.layer !== "L3")
      .sort((left, right) => distance(left, target) - distance(right, target))
      .slice(0, 8)
      .map((node) => ({ id: node.id, layer: node.layer, title: node.title, x: node.position_hint?.x ?? 0, y: node.position_hint?.y ?? 0 }));
  }

  private async generateWorldSegment(input: WorldSegmentGenerationInput, signal: AbortSignal): Promise<WorldSegmentGenerationOutput> {
    const settings = await settingsService.load();
    const service = new AiCartographerService(await settingsService.resolveActiveProviderConfig(settings));
    return service.generateWorldSegment(input, { signal });
  }

  private segmentForCandidate(world: RuntimeWorld, candidateId: string): WorldSegment | undefined {
    return Object.values(world.document.segments_by_key).find((segment) => segment.source_candidates.some((candidate) => candidate.id === candidateId));
  }

  private upsertSegment(world: RuntimeWorld, segment: WorldSegment): void {
    segment.revision += 1;
    segment.updated_at = now();
    world.document.segments_by_key[segment.key] = segment;
    const revision = this.bumpWorld(world);
    this.publish(world, { type: "segment_upsert", world_revision: revision, segment: structuredClone(segment) });
    this.persist(world);
  }

  private changeJob(world: RuntimeWorld, job: ExplorationJobState): ExplorationJobState {
    world.jobs.set(job.id, job);
    this.publish(world, { type: "job_changed", world_revision: world.document.world_revision, job: structuredClone(job) });
    return job;
  }

  private bumpWorld(world: RuntimeWorld): number {
    world.document.world_revision += 1;
    world.document.updated_at = now();
    return world.document.world_revision;
  }

  private publish(world: RuntimeWorld, event: ExplorationWorldEvent): void {
    const leaseId = this.activeLeaseByTabId.get(world.document.tab_id);
    const lease = leaseId ? this.leasesById.get(leaseId) : undefined;
    if (lease?.subscribed && !lease.sender.isDestroyed()) lease.sender.send(`exploration:event:${lease.id}`, event);
  }

  private persist(world: RuntimeWorld): void {
    void this.getRepository().saveWorld(structuredClone(world.document)).catch((error) => {
      const message = getErrorMessage(error);
      this.log("persistence", "world_save_failed", { tab_id: world.document.tab_id, reason: message });
      this.publish(world, { type: "world_error", world_revision: world.document.world_revision, code: "persistence_failed", message });
    });
  }

  private getRepository(): JsonWorldRepository {
    this.repository ??= new JsonWorldRepository(join(app.getPath("userData"), WORLD_FILE_NAME));
    return this.repository;
  }

  private log(module: string, event: string, details: Record<string, unknown>): void {
    console.info(`[SeekStar][exploration] module=${module} event=${event} ${JSON.stringify(details)}`);
  }
}

export function createDeterministicExplorationDependencies(): ExplorationRuntimeDependencies {
  return {
    generateWorldSegment: async (input, signal) => {
      if (signal.aborted) throw new Error("Deterministic segment generation was cancelled.");
      const generatedAt = now();
      const band = (layer: "L0" | "L1" | "L2") => ({
        nodes: Array.from({ length: 4 }, (_value, index) => ({
          title: `${input.seed} ${layer} ${input.segment.key} ${index + 1}`,
          confidence: 0.9,
          importance: 0.75,
          tags: ["e2e", layer],
        })),
      });
      return {
        status: "ok",
        seed: input.seed,
        segment: input.segment,
        bands: { L0: band("L0"), L1: band("L1"), L2: band("L2"), L3: { nodes: [] } },
        source_candidates: [{
          title: `${input.seed} source ${input.segment.key}`,
          url: `https://example.com/seekstar/${encodeURIComponent(input.segment.key)}`,
          snippet: "Deterministic source candidate for the Electron baseline smoke.",
          provider_id: "e2e-fixture",
          source_type: "webpage",
          confidence: 0.95,
        }],
        diagnostics: [],
        provider_id: "e2e-fixture",
        model: "deterministic-world-segment",
        generated_at: generatedAt,
      };
    },
    runScoutPlan: async (request) => {
      const retrievedAt = now();
      const url = request.plan.candidate_queries[0] ?? "https://example.com/seekstar";
      return {
        adapter: "playwright",
        completed_at: retrievedAt,
        observations: [{
          id: `e2e-observation:${request.plan.id}`,
          tab_id: request.tab_id,
          status: "observed",
          adapter: "playwright",
          layer: "L3",
          discovery_mode: "direct_url",
          provider_id: "e2e-fixture",
          provider_kind: "browser_observer",
          confidence: 0.99,
          query: url,
          title: request.plan.title,
          plan_id: request.plan.id,
          target_node_ids: request.plan.target_node_ids,
          url,
          snippet: "Observed deterministic E2E source.",
          source_type: "webpage",
          retrieved_at: retrievedAt,
          source_snapshot: {
            url,
            final_url: url,
            title: request.plan.title,
            visible_text: "SeekStar deterministic source observation.",
            excerpt: "SeekStar deterministic source observation.",
            outlinks: [],
            media: [],
            source_type: "webpage",
            retrieved_at: retrievedAt,
          },
          created_at: retrievedAt,
          updated_at: retrievedAt,
        }],
      };
    },
  };
}

function createDefaultViewCheckpoint(tabId: string): ExplorationViewCheckpoint {
  return {
    tab_id: tabId,
    view_revision: 0,
    view: {
      camera: { x: 0, y: 0, zoom: 1, layer: "L0" },
      selected_node_ids: [],
      browser_absorption: { status: "idle", exit_layer: "L3" },
    },
    updated_at: now(),
  };
}

function createEmptySegment(x: number, y: number): WorldSegment {
  return { key: segmentKey(x, y), chunk_x: x, chunk_y: y, revision: 0, phase: "queued", nodes: [], relations: [], source_candidates: [], attempts: 0, updated_at: now() };
}

function createSource(candidate: ScoutObservation): SourceRef {
  const snapshot = candidate.source_snapshot!;
  return {
    id: `source:${slug(snapshot.final_url || snapshot.url)}`,
    url: snapshot.final_url || snapshot.url,
    title: snapshot.title || candidate.title,
    source_type: snapshot.source_type,
    retrieved_at: snapshot.retrieved_at,
    snippet: snapshot.excerpt || candidate.snippet,
    reliability_hints: ["Observed by Scout"],
    created_from_observation_id: candidate.id,
    source_snapshot: snapshot,
  };
}

function createSourceNode(candidate: ScoutObservation, source: SourceRef): TerrainNode {
  return {
    id: `node:${source.id}`,
    type: "webpage",
    title: source.title,
    layer: "L3",
    source_state: "source_backed",
    confidence: candidate.confidence ?? 0.7,
    importance: 0.65,
    tags: ["exploration-world", "scout-verified"],
    source_id: source.id,
    source_url: source.url,
    source_title: source.title,
    source_type: source.source_type,
    retrieved_at: source.retrieved_at,
    position_hint: candidate.position_hint,
    parent_id: candidate.target_node_ids[0],
    can_create_seed: true,
    created_at: candidate.updated_at,
    updated_at: candidate.updated_at,
  };
}

function positionFor(segment: WorldSegment, layer: "L0" | "L1" | "L2" | "L3", index: number, count: number): { x: number; y: number } {
  const columns = Math.max(2, Math.ceil(Math.sqrt(Math.max(1, count))));
  const row = Math.floor(index / columns);
  const column = index % columns;
  const spacing = layer === "L0" ? 250 : layer === "L1" ? 190 : layer === "L2" ? 145 : 260;
  return {
    x: segment.chunk_x * CHUNK_WIDTH + Math.round((column - (columns - 1) / 2) * spacing),
    y: segment.chunk_y * CHUNK_HEIGHT + Math.round((row - (Math.ceil(count / columns) - 1) / 2) * spacing),
  };
}

function distance(node: TerrainNode, segment: WorldSegment): number {
  return Math.hypot((node.position_hint?.x ?? 0) - segment.chunk_x * CHUNK_WIDTH, (node.position_hint?.y ?? 0) - segment.chunk_y * CHUNK_HEIGHT);
}

function isTerminal(phase: WorldSegment["phase"]): boolean { return phase === "ready" || phase === "failed"; }
function segmentKey(x: number, y: number): string { return `${x}:${y}`; }
function now(): string { return new Date().toISOString(); }
function slug(value: string): string { return value.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 64) || randomUUID(); }
function getErrorMessage(error: unknown): string { return error instanceof Error ? error.message : String(error); }

function parseTabId(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) throw new Error("Exploration tab id is required.");
  return value;
}
function parseLeaseId(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) throw new Error("Exploration lease id is required.");
  return value;
}
function parseViewReport(value: unknown): { leaseId: string; viewRevision: number; view: ExplorationViewState } {
  if (!value || typeof value !== "object") throw new Error("Invalid exploration view report.");
  const input = value as { leaseId?: unknown; viewRevision?: unknown; view?: unknown };
  if (typeof input.leaseId !== "string" || typeof input.viewRevision !== "number" || !input.view || typeof input.view !== "object") throw new Error("Invalid exploration view report.");
  return { leaseId: input.leaseId, viewRevision: input.viewRevision, view: input.view as ExplorationViewState };
}
function parseCommandRequest(value: unknown): { leaseId: string; command: ExplorationCommand } {
  if (!value || typeof value !== "object") throw new Error("Invalid exploration command.");
  const input = value as { leaseId?: unknown; command?: unknown };
  if (typeof input.leaseId !== "string" || !input.command || typeof input.command !== "object" || !("type" in input.command)) throw new Error("Invalid exploration command.");
  return { leaseId: input.leaseId, command: input.command as ExplorationCommand };
}
