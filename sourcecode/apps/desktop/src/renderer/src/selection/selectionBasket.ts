import type { ExplorationTab, SourceState, TerrainNode } from "@seekstar/core-schema";

export interface SelectionBasketItem {
  id: string;
  tabId: string;
  title: string;
  nodeIds: string[];
  sourceStates: SourceState[];
  createdAt: string;
}

export function createSelectionBasketItem(tab: ExplorationTab, nodes: TerrainNode[]): SelectionBasketItem {
  const createdAt = new Date().toISOString();

  return {
    id: `basket-${tab.id}-${Date.now()}`,
    tabId: tab.id,
    title: nodes.length === 1 ? nodes[0].title : `${nodes.length} nodes from ${tab.title}`,
    nodeIds: nodes.map((node) => node.id),
    sourceStates: Array.from(new Set(nodes.map((node) => node.source_state))),
    createdAt,
  };
}

