import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { performance } from "node:perf_hooks";
import { projectTerrain } from "../packages/constellation-engine/dist/index.js";

const timestamp = "2026-01-01T00:00:00.000Z";
const nodes = [];
const relations = [];
for (let index = 0; index < 200; index += 1) {
  nodes.push(node(`primary-${index}`, "L1", index % 20 * 180, Math.floor(index / 20) * 130, index / 199));
}
for (let index = 0; index < 80; index += 1) {
  nodes.push(node(`preview-${index}`, "L2", index % 16 * 190, Math.floor(index / 16) * 140, index / 79));
  relations.push({ id: `relation-${index}`, from: `preview-${index}`, to: `primary-${index}`, type: "refines", confidence: 0.9, explanation: "preview", source_state: "cartographer_primary" });
}
const world = {
  world_id: "render-world",
  tab_id: "render-tab",
  seed: "render smoke",
  policy_revision: "exploration-world-v2",
  world_revision: 1,
  segments_by_key: {
    "0:0": { key: "0:0", chunk_x: 0, chunk_y: 0, revision: 1, phase: "ready", nodes, relations, source_candidates: [], attempts: 1, updated_at: timestamp },
  },
  sources: {},
  scout_observations: {},
  created_at: timestamp,
  updated_at: timestamp,
};
const view = { camera: { x: 0, y: 0, zoom: 1, layer: "L1" }, selected_node_ids: [], browser_absorption: { status: "idle", exit_layer: "L3" } };
const samples = [];
let projection;
for (let iteration = 0; iteration < 220; iteration += 1) {
  const startedAt = performance.now();
  projection = projectTerrain(world, { ...view, camera: { ...view.camera, x: iteration % 3 } });
  if (iteration >= 20) samples.push(performance.now() - startedAt);
}
samples.sort((left, right) => left - right);
const p95 = samples[Math.floor(samples.length * 0.95)] ?? 0;
assert.equal(projection.primary.length, 200, "render fixture must contain 200 primary objects");
assert.equal(projection.next_layer_preview.length, 80, "render fixture must contain 80 preview objects");
assert.ok(p95 < 16.7, `projection p95 must remain below one 60 Hz frame budget; received ${p95.toFixed(2)} ms`);

const terrainCanvas = await readFile(new URL("../apps/desktop/src/renderer/src/components/TerrainCanvas.tsx", import.meta.url), "utf8");
assert.equal(terrainCanvas.includes("stage.removeChildren()"), false, "renderer must not rebuild the full stage");
assert.equal(terrainCanvas.includes("canvas.toDataURL"), false, "renderer must not capture synchronous transition screenshots");
assert.equal(terrainCanvas.includes("pixiRegistries"), true, "renderer must keep an object-id display registry");
assert.equal(terrainCanvas.includes('eventMode = "none"'), true, "preview layer must be non-interactive");
assert.equal(terrainCanvas.includes("updateNodeInformationDensity(displayObject"), true, "camera scale must update information density without rebuilding displays");

console.log(JSON.stringify({
  status: "ok",
  functional_gate: "passed",
  projection_p95_ms: Number(p95.toFixed(3)),
  fixture: { primary: 200, preview: 80 },
  hardware_frame_gate: "Run the Electron trace on a Windows integrated GPU; Node smoke does not claim WebGL frame performance.",
}, null, 2));

function node(id, layer, x, y, mass) {
  return {
    id,
    type: layer === "L1" ? "topic" : "concept",
    title: id,
    orientation_summary: `${id} orientation`,
    semantic_role: layer === "L1" ? "topic" : "mechanism",
    layer,
    source_state: "cartographer_primary",
    confidence: 0.8,
    importance: 0.2 + mass * 0.8,
    coverage: 0.2 + mass * 0.8,
    footprint: layer === "L1" ? { width: 110 + mass * 140, height: 84 + mass * 106 } : { width: 160 + mass * 160, height: 72 + mass * 72 },
    tags: ["exploration-world-v2"],
    position_hint: { x, y },
    created_at: timestamp,
    updated_at: timestamp,
  };
}
