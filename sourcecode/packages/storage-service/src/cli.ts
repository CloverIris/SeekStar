#!/usr/bin/env node
import { JsonWorkspaceStorage } from "./index.js";

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
      commands: [
        "health --snapshot workspace.json",
        "inspect --snapshot workspace.json",
        "clear --snapshot workspace.json",
      ],
    };
  }

  const options = parseArgs(argsList);
  const storage = new JsonWorkspaceStorage(required(options, "snapshot"));

  if (commandName === "health") {
    return storage.health();
  }

  if (commandName === "inspect") {
    const snapshot = await storage.loadWorkspaceSnapshot();

    return snapshot
      ? {
          schemaRevision: snapshot.schema_revision,
          activeTabId: snapshot.active_tab_id,
          tabCount: Object.keys(snapshot.scenes_by_tab_id).length,
          updatedAt: snapshot.updated_at,
        }
      : { snapshot: null };
  }

  if (commandName === "clear") {
    await storage.clearWorkspaceSnapshot();
    return { cleared: true };
  }

  throw new Error(`Unknown seekstar-storage command: ${commandName}`);
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
