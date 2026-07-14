import type {
  ExplorationTab,
  LayerId,
  ScoutObservation,
  TerrainNode,
  TerrainRelation,
  TerrainScene,
} from "@seekstar/core-schema";
import type { AiAssistantAction, AiAssistantOutput } from "@seekstar/ai-service";
import type { FormEvent, ReactElement } from "react";
import { useState } from "react";
import type { SeekStarSettings } from "../../../../shared/settings";
import type { SearchResult } from "../../search/localSceneSearch";
import type { SelectionBasketItem } from "../../selection/selectionBasket";
import { SearchResultsPanel } from "../SearchResultsPanel";

export type AiMapControlMode = "collapsed" | "compact" | "expanded";

export type AssistantOperationUndoContext =
  | {
    focus_node_id?: string;
    kind: "restore_viewport_selection";
    selected_node_ids: string[];
    tab_id: string;
    viewport: TerrainScene["viewport"];
  }
  | {
    created_tab_id: string;
    focus_node_id?: string;
    kind: "close_created_tab";
    origin_tab_id: string;
    selected_node_ids: string[];
  };

export interface AssistantActionExecutionResult {
  message?: string;
  undo?: {
    context: AssistantOperationUndoContext;
    message: string;
  };
}

interface AiMapControlSidebarProps {
  activeTab: ExplorationTab;
  assistantActionPermissionMode: SeekStarSettings["assistant_action_permission_mode"];
  assistantActionPermissionRules: SeekStarSettings["assistant_action_permission_rules"];
  basketItems: SelectionBasketItem[];
  mode: AiMapControlMode;
  onAssistantAction: (action: AiAssistantAction) => Promise<AssistantActionExecutionResult | void>;
  onAssistantUndo: (context: AssistantOperationUndoContext) => Promise<string | void>;
  onClearBasket: () => void;
  onClearSelection: () => void;
  onObserveCandidate: (observation: ScoutObservation) => void;
  onReplaceFailedSource: (observation: ScoutObservation) => void;
  onRemoveBasketItem: (itemId: string) => void;
  onLayerSelect: (layer: LayerId, focusNodeId?: string) => void;
  onModeChange: (mode: AiMapControlMode) => void;
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
}

export function AiMapControlSidebar(props: AiMapControlSidebarProps): ReactElement {
  const observations = props.scene.scout_observations ?? [];
  const selectedObservation = observations.find((item) => item.id === props.selectedObservationId);
  const pending = observations.filter((item) => item.status === "source_candidate" || item.status === "failed");
  const contextTitle = props.selectedRelation ? "关系" : props.selectedNodes.length > 1 ? "选区" : props.selectedNode ? "节点" : props.searchQuery ? "搜索" : "地图";

  return <div className={`inspector-sidebar inspector-sidebar-${props.mode}`} data-mode={props.mode}>
    <header className="inspector-sidebar-header">
      <div><span>AI MAP CONTROL</span><small>{contextTitle}</small></div>
      <div className="inspector-sidebar-header-actions">
        <button onClick={() => props.onModeChange("collapsed")} type="button">收起</button>
        <button onClick={() => props.onModeChange(props.mode === "expanded" ? "compact" : "expanded")} type="button">{props.mode === "expanded" ? "紧凑" : "展开"}</button>
        {props.selectedNode || props.selectedRelation || props.searchQuery ? <button onClick={props.onClearSelection} type="button">清除</button> : null}
      </div>
    </header>
    <div className="inspector-sidebar-body">
      <AssistantPanel {...props} />
      <MapSummary {...props} />
      {props.searchQuery ? <SearchResultsPanel query={props.searchQuery} results={props.searchResults} onResultSelect={props.onSearchResultSelect} /> : null}
      {pending.length > 0 || selectedObservation ? <SourceQueue observations={pending} selected={selectedObservation} onObserve={props.onObserveCandidate} onRetry={props.onReplaceFailedSource} /> : null}
      {props.basketItems.length > 0 ? <SelectionTray items={props.basketItems} onClear={props.onClearBasket} onRemove={props.onRemoveBasketItem} /> : null}
    </div>
  </div>;
}

function AssistantPanel(props: AiMapControlSidebarProps): ReactElement {
  const [prompt, setPrompt] = useState("");
  const [output, setOutput] = useState<AiAssistantOutput>();
  const [status, setStatus] = useState<"idle" | "asking" | "error">("idle");
  const [message, setMessage] = useState("");
  const [undo, setUndo] = useState<AssistantActionExecutionResult["undo"]>();

  async function submit(event: FormEvent): Promise<void> {
    event.preventDefault();
    if (!prompt.trim() || status === "asking") return;
    setStatus("asking");
    setMessage("");
    setUndo(undefined);
    try {
      const result = await window.seekstar.ai.assist({
        intent: "answer_question",
        prompt: prompt.trim(),
        seed: props.activeTab.seed,
        current_level: props.scene.viewport.layer,
        selected_nodes: props.selectedNodes.map((node) => ({ id: node.id, title: node.title, level_id: node.layer, summary: node.summary, source_state: node.source_state })),
        available_operations: ["focus_node", "request_chunk", "observe_source", "create_seed", "open_settings"],
        scene_summary: `${props.scene.nodes.length} nodes, ${props.scene.sources.length} observed sources`,
      });
      setOutput(result);
      setStatus(result.status === "ok" ? "idle" : "error");
      setMessage(result.status === "ok" ? "" : result.diagnostics[0]?.message ?? "助手请求失败");
    } catch (error) {
      setStatus("error");
      setMessage(getErrorMessage(error));
    }
  }

  async function runAction(action: AiAssistantAction): Promise<void> {
    setMessage("");
    try {
      const result = await props.onAssistantAction(action);
      setMessage(result?.message ?? "操作已完成");
      setUndo(result?.undo);
    } catch (error) {
      setMessage(getErrorMessage(error));
    }
  }

  async function undoAction(): Promise<void> {
    if (!undo) return;
    try {
      setMessage(await props.onAssistantUndo(undo.context) ?? "已撤销");
      setUndo(undefined);
    } catch (error) {
      setMessage(getErrorMessage(error));
    }
  }

  return <section className="ai-map-assistant-panel">
    <header><div><strong>AI 地图助手</strong><small>{props.activeTab.title} · {props.scene.viewport.layer}</small></div><span>{status === "asking" ? "思考中" : "就绪"}</span></header>
    {output?.answer ? <article className="ai-map-assistant-answer">{output.answer}</article> : null}
    {output?.actions.length ? <div className="ai-map-assistant-actions">{output.actions.map((action, index) => <button key={`${action.type}-${index}`} onClick={() => void runAction(action)} type="button">{action.label}</button>)}</div> : null}
    {message ? <p className={status === "error" ? "ai-map-assistant-error" : ""}>{message}</p> : null}
    {undo ? <button className="ai-map-assistant-undo" onClick={() => void undoAction()} type="button">撤销刚才的操作</button> : null}
    <form onSubmit={(event) => void submit(event)}><input onChange={(event) => setPrompt(event.target.value)} placeholder="解释、定位或扩展当前地图…" value={prompt} /><button disabled={!prompt.trim() || status === "asking"} type="submit">发送</button></form>
  </section>;
}

function MapSummary(props: AiMapControlSidebarProps): ReactElement {
  const visibleNodes = props.scene.nodes.filter((node) => node.layer === props.scene.viewport.layer && node.type !== "fog_region");
  return <section className="map-context-summary-panel">
    <header><div><span>地图上下文</span><strong>{props.activeTab.title}</strong></div><small>{props.scene.viewport.layer}</small></header>
    <p>{props.selectedNode?.summary ?? props.selectedNode?.title ?? `当前尺度有 ${visibleNodes.length} 个可见对象，${props.scene.sources.length} 个已观察来源。`}</p>
    <div className="map-context-summary-stats"><span><strong>{visibleNodes.length}</strong><small>当前对象</small></span><span><strong>{props.scene.sources.length}</strong><small>来源</small></span><span><strong>{(props.scene.scout_observations ?? []).filter((item) => item.status === "source_candidate").length}</strong><small>待验证</small></span></div>
    <div className="map-context-summary-actions">
      {(["L0", "L1", "L2", "L3"] as LayerId[]).map((layer) => <button className={layer === props.scene.viewport.layer ? "active" : ""} key={layer} onClick={() => props.onLayerSelect(layer)} type="button">{layer}</button>)}
      {props.selectedNode ? <button onClick={() => props.onUseNodeAsSeed(props.selectedNode!)} type="button">作为新 Seed</button> : null}
      {props.selectedNodes.length ? <button onClick={props.onSaveSelectionToTray} type="button">保存选区</button> : null}
    </div>
    {props.selectedRelation ? <p>{props.selectedRelationNodes?.from?.title ?? props.selectedRelation.from} → {props.selectedRelationNodes?.to?.title ?? props.selectedRelation.to}</p> : null}
  </section>;
}

function SourceQueue({ observations, onObserve, onRetry, selected }: { observations: ScoutObservation[]; onObserve: (observation: ScoutObservation) => void; onRetry: (observation: ScoutObservation) => void; selected?: ScoutObservation }): ReactElement {
  const items = selected && !observations.some((item) => item.id === selected.id) ? [selected, ...observations] : observations;
  return <section className="source-review-summary"><header><strong>来源验证</strong><small>{items.length} 个候选</small></header><div className="source-review-list">{items.slice(0, 8).map((observation) => <article key={observation.id}><span><strong>{observation.title}</strong><small>{observation.url}</small></span>{observation.status === "failed" ? <button onClick={() => onRetry(observation)} type="button">重试</button> : observation.status === "source_candidate" ? <button onClick={() => onObserve(observation)} type="button">观察</button> : <em>已验证</em>}</article>)}</div></section>;
}

function SelectionTray({ items, onClear, onRemove }: { items: SelectionBasketItem[]; onClear: () => void; onRemove: (id: string) => void }): ReactElement {
  return <details className="inspector-advanced-section"><summary><span>选区托盘</span><small>{items.length}</small></summary><div className="selection-basket-list">{items.map((item) => <article key={item.id}><span><strong>{item.title}</strong><small>{item.nodeIds.length} 个对象</small></span><button onClick={() => onRemove(item.id)} type="button">移除</button></article>)}</div><button onClick={onClear} type="button">清空托盘</button></details>;
}

function getErrorMessage(error: unknown): string { return error instanceof Error ? error.message : String(error); }
