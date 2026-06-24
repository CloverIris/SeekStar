import type { ScoutObservation, ScoutPlan, SourceRef, TerrainNode, TerrainScene } from "@seekstar/core-schema";
import { applyExplorationEvent, type ExplorationEventResult } from "./events.js";
import type { ConstellationScoutPort } from "./ports.js";
import {
  createDirectUrlScoutPlan,
  createFailedScoutObservation,
  createFrontierScoutPlan,
  createPageOutlinksScoutPlan,
  positionAnchoredScoutObservations,
  positionFrontierObservations,
} from "./scoutPlanning.js";
import type { FrontierTrigger, ScoutObservationPlacement } from "./types.js";

export interface ScoutJobCoordinatorOptions {
  scout: ConstellationScoutPort;
}

export interface ScoutJobResult {
  observation?: ScoutObservation;
  observations: ScoutObservation[];
  scene: TerrainScene;
}

export interface HyperlinkSourceIntakeInput {
  parentBacklink: NonNullable<TerrainScene["tabs"][number]["parent_backlink"]>;
  scene: TerrainScene;
  tabId: string;
  url: string;
}

export interface HyperlinkSourceIntakeResult extends ScoutJobResult {
  sourceCandidate?: ScoutObservation;
}

export class ScoutJobCoordinator {
  constructor(private readonly options: ScoutJobCoordinatorOptions) {}

  async runPlan(input: {
    description?: string;
    placement?: ScoutObservationPlacement;
    plan: ScoutPlan;
    scene: TerrainScene;
    tabId: string;
  }): Promise<ScoutJobResult> {
    const timestamp = new Date().toISOString();

    try {
      const runResult = await this.options.scout.runPlan(input.tabId, input.plan);
      const observations = input.placement
        ? positionAnchoredScoutObservations(runResult.observations, input.scene, input.placement)
        : runResult.observations;
      const result = applyExplorationEvent(input.scene, {
        type: "scout.observations.appended",
        observations,
        viewport: input.placement
          ? {
              ...input.scene.viewport,
              x: input.placement.anchor.x,
              y: input.placement.anchor.y,
              layer: input.placement.layer,
              zoom: Math.max(input.scene.viewport.zoom, 1.2),
            }
          : undefined,
        description:
          input.description ??
          `${input.scene.metadata.title} now includes ${runResult.adapter} Scout observations. Observations are not source-backed terrain.`,
      });

      return {
        observation: observations[0],
        observations,
        scene: result.scene,
      };
    } catch (error) {
      const failedObservation = createFailedScoutObservation({
        tabId: input.tabId,
        plan: input.plan,
        title: `Scout adapter failed: ${input.plan.title}`,
        failureReason: getErrorMessage(error, "Scout adapter failed before producing observations."),
        timestamp,
      });
      const observations = input.placement
        ? positionAnchoredScoutObservations([failedObservation], input.scene, input.placement)
        : [failedObservation];
      const result = applyExplorationEvent(input.scene, {
        type: "scout.observations.appended",
        observations,
        description: `${input.scene.metadata.title} received a failed Scout adapter observation.`,
      });

      return {
        observation: observations[0],
        observations,
        scene: result.scene,
      };
    }
  }

  async runDirectUrl(input: {
    scene: TerrainScene;
    tabId: string;
    targetNodeIds: string[];
    url: string;
  }): Promise<ScoutJobResult> {
    const plan = createDirectUrlScoutPlan(input.url.trim(), input.targetNodeIds, new Date().toISOString());
    return this.runPlan({
      plan,
      scene: input.scene,
      tabId: input.tabId,
    });
  }

  async runSourceOutlinks(input: {
    node: TerrainNode;
    scene: TerrainScene;
    source: SourceRef;
    tabId: string;
  }): Promise<ScoutJobResult | undefined> {
    if (!input.source.url || input.node.source_state !== "source_backed") {
      return undefined;
    }

    const plan = createPageOutlinksScoutPlan(input.node.id, input.source.url, input.source.title, new Date().toISOString());
    const anchor = input.node.position_hint ?? { x: input.scene.viewport.x, y: input.scene.viewport.y };

    return this.runPlan({
      plan,
      scene: input.scene,
      tabId: input.tabId,
      placement: {
        anchor,
        discoveryMode: "page_outlinks",
        frontierId: `source-outlinks-${input.node.id}-${Date.now()}`,
        layer: input.node.layer,
        radius: 340,
      },
    });
  }

  async runFrontier(input: {
    scene: TerrainScene;
    tabId: string;
    trigger: FrontierTrigger;
  }): Promise<ScoutJobResult> {
    const createdAt = new Date().toISOString();
    const plan = createFrontierScoutPlan(input.scene, input.trigger, createdAt);

    try {
      const runResult = await this.options.scout.runPlan(input.tabId, plan);
      const observations = positionFrontierObservations(runResult.observations, input.scene, input.trigger);
      const result = applyExplorationEvent(input.scene, {
        type: "scout.observations.appended",
        observations,
        description: `${input.scene.metadata.title} discovered a ${input.trigger.layer} ${input.trigger.direction} frontier through Scout observations.`,
      });

      return {
        observation: observations[0],
        observations,
        scene: result.scene,
      };
    } catch (error) {
      const observations = positionFrontierObservations(
        [
          createFailedScoutObservation({
            tabId: input.tabId,
            plan,
            discoveryMode: "frontier_web_search",
            title: `Frontier Scout failed: ${input.trigger.direction}`,
            failureReason: getErrorMessage(error, "Frontier Scout failed before producing observations."),
            timestamp: createdAt,
            suffix: input.trigger.id,
          }),
        ],
        input.scene,
        input.trigger,
      );
      const result = applyExplorationEvent(input.scene, {
        type: "scout.observations.appended",
        observations,
      });

      return {
        observation: observations[0],
        observations,
        scene: result.scene,
      };
    }
  }

  async ingestHyperlinkSource(input: HyperlinkSourceIntakeInput): Promise<HyperlinkSourceIntakeResult> {
    const scoutPlan = createDirectUrlScoutPlan(input.url, [], new Date().toISOString());
    const runResult = await this.options.scout.runPlan(input.tabId, scoutPlan);
    const appended = applyExplorationEvent(input.scene, {
      type: "scout.observations.appended",
      observations: runResult.observations,
      description: `${input.scene.metadata.title} received direct hyperlink Scout observations.`,
    }).scene;
    const sourceCandidate = findSourceCandidate(runResult.observations);
    const scene = sourceCandidate
      ? applyExplorationEvent(appended, {
          type: "source.snapshot.ingested",
          input: {
            title: sourceCandidate.title,
            url: sourceCandidate.url ?? input.url,
            body: sourceCandidate.snippet ?? sourceCandidate.query,
            sourceType: sourceCandidate.source_type,
            retrievedAt: sourceCandidate.retrieved_at,
            reliabilityHints: [
              "observed by Playwright Scout adapter",
              "opened from absorbed tile hyperlink",
              `Scout status: ${sourceCandidate.status.replace("_", " ")}`,
            ],
            tags: ["scout-observation", "hyperlink", "source-backed-tab"],
            createdFrom: input.parentBacklink,
            observationId: sourceCandidate.id,
            initialLayer: "L3",
          },
        }).scene
      : appended;

    return {
      observation: runResult.observations[0],
      observations: runResult.observations,
      scene,
      sourceCandidate,
    };
  }

  convertObservationToSource(input: {
    activeTabIdForConversion: string;
    observation: ScoutObservation;
    scene: TerrainScene;
  }): ExplorationEventResult | undefined {
    if (input.observation.status !== "source_candidate" && input.observation.status !== "observed") {
      return undefined;
    }

    return applyExplorationEvent(input.scene, {
      type: "source.snapshot.ingested",
      input: {
        title: input.observation.title,
        url: input.observation.url,
        body: input.observation.snippet ?? input.observation.query,
        sourceType: input.observation.source_type,
        retrievedAt: input.observation.retrieved_at,
        reliabilityHints: [
          "user-confirmed Scout observation",
          input.observation.adapter === "playwright"
            ? "observed by Playwright Scout adapter"
            : "non-Playwright Scout observation",
          `Scout status: ${input.observation.status.replace("_", " ")}`,
        ],
        tags: ["scout-observation"],
        createdFrom: {
          tab_id: input.activeTabIdForConversion,
          node_id: input.observation.target_node_ids[0],
          label: `Scout observation: ${input.observation.title}`,
          excerpt: input.observation.snippet ?? input.observation.query,
        },
        observationId: input.observation.id,
      },
    });
  }
}

function findSourceCandidate(observations: ScoutObservation[]): ScoutObservation | undefined {
  return observations.find((observation) => observation.status === "source_candidate" || observation.status === "observed");
}

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}
