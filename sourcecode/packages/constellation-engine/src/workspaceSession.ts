import type { TerrainScene } from "@seekstar/core-schema";
import { buildWorkspaceSnapshot, hydrateWorkspaceSnapshot, isWorkspaceSnapshot } from "./sceneMutations.js";
import type { WorkspaceSnapshot } from "./types.js";

export const DEPRECATED_DEFAULT_TAB_IDS = ["tab-default-seekstar-seed", "tab-unknown-unknowns-deep-zoom"] as const;

const deprecatedDefaultTabIds = new Set<string>(DEPRECATED_DEFAULT_TAB_IDS);

export interface PreparedWorkspaceLaunch<TBasketItem = unknown> {
  activeTabId: string;
  basketByTabId: Record<string, TBasketItem[]>;
  scenesByTabId: Record<string, TerrainScene>;
}

export function prepareWorkspaceLaunch<TBasketItem>(input: {
  fallbackScene: TerrainScene;
  runtimeTabId?: string;
  snapshot: unknown;
}): PreparedWorkspaceLaunch<TBasketItem> {
  let scenesByTabId: Record<string, TerrainScene> = {
    [input.fallbackScene.active_tab_id]: input.fallbackScene,
  };
  let basketByTabId: Record<string, TBasketItem[]> = {};

  if (isWorkspaceSnapshot<TBasketItem>(input.snapshot)) {
    const hydrated = hydrateWorkspaceSnapshot(input.snapshot, input.fallbackScene);
    scenesByTabId = removeDeprecatedDefaultScenes(hydrated.scenesByTabId, input.fallbackScene);
    basketByTabId = removeDeprecatedBasketEntries(input.snapshot.basket_by_tab_id);
  }

  const activeTabId =
    input.runtimeTabId && scenesByTabId[input.runtimeTabId]
      ? input.runtimeTabId
      : input.fallbackScene.active_tab_id;

  return {
    activeTabId,
    basketByTabId,
    scenesByTabId,
  };
}

export function removeDeprecatedDefaultScenes(
  scenesByTabId: Record<string, TerrainScene>,
  fallbackScene: TerrainScene,
): Record<string, TerrainScene> {
  const entries = Object.entries(scenesByTabId).filter(([tabId]) => !deprecatedDefaultTabIds.has(tabId));

  return {
    ...Object.fromEntries(entries),
    [fallbackScene.active_tab_id]: fallbackScene,
  };
}

export function removeDeprecatedBasketEntries<TBasketItem>(basketByTabId: Record<string, TBasketItem[]>): Record<string, TBasketItem[]> {
  return Object.fromEntries(Object.entries(basketByTabId).filter(([tabId]) => !deprecatedDefaultTabIds.has(tabId)));
}

export function createPersistableWorkspaceSnapshot<TBasketItem>(input: {
  activeTabId: string;
  basketByTabId: WorkspaceSnapshot<TBasketItem>["basket_by_tab_id"];
  fallbackScene: TerrainScene;
  latestSnapshot?: unknown;
  lockedTabId?: string;
  scenesByTabId: Record<string, TerrainScene>;
}): WorkspaceSnapshot<TBasketItem> {
  if (!input.lockedTabId) {
    return buildWorkspaceSnapshot({
      activeTabId: input.activeTabId,
      basketByTabId: input.basketByTabId,
      fallbackScene: input.fallbackScene,
      scenesByTabId: input.scenesByTabId,
    });
  }

  const lockedScene = input.scenesByTabId[input.lockedTabId];

  if (!lockedScene || !isWorkspaceSnapshot<TBasketItem>(input.latestSnapshot)) {
    return buildWorkspaceSnapshot({
      activeTabId: input.activeTabId,
      basketByTabId: input.basketByTabId,
      fallbackScene: input.fallbackScene,
      scenesByTabId: input.scenesByTabId,
    });
  }

  return buildWorkspaceSnapshot({
    activeTabId: input.latestSnapshot.active_tab_id,
    basketByTabId: {
      ...input.latestSnapshot.basket_by_tab_id,
      [input.lockedTabId]:
        input.basketByTabId[input.lockedTabId] ??
        input.latestSnapshot.basket_by_tab_id[input.lockedTabId] ??
        [],
    },
    fallbackScene: input.fallbackScene,
    scenesByTabId: {
      ...input.latestSnapshot.scenes_by_tab_id,
      [input.lockedTabId]: lockedScene,
    },
  });
}
