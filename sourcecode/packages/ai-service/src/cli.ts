#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { assertValidTerrainScene } from "@seekstar/core-schema";
import type { TerrainScene } from "@seekstar/core-schema";
import { UnconfiguredAiService } from "./index.js";

const [command, ...args] = process.argv.slice(2);

try {
  const output = await run(command, args);
  process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
}

async function run(commandName: string | undefined, argsList: string[]): Promise<unknown> {
  if (!commandName || commandName === "help" || commandName === "--help") {
    return {
      commands: ["status", "build-context --scene scene.json [--selection node-a,node-b] [--prompt text]"],
    };
  }

  const service = new UnconfiguredAiService();

  if (commandName === "status") {
    return { status: await service.status() };
  }

  if (commandName === "build-context") {
    const options = parseArgs(argsList);
    const scene = assertValidTerrainScene(readJson<TerrainScene>(required(options, "scene")), "seekstar-ai:scene");
    const selection = options.selection ? options.selection.split(",").filter(Boolean) : scene.selection.node_ids;
    return service.buildContext(scene, selection, options.prompt);
  }

  throw new Error(`Unknown seekstar-ai command: ${commandName}`);
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

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}
