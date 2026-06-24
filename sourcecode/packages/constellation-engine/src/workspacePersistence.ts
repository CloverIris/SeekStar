import type { TerrainScene } from "@seekstar/core-schema";
import type { ConstellationStoragePort } from "./ports.js";
import type { PreparedWorkspaceLaunch } from "./workspaceSession.js";
import { createPersistableWorkspaceSnapshot, prepareWorkspaceLaunch } from "./workspaceSession.js";
import type { WorkspaceSnapshot } from "./types.js";

export interface WorkspacePersistenceCoordinatorOptions<TBasketItem = unknown> {
  resolveFallbackScene: () => Promise<TerrainScene> | TerrainScene;
  storage: ConstellationStoragePort<TBasketItem>;
}

export interface WorkspaceHydrateOptions {
  preferredActiveTabId?: string;
  runtimeTabId?: string;
}

export interface WorkspaceHydrateResult<TBasketItem = unknown> extends PreparedWorkspaceLaunch<TBasketItem> {
  fallbackScene: TerrainScene;
  focusNodeId?: string;
  selectedNodeIds: string[];
}

export interface WorkspacePersistInput<TBasketItem = unknown> {
  activeTabId: string;
  basketByTabId: WorkspaceSnapshot<TBasketItem>["basket_by_tab_id"];
  fallbackScene?: TerrainScene;
  lockedTabId?: string;
  scenesByTabId: Record<string, TerrainScene>;
}

export class WorkspacePersistenceCoordinator<TBasketItem = unknown> {
  constructor(private readonly options: WorkspacePersistenceCoordinatorOptions<TBasketItem>) {}

  async hydrate(options: WorkspaceHydrateOptions = {}): Promise<WorkspaceHydrateResult<TBasketItem>> {
    const fallbackScene = await this.options.resolveFallbackScene();
    const snapshot = await this.options.storage.loadWorkspaceSnapshot();
    const launch = prepareWorkspaceLaunch<TBasketItem>({
      fallbackScene,
      preferredActiveTabId: options.preferredActiveTabId,
      runtimeTabId: options.runtimeTabId,
      snapshot,
    });
    const activeScene = launch.scenesByTabId[launch.activeTabId] ?? fallbackScene;

    return {
      ...launch,
      fallbackScene,
      focusNodeId: activeScene.selection.node_ids[0],
      selectedNodeIds: activeScene.selection.node_ids,
    };
  }

  async persist(input: WorkspacePersistInput<TBasketItem>): Promise<WorkspaceSnapshot<TBasketItem>> {
    const fallbackScene = input.fallbackScene ?? (await this.options.resolveFallbackScene());
    const latestSnapshot = await this.options.storage.loadWorkspaceSnapshot().catch(() => undefined);
    const snapshot = createPersistableWorkspaceSnapshot<TBasketItem>({
      activeTabId: input.activeTabId,
      basketByTabId: input.basketByTabId,
      fallbackScene,
      latestSnapshot,
      lockedTabId: input.lockedTabId,
      scenesByTabId: input.scenesByTabId,
    });

    await this.options.storage.saveWorkspaceSnapshot(snapshot);
    return snapshot;
  }

  async clear(): Promise<void> {
    await this.options.storage.clearWorkspaceSnapshot();
  }
}
