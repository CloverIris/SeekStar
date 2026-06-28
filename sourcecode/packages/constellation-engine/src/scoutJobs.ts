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

export interface DirectUrlSourceIntakeInput {
  createdFrom?: NonNullable<TerrainScene["tabs"][number]["parent_backlink"]>;
  pendingObservationId?: string;
  reliabilityHints?: string[];
  scene: TerrainScene;
  tabId: string;
  tags?: string[];
  targetNodeIds?: string[];
  title?: string;
  url: string;
}

export interface DirectUrlSourceIntakeResult extends ScoutJobResult {
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

  async ingestDirectUrlSource(input: DirectUrlSourceIntakeInput): Promise<DirectUrlSourceIntakeResult> {
    const url = input.url.trim();
    const scoutPlan = createDirectUrlScoutPlan(url, input.targetNodeIds ?? [], new Date().toISOString());
    const scoutResult = await this.runPlan({
      plan: scoutPlan,
      scene: input.scene,
      tabId: input.tabId,
      description: `${input.scene.metadata.title} received direct URL Scout observations.`,
    });
    const sourceCandidate = findSourceCandidate(scoutResult.observations);
    const scoutScene = input.pendingObservationId
      ? updateScoutObservationStatus(scoutResult.scene, input.pendingObservationId, sourceCandidate ? "converted" : "duplicate")
      : scoutResult.scene;

    if (!sourceCandidate) {
      return {
        ...scoutResult,
        scene: scoutScene,
        sourceCandidate,
      };
    }

    const result = applyExplorationEvent(scoutScene, {
      type: "source.snapshot.ingested",
      input: {
        title: input.title?.trim() || sourceCandidate.title,
        url: sourceCandidate.url ?? url,
        body: sourceCandidate.source_snapshot?.visible_text ?? sourceCandidate.snippet ?? sourceCandidate.query,
        snapshot: sourceCandidate.source_snapshot,
        sourceType: sourceCandidate.source_type,
        retrievedAt: sourceCandidate.source_snapshot?.retrieved_at ?? sourceCandidate.retrieved_at,
        reliabilityHints: createDirectUrlReliabilityHints(sourceCandidate, input.reliabilityHints ?? ["opened from direct URL command"]),
        tags: input.tags ?? ["scout-observation", "direct-url", "source-backed-command"],
        createdFrom: input.createdFrom,
        observationId: sourceCandidate.id,
        initialLayer: "L3",
      },
    });

    return {
      observation: scoutResult.observation,
      observations: scoutResult.observations,
      scene: result.scene,
      sourceCandidate,
    };
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
    return this.ingestDirectUrlSource({
      createdFrom: input.parentBacklink,
      reliabilityHints: [
        "opened from absorbed tile hyperlink",
      ],
      scene: input.scene,
      tabId: input.tabId,
      tags: ["scout-observation", "hyperlink", "source-backed-tab"],
      url: input.url,
    });
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
        body: input.observation.source_snapshot?.visible_text ?? input.observation.snippet ?? input.observation.query,
        snapshot: input.observation.source_snapshot,
        sourceType: input.observation.source_type,
        retrievedAt: input.observation.source_snapshot?.retrieved_at ?? input.observation.retrieved_at,
        reliabilityHints: [
          "user-confirmed Scout observation",
          input.observation.adapter === "playwright"
            ? "observed by Playwright Scout adapter"
            : "non-Playwright Scout observation",
          `Scout status: ${input.observation.status.replace("_", " ")}`,
          input.observation.source_snapshot
            ? `${input.observation.source_snapshot.outlinks.length} outlinks and ${input.observation.source_snapshot.media.length} media candidates captured`
            : "structured source snapshot unavailable",
        ],
        tags: ["scout-observation"],
        createdFrom: {
          tab_id: input.activeTabIdForConversion,
          node_id: input.observation.target_node_ids[0],
          label: `Scout observation: ${input.observation.title}`,
          excerpt: input.observation.snippet ?? input.observation.query,
        },
        observationId: input.observation.id,
        initialLayer: "L3",
      },
    });
  }
}

function findSourceCandidate(observations: ScoutObservation[]): ScoutObservation | undefined {
  return observations.find((observation) => observation.status === "source_candidate" || observation.status === "observed");
}

function updateScoutObservationStatus(
  scene: TerrainScene,
  observationId: string,
  status: ScoutObservation["status"],
): TerrainScene {
  const observations = scene.scout_observations ?? [];

  if (!observations.some((observation) => observation.id === observationId)) {
    return scene;
  }

  const updatedAt = new Date().toISOString();

  return {
    ...scene,
    scout_observations: observations.map((observation) =>
      observation.id === observationId
        ? {
            ...observation,
            status,
            updated_at: updatedAt,
          }
        : observation,
    ),
    metadata: {
      ...scene.metadata,
      updated_at: updatedAt,
    },
    runtime: {
      ...scene.runtime,
      updated_at: updatedAt,
    },
  };
}

function createDirectUrlReliabilityHints(observation: ScoutObservation, extraHints: string[]): string[] {
  return [
    "observed by Playwright Scout adapter",
    ...extraHints,
    `Scout status: ${observation.status.replace("_", " ")}`,
    observation.source_snapshot
      ? `${observation.source_snapshot.outlinks.length} outlinks and ${observation.source_snapshot.media.length} media candidates captured`
      : "structured source snapshot unavailable",
  ];
}

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}
