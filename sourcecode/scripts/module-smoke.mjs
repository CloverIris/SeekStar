import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { validateWorldSegmentGenerationOutput } from "../packages/ai-service/dist/index.js";
import { deriveSemanticFootprint, deriveVisualMass, planWorkingSet, projectTerrain, reduceExplorationState, semanticCentroid, settleSemanticPosition } from "../packages/constellation-engine/dist/index.js";
import { JsonWorldRepository } from "../packages/storage-service/dist/index.js";

const timestamp = "2026-01-01T00:00:00.000Z";
const view = { camera: { x: 0, y: 0, zoom: 1, layer: "L1" }, selected_node_ids: [], browser_absorption: { status: "idle", exit_layer: "L3" } };
const center = {
  key: "0:0",
  chunk_x: 0,
  chunk_y: 0,
  revision: 1,
  phase: "ready",
  nodes: [
    node("cars", "L1", 0, 0, 0.9, 0.85),
    node("planes", "L1", 420, 0, 0.72, 0.62),
    node("engine-comparison", "L2", 210, 30, 0.84, 0.7),
    { ...node("unverified-url", "L3", 210, 120, 0.7, 0.5), type: "webpage", source_state: "cartographer_unverified_source" },
    { ...node("verified-source", "L3", 230, 140, 0.8, 0.6), type: "webpage", source_state: "source_backed", source_id: "source-1", source_url: "https://example.com/verified" },
  ],
  relations: [
    relation("engine-cars", "engine-comparison", "cars", "refines"),
    relation("engine-planes", "engine-comparison", "planes", "refines"),
    relation("source-documents", "verified-source", "engine-comparison", "documents"),
  ],
  source_candidates: [],
  attempts: 1,
  updated_at: timestamp,
};
const world = { world_id: "world-1", tab_id: "tab-1", seed: "cars and planes", policy_revision: "exploration-world-v2", world_revision: 1, segments_by_key: { "0:0": center }, sources: { "source-1": { id: "source-1", title: "Verified", url: "https://example.com/verified", source_type: "webpage", reliability_hints: [] } }, scout_observations: {}, created_at: timestamp, updated_at: timestamp };

const validated = validateWorldSegmentGenerationOutput({
  bands: {
    L0: { nodes: [draft("transport", "Transport", "region")] },
    L1: { nodes: [draft("cars", "Cars", "topic"), draft("planes", "Planes", "topic")] },
    L2: { nodes: [draft("engines", "Engines", "comparison")] },
    L3: { nodes: [] },
  },
  relations: [
    { from: "cars", to: "transport", type: "refines" },
    { from: "planes", to: "transport", type: "refines" },
    { from: "engines", to: "cars", type: "refines" },
    { from: "engines", to: "planes", type: "refines" },
  ],
  source_candidates: [{ title: "Reference", url: "https://example.com/reference", target_ref: "engines" }],
}, { seed: world.seed, segment: { key: "0:0", x: 0, y: 0 }, budget: { L0: 4, L1: 6, L2: 8, total: 18 }, prompt_revision: world.policy_revision });
assert.equal(validated.valid, true, "multi-scale segment output should validate");
if (validated.valid) {
  assert.equal(validated.output.bands.L3.nodes.length, 0, "L3 must not contain generated canvas nodes");
  assert.ok(validated.output.source_candidates.length <= 2, "segment must cap URL candidates at two");
  assert.equal(validated.output.relations.filter((item) => item.from === "engines").length, 2, "multi-parent refinement must survive validation");
}

let renderer = { leaseId: "lease-1", world, view, viewRevision: 5, jobsById: {} };
renderer = reduceExplorationState(renderer, { type: "view_changed", view: { ...view, camera: { ...view.camera, x: 1200, layer: "L2" } }, viewRevision: 6 });
renderer = reduceExplorationState(renderer, { type: "world_event", event: { type: "job_changed", world_revision: 2, job: { id: "job-1", kind: "segment", status: "running", updated_at: timestamp } } });
renderer = reduceExplorationState(renderer, { type: "world_event", event: { type: "segment_upsert", world_revision: 3, segment: { ...center, revision: 2, updated_at: timestamp } } });
assert.equal(renderer.view.camera.layer, "L2", "background world events must never overwrite renderer layer");
assert.equal(renderer.view.camera.x, 1200, "background world events must never overwrite renderer XY");

assert.deepEqual(planWorkingSet(view, {}), ["0:0"], "missing center must be the only initial job");
assert.equal(planWorkingSet(view, world.segments_by_key).length, 9, "terminal center must unlock the neighbor ring");
const projection = projectTerrain(world, view);
assert.deepEqual(projection.primary.map((item) => item.node.layer), ["L1", "L1"], "primary projection must expose only the current scale band");
assert.deepEqual(projection.next_layer_preview.map((item) => item.node.id), ["engine-comparison"], "next layer preview must follow explicit refinement relations");
assert.equal(projection.next_layer_preview.every((item) => item.projection_role === "next_layer_preview"), true, "preview objects must be non-primary");
const l2Projection = projectTerrain(world, { ...view, camera: { ...view.camera, layer: "L2" } });
assert.deepEqual(l2Projection.next_layer_preview.map((item) => item.node.id), ["verified-source"], "L2 may preview verified L3 sources only");
assert.equal(projection.primary[0].visual_mass > projection.primary[1].visual_mass, true, "semantic weights must produce monotonic visual mass");
const lowMass = deriveVisualMass(0.2, 0.2, 0.2);
const highMass = deriveVisualMass(0.9, 0.9, 0.9);
const lowFootprint = deriveSemanticFootprint("L1", lowMass);
const highFootprint = deriveSemanticFootprint("L1", highMass);
assert.equal(highFootprint.width > lowFootprint.width && highFootprint.height > lowFootprint.height, true, "semantic footprint must grow monotonically within its layer range");
assert.deepEqual(semanticCentroid([{ x: 0, y: 0 }, { x: 400, y: 0 }]), { x: 200, y: 0 }, "multi-parent nodes must anchor at the parent centroid");
const fixedObstacle = node("fixed", "L2", 200, 0, 0.8, 0.8);
const newcomer = node("newcomer", "L2", 0, 0, 0.7, 0.7);
const firstSettlement = settleSemanticPosition(newcomer, { x: 200, y: 0 }, [fixedObstacle]);
const secondSettlement = settleSemanticPosition(newcomer, { x: 200, y: 0 }, [fixedObstacle]);
assert.deepEqual(firstSettlement, secondSettlement, "new-node collision settlement must be deterministic");
assert.deepEqual(fixedObstacle.position_hint, { x: 200, y: 0 }, "settling a new node must not move an existing node");

const directory = await mkdtemp(join(tmpdir(), "seekstar-world-smoke-"));
try {
  const path = join(directory, "worlds.json");
  const repository = new JsonWorldRepository(path, 5);
  await Promise.all([
    repository.saveWorld(world),
    repository.saveViewCheckpoint({ tab_id: world.tab_id, view_revision: 6, view: renderer.view, updated_at: timestamp }),
  ]);
  await repository.flush();
  const restored = new JsonWorldRepository(path, 5);
  assert.equal((await restored.getWorld(world.tab_id))?.world_revision, 1, "world document must restore without AI generation");
  assert.equal((await restored.getViewCheckpoint(world.tab_id))?.view_revision, 6, "view checkpoint must restore independently");
  JSON.parse(await readFile(path, "utf8"));
} finally {
  await rm(directory, { recursive: true, force: true });
}

assert.equal(existsSync(new URL("../packages/level-runtime", import.meta.url)), false, "legacy level-runtime package must be physically absent");
const forbidden = [
  ["cartographer", ":"].join(""),
  ["cartographer-chunks", ":"].join(""),
  ["world-pool", ":"].join(""),
  ["workspace", ":"].join(""),
  ["@seekstar", "level-runtime"].join("/"),
  ["Workspace", "Snapshot"].join(""),
  ["Workspace", "PersistenceCoordinator"].join(""),
  ["TabSession", "Coordinator"].join(""),
  ["Cartographer", "Runtime"].join(""),
  ["useExploration", "Session"].join(""),
  ["supra", "_macro"].join(""),
  ["parent", "_child"].join(""),
  ["applyMvp", "LayerLayout"].join(""),
  ["stage", ".removeChildren()"].join(""),
  ["canvas", ".toDataURL"].join(""),
  ["semantic-layer-transition", "-snapshot"].join(""),
];
const sourceFiles = await collectSourceFiles(new URL("../", import.meta.url));
for (const path of sourceFiles) {
  if (path.endsWith("appDataBridge.ts")) continue;
  const content = await readFile(path, "utf8");
  for (const token of forbidden) assert.equal(content.includes(token), false, `legacy token ${token} remains in ${path}`);
}
console.log(JSON.stringify({ status: "ok", tests: ["segment-contract-v2", "multi-parent-relations", "view-stability", "center-first", "cross-layer-projection", "verified-source-boundary", "visual-mass", "footprint-monotonicity", "multi-parent-centroid", "stable-layout", "persistence", "legacy-absence", "structural-constraints"] }, null, 2));

function draft(localId, title, semanticRole) { return { local_id: localId, title, orientation_summary: `${title} orientation`, semantic_role: semanticRole, confidence: 0.8, importance: 0.7, coverage: 0.6, tags: [] }; }
function node(id, layer, x, y, importance, coverage) { return { id, type: layer === "L0" ? "domain" : layer === "L1" ? "topic" : "concept", title: id, orientation_summary: `${id} orientation`, semantic_role: layer === "L0" ? "region" : layer === "L1" ? "topic" : layer === "L2" ? "comparison" : "source", layer, source_state: "cartographer_primary", confidence: 0.8, importance, coverage, footprint: { width: 160 + importance * 100, height: 84 + coverage * 80 }, tags: ["exploration-world-v2"], position_hint: { x, y }, created_at: timestamp, updated_at: timestamp }; }
function relation(id, from, to, type) { return { id, from, to, type, confidence: 0.9, explanation: type, source_state: "cartographer_primary" }; }

async function collectSourceFiles(rootUrl) {
  const root = rootUrl.pathname.replace(/^\/(?:([A-Za-z]:))/, "$1");
  const results = [];
  async function visit(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      if (["dist", "node_modules", "out", "docs", ".git"].includes(entry.name)) continue;
      const path = join(directory, entry.name);
      if (entry.isDirectory()) await visit(path);
      else if (/\.(?:ts|tsx|mjs|json)$/.test(entry.name) && entry.name !== "package-lock.json" && !path.endsWith("module-smoke.mjs") && !path.endsWith("render-smoke.mjs")) results.push(path);
    }
  }
  await visit(root);
  return results;
}
