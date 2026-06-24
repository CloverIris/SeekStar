#!/usr/bin/env node
import type { ScoutPlan, ScoutRunRequest } from "@seekstar/core-schema";
import { PlaywrightScoutService } from "./index.js";

const [command, ...args] = process.argv.slice(2);
const service = new PlaywrightScoutService();

try {
  const output = await run(command, args);
  process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
} finally {
  await service.dispose();
}

async function run(commandName: string | undefined, argsList: string[]): Promise<unknown> {
  if (!commandName || commandName === "help" || commandName === "--help") {
    return {
      commands: ["run --tab dev --url https://example.com", "snapshot --tab dev --url https://example.com"],
    };
  }

  const options = parseArgs(argsList);
  const tabId = options.tab ?? "cli";

  if (commandName === "snapshot") {
    return service.snapshotUrl(tabId, required(options, "url"));
  }

  if (commandName === "run") {
    const url = required(options, "url");
    const createdAt = new Date().toISOString();
    const plan: ScoutPlan = {
      id: `cli-scout-plan-${Date.now()}`,
      title: `CLI Scout: ${url}`,
      target_node_ids: [],
      candidate_queries: [url],
      discovery_mode: "direct_url",
      source_type_targets: ["webpage", "document"],
      priority: "medium",
      stop_conditions: ["Return observation intake only."],
      deduplication_notes: ["CLI run has no persistent dedupe state."],
      created_at: createdAt,
    };
    const request: ScoutRunRequest = {
      tab_id: tabId,
      plan,
      requested_at: createdAt,
    };
    return service.run(request);
  }

  throw new Error(`Unknown seekstar-scout command: ${commandName}`);
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
