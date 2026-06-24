import type { SourceState } from "@seekstar/core-schema";
import type { SelectionBasketItem } from "./selectionBasket";

export type MockRegionActionKind = "explain" | "questions" | "learning_path" | "compare" | "export";

export interface MockRegionActionResult {
  id: string;
  itemId: string;
  kind: MockRegionActionKind;
  title: string;
  body: string;
  createdAt: string;
  nodeCount: number;
  sourceState: SourceState;
}

let actionCounter = 0;

export function createMockRegionActionResult(
  item: SelectionBasketItem,
  kind: MockRegionActionKind,
): MockRegionActionResult {
  const createdAt = new Date().toISOString();
  actionCounter += 1;

  return {
    id: `mock-action-${kind}-${actionCounter}-${Date.now()}`,
    itemId: item.id,
    kind,
    title: buildActionTitle(item, kind),
    body: buildActionBody(item, kind),
    createdAt,
    nodeCount: item.nodeIds.length,
    sourceState: "generated",
  };
}

function buildActionTitle(item: SelectionBasketItem, kind: MockRegionActionKind): string {
  if (kind === "compare") {
    return `Mock comparison brief: ${item.title}`;
  }

  if (kind === "questions") {
    return `Mock question set: ${item.title}`;
  }

  if (kind === "learning_path") {
    return `Mock learning path: ${item.title}`;
  }

  if (kind === "export") {
    return `Mock Markdown preview: ${item.title}`;
  }

  return `Mock region explanation: ${item.title}`;
}

function buildActionBody(item: SelectionBasketItem, kind: MockRegionActionKind): string {
  const nodeSummary = `${item.nodeIds.length} selected node${item.nodeIds.length === 1 ? "" : "s"}`;
  const stateSummary = item.sourceStates.length > 0 ? item.sourceStates.join(", ") : "generated";

  if (kind === "compare") {
    return `${nodeSummary} are held as a local comparison set. This preview only notes visible terrain roles and source states (${stateSummary}); it does not claim factual contrast or cite external evidence yet.`;
  }

  if (kind === "questions") {
    return `${nodeSummary} are being treated as a spatial prompt for generated next questions. This fallback note should only appear if the structured cartographer job path is unavailable. Source states: ${stateSummary}.`;
  }

  if (kind === "learning_path") {
    return `${nodeSummary} are being treated as a spatial prompt for a mock learning path. This fallback note should only appear if the structured terrain job path is unavailable. Source states: ${stateSummary}.`;
  }

  if (kind === "export") {
    return `# ${item.title}\n\n- Scope: ${nodeSummary}\n- Source state: ${stateSummary}\n- Status: mock generated preview only\n\nFuture Markdown export will require source-backed snippets and provenance before writing a file.`;
  }

  return `${nodeSummary} are being treated as a spatial prompt. This mock cartographer note preserves orientation around "${item.title}" and keeps unsourced or fog content marked as generated until a real Region Explainer exists.`;
}
