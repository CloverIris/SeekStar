import {
  Bot,
  Compass,
  Folder,
  Globe2,
  KeyRound,
  Settings,
  Sparkles,
  Star,
  Trash2,
  type LucideIcon,
} from "lucide-react";

export type SettingsSectionId =
  | "general"
  | "domainLexicon"
  | "contentProviders"
  | "apiAdapter"
  | "aiCartographer"
  | "runtime"
  | "scout"
  | "storage"
  | "development";

export interface SettingsSectionMeta {
  description: string;
  title: string;
}

export interface SettingsNavigationItem {
  group: "Workspace" | "Connections" | "Intelligence" | "System";
  icon: LucideIcon;
  id: SettingsSectionId;
  label: string;
}

export const SETTINGS_SECTION_META: Record<SettingsSectionId, SettingsSectionMeta> = {
  general: { title: "Overview", description: "Workspace status and the scope of each control group." },
  domainLexicon: { title: "Opening field", description: "Configure optional L0 vocabulary hints for a default New Seek." },
  contentProviders: { title: "Content providers", description: "Configure browser-assisted discovery and source candidate routes." },
  apiAdapter: { title: "AI connection", description: "Configure and test the real OpenAI-compatible model connection." },
  aiCartographer: { title: "AI Cartographer", description: "Tune prompt profiles, chunk scheduling, action policy, and cost visibility." },
  runtime: { title: "Performance", description: "Set tab memory behavior and source-tile density limits." },
  scout: { title: "Scout service", description: "Set background source observation concurrency." },
  storage: { title: "Local storage", description: "Inspect the local paths used by this development workspace." },
  development: { title: "Development", description: "Clear prototype-only data during local iteration." },
};

export const SETTINGS_NAVIGATION: SettingsNavigationItem[] = [
  { id: "general", label: "Overview", icon: Settings, group: "Workspace" },
  { id: "domainLexicon", label: "Opening field", icon: Star, group: "Workspace" },
  { id: "contentProviders", label: "Content providers", icon: Globe2, group: "Connections" },
  { id: "apiAdapter", label: "AI connection", icon: KeyRound, group: "Connections" },
  { id: "aiCartographer", label: "AI Cartographer", icon: Bot, group: "Intelligence" },
  { id: "scout", label: "Scout service", icon: Sparkles, group: "Intelligence" },
  { id: "runtime", label: "Performance", icon: Compass, group: "System" },
  { id: "storage", label: "Local storage", icon: Folder, group: "System" },
  { id: "development", label: "Development", icon: Trash2, group: "System" },
];

export function filterSettingsNavigation(query: string): SettingsNavigationItem[] {
  const normalized = query.trim().toLowerCase();

  return SETTINGS_NAVIGATION.filter((item) =>
    `${item.label} ${item.group} ${SETTINGS_SECTION_META[item.id].description}`.toLowerCase().includes(normalized),
  );
}
