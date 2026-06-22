import type { TerrainNode, TerrainScene } from "@seekstar/core-schema";

export interface SearchResult {
  nodeId: string;
  title: string;
  nodeType: TerrainNode["type"];
  layer: TerrainNode["layer"];
  snippet: string;
}

export function searchScene(scene: TerrainScene, query: string): SearchResult[] {
  const normalizedQuery = normalize(query);

  if (!normalizedQuery) {
    return [];
  }

  return scene.nodes
    .filter((node) => searchableText(node).includes(normalizedQuery))
    .map((node) => ({
      nodeId: node.id,
      title: node.title,
      nodeType: node.type,
      layer: node.layer,
      snippet: node.summary ?? node.title,
    }));
}

function searchableText(node: TerrainNode): string {
  return normalize([node.title, node.summary, node.type, ...node.tags].filter(Boolean).join(" "));
}

function normalize(value: string): string {
  return value.trim().toLowerCase();
}
