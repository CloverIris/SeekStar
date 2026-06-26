#!/usr/bin/env node
import { readFileSync } from "node:fs";
import {
  listLevelRuntimeProfiles,
  resolveLevelModuleDefinition,
  resolveLevelRuntimeProfile,
  runLevelRuntime,
  validateLevelRuntimeOutput,
  type LevelBandId,
  type LevelRuntimeInput,
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
        "run --input input.json|-",
        "validate --input output.json|-",
        "profiles",
        "profile --id seekstar-default-p6-gallery-v3",
        "module --level L0 [--profile seekstar-default-p6-gallery-v3]",
      ],
    };
  }

  const options = parseArgs(argsList);

  if (commandName === "profiles") {
    return listLevelRuntimeProfiles().map((profile) => ({
      id: profile.id,
      label: profile.label,
      language: profile.language,
      density: profile.density,
      levels: Object.keys(profile.modules),
    }));
  }

  if (commandName === "profile") {
    return resolveLevelRuntimeProfile(options.id);
  }

  if (commandName === "module") {
    return resolveLevelModuleDefinition(parseLevelId(required(options, "level")), options.profile);
  }

  if (commandName === "run") {
    const input = readJson<LevelRuntimeInput>(required(options, "input"));
    const output = await runLevelRuntime(input);
    const validation = validateLevelRuntimeOutput(output);

    return {
      ...output,
      validation,
    };
  }

  if (commandName === "validate") {
    const output = readJson<Awaited<ReturnType<typeof runLevelRuntime>>>(required(options, "input"));
    return validateLevelRuntimeOutput(output);
  }

  throw new Error(`Unknown seekstar-level-runtime command: ${commandName}`);
}

function parseLevelId(value: string): LevelBandId {
  if (
    value === "supra_macro" ||
    value === "L0" ||
    value === "L1" ||
    value === "L2" ||
    value === "L3" ||
    value === "deep_lens" ||
    value === "recursive_seed"
  ) {
    return value;
  }

  throw new Error(`Unknown level id: ${value}`);
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
