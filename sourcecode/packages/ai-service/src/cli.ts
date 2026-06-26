#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { assertValidTerrainScene } from "@seekstar/core-schema";
import type { TerrainScene } from "@seekstar/core-schema";
import {
  AiCartographerService,
  UnconfiguredAiService,
  buildAssistantMessages,
  buildCartographerMessages,
  resolveAiProviderConfig,
  validateAssistantOutput,
  validateCartographerGenerationOutput,
  type AiProviderConfig,
  type AiAssistantInput,
  type CartographerGenerationInput,
} from "./index.js";

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
        "status [--provider mock|openai-compatible] [--base-url url] [--model model] [--api-key-env ENV]",
        "generate --input input.json|- [--provider mock|openai-compatible] [--base-url url] [--model model] [--api-key-env ENV]",
        "prompt --input input.json|-",
        "assist --input input.json|- [--provider mock|openai-compatible]",
        "assistant-prompt --input input.json|-",
        "validate --input output.json|-",
        "build-context --scene scene.json [--selection node-a,node-b] [--prompt text]",
      ],
    };
  }

  if (commandName === "status") {
    const service = new AiCartographerService(parseProviderConfig(parseArgs(argsList)));
    return { status: await service.status() };
  }

  if (commandName === "generate") {
    const options = parseArgs(argsList);
    const input = readJson<CartographerGenerationInput>(required(options, "input"));
    const service = new AiCartographerService(parseProviderConfig(options));
    return service.generate(input);
  }

  if (commandName === "prompt") {
    const options = parseArgs(argsList);
    const input = readJson<CartographerGenerationInput>(required(options, "input"));

    return {
      messages: buildCartographerMessages(input),
    };
  }

  if (commandName === "assist") {
    const options = parseArgs(argsList);
    const input = readJson<AiAssistantInput>(required(options, "input"));
    const service = new AiCartographerService(parseProviderConfig(options));
    return service.assist(input);
  }

  if (commandName === "assistant-prompt") {
    const options = parseArgs(argsList);
    const input = readJson<AiAssistantInput>(required(options, "input"));

    return {
      messages: buildAssistantMessages(input),
    };
  }

  if (commandName === "validate") {
    const options = parseArgs(argsList);
    const value = readJson<unknown>(required(options, "input"));
    const fallbackInput: CartographerGenerationInput = {
      mode: "bootstrap_seed",
      level_id: "L0",
      seed: "validation",
    };
    return validateCartographerGenerationOutput(value, fallbackInput);
  }

  if (commandName === "validate-assistant") {
    const options = parseArgs(argsList);
    const value = readJson<unknown>(required(options, "input"));
    const fallbackInput: AiAssistantInput = {
      intent: "answer_question",
      prompt: "validation",
    };
    return validateAssistantOutput(value, fallbackInput);
  }

  if (commandName === "build-context") {
    const service = new UnconfiguredAiService();
    const options = parseArgs(argsList);
    const scene = assertValidTerrainScene(readJson<TerrainScene>(required(options, "scene")), "seekstar-ai:scene");
    const selection = options.selection ? options.selection.split(",").filter(Boolean) : scene.selection.node_ids;
    return service.buildContext(scene, selection, options.prompt);
  }

  throw new Error(`Unknown seekstar-ai command: ${commandName}`);
}

function parseArgs(argsList: string[]): Record<string, string> {
  const parsed: Record<string, string> = {};

  for (let index = 0; index < argsList.length; index += 1) {
    const key = argsList[index];

    if (!key?.startsWith("--")) {
      throw new Error(`Invalid argument pair near "${key ?? ""}".`);
    }

    const value = argsList[index + 1];

    if (!value || value.startsWith("--")) {
      throw new Error(`Missing value for "${key}".`);
    }

    parsed[key.slice(2)] = value;
    index += 1;
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

function readJson<T>(pathOrDash: string): T {
  const text = pathOrDash === "-" ? readFileSync(0, "utf8") : readFileSync(pathOrDash, "utf8");

  return JSON.parse(text) as T;
}

function parseProviderConfig(options: Record<string, string>): AiProviderConfig {
  const providerOption = options.provider;
  const kind = providerOption === "mock" ? "mock" : "openai_compatible";
  const timeoutMs = options.timeout ? Number.parseInt(options.timeout, 10) : undefined;
  const retryAttempts = options.retries ? Number.parseInt(options.retries, 10) : undefined;

  return resolveAiProviderConfig({
    kind,
    id: options["provider-id"] ?? (kind === "mock" ? "mock-cartographer" : "openai-compatible"),
    base_url: options["base-url"],
    model: options.model,
    api_key_ref: options["api-key-env"] ? { kind: "env", name: options["api-key-env"] } : undefined,
    timeout_ms: typeof timeoutMs === "number" && Number.isFinite(timeoutMs) ? timeoutMs : undefined,
    retry: typeof retryAttempts === "number" && Number.isFinite(retryAttempts) ? { attempts: retryAttempts, backoff_ms: 250 } : undefined,
  });
}
