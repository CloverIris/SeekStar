#!/usr/bin/env node
import { JsonLevelChunkStorage, JsonWorkspaceStorage } from "./index.js";

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
        "validate --snapshot workspace.json",
        "clear --snapshot workspace.json",
        "chunks-inspect --chunks level-chunks.json",
        "chunks-clear --chunks level-chunks.json",
        "chunks-prune --chunks level-chunks.json --max-entries 100",
      ],
    };
  }

  const options = parseArgs(argsList);

  if (commandName.startsWith("chunks-")) {
    const chunkStorage = new JsonLevelChunkStorage(required(options, "chunks"));

    if (commandName === "chunks-inspect") {
      const chunks = await chunkStorage.listChunks();

      return {
        chunkCount: chunks.length,
        bytesEstimate: chunks.reduce((sum, chunk) => sum + chunk.bytes_estimate, 0),
        chunks: chunks.map((chunk) => ({
          cacheKey: chunk.cache_key,
          levelId: chunk.input.level_id,
          mode: chunk.input.mode,
          seed: chunk.input.seed,
          chunkKey: chunk.input.chunk_key,
          nodeCount: chunk.output.nodes.length,
          sourceCandidateCount: chunk.output.source_candidates.length,
          accessCount: chunk.access_count,
          lastAccessedAt: chunk.last_accessed_at,
        })),
      };
    }

    if (commandName === "chunks-clear") {
      await chunkStorage.clearChunks();
      return { cleared: true };
    }

    if (commandName === "chunks-prune") {
      return chunkStorage.pruneChunks(Number.parseInt(required(options, "max-entries"), 10));
    }

    throw new Error(`Unknown seekstar-storage command: ${commandName}`);
  }

  const storage = new JsonWorkspaceStorage(required(options, "snapshot"));

  if (commandName === "health") {
    return storage.health();
  }

  if (commandName === "inspect") {
    return storage.inspectWorkspaceSnapshot();
  }

  if (commandName === "validate") {
    const inspection = await storage.inspectWorkspaceSnapshot();

    return {
      ...inspection,
      valid: inspection.status === "valid",
    };
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
