import { app, ipcMain } from "electron";
import type { AiAssistantAction, AiAssistantActionType, AiAssistantOutput } from "@seekstar/ai-service";
import type { TerrainScene } from "@seekstar/core-schema";
import { mkdir, readFile, rename, rm, unlink, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

const ASSISTANT_SESSION_FILE_NAME = "seekstar-assistant-sessions.json";
const MAX_TURNS_PER_TAB = 24;
const MAX_OPERATIONS_PER_TAB = 48;

export interface AssistantSessionTurn {
  id: string;
  prompt: string;
  output: AiAssistantOutput;
  timestamp: string;
}

export interface AssistantSessionOperation {
  action?: AiAssistantAction;
  action_type?: AiAssistantActionType;
  approved_at?: string;
  completed_at?: string;
  id: string;
  label: string;
  level_id?: string;
  message: string;
  permission_status: "approved_by_click" | "denied" | "not_required";
  requested_at?: string;
  seed?: string;
  status: "running" | "done" | "error";
  target_id?: string;
  timestamp: string;
  redo_completed_at?: string;
  redo_requested_at?: string;
  undo_completed_at?: string;
  undo_context?: AssistantSessionOperationUndoContext;
  undo_message?: string;
  undo_requested_at?: string;
  undo_status: "not_available" | "available" | "undone" | "failed";
}

export type AssistantSessionOperationUndoContext =
  | AssistantSessionRestoreViewportSelectionUndoContext
  | AssistantSessionCloseCreatedTabUndoContext
  | AssistantSessionRestoreSceneSnapshotUndoContext
  | AssistantSessionRestoreSceneDiffUndoContext;

export interface AssistantSessionRestoreViewportSelectionUndoContext {
  focus_node_id?: string;
  kind: "restore_viewport_selection";
  selected_node_ids: string[];
  tab_id: string;
  viewport: {
    layer: string;
    x: number;
    y: number;
    zoom: number;
  };
}

export interface AssistantSessionCloseCreatedTabUndoContext {
  created_tab_id: string;
  focus_node_id?: string;
  kind: "close_created_tab";
  origin_tab_id: string;
  selected_node_ids: string[];
}

export interface AssistantSessionRestoreSceneSnapshotUndoContext {
  kind: "restore_scene_snapshot";
  scene_snapshot: TerrainScene;
  tab_id: string;
}

export interface AssistantSessionRestoreSceneDiffUndoContext {
  kind: "restore_scene_diff";
  patch: AssistantSessionSceneRollbackPatch;
  tab_id: string;
}

export interface AssistantSessionSceneRollbackPatch {
  collections: {
    agent_jobs: AssistantSessionCollectionRollback<TerrainScene["agent_jobs"][number]>;
    cartographer_outputs: AssistantSessionCollectionRollback<TerrainScene["cartographer_outputs"][number]>;
    nodes: AssistantSessionCollectionRollback<TerrainScene["nodes"][number]>;
    relations: AssistantSessionCollectionRollback<TerrainScene["relations"][number]>;
    scout_observations: AssistantSessionCollectionRollback<NonNullable<TerrainScene["scout_observations"]>[number]>;
    sources: AssistantSessionCollectionRollback<TerrainScene["sources"][number]>;
  };
  scene_fields: Pick<TerrainScene, "active_tab_id" | "id" | "layers" | "metadata" | "runtime" | "selection" | "tabs" | "viewport">;
}

export interface AssistantSessionCollectionRollback<TItem extends { id: string }> {
  added_ids: string[];
  order: string[];
  restored_items: TItem[];
}

export interface AssistantSessionSnapshot {
  tab_id: string;
  turns: AssistantSessionTurn[];
  operations: AssistantSessionOperation[];
  updated_at: string;
}

interface AssistantSessionStoreFile {
  version: 1;
  sessions: Record<string, AssistantSessionSnapshot>;
}

let assistantSessionSaveChain: Promise<void> = Promise.resolve();

export function registerAssistantSessionStore(): void {
  ipcMain.removeHandler("assistant-session:load");
  ipcMain.removeHandler("assistant-session:save");
  ipcMain.removeHandler("assistant-session:clear");

  ipcMain.handle("assistant-session:load", async (_event, tabId: unknown): Promise<AssistantSessionSnapshot> => {
    const normalizedTabId = parseTabId(tabId);
    const store = await loadAssistantSessionStore();

    return store.sessions[normalizedTabId] ?? createEmptyAssistantSession(normalizedTabId);
  });

  ipcMain.handle("assistant-session:save", async (_event, snapshot: unknown): Promise<AssistantSessionSnapshot> => {
    const normalized = normalizeAssistantSessionSnapshot(snapshot);
    const store = await loadAssistantSessionStore();
    const nextStore: AssistantSessionStoreFile = {
      version: 1,
      sessions: {
        ...store.sessions,
        [normalized.tab_id]: normalized,
      },
    };

    await saveAssistantSessionStore(nextStore);
    return normalized;
  });

  ipcMain.handle("assistant-session:clear", async (_event, tabId: unknown): Promise<AssistantSessionSnapshot> => {
    const normalizedTabId = parseTabId(tabId);
    const store = await loadAssistantSessionStore();
    const nextSessions = { ...store.sessions };
    delete nextSessions[normalizedTabId];

    await saveAssistantSessionStore({
      version: 1,
      sessions: nextSessions,
    });

    return createEmptyAssistantSession(normalizedTabId);
  });
}

export function getAssistantSessionStorePath(): string {
  return join(app.getPath("userData"), ASSISTANT_SESSION_FILE_NAME);
}

export async function clearAssistantSessionData(): Promise<void> {
  await unlinkIfPresent(getAssistantSessionStorePath());
}

async function loadAssistantSessionStore(): Promise<AssistantSessionStoreFile> {
  const storePath = getAssistantSessionStorePath();

  try {
    const content = await readFile(storePath, "utf8");

    try {
      return normalizeAssistantSessionStore(JSON.parse(content));
    } catch (error) {
      if (isJsonParseError(error)) {
        await quarantineCorruptJson(storePath, error);
        return createEmptyAssistantSessionStore();
      }

      throw error;
    }
  } catch (error) {
    if (isMissingFileError(error)) {
      return createEmptyAssistantSessionStore();
    }

    throw error;
  }
}

function saveAssistantSessionStore(store: AssistantSessionStoreFile): Promise<void> {
  const normalized = normalizeAssistantSessionStore(store);
  const nextSave = assistantSessionSaveChain.catch(() => undefined).then(() => writeAssistantSessionStore(normalized));
  assistantSessionSaveChain = nextSave;
  return nextSave;
}

async function writeAssistantSessionStore(store: AssistantSessionStoreFile): Promise<void> {
  const storePath = getAssistantSessionStorePath();
  const tmpPath = createTempJsonPath(storePath);

  await mkdir(dirname(storePath), { recursive: true });
  await writeFile(tmpPath, JSON.stringify(store, null, 2), "utf8");
  await replaceFile(tmpPath, storePath);
}

function normalizeAssistantSessionStore(value: unknown): AssistantSessionStoreFile {
  const candidate = typeof value === "object" && value !== null ? (value as Partial<AssistantSessionStoreFile>) : {};
  const sessions = typeof candidate.sessions === "object" && candidate.sessions !== null ? candidate.sessions : {};
  const normalizedSessions: Record<string, AssistantSessionSnapshot> = {};

  for (const [key, value] of Object.entries(sessions)) {
    try {
      const session = normalizeAssistantSessionSnapshot({
        ...(typeof value === "object" && value !== null ? value : {}),
        tab_id: key,
      });

      normalizedSessions[session.tab_id] = session;
    } catch {
      // Ignore malformed assistant session records. They are non-critical UI history.
    }
  }

  return {
    version: 1,
    sessions: normalizedSessions,
  };
}

function normalizeAssistantSessionSnapshot(value: unknown): AssistantSessionSnapshot {
  const candidate = typeof value === "object" && value !== null ? (value as Partial<AssistantSessionSnapshot>) : {};
  const tabId = parseTabId(candidate.tab_id);
  const turns = Array.isArray(candidate.turns)
    ? candidate.turns.map(normalizeAssistantSessionTurn).filter((turn): turn is AssistantSessionTurn => Boolean(turn)).slice(0, MAX_TURNS_PER_TAB)
    : [];
  const operations = Array.isArray(candidate.operations)
    ? candidate.operations.map(normalizeAssistantSessionOperation).filter((operation): operation is AssistantSessionOperation => Boolean(operation)).slice(0, MAX_OPERATIONS_PER_TAB)
    : [];

  return {
    tab_id: tabId,
    turns,
    operations,
    updated_at: typeof candidate.updated_at === "string" ? candidate.updated_at : new Date().toISOString(),
  };
}

function normalizeAssistantSessionTurn(value: unknown): AssistantSessionTurn | undefined {
  const candidate = typeof value === "object" && value !== null ? (value as Partial<AssistantSessionTurn>) : {};

  if (!candidate.id || !candidate.prompt || typeof candidate.output !== "object" || candidate.output === null) {
    return undefined;
  }

  return {
    id: String(candidate.id),
    prompt: String(candidate.prompt).slice(0, 4_000),
    output: candidate.output as AiAssistantOutput,
    timestamp: typeof candidate.timestamp === "string" ? candidate.timestamp : new Date().toISOString(),
  };
}

function normalizeAssistantSessionOperation(value: unknown): AssistantSessionOperation | undefined {
  const candidate = typeof value === "object" && value !== null ? (value as Partial<AssistantSessionOperation>) : {};

  if (!candidate.id || !candidate.label || !isAssistantOperationStatus(candidate.status)) {
    return undefined;
  }

  return {
    action: normalizeAssistantAction(candidate.action),
    action_type: isAssistantActionType(candidate.action_type) ? candidate.action_type : undefined,
    approved_at: typeof candidate.approved_at === "string" ? candidate.approved_at : undefined,
    completed_at: typeof candidate.completed_at === "string" ? candidate.completed_at : undefined,
    id: String(candidate.id),
    label: String(candidate.label).slice(0, 240),
    level_id: typeof candidate.level_id === "string" ? candidate.level_id.slice(0, 80) : undefined,
    message: typeof candidate.message === "string" ? candidate.message.slice(0, 1_000) : "",
    permission_status: isAssistantPermissionStatus(candidate.permission_status) ? candidate.permission_status : "not_required",
    requested_at: typeof candidate.requested_at === "string" ? candidate.requested_at : undefined,
    seed: typeof candidate.seed === "string" ? candidate.seed.slice(0, 240) : undefined,
    status: candidate.status,
    target_id: typeof candidate.target_id === "string" ? candidate.target_id.slice(0, 240) : undefined,
    timestamp: typeof candidate.timestamp === "string" ? candidate.timestamp : new Date().toISOString(),
    redo_completed_at: typeof candidate.redo_completed_at === "string" ? candidate.redo_completed_at : undefined,
    redo_requested_at: typeof candidate.redo_requested_at === "string" ? candidate.redo_requested_at : undefined,
    undo_completed_at: typeof candidate.undo_completed_at === "string" ? candidate.undo_completed_at : undefined,
    undo_context: normalizeAssistantOperationUndoContext(candidate.undo_context),
    undo_message: typeof candidate.undo_message === "string" ? candidate.undo_message.slice(0, 1_000) : undefined,
    undo_requested_at: typeof candidate.undo_requested_at === "string" ? candidate.undo_requested_at : undefined,
    undo_status: isAssistantUndoStatus(candidate.undo_status) ? candidate.undo_status : "not_available",
  };
}

function normalizeAssistantAction(value: unknown): AiAssistantAction | undefined {
  if (typeof value !== "object" || value === null) {
    return undefined;
  }

  const candidate = value as Partial<AiAssistantAction>;

  if (!isAssistantActionType(candidate.type)) {
    return undefined;
  }

  return {
    ...candidate,
    arguments: normalizeAssistantActionArguments(candidate.arguments),
    label: typeof candidate.label === "string" ? candidate.label.slice(0, 240) : candidate.type.replace(/_/g, " "),
    level_id: typeof candidate.level_id === "string" ? candidate.level_id.slice(0, 80) : undefined,
    seed: typeof candidate.seed === "string" ? candidate.seed.slice(0, 240) : undefined,
    target_id: typeof candidate.target_id === "string" ? candidate.target_id.slice(0, 240) : undefined,
    type: candidate.type,
  };
}

function normalizeAssistantActionArguments(value: unknown): AiAssistantAction["arguments"] {
  if (typeof value !== "object" || value === null) {
    return undefined;
  }

  const args: Record<string, string | number | boolean> = {};

  for (const [key, entry] of Object.entries(value)) {
    if (typeof entry === "string" || typeof entry === "number" || typeof entry === "boolean") {
      args[key.slice(0, 120)] = typeof entry === "string" ? entry.slice(0, 1_000) : entry;
    }
  }

  return Object.keys(args).length > 0 ? args : undefined;
}

function normalizeAssistantOperationUndoContext(value: unknown): AssistantSessionOperationUndoContext | undefined {
  const candidate = typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};

  if (candidate.kind === "close_created_tab") {
    if (typeof candidate.created_tab_id !== "string" || typeof candidate.origin_tab_id !== "string") {
      return undefined;
    }

    return {
      created_tab_id: candidate.created_tab_id.slice(0, 240),
      focus_node_id: typeof candidate.focus_node_id === "string" ? candidate.focus_node_id.slice(0, 240) : undefined,
      kind: "close_created_tab",
      origin_tab_id: candidate.origin_tab_id.slice(0, 240),
      selected_node_ids: Array.isArray(candidate.selected_node_ids)
        ? candidate.selected_node_ids.filter((nodeId): nodeId is string => typeof nodeId === "string").slice(0, 120)
        : [],
    };
  }

  if (candidate.kind === "restore_scene_snapshot") {
    if (typeof candidate.tab_id !== "string" || typeof candidate.scene_snapshot !== "object" || candidate.scene_snapshot === null) {
      return undefined;
    }

    return {
      kind: "restore_scene_snapshot",
      scene_snapshot: candidate.scene_snapshot as TerrainScene,
      tab_id: candidate.tab_id.slice(0, 240),
    };
  }

  if (candidate.kind === "restore_scene_diff") {
    if (typeof candidate.tab_id !== "string" || typeof candidate.patch !== "object" || candidate.patch === null) {
      return undefined;
    }

    return {
      kind: "restore_scene_diff",
      patch: candidate.patch as AssistantSessionSceneRollbackPatch,
      tab_id: candidate.tab_id.slice(0, 240),
    };
  }

  if (candidate.kind !== "restore_viewport_selection" || typeof candidate.tab_id !== "string" || !candidate.viewport) {
    return undefined;
  }

  const viewport = typeof candidate.viewport === "object" && candidate.viewport !== null
    ? candidate.viewport as Partial<AssistantSessionRestoreViewportSelectionUndoContext["viewport"]>
    : {};

  return {
    focus_node_id: typeof candidate.focus_node_id === "string" ? candidate.focus_node_id.slice(0, 240) : undefined,
    kind: "restore_viewport_selection",
    selected_node_ids: Array.isArray(candidate.selected_node_ids)
      ? candidate.selected_node_ids.filter((nodeId): nodeId is string => typeof nodeId === "string").slice(0, 120)
      : [],
    tab_id: candidate.tab_id.slice(0, 240),
    viewport: {
      layer: typeof viewport.layer === "string" ? viewport.layer.slice(0, 40) : "L0",
      x: normalizeFiniteNumber(viewport.x),
      y: normalizeFiniteNumber(viewport.y),
      zoom: normalizeFiniteNumber(viewport.zoom),
    },
  };
}

function createEmptyAssistantSession(tabId: string): AssistantSessionSnapshot {
  return {
    tab_id: tabId,
    turns: [],
    operations: [],
    updated_at: new Date().toISOString(),
  };
}

function createEmptyAssistantSessionStore(): AssistantSessionStoreFile {
  return {
    version: 1,
    sessions: {},
  };
}

function parseTabId(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error("Assistant session tab id must be a non-empty string.");
  }

  return value.trim().slice(0, 240);
}

function isAssistantOperationStatus(value: unknown): value is AssistantSessionOperation["status"] {
  return value === "running" || value === "done" || value === "error";
}

function isAssistantPermissionStatus(value: unknown): value is AssistantSessionOperation["permission_status"] {
  return value === "approved_by_click" || value === "denied" || value === "not_required";
}

function isAssistantUndoStatus(value: unknown): value is AssistantSessionOperation["undo_status"] {
  return value === "not_available" || value === "available" || value === "undone" || value === "failed";
}

function normalizeFiniteNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function isAssistantActionType(value: unknown): value is AiAssistantActionType {
  return (
    value === "none" ||
    value === "focus_node" ||
    value === "request_chunk" ||
    value === "observe_source" ||
    value === "create_seed" ||
    value === "open_settings"
  );
}

function createTempJsonPath(path: string): string {
  return `${path}.${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}.tmp`;
}

async function unlinkIfPresent(path: string): Promise<void> {
  try {
    await unlink(path);
  } catch (error) {
    if (!isMissingFileError(error)) {
      throw error;
    }
  }
}

async function replaceFile(sourcePath: string, destinationPath: string): Promise<void> {
  try {
    await rename(sourcePath, destinationPath);
  } catch (error) {
    if (!isReplaceFailure(error)) {
      throw error;
    }

    await rm(destinationPath, { force: true });
    await rename(sourcePath, destinationPath);
  }
}

function isReplaceFailure(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && (error.code === "EPERM" || error.code === "EEXIST");
}

function isMissingFileError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
}

function isJsonParseError(error: unknown): boolean {
  return error instanceof SyntaxError;
}

async function quarantineCorruptJson(path: string, error: unknown): Promise<void> {
  const quarantinePath = `${path}.corrupt-${Date.now()}`;

  try {
    await rename(path, quarantinePath);
    console.warn(`[SeekStar] Ignored corrupt assistant session JSON and moved it to ${quarantinePath}: ${getErrorMessage(error)}`);
  } catch (renameError) {
    console.warn(`[SeekStar] Failed to quarantine corrupt assistant session JSON at ${path}: ${getErrorMessage(renameError)}`);
  }
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
