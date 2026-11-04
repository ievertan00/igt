import { createContext, useCallback, useContext, useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { webApi } from "./api/client";
import { useGuideCopy } from "./learner-language";
import "./ModelSettings.css";
import { Icon } from "./Icon";

export type ModelProfile = {
  id: string; name: string; provider: string; baseUrl: string;
  models: { flash: string; pro: string }; keyConfigured: boolean; keyMasked: string;
};
export type ModelSettings = {
  provider: string; providers: Record<string, Omit<ModelProfile, "id" | "name" | "provider">>;
  profiles: ModelProfile[]; activeProfileId: string;
};

const ModelContext = createContext<{
  settings?: ModelSettings; error: string; switching: boolean;
  refresh: () => Promise<void>; update: (settings: ModelSettings) => void;
  activate: (id: string) => Promise<void>;
} | null>(null);

export function ModelSettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<ModelSettings>();
  const [error, setError] = useState("");
  const [switching, setSwitching] = useState(false);
  const revision = useRef(0);
  const pending = useRef(false);
  const update = useCallback((value: ModelSettings) => {
    revision.current++;
    setSettings(value);
    setError("");
  }, []);
  const refresh = useCallback(async () => {
    const request = ++revision.current;
    try {
      const value = await webApi.getLlmSettings();
      if (request !== revision.current) return;
      if (!value?.providers || !Array.isArray(value.profiles)) throw new Error("Model settings are unavailable. Restart IGT and try again.");
      setSettings(value);
      setError("");
    } catch (e: any) {
      if (request === revision.current) setError(e.message || "Could not load model settings");
    }
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);
  async function activate(id: string) {
    if (pending.current) return;
    pending.current = true;
    revision.current++;
    setSwitching(true);
    setError("");
    try {
      update(await webApi.saveLlmSettings({ action: "activate", profileId: id }));
    } catch (e: any) {
      setError(e.message || "Could not switch models");
    } finally {
      pending.current = false;
      setSwitching(false);
    }
  }
  return <ModelContext.Provider value={{ settings, error, switching, refresh, update, activate }}>{children}</ModelContext.Provider>;
}

export function useModelSettings() {
  const context = useContext(ModelContext);
  if (!context) throw new Error("ModelSettingsProvider is required");
  return context;
}

export function ModelSwitcher({ role = "flash", disabled = false, id = "workspace-model" }: { role?: "flash" | "pro"; disabled?: boolean; id?: string }) {
  const { t } = useGuideCopy();
  const { settings, switching, error, activate, refresh } = useModelSettings();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ left: 0, top: 0 });
  const restoreFocus = useRef(false);
  useEffect(() => {
    if (switching || !restoreFocus.current) return;
    if (document.activeElement === document.body) triggerRef.current?.focus();
    restoreFocus.current = false;
  }, [switching]);
  const active = settings?.profiles.find(p => p.id === settings.activeProfileId);
  const model = active?.models[role] || settings?.providers[settings.provider]?.models[role];
  const unavailable = !settings || switching || disabled;
  useEffect(() => { if (unavailable) setOpen(false); }, [unavailable]);
  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const trigger = triggerRef.current?.getBoundingClientRect();
      const menu = menuRef.current;
      if (!trigger || !menu) return;
      const viewportWidth = Math.min(window.innerWidth, document.documentElement.getBoundingClientRect().width);
      menu.style.maxWidth = `${Math.max(0, viewportWidth - 24)}px`;
      const height = menu.getBoundingClientRect().height;
      const above = trigger.top - height - 8;
      setPosition({
        left: Math.max(12, Math.min(trigger.left, viewportWidth - menu.offsetWidth - 12)),
        top: Math.max(12, Math.min(above >= 12 ? above : trigger.bottom + 8, window.innerHeight - height - 12)),
      });
    };
    place();
    const selected = menuRef.current?.querySelector<HTMLElement>('[aria-checked="true"]');
    (selected || menuRef.current?.querySelector<HTMLElement>('[role^="menuitem"]'))?.focus();
    const outside = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node) && !triggerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const close = () => setOpen(false);
    const dialog = triggerRef.current?.closest("dialog");
    document.addEventListener("pointerdown", outside);
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    window.addEventListener("hashchange", close);
    dialog?.addEventListener("close", close);
    return () => {
      document.removeEventListener("pointerdown", outside);
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("hashchange", close);
      dialog?.removeEventListener("close", close);
    };
  }, [open]);
  function closeMenu() { setOpen(false); triggerRef.current?.focus(); }
  function navigate(event: KeyboardEvent<HTMLDivElement>) {
    const items = Array.from(menuRef.current?.querySelectorAll<HTMLElement>('[role^="menuitem"]') || []);
    const current = items.indexOf(document.activeElement as HTMLElement);
    if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
      event.preventDefault();
      const next = event.key === "Home" ? 0 : event.key === "End" ? items.length - 1 : (current + (event.key === "ArrowDown" ? 1 : -1) + items.length) % items.length;
      items[next]?.focus();
    } else if (event.key === "Escape") { event.preventDefault(); closeMenu(); }
    else if (event.key === "Tab") { closeMenu(); }
    else if (event.key.length === 1 && /\S/.test(event.key) && !event.ctrlKey && !event.metaKey && !event.altKey) {
      const next = [...items.slice(current + 1), ...items.slice(0, current + 1)].find(item => item.textContent?.trim().toLowerCase().startsWith(event.key.toLowerCase()));
      if (next) { event.preventDefault(); next.focus(); }
    }
  }
  return <div className="model-control">
    <button ref={triggerRef} type="button" id={id} className="model-switcher" aria-busy={switching}
      aria-label={`${t("Switch model configuration")}: ${model || t("Loading models…")}`}
      aria-haspopup="menu" aria-expanded={open} aria-controls={open ? menuId : undefined}
      title={switching ? t("Switching model…") : model || t("Loading models…")}
      value={settings?.activeProfileId || ""} disabled={unavailable}
      onClick={() => setOpen(!open)}
      onKeyDown={event => { if (event.key === "ArrowDown" || event.key === "ArrowUp") { event.preventDefault(); setOpen(true); } }}>
      {switching ? <span className="loading-spinner" aria-hidden="true" /> : <Icon name="spark" />}
      <span className="model-switcher-name">{model || (settings ? t("Current setup") : t("Loading models…"))}</span>
      <Icon name="chevron" />
    </button>
    {open && createPortal(<div ref={menuRef} id={menuId} className="model-menu" role="menu" aria-label={t("Saved models")}
      style={position} onKeyDown={navigate} onBlur={event => {
        if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget as Node)) setOpen(false);
      }}>
      <div className="model-menu-options" role="group" aria-label={t("Saved models")}>
        {settings?.profiles.map(profile => <button key={profile.id} type="button" role="menuitemradio" tabIndex={-1}
          aria-checked={profile.id === settings.activeProfileId} data-profile-id={profile.id}
          className="model-menu-option" onClick={() => {
            closeMenu();
            if (profile.id !== settings.activeProfileId) { restoreFocus.current = true; void activate(profile.id); }
          }}>
          <span className="model-menu-check">{profile.id === settings.activeProfileId && <Icon name="check" />}</span>
          <span className="model-menu-copy"><span>{profile.models[role]}</span><small>{profile.name}</small></span>
        </button>)}
      </div>
      <a className="model-menu-settings" href="#settings" role="menuitem" tabIndex={-1} onClick={() => setOpen(false)}>
        <Icon name="settings" /><span>{t("Model settings")}</span><Icon name="arrow" />
      </a>
    </div>, triggerRef.current?.closest("dialog") || document.body)}
    <span className="sr-only" role="status">{switching ? t("Switching model…") : model}</span>
    {error && <div className="model-switch-error" role="alert">{error} <button type="button" className="secondary" onClick={() => void refresh()}>{t("Retry")}</button></div>}
  </div>;
}
