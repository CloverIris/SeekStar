export { ConstellationEngine, type ConstellationEngineSnapshot } from "./engine.js";
export { defaultSeekStarSeedScene } from "./defaultSeedScene.js";
export {
  DEFAULT_NEW_SEEK_SCENE_ID,
  DEFAULT_NEW_SEEK_TAB_ID,
  NEW_SEEK_TITLE,
  createDefaultNewSeekScene,
} from "./defaultSeedScene.js";
export {
  DEFAULT_DOMAIN_LEXICON_ID,
  DEFAULT_DOMAIN_LEXICONS,
  cloneDomainLexicons,
  resolveActiveDomainLexicon,
  type DomainLexicon,
  type DomainLexiconTerm,
} from "./domainLexicon.js";
export { applyExplorationEvent, type ExplorationEvent, type ExplorationEventResult } from "./events.js";
export { resolveLayerForZoom, resolveZoomForLayer } from "./lens.js";
export { createExplorationObjectPool, type ExplorationObjectPool } from "./objectPool.js";
export {
  type ConstellationAiContext,
  type ConstellationAiPort,
  type ConstellationEnginePorts,
  type ConstellationScoutPort,
  type ConstellationSourceSnapshotPort,
  type ConstellationStoragePort,
} from "./ports.js";
export { createTerrainPixiProjection, type TerrainPixiProjection } from "./pixiRuntime.js";
export {
  clampZoom,
  fitViewportToNodes,
  getNodeBounds,
  normalizeRect,
  rectContainsPoint,
  resetViewport,
  screenToWorld,
  selectNodesInRect,
  worldToScreen,
  zoomViewportAtScreenPoint,
  type CanvasPoint,
  type CanvasRect,
  type CanvasTool,
  type LassoDraft,
  type ViewportBounds,
} from "./pixiInteraction.js";
export {
  appendScoutObservations,
  applyLayerSelect,
  applySceneSelection,
  applySceneViewport,
  buildWorkspaceSnapshot,
  ensureDefaultScenes,
  hydrateWorkspaceSnapshot,
  ingestSourceSnapshot,
  isWorkspaceSnapshot,
} from "./sceneMutations.js";
export {
  createDirectUrlScoutPlan,
  createFailedScoutObservation,
  createFrontierScoutPlan,
  createPageOutlinksScoutPlan,
  isDirectHttpUrl,
  positionAnchoredScoutObservations,
  positionFrontierObservations,
  resolveFrontierTrigger,
} from "./scoutPlanning.js";
export { createSourceTerrainPatch, type SourceIngestionInput, type SourceTerrainPatch } from "./sourceTerrain.js";
export { createSeedScene, type SeedSceneOptions } from "./seedScene.js";
export {
  WORKSPACE_SCHEMA_REVISION,
  type FrontierDirection,
  type FrontierTrigger,
  type HydratedWorkspace,
  type PersistenceStatus,
  type ScoutObservationPlacement,
  type WorkspaceSnapshot,
} from "./types.js";
export {
  DEPRECATED_DEFAULT_TAB_IDS,
  createPersistableWorkspaceSnapshot,
  prepareWorkspaceLaunch,
  removeDeprecatedBasketEntries,
  removeDeprecatedDefaultScenes,
  type PreparedWorkspaceLaunch,
} from "./workspaceSession.js";
