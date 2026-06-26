import type {
  AgentJobStatus,
  CartographerOutput,
  ExplorationTab,
  LayerId,
  ScoutObservation,
  ScoutPlan,
  SourceRef,
  SourceState,
  TerrainNode,
  TerrainRelation,
  TerrainScene,
} from "@seekstar/core-schema";
import type { AiAssistantAction, AiAssistantActionType, AiAssistantOutput } from "@seekstar/ai-service";
import type { SeekStarSettings } from "../../../../main/appSettingsStore";
import type { SourceIngestionInput } from "@seekstar/constellation-engine";
import type { ChangeEvent, FormEvent, ReactElement } from "react";
import { useEffect, useState } from "react";
import { formatSourceState, formatTimestamp, getActiveLayer, getJobStatusCounts, getSourceForNode, getSourceRelationsForNode, getSourceStateCounts } from "../../exploration/types";
import type { SearchResult } from "../../search/localSceneSearch";
import type { SelectionBasketItem } from "../../selection/selectionBasket";
import { SearchResultsPanel } from "../SearchResultsPanel";
export function InspectorSidebar({
  activeTab,
  basketItems,
  onBacklinkFocus,
  onAddSource,
  onAssistantAction,
  onAssistantUndo,
  onConvertScoutObservation,
  onClearBasket,
  onClearSelection,
  onRemoveBasketItem,
  onRunScoutPlan,
  assistantActionPermissionMode,
  assistantActionPermissionRules,
  onObserveCandidate,
  onOpenCandidateAsSeek,
  onReplaceFailedSource,
  onScoutSourceLinks,
  onLayerSelect,
  onResetWorkspace,
  onSaveSelectionToTray,
  onSearchResultSelect,
  onUseNodeAsSeed,
  scene,
  searchQuery,
  searchResults,
  selectedNode,
  selectedNodes,
  selectedObservationId,
  selectedRelation,
  selectedRelationNodes,
}: {
  activeTab: ExplorationTab;
  assistantActionPermissionMode: SeekStarSettings["assistant_action_permission_mode"];
  assistantActionPermissionRules: SeekStarSettings["assistant_action_permission_rules"];
  basketItems: SelectionBasketItem[];
  onBacklinkFocus: (backlink: NonNullable<ExplorationTab["parent_backlink"]>) => void;
  onAddSource: (input: SourceIngestionInput) => void;
  onAssistantAction: (action: AiAssistantAction) => Promise<AssistantActionExecutionResult | void>;
  onAssistantUndo: (context: AssistantOperationUndoContext) => Promise<string | void>;
  onConvertScoutObservation: (observation: ScoutObservation) => void;
  onClearBasket: () => void;
  onClearSelection: () => void;
  onObserveCandidate: (observation: ScoutObservation) => void;
  onOpenCandidateAsSeek: (observation: ScoutObservation) => void;
  onReplaceFailedSource: (observation: ScoutObservation) => void;
  onRemoveBasketItem: (itemId: string) => void;
  onRunScoutPlan: (plan: ScoutPlan) => void;
  onScoutSourceLinks: (node: TerrainNode, source: SourceRef) => void;
  onLayerSelect: (layer: LayerId, focusNodeId?: string) => void;
  onResetWorkspace: () => void;
  onSaveSelectionToTray: () => void;
  onSearchResultSelect: (nodeId: string) => void;
  onUseNodeAsSeed: (node: TerrainNode) => void;
  scene: TerrainScene;
  searchQuery: string;
  searchResults: SearchResult[];
  selectedNode?: TerrainNode;
  selectedNodes: TerrainNode[];
  selectedObservationId?: string;
  selectedRelation?: TerrainRelation;
  selectedRelationNodes?: { from?: TerrainNode; to?: TerrainNode };
}): ReactElement {
  const fogCount = scene.nodes.filter((node) => node.type === "fog_region").length;
  const scoutObservations = scene.scout_observations ?? [];
  const contextTitle = selectedRelation ? "Relation" : selectedNodes.length > 1 ? "Selection" : selectedNode ? "Node" : searchQuery ? "Search" : "Map";
  const hasClearTarget = Boolean(selectedRelation || selectedNode || searchQuery);
  const shouldOpenSourceReview =
    Boolean(selectedObservationId) ||
    scoutObservations.some((observation) => observation.status === "source_candidate" || observation.status === "failed");

  return (
    <div className="inspector-sidebar">
      <header className="inspector-sidebar-header">
        <div>
          <span>AI Map Control</span>
          <small>{contextTitle}</small>
        </div>
        {hasClearTarget ? (
          <button aria-label="Clear selection" onClick={onClearSelection} type="button">
            Clear
          </button>
        ) : null}
      </header>
      <div className="inspector-sidebar-body">
        <AiMapAssistantPanel
          activeTab={activeTab}
          assistantActionPermissionMode={assistantActionPermissionMode}
          assistantActionPermissionRules={assistantActionPermissionRules}
          scene={scene}
          selectedNodes={selectedNodes}
          onAssistantAction={onAssistantAction}
          onAssistantUndo={onAssistantUndo}
        />
        <details className="inspector-context-section" open>
          <summary>
            <span>Map context</span>
            <small>{contextTitle}</small>
          </summary>
          {selectedRelation ? (
            <SelectedRelationPanel fromNode={selectedRelationNodes?.from} relation={selectedRelation} toNode={selectedRelationNodes?.to} />
          ) : selectedNodes.length > 1 ? (
            <SelectionRegionPanel nodes={selectedNodes} onSaveSelectionToTray={onSaveSelectionToTray} />
          ) : selectedNode ? (
            <SelectedNodePanel
              node={selectedNode}
              onNodeSelect={onSearchResultSelect}
              onScoutSourceLinks={onScoutSourceLinks}
              onLayerSelect={onLayerSelect}
              onSaveSelectionToTray={onSaveSelectionToTray}
              onUseNodeAsSeed={onUseNodeAsSeed}
              scene={scene}
            />
          ) : (
            <SceneOverviewPanel
              activeTab={activeTab}
              fogCount={fogCount}
              onBacklinkFocus={onBacklinkFocus}
              onResetWorkspace={onResetWorkspace}
              scene={scene}
            />
          )}
          <SearchResultsPanel query={searchQuery} results={searchResults} onResultSelect={onSearchResultSelect} />
        </details>
        {scoutObservations.length > 0 ? (
          <details className="inspector-source-section" open={shouldOpenSourceReview}>
            <summary>
              <span>Source review</span>
              <small>{scoutObservations.length} observations</small>
            </summary>
            <ScoutObservationPanel
              observations={scoutObservations}
              selectedObservationId={selectedObservationId}
              onConvertObservation={onConvertScoutObservation}
              onObserveCandidate={onObserveCandidate}
              onOpenCandidateAsSeek={onOpenCandidateAsSeek}
              onReplaceFailedSource={onReplaceFailedSource}
            />
          </details>
        ) : null}
        <details className="inspector-advanced-section">
          <summary>Advanced</summary>
          <CartographerOutputPanel
            observations={scene.scout_observations ?? []}
            outputs={scene.cartographer_outputs ?? []}
            scene={scene}
            onNodeSelect={onSearchResultSelect}
            onRunScoutPlan={onRunScoutPlan}
          />
          <SourceIngestionPanel onAddSource={onAddSource} />
          <SideTrayPanel
            items={basketItems}
            onClearBasket={onClearBasket}
            onRemoveItem={onRemoveBasketItem}
          />
        </details>
      </div>
    </div>
  );
}

interface AssistantOperationLogItem {
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
  undo_context?: AssistantOperationUndoContext;
  undo_message?: string;
  undo_requested_at?: string;
  undo_status: "not_available" | "available" | "undone" | "failed";
}

interface AssistantChatTurn {
  id: string;
  prompt: string;
  output: AiAssistantOutput;
  timestamp: string;
}

export type AssistantOperationUndoContext =
  | AssistantRestoreViewportSelectionUndoContext
  | AssistantCloseCreatedTabUndoContext
  | AssistantRestoreSceneSnapshotUndoContext
  | AssistantRestoreSceneDiffUndoContext;

export interface AssistantRestoreViewportSelectionUndoContext {
  focus_node_id?: string;
  kind: "restore_viewport_selection";
  selected_node_ids: string[];
  tab_id: string;
  viewport: TerrainScene["viewport"];
}

export interface AssistantCloseCreatedTabUndoContext {
  created_tab_id: string;
  focus_node_id?: string;
  kind: "close_created_tab";
  origin_tab_id: string;
  selected_node_ids: string[];
}

export interface AssistantRestoreSceneSnapshotUndoContext {
  kind: "restore_scene_snapshot";
  scene_snapshot: TerrainScene;
  tab_id: string;
}

export interface AssistantRestoreSceneDiffUndoContext {
  kind: "restore_scene_diff";
  patch: AssistantSceneRollbackPatch;
  tab_id: string;
}

export interface AssistantSceneRollbackPatch {
  collections: {
    agent_jobs: AssistantCollectionRollback<TerrainScene["agent_jobs"][number]>;
    cartographer_outputs: AssistantCollectionRollback<TerrainScene["cartographer_outputs"][number]>;
    nodes: AssistantCollectionRollback<TerrainNode>;
    relations: AssistantCollectionRollback<TerrainRelation>;
    scout_observations: AssistantCollectionRollback<ScoutObservation>;
    sources: AssistantCollectionRollback<SourceRef>;
  };
  scene_fields: Pick<TerrainScene, "active_tab_id" | "id" | "layers" | "metadata" | "runtime" | "selection" | "tabs" | "viewport">;
}

export interface AssistantCollectionRollback<TItem extends { id: string }> {
  added_ids: string[];
  order: string[];
  restored_items: TItem[];
}

export interface AssistantActionExecutionResult {
  message?: string;
  undo?: {
    context: AssistantOperationUndoContext;
    message: string;
  };
}

function AiMapAssistantPanel({
  activeTab,
  assistantActionPermissionMode,
  assistantActionPermissionRules,
  onAssistantAction,
  onAssistantUndo,
  scene,
  selectedNodes,
}: {
  activeTab: ExplorationTab;
  assistantActionPermissionMode: SeekStarSettings["assistant_action_permission_mode"];
  assistantActionPermissionRules: SeekStarSettings["assistant_action_permission_rules"];
  onAssistantAction: (action: AiAssistantAction) => Promise<AssistantActionExecutionResult | void>;
  onAssistantUndo: (context: AssistantOperationUndoContext) => Promise<string | void>;
  scene: TerrainScene;
  selectedNodes: TerrainNode[];
}): ReactElement {
  const [prompt, setPrompt] = useState("");
  const [status, setStatus] = useState<"idle" | "asking" | "error">("idle");
  const [actionStatus, setActionStatus] = useState<"idle" | "running" | "error" | "done">("idle");
  const [actionStatusMessage, setActionStatusMessage] = useState("");
  const [actionLog, setActionLog] = useState<AssistantOperationLogItem[]>([]);
  const [chatHistory, setChatHistory] = useState<AssistantChatTurn[]>([]);
  const [answer, setAnswer] = useState<AiAssistantOutput | undefined>();
  const [sessionHydrated, setSessionHydrated] = useState(false);
  const selectedForContext = selectedNodes.slice(0, 8).map((node) => ({
    id: node.id,
    title: node.title,
    level_id: node.layer,
    summary: node.summary,
    source_state: node.source_state,
  }));
  const layerNodeCount = scene.nodes.filter((node) => node.layer === scene.viewport.layer).length;
  const sourceBackedCount = scene.nodes.filter((node) => node.source_state === "source_backed").length;
  const candidateCount = scene.scout_observations?.filter((observation) => observation.status === "source_candidate").length ?? 0;
  const failedObservationCount = scene.scout_observations?.filter((observation) => observation.status === "failed" || observation.failure_reason).length ?? 0;
  const assistantContext = {
    layer: scene.viewport.layer,
    selection: selectedNodes.length,
    layerNodeCount,
    candidateCount,
    sourceBackedCount,
    failedObservationCount,
    permissionMode: formatAssistantPermissionMode(assistantActionPermissionMode),
  };
  const quickPrompts = createAssistantQuickPrompts(activeTab, selectedNodes, assistantContext);
  const canAsk = prompt.trim().length > 0 && status !== "asking";

  useEffect(() => {
    let cancelled = false;

    setSessionHydrated(false);

    void window.seekstar.ai
      .loadSession(activeTab.id)
      .then((session) => {
        if (cancelled) {
          return;
        }

        setChatHistory(session.turns);
        setActionLog(session.operations);
        setAnswer(session.turns[0]?.output);
        setActionStatus("idle");
        setActionStatusMessage("");
        setSessionHydrated(true);
      })
      .catch(() => {
        if (cancelled) {
          return;
        }

        setChatHistory([]);
        setActionLog([]);
        setAnswer(undefined);
        setActionStatus("error");
        setActionStatusMessage("Assistant history could not be loaded.");
        setSessionHydrated(true);
      });

    return () => {
      cancelled = true;
    };
  }, [activeTab.id]);

  useEffect(() => {
    if (!sessionHydrated) {
      return;
    }

    void window.seekstar.ai.saveSession({
      tab_id: activeTab.id,
      turns: chatHistory,
      operations: actionLog,
      updated_at: new Date().toISOString(),
    });
  }, [actionLog, activeTab.id, chatHistory, sessionHydrated]);

  async function handleAsk(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();

    if (!canAsk) {
      return;
    }

    setStatus("asking");
    const promptText = prompt.trim();

    try {
      const output = await window.seekstar.ai.assist({
        intent: selectedNodes.length > 0 ? "explain_source" : "answer_question",
        prompt: promptText,
        seed: activeTab.seed,
        current_level: scene.viewport.layer,
        selected_nodes: selectedForContext,
        available_operations: ["focus_node", "request_chunk", "observe_source", "create_seed", "open_settings"],
        scene_summary: createAssistantSceneSummary(scene),
        context: {
          active_tab_id: activeTab.id,
          active_tab_title: activeTab.title,
          observation_count: scene.scout_observations?.length ?? 0,
          source_count: scene.sources.length,
        },
      });

      setAnswer(output);
      setChatHistory((current) => [
        {
          id: `assistant-turn-${Date.now()}`,
          prompt: promptText,
          output,
          timestamp: new Date().toISOString(),
        },
        ...current,
      ].slice(0, 8));
      setActionStatus("idle");
      setActionStatusMessage("");
      setPrompt("");
      setStatus("idle");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      const output: AiAssistantOutput = {
        status: "provider_error",
        intent: "answer_question",
        answer: message,
        actions: [],
        diagnostics: [
          {
            severity: "error",
            code: "assistant.bridge_error",
            message,
          },
        ],
        generated_at: new Date().toISOString(),
      };

      setAnswer(output);
      setChatHistory((current) => [
        {
          id: `assistant-turn-${Date.now()}`,
          prompt: promptText,
          output,
          timestamp: new Date().toISOString(),
        },
        ...current,
      ].slice(0, 8));
      setStatus("error");
    }
  }

  async function handleAssistantAction(action: AiAssistantAction): Promise<void> {
    if (action.type === "none" || actionStatus === "running") {
      return;
    }

    const logId = `assistant-action-${Date.now()}`;
    const label = action.label || action.type.replace(/_/g, " ");
    const approvedAt = new Date().toISOString();

    setActionStatus("running");
    setActionStatusMessage(`Running ${label}...`);
    const permissionStatus = resolveAssistantPermissionStatus(action, assistantActionPermissionMode);
    const actionDecision = resolveAssistantActionPermissionDecision(action, assistantActionPermissionMode, assistantActionPermissionRules);

    setActionLog((current) => [
      {
        action,
        action_type: action.type,
        approved_at: approvedAt,
        id: logId,
        label,
        level_id: action.level_id,
        message: "Waiting for App Framework operation.",
        permission_status: actionDecision === "allow_after_click" ? "not_required" : permissionStatus,
        requested_at: approvedAt,
        seed: action.seed,
        status: "running" as const,
        target_id: action.target_id,
        timestamp: approvedAt,
        undo_status: "not_available" as const,
      },
      ...current,
    ].slice(0, 5));

    try {
      const result = await onAssistantAction(action);
      setActionStatus("done");
      setActionStatusMessage(`Done: ${label}`);
      setActionLog((current) =>
        current.map((item) =>
          item.id === logId
            ? {
                ...item,
                completed_at: new Date().toISOString(),
                message: result?.message ?? "Completed by the desktop shell.",
                status: "done",
                timestamp: new Date().toISOString(),
                undo_context: result?.undo?.context,
                undo_message: result?.undo?.message,
                undo_status: result?.undo ? "available" : "not_available",
              }
            : item,
        ),
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      setActionStatus("error");
      setActionStatusMessage(message);
      setActionLog((current) =>
        current.map((item) =>
          item.id === logId
            ? {
                ...item,
                completed_at: new Date().toISOString(),
                message,
                status: "error",
                timestamp: new Date().toISOString(),
                undo_status: "not_available",
              }
            : item,
        ),
      );
    }
  }

  async function handleUndoOperation(item: AssistantOperationLogItem): Promise<void> {
    if (!item.undo_context || item.undo_status !== "available") {
      return;
    }

    const requestedAt = new Date().toISOString();

    setActionStatus("running");
    setActionStatusMessage(`Undoing ${item.label}...`);
    setActionLog((current) =>
      current.map((candidate) =>
        candidate.id === item.id
          ? {
              ...candidate,
              undo_message: "Undo is running.",
              undo_requested_at: requestedAt,
            }
          : candidate,
      ),
    );

    try {
      const message = await onAssistantUndo(item.undo_context);
      const completedAt = new Date().toISOString();

      setActionStatus("done");
      setActionStatusMessage(`Undone: ${item.label}`);
      setActionLog((current) =>
        current.map((candidate) =>
          candidate.id === item.id
            ? {
                ...candidate,
                undo_completed_at: completedAt,
                undo_message: message ?? "Restored previous viewport and selection.",
                undo_status: "undone",
              }
            : candidate,
        ),
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      setActionStatus("error");
      setActionStatusMessage(message);
      setActionLog((current) =>
        current.map((candidate) =>
          candidate.id === item.id
            ? {
                ...candidate,
                undo_message: message,
                undo_status: "failed",
              }
            : candidate,
        ),
      );
    }
  }

  async function handleRedoOperation(item: AssistantOperationLogItem): Promise<void> {
    if (!item.action || item.undo_status !== "undone" || actionStatus === "running") {
      return;
    }

    const requestedAt = new Date().toISOString();

    setActionStatus("running");
    setActionStatusMessage(`Redoing ${item.label}...`);
    setActionLog((current) =>
      current.map((candidate) =>
        candidate.id === item.id
          ? {
              ...candidate,
              message: "Redo is running.",
              redo_requested_at: requestedAt,
              status: "running",
            }
          : candidate,
      ),
    );

    try {
      const result = await onAssistantAction(item.action);
      const completedAt = new Date().toISOString();

      setActionStatus("done");
      setActionStatusMessage(`Redone: ${item.label}`);
      setActionLog((current) =>
        current.map((candidate) =>
          candidate.id === item.id
            ? {
                ...candidate,
                completed_at: completedAt,
                message: result?.message ?? "Redone by the desktop shell.",
                redo_completed_at: completedAt,
                status: "done",
                timestamp: completedAt,
                undo_context: result?.undo?.context,
                undo_message: result?.undo?.message,
                undo_status: result?.undo ? "available" : "not_available",
              }
            : candidate,
        ),
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      setActionStatus("error");
      setActionStatusMessage(message);
      setActionLog((current) =>
        current.map((candidate) =>
          candidate.id === item.id
            ? {
                ...candidate,
                message,
                status: "error",
              }
            : candidate,
        ),
      );
    }
  }

  return (
    <section className="inspect-section ai-map-assistant-panel">
      <div className="ai-map-assistant-header">
        <h2>AI map assistant</h2>
        <div>
          <span>{status === "asking" ? "thinking" : (answer?.status ?? "ready")}</span>
          {chatHistory.length > 0 ? (
            <button
              onClick={() => {
                void window.seekstar.ai.clearSession(activeTab.id);
                setChatHistory([]);
                setActionLog([]);
                setAnswer(undefined);
                setActionStatus("idle");
                setActionStatusMessage("");
              }}
              type="button"
            >
              Clear
            </button>
          ) : null}
        </div>
      </div>
      <div className="ai-map-assistant-console" aria-label="AI map assistant context">
        <div>
          <span>Tab</span>
          <strong>{activeTab.title}</strong>
        </div>
        <div>
          <span>Layer</span>
          <strong>{assistantContext.layer}</strong>
        </div>
        <div>
          <span>Visible band</span>
          <strong>{assistantContext.layerNodeCount} nodes</strong>
        </div>
        <div>
          <span>Selected</span>
          <strong>{assistantContext.selection}</strong>
        </div>
        <div>
          <span>Sources</span>
          <strong>{assistantContext.sourceBackedCount} backed</strong>
        </div>
        <div>
          <span>Review</span>
          <strong>{assistantContext.candidateCount} candidates</strong>
        </div>
      </div>
      <div className="ai-map-assistant-policy">
        <span>Action policy</span>
        <strong>{assistantContext.permissionMode}</strong>
      </div>
      <div className="ai-map-assistant-quick-prompts" aria-label="AI map assistant quick prompts">
        {quickPrompts.map((item) => (
          <button
            key={item.label}
            onClick={() => {
              setPrompt(item.prompt);
            }}
            type="button"
          >
            <span>{item.label}</span>
            <small>{item.detail}</small>
          </button>
        ))}
      </div>
      <form className="ai-map-assistant-form" onSubmit={handleAsk}>
        <input
          aria-label="Ask AI map assistant"
          onChange={(event: ChangeEvent<HTMLInputElement>) => setPrompt(event.target.value)}
          placeholder="Ask Cartographer to explain, navigate, expand, or summarize..."
          value={prompt}
        />
        <button disabled={!canAsk} type="submit">
          Ask
        </button>
      </form>
      {chatHistory.length > 0 ? (
        <div className="ai-map-assistant-history">
          {chatHistory.map((turn) => (
            <AssistantTurnCard
              actionDisabled={status === "asking" || actionStatus === "running"}
              assistantActionPermissionMode={assistantActionPermissionMode}
              assistantActionPermissionRules={assistantActionPermissionRules}
              actionStatus={turn.id === chatHistory[0]?.id ? actionStatus : "idle"}
              actionStatusMessage={turn.id === chatHistory[0]?.id ? actionStatusMessage : ""}
              key={turn.id}
              onRunAction={handleAssistantAction}
              turn={turn}
            />
          ))}
        </div>
      ) : null}
      {actionLog.length > 0 ? (
        <details className="ai-map-assistant-audit" open={actionStatus === "running" || actionStatus === "error"}>
          <summary>
            <span>Operation audit</span>
            <small>{actionLog.length} recent</small>
          </summary>
          <div className="ai-map-assistant-operation-log" aria-label="AI assistant operation log">
            {actionLog.map((item) => (
              <div data-operation-state={item.status} key={item.id}>
                <span>{item.label}</span>
                <em>{formatAssistantOperationAudit(item)}</em>
                <small>{item.message}</small>
                {item.undo_status !== "not_available" ? <small>{formatAssistantUndoAudit(item)}</small> : null}
                {item.undo_status === "available" && item.status === "done" ? (
                  <button onClick={() => void handleUndoOperation(item)} type="button">
                    Undo
                  </button>
                ) : null}
                {item.undo_status === "undone" && item.action ? (
                  <button onClick={() => void handleRedoOperation(item)} type="button">
                    Redo
                  </button>
                ) : null}
              </div>
            ))}
          </div>
        </details>
      ) : null}
    </section>
  );
}

function createAssistantQuickPrompts(
  activeTab: ExplorationTab,
  selectedNodes: TerrainNode[],
  context: {
    candidateCount: number;
    failedObservationCount: number;
    layer: LayerId;
    layerNodeCount: number;
    selection: number;
    sourceBackedCount: number;
  },
): Array<{ detail: string; label: string; prompt: string }> {
  const seed = activeTab.seed || activeTab.title;
  const selectedTitle = selectedNodes[0]?.title;
  const prompts = [
    {
      label: "Explain",
      detail: context.selection > 0 ? "selected node" : "current map",
      prompt: selectedTitle
        ? `Explain "${selectedTitle}" in the context of the "${seed}" map, and suggest one useful next action.`
        : `Explain the current "${seed}" map at ${context.layer}, including what is known, what is missing, and one useful next action.`,
    },
    {
      label: "Navigate",
      detail: "find next focus",
      prompt: `Guide me to a promising nearby node or chunk in the "${seed}" map at ${context.layer}. Prefer exploration over search-like answers.`,
    },
    {
      label: "Expand",
      detail: "ask for terrain",
      prompt: `Expand the "${seed}" map around ${selectedTitle ? `"${selectedTitle}"` : `the current ${context.layer} viewport`} with adjacent unknown-unknowns.`,
    },
  ];

  if (context.candidateCount > 0 || context.failedObservationCount > 0) {
    prompts.push({
      label: "Review",
      detail: `${context.candidateCount} candidates`,
      prompt: `Review source candidates for "${seed}". Tell me which one should be observed first and why.`,
    });
  } else if (context.sourceBackedCount > 0) {
    prompts.push({
      label: "Summarize",
      detail: `${context.sourceBackedCount} sources`,
      prompt: `Summarize the source-backed evidence in "${seed}" and suggest the next layer to inspect.`,
    });
  } else {
    prompts.push({
      label: "Seed",
      detail: `${context.layerNodeCount} local nodes`,
      prompt: `Suggest a better recursive seed from this "${seed}" map and explain where it should open.`,
    });
  }

  return prompts;
}

function formatAssistantPermissionMode(mode: SeekStarSettings["assistant_action_permission_mode"]): string {
  switch (mode) {
    case "allow_low_risk":
      return "Low-risk actions allowed";
    case "block_all":
      return "All actions blocked";
    case "ask_each_time":
    default:
      return "Click approval required";
  }
}

function AssistantTurnCard({
  actionDisabled,
  actionStatus,
  actionStatusMessage,
  assistantActionPermissionMode,
  assistantActionPermissionRules,
  onRunAction,
  turn,
}: {
  actionDisabled: boolean;
  actionStatus: "idle" | "running" | "error" | "done";
  actionStatusMessage: string;
  assistantActionPermissionMode: SeekStarSettings["assistant_action_permission_mode"];
  assistantActionPermissionRules: SeekStarSettings["assistant_action_permission_rules"];
  onRunAction: (action: AiAssistantAction) => Promise<void>;
  turn: AssistantChatTurn;
}): ReactElement {
  return (
    <article className="ai-map-assistant-answer" data-assistant-state={turn.output.status}>
      <div className="ai-map-assistant-turn-prompt">
        <span>You</span>
        <p>{turn.prompt}</p>
      </div>
      <div className="ai-map-assistant-turn-response">
        <span>Cartographer</span>
        <p>{turn.output.answer}</p>
      </div>
      {turn.output.actions.length > 0 ? (
        <div className="ai-map-assistant-actions" aria-label="Assistant suggested actions">
          {turn.output.actions.map((action, index) => (
            <AssistantActionButton
              action={action}
              assistantActionPermissionMode={assistantActionPermissionMode}
              assistantActionPermissionRules={assistantActionPermissionRules}
              disabled={
                actionDisabled ||
                resolveAssistantActionPermissionDecision(action, assistantActionPermissionMode, assistantActionPermissionRules) === "block"
              }
              key={`${turn.id}-${action.type}-${index}`}
              onRun={onRunAction}
            />
          ))}
        </div>
      ) : null}
      {actionStatusMessage ? <small data-action-state={actionStatus}>{actionStatusMessage}</small> : null}
      {turn.output.diagnostics.length > 0 ? <small>{turn.output.diagnostics[0]?.message}</small> : null}
    </article>
  );
}

function AssistantActionButton({
  action,
  assistantActionPermissionMode,
  assistantActionPermissionRules,
  disabled,
  onRun,
}: {
  action: AiAssistantAction;
  assistantActionPermissionMode: SeekStarSettings["assistant_action_permission_mode"];
  assistantActionPermissionRules: SeekStarSettings["assistant_action_permission_rules"];
  disabled: boolean;
  onRun: (action: AiAssistantAction) => Promise<void>;
}): ReactElement {
  const isExecutable = action.type !== "none";
  const actionDecision = resolveAssistantActionPermissionDecision(action, assistantActionPermissionMode, assistantActionPermissionRules);
  const permissionLabel =
    actionDecision === "block"
      ? "Blocked by settings"
      : actionDecision === "allow_after_click"
        ? "Low-risk action"
        : "Click to approve and run";
  const actionDetail = [
    action.type.replace(/_/g, " "),
    action.level_id,
    action.target_id ? `target ${action.target_id}` : undefined,
    action.seed ? `seed ${action.seed}` : undefined,
  ].filter(Boolean).join(" / ");

  return (
    <button
      className="ai-map-assistant-action"
      disabled={disabled || !isExecutable}
      onClick={() => {
        void onRun(action);
      }}
      title={action.label}
      type="button"
    >
      <span>{action.label || action.type.replace(/_/g, " ")}</span>
      <small>{actionDetail}</small>
      {isExecutable ? <em>{permissionLabel}</em> : null}
    </button>
  );
}

function resolveAssistantPermissionStatus(
  action: AiAssistantAction,
  mode: SeekStarSettings["assistant_action_permission_mode"],
): AssistantOperationLogItem["permission_status"] {
  if (action.type === "none") {
    return "not_required";
  }

  if (mode === "allow_low_risk" && isLowRiskAssistantAction(action.type)) {
    return "not_required";
  }

  return "approved_by_click";
}

function resolveAssistantActionPermissionDecision(
  action: AiAssistantAction,
  mode: SeekStarSettings["assistant_action_permission_mode"],
  rules: SeekStarSettings["assistant_action_permission_rules"],
): SeekStarSettings["assistant_action_permission_rules"][number]["decision"] {
  if (action.type === "none") {
    return "allow_after_click";
  }

  if (mode === "block_all") {
    return "block";
  }

  const rule = rules.find((candidate) => candidate.action_type === action.type);

  if (rule?.decision === "block") {
    return "block";
  }

  if (mode === "allow_low_risk" && rule?.decision === "allow_after_click") {
    return "allow_after_click";
  }

  if (mode === "allow_low_risk" && !rule && isLowRiskAssistantAction(action.type)) {
    return "allow_after_click";
  }

  return "ask_each_time";
}

function isLowRiskAssistantAction(actionType: AiAssistantActionType): boolean {
  return actionType === "focus_node" || actionType === "request_chunk" || actionType === "open_settings";
}

function formatAssistantOperationAudit(item: AssistantOperationLogItem): string {
  const parts = [
    item.permission_status.replace(/_/g, " "),
    item.action_type?.replace(/_/g, " "),
    item.level_id,
    item.target_id ? `target ${item.target_id}` : undefined,
    item.seed ? `seed ${item.seed}` : undefined,
  ].filter(Boolean);

  return parts.join(" / ");
}

function formatAssistantUndoAudit(item: AssistantOperationLogItem): string {
  const parts = [
    item.undo_status.replace(/_/g, " "),
    item.undo_context?.kind.replace(/_/g, " "),
    item.undo_requested_at ? `requested ${formatTimestamp(item.undo_requested_at)}` : undefined,
    item.undo_completed_at ? `completed ${formatTimestamp(item.undo_completed_at)}` : undefined,
    item.redo_requested_at ? `redo ${formatTimestamp(item.redo_requested_at)}` : undefined,
    item.redo_completed_at ? `redone ${formatTimestamp(item.redo_completed_at)}` : undefined,
  ].filter(Boolean);

  return parts.join(" / ");
}

function createAssistantSceneSummary(scene: TerrainScene): string {
  const layer = scene.viewport.layer;
  const layerNodes = scene.nodes.filter((node) => node.layer === layer).slice(0, 8);
  const titles = layerNodes.map((node) => node.title).join(", ");

  return `${scene.metadata.title}. Active layer ${layer}. ${scene.nodes.length} nodes, ${scene.relations.length} relations, ${scene.sources.length} sources. Visible sample: ${titles}`;
}

function SourceIngestionPanel({ onAddSource }: { onAddSource: (input: SourceIngestionInput) => void }): ReactElement {
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [body, setBody] = useState("");
  const canSubmit = title.trim().length > 0 && body.trim().length > 0;

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();

    if (!canSubmit) {
      return;
    }

    onAddSource({
      title: title.trim(),
      url: url.trim() || undefined,
      body: body.trim(),
    });
    setTitle("");
    setUrl("");
    setBody("");
  }

  return (
    <section className="inspect-section source-ingestion-panel">
      <div className="source-ingestion-header">
        <h2>Add source</h2>
        <span>manual</span>
      </div>
      <p>Paste local text or a source excerpt. It becomes source-backed terrain in this tab.</p>
      <form className="source-ingestion-form" onSubmit={handleSubmit}>
        <label>
          <span>Title</span>
          <input onChange={(event: ChangeEvent<HTMLInputElement>) => setTitle(event.target.value)} value={title} />
        </label>
        <label>
          <span>URL optional</span>
          <input onChange={(event: ChangeEvent<HTMLInputElement>) => setUrl(event.target.value)} value={url} />
        </label>
        <label>
          <span>Excerpt</span>
          <textarea
            onChange={(event: ChangeEvent<HTMLTextAreaElement>) => setBody(event.target.value)}
            rows={4}
            value={body}
          />
        </label>
        <button disabled={!canSubmit} type="submit">
          Add to map
        </button>
      </form>
    </section>
  );
}

function CartographerOutputPanel({
  observations,
  onNodeSelect,
  onRunScoutPlan,
  outputs,
  scene,
}: {
  observations: ScoutObservation[];
  onNodeSelect: (nodeId: string) => void;
  onRunScoutPlan: (plan: ScoutPlan) => void;
  outputs: CartographerOutput[];
  scene: TerrainScene;
}): ReactElement | null {
  if (outputs.length === 0 && scene.agent_jobs.length === 0) {
    return null;
  }

  const recentOutputs = [...outputs].slice(-4).reverse();
  const recentJobs = [...scene.agent_jobs].slice(-4).reverse();
  const jobCounts = getJobStatusCounts(scene.agent_jobs);

  return (
    <section className="inspect-section cartographer-output-panel">
      <div className="cartographer-output-header">
        <h2>Cartographer jobs</h2>
        <span>{scene.agent_jobs.length} structured</span>
      </div>
      <div className="cartographer-job-summary" aria-label="Cartographer job summary">
        {(["queued", "running", "completed", "failed", "cancelled"] satisfies AgentJobStatus[]).map((status) => (
          <span key={status}>
            {status} {jobCounts[status] ?? 0}
          </span>
        ))}
      </div>
      {recentJobs.length > 0 ? (
        <div className="cartographer-job-list">
          {recentJobs.map((job) => (
            <article className="cartographer-job-item" key={job.id}>
              <div className="cartographer-output-meta">
                <span>{job.mode.replace(/_/g, " ")}</span>
                <span>{job.status}</span>
                {typeof job.progress === "number" ? <span>{Math.round(job.progress * 100)}%</span> : null}
              </div>
              <strong>{job.title ?? job.input_summary}</strong>
              <small>{job.input_summary}</small>
              {typeof job.progress === "number" ? (
                <div className="cartographer-job-progress" aria-hidden="true">
                  <span style={{ width: `${Math.max(2, Math.round(job.progress * 100))}%` }} />
                </div>
              ) : null}
              {job.status === "cancelled" ? <small>No terrain patch was applied.</small> : null}
              {job.error_message ? <small className="cartographer-job-error">{job.error_message}</small> : null}
            </article>
          ))}
        </div>
      ) : null}
      {recentOutputs.length > 0 ? (
        <div className="cartographer-output-list">
          {recentOutputs.map((output) => {
            const focusNodeId = output.patch?.nodes[0]?.id;

            return (
              <article className="cartographer-output-item" key={output.id}>
                <div className="cartographer-output-meta">
                  <span>{output.mode.replace(/_/g, " ")}</span>
                  <span>{formatSourceState(output.source_state)}</span>
                  {output.scout_plan ? <span>scout plan</span> : null}
                </div>
                <h3>{output.title}</h3>
                <p>{output.summary}</p>
                {output.scout_plan ? (
                  <div className="scout-plan-card">
                    <strong>{output.scout_plan.title}</strong>
                    {output.scout_plan.candidate_queries.map((query) => (
                      <span key={query}>{query}</span>
                    ))}
                    <button onClick={() => output.scout_plan && onRunScoutPlan(output.scout_plan)} type="button">
                      Run Scout observations
                    </button>
                    <small>
                      {
                        observations.filter((observation) => observation.plan_id === output.scout_plan?.id).length
                      }{" "}
                      observations
                    </small>
                  </div>
                ) : null}
                {focusNodeId ? (
                  <button onClick={() => onNodeSelect(focusNodeId)} type="button">
                    Focus output node
                  </button>
                ) : null}
              </article>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}

function ScoutObservationPanel({
  observations,
  selectedObservationId,
  onConvertObservation,
  onObserveCandidate,
  onOpenCandidateAsSeek,
  onReplaceFailedSource,
}: {
  observations: ScoutObservation[];
  selectedObservationId?: string;
  onConvertObservation: (observation: ScoutObservation) => void;
  onObserveCandidate: (observation: ScoutObservation) => void;
  onOpenCandidateAsSeek: (observation: ScoutObservation) => void;
  onReplaceFailedSource: (observation: ScoutObservation) => void;
}): ReactElement | null {
  if (observations.length === 0) {
    return null;
  }

  const selectedObservation = selectedObservationId ? observations.find((observation) => observation.id === selectedObservationId) : undefined;
  const recentObservations = [
    ...(selectedObservation ? [selectedObservation] : []),
    ...[...observations].slice(-8).reverse().filter((observation) => observation.id !== selectedObservation?.id),
  ].slice(0, 8);
  const failedObservations = observations
    .filter((observation) => isReplaceableCandidate(observation))
    .slice(-3)
    .reverse();
  const statusCounts = observations.reduce<Partial<Record<ScoutObservation["status"], number>>>((counts, observation) => {
    counts[observation.status] = (counts[observation.status] ?? 0) + 1;
    return counts;
  }, {});

  return (
    <section className="inspect-section scout-observation-panel">
      <div className="scout-observation-header">
        <h2>Scout observations</h2>
        <span>{observations.length} scout</span>
      </div>
      <p>Candidate URLs become source-backed terrain only after source observation returns evidence.</p>
      <div className="scout-observation-summary" aria-label="Scout observation summary">
        {(["pending", "source_candidate", "observed", "converted", "duplicate", "failed"] satisfies ScoutObservation["status"][]).map((status) => (
          <span key={status}>
            {status.replace("_", " ")} {statusCounts[status] ?? 0}
          </span>
        ))}
      </div>
      {failedObservations.length > 0 ? (
        <div className="source-recovery-queue" aria-label="Source recovery queue">
          <div className="source-recovery-header">
            <h3>Recovery queue</h3>
            <span>{failedObservations.length} failed</span>
          </div>
          <p>Failed candidates stay out of the main canvas. Recover by retrying the same URL or asking Cartographer for replacements.</p>
          {failedObservations.map((observation) => (
            <article className="source-recovery-card" key={observation.id}>
              <div>
                <strong>{observation.title}</strong>
                <small>{observation.url ?? observation.query}</small>
              </div>
              <p>{observation.failure_reason ?? "Scout could not observe this candidate."}</p>
              <div className="source-recovery-actions">
                <button onClick={() => onObserveCandidate(observation)} type="button">
                  Retry original
                </button>
                <button onClick={() => onReplaceFailedSource(observation)} type="button">
                  Ask AI replacement
                </button>
                {observation.url ? (
                  <button onClick={() => onOpenCandidateAsSeek(observation)} type="button">
                    Open as Seek
                  </button>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      ) : null}
      <div className="scout-observation-list">
        {recentObservations.map((observation) => (
          <article
            className={observation.id === selectedObservationId ? "scout-observation-item is-selected" : "scout-observation-item"}
            data-scout-state={observation.status}
            key={observation.id}
          >
            <div className="cartographer-output-meta">
              <span>{observation.status.replace("_", " ")}</span>
              <span>{observation.adapter ?? "local"}</span>
              <span>{observation.source_type ?? "unknown"}</span>
            </div>
            <strong>{observation.title}</strong>
            <small>{observation.query}</small>
            {observation.snippet ? <p>{observation.snippet}</p> : null}
            {observation.failure_reason ? <small>{observation.failure_reason}</small> : null}
            <div className="scout-observation-actions">
              {isObservableCandidate(observation) ? (
                <button onClick={() => onObserveCandidate(observation)} type="button">
                  {observation.status === "failed" ? "Retry original source" : "Observe source"}
                </button>
              ) : null}
              {isReplaceableCandidate(observation) ? (
                <button onClick={() => onReplaceFailedSource(observation)} type="button">
                  Ask AI for replacement
                </button>
              ) : null}
              {observation.source_snapshot ? (
                <button onClick={() => onConvertObservation(observation)} type="button">
                  Use captured snapshot
                </button>
              ) : null}
              {observation.url ? (
                <button onClick={() => onOpenCandidateAsSeek(observation)} type="button">
                  Open as new Seek
                </button>
              ) : null}
            </div>
            {isReplaceableCandidate(observation) ? (
              <small>Review path: retry probes the same URL; replacement asks Cartographer for another candidate.</small>
            ) : null}
            {observation.status === "converted" ? <small>Converted into source-backed terrain.</small> : null}
          </article>
        ))}
      </div>
    </section>
  );
}

function SceneOverviewPanel({
  activeTab,
  fogCount,
  onBacklinkFocus,
  onResetWorkspace,
  scene,
}: {
  activeTab: ExplorationTab;
  fogCount: number;
  onBacklinkFocus: (backlink: NonNullable<ExplorationTab["parent_backlink"]>) => void;
  onResetWorkspace: () => void;
  scene: TerrainScene;
}): ReactElement {
  const activeLayer = getActiveLayer(scene);
  const currentLayerNodes = scene.nodes.filter((node) => node.layer === scene.viewport.layer);

  return (
    <section className="inspect-section">
      <h1>{activeTab.title}</h1>
      <p>{scene.metadata.description}</p>
      <dl className="metric-list">
        <div>
          <dt>Nodes</dt>
          <dd>{scene.nodes.length}</dd>
        </div>
        <div>
          <dt>Relations</dt>
          <dd>{scene.relations.length}</dd>
        </div>
        <div>
          <dt>Fog</dt>
          <dd>{fogCount}</dd>
        </div>
      </dl>
      <div className="deep-zoom-overview">
        <div className="deep-zoom-overview-header">
          <h2>Deep zoom</h2>
          <span>{scene.viewport.layer}</span>
        </div>
        <p>
          {activeLayer
            ? `${activeLayer.label}: ${currentLayerNodes.length} visible local terrain node${currentLayerNodes.length === 1 ? "" : "s"}.`
            : "Current layer is not described by this scene."}
        </p>
        {activeLayer?.breadcrumb ? <small>{activeLayer.breadcrumb.join(" / ")}</small> : null}
      </div>
      {activeTab.parent_backlink ? <BacklinkPanel backlink={activeTab.parent_backlink} onBacklinkFocus={onBacklinkFocus} /> : null}
      <SourceReadinessPanel scene={scene} />
      <button className="inspect-action" onClick={onResetWorkspace} type="button">
        Reset local workspace
      </button>
    </section>
  );
}

function BacklinkPanel({
  backlink,
  onBacklinkFocus,
}: {
  backlink: ExplorationTab["parent_backlink"];
  onBacklinkFocus: (backlink: NonNullable<ExplorationTab["parent_backlink"]>) => void;
}): ReactElement | null {
  if (!backlink) {
    return null;
  }

  return (
    <div className="backlink-panel" aria-label="Origin backlink">
      <div className="backlink-header">
        <h2>Origin backlink</h2>
        <span>source context</span>
      </div>
      <strong>{backlink.label}</strong>
      {backlink.excerpt ? <p>{backlink.excerpt}</p> : null}
      <button className="backlink-focus-action" onClick={() => onBacklinkFocus(backlink)} type="button">
        Focus origin
      </button>
    </div>
  );
}

function SourceReadinessPanel({ scene }: { scene: TerrainScene }): ReactElement {
  const nodeCounts = getSourceStateCounts(scene.nodes);
  const sourceBackedCount = nodeCounts.source_backed ?? 0;
  const generatedCount = (nodeCounts.generated ?? 0) + (nodeCounts.agent_inferred ?? 0) + (nodeCounts.weak_hypothesis ?? 0);
  const directUrlObservation = getLatestDirectUrlObservation(scene);
  const candidateCount = (scene.scout_observations ?? []).filter((observation) => observation.status === "source_candidate").length;
  const statusLabel =
    directUrlObservation?.status === "pending"
      ? "observing"
      : directUrlObservation?.status === "failed"
        ? "failed"
        : sourceBackedCount > 0
          ? "source-backed"
          : candidateCount > 0
            ? "candidate"
        : scene.sources.length === 0
          ? "local only"
          : `${scene.sources.length} sources`;
  const readinessCopy =
    directUrlObservation?.status === "pending"
      ? `Observing ${directUrlObservation.url ?? directUrlObservation.query}.`
      : directUrlObservation?.status === "failed"
        ? directUrlObservation.failure_reason ?? "Scout could not observe this source. No source-backed tile was created."
        : sourceBackedCount > 0
          ? "Source-backed terrain is available."
          : candidateCount > 0
            ? "Candidate URLs are ready to observe."
            : "Local seed terrain only.";

  return (
    <div className="source-readiness-panel" aria-label="Source readiness">
      <div className="source-readiness-header">
        <h2>Source readiness</h2>
        <span>{statusLabel}</span>
      </div>
      <p>{readinessCopy}</p>
      <dl className="source-state-list">
        {(["source_backed", "generated", "agent_inferred", "weak_hypothesis", "fog"] satisfies SourceState[]).map((state) => (
          <div key={state}>
            <dt>{formatSourceState(state)}</dt>
            <dd>{nodeCounts[state] ?? 0}</dd>
          </div>
        ))}
      </dl>
      <div className="source-readiness-note">
        <span>{generatedCount} generated or inferred nodes</span>
        <span>{scene.relations.length} typed relations</span>
      </div>
    </div>
  );
}

function getLatestDirectUrlObservation(scene: TerrainScene): ScoutObservation | undefined {
  return [...(scene.scout_observations ?? [])]
    .filter(
      (observation) =>
        observation.discovery_mode === "direct_url" &&
        (observation.status === "pending" || observation.status === "failed"),
    )
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at))[0];
}

function isObservableCandidate(observation: ScoutObservation): boolean {
  return Boolean(
    observation.url &&
      (observation.status === "source_candidate" || observation.status === "observed"),
  );
}

function isReplaceableCandidate(observation: ScoutObservation): boolean {
  return observation.status === "failed" || Boolean(observation.failure_reason);
}

function SelectedNodePanel({
  node,
  onNodeSelect,
  onScoutSourceLinks,
  onLayerSelect,
  onSaveSelectionToTray,
  onUseNodeAsSeed,
  scene,
}: {
  node: TerrainNode;
  onNodeSelect: (nodeId: string) => void;
  onScoutSourceLinks: (node: TerrainNode, source: SourceRef) => void;
  onLayerSelect: (layer: LayerId, focusNodeId?: string) => void;
  onSaveSelectionToTray: () => void;
  onUseNodeAsSeed: (node: TerrainNode) => void;
  scene: TerrainScene;
}): ReactElement {
  const source = getSourceForNode(scene, node);
  const currentLayer = scene.layers.find((layer) => layer.id === scene.viewport.layer);
  const parentLayerId = currentLayer?.parent_layer_id;
  const zoomTarget = node.zoom_target;
  const sourceRelations = getSourceRelationsForNode(scene, node);
  const scoutObservation = source?.created_from_observation_id
    ? scene.scout_observations?.find((observation) => observation.id === source.created_from_observation_id)
    : undefined;
  const sourceChildren =
    node.type === "source"
      ? scene.nodes.filter((candidate) => candidate.parent_id === node.id || sourceRelations.some((relation) => relation.to === candidate.id))
      : [];

  return (
    <section className="inspect-section">
      <h1>{node.title}</h1>
      <p>{node.summary}</p>
      <dl className="metric-list">
        <div>
          <dt>Type</dt>
          <dd>{node.type.replace("_", " ")}</dd>
        </div>
        <div>
          <dt>Layer</dt>
          <dd>{node.layer}</dd>
        </div>
        <div>
          <dt>State</dt>
          <dd>{node.source_state.replace("_", " ")}</dd>
        </div>
        <div>
          <dt>Confidence</dt>
          <dd>{Math.round(node.confidence * 100)}%</dd>
        </div>
      </dl>
      <div className="tag-list" aria-label="Node tags">
        {node.tags.map((tag) => (
          <span key={tag}>{tag}</span>
        ))}
      </div>
      {source ? (
        <SourceEvidenceCard
          node={node}
          onNodeSelect={onNodeSelect}
          onScoutSourceLinks={onScoutSourceLinks}
          onUseNodeAsSeed={onUseNodeAsSeed}
          relations={sourceRelations}
          scoutObservation={scoutObservation}
          source={source}
          sourceChildren={sourceChildren}
        />
      ) : null}
      {zoomTarget ? (
        <button className="inspect-action" onClick={() => onLayerSelect(zoomTarget.layer, zoomTarget.node_id)} type="button">
          Zoom in to {zoomTarget.layer}
        </button>
      ) : null}
      {parentLayerId ? (
        <button className="inspect-action" onClick={() => onLayerSelect(parentLayerId)} type="button">
          Zoom out to {parentLayerId}
        </button>
      ) : null}
      {node.can_create_seed ? (
        <button className="inspect-action" onClick={() => onUseNodeAsSeed(node)} type="button">
          Create new seed from this
        </button>
      ) : null}
      <button className="inspect-action" onClick={onSaveSelectionToTray} type="button">
        Save to side tray
      </button>
    </section>
  );
}

function SourceEvidenceCard({
  node,
  onNodeSelect,
  onScoutSourceLinks,
  onUseNodeAsSeed,
  relations,
  scoutObservation,
  source,
  sourceChildren,
}: {
  node: TerrainNode;
  onNodeSelect: (nodeId: string) => void;
  onScoutSourceLinks: (node: TerrainNode, source: SourceRef) => void;
  onUseNodeAsSeed: (node: TerrainNode) => void;
  relations: TerrainRelation[];
  scoutObservation?: ScoutObservation;
  source: SourceRef;
  sourceChildren: TerrainNode[];
}): ReactElement {
  return (
    <div className="source-evidence-card" aria-label="Source evidence">
      <div className="source-evidence-header">
        <h2>Source evidence</h2>
        <span>{source.source_type}</span>
      </div>
      <dl className="source-evidence-meta">
        <div>
          <dt>State</dt>
          <dd>{formatSourceState(node.source_state)}</dd>
        </div>
        <div>
          <dt>Retrieved</dt>
          <dd>{source.retrieved_at ? formatTimestamp(source.retrieved_at) : "manual"}</dd>
        </div>
      </dl>
      {source.url ? <p className="source-url">{source.url}</p> : null}
      {scoutObservation ? (
        <div className="source-origin-card" aria-label="Scout observation origin">
          <div className="source-origin-card-header">
            <h3>Scout origin</h3>
            <span>{scoutObservation.status.replace("_", " ")}</span>
          </div>
          <strong>{scoutObservation.title}</strong>
          <small>{scoutObservation.query}</small>
          <small>{scoutObservation.adapter ?? "local"} adapter</small>
          {scoutObservation.retrieved_at ? <small>Observed {formatTimestamp(scoutObservation.retrieved_at)}</small> : null}
        </div>
      ) : null}
      {node.quote ? (
        <blockquote>{node.quote}</blockquote>
      ) : source.snippet ? (
        <blockquote>{source.snippet}</blockquote>
      ) : null}
      {source.reliability_hints.length > 0 ? (
        <div className="source-reliability-list" aria-label="Reliability hints">
          {source.reliability_hints.map((hint) => (
            <span key={hint}>{hint}</span>
          ))}
        </div>
      ) : null}
      {relations.length > 0 ? (
        <div className="source-relation-list">
          <h3>Evidence relations</h3>
          {relations.map((relation) => (
            <span key={relation.id}>
              {relation.type.replace(/_/g, " ")} · {Math.round(relation.confidence * 100)}%
            </span>
          ))}
        </div>
      ) : null}
      {sourceChildren.length > 0 ? (
        <div className="source-excerpt-list">
          <h3>Mapped excerpts</h3>
          {sourceChildren.map((child) => (
            <button key={child.id} onClick={() => onNodeSelect(child.id)} type="button">
              <strong>{child.title}</strong>
              <span>{child.layer}</span>
            </button>
          ))}
        </div>
      ) : null}
      <button className="source-seed-action" onClick={() => onUseNodeAsSeed(node)} type="button">
        Use as new exploration seed
      </button>
      {source.url && node.source_state === "source_backed" ? (
        <button className="source-seed-action" onClick={() => onScoutSourceLinks(node, source)} type="button">
          Scout linked frontier
        </button>
      ) : null}
    </div>
  );
}

function SelectedRelationPanel({
  fromNode,
  relation,
  toNode,
}: {
  fromNode?: TerrainNode;
  relation: TerrainRelation;
  toNode?: TerrainNode;
}): ReactElement {
  return (
    <section className="inspect-section relation-inspect-panel">
      <h1>{relation.type.replace("_", " ")}</h1>
      <p>{relation.explanation}</p>
      <div className="relation-node-pair" aria-label="Relation endpoints">
        <span>{fromNode?.title ?? relation.from}</span>
        <span aria-hidden="true">{"->"}</span>
        <span>{toNode?.title ?? relation.to}</span>
      </div>
      <dl className="metric-list">
        <div>
          <dt>State</dt>
          <dd>{relation.source_state.replace("_", " ")}</dd>
        </div>
        <div>
          <dt>Confidence</dt>
          <dd>{Math.round(relation.confidence * 100)}%</dd>
        </div>
        <div>
          <dt>From layer</dt>
          <dd>{fromNode?.layer ?? "Unknown"}</dd>
        </div>
        <div>
          <dt>To layer</dt>
          <dd>{toNode?.layer ?? "Unknown"}</dd>
        </div>
      </dl>
      <div className="tag-list" aria-label="Relation state tags">
        <span>{relation.source_state.replace("_", " ")}</span>
        <span>{relation.type.replace("_", " ")}</span>
      </div>
    </section>
  );
}

function SelectionRegionPanel({
  nodes,
  onSaveSelectionToTray,
}: {
  nodes: TerrainNode[];
  onSaveSelectionToTray: () => void;
}): ReactElement {
  const fogCount = nodes.filter((node) => node.type === "fog_region").length;
  const generatedCount = nodes.filter((node) => node.source_state !== "source_backed").length;

  return (
    <section className="inspect-section">
      <h1>Selected region</h1>
      <p>This local spatial selection can become a future explain, compare, seed, or export context.</p>
      <dl className="metric-list">
        <div>
          <dt>Nodes</dt>
          <dd>{nodes.length}</dd>
        </div>
        <div>
          <dt>Fog</dt>
          <dd>{fogCount}</dd>
        </div>
        <div>
          <dt>Local / inferred</dt>
          <dd>{generatedCount}</dd>
        </div>
      </dl>
      <div className="selection-node-list" aria-label="Selected nodes">
        {nodes.map((node) => (
          <span key={node.id}>{node.title}</span>
        ))}
      </div>
      <button className="inspect-action" onClick={onSaveSelectionToTray} type="button">
        Save region to side tray
      </button>
    </section>
  );
}

function SideTrayPanel({
  items,
  onClearBasket,
  onRemoveItem,
}: {
  items: SelectionBasketItem[];
  onClearBasket: () => void;
  onRemoveItem: (itemId: string) => void;
}): ReactElement {
  return (
    <section className="inspect-section side-tray-panel">
      <div className="side-tray-header">
        <h2>Side tray</h2>
        {items.length > 0 ? (
          <button onClick={onClearBasket} type="button">
            Clear
          </button>
        ) : null}
      </div>
      {items.length === 0 ? (
        <p>Save selected nodes or lassoed regions here as local selection context.</p>
      ) : (
        <div className="side-tray-list">
          {items.map((item) => (
            <article className="side-tray-item" key={item.id}>
              <div className="side-tray-item-body">
                <div>
                  <strong>{item.title}</strong>
                  <small>
                    {item.nodeIds.length} nodes - {item.sourceStates.join(", ")}
                  </small>
                </div>
              </div>
              <button aria-label={`Remove ${item.title}`} onClick={() => onRemoveItem(item.id)} type="button">
                x
              </button>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

