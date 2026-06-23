import type { SourceState, TerrainNode, TerrainScene } from "@seekstar/core-schema";

export type SearchMatchType = "title" | "summary" | "tag" | "type" | "quote" | "source_snippet" | "source_metadata";

export interface SearchResult {
  nodeId: string;
  title: string;
  nodeType: TerrainNode["type"];
  layer: TerrainNode["layer"];
  matchType: SearchMatchType;
  snippet: string;
  sourceState: SourceState;
  sourceTitle?: string;
}

export function searchScene(scene: TerrainScene, query: string): SearchResult[] {
  const normalizedQuery = normalize(query);

  if (!normalizedQuery) {
    return [];
  }

  return scene.nodes.flatMap((node) => {
    const source = findSourceForNode(scene, node);
    const fields = getSearchFields(node, source);
    const match = fields.find((field) => normalize(field.value).includes(normalizedQuery));

    if (!match) {
      return [];
    }

    return [
      {
        nodeId: node.id,
        title: node.title,
        nodeType: node.type,
        layer: node.layer,
        matchType: match.type,
        snippet: createSnippet(match.value, query) || node.summary || node.title,
        sourceState: node.source_state,
        sourceTitle: source?.title ?? node.source_title,
      },
    ];
  });
}

function getSearchFields(
  node: TerrainNode,
  source: TerrainScene["sources"][number] | undefined,
): Array<{ type: SearchMatchType; value: string }> {
  const fields: Array<{ type: SearchMatchType; value: string }> = [
    { type: "title", value: node.title },
    { type: "summary", value: node.summary ?? "" },
    { type: "tag", value: node.tags.join(" ") },
    { type: "type", value: node.type },
    { type: "quote", value: node.quote ?? "" },
    { type: "source_metadata", value: node.source_title ?? "" },
    { type: "source_metadata", value: node.source_url ?? "" },
    { type: "source_snippet", value: source?.snippet ?? "" },
    { type: "source_metadata", value: source?.title ?? "" },
    { type: "source_metadata", value: source?.url ?? "" },
    { type: "source_metadata", value: source?.reliability_hints.join(" ") ?? "" },
  ];

  return fields.filter((field) => field.value.trim().length > 0);
}

function findSourceForNode(scene: TerrainScene, node: TerrainNode): TerrainScene["sources"][number] | undefined {
  if (node.source_id) {
    return scene.sources.find((source) => source.id === node.source_id);
  }

  return scene.sources.find((source) => {
    if (node.source_url && source.url === node.source_url) {
      return true;
    }

    return Boolean(node.source_title && source.title === node.source_title);
  });
}

function createSnippet(value: string, query: string): string {
  const compactValue = value.trim().replace(/\s+/g, " ");
  const normalizedValue = normalize(compactValue);
  const normalizedQuery = normalize(query);
  const index = normalizedValue.indexOf(normalizedQuery);

  if (index < 0) {
    return compactValue.length > 180 ? `${compactValue.slice(0, 177)}...` : compactValue;
  }

  const start = Math.max(0, index - 58);
  const end = Math.min(compactValue.length, index + normalizedQuery.length + 92);
  const prefix = start > 0 ? "..." : "";
  const suffix = end < compactValue.length ? "..." : "";

  return `${prefix}${compactValue.slice(start, end)}${suffix}`;
}

function normalize(value: string): string {
  return value.trim().toLowerCase();
}
