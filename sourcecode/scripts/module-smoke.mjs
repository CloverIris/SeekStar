import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { validateWorldSegmentGenerationOutput } from "../packages/ai-service/dist/index.js";
import { planWorkingSet, projectTerrain, reduceExplorationState } from "../packages/constellation-engine/dist/index.js";
import { JsonWorldRepository } from "../packages/storage-service/dist/index.js";

const timestamp = "2026-01-01T00:00:00.000Z";
const view = { camera: { x: 0, y: 0, zoom: 1, layer: "L1" }, selected_node_ids: [], browser_absorption: { status: "idle", exit_layer: "L3" } };
const center = { key: "0:0", chunk_x: 0, chunk_y: 0, revision: 1, phase: "ready", nodes: [node("center-L1", "L1"), node("center-L2", "L2")], relations: [], source_candidates: [], attempts: 1, updated_at: timestamp };
const world = { world_id: "world-1", tab_id: "tab-1", seed: "cars and planes", policy_revision: "exploration-world-v1", world_revision: 1, segments_by_key: { "0:0": center }, sources: {}, scout_observations: {}, created_at: timestamp, updated_at: timestamp };

const validated = validateWorldSegmentGenerationOutput({
  bands: {
    L0: { nodes: [draft("Transport")] },
    L1: { nodes: [draft("Cars"), draft("Planes")] },
    L2: { nodes: [draft("Engines")] },
    L3: { nodes: [] },
  },
  source_candidates: [{ title: "Reference", url: "https://example.com/reference" }],
}, { seed: world.seed, segment: { key: "0:0", x: 0, y: 0 }, prompt_revision: world.policy_revision });
assert.equal(validated.valid, true, "multi-scale segment output should validate");
if (validated.valid) {
  assert.equal(validated.output.bands.L3.nodes.length, 0, "L3 must not contain generated canvas nodes");
  assert.ok(validated.output.source_candidates.length <= 2, "segment must cap URL candidates at two");
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
assert.deepEqual(projection.nodes.map((item) => item.layer), ["L1"], "projection must expose only the current scale band");

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
];
const sourceFiles = await collectSourceFiles(new URL("../", import.meta.url));
for (const path of sourceFiles) {
  if (path.endsWith("appDataBridge.ts")) continue;
  const content = await readFile(path, "utf8");
  for (const token of forbidden) assert.equal(content.includes(token), false, `legacy token ${token} remains in ${path}`);
}
console.log(JSON.stringify({ status: "ok", tests: ["segment-contract", "view-stability", "center-first", "projection", "persistence", "legacy-absence", "structural-constraints"] }, null, 2));

function draft(title) { return { title, confidence: 0.8, importance: 0.7, tags: [] }; }
function node(id, layer) { return { id, type: "topic", title: id, layer, source_state: "generated", confidence: 0.8, importance: 0.7, tags: [], position_hint: { x: 0, y: 0 }, created_at: timestamp, updated_at: timestamp }; }

async function collectSourceFiles(rootUrl) {
  const root = rootUrl.pathname.replace(/^\/(?:([A-Za-z]:))/, "$1");
  const results = [];
  async function visit(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      if (["dist", "node_modules", "out", "docs", ".git"].includes(entry.name)) continue;
      const path = join(directory, entry.name);
      if (entry.isDirectory()) await visit(path);
      else if (/\.(?:ts|tsx|mjs|json)$/.test(entry.name) && entry.name !== "package-lock.json" && !path.endsWith("module-smoke.mjs")) results.push(path);
    }
  }
  await visit(root);
  return results;
}
