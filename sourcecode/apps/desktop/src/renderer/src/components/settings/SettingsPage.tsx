import {
  DEFAULT_DOMAIN_LEXICON_ID,
  DEFAULT_DOMAIN_LEXICONS,
  cloneDomainLexicons,
  type DomainLexicon,
  type DomainLexiconTerm,
} from "@seekstar/constellation-engine";
import {
  BUILT_IN_CONTENT_PROVIDER_DEFINITIONS,
  DEFAULT_CONTENT_PROVIDER_SETTINGS,
  type ContentProviderDefinition,
  type ContentProviderSettings,
} from "@seekstar/core-schema";
import type { SeekStarSettings } from "../../../../main/appSettingsStore";
import type { AiAdapterTestResult, AiCartographerPromptPreviewResult } from "../../../../main/aiAssistantBridge";
import type { AiCostLedgerSnapshot } from "../../../../main/aiCostLedgerStore";
import type { AiAssistantActionType, CartographerGenerationMode } from "@seekstar/ai-service";
import type { ReactElement } from "react";
import { useEffect, useMemo, useState } from "react";
import { SETTINGS_SECTION_META, filterSettingsNavigation, type SettingsSectionId } from "./settingsNavigation";
import {
  ArrowLeft,
  Plus,
  RefreshCw,
  Search,
  Star,
  Trash2,
} from "lucide-react";
type AiProviderSettingsDraft = SeekStarSettings["ai_providers"][number];
type AiRouteSettingsDraft = SeekStarSettings["ai_routes"][number];
type AssistantActionPermissionRuleDraft = SeekStarSettings["assistant_action_permission_rules"][number];
type CartographerChunkSchedulingDraft = SeekStarSettings["cartographer_chunk_scheduling"];
type CartographerPromptProfileDraft = SeekStarSettings["cartographer_prompt_profile"];
type CartographerPromptModuleDraft = CartographerPromptProfileDraft["modules"][number];
type CartographerPromptProfileRevisionDraft = SeekStarSettings["cartographer_prompt_profile_revisions"][number];

interface SettingsPageProps {
  onApplyDomainLexicon: (settings: SeekStarSettings) => Promise<void> | void;
  onBack: () => void;
  onClearCache: () => Promise<unknown> | void;
  onSave: (settings: SeekStarSettings) => Promise<void> | void;
  settings?: SeekStarSettings;
  storePaths: Record<string, string>;
}

const domainLexiconLanguages = [
  { id: "en", label: "EN" },
  { id: "zh-Hans", label: "ZH-CN" },
  { id: "zh-Hant", label: "ZH-TW" },
] as const;

const DEEPSEEK_AI_PROVIDER_ID = "deepseek-openai-compatible";

const assistantActionPermissionRuleMeta: Array<{
  action_type: Exclude<AiAssistantActionType, "none">;
  label: string;
  description: string;
}> = [
  {
    action_type: "focus_node",
    label: "Focus node",
    description: "Move selection or viewport focus inside the current map.",
  },
  {
    action_type: "request_chunk",
    label: "Expand map chunk",
    description: "Ask Cartographer for nearby level-runtime terrain.",
  },
  {
    action_type: "observe_source",
    label: "Observe source",
    description: "Run DataService/Scout on a candidate URL before source-backed tiles appear.",
  },
  {
    action_type: "create_seed",
    label: "Create seed tab",
    description: "Open a new recursive Seek tab from a suggested term or node.",
  },
  {
    action_type: "open_settings",
    label: "Open settings",
    description: "Navigate the shell into settings.",
  },
];

export function SettingsPage({
  onApplyDomainLexicon,
  onBack,
  onClearCache,
  onSave,
  settings,
  storePaths,
}: SettingsPageProps): ReactElement {
  const [draft, setDraft] = useState<SeekStarSettings | undefined>(settings);
  const [savedDraftFingerprint, setSavedDraftFingerprint] = useState(() => settingsFingerprint(settings));
  const [searchValue, setSearchValue] = useState("");
  const [statusText, setStatusText] = useState("Ready");
  const [activeSection, setActiveSection] = useState<SettingsSectionId>("general");
  const [selectedLexiconId, setSelectedLexiconId] = useState(DEFAULT_DOMAIN_LEXICON_ID);
  const [selectedTermId, setSelectedTermId] = useState<string | undefined>();
  const [costLedger, setCostLedger] = useState<AiCostLedgerSnapshot | undefined>();
  const [adapterTest, setAdapterTest] = useState<AiAdapterTestResult | undefined>();
  const [adapterTestStatus, setAdapterTestStatus] = useState("Ready");

  useEffect(() => {
    setDraft(settings);
    setSavedDraftFingerprint(settingsFingerprint(settings));
    setSelectedLexiconId(settings?.active_domain_lexicon_id ?? DEFAULT_DOMAIN_LEXICON_ID);
    setSelectedTermId(undefined);
  }, [settings]);

  useEffect(() => {
    if (activeSection !== "aiCartographer") {
      return;
    }

    let isActive = true;

    void window.seekstar.ai
      .loadCostLedger()
      .then((snapshot) => {
        if (isActive) {
          setCostLedger(snapshot);
        }
      })
      .catch(() => {
        if (isActive) {
          setStatusText("Failed to load AI cost ledger");
        }
      });

    return () => {
      isActive = false;
    };
  }, [activeSection]);

  const cacheMb = Math.round((draft?.tab_cache_max_bytes ?? 0) / 1024 / 1024);
  const inactiveMinutes = Math.round((draft?.inactive_grace_ms ?? 0) / 60_000);
  const tileFieldTargetCount = draft?.tile_field_target_count ?? 25;
  const tileLiveSurfaceLimit = draft?.tile_live_surface_limit ?? 1;
  const tileThumbnailPrewarmConcurrency = draft?.tile_thumbnail_prewarm_concurrency ?? 2;
  const domainLexicons = draft?.domain_lexicons ?? cloneDomainLexicons(DEFAULT_DOMAIN_LEXICONS);
  const contentProviders = draft?.content_providers ?? cloneContentProviderSettings(DEFAULT_CONTENT_PROVIDER_SETTINGS);
  const aiProviders = draft?.ai_providers ?? createDefaultAiProviderSettings();
  const activeAiProviderId = draft?.active_ai_provider_id ?? aiProviders.find((provider) => provider.enabled)?.id ?? DEEPSEEK_AI_PROVIDER_ID;
  const aiRoutes = draft?.ai_routes ?? createDefaultAiRouteSettings(activeAiProviderId);
  const assistantActionPermissionMode = draft?.assistant_action_permission_mode ?? "ask_each_time";
  const assistantActionPermissionRules = draft?.assistant_action_permission_rules ?? createDefaultAssistantActionPermissionRules();
  const cartographerChunkScheduling = draft?.cartographer_chunk_scheduling ?? createDefaultCartographerChunkSchedulingSettings();
  const cartographerPromptProfile = draft?.cartographer_prompt_profile ?? createDefaultCartographerPromptProfileSettings();
  const cartographerPromptProfileRevisions = draft?.cartographer_prompt_profile_revisions ?? [];
  const selectedLexicon =
    domainLexicons.find((lexicon) => lexicon.id === selectedLexiconId) ??
    domainLexicons.find((lexicon) => lexicon.active) ??
    domainLexicons[0];
  const selectedTerm = selectedLexicon?.terms.find((term) => term.id === selectedTermId) ?? selectedLexicon?.terms[0];
  const isDirty = useMemo(() => settingsFingerprint(draft) !== savedDraftFingerprint, [draft, savedDraftFingerprint]);
  const displayedStatus = isDirty ? "Unsaved changes" : statusText;

  function updateDraft(patch: Partial<SeekStarSettings>): void {
    setDraft((current) => ({
      ...createSettingsDraft(current),
      ...patch,
    }));
  }

  function updateDomainLexicons(nextLexicons: DomainLexicon[], nextActiveId?: string): void {
    const activeId =
      nextActiveId ??
      nextLexicons.find((lexicon) => lexicon.active)?.id ??
      nextLexicons[0]?.id ??
      DEFAULT_DOMAIN_LEXICON_ID;

    updateDraft({
      active_domain_lexicon_id: activeId,
      domain_lexicons: nextLexicons.map((lexicon) => ({
        ...lexicon,
        active: lexicon.id === activeId,
        updated_at: new Date().toISOString(),
      })),
    });
  }

  function updateContentProvider(providerId: string, patch: Partial<ContentProviderSettings>): void {
    updateDraft({
      content_providers: contentProviders.map((provider) => (provider.id === providerId ? { ...provider, ...patch } : provider)),
    });
  }

  function handleContentProvidersReset(): void {
    updateDraft({
      content_providers: cloneContentProviderSettings(DEFAULT_CONTENT_PROVIDER_SETTINGS),
    });
  }

  function handleContentProviderValidate(providerId: string): void {
    const definition = BUILT_IN_CONTENT_PROVIDER_DEFINITIONS.find((provider) => provider.id === providerId);
    const current = contentProviders.find((provider) => provider.id === providerId);
    const enabled = current?.enabled ?? definition?.default_enabled ?? false;

    updateContentProvider(providerId, {
      health_status: enabled ? "ready" : "disabled",
      health_message: enabled ? "Ready for the next Scout registry rebuild." : "Disabled by settings.",
    });
  }

  function updateAiProvider(providerId: string, patch: Partial<AiProviderSettingsDraft>): void {
    const nextProviders = aiProviders.map((provider) => {
      if (provider.id !== providerId) {
        return provider;
      }

      const nextProvider = { ...provider, ...patch };
      const enabled = nextProvider.enabled;

      return {
        ...nextProvider,
        health_status: enabled
          ? nextProvider.kind === "openai_compatible" && !nextProvider.api_key_value?.trim() && !nextProvider.api_key_env_var?.trim()
            ? "missing_key"
            : nextProvider.health_status === "error"
              ? "error"
              : "ready"
          : "disabled",
      } satisfies AiProviderSettingsDraft;
    });

    updateDraft({
      ai_providers: nextProviders,
      active_ai_provider_id: nextProviders.some((provider) => provider.id === activeAiProviderId) ? activeAiProviderId : nextProviders[0]?.id,
    });
  }

  function updateAiRoute(routeId: string, patch: Partial<AiRouteSettingsDraft>): void {
    updateDraft({
      ai_routes: aiRoutes.map((route) => (route.id === routeId ? { ...route, ...patch } : route)),
    });
  }

  function updateAssistantActionPermissionRule(actionType: AssistantActionPermissionRuleDraft["action_type"], patch: Partial<AssistantActionPermissionRuleDraft>): void {
    const rulesByType = new Map(assistantActionPermissionRules.map((rule) => [rule.action_type, rule]));

    updateDraft({
      assistant_action_permission_rules: assistantActionPermissionRuleMeta.map((meta) => ({
        action_type: meta.action_type,
        decision:
          meta.action_type === actionType
            ? (patch.decision ?? rulesByType.get(meta.action_type)?.decision ?? "ask_each_time")
            : (rulesByType.get(meta.action_type)?.decision ?? "ask_each_time"),
      })),
    });
  }

  function updateCartographerChunkScheduling(patch: Partial<CartographerChunkSchedulingDraft>): void {
    updateDraft({
      cartographer_chunk_scheduling: {
        ...cartographerChunkScheduling,
        ...patch,
      },
    });
  }

  function updateCartographerPromptProfile(patch: Partial<CartographerPromptProfileDraft>): void {
    updateDraft({
      cartographer_prompt_profile: {
        ...cartographerPromptProfile,
        ...patch,
      },
    });
  }

  function updateCartographerPromptModule(levelId: CartographerPromptModuleDraft["level_id"], patch: Partial<CartographerPromptModuleDraft>): void {
    updateDraft({
      cartographer_prompt_profile: {
        ...cartographerPromptProfile,
        modules: cartographerPromptProfile.modules.map((module) => (module.level_id === levelId ? { ...module, ...patch } : module)),
      },
    });
  }

  function handleCartographerPromptProfileRevisionSave(): void {
    const now = new Date().toISOString();
    const revision = createPromptProfileRevisionHash(cartographerPromptProfile);
    const nextRevision: CartographerPromptProfileRevisionDraft = {
      created_at: now,
      id: createUiId("prompt-revision"),
      label: `${cartographerPromptProfile.label} / ${revision}`,
      profile: clonePromptProfile(cartographerPromptProfile),
      revision,
    };

    updateDraft({
      cartographer_prompt_profile_revisions: [nextRevision, ...cartographerPromptProfileRevisions].slice(0, 20),
    });
  }

  function handleCartographerPromptProfileRevisionRestore(revisionId: string): void {
    const revision = cartographerPromptProfileRevisions.find((candidate) => candidate.id === revisionId);

    if (!revision) {
      return;
    }

    updateDraft({
      cartographer_prompt_profile: clonePromptProfile(revision.profile),
    });
  }

  function handleCartographerPromptProfileRevisionDelete(revisionId: string): void {
    updateDraft({
      cartographer_prompt_profile_revisions: cartographerPromptProfileRevisions.filter((revision) => revision.id !== revisionId),
    });
  }

  function handleAiProviderActivate(providerId: string): void {
    updateDraft({
      active_ai_provider_id: providerId,
      ai_providers: aiProviders.map((provider) => ({
        ...provider,
        enabled: provider.id === providerId ? true : provider.enabled,
        health_status: provider.id === providerId ? "ready" : provider.health_status,
      })),
      ai_routes: aiRoutes.map((route) => ({
        ...route,
        provider_id: providerId,
      })),
    });
  }

  function handleAiProvidersReset(): void {
    const defaults = createDefaultAiProviderSettings();
    const activeId = defaults.find((provider) => provider.enabled)?.id ?? defaults[0]?.id ?? DEEPSEEK_AI_PROVIDER_ID;

    updateDraft({
      active_ai_provider_id: activeId,
      ai_providers: defaults,
      ai_routes: createDefaultAiRouteSettings(activeId),
    });
  }

  async function handleAiAdapterTest(providerId?: string): Promise<void> {
    if (!draft) {
      return;
    }

    setAdapterTestStatus("Calling adapter...");
    setStatusText("Testing API Adapter...");

    try {
      const result = await window.seekstar.ai.testAdapter({
        provider_id: providerId,
        seed: "SeekStar adapter connectivity test",
        settings: draft,
      });

      setAdapterTest(result);
      setAdapterTestStatus(
        result.status === "ok"
          ? `OK: ${result.node_count} nodes / ${result.elapsed_ms}ms`
          : `${result.status}: ${result.diagnostics[0]?.message ?? "No diagnostic message"}`,
      );
      setStatusText(result.status === "ok" ? "API Adapter responded" : "API Adapter test failed");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setAdapterTest(undefined);
      setAdapterTestStatus(`Failed: ${message}`);
      setStatusText("API Adapter test failed");
    }
  }

  function updateSelectedLexicon(patch: Partial<DomainLexicon>): void {
    if (!selectedLexicon) {
      return;
    }

    updateDomainLexicons(
      domainLexicons.map((lexicon) => (lexicon.id === selectedLexicon.id ? { ...lexicon, ...patch } : lexicon)),
      draft?.active_domain_lexicon_id,
    );
  }

  function handleLexiconCreate(): void {
    const now = new Date().toISOString();
    const nextLexicon: DomainLexicon = {
      id: createUiId("domain-lexicon"),
      title: "Custom domain lexicon",
      description: "Custom L0 vocabulary for a New Seek starting field.",
      active: false,
      terms: [],
      updated_at: now,
    };

    updateDomainLexicons([...domainLexicons, nextLexicon], draft?.active_domain_lexicon_id);
    setSelectedLexiconId(nextLexicon.id);
    setSelectedTermId(undefined);
  }

  function handleLexiconDelete(lexiconId: string): void {
    if (domainLexicons.length <= 1) {
      return;
    }

    const nextLexicons = domainLexicons.filter((lexicon) => lexicon.id !== lexiconId);
    const activeId = draft?.active_domain_lexicon_id === lexiconId ? nextLexicons[0]?.id : draft?.active_domain_lexicon_id;

    updateDomainLexicons(nextLexicons, activeId);
    setSelectedLexiconId(activeId ?? nextLexicons[0]?.id ?? DEFAULT_DOMAIN_LEXICON_ID);
    setSelectedTermId(undefined);
  }

  function handleLexiconActivate(lexiconId: string): void {
    updateDomainLexicons(domainLexicons, lexiconId);
    setSelectedLexiconId(lexiconId);
  }

  function handleTermCreate(): void {
    if (!selectedLexicon) {
      return;
    }

    const nextTerm: DomainLexiconTerm = {
      id: createUiId("domain-term"),
      canonical: "New domain",
      enabled: true,
      labels: {
        en: "New domain",
        "zh-Hans": "New domain",
        "zh-Hant": "New domain",
      },
      tags: [],
    };

    updateSelectedLexicon({
      terms: [...selectedLexicon.terms, nextTerm],
    });
    setSelectedTermId(nextTerm.id);
  }

  function handleTermDelete(termId: string): void {
    if (!selectedLexicon) {
      return;
    }

    updateSelectedLexicon({
      terms: selectedLexicon.terms.filter((term) => term.id !== termId),
    });
    setSelectedTermId(undefined);
  }

  function updateSelectedTerm(termId: string, patch: Partial<DomainLexiconTerm>): void {
    if (!selectedLexicon) {
      return;
    }

    updateSelectedLexicon({
      terms: selectedLexicon.terms.map((term) => (term.id === termId ? { ...term, ...patch } : term)),
    });
  }

  function updateTermLabel(term: DomainLexiconTerm, language: string, value: string): void {
    updateSelectedTerm(term.id, {
      labels: {
        ...term.labels,
        [language]: value,
      },
    });
  }

  async function handleClearDevelopmentData(): Promise<void> {
    const confirmed = window.confirm("Clear SeekStar development workspace, tab runtime, and settings data? This cannot be undone.");

    if (!confirmed) {
      return;
    }

    setStatusText("Clearing development data...");
    await window.seekstar.workspace.clearDevelopmentData();
    window.location.reload();
  }

  async function handleClearCache(): Promise<void> {
    setStatusText("Clearing tab cache...");
    await onClearCache();
    setStatusText("Tab cache cleared");
  }

  async function handleSave(): Promise<void> {
    if (!draft) {
      return;
    }

    setStatusText("Saving settings...");
    await onSave(draft);
    setSavedDraftFingerprint(settingsFingerprint(draft));
    setStatusText("Settings saved");
  }

  function handleDiscard(): void {
    setDraft(settings);
    setSavedDraftFingerprint(settingsFingerprint(settings));
    setSelectedLexiconId(settings?.active_domain_lexicon_id ?? DEFAULT_DOMAIN_LEXICON_ID);
    setSelectedTermId(undefined);
    setStatusText("Changes discarded");
  }

  async function handleApplyDomainLexicon(): Promise<void> {
    if (!draft) {
      return;
    }

    setStatusText("Applying domain lexicon...");
    await onApplyDomainLexicon(draft);
    setStatusText("Domain lexicon applied to New Seek");
  }

  async function handleRefreshCostLedger(): Promise<void> {
    setStatusText("Loading AI cost ledger...");
    const snapshot = await window.seekstar.ai.loadCostLedger();
    setCostLedger(snapshot);
    setStatusText("AI cost ledger refreshed");
  }

  async function handleClearCostLedger(): Promise<void> {
    const confirmed = window.confirm("Clear local AI cost ledger records? This does not change settings or cached map data.");

    if (!confirmed) {
      return;
    }

    setStatusText("Clearing AI cost ledger...");
    const snapshot = await window.seekstar.ai.clearCostLedger();
    setCostLedger(snapshot);
    setStatusText("AI cost ledger cleared");
  }

  async function handleExportCostLedger(): Promise<void> {
    setStatusText("Exporting AI cost ledger...");
    const json = await window.seekstar.ai.exportCostLedger();
    const blob = new Blob([json], { type: "application/json" });
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement("a");

    anchor.href = objectUrl;
    anchor.download = `seekstar-ai-cost-ledger-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(objectUrl);
    setStatusText("AI cost ledger exported");
  }

  const visibleNavItems = filterSettingsNavigation(searchValue);
  const visibleNavGroups = Array.from(new Set(visibleNavItems.map((item) => item.group)));
  const resolvedActiveSection = visibleNavItems.some((item) => item.id === activeSection)
    ? activeSection
    : (visibleNavItems[0]?.id ?? "general");
  const activeMeta = SETTINGS_SECTION_META[resolvedActiveSection];

  return (
    <section className="settings-page" aria-label="SeekStar settings">
      <aside className="settings-page-sidebar">
        <button className="settings-back" onClick={onBack} type="button">
          <ArrowLeft aria-hidden="true" size={14} strokeWidth={1.8} />
          Back to app
        </button>
        <label className="settings-search">
          <Search aria-hidden="true" size={14} strokeWidth={1.8} />
          <input
            aria-label="Search settings"
            onChange={(event) => setSearchValue(event.target.value)}
            placeholder="Search settings..."
            value={searchValue}
          />
        </label>
        <nav className="settings-nav" aria-label="Settings sections">
          {visibleNavGroups.map((group) => (
            <div className="settings-nav-group" key={group}>
              <span>{group}</span>
              {visibleNavItems.filter((item) => item.group === group).map((item) => (
                <button
                  aria-current={resolvedActiveSection === item.id ? "page" : undefined}
                  className={resolvedActiveSection === item.id ? "active" : ""}
                  key={item.id}
                  onClick={() => setActiveSection(item.id)}
                  type="button"
                >
                  <item.icon aria-hidden="true" size={14} strokeWidth={1.8} />
                  {item.label}
                </button>
              ))}
            </div>
          ))}
        </nav>
      </aside>

      <div className="settings-page-content">
        <div className="settings-content-scroll">
          <div className="settings-panel">
            <header className="settings-hero">
              <p>CONTROL CENTER</p>
              <h1>{activeMeta.title}</h1>
              <span className={isDirty ? "is-dirty" : ""}>{displayedStatus}</span>
              <p>{activeMeta.description}</p>
            </header>

            {resolvedActiveSection === "general" ? (
              <section className="settings-section">
                <div className="settings-card">
                  <div className="settings-row">
                    <span>
                      <strong>Settings draft</strong>
                      <small>{isDirty ? "Changes are local to this page until you save them." : "Your local control settings are saved and active."}</small>
                    </span>
                  </div>
                  <div className="settings-row">
                    <span>
                      <strong>Product boundary</strong>
                      <small>Opening field controls the first map; Connections configure external services; Intelligence controls terrain production and Scout.</small>
                    </span>
                  </div>
                </div>
              </section>
            ) : null}

            {resolvedActiveSection === "domainLexicon" ? (
              <DomainLexiconEditor
                domainHintMode={draft?.domain_hint_mode ?? "guided"}
                domainLexicons={domainLexicons}
                draft={draft}
                onActivate={handleLexiconActivate}
                onCreateLexicon={handleLexiconCreate}
                onCreateTerm={handleTermCreate}
                onDeleteLexicon={handleLexiconDelete}
                onDeleteTerm={handleTermDelete}
                onApply={handleApplyDomainLexicon}
                onSelectLexicon={(lexiconId) => {
                  setSelectedLexiconId(lexiconId);
                  setSelectedTermId(undefined);
                }}
                onSelectTerm={setSelectedTermId}
                onDomainHintModeChange={(mode) => updateDraft({ domain_hint_mode: mode })}
                onTermLabelChange={updateTermLabel}
                onTermUpdate={updateSelectedTerm}
                onLexiconUpdate={updateSelectedLexicon}
                selectedLexicon={selectedLexicon}
                selectedTerm={selectedTerm}
              />
            ) : null}

            {resolvedActiveSection === "contentProviders" ? (
              <ContentProviderEditor
                definitions={BUILT_IN_CONTENT_PROVIDER_DEFINITIONS}
                onProviderUpdate={updateContentProvider}
                onReset={handleContentProvidersReset}
                onValidate={handleContentProviderValidate}
                providers={contentProviders}
              />
            ) : null}

            {resolvedActiveSection === "apiAdapter" ? (
              <ApiAdapterEditor
                activeProviderId={activeAiProviderId}
                adapterTest={adapterTest}
                adapterTestStatus={adapterTestStatus}
                onActivate={handleAiProviderActivate}
                onProviderUpdate={updateAiProvider}
                onReset={handleAiProvidersReset}
                onRouteUpdate={updateAiRoute}
                onTest={handleAiAdapterTest}
                providers={aiProviders}
                routes={aiRoutes}
              />
            ) : null}

            {resolvedActiveSection === "aiCartographer" ? (
              <AiProviderEditor
                assistantActionPermissionMode={assistantActionPermissionMode}
                assistantActionPermissionRules={assistantActionPermissionRules}
                onAssistantActionPermissionModeChange={(mode) => updateDraft({ assistant_action_permission_mode: mode })}
                onAssistantActionPermissionRuleChange={updateAssistantActionPermissionRule}
                onChunkSchedulingUpdate={updateCartographerChunkScheduling}
                onPromptModuleUpdate={updateCartographerPromptModule}
                onPromptProfileUpdate={updateCartographerPromptProfile}
                onPromptRevisionDelete={handleCartographerPromptProfileRevisionDelete}
                onPromptRevisionRestore={handleCartographerPromptProfileRevisionRestore}
                onPromptRevisionSave={handleCartographerPromptProfileRevisionSave}
                chunkScheduling={cartographerChunkScheduling}
                costLedger={costLedger}
                onClearCostLedger={handleClearCostLedger}
                onExportCostLedger={handleExportCostLedger}
                onRefreshCostLedger={handleRefreshCostLedger}
                promptProfile={cartographerPromptProfile}
                promptProfileRevisions={cartographerPromptProfileRevisions}
              />
            ) : null}

            {resolvedActiveSection === "runtime" ? (
              <section className="settings-section">
                <div className="settings-card">
                  <label className="settings-row">
                    <span>
                      <strong>Tab cache limit</strong>
                      <small>Logical memory budget for each tab object cache.</small>
                    </span>
                    <input
                      min={32}
                      max={2048}
                      onChange={(event) => updateDraft({ tab_cache_max_bytes: Number(event.target.value) * 1024 * 1024 })}
                      type="number"
                      value={cacheMb || 256}
                    />
                  </label>
                  <label className="settings-row">
                    <span>
                      <strong>Inactive grace</strong>
                      <small>Minutes before an inactive tab is visually cooled down.</small>
                    </span>
                    <input
                      min={1}
                      max={1440}
                      onChange={(event) => updateDraft({ inactive_grace_ms: Number(event.target.value) * 60_000 })}
                      type="number"
                      value={inactiveMinutes || 30}
                    />
                  </label>
                  <label className="settings-row">
                    <span>
                      <strong>Tile field density</strong>
                      <small>Target visible L3 content tiles per viewport before browser absorption.</small>
                    </span>
                    <input
                      min={4}
                      max={80}
                      onChange={(event) => updateDraft({ tile_field_target_count: Number(event.target.value) })}
                      type="number"
                      value={tileFieldTargetCount}
                    />
                  </label>
                  <label className="settings-row">
                    <span>
                      <strong>Thumbnail prewarm concurrency</strong>
                      <small>Background offscreen webpage captures allowed at once for visible L3 tiles.</small>
                    </span>
                    <input
                      min={1}
                      max={6}
                      onChange={(event) => updateDraft({ tile_thumbnail_prewarm_concurrency: Number(event.target.value) })}
                      type="number"
                      value={tileThumbnailPrewarmConcurrency}
                    />
                  </label>
                  <label className="settings-row">
                    <span>
                      <strong>Live tile limit</strong>
                      <small>Interactive WebContentsView surfaces allowed at once after absorption.</small>
                    </span>
                    <input
                      min={1}
                      max={8}
                      onChange={(event) => updateDraft({ tile_live_surface_limit: Number(event.target.value) })}
                      type="number"
                      value={tileLiveSurfaceLimit}
                    />
                  </label>
                </div>
              </section>
            ) : null}

            {resolvedActiveSection === "scout" ? (
              <section className="settings-section">
                <div className="settings-card">
                  <label className="settings-row">
                    <span>
                      <strong>Scout concurrency</strong>
                      <small>Maximum background Scout jobs that can run at once.</small>
                    </span>
                    <input
                      min={1}
                      max={8}
                      onChange={(event) => updateDraft({ scout_concurrency: Number(event.target.value) })}
                      type="number"
                      value={draft?.scout_concurrency ?? 2}
                    />
                  </label>
                </div>
              </section>
            ) : null}

            {resolvedActiveSection === "storage" ? (
              <section className="settings-section">
                <div className="settings-card settings-path-list">
                  {Object.entries(storePaths).map(([key, value]) => (
                    <p key={key}>
                      <span>{key.replace(/_/g, " ")}</span>
                      <code>{value}</code>
                    </p>
                  ))}
                </div>
              </section>
            ) : null}

            {resolvedActiveSection === "development" ? (
              <section className="settings-section">
                <div className="settings-card settings-actions-card">
                  <button onClick={handleClearCache} type="button">
                    <RefreshCw aria-hidden="true" size={14} strokeWidth={1.8} />
                    Clear tab cache
                  </button>
                  <button className="danger" onClick={handleClearDevelopmentData} type="button">
                    <Trash2 aria-hidden="true" size={14} strokeWidth={1.8} />
                    Clear development data
                  </button>
                </div>
              </section>
            ) : null}
          </div>
        </div>

        <footer className="settings-savebar">
          <button onClick={onBack} type="button">
            Back
          </button>
          {isDirty ? <button onClick={handleDiscard} type="button">Discard</button> : null}
          <button className="primary" disabled={!draft || !isDirty} onClick={handleSave} type="button">
            Save settings
          </button>
        </footer>
      </div>
    </section>
  );
}

function ContentProviderEditor({
  definitions,
  onProviderUpdate,
  onReset,
  onValidate,
  providers,
}: {
  definitions: readonly ContentProviderDefinition[];
  onProviderUpdate: (providerId: string, patch: Partial<ContentProviderSettings>) => void;
  onReset: () => void;
  onValidate: (providerId: string) => void;
  providers: ContentProviderSettings[];
}): ReactElement {
  const providersById = new Map(providers.map((provider) => [provider.id, provider]));
  const groupedDefinitions = groupContentProviderDefinitions(definitions);
  const enabledCount = providers.filter((provider) => provider.enabled).length;

  return (
    <section className="settings-section content-provider-section">
      <div className="content-provider-toolbar">
        <div>
          <strong>Provider registry</strong>
          <span>{enabledCount} active providers</span>
        </div>
        <button onClick={onReset} type="button">
          <RefreshCw aria-hidden="true" size={14} strokeWidth={1.8} />
          Reset defaults
        </button>
      </div>

      <div className="content-provider-groups">
        {groupedDefinitions.map((group) => (
          <section className="content-provider-group" key={group.id}>
            <header>
              <span>{group.label}</span>
              <small>{group.items.filter((definition) => providersById.get(definition.id)?.enabled).length} enabled</small>
            </header>
            <div className="content-provider-list">
              {group.items.length === 0 ? <p className="content-provider-empty">No built-in provider in this group yet.</p> : null}
              {group.items.map((definition) => {
                const setting = providersById.get(definition.id) ?? createDefaultContentProviderSetting(definition);
                const languages = setting.languages ?? definition.default_languages ?? [];
                const supportsKeyRef = Boolean(definition.requires_api_key || definition.api_key_env_var);
                const keyRefName = setting.api_key_ref?.kind === "env" ? setting.api_key_ref.name : (setting.api_key_env_var ?? "");

                return (
                  <article className="content-provider-card" data-provider-enabled={setting.enabled} key={definition.id}>
                    <div className="content-provider-card-main">
                      <label className="content-provider-enable">
                        <input
                          checked={setting.enabled}
                          onChange={(event) =>
                            onProviderUpdate(definition.id, {
                              enabled: event.target.checked,
                              health_status: event.target.checked ? "ready" : "disabled",
                            })
                          }
                          type="checkbox"
                        />
                      </label>
                      <div className="content-provider-identity">
                        <strong>{definition.label}</strong>
                        <small>{definition.domains?.join(", ") ?? definition.provider_kind}</small>
                      </div>
                      <span className="content-provider-status">{setting.health_status ?? (setting.enabled ? "ready" : "disabled")}</span>
                    </div>

                    <div className="content-provider-controls">
                      <label>
                        <span>Priority</span>
                        <input
                          min={1}
                          max={999}
                          onChange={(event) => onProviderUpdate(definition.id, { priority: Number(event.target.value) })}
                          type="number"
                          value={setting.priority}
                        />
                      </label>
                      <label>
                        <span>Languages</span>
                        <input
                          disabled={!definition.supported_languages?.length}
                          onChange={(event) =>
                            onProviderUpdate(definition.id, {
                              languages: event.target.value
                                .split(",")
                                .map((language) => language.trim())
                                .filter(Boolean),
                            })
                          }
                          value={languages.join(", ")}
                        />
                      </label>
                      {supportsKeyRef ? (
                        <label>
                          <span>Env key ref</span>
                          <input
                            onChange={(event) => onProviderUpdate(definition.id, createContentProviderKeyRefPatch(event.target.value))}
                            placeholder={definition.api_key_env_var ?? "ENV_VAR"}
                            value={keyRefName}
                          />
                        </label>
                      ) : null}
                      <button onClick={() => onValidate(definition.id)} type="button">
                        Validate
                      </button>
                    </div>

                    <div className="content-provider-meta">
                      <span>{definition.provider_kind}</span>
                      {supportsKeyRef ? <small>Stores an environment-variable reference only; provider keys are never saved here.</small> : null}
                      {definition.rate_limit_note ? <small>{definition.rate_limit_note}</small> : null}
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </section>
  );
}

function ApiAdapterEditor({
  activeProviderId,
  adapterTest,
  adapterTestStatus,
  onActivate,
  onProviderUpdate,
  onReset,
  onRouteUpdate,
  onTest,
  providers,
  routes,
}: {
  activeProviderId: string;
  adapterTest?: AiAdapterTestResult;
  adapterTestStatus: string;
  onActivate: (providerId: string) => void;
  onProviderUpdate: (providerId: string, patch: Partial<AiProviderSettingsDraft>) => void;
  onReset: () => void;
  onRouteUpdate: (routeId: string, patch: Partial<AiRouteSettingsDraft>) => void;
  onTest: (providerId?: string) => Promise<void> | void;
  providers: AiProviderSettingsDraft[];
  routes: AiRouteSettingsDraft[];
}): ReactElement {
  const enabledCount = providers.filter((provider) => provider.enabled).length;
  const providerOptions = providers.map((provider) => ({ id: provider.id, label: provider.label }));

  return (
    <section className="settings-section content-provider-section">
      <div className="content-provider-toolbar">
        <div>
          <strong>API Adapter</strong>
          <span>
            {enabledCount} enabled / active {activeProviderId}
          </span>
        </div>
        <div>
          <button onClick={() => onTest()} type="button">
            <RefreshCw aria-hidden="true" size={14} strokeWidth={1.8} />
            Test active adapter
          </button>
          <button onClick={onReset} type="button">
            Reset defaults
          </button>
        </div>
      </div>

      <div className="content-provider-groups">
        <section className="content-provider-group">
          <header>
            <span>Adapter health test</span>
            <small>{adapterTestStatus}</small>
          </header>
          <div className="settings-card ai-adapter-test-card">
            <div className="ai-cost-ledger-summary">
              <div>
                <span>Status</span>
                <strong>{adapterTest?.status ?? "not tested"}</strong>
              </div>
              <div>
                <span>Provider</span>
                <strong>{adapterTest?.provider_id ?? activeProviderId}</strong>
              </div>
              <div>
                <span>Model</span>
                <strong>{adapterTest?.model ?? "provider default"}</strong>
              </div>
              <div>
                <span>Output</span>
                <strong>
                  {adapterTest ? `${adapterTest.node_count}N/${adapterTest.relation_count}R/${adapterTest.source_candidate_count}C` : "pending"}
                </strong>
              </div>
            </div>

            {adapterTest?.diagnostics.length ? (
              <div className="ai-adapter-diagnostics">
                {adapterTest.diagnostics.slice(0, 6).map((diagnostic) => (
                  <p key={`${diagnostic.code}-${diagnostic.message}`}>
                    <strong>{diagnostic.code}</strong>
                    <span>{diagnostic.message}</span>
                  </p>
                ))}
              </div>
            ) : null}

            {adapterTest ? (
              <div className="ai-prompt-preview-output">
                <div className="ai-prompt-preview-meta">
                  <span>{adapterTest.level_id}</span>
                  <span>{adapterTest.elapsed_ms}ms</span>
                  <span>{adapterTest.generated_at}</span>
                </div>
                <article>
                  <strong>Request preview</strong>
                  <pre>{adapterTest.request_preview}</pre>
                </article>
                <article>
                  <strong>Response preview</strong>
                  <pre>{adapterTest.response_preview}</pre>
                </article>
              </div>
            ) : null}
          </div>
        </section>

        <section className="content-provider-group">
          <header>
            <span>AIServiceProvider</span>
            <small>OpenAI-compatible boundary</small>
          </header>
          <div className="content-provider-list">
            {providers.map((provider) => (
              <article className="content-provider-card" data-provider-enabled={provider.enabled} key={provider.id}>
                <div className="content-provider-card-main">
                  <label className="content-provider-enable">
                    <input
                      checked={provider.enabled}
                      onChange={(event) => onProviderUpdate(provider.id, { enabled: event.target.checked })}
                      type="checkbox"
                    />
                  </label>
                  <div className="content-provider-identity">
                    <strong>{provider.label}</strong>
                    <small>{provider.base_url ?? "OpenAI-compatible API"}</small>
                  </div>
                  <span className="content-provider-status">{provider.health_status}</span>
                </div>

                <div className="content-provider-controls ai-provider-controls">
                  <label>
                    <span>Model</span>
                    <input
                      onChange={(event) => onProviderUpdate(provider.id, { model: event.target.value })}
                      placeholder="gpt-4o-mini"
                      value={provider.model ?? ""}
                    />
                  </label>
                  <label>
                    <span>Base URL</span>
                    <input
                      onChange={(event) => onProviderUpdate(provider.id, { base_url: event.target.value })}
                      placeholder="https://api.openai.com/v1"
                      value={provider.base_url ?? ""}
                    />
                  </label>
                  <label>
                    <span>API Key</span>
                    <input
                      autoComplete="off"
                      onChange={(event) => onProviderUpdate(provider.id, { api_key_value: event.target.value })}
                      placeholder="Paste provider API key"
                      type="password"
                      value={provider.api_key_value ?? ""}
                    />
                  </label>
                  <label>
                    <span>Fallback env</span>
                    <input
                      onChange={(event) => onProviderUpdate(provider.id, { api_key_env_var: event.target.value })}
                      placeholder="DEEPSEEK_API_KEY"
                      value={provider.api_key_env_var ?? ""}
                    />
                  </label>
                  <label>
                    <span>Timeout ms</span>
                    <input
                      min={5000}
                      max={180000}
                      onChange={(event) => onProviderUpdate(provider.id, { timeout_ms: Number(event.target.value) })}
                      type="number"
                      value={provider.timeout_ms}
                    />
                  </label>
                  <label>
                    <span>Input $ / 1M</span>
                    <input
                      min={0}
                      onChange={(event) =>
                        onProviderUpdate(provider.id, {
                          input_cost_per_million_tokens_usd: event.target.value === "" ? undefined : Number(event.target.value),
                        })
                      }
                      placeholder="optional"
                      step="0.000001"
                      type="number"
                      value={provider.input_cost_per_million_tokens_usd ?? ""}
                    />
                  </label>
                  <label>
                    <span>Output $ / 1M</span>
                    <input
                      min={0}
                      onChange={(event) =>
                        onProviderUpdate(provider.id, {
                          output_cost_per_million_tokens_usd: event.target.value === "" ? undefined : Number(event.target.value),
                        })
                      }
                      placeholder="optional"
                      step="0.000001"
                      type="number"
                      value={provider.output_cost_per_million_tokens_usd ?? ""}
                    />
                  </label>
                  <label>
                    <span>Retries</span>
                    <input
                      min={0}
                      max={5}
                      onChange={(event) => onProviderUpdate(provider.id, { retry_attempts: Number(event.target.value) })}
                      type="number"
                      value={provider.retry_attempts}
                    />
                  </label>
                  <button disabled={activeProviderId === provider.id} onClick={() => onActivate(provider.id)} type="button">
                    {activeProviderId === provider.id ? "Active" : "Activate"}
                  </button>
                  <button onClick={() => onTest(provider.id)} type="button">
                    Test
                  </button>
                </div>

                <div className="content-provider-meta">
                  <span>{provider.kind}</span>
                  {provider.health_message ? <small>{provider.health_message}</small> : null}
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="content-provider-group">
          <header>
            <span>Band routes</span>
            <small>{routes.filter((route) => route.enabled).length} active</small>
          </header>
          <div className="content-provider-list">
            {routes.map((route) => (
              <article className="content-provider-card" data-provider-enabled={route.enabled} key={route.id}>
                <div className="content-provider-card-main">
                  <label className="content-provider-enable">
                    <input
                      checked={route.enabled}
                      onChange={(event) => onRouteUpdate(route.id, { enabled: event.target.checked })}
                      type="checkbox"
                    />
                  </label>
                  <div className="content-provider-identity">
                    <strong>{route.label}</strong>
                    <small>
                      {route.level_id} / {route.modes?.join(", ") ?? "all modes"}
                    </small>
                  </div>
                  <span className="content-provider-status">{route.provider_id}</span>
                </div>

                <div className="content-provider-controls ai-route-controls">
                  <label>
                    <span>Level</span>
                    <select
                      onChange={(event) => onRouteUpdate(route.id, { level_id: event.target.value as AiRouteSettingsDraft["level_id"] })}
                      value={route.level_id}
                    >
                      {["default", "supra_macro", "L0", "L1", "L2", "L3", "deep_lens", "recursive_seed"].map((levelId) => (
                        <option key={levelId} value={levelId}>
                          {levelId}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span>Provider</span>
                    <select onChange={(event) => onRouteUpdate(route.id, { provider_id: event.target.value })} value={route.provider_id}>
                      {providerOptions.map((provider) => (
                        <option key={provider.id} value={provider.id}>
                          {provider.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span>Modes</span>
                    <input
                      onChange={(event) => onRouteUpdate(route.id, { modes: parseRouteModesInput(event.target.value) })}
                      placeholder="all modes"
                      value={route.modes?.join(", ") ?? ""}
                    />
                  </label>
                  <label>
                    <span>Model override</span>
                    <input
                      onChange={(event) => onRouteUpdate(route.id, { model_override: event.target.value })}
                      placeholder="Use provider model"
                      value={route.model_override ?? ""}
                    />
                  </label>
                  <label>
                    <span>Priority</span>
                    <input
                      min={1}
                      max={999}
                      onChange={(event) => onRouteUpdate(route.id, { priority: Number(event.target.value) })}
                      type="number"
                      value={route.priority}
                    />
                  </label>
                </div>

                <div className="content-provider-meta">
                  <span>{route.id}</span>
                  <small>First enabled route matching level and mode wins.</small>
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>
    </section>
  );
}

function AiProviderEditor({
  assistantActionPermissionMode,
  assistantActionPermissionRules,
  chunkScheduling,
  costLedger,
  onAssistantActionPermissionModeChange,
  onAssistantActionPermissionRuleChange,
  onClearCostLedger,
  onChunkSchedulingUpdate,
  onExportCostLedger,
  onPromptModuleUpdate,
  onPromptProfileUpdate,
  onPromptRevisionDelete,
  onPromptRevisionRestore,
  onPromptRevisionSave,
  onRefreshCostLedger,
  promptProfile,
  promptProfileRevisions,
}: {
  assistantActionPermissionMode: SeekStarSettings["assistant_action_permission_mode"];
  assistantActionPermissionRules: SeekStarSettings["assistant_action_permission_rules"];
  chunkScheduling: CartographerChunkSchedulingDraft;
  costLedger?: AiCostLedgerSnapshot;
  onAssistantActionPermissionModeChange: (mode: SeekStarSettings["assistant_action_permission_mode"]) => void;
  onAssistantActionPermissionRuleChange: (
    actionType: AssistantActionPermissionRuleDraft["action_type"],
    patch: Partial<AssistantActionPermissionRuleDraft>,
  ) => void;
  onClearCostLedger: () => Promise<void> | void;
  onChunkSchedulingUpdate: (patch: Partial<CartographerChunkSchedulingDraft>) => void;
  onExportCostLedger: () => Promise<void> | void;
  onPromptModuleUpdate: (levelId: CartographerPromptModuleDraft["level_id"], patch: Partial<CartographerPromptModuleDraft>) => void;
  onPromptProfileUpdate: (patch: Partial<CartographerPromptProfileDraft>) => void;
  onPromptRevisionDelete: (revisionId: string) => void;
  onPromptRevisionRestore: (revisionId: string) => void;
  onPromptRevisionSave: () => void;
  onRefreshCostLedger: () => Promise<void> | void;
  promptProfile: CartographerPromptProfileDraft;
  promptProfileRevisions: CartographerPromptProfileRevisionDraft[];
}): ReactElement {
  const recentCostLedgerRecords = costLedger?.records.slice(0, 8) ?? [];
  const [promptPreviewLevelId, setPromptPreviewLevelId] = useState<CartographerPromptModuleDraft["level_id"]>("L0");
  const [promptPreviewMode, setPromptPreviewMode] = useState<CartographerGenerationMode>("bootstrap_seed");
  const [promptPreviewSeed, setPromptPreviewSeed] = useState("CPU");
  const [promptPreviewStatus, setPromptPreviewStatus] = useState("Ready");
  const [promptPreview, setPromptPreview] = useState<AiCartographerPromptPreviewResult | undefined>();

  async function handlePromptPreview(): Promise<void> {
    setPromptPreviewStatus("Building preview...");

    try {
      const preview = await window.seekstar.ai.previewCartographerPrompt({
        level_id: promptPreviewLevelId,
        mode: promptPreviewMode,
        seed: promptPreviewSeed,
      });

      setPromptPreview(preview);
      setPromptPreviewStatus(`Revision ${preview.prompt_revision}`);
    } catch {
      setPromptPreviewStatus("Preview failed");
    }
  }

  return (
    <section className="settings-section content-provider-section">
      <div className="content-provider-toolbar">
        <div>
          <strong>Cartographer behavior</strong>
          <span>Prompt profile, chunk scheduling, assistant policy, and cost visibility</span>
        </div>
      </div>

      <div className="content-provider-groups">
        <section className="content-provider-group">
          <header>
            <span>Assistant control policy</span>
            <small>App Framework permission boundary</small>
          </header>
          <div className="settings-card ai-permission-policy-card">
            <label className="settings-row">
              <span>
                <strong>Action permission mode</strong>
                <small>Controls how right-sidebar AI suggestions become app operations.</small>
              </span>
              <select
                onChange={(event) =>
                  onAssistantActionPermissionModeChange(event.target.value as SeekStarSettings["assistant_action_permission_mode"])
                }
                value={assistantActionPermissionMode}
              >
                <option value="ask_each_time">Ask each time</option>
                <option value="allow_low_risk">Allow low-risk clicks</option>
                <option value="block_all">Block all assistant actions</option>
              </select>
            </label>
            <p>
              {assistantActionPermissionMode === "block_all"
                ? "Assistant suggestions remain visible, but execution is blocked by settings."
                : assistantActionPermissionMode === "allow_low_risk"
                  ? "Per-action rules decide which clicked operations are low-risk, require approval audit, or stay blocked."
                  : "Per-action rules still apply, but ask-each-time treats allowed operations as explicit user-approved operations."}
            </p>
            <div className="ai-permission-matrix" role="table" aria-label="Assistant action permission matrix">
              <div className="ai-permission-matrix-row ai-permission-matrix-head" role="row">
                <span>Action</span>
                <span>Decision</span>
              </div>
              {assistantActionPermissionRuleMeta.map((meta) => {
                const rule = assistantActionPermissionRules.find((candidate) => candidate.action_type === meta.action_type);

                return (
                  <label className="ai-permission-matrix-row" key={meta.action_type} role="row">
                    <span>
                      <strong>{meta.label}</strong>
                      <small>{meta.description}</small>
                    </span>
                    <select
                      onChange={(event) =>
                        onAssistantActionPermissionRuleChange(meta.action_type, {
                          decision: event.target.value as AssistantActionPermissionRuleDraft["decision"],
                        })
                      }
                      value={rule?.decision ?? "ask_each_time"}
                    >
                      <option value="allow_after_click">Allow after click</option>
                      <option value="ask_each_time">Require approval audit</option>
                      <option value="block">Block</option>
                    </select>
                  </label>
                );
              })}
            </div>
          </div>
        </section>

        <section className="content-provider-group">
          <header>
            <span>Chunk scheduling</span>
            <small>Viewport boundary policy</small>
          </header>
          <div className="settings-card ai-permission-policy-card">
            <label className="settings-row">
              <span>
                <strong>Automatic boundary expansion</strong>
                <small>Preload Cartographer chunks when the lens approaches the active chunk boundary.</small>
              </span>
              <input
                checked={chunkScheduling.auto_expand_enabled}
                onChange={(event) => onChunkSchedulingUpdate({ auto_expand_enabled: event.target.checked })}
                type="checkbox"
              />
            </label>
            <label className="settings-row">
              <span>
                <strong>Auto preload ring</strong>
                <small>Visible policy radius around the current macro chunk. Use 0 to keep auto expansion dormant.</small>
              </span>
              <input
                min={0}
                max={2}
                onChange={(event) => onChunkSchedulingUpdate({ auto_preload_ring: Number(event.target.value) })}
                type="number"
                value={chunkScheduling.auto_preload_ring}
              />
            </label>
            <label className="settings-row">
              <span>
                <strong>Manual preload range</strong>
                <small>Directional N/W/E/S controls queue this many chunks ahead.</small>
              </span>
              <input
                min={1}
                max={3}
                onChange={(event) => onChunkSchedulingUpdate({ manual_preload_range: Number(event.target.value) })}
                type="number"
                value={chunkScheduling.manual_preload_range}
              />
            </label>
            <label className="settings-row">
              <span>
                <strong>Boundary debounce</strong>
                <small>Milliseconds to wait before firing a viewport-boundary Cartographer request.</small>
              </span>
              <input
                min={120}
                max={5000}
                onChange={(event) => onChunkSchedulingUpdate({ boundary_debounce_ms: Number(event.target.value) })}
                type="number"
                value={chunkScheduling.boundary_debounce_ms}
              />
            </label>
            <label className="settings-row">
              <span>
                <strong>Chunk width</strong>
                <small>Horizontal world-space size used for macro chunk keys and directional stepping.</small>
              </span>
              <input
                min={480}
                max={3200}
                onChange={(event) => onChunkSchedulingUpdate({ chunk_width: Number(event.target.value) })}
                type="number"
                value={chunkScheduling.chunk_width}
              />
            </label>
            <label className="settings-row">
              <span>
                <strong>Chunk height</strong>
                <small>Vertical world-space size used for macro chunk keys and directional stepping.</small>
              </span>
              <input
                min={480}
                max={3200}
                onChange={(event) => onChunkSchedulingUpdate({ chunk_height: Number(event.target.value) })}
                type="number"
                value={chunkScheduling.chunk_height}
              />
            </label>
          </div>
        </section>

        <section className="content-provider-group">
          <header>
            <span>Prompt profile</span>
            <small>Per-band Cartographer templates</small>
          </header>
          <div className="settings-card ai-permission-policy-card">
            <label className="settings-row">
              <span>
                <strong>Profile label</strong>
                <small>Visible name for this local prompt profile.</small>
              </span>
              <input onChange={(event) => onPromptProfileUpdate({ label: event.target.value })} value={promptProfile.label} />
            </label>
            <label className="settings-row">
              <span>
                <strong>Language</strong>
                <small>Default language hint sent to the Cartographer provider.</small>
              </span>
              <input onChange={(event) => onPromptProfileUpdate({ language: event.target.value })} value={promptProfile.language} />
            </label>
            <label className="settings-row">
              <span>
                <strong>Density</strong>
                <small>Coarse generation density hint for all bands unless a target count overrides it.</small>
              </span>
              <select
                onChange={(event) => onPromptProfileUpdate({ density: event.target.value as CartographerPromptProfileDraft["density"] })}
                value={promptProfile.density}
              >
                <option value="compact">Compact</option>
                <option value="normal">Normal</option>
                <option value="rich">Rich</option>
              </select>
            </label>
            <div className="ai-prompt-revision-toolbar">
              <span>
                <strong>Revision history</strong>
                <small>{promptProfileRevisions.length} saved revisions</small>
              </span>
              <button onClick={onPromptRevisionSave} type="button">
                Save current revision
              </button>
            </div>
          </div>

          {promptProfileRevisions.length > 0 ? (
            <div className="settings-card ai-prompt-revision-list">
              {promptProfileRevisions.map((revision) => (
                <article key={revision.id}>
                  <span>
                    <strong>{revision.label}</strong>
                    <small>
                      {revision.revision} / {formatTimestamp(revision.created_at)}
                    </small>
                  </span>
                  <div>
                    <button onClick={() => onPromptRevisionRestore(revision.id)} type="button">
                      Restore
                    </button>
                    <button onClick={() => onPromptRevisionDelete(revision.id)} type="button">
                      Delete
                    </button>
                  </div>
                </article>
              ))}
            </div>
          ) : null}

          <div className="settings-card ai-prompt-preview-card">
            <div className="ai-prompt-preview-header">
              <span>
                <strong>Prompt preview</strong>
                <small>{promptPreviewStatus}</small>
              </span>
              <button onClick={handlePromptPreview} type="button">
                Preview prompt
              </button>
            </div>

            <div className="content-provider-controls ai-prompt-preview-controls">
              <label>
                <span>Level</span>
                <select
                  onChange={(event) => {
                    const nextLevel = event.target.value as CartographerPromptModuleDraft["level_id"];
                    setPromptPreviewLevelId(nextLevel);
                    setPromptPreviewMode(nextLevel === "L0" ? "bootstrap_seed" : "decompose_down");
                  }}
                  value={promptPreviewLevelId}
                >
                  {promptProfile.modules.map((module) => (
                    <option key={module.level_id} value={module.level_id}>
                      {module.level_id}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Mode</span>
                <select onChange={(event) => setPromptPreviewMode(event.target.value as CartographerGenerationMode)} value={promptPreviewMode}>
                  {["bootstrap_seed", "expand_horizontal", "decompose_down", "summarize_up", "replace_failed_source"].map((mode) => (
                    <option key={mode} value={mode}>
                      {mode}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Seed</span>
                <input onChange={(event) => setPromptPreviewSeed(event.target.value)} value={promptPreviewSeed} />
              </label>
            </div>

            {promptPreview ? (
              <div className="ai-prompt-preview-output">
                <div className="ai-prompt-preview-meta">
                  <span>{promptPreview.provider_id}</span>
                  <span>{promptPreview.model ?? "provider default"}</span>
                  <span>{promptPreview.level_id}</span>
                  <span>{promptPreview.mode}</span>
                </div>
                {promptPreview.messages.map((message, index) => (
                  <article key={`${message.role}-${index}`}>
                    <strong>{message.role}</strong>
                    <pre>{message.content}</pre>
                  </article>
                ))}
              </div>
            ) : null}
          </div>

          <div className="content-provider-list">
            {promptProfile.modules.map((module) => (
              <article className="content-provider-card" data-provider-enabled={true} key={module.level_id}>
                <div className="content-provider-card-main">
                  <div className="content-provider-identity">
                    <strong>
                      {module.level_id} - {module.label}
                    </strong>
                    <small>Prompt brief, constraints, and target terrain count</small>
                  </div>
                  <span className="content-provider-status">{module.target_count} nodes</span>
                </div>

                <div className="content-provider-controls prompt-profile-controls">
                  <label>
                    <span>Target count</span>
                    <input
                      min={1}
                      max={80}
                      onChange={(event) => onPromptModuleUpdate(module.level_id, { target_count: Number(event.target.value) })}
                      type="number"
                      value={module.target_count}
                    />
                  </label>
                  <label>
                    <span>Prompt brief</span>
                    <textarea
                      onChange={(event) => onPromptModuleUpdate(module.level_id, { prompt_brief: event.target.value })}
                      rows={3}
                      value={module.prompt_brief}
                    />
                  </label>
                  <label>
                    <span>Constraints</span>
                    <textarea
                      onChange={(event) =>
                        onPromptModuleUpdate(module.level_id, {
                          prompt_constraints: event.target.value
                            .split("\n")
                            .map((constraint) => constraint.trim())
                            .filter(Boolean),
                        })
                      }
                      rows={4}
                      value={module.prompt_constraints.join("\n")}
                    />
                  </label>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="content-provider-group">
          <header>
            <span>Cost ledger</span>
            <small>{costLedger ? `${costLedger.summary.records} records` : "Not loaded"}</small>
          </header>
          <div className="settings-card ai-cost-ledger-card">
            <div className="ai-cost-ledger-summary">
              <div>
                <span>Total cost</span>
                <strong>{formatCostUsd(costLedger?.summary.estimated_cost_usd)}</strong>
              </div>
              <div>
                <span>Total tokens</span>
                <strong>{formatInteger(costLedger?.summary.total_tokens)}</strong>
              </div>
              <div>
                <span>Assistant</span>
                <strong>{formatCostUsd(costLedger?.summary.by_source.assistant.estimated_cost_usd)}</strong>
              </div>
              <div>
                <span>Cartographer</span>
                <strong>{formatCostUsd(costLedger?.summary.by_source.cartographer.estimated_cost_usd)}</strong>
              </div>
            </div>

            <div className="ai-cost-ledger-actions">
              <button onClick={onRefreshCostLedger} type="button">
                <RefreshCw aria-hidden="true" size={14} strokeWidth={1.8} />
                Refresh
              </button>
              <button disabled={!costLedger?.records.length} onClick={onExportCostLedger} type="button">
                Export JSON
              </button>
              <button disabled={!costLedger?.records.length} onClick={onClearCostLedger} type="button">
                Clear ledger
              </button>
            </div>

            <div className="ai-cost-ledger-table" role="table" aria-label="Recent AI cost ledger records">
              <div className="ai-cost-ledger-row ai-cost-ledger-head" role="row">
                <span>Source</span>
                <span>Provider</span>
                <span>Status</span>
                <span>Tokens</span>
                <span>Cost</span>
              </div>
              {recentCostLedgerRecords.length > 0 ? (
                recentCostLedgerRecords.map((record) => (
                  <div className="ai-cost-ledger-row" key={record.id} role="row">
                    <span>{record.source}</span>
                    <span title={record.model ? `${record.provider_id} / ${record.model}` : record.provider_id}>
                      {record.provider_id}
                    </span>
                    <span>{record.status}</span>
                    <span>{formatInteger(record.total_tokens)}</span>
                    <span>{formatCostUsd(record.estimated_cost_usd)}</span>
                  </div>
                ))
              ) : (
                <p className="content-provider-empty">No AI calls have been recorded yet.</p>
              )}
            </div>
          </div>
        </section>

      </div>
    </section>
  );
}

function DomainLexiconEditor({
  domainHintMode,
  domainLexicons,
  draft,
  onActivate,
  onApply,
  onCreateLexicon,
  onCreateTerm,
  onDeleteLexicon,
  onDeleteTerm,
  onLexiconUpdate,
  onSelectLexicon,
  onSelectTerm,
  onDomainHintModeChange,
  onTermLabelChange,
  onTermUpdate,
  selectedLexicon,
  selectedTerm,
}: {
  domainHintMode: SeekStarSettings["domain_hint_mode"];
  domainLexicons: DomainLexicon[];
  draft?: SeekStarSettings;
  onActivate: (lexiconId: string) => void;
  onApply: () => void;
  onCreateLexicon: () => void;
  onCreateTerm: () => void;
  onDeleteLexicon: (lexiconId: string) => void;
  onDeleteTerm: (termId: string) => void;
  onLexiconUpdate: (patch: Partial<DomainLexicon>) => void;
  onSelectLexicon: (lexiconId: string) => void;
  onSelectTerm: (termId: string) => void;
  onDomainHintModeChange: (mode: SeekStarSettings["domain_hint_mode"]) => void;
  onTermLabelChange: (term: DomainLexiconTerm, language: string, value: string) => void;
  onTermUpdate: (termId: string, patch: Partial<DomainLexiconTerm>) => void;
  selectedLexicon?: DomainLexicon;
  selectedTerm?: DomainLexiconTerm;
}): ReactElement {
  return (
    <section className="settings-section domain-lexicon-section">
      <div className="domain-lexicon-toolbar">
        <div>
          <strong>{selectedLexicon?.title ?? "No lexicon selected"}</strong>
          <span>{selectedLexicon?.terms.filter((term) => term.enabled).length ?? 0} active terms</span>
        </div>
        <div>
          <button onClick={onCreateLexicon} type="button">
            <Plus aria-hidden="true" size={14} strokeWidth={1.8} />
            Add lexicon
          </button>
          <button className="primary" disabled={!draft} onClick={onApply} type="button">
            <RefreshCw aria-hidden="true" size={14} strokeWidth={1.8} />
            Apply to New Seek
          </button>
        </div>
      </div>

      <div className="settings-card">
        <div className="settings-row">
          <span>
            <strong>Opening sky mode</strong>
            <small>Guided uses enabled domain terms as prompt hints; pure AI lets the model choose tonight's starting field freely.</small>
          </span>
          <select onChange={(event) => onDomainHintModeChange(event.target.value === "pure_ai" ? "pure_ai" : "guided")} value={domainHintMode}>
            <option value="guided">Guided domain hints</option>
            <option value="pure_ai">Pure AI sky</option>
          </select>
        </div>
      </div>

      <div className="domain-lexicon-workspace">
        <aside className="domain-lexicon-list" aria-label="Domain lexicons">
          {domainLexicons.map((lexicon) => (
            <button
              className={lexicon.id === selectedLexicon?.id ? "active" : ""}
              key={lexicon.id}
              onClick={() => onSelectLexicon(lexicon.id)}
              type="button"
            >
              <span>
                <strong>{lexicon.title}</strong>
                <small>{lexicon.terms.length} terms</small>
              </span>
              {lexicon.active ? <em>Active</em> : null}
            </button>
          ))}
        </aside>

        <div className="domain-lexicon-editor">
          {selectedLexicon ? (
            <>
              <div className="domain-lexicon-fields">
                <label>
                  <span>Title</span>
                  <input onChange={(event) => onLexiconUpdate({ title: event.target.value })} value={selectedLexicon.title} />
                </label>
                <label>
                  <span>Description</span>
                  <textarea
                    onChange={(event) => onLexiconUpdate({ description: event.target.value })}
                    rows={3}
                    value={selectedLexicon.description}
                  />
                </label>
                <div className="domain-lexicon-actions">
                  <button disabled={selectedLexicon.active} onClick={() => onActivate(selectedLexicon.id)} type="button">
                    <Star aria-hidden="true" size={14} strokeWidth={1.8} />
                    Activate
                  </button>
                  <button
                    className="danger"
                    disabled={domainLexicons.length <= 1}
                    onClick={() => onDeleteLexicon(selectedLexicon.id)}
                    type="button"
                  >
                    <Trash2 aria-hidden="true" size={14} strokeWidth={1.8} />
                    Delete
                  </button>
                </div>
              </div>

              <div className="domain-term-toolbar">
                <strong>Terms</strong>
                <button onClick={onCreateTerm} type="button">
                  <Plus aria-hidden="true" size={14} strokeWidth={1.8} />
                  Add term
                </button>
              </div>

              <div className="domain-term-table" role="table" aria-label="Domain terms">
                <div className="domain-term-row domain-term-row-head" role="row">
                  <span>On</span>
                  <span>Canonical</span>
                  {domainLexiconLanguages.map((language) => (
                    <span key={language.id}>{language.label}</span>
                  ))}
                  <span />
                </div>
                {selectedLexicon.terms.map((term) => (
                  <div className={term.id === selectedTerm?.id ? "domain-term-row active" : "domain-term-row"} key={term.id} role="row">
                    <label className="domain-term-enabled">
                      <input
                        checked={term.enabled}
                        onChange={(event) => onTermUpdate(term.id, { enabled: event.target.checked })}
                        type="checkbox"
                      />
                    </label>
                    <input
                      onChange={(event) => onTermUpdate(term.id, { canonical: event.target.value })}
                      onFocus={() => onSelectTerm(term.id)}
                      value={term.canonical}
                    />
                    {domainLexiconLanguages.map((language) => (
                      <input
                        key={language.id}
                        onChange={(event) => onTermLabelChange(term, language.id, event.target.value)}
                        onFocus={() => onSelectTerm(term.id)}
                        value={term.labels[language.id] ?? ""}
                      />
                    ))}
                    <button aria-label={`Delete ${term.canonical}`} onClick={() => onDeleteTerm(term.id)} type="button">
                      <Trash2 aria-hidden="true" size={14} strokeWidth={1.8} />
                    </button>
                  </div>
                ))}
              </div>
            </>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function createSettingsDraft(settings?: SeekStarSettings): SeekStarSettings {
  const activeAiProviderId = settings?.active_ai_provider_id ?? DEEPSEEK_AI_PROVIDER_ID;

  return {
    assistant_action_permission_mode: settings?.assistant_action_permission_mode ?? "ask_each_time",
    assistant_action_permission_rules: settings?.assistant_action_permission_rules ?? createDefaultAssistantActionPermissionRules(),
    cartographer_chunk_scheduling: settings?.cartographer_chunk_scheduling ?? createDefaultCartographerChunkSchedulingSettings(),
    cartographer_prompt_profile: settings?.cartographer_prompt_profile ?? createDefaultCartographerPromptProfileSettings(),
    cartographer_prompt_profile_revisions: settings?.cartographer_prompt_profile_revisions ?? [],
    tab_cache_max_bytes: settings?.tab_cache_max_bytes ?? 256 * 1024 * 1024,
    inactive_grace_ms: settings?.inactive_grace_ms ?? 30 * 60 * 1000,
    scout_concurrency: settings?.scout_concurrency ?? 2,
    tile_live_surface_limit: settings?.tile_live_surface_limit ?? 1,
    tile_field_target_count: settings?.tile_field_target_count ?? 25,
    tile_thumbnail_prewarm_concurrency: settings?.tile_thumbnail_prewarm_concurrency ?? 2,
    active_domain_lexicon_id: settings?.active_domain_lexicon_id ?? DEFAULT_DOMAIN_LEXICON_ID,
    domain_hint_mode: settings?.domain_hint_mode ?? "guided",
    domain_lexicons: settings?.domain_lexicons ?? cloneDomainLexicons(DEFAULT_DOMAIN_LEXICONS),
    content_providers: settings?.content_providers ?? cloneContentProviderSettings(DEFAULT_CONTENT_PROVIDER_SETTINGS),
    active_ai_provider_id: activeAiProviderId,
    ai_providers: settings?.ai_providers ?? createDefaultAiProviderSettings(),
    ai_routes: settings?.ai_routes ?? createDefaultAiRouteSettings(activeAiProviderId),
  };
}

function settingsFingerprint(settings?: SeekStarSettings): string {
  return settings ? JSON.stringify(settings) : "";
}

function createDefaultAssistantActionPermissionRules(): SeekStarSettings["assistant_action_permission_rules"] {
  return assistantActionPermissionRuleMeta.map((meta) => ({
    action_type: meta.action_type,
    decision: meta.action_type === "observe_source" || meta.action_type === "create_seed" ? "ask_each_time" : "allow_after_click",
  }));
}

function createDefaultCartographerChunkSchedulingSettings(): SeekStarSettings["cartographer_chunk_scheduling"] {
  return {
    auto_expand_enabled: true,
    auto_preload_ring: 1,
    boundary_debounce_ms: 520,
    chunk_height: 900,
    chunk_width: 1200,
    manual_preload_range: 1,
  };
}

function createDefaultCartographerPromptProfileSettings(): SeekStarSettings["cartographer_prompt_profile"] {
  return {
    density: "normal",
    id: "seekstar-default-p6-gallery-v3",
    label: "SeekStar P6 Cartographer default",
    language: "zh-Hans",
    modules: [
      {
        level_id: "supra_macro",
        label: "Supra Macro",
        prompt_brief: "Infer broader systems, parent domains, and adjacent macro contexts for the seed.",
        prompt_constraints: [
          "Do not repeat the seed as every title.",
          "Prefer broad human-knowledge frames over narrow implementation details.",
          "Return cartographer_primary nodes only.",
          "Return title and node_type only; do not include summary or tags.",
        ],
        target_count: 6,
      },
      {
        level_id: "L0",
        label: "L0 Star Gallery",
        prompt_brief: "Generate broad, explorable domains around the seed as an Apple-Watch-like Star Gallery.",
        prompt_constraints: [
          "Nodes should be domains or durable knowledge areas, not web pages.",
          "No source candidates at L0.",
          "Keep titles short enough for bubble labels.",
        ],
        target_count: 24,
      },
      {
        level_id: "L1",
        label: "L1 Topic Field",
        prompt_brief: "Decompose the focused domain into topic neighborhoods and same-level adjacent branches.",
        prompt_constraints: [
          "Nodes should be topic-level, not article-level.",
          "Use local adjacency rather than radial hub-and-spoke relations.",
          "Source candidates are optional and must remain unverified.",
          "Return compact nodes with title only unless a short summary is essential.",
        ],
        target_count: 10,
      },
      {
        level_id: "L2",
        label: "L2 Source Orientation",
        prompt_brief: "Orient the user toward classes of trustworthy material and likely source families.",
        prompt_constraints: [
          "Nodes should describe source directions or source families.",
          "Candidate URLs may be proposed, but only as cartographer_unverified_source.",
          "Prefer canonical, durable, or educational sources when proposing URLs.",
          "Return compact nodes with title only unless a short summary is essential.",
        ],
        target_count: 8,
      },
      {
        level_id: "L3",
        label: "L3 Tile Field",
        prompt_brief: "Return concrete URL source candidates for the focused source direction. Do not create webpage/document nodes for the main canvas.",
        prompt_constraints: [
          "Put every usable URL in source_candidates, not nodes.",
          "Return nodes as an empty array unless a fog/status marker is essential.",
          "Do not return cartographer_primary webpage or document nodes.",
          "Do not call any URL source-backed.",
          "Prefer URLs likely to load in a normal browser.",
          "Return 2-3 durable candidate URLs at most.",
        ],
        target_count: 3,
      },
      {
        level_id: "deep_lens",
        label: "Deep Lens",
        prompt_brief: "Prepare structured close-reading grains for a focused source or selected text.",
        prompt_constraints: [
          "Do not split into separate visible L4-L10 product levels.",
          "Every grain should be seedable when useful.",
          "No source candidates from text decomposition.",
        ],
        target_count: 16,
      },
      {
        level_id: "recursive_seed",
        label: "Recursive Seed",
        prompt_brief: "Bootstrap parent, sibling, and child contexts for an orphan seed.",
        prompt_constraints: [
          "Generate upward context and adjacent same-band context.",
          "Prepare at least one downward branch when possible.",
          "Keep provenance in context rather than pretending source evidence exists.",
        ],
        target_count: 8,
      },
    ],
  };
}

function createDefaultAiProviderSettings(): SeekStarSettings["ai_providers"] {
  return [
    {
      id: DEEPSEEK_AI_PROVIDER_ID,
      label: "DeepSeek API",
      kind: "openai_compatible",
      enabled: true,
      base_url: "https://api.deepseek.com",
      model: "deepseek-v4-flash",
      api_key_env_var: "DEEPSEEK_API_KEY",
      input_cost_per_million_tokens_usd: 0.14,
      output_cost_per_million_tokens_usd: 0.28,
      timeout_ms: 60000,
      retry_attempts: 1,
      retry_backoff_ms: 500,
      health_status: "missing_key",
      health_message: "Paste a DeepSeek API key or set DEEPSEEK_API_KEY.",
    },
    {
      id: "openai-compatible-env",
      label: "OpenAI-compatible API",
      kind: "openai_compatible",
      enabled: false,
      base_url: "https://api.openai.com/v1",
      model: "gpt-4o-mini",
      api_key_env_var: "SEEKSTAR_AI_API_KEY",
      timeout_ms: 30000,
      retry_attempts: 1,
      retry_backoff_ms: 250,
      health_status: "disabled",
      health_message: "Enable and set an env key reference when a real Cartographer model is available.",
    },
  ];
}

function createDefaultAiRouteSettings(providerId = DEEPSEEK_AI_PROVIDER_ID): SeekStarSettings["ai_routes"] {
  return [
    {
      id: "cartographer-route-default",
      label: "Default Cartographer route",
      enabled: true,
      priority: 100,
      level_id: "default",
      provider_id: providerId,
    },
    {
      id: "cartographer-route-l3",
      label: "L3 source candidate route",
      enabled: true,
      priority: 80,
      level_id: "L3",
      modes: ["decompose_down", "expand_horizontal", "replace_failed_source"],
      provider_id: providerId,
    },
    {
      id: "cartographer-route-deep-lens",
      label: "Deep Lens route",
      enabled: true,
      priority: 90,
      level_id: "deep_lens",
      modes: ["decompose_down", "summarize_up"],
      provider_id: providerId,
    },
  ];
}

function parseRouteModesInput(value: string): CartographerGenerationMode[] | undefined {
  const modes = value
    .split(",")
    .map((mode) => mode.trim())
    .filter((mode): mode is CartographerGenerationMode =>
      mode === "bootstrap_seed" ||
      mode === "expand_horizontal" ||
      mode === "decompose_down" ||
      mode === "summarize_up" ||
      mode === "replace_failed_source",
    );

  return modes.length > 0 ? Array.from(new Set(modes)) : undefined;
}

function cloneContentProviderSettings(settings: readonly ContentProviderSettings[]): ContentProviderSettings[] {
  return settings.map((provider) => ({
    ...provider,
    languages: provider.languages ? [...provider.languages] : undefined,
    api_key_ref: provider.api_key_ref ? { ...provider.api_key_ref } : undefined,
  }));
}

function formatCostUsd(value: number | undefined): string {
  return `$${(value ?? 0).toFixed(6)}`;
}

function formatInteger(value: number | undefined): string {
  return new Intl.NumberFormat().format(value ?? 0);
}

function formatTimestamp(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString();
}

function clonePromptProfile(profile: CartographerPromptProfileDraft): CartographerPromptProfileDraft {
  return {
    ...profile,
    modules: profile.modules.map((module) => ({
      ...module,
      prompt_constraints: [...module.prompt_constraints],
    })),
  };
}

function createPromptProfileRevisionHash(profile: CartographerPromptProfileDraft): string {
  const text = JSON.stringify({
    density: profile.density,
    id: profile.id,
    language: profile.language,
    modules: profile.modules.map((module) => ({
      level_id: module.level_id,
      prompt_brief: module.prompt_brief,
      prompt_constraints: module.prompt_constraints,
      target_count: module.target_count,
    })),
  });
  let hash = 0;

  for (let index = 0; index < text.length; index += 1) {
    hash = (hash * 31 + text.charCodeAt(index)) >>> 0;
  }

  return hash.toString(36);
}

function createDefaultContentProviderSetting(definition: ContentProviderDefinition): ContentProviderSettings {
  return {
    id: definition.id,
    enabled: definition.default_enabled,
    priority: definition.default_priority,
    languages: definition.default_languages ? [...definition.default_languages] : undefined,
    api_key_ref: definition.api_key_env_var ? { kind: "env", name: definition.api_key_env_var } : undefined,
    api_key_env_var: definition.api_key_env_var,
    health_status: definition.default_enabled ? "ready" : "disabled",
  };
}

function createContentProviderKeyRefPatch(value: string): Partial<ContentProviderSettings> {
  const name = value.trim();

  return {
    api_key_ref: name ? { kind: "env", name } : undefined,
    api_key_env_var: name || undefined,
  };
}

function groupContentProviderDefinitions(definitions: readonly ContentProviderDefinition[]): Array<{
  id: ContentProviderDefinition["group"];
  label: string;
  items: ContentProviderDefinition[];
}> {
  const labels: Record<ContentProviderDefinition["group"], string> = {
    authority: "AuthorityProvider",
    search_api: "SearchApiProvider",
    browser_assisted: "BrowserAssistedSearchProvider",
    url_only: "UrlOnlyProvider",
  };
  const order: ContentProviderDefinition["group"][] = ["authority", "search_api", "browser_assisted", "url_only"];

  return order
    .map((group) => ({
      id: group,
      label: labels[group],
      items: definitions
        .filter((definition) => definition.group === group)
        .sort((left, right) => left.default_priority - right.default_priority || left.id.localeCompare(right.id)),
    }));
}

function createUiId(prefix: string): string {
  const randomId = typeof window.crypto?.randomUUID === "function"
    ? window.crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  return `${prefix}-${randomId}`;
}
