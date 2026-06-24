import type { AgentJob, CartographerOutput, TerrainNode, TerrainScene } from "@seekstar/core-schema";

export type AiServiceStatus = "available" | "missing_key" | "disabled" | "error";

export interface AiKeyEnvelope {
  provider: "openai";
  encryptedKey: string;
  updatedAt: string;
}

export interface CartographerContextPacket {
  tabId: string;
  sceneId: string;
  seed: string;
  layer: string;
  selectedNodes: TerrainNode[];
  sourceSnippets: Array<{
    sourceId?: string;
    title: string;
    excerpt?: string;
  }>;
  userPrompt?: string;
}

export interface AiService {
  status(): Promise<AiServiceStatus>;
  buildContext(scene: TerrainScene, selectedNodeIds: string[], userPrompt?: string): CartographerContextPacket;
  runCartographer(job: AgentJob, context: CartographerContextPacket): Promise<CartographerOutput>;
}

export class UnconfiguredAiService implements AiService {
  async status(): Promise<AiServiceStatus> {
    return "missing_key";
  }

  buildContext(scene: TerrainScene, selectedNodeIds: string[], userPrompt?: string): CartographerContextPacket {
    return buildCartographerContext(scene, selectedNodeIds, userPrompt);
  }

  async runCartographer(job: AgentJob, context: CartographerContextPacket): Promise<CartographerOutput> {
    return {
      id: `ai-output-unavailable-${job.id}`,
      job_id: job.id,
      tab_id: context.tabId,
      mode: job.mode,
      title: "AI service unavailable",
      summary: "No encrypted AI API key is configured for this workspace.",
      source_state: "agent_inferred",
      target_node_ids: job.target_node_ids ?? [],
      target_source_ids: job.target_source_ids ?? [],
      notes: ["Configure AI Service before requesting Cartographer synthesis."],
      created_at: new Date().toISOString(),
    };
  }
}

export function buildCartographerContext(
  scene: TerrainScene,
  selectedNodeIds: string[],
  userPrompt?: string,
): CartographerContextPacket {
  const selected = new Set(selectedNodeIds);
  const selectedNodes = scene.nodes.filter((node) => selected.has(node.id));
  const activeTab = scene.tabs.find((tab) => tab.id === scene.active_tab_id) ?? scene.tabs[0];

  return {
    tabId: scene.active_tab_id,
    sceneId: scene.id,
    seed: activeTab?.seed ?? scene.metadata.title,
    layer: scene.viewport.layer,
    selectedNodes,
    sourceSnippets: selectedNodes.map((node) => ({
      sourceId: node.source_id,
      title: node.source_title ?? node.title,
      excerpt: node.quote ?? node.summary,
    })),
    userPrompt,
  };
}
