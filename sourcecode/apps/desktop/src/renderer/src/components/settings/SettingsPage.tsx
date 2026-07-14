import type { ChangeEvent, ReactElement, ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Bot, Check, Database, Globe2, KeyRound, Plus, ShieldCheck, SlidersHorizontal, Trash2 } from "lucide-react";
import type {
  AiProviderSecretChange,
  AiProviderSettings,
  SeekStarSettings,
  SettingsSaveRequest,
} from "../../../../shared/settings";

interface SettingsPageProps {
  onBack: () => void;
  onClearCache: () => Promise<unknown> | void;
  onSave: (request: SettingsSaveRequest) => Promise<string[]>;
  settings?: SeekStarSettings;
  storePaths: Record<string, string>;
}

type Section = "exploration" | "ai" | "sources" | "permissions" | "data";
type SecretDraft = { action: "preserve" | "replace" | "clear"; value: string };
type SaveState = "idle" | "dirty" | "saving" | "saved" | "error";

const NAVIGATION: Array<{ id: Section; label: string; icon: typeof Bot }> = [
  { id: "exploration", label: "探索", icon: SlidersHorizontal },
  { id: "ai", label: "AI 服务", icon: KeyRound },
  { id: "sources", label: "来源服务", icon: Globe2 },
  { id: "permissions", label: "助手权限", icon: ShieldCheck },
  { id: "data", label: "数据与运行时", icon: Database },
];

export function SettingsPage({ onBack, onClearCache, onSave, settings, storePaths }: SettingsPageProps): ReactElement {
  const [draft, setDraft] = useState(settings);
  const [section, setSection] = useState<Section>("exploration");
  const [selectedProviderId, setSelectedProviderId] = useState(settings?.active_ai_provider_id);
  const [secretDrafts, setSecretDrafts] = useState<Record<string, SecretDraft>>({});
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [message, setMessage] = useState("");
  const [testingProviderId, setTestingProviderId] = useState<string>();

  useEffect(() => {
    setDraft(settings);
    setSelectedProviderId((current) => current && settings?.ai_providers.some((provider) => provider.id === current) ? current : settings?.active_ai_provider_id);
    if (saveState !== "dirty") setSaveState("idle");
  }, [settings]);

  useEffect(() => {
    const warn = (event: BeforeUnloadEvent): void => {
      if (saveState !== "dirty") return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [saveState]);

  const selectedProvider = useMemo(
    () => draft?.ai_providers.find((provider) => provider.id === selectedProviderId) ?? draft?.ai_providers[0],
    [draft, selectedProviderId],
  );

  function update(patch: Partial<SeekStarSettings>): void {
    setDraft((current) => current ? { ...current, ...patch } : current);
    markDirty();
  }

  function updateProvider(providerId: string, patch: Partial<AiProviderSettings>): void {
    if (!draft) return;
    update({ ai_providers: draft.ai_providers.map((provider) => provider.id === providerId ? { ...provider, ...patch } : provider) });
  }

  function markDirty(): void {
    setSaveState("dirty");
    setMessage("");
  }

  function addProvider(): void {
    if (!draft) return;
    const id = uniqueProviderId(draft.ai_providers);
    const provider: AiProviderSettings = {
      id,
      label: "新的 AI Provider",
      kind: "openai_compatible",
      enabled: true,
      base_url: "https://api.openai.com/v1",
      model: "gpt-4o-mini",
      api_key_configured: false,
      api_key_source: "none",
      timeout_ms: 60_000,
      retry_attempts: 1,
      retry_backoff_ms: 500,
      health_status: "missing_key",
    };
    update({ ai_providers: [...draft.ai_providers, provider] });
    setSelectedProviderId(id);
    setSecretDrafts((current) => ({ ...current, [id]: { action: "preserve", value: "" } }));
  }

  function removeProvider(providerId: string): void {
    if (!draft || draft.ai_providers.length <= 1) {
      setMessage("至少需要保留一个 AI Provider。");
      return;
    }
    const provider = draft.ai_providers.find((item) => item.id === providerId);
    if (!provider || !window.confirm(`确定删除“${provider.label}”吗？`)) return;
    const remaining = draft.ai_providers.filter((item) => item.id !== providerId);
    let activeId = draft.active_ai_provider_id;
    if (activeId === providerId) {
      const nextActive = remaining.find((item) => item.enabled) ?? { ...remaining[0], enabled: true };
      activeId = nextActive.id;
      if (!remaining.some((item) => item.enabled)) remaining[0] = nextActive;
    }
    setSecretDrafts((current) => {
      const next = { ...current };
      delete next[providerId];
      return next;
    });
    setDraft({ ...draft, ai_providers: remaining, active_ai_provider_id: activeId });
    setSelectedProviderId(activeId);
    markDirty();
  }

  function setProviderEnabled(providerId: string, enabled: boolean): void {
    if (!draft) return;
    if (!enabled && draft.active_ai_provider_id === providerId) {
      const replacement = draft.ai_providers.find((provider) => provider.id !== providerId && provider.enabled);
      if (!replacement) {
        setMessage("活动 Provider 不能被禁用；请先启用并激活另一个 Provider。");
        return;
      }
      update({
        active_ai_provider_id: replacement.id,
        ai_providers: draft.ai_providers.map((provider) => provider.id === providerId ? { ...provider, enabled: false } : provider),
      });
      return;
    }
    updateProvider(providerId, { enabled });
  }

  function setActiveProvider(providerId: string): void {
    if (!draft) return;
    setDraft({
      ...draft,
      active_ai_provider_id: providerId,
      ai_providers: draft.ai_providers.map((provider) => provider.id === providerId ? { ...provider, enabled: true } : provider),
    });
    markDirty();
  }

  function updateSecret(providerId: string, next: SecretDraft): void {
    setSecretDrafts((current) => ({ ...current, [providerId]: next }));
    markDirty();
  }

  async function save(): Promise<void> {
    if (!draft || saveState === "saving") return;
    setSaveState("saving");
    setMessage("");
    try {
      const secretChanges: AiProviderSecretChange[] = draft.ai_providers.map((provider) => {
        const secret = secretDrafts[provider.id] ?? { action: "preserve", value: "" };
        if (secret.action === "replace") return { provider_id: provider.id, action: "replace", value: secret.value };
        return { provider_id: provider.id, action: secret.action };
      });
      const warnings = await onSave({ settings: draft, secret_changes: secretChanges });
      setSecretDrafts({});
      setSaveState("saved");
      setMessage(warnings.length ? warnings.join("；") : "设置已安全保存。");
    } catch (error) {
      setSaveState("error");
      setMessage(getErrorMessage(error));
    }
  }

  async function testProvider(provider: AiProviderSettings): Promise<void> {
    if (testingProviderId) return;
    setTestingProviderId(provider.id);
    setMessage("正在测试连接…");
    try {
      const secret = secretDrafts[provider.id];
      const result = await window.seekstar.settings.testProvider({
        provider,
        api_key: secret?.action === "replace" ? secret.value : undefined,
        secret_action: secret?.action ?? "preserve",
      });
      setMessage(result.status === "ok" ? `连接成功：${result.model ?? provider.model}` : result.message);
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setTestingProviderId(undefined);
    }
  }

  function back(): void {
    if (saveState === "dirty" && !window.confirm("设置尚未保存，确定离开吗？")) return;
    onBack();
  }

  if (!draft) return <main className="settings-page settings-loading">正在加载设置…</main>;

  return (
    <main className="settings-page">
      <aside className="settings-sidebar">
        <button className="settings-back" onClick={back} type="button"><ArrowLeft size={16} />返回 SeekStar</button>
        <div className="settings-brand"><span>SEEKSTAR</span><strong>设置</strong><small>本地探索运行时</small></div>
        <nav className="settings-nav" aria-label="设置分类">
          {NAVIGATION.map((item) => <button className={section === item.id ? "active" : ""} key={item.id} onClick={() => setSection(item.id)} type="button"><item.icon size={16} />{item.label}</button>)}
        </nav>
      </aside>

      <section className="settings-main">
        <header className="settings-topbar">
          <div><h1>{NAVIGATION.find((item) => item.id === section)?.label}</h1><p>只保留影响 MVP 主闭环的产品级设置。</p></div>
          <div className="settings-save-status" data-state={saveState}>
            <span>{saveStateLabel(saveState)}</span>
            <button disabled={saveState === "saving" || saveState === "idle" || saveState === "saved"} onClick={() => void save()} type="button">{saveState === "saving" ? "保存中…" : "保存更改"}</button>
          </div>
        </header>
        {message ? <div className={saveState === "error" ? "settings-message error" : "settings-message"}>{message}</div> : null}

        <div className="settings-scroll">
          {section === "exploration" ? <ExplorationSettings draft={draft} update={update} /> : null}
          {section === "ai" ? (
            <AiProviderSettingsPanel
              activeProviderId={draft.active_ai_provider_id}
              onActivate={setActiveProvider}
              onAdd={addProvider}
              onDelete={removeProvider}
              onEnable={setProviderEnabled}
              onSecret={updateSecret}
              onSelect={setSelectedProviderId}
              onTest={(provider) => void testProvider(provider)}
              onUpdate={updateProvider}
              providers={draft.ai_providers}
              secret={selectedProvider ? secretDrafts[selectedProvider.id] : undefined}
              selectedProvider={selectedProvider}
              testingProviderId={testingProviderId}
            />
          ) : null}
          {section === "sources" ? <SourcesSettings draft={draft} update={update} /> : null}
          {section === "permissions" ? <PermissionSettings draft={draft} update={update} /> : null}
          {section === "data" ? <DataSettings draft={draft} onClearCache={onClearCache} storePaths={storePaths} update={update} /> : null}
        </div>
      </section>
    </main>
  );
}

function ExplorationSettings({ draft, update }: { draft: SeekStarSettings; update: (patch: Partial<SeekStarSettings>) => void }): ReactElement {
  return <SettingsGroup title="探索世界" description="这些设置只影响后续生成的世界段，不会修改已经完成的段。">
    <SelectRow label="内容语言" description="AI 地形标题与说明的首选语言。" value={draft.exploration_language} options={[{ value: "zh-CN", label: "简体中文" }, { value: "en", label: "English" }, { value: "ja", label: "日本語" }]} onChange={(value) => update({ exploration_language: value })} />
    <SelectRow label="语义密度" description="控制每个世界段的信息密度。" value={draft.exploration_density} options={[{ value: "compact", label: "紧凑" }, { value: "normal", label: "标准" }, { value: "rich", label: "丰富" }]} onChange={(value) => update({ exploration_density: value as SeekStarSettings["exploration_density"] })} />
    <NumberRow label="AI 生成并发" description="MVP 上限固定为 2。" min={1} max={2} value={draft.generation_concurrency} onChange={(value) => update({ generation_concurrency: value })} />
    <NumberRow label="Scout 并发" description="同时验证的来源候选数量。" min={1} max={2} value={draft.scout_concurrency} onChange={(value) => update({ scout_concurrency: value })} />
  </SettingsGroup>;
}

function AiProviderSettingsPanel(props: {
  activeProviderId: string;
  onActivate: (id: string) => void;
  onAdd: () => void;
  onDelete: (id: string) => void;
  onEnable: (id: string, enabled: boolean) => void;
  onSecret: (id: string, secret: SecretDraft) => void;
  onSelect: (id: string) => void;
  onTest: (provider: AiProviderSettings) => void;
  onUpdate: (id: string, patch: Partial<AiProviderSettings>) => void;
  providers: AiProviderSettings[];
  secret?: SecretDraft;
  selectedProvider?: AiProviderSettings;
  testingProviderId?: string;
}): ReactElement {
  const provider = props.selectedProvider;
  return <div className="provider-workspace">
    <section className="provider-list-panel">
      <header><div><h2>AI Provider</h2><p>所有 Provider 使用 OpenAI-compatible 协议。</p></div><button className="icon-button" onClick={props.onAdd} title="新增 Provider" type="button"><Plus size={16} /></button></header>
      <div className="provider-list">{props.providers.map((item) => <button className={item.id === provider?.id ? "selected" : ""} key={item.id} onClick={() => props.onSelect(item.id)} type="button"><span><strong>{item.label}</strong><small>{item.model}</small></span>{item.id === props.activeProviderId ? <em><Check size={12} />活动</em> : <i data-ready={item.api_key_configured}>{item.api_key_configured ? "已配置" : "缺少密钥"}</i>}</button>)}</div>
    </section>
    {provider ? <section className="provider-editor">
      <header><div><h2>{provider.label}</h2><p>{provider.id}</p></div><div className="provider-header-actions"><button className={provider.id === props.activeProviderId ? "active" : ""} onClick={() => props.onActivate(provider.id)} type="button">{provider.id === props.activeProviderId ? "当前活动" : "设为活动"}</button><button className="danger-icon" disabled={props.providers.length <= 1} onClick={() => props.onDelete(provider.id)} title="删除 Provider" type="button"><Trash2 size={15} /></button></div></header>
      <div className="settings-form-grid">
        <TextField label="显示名称" value={provider.label} onChange={(value) => props.onUpdate(provider.id, { label: value })} />
        <label className="settings-field"><span>Provider ID</span><input disabled type="text" value={provider.id} /></label>
        <TextField wide label="Base URL" value={provider.base_url} onChange={(value) => props.onUpdate(provider.id, { base_url: value })} />
        <TextField label="模型" value={provider.model} onChange={(value) => props.onUpdate(provider.id, { model: value })} />
        <TextField label="环境变量" value={provider.api_key_env_var ?? ""} placeholder="例如 DEEPSEEK_API_KEY" onChange={(value) => props.onUpdate(provider.id, { api_key_env_var: value || undefined })} />
        <label className="settings-field wide"><span>API Key</span><div className="secret-control"><input autoComplete="new-password" onChange={(event) => props.onSecret(provider.id, { action: "replace", value: event.target.value })} placeholder={provider.api_key_configured ? `已通过${provider.api_key_source === "encrypted" ? "系统加密" : "环境变量"}配置；留空则保留` : "输入 API Key"} type="password" value={props.secret?.action === "replace" ? props.secret.value : ""} /><button onClick={() => props.onSecret(provider.id, { action: "clear", value: "" })} type="button">清除已保存密钥</button></div><small>密钥只在主进程中加密保存，不会回传到页面。</small></label>
        <NumberField label="超时（毫秒）" min={1000} max={120000} value={provider.timeout_ms} onChange={(value) => props.onUpdate(provider.id, { timeout_ms: value })} />
        <NumberField label="重试次数" min={0} max={2} value={provider.retry_attempts} onChange={(value) => props.onUpdate(provider.id, { retry_attempts: value })} />
      </div>
      <footer><label className="toggle-row"><input checked={provider.enabled} onChange={(event) => props.onEnable(provider.id, event.target.checked)} type="checkbox" /><span><strong>启用 Provider</strong><small>禁用后不会参与世界生成。</small></span></label><button disabled={props.testingProviderId === provider.id} onClick={() => props.onTest(provider)} type="button">{props.testingProviderId === provider.id ? "正在测试…" : "测试连接"}</button></footer>
    </section> : null}
  </div>;
}

function SourcesSettings({ draft, update }: { draft: SeekStarSettings; update: (patch: Partial<SeekStarSettings>) => void }): ReactElement {
  return <SettingsGroup title="来源服务" description="只有 Scout 成功观察的候选才会进入 L3 主画布。">{draft.content_providers.map((provider) => <label className="settings-row" key={provider.id}><span><strong>{provider.id}</strong><small>优先级 {provider.priority} · {provider.languages?.join(", ") || "自动语言"}</small></span><input checked={provider.enabled} onChange={(event) => update({ content_providers: draft.content_providers.map((item) => item.id === provider.id ? { ...item, enabled: event.target.checked } : item) })} type="checkbox" /></label>)}</SettingsGroup>;
}

function PermissionSettings({ draft, update }: { draft: SeekStarSettings; update: (patch: Partial<SeekStarSettings>) => void }): ReactElement {
  return <SettingsGroup title="助手权限" description="会改变探索状态或访问外部来源的行为必须遵循权限策略。">
    <SelectRow label="默认策略" description="没有单独规则时使用的行为。" value={draft.assistant_action_permission_mode} options={[{ value: "ask_each_time", label: "每次询问" }, { value: "allow_low_risk", label: "允许低风险操作" }, { value: "block_all", label: "全部阻止" }]} onChange={(value) => update({ assistant_action_permission_mode: value as SeekStarSettings["assistant_action_permission_mode"] })} />
    {draft.assistant_action_permission_rules.map((rule) => <SelectRow key={rule.action_type} label={rule.action_type.replaceAll("_", " ")} description="该类型操作的单独规则。" value={rule.decision} options={[{ value: "allow_after_click", label: "点击后允许" }, { value: "ask_each_time", label: "每次询问" }, { value: "block", label: "阻止" }]} onChange={(value) => update({ assistant_action_permission_rules: draft.assistant_action_permission_rules.map((item) => item.action_type === rule.action_type ? { ...item, decision: value as typeof rule.decision } : item) })} />)}
  </SettingsGroup>;
}

function DataSettings({ draft, onClearCache, storePaths, update }: { draft: SeekStarSettings; onClearCache: () => Promise<unknown> | void; storePaths: Record<string, string>; update: (patch: Partial<SeekStarSettings>) => void }): ReactElement {
  async function deleteWorlds(): Promise<void> {
    if (!window.confirm("这会永久删除所有探索世界和视图检查点，确定继续吗？")) return;
    await window.seekstar.data.clearExploration();
  }
  return <>
    <SettingsGroup title="运行时缓存" description="世界文档持久保存在磁盘，内存缓存可以安全淘汰。">
      <NumberRow label="Tab 缓存（MB）" description="所有活动 tab 的内存对象预算。" min={32} max={2048} value={Math.round(draft.tab_cache_max_bytes / 1024 / 1024)} onChange={(value) => update({ tab_cache_max_bytes: value * 1024 * 1024 })} />
      <NumberRow label="实时网页表面" description="同时保持交互状态的 L3 页面数量。" min={1} max={8} value={draft.tile_live_surface_limit} onChange={(value) => update({ tile_live_surface_limit: value })} />
      <div className="settings-action-row"><button onClick={() => void onClearCache()} type="button">清理内存缓存</button><button className="danger" onClick={() => void deleteWorlds()} type="button">删除所有探索世界</button></div>
    </SettingsGroup>
    <SettingsGroup title="本地文件" description="SeekStar 当前使用的新运行时数据文件。">{Object.entries(storePaths).map(([key, path]) => <div className="settings-path" key={key}><strong>{key.replaceAll("_", " ")}</strong><code>{path}</code></div>)}</SettingsGroup>
  </>;
}

function SettingsGroup({ children, description, title }: { children: ReactNode; description: string; title: string }): ReactElement {
  return <section className="settings-group"><header><h2>{title}</h2><p>{description}</p></header><div className="settings-card">{children}</div></section>;
}

function SelectRow({ description, label, onChange, options, value }: { description: string; label: string; onChange: (value: string) => void; options: Array<{ value: string; label: string }>; value: string }): ReactElement {
  return <label className="settings-row"><span><strong>{label}</strong><small>{description}</small></span><select onChange={(event) => onChange(event.target.value)} value={value}>{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>;
}
function NumberRow({ description, label, max, min, onChange, value }: { description: string; label: string; max: number; min: number; onChange: (value: number) => void; value: number }): ReactElement {
  return <label className="settings-row"><span><strong>{label}</strong><small>{description}</small></span><input max={max} min={min} onChange={(event: ChangeEvent<HTMLInputElement>) => onChange(Number(event.target.value))} type="number" value={value} /></label>;
}
function TextField({ label, onChange, placeholder, value, wide }: { label: string; onChange: (value: string) => void; placeholder?: string; value: string; wide?: boolean }): ReactElement {
  return <label className={wide ? "settings-field wide" : "settings-field"}><span>{label}</span><input onChange={(event) => onChange(event.target.value)} placeholder={placeholder} type="text" value={value} /></label>;
}
function NumberField({ label, max, min, onChange, value }: { label: string; max: number; min: number; onChange: (value: number) => void; value: number }): ReactElement {
  return <label className="settings-field"><span>{label}</span><input max={max} min={min} onChange={(event) => onChange(Number(event.target.value))} type="number" value={value} /></label>;
}

function uniqueProviderId(providers: AiProviderSettings[]): string {
  const used = new Set(providers.map((provider) => provider.id));
  let index = providers.length + 1;
  while (used.has(`provider-${index}`)) index += 1;
  return `provider-${index}`;
}
function saveStateLabel(state: SaveState): string {
  if (state === "dirty") return "有未保存更改";
  if (state === "saving") return "正在安全保存";
  if (state === "saved") return "已保存";
  if (state === "error") return "保存失败";
  return "设置已同步";
}
function getErrorMessage(error: unknown): string { return error instanceof Error ? error.message : String(error); }
