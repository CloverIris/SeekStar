import type { TerrainNode, TerrainScene } from "@seekstar/core-schema";
import type { ReactElement } from "react";

interface TerrainCanvasProps {
  focusedNodeId?: string;
  highlightedNodeIds: string[];
  onNodeSelect: (nodeId: string) => void;
  scene: TerrainScene;
  selectedNodeIds: string[];
}

export function TerrainCanvas({
  focusedNodeId,
  highlightedNodeIds,
  onNodeSelect,
  scene,
  selectedNodeIds,
}: TerrainCanvasProps): ReactElement {
  return (
    <section className="canvas-plane" aria-label="Cognitive canvas">
      {scene.nodes.map((node) => (
        <TerrainNodeCard
          isFocused={focusedNodeId === node.id}
          isHighlighted={highlightedNodeIds.includes(node.id)}
          isSelected={selectedNodeIds.includes(node.id)}
          key={node.id}
          node={node}
          onSelect={onNodeSelect}
        />
      ))}
    </section>
  );
}

function TerrainNodeCard({
  isFocused,
  isHighlighted,
  isSelected,
  node,
  onSelect,
}: {
  isFocused: boolean;
  isHighlighted: boolean;
  isSelected: boolean;
  node: TerrainNode;
  onSelect: (nodeId: string) => void;
}): ReactElement {
  return (
    <button
      className={`terrain-node ${nodeClassName(node)}${isSelected ? " is-selected" : ""}${isHighlighted ? " is-highlighted" : ""}${isFocused ? " is-focused" : ""}`}
      data-source-state={node.source_state}
      onClick={() => onSelect(node.id)}
      style={{
        transform: `translate(${node.position_hint?.x ?? 0}px, ${node.position_hint?.y ?? 0}px)`,
      }}
      type="button"
    >
      <span className="node-type">{node.type.replace("_", " ")}</span>
      <h2>{node.title}</h2>
      {node.summary ? <p>{node.summary}</p> : null}
    </button>
  );
}

function nodeClassName(node: TerrainNode): string {
  if (node.type === "fog_region") {
    return "terrain-node-fog";
  }

  if (node.tags.includes("seed")) {
    return "terrain-node-seed";
  }

  return "terrain-node-default";
}
