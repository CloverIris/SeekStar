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
import type { SourceIngestionInput } from "@seekstar/constellation-engine";
import type { ChangeEvent, FormEvent, ReactElement } from "react";
import { useState } from "react";
import { formatSourceState, formatTimestamp, getActiveLayer, getJobStatusCounts, getSourceForNode, getSourceRelationsForNode, getSourceStateCounts } from "../../exploration/types";
import type { SearchResult } from "../../search/localSceneSearch";
import type { SelectionBasketItem } from "../../selection/selectionBasket";
import { SearchResultsPanel } from "../SearchResultsPanel";
export function InspectorSidebar({
  activeTab,
  basketItems,
  onBacklinkFocus,
  onAddSource,
  onConvertScoutObservation,
  onClearBasket,
  onClearSelection,
  onRemoveBasketItem,
  onRunScoutPlan,
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
  basketItems: SelectionBasketItem[];
  onBacklinkFocus: (backlink: NonNullable<ExplorationTab["parent_backlink"]>) => void;
  onAddSource: (input: SourceIngestionInput) => void;
  onConvertScoutObservation: (observation: ScoutObservation) => void;
  onClearBasket: () => void;
  onClearSelection: () => void;
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
  const panelTitle = selectedRelation ? "Relation" : selectedNodes.length > 1 ? "Selection" : selectedNode ? "Inspect" : searchQuery ? "Search" : "Overview";

  return (
    <div className="inspector-sidebar">
      <header className="inspector-sidebar-header">
        <span>{panelTitle}</span>
        {selectedRelation || selectedNode || searchQuery ? (
          <button aria-label="Clear selection" onClick={onClearSelection} type="button">
            Clear
          </button>
        ) : null}
      </header>
      <div className="inspector-sidebar-body">
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
        <CartographerOutputPanel
          observations={scene.scout_observations ?? []}
          outputs={scene.cartographer_outputs ?? []}
          scene={scene}
          onNodeSelect={onSearchResultSelect}
          onRunScoutPlan={onRunScoutPlan}
        />
        <ScoutObservationPanel
          observations={scene.scout_observations ?? []}
          selectedObservationId={selectedObservationId}
          onConvertObservation={onConvertScoutObservation}
        />
        <SourceIngestionPanel onAddSource={onAddSource} />
        <SideTrayPanel
          items={basketItems}
          onClearBasket={onClearBasket}
          onRemoveItem={onRemoveBasketItem}
        />
      </div>
    </div>
  );
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
}: {
  observations: ScoutObservation[];
  selectedObservationId?: string;
  onConvertObservation: (observation: ScoutObservation) => void;
}): ReactElement | null {
  if (observations.length === 0) {
    return null;
  }

  const recentObservations = [...observations].slice(-6).reverse();
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
      <p>Structured Scout observations only. They are not source-backed terrain until provenance conversion happens.</p>
      <div className="scout-observation-summary" aria-label="Scout observation summary">
        {(["pending", "source_candidate", "observed", "converted", "duplicate", "failed"] satisfies ScoutObservation["status"][]).map((status) => (
          <span key={status}>
            {status.replace("_", " ")} {statusCounts[status] ?? 0}
          </span>
        ))}
      </div>
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
            {observation.status === "source_candidate" || observation.status === "observed" ? (
              <button onClick={() => onConvertObservation(observation)} type="button">
                Confirm as source terrain
              </button>
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
  const statusLabel =
    directUrlObservation?.status === "pending"
      ? "observing"
      : directUrlObservation?.status === "failed"
        ? "failed"
        : scene.sources.length === 0
          ? "local only"
          : `${scene.sources.length} sources`;
  const readinessCopy =
    directUrlObservation?.status === "pending"
      ? `Scout is observing ${directUrlObservation.url ?? directUrlObservation.query}. Source-backed terrain will appear only after evidence returns.`
      : directUrlObservation?.status === "failed"
        ? directUrlObservation.failure_reason ?? "Scout could not observe this source. No source-backed tile was created."
        : sourceBackedCount > 0
          ? "Some terrain is source-backed. Generated and inferred nodes remain visually marked."
          : "This map is local-only terrain. No factual node is presented as source-backed yet.";

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

