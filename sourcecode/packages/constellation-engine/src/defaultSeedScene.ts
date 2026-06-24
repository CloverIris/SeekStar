import type { TerrainScene } from "@seekstar/core-schema";
import { DEFAULT_DOMAIN_LEXICONS, type DomainLexicon } from "./domainLexicon.js";
import { createSeedScene } from "./seedScene.js";

const createdAt = "2026-06-23T00:00:00.000Z";

export const NEW_SEEK_TITLE = "New Seek";
export const DEFAULT_NEW_SEEK_SCENE_ID = "scene-default-new-seek";
export const DEFAULT_NEW_SEEK_TAB_ID = "tab-default-new-seek";

export function createDefaultNewSeekScene(options: { domainLexicon?: DomainLexicon; timestamp?: string } = {}): TerrainScene {
  return createSeedScene(NEW_SEEK_TITLE, {
    domainLexicon: options.domainLexicon ?? DEFAULT_DOMAIN_LEXICONS[0],
    sceneId: DEFAULT_NEW_SEEK_SCENE_ID,
    sourceMode: "new_seed",
    tabId: DEFAULT_NEW_SEEK_TAB_ID,
    timestamp: options.timestamp ?? createdAt,
  });
}

export const defaultSeekStarSeedScene: TerrainScene = createDefaultNewSeekScene();
