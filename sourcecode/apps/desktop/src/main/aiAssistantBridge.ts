import { ipcMain } from "electron";
import {
  AiCartographerService,
  buildCartographerMessages,
  type AiAssistantInput,
  type AiAssistantOutput,
  type AiModelMessage,
  type CartographerGenerationInput,
  type CartographerGenerationMode,
  type CartographerGenerationOutput,
} from "@seekstar/ai-service";
import { createLevelChunkKey, runLevelRuntime, type LevelBandId } from "@seekstar/level-runtime";
import { loadSettings, resolveActiveAiProviderConfig, resolveCartographerLevelRuntimeSettings } from "./appSettingsStore.js";
import { appendAiCostLedgerRecord } from "./aiCostLedgerStore.js";

export interface AiCartographerPromptPreviewRequest {
  focus?: {
    excerpt?: string;
    id?: string;
    level_id?: string;
    title: string;
  };
  level_id?: LevelBandId;
  mode?: CartographerGenerationMode;
  seed?: string;
}

export interface AiCartographerPromptPreviewResult {
  generated_at: string;
  level_id: LevelBandId;
  messages: AiModelMessage[];
  mode: CartographerGenerationMode;
  model?: string;
  prompt_revision: string;
  provider_id: string;
  request: CartographerGenerationInput;
  seed: string;
}

export function registerAiAssistantBridge(): void {
  ipcMain.removeHandler("ai:assist");
  ipcMain.removeHandler("ai:preview-cartographer-prompt");
  ipcMain.handle("ai:preview-cartographer-prompt", async (_event, input): Promise<AiCartographerPromptPreviewResult> => {
    const settings = await loadSettings();
    const preview = parsePromptPreviewRequest(input);
    const provider = resolveActiveAiProviderConfig(settings);
    const runtimeSettings = resolveCartographerLevelRuntimeSettings(settings);
    let capturedInput: CartographerGenerationInput | undefined;

    await runLevelRuntime(
      {
        chunk: createLevelChunkKey(0, 0, 0),
        focus: preview.focus,
        level_id: preview.level_id,
        mode: preview.mode,
        seed: preview.seed,
        settings: runtimeSettings,
      },
      {
        generate: async (generationInput): Promise<CartographerGenerationOutput> => {
          capturedInput = generationInput;

          return {
            diagnostics: [],
            generated_at: new Date().toISOString(),
            level_id: generationInput.level_id,
            mode: generationInput.mode,
            nodes: [],
            provider_id: provider.id,
            relations: [],
            seed: generationInput.seed,
            source_candidates: [],
            status: "ok",
          };
        },
      },
    );

    const request = capturedInput ?? {
      chunk: { x: 0, y: 0, z: 0, key: "0:0:0:0" },
      level_id: preview.level_id,
      mode: preview.mode,
      seed: preview.seed,
      settings: runtimeSettings as Record<string, unknown>,
    };

    return {
      generated_at: new Date().toISOString(),
      level_id: preview.level_id,
      messages: buildCartographerMessages(request),
      mode: preview.mode,
      model: provider.model,
      prompt_revision: createPromptPreviewRevision(request),
      provider_id: provider.id,
      request,
      seed: preview.seed,
    };
  });
  ipcMain.handle("ai:assist", async (_event, input): Promise<AiAssistantOutput> => {
    const settings = await loadSettings();
    const service = new AiCartographerService(resolveActiveAiProviderConfig(settings));
    const parsedInput = parseAssistantInput(input);
    const output = await service.assist(parsedInput);

    await appendAiCostLedgerRecord({
      intent: output.intent,
      model: output.model,
      provider_id: output.provider_id,
      seed: parsedInput.seed,
      source: "assistant",
      status: output.status,
      tab_id: parseAssistantTabId(parsedInput),
      telemetry: output.telemetry,
    });

    return output;
  });
}

function parsePromptPreviewRequest(value: unknown): Required<Pick<AiCartographerPromptPreviewRequest, "level_id" | "mode" | "seed">> & {
  focus?: AiCartographerPromptPreviewRequest["focus"];
} {
  const candidate = typeof value === "object" && value !== null ? (value as AiCartographerPromptPreviewRequest) : {};
  const levelId = parseLevelBandId(candidate.level_id);

  return {
    focus: parsePreviewFocus(candidate.focus),
    level_id: levelId,
    mode: parseGenerationMode(candidate.mode, levelId),
    seed: typeof candidate.seed === "string" && candidate.seed.trim() ? candidate.seed.trim().slice(0, 160) : "CPU",
  };
}

function parseLevelBandId(value: unknown): LevelBandId {
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

  return "L0";
}

function parseGenerationMode(value: unknown, levelId: LevelBandId): CartographerGenerationMode {
  if (
    value === "bootstrap_seed" ||
    value === "expand_horizontal" ||
    value === "decompose_down" ||
    value === "summarize_up" ||
    value === "replace_failed_source"
  ) {
    return value;
  }

  return levelId === "L0" ? "bootstrap_seed" : "decompose_down";
}

function parsePreviewFocus(value: unknown): AiCartographerPromptPreviewRequest["focus"] | undefined {
  if (typeof value !== "object" || value === null) {
    return undefined;
  }

  const candidate = value as NonNullable<AiCartographerPromptPreviewRequest["focus"]>;

  if (!candidate.title?.trim()) {
    return undefined;
  }

  return {
    excerpt: normalizeOptionalString(candidate.excerpt),
    id: normalizeOptionalString(candidate.id),
    level_id: normalizeOptionalString(candidate.level_id),
    title: candidate.title.trim().slice(0, 160),
  };
}

function createPromptPreviewRevision(input: CartographerGenerationInput): string {
  const text = JSON.stringify({
    context: input.context,
    level_id: input.level_id,
    mode: input.mode,
    seed: input.seed,
    settings: input.settings,
  });
  let hash = 0;

  for (let index = 0; index < text.length; index += 1) {
    hash = (hash * 31 + text.charCodeAt(index)) >>> 0;
  }

  return hash.toString(36);
}

function parseAssistantInput(value: unknown): AiAssistantInput {
  if (typeof value !== "object" || value === null) {
    throw new Error("AI assistant input must be an object.");
  }

  const candidate = value as Partial<AiAssistantInput>;

  return {
    intent: parseAssistantIntent(candidate.intent),
    prompt: typeof candidate.prompt === "string" && candidate.prompt.trim() ? candidate.prompt.trim() : "Explain the current map.",
    seed: normalizeOptionalString(candidate.seed),
    current_level: normalizeOptionalString(candidate.current_level),
    selected_nodes: Array.isArray(candidate.selected_nodes)
      ? candidate.selected_nodes.flatMap((node) => {
          if (typeof node !== "object" || node === null) {
            return [];
          }

          const item = node as NonNullable<AiAssistantInput["selected_nodes"]>[number];

          if (!item.id?.trim() || !item.title?.trim()) {
            return [];
          }

          return [
            {
              id: item.id.trim(),
              title: item.title.trim(),
              level_id: normalizeOptionalString(item.level_id),
              summary: normalizeOptionalString(item.summary),
              source_state: item.source_state,
            },
          ];
        })
      : undefined,
    available_operations: Array.isArray(candidate.available_operations)
      ? candidate.available_operations.filter((operation): operation is NonNullable<AiAssistantInput["available_operations"]>[number] =>
          operation === "none" ||
          operation === "focus_node" ||
          operation === "request_chunk" ||
          operation === "observe_source" ||
          operation === "create_seed" ||
          operation === "open_settings",
        )
      : ["focus_node", "request_chunk", "observe_source", "create_seed", "open_settings"],
    scene_summary: normalizeOptionalString(candidate.scene_summary),
    context: typeof candidate.context === "object" && candidate.context !== null ? candidate.context : undefined,
  };
}

function parseAssistantIntent(value: unknown): AiAssistantInput["intent"] {
  if (
    value === "answer_question" ||
    value === "navigate" ||
    value === "expand_map" ||
    value === "summarize_selection" ||
    value === "explain_source"
  ) {
    return value;
  }

  return "answer_question";
}

function normalizeOptionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function parseAssistantTabId(input: AiAssistantInput): string | undefined {
  const context = input.context;

  if (typeof context !== "object" || context === null) {
    return undefined;
  }

  const activeTabId = (context as Record<string, unknown>).active_tab_id;

  return normalizeOptionalString(activeTabId);
}
