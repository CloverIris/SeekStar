import type { NodeType } from "@seekstar/core-schema";
import type { LevelBandId } from "./index.js";

export type LevelSourceCandidatePolicy = "none" | "optional_unverified" | "prefer_unverified";
export type LevelLayoutFamily = "bubble_gallery" | "source_compass" | "tile_field" | "deep_lens" | "recursive_seed";

export interface LevelModuleDefinition {
  level_id: LevelBandId;
  label: string;
  role: string;
  default_node_type: NodeType;
  default_target_count: number;
  source_candidate_policy: LevelSourceCandidatePolicy;
  layout_family: LevelLayoutFamily;
  prompt_brief: string;
  prompt_constraints: string[];
}

export interface LevelRuntimeProfile {
  id: string;
  label: string;
  language: string;
  density: "compact" | "normal" | "rich";
  modules: Record<LevelBandId, LevelModuleDefinition>;
}

export const DEFAULT_LEVEL_RUNTIME_PROFILE_ID = "seekstar-default-p6-gallery-v3";

export const DEFAULT_LEVEL_RUNTIME_PROFILE: LevelRuntimeProfile = {
  id: DEFAULT_LEVEL_RUNTIME_PROFILE_ID,
  label: "SeekStar P6 Cartographer default",
  language: "zh-Hans",
  density: "normal",
  modules: {
    supra_macro: {
      level_id: "supra_macro",
      label: "Supra Macro",
      role: "Broader contexts above the current domain without using negative levels.",
      default_node_type: "domain",
      default_target_count: 6,
      source_candidate_policy: "none",
      layout_family: "bubble_gallery",
      prompt_brief: "Infer broader systems, parent domains, and adjacent macro contexts for the seed.",
      prompt_constraints: [
        "Do not repeat the seed as every title.",
        "Prefer broad human-knowledge frames over narrow implementation details.",
        "Return cartographer_primary nodes only.",
        "Return title and node_type only; do not include summary or tags.",
      ],
    },
    L0: {
      level_id: "L0",
      label: "L0 Star Gallery",
      role: "Domain seed pool and broad Star Gallery terrain.",
      default_node_type: "domain",
      default_target_count: 24,
      source_candidate_policy: "none",
      layout_family: "bubble_gallery",
      prompt_brief: "Generate broad, explorable domains around the seed as an Apple-Watch-like Star Gallery.",
      prompt_constraints: [
        "Nodes should be domains or durable knowledge areas, not web pages.",
        "No source candidates at L0.",
        "Keep titles short enough for bubble labels.",
      ],
    },
    L1: {
      level_id: "L1",
      label: "L1 Topic Field",
      role: "Topics, subdomains, concept neighborhoods, and nearby exploration branches.",
      default_node_type: "topic",
      default_target_count: 10,
      source_candidate_policy: "optional_unverified",
      layout_family: "bubble_gallery",
      prompt_brief: "Decompose the focused domain into topic neighborhoods and same-level adjacent branches.",
      prompt_constraints: [
        "Nodes should be topic-level, not article-level.",
        "Use local adjacency rather than radial hub-and-spoke relations.",
        "Source candidates are optional and must remain unverified.",
        "Return compact nodes with title only unless a short summary is essential.",
      ],
    },
    L2: {
      level_id: "L2",
      label: "L2 Source Orientation",
      role: "Source directions, reference families, communities, repositories, papers, and trails.",
      default_node_type: "source",
      default_target_count: 8,
      source_candidate_policy: "prefer_unverified",
      layout_family: "source_compass",
      prompt_brief: "Orient the user toward classes of trustworthy material and include concrete candidate URLs that DataService can verify into L3 tiles.",
      prompt_constraints: [
        "Nodes should describe source directions or source families.",
        "Return 2-4 concrete candidate URLs in source_candidates when possible.",
        "Candidate URLs may be proposed, but only as cartographer_unverified_source.",
        "Prefer canonical, durable, or educational sources when proposing URLs.",
        "Return compact nodes with title only unless a short summary is essential.",
      ],
    },
    L3: {
      level_id: "L3",
      label: "L3 Tile Field",
      role: "Source candidate queue for webpages, papers, PDFs, images, and documents that DataService may verify into live tiles.",
      default_node_type: "fog_region",
      default_target_count: 3,
      source_candidate_policy: "prefer_unverified",
      layout_family: "tile_field",
      prompt_brief: "Return concrete URL source candidates for the focused source direction. Do not create webpage/document nodes for the main canvas.",
      prompt_constraints: [
        "Put every usable URL in source_candidates, not nodes.",
        "Return nodes as an empty array unless a fog/status marker is essential.",
        "Do not return cartographer_primary webpage or document nodes.",
        "Do not call any URL source-backed.",
        "Prefer URLs likely to load in a normal browser.",
        "Return 2-3 durable candidate URLs at most.",
      ],
    },
    deep_lens: {
      level_id: "deep_lens",
      label: "Deep Lens",
      role: "Continuous close-reading lens over sections, paragraphs, sentences, phrases, words, and characters.",
      default_node_type: "concept",
      default_target_count: 16,
      source_candidate_policy: "none",
      layout_family: "deep_lens",
      prompt_brief: "Prepare structured close-reading grains for a focused source or selected text.",
      prompt_constraints: [
        "Do not split into separate visible L4-L10 product levels.",
        "Every grain should be seedable when useful.",
        "No source candidates from text decomposition.",
      ],
    },
    recursive_seed: {
      level_id: "recursive_seed",
      label: "Recursive Seed",
      role: "Any selected grain becomes a new exploration universe.",
      default_node_type: "concept",
      default_target_count: 8,
      source_candidate_policy: "optional_unverified",
      layout_family: "recursive_seed",
      prompt_brief: "Bootstrap parent, sibling, and child contexts for an orphan seed.",
      prompt_constraints: [
        "Generate upward context and adjacent same-band context.",
        "Prepare at least one downward branch when possible.",
        "Keep provenance in context rather than pretending source evidence exists.",
      ],
    },
  },
};

export function listLevelRuntimeProfiles(): LevelRuntimeProfile[] {
  return [cloneProfile(DEFAULT_LEVEL_RUNTIME_PROFILE)];
}

export function resolveLevelRuntimeProfile(profileId?: string): LevelRuntimeProfile {
  if (!profileId || profileId === DEFAULT_LEVEL_RUNTIME_PROFILE.id) {
    return cloneProfile(DEFAULT_LEVEL_RUNTIME_PROFILE);
  }

  return {
    ...cloneProfile(DEFAULT_LEVEL_RUNTIME_PROFILE),
    id: profileId,
    label: `${profileId} (default-compatible)`,
  };
}

export function resolveLevelModuleDefinition(levelId: LevelBandId, profileId?: string): LevelModuleDefinition {
  const profile = resolveLevelRuntimeProfile(profileId);

  return profile.modules[levelId] ?? profile.modules.L0;
}

function cloneProfile(profile: LevelRuntimeProfile): LevelRuntimeProfile {
  return {
    ...profile,
    modules: Object.fromEntries(
      Object.entries(profile.modules).map(([levelId, definition]) => [
        levelId,
        {
          ...definition,
          prompt_constraints: [...definition.prompt_constraints],
        },
      ]),
    ) as Record<LevelBandId, LevelModuleDefinition>,
  };
}
