import type { LayerId, TerrainScene, ViewportState } from "@seekstar/core-schema";

export type PersistenceStatus = "loading" | "saved" | "saving" | "unsaved" | "unavailable" | "error";

export const WORKSPACE_SCHEMA_REVISION = 60;

export type FrontierDirection = "east" | "west" | "south" | "north";

export interface FrontierTrigger {
  id: string;
  direction: FrontierDirection;
  layer: LayerId;
  viewport: ViewportState;
}

export interface ScoutObservationPlacement {
  anchor: { x: number; y: number };
  discoveryMode: "direct_url" | "frontier_web_search" | "page_outlinks";
  frontierId: string;
  layer: LayerId;
  radius?: number;
}

export interface WorkspaceSnapshot<TBasketItem = unknown> {
  version: 1;
  schema_revision: typeof WORKSPACE_SCHEMA_REVISION;
  active_tab_id: string;
  scenes_by_tab_id: Record<string, TerrainScene>;
  basket_by_tab_id: Record<string, TBasketItem[]>;
  updated_at: string;
}

export interface HydratedWorkspace {
  activeTabId: string;
  scenesByTabId: Record<string, TerrainScene>;
}
