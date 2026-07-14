import type { ExplorationJobState, ExplorationViewState, ExplorationWorldEvent, TerrainNode, TerrainProjection, WorldDocument, WorldSegment } from "@seekstar/core-schema";

export interface ExplorationRendererState {
  leaseId?: string;
  world?: WorldDocument;
  view: ExplorationViewState;
  viewRevision: number;
  jobsById: Record<string, ExplorationJobState>;
  error?: string;
}

export type ExplorationRendererAction =
  | { type: "opened"; leaseId: string; world: WorldDocument; view: ExplorationViewState; viewRevision: number; jobs: ExplorationJobState[] }
  | { type: "view_changed"; view: ExplorationViewState; viewRevision: number }
  | { type: "world_event"; event: ExplorationWorldEvent }
  | { type: "open_failed"; message: string };

export function reduceExplorationState(state: ExplorationRendererState, action: ExplorationRendererAction): ExplorationRendererState {
  if (action.type === "opened") return { leaseId: action.leaseId, world: action.world, view: action.view, viewRevision: action.viewRevision, jobsById: Object.fromEntries(action.jobs.map((job) => [job.id, job])) };
  if (action.type === "view_changed") return { ...state, view: action.view, viewRevision: action.viewRevision };
  if (action.type === "open_failed") return { ...state, error: action.message };
  const event = action.event;
  const world = state.world;
  if (!world || event.world_revision < world.world_revision) return state;
  if (event.type === "job_changed") return { ...state, jobsById: { ...state.jobsById, [event.job.id]: event.job } };
  if (event.type === "world_error") return { ...state, error: event.message };
  if (event.type === "segment_upsert") {
    const current = world.segments_by_key[event.segment.key];
    if (current && current.revision >= event.segment.revision) return state;
    const observations = Object.fromEntries(event.segment.source_candidates.map((candidate) => [candidate.id, candidate]));
    return { ...state, world: { ...world, world_revision: event.world_revision, segments_by_key: { ...world.segments_by_key, [event.segment.key]: event.segment }, scout_observations: { ...world.scout_observations, ...observations } } };
  }
  return { ...state, world: { ...world, world_revision: event.world_revision, sources: { ...world.sources, [event.source.id]: event.source }, scout_observations: event.observation ? { ...world.scout_observations, [event.observation.id]: event.observation } : world.scout_observations } };
}

export function projectTerrain(world: WorldDocument | undefined, view: ExplorationViewState): TerrainProjection {
  if (!world) return { tab_id: "", world_revision: 0, view, visible_segment_keys: [], nodes: [], relations: [], sources: [], scout_observations: [], fog_segment_keys: [] };
  const centerX = Math.round(view.camera.x / 1200);
  const centerY = Math.round(view.camera.y / 900);
  const visibleSegments = Object.values(world.segments_by_key).filter((segment) => Math.abs(segment.chunk_x - centerX) <= 1 && Math.abs(segment.chunk_y - centerY) <= 1);
  const ready = visibleSegments.filter((segment) => segment.phase === "ready");
  const nodes = ready.flatMap((segment) => segment.nodes).filter((node) => node.layer === view.camera.layer);
  const visibleNodeIds = new Set(nodes.map((node) => node.id));
  return { tab_id: world.tab_id, world_revision: world.world_revision, view, visible_segment_keys: visibleSegments.map((segment) => segment.key), nodes, relations: ready.flatMap((segment) => segment.relations).filter((relation) => visibleNodeIds.has(relation.from) || visibleNodeIds.has(relation.to)), sources: Object.values(world.sources), scout_observations: Object.values(world.scout_observations), fog_segment_keys: visibleSegments.filter((segment) => segment.phase !== "ready").map((segment) => segment.key) };
}

export function createFogNodes(projection: TerrainProjection): TerrainNode[] {
  return projection.fog_segment_keys.map((key) => {
    const [x, y] = key.split(":").map(Number);
    return { id: `fog:${key}:${projection.view.camera.layer}`, type: "fog_region", title: "世界池正在扩展", layer: projection.view.camera.layer, source_state: "fog", confidence: 0.1, importance: 0.2, tags: ["exploration-fog"], position_hint: { x: x * 1200, y: y * 900 }, created_at: new Date(0).toISOString(), updated_at: new Date(0).toISOString() };
  });
}

export function planWorkingSet(view: ExplorationViewState, segments: Record<string, WorldSegment>): string[] {
  const x = Math.round(view.camera.x / 1200);
  const y = Math.round(view.camera.y / 900);
  const center = `${x}:${y}`;
  const centerSegment = segments[center];
  if (!centerSegment || (centerSegment.phase !== "ready" && centerSegment.phase !== "failed")) return [center];
  const keys: string[] = [];
  for (let dy = -1; dy <= 1; dy += 1) for (let dx = -1; dx <= 1; dx += 1) keys.push(`${x + dx}:${y + dy}`);
  return keys.sort((left, right) => left === center ? -1 : right === center ? 1 : left.localeCompare(right));
}
