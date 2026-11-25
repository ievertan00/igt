import { useEffect, useRef, useState } from "react";
import { useGuideCopy, GuideText } from "../components/learner-language";
import { Icon } from "../components/Icon";
import { Heading, Panel, State } from "../components/Page";
import { useModelSettings, type ModelProfile } from "../components/model-settings";
import { webApi } from "../api/client";

const MODEL_PROVIDER_PRESETS = [
  { key: "openai", label: "OpenAI", provider: "custom", baseUrl: "https://api.openai.com/v1" },
  { key: "anthropic", label: "Anthropic", provider: "custom", baseUrl: "https://api.anthropic.com/v1" },
  { key: "deepseek", label: "DeepSeek", provider: "custom", baseUrl: "https://api.deepseek.com/v1" },
  { key: "ollama", label: "Ollama", provider: "ollama", baseUrl: "http://localhost:11434" },
  { key: "custom", label: "Custom (OpenAI-compatible)", provider: "custom", baseUrl: "" },
] as const;
type ProviderPresetKey = (typeof MODEL_PROVIDER_PRESETS)[number]["key"];
function presetFor(provider: string, baseUrl: string): ProviderPresetKey {
  if (provider === "ollama") return "ollama";
  const url = (baseUrl || "").toLowerCase();
  if (url.includes("openai.com")) return "openai";
  if (url.includes("anthropic.com")) return "anthropic";
  if (url.includes("deepseek.com")) return "deepseek";
  return "custom";
}
function displayUrl(url: string) {
  return (url || "").replace(/^https?:\/\//, "").replace(/\/+$/, "");
}
type ModelDraft = {
  id: string | null;
  name: string;
  preset: ProviderPresetKey;
  model: string;
  /** Legacy dual-role setups keep their Pro model when the single model is not edited. */
  pro?: string;
  baseUrl: string;
  apiKey: string;
  clearKey: boolean;
  setDefault: boolean;
  showKey: boolean;
  keyConfigured: boolean;
};
const emptyAddForm: Omit<ModelDraft, "id"> = {
  name: "", preset: "custom", model: "", baseUrl: "",
  apiKey: "", clearKey: false, setDefault: true, showKey: false, keyConfigured: false,
};

export function LlmSettings({ fromCli }: { fromCli: boolean }) {
  const { t } = useGuideCopy();
  const models = useModelSettings();
  const [settingsTab, setSettingsTab] = useState<"models" | "markdown">("models");
  const savedData = models.settings;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [testing, setTesting] = useState(false);
  const [testStatus, setTestStatus] = useState("");
  const [editing, setEditing] = useState<ModelDraft>();
  const [deleting, setDeleting] = useState<ModelProfile>();
  const [addForm, setAddForm] = useState<ModelDraft>(() => ({ ...emptyAddForm, id: null }));
  const editDialog = useRef<HTMLDialogElement>(null);
  const deleteDialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { if (editing && editDialog.current && !editDialog.current.open) editDialog.current.showModal(); }, [editing]);
  useEffect(() => { if (deleting && deleteDialog.current && !deleteDialog.current.open) deleteDialog.current.showModal(); }, [deleting]);

  const profiles = savedData?.profiles || [];
  const presetOf = (provider: string, baseUrl: string) =>
    MODEL_PROVIDER_PRESETS.find(p => p.key === presetFor(provider, baseUrl)) || MODEL_PROVIDER_PRESETS[MODEL_PROVIDER_PRESETS.length - 1];
  function setPreset(draft: ModelDraft, key: ProviderPresetKey): ModelDraft {
    const next = MODEL_PROVIDER_PRESETS.find(p => p.key === key)!;
    const current = MODEL_PROVIDER_PRESETS.find(p => p.key === draft.preset)!;
    return { ...draft, preset: key, baseUrl: !draft.baseUrl || draft.baseUrl === current.baseUrl ? next.baseUrl : draft.baseUrl };
  }
  function openEdit(profile: ModelProfile) {
    const preset = presetOf(profile.provider, profile.baseUrl);
    setEditing({
      id: profile.id,
      name: profile.name,
      preset: preset.key,
      model: profile.models.flash || profile.models.pro || "",
      pro: profile.models.pro && profile.models.pro !== profile.models.flash ? profile.models.pro : undefined,
      baseUrl: profile.baseUrl || preset.baseUrl,
      apiKey: "",
      clearKey: false,
      setDefault: profile.id === savedData?.activeProfileId,
      showKey: false,
      keyConfigured: profile.keyConfigured,
    });
    setTestStatus(""); setError(""); setStatus("");
  }
  function closeEdit() { setEditing(undefined); }
  function resetAdd() { setAddForm({ ...emptyAddForm, id: null }); setTestStatus(""); setError(""); setStatus(""); }

  async function saveModel(action: "create" | "update", draft: ModelDraft) {
    const preset = MODEL_PROVIDER_PRESETS.find(p => p.key === draft.preset)!;
    const model = draft.model.trim();
    const baseUrl = (draft.baseUrl || preset.baseUrl).replace(/\/$/, "");
    if (!draft.name.trim()) { setError(t("Enter a configuration name")); return; }
    if (!model) { setError(t("Enter a model name")); return; }
    if (!baseUrl) { setError(t("Enter an API base URL")); return; }
    setBusy(true); setError(""); setStatus("");
    try {
      const saved = await webApi.saveLlmSettings({
        action,
        profileId: draft.id || "",
        profileName: draft.name.trim(),
        provider: preset.provider,
        apiKeys: { [preset.provider]: draft.apiKey },
        clearApiKeys: { [preset.provider]: draft.clearKey },
        models: { [preset.provider]: { flash: model, pro: (draft.pro && draft.pro !== model ? draft.pro : model) } },
        baseUrls: { [preset.provider === "ollama" ? "OllamaBaseUrl" : "CustomApiBase"]: baseUrl },
        setDefault: !fromCli && draft.setDefault,
        defaultScope: "web",
      });
      models.update(saved);
      setStatus(!fromCli && draft.setDefault ? t("Model configuration saved and applied.") : t("Model configuration saved."));
      setEditing(undefined);
      setTestStatus("");
      if (action === "create") setAddForm({ ...emptyAddForm, id: null });
    } catch (e: any) {
      setError(e.message || "Could not save settings");
    } finally {
      setBusy(false);
    }
  }

  async function testCurrent(draft: ModelDraft): Promise<boolean> {
    const preset = MODEL_PROVIDER_PRESETS.find(p => p.key === draft.preset)!;
    const baseUrl = (draft.baseUrl || preset.baseUrl).replace(/\/$/, "");
    if (!draft.model.trim() || !baseUrl) { setTestStatus(t("Enter an API base URL and a model name first")); return false; }
    setTesting(true); setTestStatus(""); setError("");
    try {
      const result = await webApi.testLlmConnection({ baseUrl, model: draft.model.trim(), apiKey: draft.apiKey || "", profileId: draft.id || "", clearApiKey: draft.clearKey });
      const ok = !result?.error;
      setTestStatus(ok ? result.message || "Connection successful" : result.message || "Connection test failed");
      return ok;
    } catch (e: any) {
      setTestStatus(e.message || "Connection test failed");
      return false;
    } finally {
      setTesting(false);
    }
  }

  async function testAndAdd() {
    const draft = addForm;
    const preset = MODEL_PROVIDER_PRESETS.find(p => p.key === draft.preset)!;
    const model = draft.model.trim();
    const baseUrl = (draft.baseUrl || preset.baseUrl).replace(/\/$/, "");
    if (!draft.name.trim()) { setError(t("Enter a configuration name")); return; }
    if (!model) { setError(t("Enter a model name")); return; }
    if (!baseUrl) { setError(t("Enter an API base URL")); return; }
    if (preset.provider === "ollama") { await saveModel("create", draft); return; }
    const ok = await testCurrent(draft);
    if (ok) await saveModel("create", draft);
  }

  async function removeProfile() {
    if (!deleting) return;
    setBusy(true); setError(""); setStatus("");
    try {
      const saved = await webApi.saveLlmSettings({ action: "delete", profileId: deleting.id });
      models.update(saved);
      setDeleting(undefined);
      setStatus(t("Model deleted."));
    } catch (e: any) {
      setError(e.message || t("Could not delete"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="llm-settings">
      <div className="settings-header" data-section={settingsTab}>
        <div className="settings-header-copy">
          <div aria-hidden={settingsTab !== "models"}>
            <Heading eyebrow={t("Settings")} title={t("Model settings")} detail={t("Connect Google Gemini, Qwen, DeepSeek, LM Studio, vLLM, and other OpenAI-compatible services.")} />
          </div>
          <div aria-hidden={settingsTab !== "markdown"}>
            <Heading eyebrow={t("Settings")} title={t("Markdown file settings")} detail={t("Choose where ClearWrite reads and saves your Markdown learning records.")} />
          </div>
        </div>
          <svg className="settings-art" viewBox="0 0 248 184" aria-hidden="true" focusable="false">
            <rect x="53" y="35" width="74" height="44" rx="12" fill="var(--accent-hover)" transform="rotate(2 53 35)" />
            <g transform="rotate(2 114 102)">
              <rect x="33" y="52" width="163" height="101" rx="21" fill="var(--accent)" />
              <path d="M53 108V96l6 7 6-7v12m9-12v12m-4-4 4 4 4-4" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              <text x="86" y="108" fill="white" fontSize="15" fontWeight="700">Markdown</text>
            </g>
            <g transform="rotate(12 165 59)">
              <rect x="123" y="12" width="81" height="102" rx="14" fill="var(--paper)" />
              <rect x="135" y="23" width="40" height="9" rx="4.5" fill="var(--accent)" />
              <path d="M137 42h57m-57 10h49m-49 10h35" fill="none" stroke="var(--line-hover)" strokeWidth="5" strokeLinecap="round" />
            </g>
          </svg>
      </div>
      <div className="settings-tabs" role="tablist" aria-label={t("Settings sections")} onKeyDown={(event) => {
        if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
        event.preventDefault();
        const next = event.key === "Home" ? "models" : event.key === "End" ? "markdown" : settingsTab === "models" ? "markdown" : "models";
        setSettingsTab(next);
        event.currentTarget.querySelector<HTMLButtonElement>(`#settings-tab-${next}`)?.focus();
      }}>
        <button
          id="settings-tab-models"
          type="button"
          role="tab"
          aria-selected={settingsTab === "models"}
          tabIndex={settingsTab === "models" ? 0 : -1}
          aria-controls="settings-panel-models"
          className={settingsTab === "models" ? "is-active" : ""}
          onClick={() => setSettingsTab("models")}
        >
          <Icon name="settings" /><GuideText text="Model settings" />
        </button>
        <button
          id="settings-tab-markdown"
          type="button"
          role="tab"
          aria-selected={settingsTab === "markdown"}
          tabIndex={settingsTab === "markdown" ? 0 : -1}
          aria-controls="settings-panel-markdown"
          className={settingsTab === "markdown" ? "is-active" : ""}
          onClick={() => setSettingsTab("markdown")}
        >
          <Icon name="folder" /><GuideText text="Markdown files" />
        </button>
      </div>
      <div id="settings-panel-models" role="tabpanel" aria-labelledby="settings-tab-models" hidden={settingsTab !== "models"}>
      {!savedData ? (
        error || models.error
          ? <><State title={t("Model settings are unavailable")} detail={error || models.error} /><button className="secondary" onClick={() => void models.refresh()}>{t("Retry")}</button></>
          : <State title={t("Loading model settings…")} />
      ) : <>
      <Panel title={t("Saved models")}>
        <p className="saved-model-note"><GuideText text="Save model configurations here. Each page remembers its own model choice in this browser. The default is used when a page has no saved choice." /></p>
        {profiles.length === 0
          ? <p className="saved-model-empty">{t("No saved models yet. Add one below.")}</p>
          : <div className="saved-model-grid">
              {profiles.map(profile => {
                const preset = presetOf(profile.provider, profile.baseUrl);
                const isActive = !fromCli && profile.id === savedData.activeProfileId;
                const modelName = profile.models.flash || profile.models.pro;
                return <article key={profile.id} className={`model-card${isActive ? " is-active" : ""}`} data-profile-id={profile.id}>
                  <header className="model-card-head">
                    <span className="model-card-kind">{preset.provider === "ollama" ? <Icon name="home" /> : <Icon name="globe" />}<GuideText text={preset.label} /></span>
                    <h3 className="model-card-title">{profile.name}{isActive && <span className="model-card-default"><GuideText text="Default" /></span>}</h3>
                  </header>
                  <dl className="model-card-facts">
                    <div><dt><GuideText text="Model" /></dt><dd>{modelName}</dd></div>
                    <div><dt>URL</dt><dd>{displayUrl(profile.baseUrl)}</dd></div>
                    <div><dt><GuideText text="API Key" /></dt><dd>{profile.keyMasked || <GuideText text="No API key required" />}</dd></div>
                  </dl>
                  <footer className="model-card-actions">
                    <button type="button" className="secondary" disabled={busy || testing} onClick={() => openEdit(profile)}>{t("Edit")}</button>
                    {profile.id !== "current" && <button type="button" className="secondary model-card-delete" disabled={busy || testing} onClick={() => { setError(""); setStatus(""); setDeleting(profile); }}>{t("Delete")}</button>}
                  </footer>
                </article>;
              })}
            </div>}
      </Panel>

      <Panel title={t("Add a new model")} className="llm-add-panel">
        <form className="model-add-form" onSubmit={(event) => event.preventDefault()}>
          <label className="settings-field" htmlFor="add-model-name"><span className="form-label"><GuideText text="Task / Purpose" /></span>
            <input id="add-model-name" maxLength={80} value={addForm.name} onChange={(e) => setAddForm((f) => ({ ...f, name: e.target.value }))} placeholder={t("e.g. Everyday writing")} />
          </label>
          <fieldset className="model-provider-field">
            <legend><GuideText text="Provider" /></legend>
            <div className="model-provider-options">
              {MODEL_PROVIDER_PRESETS.map(preset => (
                <label key={preset.key} className={addForm.preset === preset.key ? "is-selected" : ""}>
                  <input type="radio" name="model-provider" value={preset.key} checked={addForm.preset === preset.key} onChange={() => setAddForm((f) => setPreset(f, preset.key))} />
                  <GuideText text={preset.label} />
                </label>
              ))}
            </div>
            <small><GuideText text="Selecting a provider fills its official base URL." /></small>
          </fieldset>
          <div className="settings-grid">
            <label className="settings-field" htmlFor="add-model-id"><span className="form-label"><GuideText text="Model name / ID" /></span>
              <input id="add-model-id" maxLength={300} value={addForm.model} onChange={(e) => setAddForm((f) => ({ ...f, model: e.target.value }))} placeholder="gpt-4o, deepseek-chat, qwen2.5:14b…" />
              <small><GuideText text="Official model IDs, e.g. gpt-4o or deepseek-chat" /></small>
            </label>
            <label className="settings-field" htmlFor="add-model-base-url"><span className="form-label"><GuideText text="API base URL" /></span>
              <input id="add-model-base-url" type="url" value={addForm.baseUrl} onChange={(e) => setAddForm((f) => ({ ...f, baseUrl: e.target.value }))} placeholder={MODEL_PROVIDER_PRESETS.find(p => p.key === addForm.preset)?.baseUrl || "https://api.example.com/v1"} />
              <small><GuideText text="Optional. Leave empty to use the provider default." /></small>
            </label>
          </div>
          {addForm.preset !== "ollama" ? (
            <label className="settings-field" htmlFor="add-model-key"><span className="form-label"><GuideText text="API Key" /></span>
              <span className="model-key-row">
                <input id="add-model-key" type={addForm.showKey ? "text" : "password"} autoComplete="new-password" value={addForm.apiKey} onChange={(e) => setAddForm((f) => ({ ...f, apiKey: e.target.value }))} placeholder={t("Enter API key")} />
                <button type="button" className="secondary model-key-toggle" aria-label={addForm.showKey ? t("Hide API key") : t("Show API key")} onClick={() => setAddForm((f) => ({ ...f, showKey: !f.showKey }))}><Icon name={addForm.showKey ? "eye-off" : "eye"} /></button>
              </span>
            </label>
          ) : <p className="model-ollama-note"><GuideText text="No API key required" /></p>}
          {!fromCli && <label className="settings-check">
            <input id="add-model-default" type="checkbox" checked={addForm.setDefault} onChange={(e) => setAddForm((f) => ({ ...f, setDefault: e.target.checked }))} />
            <span><GuideText text="Set as default model" /></span>
          </label>}
          {testStatus && <p role="status" className={testStatus === "Connection successful" ? "llm-test-success" : "llm-test-error"}>{testStatus}</p>}
          {error && <State title={t("Could not save")} detail={error} />}
          <div className="model-add-actions">
            <button type="button" className="secondary" disabled={busy || testing} onClick={resetAdd}>{t("Reset form")}</button>
            <button type="submit" className="primary" aria-busy={busy || testing} disabled={busy || testing || !addForm.name.trim() || !addForm.model.trim()} onClick={() => void testAndAdd()}>
              {busy || testing ? t("Testing…") : <GuideText text="Test & add model" />}
            </button>
          </div>
        </form>
      </Panel>

      {error && <State title={t("Could not save")} detail={error} />}
      {status && (
        <p className="settings-status" role="status">
          {status}
        </p>
      )}

      {editing && (
        <dialog ref={editDialog} className="saved-word-dialog model-edit-dialog" aria-labelledby="model-edit-title" onCancel={(event) => { event.preventDefault(); closeEdit(); }}>
          <div className="saved-word-dialog-header">
            <h2 id="model-edit-title">{t("Edit model configuration")}: {editing.name}</h2>
            <button type="button" className="secondary" onClick={closeEdit}><Icon name="close" />{t("Close")}</button>
          </div>
          <div className="model-dialog-body">
            <label className="settings-field" htmlFor="edit-model-name"><span className="form-label">{t("Task / Purpose")}</span>
              <input id="edit-model-name" maxLength={80} value={editing.name} onChange={(e) => setEditing(d => d && { ...d, name: e.target.value })} />
            </label>
            <div className="settings-grid">
              <label className="settings-field" htmlFor="edit-model-provider"><span className="form-label">{t("Provider")}</span>
                <select id="edit-model-provider" value={editing.preset} onChange={(e) => setEditing(d => d && setPreset(d, e.target.value as ProviderPresetKey))}>
                  {MODEL_PROVIDER_PRESETS.map(preset => <option key={preset.key} value={preset.key}>{t(preset.label)}</option>)}
                </select>
              </label>
              <label className="settings-field" htmlFor="edit-model-id"><span className="form-label">{t("Model name / ID")}</span>
                <input id="edit-model-id" maxLength={300} value={editing.model} onChange={(e) => setEditing(d => d && { ...d, model: e.target.value })} />
              </label>
            </div>
            <label className="settings-field" htmlFor="edit-model-base-url"><span className="form-label">{t("API base URL")}</span>
              <input id="edit-model-base-url" type="url" value={editing.baseUrl} onChange={(e) => setEditing(d => d && { ...d, baseUrl: e.target.value })} />
            </label>
            {editing.preset !== "ollama" && (
              <div className="settings-field">
                <span className="form-label">{t("API Key")}</span>
                <span className="model-key-row">
                  <input id="edit-model-key" type={editing.showKey ? "text" : "password"} autoComplete="new-password" disabled={editing.clearKey} value={editing.apiKey} onChange={(e) => setEditing(d => d && { ...d, apiKey: e.target.value })}
                    placeholder={editing.keyConfigured ? t("Saved key •••• · enter a replacement") : t("Enter API key")} />
                  <button type="button" className="secondary model-key-toggle" aria-label={editing.showKey ? t("Hide API key") : t("Show API key")} onClick={() => setEditing(d => d && { ...d, showKey: !d.showKey })}><Icon name={editing.showKey ? "eye-off" : "eye"} /></button>
                </span>
                {editing.keyConfigured && (
                  <label className="settings-check">
                    <input type="checkbox" checked={editing.clearKey} onChange={(e) => setEditing(d => d && { ...d, clearKey: e.target.checked })} />
                    <span>{t("Remove this provider’s key when saving")}</span>
                  </label>
                )}
              </div>
            )}
            {!fromCli && <label className="settings-check">
              <input id="edit-model-default" type="checkbox" checked={editing.setDefault} onChange={(e) => setEditing(d => d && { ...d, setDefault: e.target.checked })} />
              <span>{t("Set as default model")}</span>
            </label>}
            {testStatus && <p role="status" className={testStatus === "Connection successful" ? "llm-test-success" : "llm-test-error"}>{testStatus}</p>}
            {error && <State title={t("Could not save")} detail={error} />}
            <div className="model-dialog-actions">
              <button id="edit-model-test" type="button" className="secondary" disabled={busy || testing} onClick={() => editing && void testCurrent(editing)}>{testing ? t("Testing…") : t("Test connection")}</button>
              <button id="edit-model-cancel" type="button" className="secondary" disabled={busy || testing} onClick={closeEdit}>{t("Cancel")}</button>
              <button id="edit-model-save" type="button" className="primary" aria-busy={busy} disabled={busy || testing} onClick={() => editing && void saveModel("update", editing)}>{busy ? t("Saving…") : t("Save changes")}</button>
            </div>
          </div>
        </dialog>
      )}

      {deleting && (
        <dialog ref={deleteDialog} className="handbook-delete-confirm" aria-label={t("Delete model?")} aria-busy={busy} onCancel={(event) => { event.preventDefault(); setDeleting(undefined); }}>
          <strong>{t("Delete this model?")}</strong>
          <span>{t("This removes the saved configuration. If it is the active model, switch to another saved model first.")}</span>
          {error && <span role="alert">{t(error)}</span>}
          <span className="handbook-delete-actions">
            <button type="button" disabled={busy} onClick={() => setDeleting(undefined)}>{t("Cancel")}</button>
            <button type="button" className="handbook-delete-submit" disabled={busy} onClick={() => void removeProfile()}>{busy ? t("Deleting…") : t("Delete")}</button>
          </span>
        </dialog>
      )}
      </>}
      </div>
      <div id="settings-panel-markdown" role="tabpanel" aria-labelledby="settings-tab-markdown" hidden={settingsTab !== "markdown"}>
        <MarkdownFileSettings />
      </div>
    </div>
  );
}

type MarkdownPaths = {
  vaultDir: string;
  reviewLog: string;
  vocabularyFile: string;
  practiceLog: string;
  askNotesDir: string;
  handbookReports: string;
};

function MarkdownFileSettings() {
  const { t } = useGuideCopy();
  const [paths, setPaths] = useState<MarkdownPaths>();
  const [savedPaths, setSavedPaths] = useState<MarkdownPaths>();
  const [operation, setOperation] = useState<"browse" | "save">();
  const busy = operation !== undefined;
  const [error, setError] = useState("");
  const [errorTitle, setErrorTitle] = useState("Could not save file locations");
  const [status, setStatus] = useState("");

  useEffect(() => {
    webApi.getFileSettings()
      .then((settings) => {
        if (!settings?.paths) throw new Error("Markdown file settings are unavailable.");
        setPaths(settings.paths);
        setSavedPaths(settings.paths);
      })
      .catch((e: any) => setError(e.message || "Could not load Markdown file settings"));
  }, []);

  function updatePath(field: keyof MarkdownPaths, value: string) {
    setPaths((current) => current ? { ...current, [field]: value } : current);
  }

  async function choosePath(field: keyof MarkdownPaths, kind: "file" | "folder") {
    setError("");
    setStatus("");
    setOperation("browse");
    try {
      const result = await webApi.pickFileSetting(kind);
      if (result.path) updatePath(field, result.path);
    } catch (e: any) {
      if (e.message === "Not found") {
        setErrorTitle("Path picker unavailable");
        setError("Restart IGT so the running server can load the path picker, then try again.");
      } else {
        setErrorTitle("Could not choose a path");
        setError(e.message || "Could not open the path picker");
      }
    } finally {
      setOperation(undefined);
    }
  }

  async function savePaths() {
    if (!paths || !savedPaths) return;
    const changed = Object.fromEntries(
      Object.entries(paths).filter(([field, value]) => value !== savedPaths[field as keyof MarkdownPaths]),
    );
    if (Object.keys(changed).length === 0) {
      setStatus("File locations are up to date.");
      return;
    }

    setOperation("save");
    setError("");
    setErrorTitle("Could not save file locations");
    setStatus("");
    try {
      const result = await webApi.saveFileSettings({ paths: changed });
      setPaths(result.paths);
      setSavedPaths(result.paths);
      setStatus("Markdown file locations saved.");
    } catch (e: any) {
      setError(e.message || "Could not save Markdown file locations");
    } finally {
      setOperation(undefined);
    }
  }

  const folderFields: Array<{ key: keyof MarkdownPaths; label: string; help: string }> = [
    { key: "vaultDir", label: "Obsidian vault folder", help: "Default location for learning notes." },
    { key: "askNotesDir", label: "Ask notes folder", help: "Each saved Ask consultation is written as a Markdown note." },
    { key: "handbookReports", label: "Coach reports folder", help: "Generated Coach reports and historical Markdown reports." },
  ];
  const fileFields: Array<{ key: keyof MarkdownPaths; label: string; help: string }> = [
    { key: "reviewLog", label: "Review log file", help: "Markdown corrections and writing feedback." },
    { key: "vocabularyFile", label: "Vocabulary file", help: "The Markdown source for vocabulary entries." },
    { key: "practiceLog", label: "Practice log file", help: "Saved independent practice records." },
  ];

  if (!paths) {
    return error
      ? <State title={t("Markdown file settings are unavailable")} detail={error} />
      : <State title={t("Loading Markdown file settings…")} />;
  }

  const locationStatus = status || (savedPaths && Object.entries(paths).every(
    ([field, path]) => path.trim() && path === savedPaths[field as keyof MarkdownPaths],
  ) ? "All locations are configured." : "");

  return (
      <Panel title={t("Markdown file locations")} icon="file-tree" className="markdown-settings-panel" detail={t("Choose the local folders and files that ClearWrite uses to read and save your learning records.")}>
        {[{ title: "Folders", kind: "folder" as const, fields: folderFields }, { title: "Files", kind: "file" as const, fields: fileFields }].map(({ title, kind, fields }) => (
          <section className="markdown-path-group" key={kind} aria-labelledby={`markdown-group-${kind}`}>
            <h3 id={`markdown-group-${kind}`}><Icon name={kind === "folder" ? "folder" : "document"} />{t(title)}</h3>
            <div className="markdown-path-grid">
              {fields.map(({ key, label, help }) => (
                <div className="settings-field" key={key}>
                  <div>
                    <label className="form-label" id={`markdown-path-${key}-label`} htmlFor={`markdown-path-${key}`}>{t(label)}</label>
                    <small id={`markdown-path-help-${key}`}>{t(help)}</small>
                  </div>
                  <div className="markdown-path-control">
                    <div className="markdown-path-input">
                      <Icon name={kind === "folder" ? "folder" : "document"} />
                      <input
                        id={`markdown-path-${key}`}
                        type="text"
                        dir="ltr"
                        spellCheck={false}
                        aria-describedby={`markdown-path-help-${key}`}
                        readOnly={busy}
                        value={paths[key]}
                        title={paths[key]}
                        onChange={(event) => { updatePath(key, event.target.value); setStatus(""); setError(""); }}
                      />
                    </div>
                    <button type="button" className="secondary" aria-describedby={`markdown-path-${key}-label`} disabled={busy} onClick={() => choosePath(key, kind)}>
                      <Icon name="folder-open" />{t("Browse…")}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))}
        <footer className="markdown-settings-footer">
          {error && <div className="markdown-settings-error" role="alert"><State title={t(errorTitle)} detail={t(error)} /></div>}
          <div className="llm-form-actions">
            <button className="primary" aria-busy={operation === "save"} disabled={busy} onClick={savePaths}>{t(operation === "save" ? "Saving…" : "Save file locations")}</button>
            <button className="secondary" disabled={busy} onClick={() => {
              setPaths(savedPaths);
              setError("");
              setStatus("");
            }}>{t("Reset")}</button>
          </div>
          <div className="markdown-settings-status" role="status">
            {!error && locationStatus && (
              <span><Icon name="check" />{t(locationStatus)}</span>
            )}
          </div>
        </footer>
      </Panel>
  );
}
