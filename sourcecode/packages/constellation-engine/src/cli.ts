#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { assertValidTerrainScene } from "@seekstar/core-schema";
import type { ScoutObservation, TerrainScene, ViewportState } from "@seekstar/core-schema";
import { applyExplorationEvent, type ExplorationEvent } from "./events.js";
import { createExplorationObjectPool } from "./objectPool.js";
import { createTerrainPixiProjection } from "./pixiRuntime.js";
import { createFrontierScoutPlan, positionFrontierObservations, resolveFrontierTrigger } from "./scoutPlanning.js";
import type { SourceIngestionInput } from "./sourceTerrain.js";
import type { FrontierTrigger } from "./types.js";

const [command, ...args] = process.argv.slice(2);

try {
  const output = runCommand(command, args);
  process.stdout.write(`${JSON.stringify(output, jsonReplacer, 2)}\n`);
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
}

function runCommand(commandName: string | undefined, argsList: string[]): unknown {
  if (!commandName || commandName === "help" || commandName === "--help") {
    return {
      commands: [
        "apply-event --scene scene.json --event event.json",
        "object-pool --scene scene.json",
        "ingest-source --scene scene.json --source source-input.json",
        "project-pixi --scene scene.json [--viewport viewport.json]",
        "plan-frontier --scene scene.json --viewport viewport.json",
        "place-frontier --scene scene.json --trigger trigger.json --observations observations.json",
      ],
    };
  }

  const options = parseArgs(argsList);

  if (commandName === "apply-event") {
    const scene = readScene(required(options, "scene"));
    const event = readJson<ExplorationEvent>(required(options, "event"));
    return applyExplorationEvent(scene, event).scene;
  }

  if (commandName === "object-pool") {
    const pool = createExplorationObjectPool(readScene(required(options, "scene")));
    return {
      nodes: pool.nodesById.size,
      relations: pool.relationsById.size,
      sources: pool.sourcesById.size,
      scoutObservations: pool.scoutObservationsById.size,
      nodesByLayer: Object.fromEntries(Array.from(pool.nodesByLayer.entries()).map(([layer, nodes]) => [layer, nodes.length])),
      sourceStateCounts: Object.fromEntries(pool.sourceStateCounts),
    };
  }

  if (commandName === "ingest-source") {
    const scene = readScene(required(options, "scene"));
    const input = readJson<SourceIngestionInput>(required(options, "source"));
    return applyExplorationEvent(scene, {
      type: "source.snapshot.ingested",
      input,
    }).scene;
  }

  if (commandName === "project-pixi") {
    const scene = readScene(required(options, "scene"));
    const viewport = options.viewport ? readJson<ViewportState>(options.viewport) : scene.viewport;
    return createTerrainPixiProjection(scene, viewport);
  }

  if (commandName === "plan-frontier") {
    const scene = readScene(required(options, "scene"));
    const viewport = readJson<ViewportState>(required(options, "viewport"));
    const trigger = resolveFrontierTrigger(scene, viewport);

    return trigger
      ? {
          trigger,
          plan: createFrontierScoutPlan(scene, trigger, new Date().toISOString()),
        }
      : { trigger: null };
  }

  if (commandName === "place-frontier") {
    const scene = readScene(required(options, "scene"));
    const trigger = readJson<FrontierTrigger>(required(options, "trigger"));
    const observations = readJson<ScoutObservation[]>(required(options, "observations"));
    return positionFrontierObservations(observations, scene, trigger);
  }

  throw new Error(`Unknown seekstar-engine command: ${commandName}`);
}

function parseArgs(argsList: string[]): Record<string, string> {
  const parsed: Record<string, string> = {};

  for (let index = 0; index < argsList.length; index += 2) {
    const key = argsList[index];
    const value = argsList[index + 1];

    if (!key?.startsWith("--") || !value) {
      throw new Error(`Invalid argument pair near "${key ?? ""}".`);
    }

    parsed[key.slice(2)] = value;
  }

  return parsed;
}

function required(options: Record<string, string>, key: string): string {
  const value = options[key];

  if (!value) {
    throw new Error(`Missing required --${key} argument.`);
  }

  return value;
}

function readScene(path: string): TerrainScene {
  return assertValidTerrainScene(readJson<TerrainScene>(path), `seekstar-engine:${path}`);
}

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

function jsonReplacer(_key: string, value: unknown): unknown {
  if (value instanceof Set) {
    return Array.from(value);
  }

  if (value instanceof Map) {
    return Object.fromEntries(value);
  }

  return value;
}
