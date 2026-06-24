import type {
  AgentJob,
  CartographerOutput,
  ScoutPlan,
  SourceRef,
  TerrainNode,
  TerrainPatch,
  TerrainRelation,
  TerrainScene,
} from "@seekstar/core-schema";

export type MockCartographerMode =
  | "region_explainer"
  | "source_distiller"
  | "web_scout_planner"
  | "layer_cartographer"
  | "question_generator"
  | "learning_path_mapper";

export interface MockCartographerRun {
  scene: TerrainScene;
  output?: CartographerOutput;
  focusNodeId?: string;
}

export interface MockCartographerJobDraft {
  job: AgentJob;
}

let jobCounter = 0;

export function createMockCartographerJob(scene: TerrainScene, mode: MockCartographerMode, targetNodes: TerrainNode[]): MockCartographerJobDraft | undefined {
  if (targetNodes.length === 0) {
    return undefined;
  }

  jobCounter += 1;

  const createdAt = new Date().toISOString();
  const slug = toSlug(`${mode}-${targetNodes[0].title}`);
  const stamp = `${Date.now()}-${jobCounter}`;
  const jobId = `job-${slug}-${stamp}`;
  const targetNodeIds = targetNodes.map((node) => node.id);
  const targetSourceIds = Array.from(new Set(targetNodes.map((node) => node.source_id).filter((id): id is string => Boolean(id))));
  const job: AgentJob = {
    id: jobId,
    tab_id: scene.active_tab_id,
    mode,
    status: "queued",
    input_summary: createInputSummary(mode, targetNodes),
    title: createOutputTitle(mode, targetNodes),
    progress: 0,
    target_node_ids: targetNodeIds,
    target_source_ids: targetSourceIds,
    created_at: createdAt,
    updated_at: createdAt,
  };

  return {
    job,
  };
}

export function enqueueMockCartographerJob(scene: TerrainScene, job: AgentJob): TerrainScene {
  return {
    ...scene,
    agent_jobs: [...scene.agent_jobs, job],
    metadata: {
      ...scene.metadata,
      updated_at: job.updated_at,
    },
  };
}

export function updateMockCartographerJob(scene: TerrainScene, jobId: string, patch: Partial<AgentJob>): TerrainScene {
  const updatedAt = new Date().toISOString();

  return {
    ...scene,
    agent_jobs: scene.agent_jobs.map((job) =>
      job.id === jobId
        ? {
            ...job,
            ...patch,
            updated_at: updatedAt,
          }
        : job,
    ),
    metadata: {
      ...scene.metadata,
      updated_at: updatedAt,
    },
  };
}

export function completeMockCartographerJob(scene: TerrainScene, jobId: string): MockCartographerRun | undefined {
  const existingJob = scene.agent_jobs.find((job) => job.id === jobId);

  if (!existingJob || existingJob.status === "cancelled" || existingJob.status === "failed") {
    return undefined;
  }

  if (!isMockCartographerMode(existingJob.mode)) {
    return undefined;
  }

  const targetNodes = (existingJob.target_node_ids ?? [])
    .map((nodeId) => scene.nodes.find((node) => node.id === nodeId))
    .filter((node): node is TerrainNode => Boolean(node));

  if (targetNodes.length === 0) {
    return {
      scene: updateMockCartographerJob(scene, jobId, {
        status: "failed",
        progress: 1,
        error_message: "Target terrain disappeared before the mock cartographer could complete.",
      }),
    };
  }

  const createdAt = new Date().toISOString();
  const stamp = existingJob.id.replace(/^job-/, "");
  const outputId = `cartographer-output-${stamp}`;
  const patch = createPatchForMode(scene, existingJob.mode, targetNodes, stamp);
  const scoutPlan = existingJob.mode === "web_scout_planner" ? createScoutPlan(targetNodes, createdAt, stamp) : undefined;
  const outputNodeIds = patch.nodes.map((node) => node.id);
  const output: CartographerOutput = {
    id: outputId,
    job_id: existingJob.id,
    tab_id: scene.active_tab_id,
    mode: existingJob.mode,
    title: existingJob.title ?? createOutputTitle(existingJob.mode, targetNodes),
    summary: createOutputSummary(existingJob.mode, targetNodes),
    source_state: existingJob.mode === "web_scout_planner" ? "weak_hypothesis" : "generated",
    target_node_ids: existingJob.target_node_ids ?? [],
    target_source_ids: existingJob.target_source_ids ?? [],
    notes: createOutputNotes(existingJob.mode, targetNodes),
    patch,
    scout_plan: scoutPlan,
    created_at: createdAt,
  };
  const completedJob: AgentJob = {
    ...existingJob,
    status: "completed",
    progress: 1,
    output_ids: [output.id],
    updated_at: createdAt,
  };
  const nextScene = applyCartographerOutput(scene, completedJob, output, patch, createdAt);

  return {
    scene: nextScene,
    output,
    focusNodeId: outputNodeIds[0],
  };
}

function applyCartographerOutput(
  scene: TerrainScene,
  job: AgentJob,
  output: CartographerOutput,
  patch: TerrainPatch,
  updatedAt: string,
): TerrainScene {
  const activeTab = scene.tabs.find((tab) => tab.id === scene.active_tab_id);
  const nextNodeIds = patch.nodes.map((node) => node.id);
  const nextRelationIds = patch.relations.map((relation) => relation.id);
  const nextSourceIds = patch.sources.map((source) => source.id);

  return {
    ...scene,
    nodes: [...scene.nodes, ...patch.nodes],
    relations: [...scene.relations, ...patch.relations],
    sources: [...scene.sources, ...patch.sources],
    agent_jobs: scene.agent_jobs.map((existingJob) => (existingJob.id === job.id ? job : existingJob)),
    cartographer_outputs: [...(scene.cartographer_outputs ?? []), output],
    tabs: scene.tabs.map((tab) =>
      tab.id === scene.active_tab_id
        ? {
            ...tab,
            node_ids: [...tab.node_ids, ...nextNodeIds],
            relation_ids: [...tab.relation_ids, ...nextRelationIds],
            source_ids: [...tab.source_ids, ...nextSourceIds],
            updated_at: updatedAt,
          }
        : tab,
    ),
    metadata: {
      ...scene.metadata,
      updated_at: updatedAt,
      description: activeTab
        ? `${activeTab.title} now includes local mock cartographer outputs. Generated and inferred terrain remains marked.`
        : scene.metadata.description,
    },
  };
}

function createPatchForMode(scene: TerrainScene, mode: MockCartographerMode, targetNodes: TerrainNode[], stamp: string): TerrainPatch {
  if (mode === "source_distiller") {
    return createSourceDistillerPatch(scene, targetNodes[0], stamp);
  }

  if (mode === "web_scout_planner") {
    return createScoutPlannerPatch(scene, targetNodes[0], stamp);
  }

  if (mode === "layer_cartographer") {
    return createLayerCartographerPatch(scene, targetNodes[0], stamp);
  }

  if (mode === "question_generator") {
    return createQuestionGeneratorPatch(scene, targetNodes, stamp);
  }

  if (mode === "learning_path_mapper") {
    return createLearningPathPatch(scene, targetNodes, stamp);
  }

  return createRegionExplainerPatch(scene, targetNodes, stamp);
}

function createRegionExplainerPatch(scene: TerrainScene, targetNodes: TerrainNode[], stamp: string): TerrainPatch {
  const anchor = getAverageAnchor(scene, targetNodes);
  const title = targetNodes.length === 1 ? targetNodes[0].title : `${targetNodes[0].title} region`;
  const nodeId = `node-region-note-${stamp}`;
  const now = new Date().toISOString();
  const noteNode: TerrainNode = {
    id: nodeId,
    type: "generated_summary",
    title: `Region note: ${title}`,
    layer: "L2",
    source_state: "generated",
    confidence: 0.58,
    importance: 0.66,
    tags: ["cartographer-output", "region-explainer", "mock-generated"],
    summary:
      "Mock structured explanation for a spatial selection. It orients the selected terrain without claiming new factual evidence.",
    position_hint: {
      x: anchor.x + 260,
      y: anchor.y - 80,
    },
    created_at: now,
    updated_at: now,
  };
  const relations = targetNodes.map<TerrainRelation>((node, index) => ({
    id: `rel-region-note-${index + 1}-${stamp}`,
    from: node.id,
    to: noteNode.id,
    type: "agent_inferred",
    confidence: 0.5,
    explanation: "Mock region explainer linked this selected terrain node to a generated orientation note.",
    source_state: "agent_inferred",
  }));

  return {
    nodes: [noteNode],
    relations,
    sources: [],
  };
}

function createSourceDistillerPatch(scene: TerrainScene, sourceNode: TerrainNode, stamp: string): TerrainPatch {
  const anchor = sourceNode.position_hint ?? getAverageAnchor(scene, [sourceNode]);
  const now = new Date().toISOString();
  const source = findSourceForNode(scene, sourceNode);
  const summaryId = `node-source-distill-summary-${stamp}`;
  const questionId = `node-source-distill-question-${stamp}`;
  const fogId = `node-source-distill-fog-${stamp}`;
  const sourceTitle = source?.title ?? sourceNode.source_title ?? sourceNode.title;
  const nodes: TerrainNode[] = [
    {
      id: summaryId,
      type: "generated_summary",
      title: `Generated source orientation: ${sourceTitle}`,
      layer: "L3",
      source_state: "generated",
      confidence: 0.54,
      importance: 0.68,
      tags: ["cartographer-output", "source-distiller", "mock-generated"],
      summary:
        "Mock source distillation summary. It is derived from visible source metadata and excerpts, not from a real model call.",
      source_id: source?.id ?? sourceNode.source_id,
      source_url: source?.url ?? sourceNode.source_url,
      source_title: sourceTitle,
      source_type: source?.source_type ?? sourceNode.source_type,
      position_hint: {
        x: anchor.x + 280,
        y: anchor.y - 120,
      },
      created_at: now,
      updated_at: now,
    },
    {
      id: questionId,
      type: "question",
      title: `What adjacent context would clarify ${sourceTitle}?`,
      layer: "L2",
      source_state: "agent_inferred",
      confidence: 0.48,
      importance: 0.56,
      tags: ["cartographer-output", "generated-question", "mock-inferred"],
      summary: "A generated question node for deciding the next map direction around this source.",
      source_id: source?.id ?? sourceNode.source_id,
      source_title: sourceTitle,
      can_create_seed: true,
      created_from: createCreatedFromRef(scene, sourceNode, `Source-distiller question from ${sourceTitle}`),
      position_hint: {
        x: anchor.x + 520,
        y: anchor.y,
      },
      created_at: now,
      updated_at: now,
    },
    {
      id: fogId,
      type: "fog_region",
      title: `Unverified context around ${sourceTitle}`,
      layer: "L2",
      source_state: "fog",
      confidence: 0.24,
      importance: 0.46,
      tags: ["cartographer-output", "source-gap", "fog"],
      summary: "A visible unknown region. It marks where future scout work may look, without pretending facts are known.",
      source_id: source?.id ?? sourceNode.source_id,
      source_title: sourceTitle,
      position_hint: {
        x: anchor.x + 520,
        y: anchor.y + 140,
      },
      created_at: now,
      updated_at: now,
    },
  ];
  const relations: TerrainRelation[] = [
    {
      id: `rel-source-distill-summary-${stamp}`,
      from: sourceNode.id,
      to: summaryId,
      type: "agent_inferred",
      confidence: 0.52,
      explanation: "Mock source distiller generated an orientation summary from source metadata and visible excerpts.",
      source_state: "agent_inferred",
    },
    {
      id: `rel-source-distill-question-${stamp}`,
      from: summaryId,
      to: questionId,
      type: "agent_inferred",
      confidence: 0.46,
      explanation: "Mock source distiller proposed a next exploration question.",
      source_state: "agent_inferred",
    },
    {
      id: `rel-source-distill-fog-${stamp}`,
      from: questionId,
      to: fogId,
      type: "agent_inferred",
      confidence: 0.34,
      explanation: "The generated question exposes an unverified source gap as fog.",
      source_state: "weak_hypothesis",
    },
  ];

  return {
    nodes,
    relations,
    sources: [],
  };
}

function createScoutPlannerPatch(scene: TerrainScene, fogNode: TerrainNode, stamp: string): TerrainPatch {
  const anchor = fogNode.position_hint ?? getAverageAnchor(scene, [fogNode]);
  const now = new Date().toISOString();
  const queryNodeId = `node-scout-plan-question-${stamp}`;
  const nodes: TerrainNode[] = [
    {
      id: queryNodeId,
      type: "question",
      title: `Scout plan for ${fogNode.title}`,
      layer: "L2",
      source_state: "weak_hypothesis",
      confidence: 0.36,
      importance: 0.55,
      tags: ["cartographer-output", "scout-plan", "mock-only"],
      summary:
        "Mock scout planner output. It proposes where Playwright could observe later, but no retrieval has happened.",
      can_create_seed: true,
      created_from: createCreatedFromRef(scene, fogNode, `Scout-plan question from ${fogNode.title}`),
      position_hint: {
        x: anchor.x + 280,
        y: anchor.y,
      },
      created_at: now,
      updated_at: now,
    },
  ];
  const relations: TerrainRelation[] = [
    {
      id: `rel-scout-plan-${stamp}`,
      from: fogNode.id,
      to: queryNodeId,
      type: "agent_inferred",
      confidence: 0.34,
      explanation: "Mock web scout planner translated a fog region into candidate scout directions without retrieval.",
      source_state: "weak_hypothesis",
    },
  ];

  return {
    nodes,
    relations,
    sources: [],
  };
}

function createLayerCartographerPatch(scene: TerrainScene, targetNode: TerrainNode, stamp: string): TerrainPatch {
  const anchor = targetNode.position_hint ?? getAverageAnchor(scene, [targetNode]);
  const now = new Date().toISOString();
  const layer = targetNode.layer;
  const routeId = `node-layer-route-${stamp}`;
  const questionId = `node-layer-question-${stamp}`;
  const fogId = `node-layer-fog-${stamp}`;
  const targetTitle = targetNode.title;
  const nodes: TerrainNode[] = [
    {
      id: routeId,
      type: "subtopic",
      title: `Adjacent route: ${targetTitle}`,
      layer,
      source_state: "weak_hypothesis",
      confidence: 0.4,
      importance: 0.56,
      tags: ["cartographer-output", "layer-cartographer", "adjacent-route", "mock-only"],
      summary:
        "A mock neighboring path proposed by the layer cartographer. It is an orientation route, not verified knowledge.",
      parent_id: targetNode.parent_id,
      can_create_seed: true,
      created_from: createCreatedFromRef(scene, targetNode, `Adjacent route from ${targetTitle}`),
      position_hint: {
        x: anchor.x + 280,
        y: anchor.y - 130,
      },
      created_at: now,
      updated_at: now,
    },
    {
      id: questionId,
      type: "question",
      title: `What should be asked near ${targetTitle}?`,
      layer,
      source_state: "agent_inferred",
      confidence: 0.46,
      importance: 0.62,
      tags: ["cartographer-output", "layer-cartographer", "generated-question", "mock-inferred"],
      summary:
        "A generated question that helps the user orient around an edge of the current map before knowing the right prompt.",
      parent_id: targetNode.id,
      can_create_seed: true,
      created_from: createCreatedFromRef(scene, targetNode, `Layer question from ${targetTitle}`),
      position_hint: {
        x: anchor.x + 520,
        y: anchor.y,
      },
      created_at: now,
      updated_at: now,
    },
    {
      id: fogId,
      type: "fog_region",
      title: `Unmapped edge around ${targetTitle}`,
      layer,
      source_state: "fog",
      confidence: 0.22,
      importance: 0.5,
      tags: ["cartographer-output", "layer-cartographer", "fog", "unknown-unknown"],
      summary:
        "A visible unknown area created by mock layer mapping. It marks a promising edge without fabricating source-backed facts.",
      parent_id: targetNode.id,
      can_create_seed: true,
      created_from: createCreatedFromRef(scene, targetNode, `Layer fog edge from ${targetTitle}`),
      position_hint: {
        x: anchor.x + 520,
        y: anchor.y + 145,
      },
      created_at: now,
      updated_at: now,
    },
  ];
  const relations: TerrainRelation[] = [
    {
      id: `rel-layer-route-${stamp}`,
      from: targetNode.id,
      to: routeId,
      type: "agent_inferred",
      confidence: 0.38,
      explanation: "Mock layer cartographer proposed a nearby route from the selected terrain node.",
      source_state: "weak_hypothesis",
    },
    {
      id: `rel-layer-question-${stamp}`,
      from: routeId,
      to: questionId,
      type: "agent_inferred",
      confidence: 0.42,
      explanation: "Mock layer cartographer converted the route into a generated next question.",
      source_state: "agent_inferred",
    },
    {
      id: `rel-layer-fog-${stamp}`,
      from: questionId,
      to: fogId,
      type: "agent_inferred",
      confidence: 0.3,
      explanation: "The generated question exposes an unmapped edge as fog rather than as a fact.",
      source_state: "fog",
    },
  ];

  return {
    nodes,
    relations,
    sources: [],
  };
}

function createQuestionGeneratorPatch(scene: TerrainScene, targetNodes: TerrainNode[], stamp: string): TerrainPatch {
  const anchor = getAverageAnchor(scene, targetNodes);
  const now = new Date().toISOString();
  const layer = scene.viewport.layer;
  const title = targetNodes.length === 1 ? targetNodes[0].title : `${targetNodes[0].title} region`;
  const questionNodes: TerrainNode[] = [
    {
      id: `node-question-invisible-${stamp}`,
      type: "question",
      title: `What is still invisible around ${title}?`,
      layer,
      source_state: "agent_inferred",
      confidence: 0.44,
      importance: 0.68,
      tags: ["cartographer-output", "generated-question", "question-generator", "mock-inferred"],
      summary:
        "A generated orientation question for finding unknown unknowns near the selected terrain. It is not an answer or a fact.",
      can_create_seed: true,
      created_from: createCreatedFromRef(scene, targetNodes[0], `Generated question from ${title}`),
      position_hint: {
        x: anchor.x + 300,
        y: anchor.y - 170,
      },
      created_at: now,
      updated_at: now,
    },
    {
      id: `node-question-source-${stamp}`,
      type: "question",
      title: `Which source would change this map?`,
      layer,
      source_state: "weak_hypothesis",
      confidence: 0.36,
      importance: 0.58,
      tags: ["cartographer-output", "generated-question", "source-gap", "mock-only"],
      summary:
        "A weak source-readiness question. It points toward evidence needs without claiming that evidence has been retrieved.",
      can_create_seed: true,
      created_from: createCreatedFromRef(scene, targetNodes[0], `Source-readiness question from ${title}`),
      position_hint: {
        x: anchor.x + 520,
        y: anchor.y,
      },
      created_at: now,
      updated_at: now,
    },
    {
      id: `node-question-seed-${stamp}`,
      type: "question",
      title: `What term here could become a new seed?`,
      layer,
      source_state: "agent_inferred",
      confidence: 0.42,
      importance: 0.6,
      tags: ["cartographer-output", "generated-question", "seed-candidate", "mock-inferred"],
      summary:
        "A generated seed-discovery question that keeps the user in exploration mode rather than forcing a single prompt.",
      can_create_seed: true,
      created_from: createCreatedFromRef(scene, targetNodes[0], `Seed-discovery question from ${title}`),
      position_hint: {
        x: anchor.x + 300,
        y: anchor.y + 170,
      },
      created_at: now,
      updated_at: now,
    },
  ];
  const relations: TerrainRelation[] = questionNodes.map((questionNode, index) => ({
    id: `rel-generated-question-${index + 1}-${stamp}`,
    from: targetNodes[index % targetNodes.length].id,
    to: questionNode.id,
    type: "agent_inferred",
    confidence: 0.38,
    explanation: "Mock question generator turned selected terrain into a next exploration question.",
    source_state: questionNode.source_state,
  }));

  return {
    nodes: questionNodes,
    relations,
    sources: [],
  };
}

function createLearningPathPatch(scene: TerrainScene, targetNodes: TerrainNode[], stamp: string): TerrainPatch {
  const anchor = getAverageAnchor(scene, targetNodes);
  const now = new Date().toISOString();
  const layer = scene.viewport.layer;
  const title = targetNodes.length === 1 ? targetNodes[0].title : `${targetNodes[0].title} region`;
  const pathId = `node-learning-path-${stamp}`;
  const stepOneId = `node-learning-path-orient-${stamp}`;
  const stepTwoId = `node-learning-path-evidence-${stamp}`;
  const stepThreeId = `node-learning-path-fog-${stamp}`;
  const fogId = `node-learning-path-fog-region-${stamp}`;
  const nodes: TerrainNode[] = [
    {
      id: pathId,
      type: "generated_summary",
      title: `Learning path: ${title}`,
      layer,
      source_state: "generated",
      confidence: 0.48,
      importance: 0.7,
      tags: ["cartographer-output", "learning-path", "mock-generated"],
      summary:
        "A mock learning path card. It sequences orientation moves over the selected terrain without claiming new factual content.",
      can_create_seed: true,
      created_from: createCreatedFromRef(scene, targetNodes[0], `Learning path from ${title}`),
      position_hint: {
        x: anchor.x + 280,
        y: anchor.y - 210,
      },
      created_at: now,
      updated_at: now,
    },
    {
      id: stepOneId,
      type: "subtopic",
      title: "1 · Orient the field",
      layer,
      source_state: "agent_inferred",
      confidence: 0.44,
      importance: 0.58,
      tags: ["cartographer-output", "learning-path-step", "orientation", "mock-inferred"],
      summary: "Start by naming the visible concepts, source states, and fog edges in this region.",
      can_create_seed: true,
      created_from: createCreatedFromRef(scene, targetNodes[0], `Learning-path orientation from ${title}`),
      position_hint: {
        x: anchor.x + 520,
        y: anchor.y - 130,
      },
      created_at: now,
      updated_at: now,
    },
    {
      id: stepTwoId,
      type: "question",
      title: "2 · Ask for evidence",
      layer,
      source_state: "weak_hypothesis",
      confidence: 0.36,
      importance: 0.56,
      tags: ["cartographer-output", "learning-path-step", "source-readiness", "mock-only"],
      summary: "Identify what would need a real source before this terrain could be trusted as factual.",
      can_create_seed: true,
      created_from: createCreatedFromRef(scene, targetNodes[0], `Learning-path evidence question from ${title}`),
      position_hint: {
        x: anchor.x + 640,
        y: anchor.y + 20,
      },
      created_at: now,
      updated_at: now,
    },
    {
      id: stepThreeId,
      type: "question",
      title: "3 · Follow the unknown edge",
      layer,
      source_state: "agent_inferred",
      confidence: 0.4,
      importance: 0.62,
      tags: ["cartographer-output", "learning-path-step", "unknown-unknown", "mock-inferred"],
      summary: "Choose an adjacent fog region or generated question as the next exploration direction.",
      can_create_seed: true,
      created_from: createCreatedFromRef(scene, targetNodes[0], `Learning-path unknown edge from ${title}`),
      position_hint: {
        x: anchor.x + 520,
        y: anchor.y + 170,
      },
      created_at: now,
      updated_at: now,
    },
    {
      id: fogId,
      type: "fog_region",
      title: `Learning gap around ${title}`,
      layer,
      source_state: "fog",
      confidence: 0.22,
      importance: 0.5,
      tags: ["cartographer-output", "learning-path", "fog", "mock-only"],
      summary: "A mock fog region that makes unresolved learning context visible instead of inventing a conclusion.",
      can_create_seed: true,
      created_from: createCreatedFromRef(scene, targetNodes[0], `Learning-path fog from ${title}`),
      position_hint: {
        x: anchor.x + 760,
        y: anchor.y + 170,
      },
      created_at: now,
      updated_at: now,
    },
  ];
  const relations: TerrainRelation[] = [
    {
      id: `rel-learning-path-anchor-${stamp}`,
      from: targetNodes[0].id,
      to: pathId,
      type: "agent_inferred",
      confidence: 0.4,
      explanation: "Mock learning path mapper anchored the path to selected terrain.",
      source_state: "agent_inferred",
    },
    {
      id: `rel-learning-path-step-1-${stamp}`,
      from: pathId,
      to: stepOneId,
      type: "prerequisite",
      confidence: 0.42,
      explanation: "Orientation precedes evidence checking in the mock learning path.",
      source_state: "agent_inferred",
    },
    {
      id: `rel-learning-path-step-2-${stamp}`,
      from: stepOneId,
      to: stepTwoId,
      type: "prerequisite",
      confidence: 0.36,
      explanation: "The path asks for source readiness before treating generated terrain as factual.",
      source_state: "weak_hypothesis",
    },
    {
      id: `rel-learning-path-step-3-${stamp}`,
      from: stepTwoId,
      to: stepThreeId,
      type: "chronological_sequence",
      confidence: 0.38,
      explanation: "After evidence readiness, the path returns to exploration through unknown edges.",
      source_state: "agent_inferred",
    },
    {
      id: `rel-learning-path-fog-${stamp}`,
      from: stepThreeId,
      to: fogId,
      type: "agent_inferred",
      confidence: 0.28,
      explanation: "The final step exposes unresolved learning context as fog, not as a conclusion.",
      source_state: "fog",
    },
  ];

  return {
    nodes,
    relations,
    sources: [],
  };
}

function createScoutPlan(targetNodes: TerrainNode[], createdAt: string, stamp: string): ScoutPlan {
  const targetTitle = targetNodes[0].title;

  return {
    id: `scout-plan-${stamp}`,
    title: `Scout directions for ${targetTitle}`,
    target_node_ids: targetNodes.map((node) => node.id),
    candidate_queries: [`${targetTitle} overview`, `${targetTitle} source evidence`, `${targetTitle} open questions`],
    source_type_targets: ["article", "webpage", "document"],
    priority: "medium",
    stop_conditions: ["Stop after three distinct source perspectives", "Stop if all candidates duplicate existing source titles"],
    deduplication_notes: ["Prefer sources with different publishers, dates, or document types."],
    created_at: createdAt,
  };
}

function createOutputTitle(mode: MockCartographerMode, targetNodes: TerrainNode[]): string {
  const title = targetNodes.length === 1 ? targetNodes[0].title : `${targetNodes[0].title} + ${targetNodes.length - 1} nearby`;

  if (mode === "source_distiller") {
    return `Mock source distillation: ${title}`;
  }

  if (mode === "web_scout_planner") {
    return `Mock scout plan: ${title}`;
  }

  if (mode === "layer_cartographer") {
    return `Mock adjacent paths: ${title}`;
  }

  if (mode === "question_generator") {
    return `Mock question set: ${title}`;
  }

  if (mode === "learning_path_mapper") {
    return `Mock learning path: ${title}`;
  }

  return `Mock region explanation: ${title}`;
}

function createOutputSummary(mode: MockCartographerMode, targetNodes: TerrainNode[]): string {
  const nodeCount = targetNodes.length;

  if (mode === "source_distiller") {
    return "Structured source-distiller output over existing local source terrain. It does not call AI or fetch the web.";
  }

  if (mode === "web_scout_planner") {
    return "Structured scout plan for future Playwright observation. It is a plan, not retrieved evidence.";
  }

  if (mode === "layer_cartographer") {
    return "Structured layer-cartographer output that turns a selected map edge into generated questions, weak routes, and fog.";
  }

  if (mode === "question_generator") {
    return "Structured question-generator output that turns selected terrain into generated next-question nodes.";
  }

  if (mode === "learning_path_mapper") {
    return "Structured learning-path output that sequences orientation, evidence readiness, and fog-following as terrain.";
  }

  return `${nodeCount} selected terrain node${nodeCount === 1 ? "" : "s"} converted into a generated cartographer orientation note.`;
}

function createOutputNotes(mode: MockCartographerMode, targetNodes: TerrainNode[]): string[] {
  const stateSummary = Array.from(new Set(targetNodes.map((node) => node.source_state))).join(", ");

  if (mode === "web_scout_planner") {
    return ["No Playwright task was run.", "Candidate queries are weak hypotheses until sources are observed.", `Target states: ${stateSummary}.`];
  }

  if (mode === "source_distiller") {
    return ["No model call was run.", "Generated summary and question nodes must remain visually marked.", `Target states: ${stateSummary}.`];
  }

  if (mode === "layer_cartographer") {
    return [
      "No model call was run.",
      "Adjacent paths are orientation terrain, not verified source-backed facts.",
      `Target states: ${stateSummary}.`,
    ];
  }

  if (mode === "question_generator") {
    return [
      "No model call was run.",
      "Generated questions are next exploration prompts, not answers.",
      `Target states: ${stateSummary}.`,
    ];
  }

  if (mode === "learning_path_mapper") {
    return [
      "No model call was run.",
      "The learning path is a mock orientation sequence and does not verify factual claims.",
      `Target states: ${stateSummary}.`,
    ];
  }

  return ["No chat transcript was created.", "The selection remains a spatial prompt.", `Target states: ${stateSummary}.`];
}

function createInputSummary(mode: MockCartographerMode, targetNodes: TerrainNode[]): string {
  return `${mode.replace(/_/g, " ")} over ${targetNodes.length} terrain node${targetNodes.length === 1 ? "" : "s"}.`;
}

function getAverageAnchor(scene: TerrainScene, nodes: TerrainNode[]): { x: number; y: number } {
  const positionedNodes = nodes.filter((node) => node.position_hint);

  if (positionedNodes.length === 0) {
    return {
      x: scene.viewport.x,
      y: scene.viewport.y,
    };
  }

  return {
    x: positionedNodes.reduce((sum, node) => sum + (node.position_hint?.x ?? 0), 0) / positionedNodes.length,
    y: positionedNodes.reduce((sum, node) => sum + (node.position_hint?.y ?? 0), 0) / positionedNodes.length,
  };
}

function findSourceForNode(scene: TerrainScene, node: TerrainNode): SourceRef | undefined {
  if (node.source_id) {
    return scene.sources.find((source) => source.id === node.source_id);
  }

  return scene.sources.find((source) => source.url === node.source_url || source.title === node.source_title);
}

function createCreatedFromRef(scene: TerrainScene, node: TerrainNode, label: string): TerrainNode["created_from"] {
  return {
    tab_id: scene.active_tab_id,
    node_id: node.id,
    source_id: node.source_id,
    layer: node.layer,
    label,
    excerpt: node.summary,
  };
}

function isMockCartographerMode(mode: AgentJob["mode"]): mode is MockCartographerMode {
  return (
    mode === "region_explainer" ||
    mode === "source_distiller" ||
    mode === "web_scout_planner" ||
    mode === "layer_cartographer" ||
    mode === "question_generator" ||
    mode === "learning_path_mapper"
  );
}

function toSlug(value: string): string {
  const slug = value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug || "cartographer";
}
