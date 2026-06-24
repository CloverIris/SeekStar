import { assertValidTerrainScene } from "@seekstar/core-schema";
import type { TerrainScene } from "@seekstar/core-schema";
import { applyExplorationEvent, type ExplorationEvent } from "./events.js";
import { createExplorationObjectPool, type ExplorationObjectPool } from "./objectPool.js";
import type { ConstellationEnginePorts } from "./ports.js";
import { createTerrainPixiProjection, type TerrainPixiProjection } from "./pixiRuntime.js";

export interface ConstellationEngineSnapshot {
  scene: TerrainScene;
  objectPool: ExplorationObjectPool;
  pixiProjection: TerrainPixiProjection;
}

export class ConstellationEngine {
  private sceneValue: TerrainScene;

  constructor(
    scene: TerrainScene,
    readonly ports: ConstellationEnginePorts = {},
  ) {
    this.sceneValue = assertValidTerrainScene(scene, "ConstellationEngine:init");
  }

  get scene(): TerrainScene {
    return this.sceneValue;
  }

  dispatch(event: ExplorationEvent): ConstellationEngineSnapshot {
    const result = applyExplorationEvent(this.sceneValue, event);
    this.sceneValue = assertValidTerrainScene(result.scene, `ConstellationEngine:${event.type}`);
    return this.snapshot();
  }

  snapshot(): ConstellationEngineSnapshot {
    return {
      scene: this.sceneValue,
      objectPool: createExplorationObjectPool(this.sceneValue),
      pixiProjection: createTerrainPixiProjection(this.sceneValue, this.sceneValue.viewport),
    };
  }
}
