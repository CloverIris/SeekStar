import {
  DEFAULT_DOMAIN_LEXICON_ID,
  DEFAULT_DOMAIN_LEXICONS,
  cloneDomainLexicons,
  type DomainLexicon,
  type DomainLexiconTerm,
} from "@seekstar/constellation-engine";
import type { SeekStarSettings } from "../../../../main/appSettingsStore";
import type { ReactElement } from "react";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  Compass,
  Folder,
  Plus,
  RefreshCw,
  Search,
  Settings,
  Sparkles,
  Star,
  Trash2,
  type LucideIcon,
} from "lucide-react";

type SettingsSectionId = "general" | "domainLexicon" | "runtime" | "scout" | "storage" | "development";

interface SettingsPageProps {
  onApplyDomainLexicon: (settings: SeekStarSettings) => Promise<void> | void;
  onBack: () => void;
  onClearCache: () => Promise<unknown> | void;
  onSave: (settings: SeekStarSettings) => Promise<void> | void;
  settings?: SeekStarSettings;
  storePaths: Record<string, string>;
}

const settingsSectionMeta: Record<SettingsSectionId, { title: string; description: string }> = {
  general: {
    title: "General",
    description: "Workspace status and SeekStar shell preferences.",
  },
  domainLexicon: {
    title: "Domain lexicon",
    description: "Configure the L0 field vocabulary used by the default New Seek tab.",
  },
  runtime: {
    title: "Runtime",
    description: "Tab memory behavior, inactive cooling, and content tile density.",
  },
  scout: {
    title: "Scout service",
    description: "Background Playwright concurrency per app instance.",
  },
  storage: {
    title: "Storage",
    description: "Current local development store paths.",
  },
  development: {
    title: "Development",
    description: "Prototype data controls for clean iteration.",
  },
};

const domainLexiconLanguages = [
  { id: "en", label: "EN" },
  { id: "zh-Hans", label: "ZH-CN" },
  { id: "zh-Hant", label: "ZH-TW" },
] as const;

export function SettingsPage({
  onApplyDomainLexicon,
  onBack,
  onClearCache,
  onSave,
  settings,
  storePaths,
}: SettingsPageProps): ReactElement {
  const [draft, setDraft] = useState<SeekStarSettings | undefined>(settings);
  const [searchValue, setSearchValue] = useState("");
  const [statusText, setStatusText] = useState("Ready");
  const [activeSection, setActiveSection] = useState<SettingsSectionId>("general");
  const [selectedLexiconId, setSelectedLexiconId] = useState(DEFAULT_DOMAIN_LEXICON_ID);
  const [selectedTermId, setSelectedTermId] = useState<string | undefined>();

  useEffect(() => {
    setDraft(settings);
    setSelectedLexiconId(settings?.active_domain_lexicon_id ?? DEFAULT_DOMAIN_LEXICON_ID);
    setSelectedTermId(undefined);
  }, [settings]);

  const cacheMb = Math.round((draft?.tab_cache_max_bytes ?? 0) / 1024 / 1024);
  const inactiveMinutes = Math.round((draft?.inactive_grace_ms ?? 0) / 60_000);
  const tileFieldTargetCount = draft?.tile_field_target_count ?? 25;
  const tileLiveSurfaceLimit = draft?.tile_live_surface_limit ?? 1;
  const tileThumbnailPrewarmConcurrency = draft?.tile_thumbnail_prewarm_concurrency ?? 2;
  const domainLexicons = draft?.domain_lexicons ?? cloneDomainLexicons(DEFAULT_DOMAIN_LEXICONS);
  const selectedLexicon =
    domainLexicons.find((lexicon) => lexicon.id === selectedLexiconId) ??
    domainLexicons.find((lexicon) => lexicon.active) ??
    domainLexicons[0];
  const selectedTerm = selectedLexicon?.terms.find((term) => term.id === selectedTermId) ?? selectedLexicon?.terms[0];

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
    setStatusText("Settings saved");
  }

  async function handleApplyDomainLexicon(): Promise<void> {
    if (!draft) {
      return;
    }

    setStatusText("Applying domain lexicon...");
    await onApplyDomainLexicon(draft);
    setStatusText("Domain lexicon applied to New Seek");
  }

  const settingsNavItems: Array<{ id: SettingsSectionId; label: string; icon: LucideIcon }> = [
    { id: "general", label: "General", icon: Settings },
    { id: "domainLexicon", label: "Domain lexicon", icon: Star },
    { id: "runtime", label: "Runtime", icon: Compass },
    { id: "scout", label: "Scout service", icon: Sparkles },
    { id: "storage", label: "Storage", icon: Folder },
    { id: "development", label: "Development", icon: Trash2 },
  ];
  const visibleNavItems = settingsNavItems.filter((item) => item.label.toLowerCase().includes(searchValue.trim().toLowerCase()));
  const resolvedActiveSection = visibleNavItems.some((item) => item.id === activeSection)
    ? activeSection
    : (visibleNavItems[0]?.id ?? "general");
  const activeMeta = settingsSectionMeta[resolvedActiveSection];

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
          <span>Personal</span>
          {visibleNavItems.map((item) => (
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
        </nav>
      </aside>

      <div className="settings-page-content">
        <div className="settings-content-scroll">
          <div className="settings-panel">
            <header className="settings-hero">
              <p>SeekStar Settings</p>
              <h1>{activeMeta.title}</h1>
              <span>{statusText}</span>
              <p>{activeMeta.description}</p>
            </header>

            {resolvedActiveSection === "general" ? (
              <section className="settings-section">
                <div className="settings-card">
                  <div className="settings-row">
                    <span>
                      <strong>Shell surface</strong>
                      <small>Acrylic-backed observatory shell with glass sidebars and transparent workbench.</small>
                    </span>
                  </div>
                  <div className="settings-row">
                    <span>
                      <strong>Status</strong>
                      <small>Settings changes apply to tab runtime, Scout service, and local workspace stores.</small>
                    </span>
                  </div>
                </div>
              </section>
            ) : null}

            {resolvedActiveSection === "domainLexicon" ? (
              <DomainLexiconEditor
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
                onTermLabelChange={updateTermLabel}
                onTermUpdate={updateSelectedTerm}
                onLexiconUpdate={updateSelectedLexicon}
                selectedLexicon={selectedLexicon}
                selectedTerm={selectedTerm}
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
          <button className="primary" disabled={!draft} onClick={handleSave} type="button">
            Save settings
          </button>
        </footer>
      </div>
    </section>
  );
}

function DomainLexiconEditor({
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
  onTermLabelChange,
  onTermUpdate,
  selectedLexicon,
  selectedTerm,
}: {
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
  return {
    tab_cache_max_bytes: settings?.tab_cache_max_bytes ?? 256 * 1024 * 1024,
    inactive_grace_ms: settings?.inactive_grace_ms ?? 30 * 60 * 1000,
    scout_concurrency: settings?.scout_concurrency ?? 2,
    tile_live_surface_limit: settings?.tile_live_surface_limit ?? 1,
    tile_field_target_count: settings?.tile_field_target_count ?? 25,
    tile_thumbnail_prewarm_concurrency: settings?.tile_thumbnail_prewarm_concurrency ?? 2,
    active_domain_lexicon_id: settings?.active_domain_lexicon_id ?? DEFAULT_DOMAIN_LEXICON_ID,
    domain_lexicons: settings?.domain_lexicons ?? cloneDomainLexicons(DEFAULT_DOMAIN_LEXICONS),
  };
}

function createUiId(prefix: string): string {
  const randomId = typeof window.crypto?.randomUUID === "function"
    ? window.crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  return `${prefix}-${randomId}`;
}
