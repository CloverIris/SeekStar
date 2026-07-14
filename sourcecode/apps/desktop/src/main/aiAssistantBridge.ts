import { ipcMain } from "electron";
import { AiCartographerService, type AiAssistantInput, type AiAssistantOutput } from "@seekstar/ai-service";
import { settingsService } from "./settingsService.js";

export function registerAiAssistantBridge(): void {
  ipcMain.removeHandler("ai:assist");
  ipcMain.handle("ai:assist", async (_event, value): Promise<AiAssistantOutput> => {
    const input = parseAssistantInput(value);
    return new AiCartographerService(await settingsService.resolveActiveProviderConfig()).assist(input);
  });
}

function parseAssistantInput(value: unknown): AiAssistantInput {
  if (!value || typeof value !== "object") throw new Error("AI assistant input is required.");
  const input = value as Partial<AiAssistantInput>;
  if (typeof input.prompt !== "string" || !input.prompt.trim()) throw new Error("AI assistant prompt is required.");
  return { ...input, intent: input.intent ?? "answer_question", prompt: input.prompt.trim() } as AiAssistantInput;
}
