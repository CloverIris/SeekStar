import { assertValidTerrainScene } from "@seekstar/core-schema";
import type { TerrainScene } from "@seekstar/core-schema";
import type { ConstellationTabCreateInput, ConstellationTabRuntimePort } from "./ports.js";
import type { WorkspaceSnapshot } from "./types.js";
import type { WorkspacePersistenceCoordinator } from "./workspacePersistence.js";

export interface TabSelectionResult {
  focusNodeId?: string;
  selectedNodeIds: string[];
}

export interface TabSessionCoordinatorOptions<TBasketItem = unknown> {
  persistence: WorkspacePersistenceCoordinator<TBasketItem>;
  tabRuntime: ConstellationTabRuntimePort;
}

export interface OpenTabSessionTransaction<TBasketItem = unknown> extends TabSelectionResult {
  activeTabId: string;
  basketByTabId: WorkspaceSnapshot<TBasketItem>["basket_by_tab_id"];
  scene: TerrainScene;
  scenesByTabId: Record<string, TerrainScene>;
  shouldAdoptLocally: boolean;
  tabCreate: ConstellationTabCreateInput;
}

export interface CloseTabSessionTransaction<TBasketItem = unknown> extends TabSelectionResult {
  activeTabId: string;
  basketByTabId: WorkspaceSnapshot<TBasketItem>["basket_by_tab_id"];
  closedTabId: string;
  scenesByTabId: Record<string, TerrainScene>;
  wasActiveTab: boolean;
}

export interface ReorderTabSessionTransaction {
  scenesByTabId: Record<string, TerrainScene>;
  sourceTabId: string;
  targetTabId: string;
}

export class TabSessionCoordinator<TBasketItem = unknown> {
  constructor(private readonly options: TabSessionCoordinatorOptions<TBasketItem>) {}

  prepareOpenScene(input: {
    basketByTabId: WorkspaceSnapshot<TBasketItem>["basket_by_tab_id"];
    nextScene: TerrainScene;
    runtimeTabId?: string;
    scenesByTabId: Record<string, TerrainScene>;
  }): OpenTabSessionTransaction<TBasketItem> {
    const scene = assertValidTerrainScene(input.nextScene, "TabSessionCoordinator:openScene");
    const activeTabId = scene.active_tab_id;
    const nextTab = scene.tabs.find((tab) => tab.id === activeTabId) ?? scene.tabs[0];
    const scenesByTabId = {
      ...input.scenesByTabId,
      [activeTabId]: scene,
    };

    return {
      ...createSelectionResult(scene),
      activeTabId,
      basketByTabId: input.basketByTabId,
      scene,
      scenesByTabId,
      shouldAdoptLocally: !input.runtimeTabId || input.runtimeTabId === activeTabId,
      tabCreate: {
        activate: true,
        tabId: activeTabId,
        title: nextTab?.title ?? scene.metadata.title,
        seed: nextTab?.seed ?? scene.metadata.title,
      },
    };
  }

  async commitOpenScene(input: {
    fallbackScene: TerrainScene;
    transaction: OpenTabSessionTransaction<TBasketItem>;
  }): Promise<void> {
    await this.options.persistence.persist({
      activeTabId: input.transaction.activeTabId,
      basketByTabId: input.transaction.basketByTabId,
      fallbackScene: input.fallbackScene,
      scenesByTabId: input.transaction.scenesByTabId,
    });
    await this.options.tabRuntime.createTab(input.transaction.tabCreate);
  }

  prepareCloseTab(input: {
    activeTabId: string;
    basketByTabId: WorkspaceSnapshot<TBasketItem>["basket_by_tab_id"];
    scenesByTabId: Record<string, TerrainScene>;
    tabId: string;
  }): CloseTabSessionTransaction<TBasketItem> | undefined {
    if (Object.keys(input.scenesByTabId).length <= 1) {
      return undefined;
    }

    const orderedTabIds = Object.keys(input.scenesByTabId);
    const closingIndex = orderedTabIds.indexOf(input.tabId);
    const activeTabId =
      input.activeTabId === input.tabId
        ? orderedTabIds[Math.max(0, closingIndex - 1)] ?? orderedTabIds.find((id) => id !== input.tabId)
        : input.activeTabId;

    if (!activeTabId || activeTabId === input.tabId) {
      return undefined;
    }

    const nextScene = input.scenesByTabId[activeTabId];

    if (!nextScene) {
      return undefined;
    }

    const scenesByTabId = Object.fromEntries(
      Object.entries(input.scenesByTabId).filter(([candidateTabId]) => candidateTabId !== input.tabId),
    );
    const basketByTabId = Object.fromEntries(
      Object.entries(input.basketByTabId).filter(([candidateTabId]) => candidateTabId !== input.tabId),
    ) as WorkspaceSnapshot<TBasketItem>["basket_by_tab_id"];

    return {
      ...createSelectionResult(nextScene),
      activeTabId,
      basketByTabId,
      closedTabId: input.tabId,
      scenesByTabId,
      wasActiveTab: input.activeTabId === input.tabId,
    };
  }

  async commitCloseTab(input: {
    fallbackScene: TerrainScene;
    transaction: CloseTabSessionTransaction<TBasketItem>;
  }): Promise<void> {
    await this.options.persistence.persist({
      activeTabId: input.transaction.activeTabId,
      basketByTabId: input.transaction.basketByTabId,
      fallbackScene: input.fallbackScene,
      scenesByTabId: input.transaction.scenesByTabId,
    });

    if (input.transaction.wasActiveTab) {
      await this.options.tabRuntime.activateTab(input.transaction.activeTabId);
    }

    await this.options.tabRuntime.closeTab(input.transaction.closedTabId);
  }

  prepareReorderTabs(input: {
    scenesByTabId: Record<string, TerrainScene>;
    sourceTabId: string;
    targetTabId: string;
  }): ReorderTabSessionTransaction | undefined {
    if (input.sourceTabId === input.targetTabId) {
      return undefined;
    }

    const entries = Object.entries(input.scenesByTabId);
    const sourceIndex = entries.findIndex(([tabId]) => tabId === input.sourceTabId);
    const targetIndex = entries.findIndex(([tabId]) => tabId === input.targetTabId);

    if (sourceIndex < 0 || targetIndex < 0) {
      return undefined;
    }

    const [source] = entries.splice(sourceIndex, 1);
    entries.splice(targetIndex, 0, source);

    return {
      scenesByTabId: Object.fromEntries(entries),
      sourceTabId: input.sourceTabId,
      targetTabId: input.targetTabId,
    };
  }

  async commitReorderTabs(transaction: ReorderTabSessionTransaction): Promise<void> {
    await this.options.tabRuntime.reorderTabs(transaction.sourceTabId, transaction.targetTabId);
  }

  async activateTab(tabId: string): Promise<void> {
    await this.options.tabRuntime.activateTab(tabId);
  }
}

function createSelectionResult(scene: TerrainScene): TabSelectionResult {
  return {
    selectedNodeIds: scene.selection.node_ids,
    focusNodeId: scene.selection.node_ids[0],
  };
}
