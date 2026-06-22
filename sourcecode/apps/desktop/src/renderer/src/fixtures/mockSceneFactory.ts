import type { TerrainScene } from "@seekstar/core-schema";

let sceneCounter = 0;

export function createMockSeedScene(seedText: string): TerrainScene {
  sceneCounter += 1;

  const seed = seedText.trim();
  const slug = toSlug(seed);
  const stamp = `${Date.now()}-${sceneCounter}`;
  const createdAt = new Date().toISOString();
  const sceneId = `scene-${slug}-${stamp}`;
  const tabId = `tab-${slug}-${stamp}`;
  const seedNodeId = `node-${slug}-seed-${stamp}`;
  const siblingAId = `node-${slug}-contexts-${stamp}`;
  const siblingBId = `node-${slug}-methods-${stamp}`;
  const childAId = `node-${slug}-questions-${stamp}`;
  const childBId = `node-${slug}-provenance-${stamp}`;
  const fogId = `node-${slug}-fog-${stamp}`;

  return {
    id: sceneId,
    active_tab_id: tabId,
    tabs: [
      {
        id: tabId,
        title: seed,
        seed,
        source_mode: "new_seed",
        current_layer: "L0",
        viewport: {
          x: 0,
          y: 0,
          zoom: 1,
          layer: "L0",
        },
        node_ids: [seedNodeId, siblingAId, siblingBId, childAId, childBId, fogId],
        relation_ids: [
          `rel-${slug}-contexts-${stamp}`,
          `rel-${slug}-methods-${stamp}`,
          `rel-${slug}-questions-${stamp}`,
          `rel-${slug}-provenance-${stamp}`,
          `rel-${slug}-fog-${stamp}`,
        ],
        source_ids: [],
        created_at: createdAt,
        updated_at: createdAt,
      },
    ],
    layers: [
      {
        id: "L0",
        label: "Seed Field",
        child_layer_ids: ["L1"],
        breadcrumb: [seed, "Seed Field"],
      },
      {
        id: "L1",
        label: "Topic Neighborhood",
        parent_layer_id: "L0",
        child_layer_ids: ["L2"],
        breadcrumb: [seed, "Seed Field", "Topic Neighborhood"],
      },
      {
        id: "L2",
        label: "Source Orientation",
        parent_layer_id: "L1",
        child_layer_ids: [],
        breadcrumb: [seed, "Seed Field", "Source Orientation"],
      },
    ],
    nodes: [
      {
        id: seedNodeId,
        type: "concept",
        title: seed,
        layer: "L0",
        source_state: "generated",
        confidence: 0.76,
        importance: 1,
        tags: ["seed", "mock", "generated"],
        summary: `Mock generated terrain for exploring "${seed}" as a new seed.`,
        child_ids: [siblingAId, siblingBId, childAId, childBId],
        relation_ids: [`rel-${slug}-contexts-${stamp}`, `rel-${slug}-methods-${stamp}`],
        position_hint: { x: 0, y: 0 },
        created_at: createdAt,
        updated_at: createdAt,
      },
      {
        id: siblingAId,
        type: "topic",
        title: `${seed} contexts`,
        layer: "L1",
        source_state: "agent_inferred",
        confidence: 0.48,
        importance: 0.76,
        tags: ["sibling", "context", "mock"],
        summary: "A mock sibling region for nearby contexts and adjacent meanings.",
        parent_id: seedNodeId,
        relation_ids: [`rel-${slug}-contexts-${stamp}`],
        position_hint: { x: -230, y: -110 },
        created_at: createdAt,
        updated_at: createdAt,
      },
      {
        id: siblingBId,
        type: "topic",
        title: `${seed} methods`,
        layer: "L1",
        source_state: "agent_inferred",
        confidence: 0.46,
        importance: 0.72,
        tags: ["sibling", "methods", "mock"],
        summary: "A mock sibling region for methods, tools, and ways of investigating the seed.",
        parent_id: seedNodeId,
        relation_ids: [`rel-${slug}-methods-${stamp}`],
        position_hint: { x: 230, y: -110 },
        created_at: createdAt,
        updated_at: createdAt,
      },
      {
        id: childAId,
        type: "subtopic",
        title: `${seed} questions`,
        layer: "L1",
        source_state: "generated",
        confidence: 0.52,
        importance: 0.7,
        tags: ["child", "questions", "mock"],
        summary: "A mock child region for questions the user might discover rather than already know.",
        parent_id: seedNodeId,
        relation_ids: [`rel-${slug}-questions-${stamp}`],
        position_hint: { x: 0, y: 170 },
        created_at: createdAt,
        updated_at: createdAt,
      },
      {
        id: childBId,
        type: "concept",
        title: `${seed} provenance`,
        layer: "L2",
        source_state: "generated",
        confidence: 0.44,
        importance: 0.68,
        tags: ["child", "provenance", "mock"],
        summary: "A mock provenance concept reminding that this local scene has no fetched sources yet.",
        parent_id: seedNodeId,
        relation_ids: [`rel-${slug}-provenance-${stamp}`],
        position_hint: { x: -230, y: 150 },
        created_at: createdAt,
        updated_at: createdAt,
      },
      {
        id: fogId,
        type: "fog_region",
        title: `${seed} unknowns`,
        layer: "L1",
        source_state: "fog",
        confidence: 0.25,
        importance: 0.66,
        tags: ["fog", "unknowns", "mock"],
        summary: "A mock fog region for adjacent unknowns that have not been searched or verified.",
        relation_ids: [`rel-${slug}-fog-${stamp}`],
        position_hint: { x: 0, y: -250 },
        created_at: createdAt,
        updated_at: createdAt,
      },
    ],
    relations: [
      {
        id: `rel-${slug}-contexts-${stamp}`,
        from: seedNodeId,
        to: siblingAId,
        type: "parent_child",
        confidence: 0.46,
        explanation: "Mock generated relation from the seed to adjacent contexts.",
        source_state: "agent_inferred",
      },
      {
        id: `rel-${slug}-methods-${stamp}`,
        from: seedNodeId,
        to: siblingBId,
        type: "parent_child",
        confidence: 0.45,
        explanation: "Mock generated relation from the seed to methods of exploration.",
        source_state: "agent_inferred",
      },
      {
        id: `rel-${slug}-questions-${stamp}`,
        from: seedNodeId,
        to: childAId,
        type: "parent_child",
        confidence: 0.5,
        explanation: "Mock generated relation from the seed to possible questions.",
        source_state: "agent_inferred",
      },
      {
        id: `rel-${slug}-provenance-${stamp}`,
        from: seedNodeId,
        to: childBId,
        type: "supports",
        confidence: 0.38,
        explanation: "Mock relation showing provenance remains a required concept even before sources exist.",
        source_state: "weak_hypothesis",
      },
      {
        id: `rel-${slug}-fog-${stamp}`,
        from: seedNodeId,
        to: fogId,
        type: "agent_inferred",
        confidence: 0.3,
        explanation: "Mock relation showing unexplored space near the new seed.",
        source_state: "weak_hypothesis",
      },
    ],
    sources: [],
    viewport: {
      x: 0,
      y: 0,
      zoom: 1,
      layer: "L0",
    },
    selection: {
      id: `selection-${slug}-${stamp}`,
      tab_id: tabId,
      node_ids: [],
      source_ids: [],
      text_ranges: [],
      created_at: createdAt,
    },
    agent_jobs: [],
    metadata: {
      title: seed,
      description: `Source-free mock terrain generated locally for "${seed}".`,
      source_state: "generated",
      generated_by: "fixture",
      created_at: createdAt,
      updated_at: createdAt,
    },
  };
}

function toSlug(value: string): string {
  const slug = value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug || "seed";
}
