import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

/* -------------------------------------------------------------------------
 * ClearWrite Mobile runtime core.
 * Deliberately independent from apps/web: no shared components, no shared CSS,
 * no shared design tokens. Only the Local Runtime HTTP contract is reused.
 * ---------------------------------------------------------------------- */

export type Lang = "zh" | "en";
export type ThemePref = "system" | "light" | "dark";
export type Route = { path: string; params: URLSearchParams };

const PREFIX = "igt.mobile.";

export const store = {
  read<T>(key: string, fallback: T): T {
    try {
      const raw = localStorage.getItem(PREFIX + key);
      return raw === null ? fallback : (JSON.parse(raw) as T);
    } catch { return fallback; }
  },
  write(key: string, value: unknown): void {
    try { localStorage.setItem(PREFIX + key, JSON.stringify(value)); } catch { /* session only */ }
  },
  remove(key: string): void {
    try { localStorage.removeItem(PREFIX + key); } catch { /* session only */ }
  },
};

/* ----------------------------- native bridge ---------------------------- */

type NativeBridge = {
  haptic(kind: string): void;
  speak(text: string): void;
  copy(text: string): void;
  share(text: string): void;
  sharedText(): string;
  paste(): string;
  locale(): string;
  theme(): string;
  setKeepScreenOn(on: boolean): void;
};

declare global {
  interface Window {
    IgtBridge?: NativeBridge;
    __igtInsets?: (top: number, right: number, bottom: number, left: number) => void;
    __igtTheme?: (mode: string) => void;
    __igtShared?: (text: string) => void;
    __igtBack?: () => boolean;
  }
}

export const native = {
  get available(): boolean { return typeof window !== "undefined" && Boolean(window.IgtBridge); },
  haptic(kind = "tap"): void {
    if (!store.read("haptics", true)) return;
    if (window.IgtBridge) {
      try { window.IgtBridge.haptic(kind); return; } catch { /* fall through */ }
    }
    try { navigator.vibrate?.(12); } catch { /* not supported */ }
  },
  async copy(text: string): Promise<void> {
    if (window.IgtBridge) {
      try { window.IgtBridge.copy(text); return; } catch { /* fall through */ }
    }
    try { await navigator.clipboard.writeText(text); } catch { /* not supported */ }
  },
  async share(text: string): Promise<void> {
    if (window.IgtBridge) {
      try { window.IgtBridge.share(text); return; } catch { /* fall through */ }
    }
    try {
      if (navigator.share) await navigator.share({ text });
      else await navigator.clipboard.writeText(text);
    } catch { /* user cancelled */ }
  },
  sharedText(): string {
    try { return window.IgtBridge?.sharedText?.() || ""; } catch { return ""; }
  },
  async paste(): Promise<string> {
    try {
      const value = window.IgtBridge?.paste?.();
      if (value) return value;
    } catch { /* fall through */ }
    try { return await navigator.clipboard.readText(); } catch { return ""; }
  },
  locale(): Lang {
    try {
      const value = window.IgtBridge?.locale?.();
      if (value === "zh" || value === "en") return value;
    } catch { /* fall through */ }
    return navigator.language.toLowerCase().startsWith("zh") ? "zh" : "en";
  },
  theme(): string {
    try {
      const value = window.IgtBridge?.theme?.();
      if (value === "dark" || value === "light") return value;
    } catch { /* fall through */ }
    return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  },
  setKeepScreenOn(on: boolean): void {
    try { window.IgtBridge?.setKeepScreenOn?.(on); } catch { /* not supported */ }
  },
  /* Offline-friendly speech: native Android TTS first, Local Runtime TTS second. */
  async speak(text: string): Promise<boolean> {
    if (!text.trim()) return false;
    if (window.IgtBridge) {
      try { window.IgtBridge.speak(text); return true; } catch { /* fall through */ }
    }
    try {
      const res = await fetch("/tts/speak", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) return false;
      const url = URL.createObjectURL(await res.blob());
      const audio = new Audio(url);
      audio.onended = () => URL.revokeObjectURL(url);
      audio.onerror = () => URL.revokeObjectURL(url);
      await audio.play();
      return true;
    } catch { return false; }
  },
};

/* -------------------------------- router -------------------------------- */

let navStack: string[] = [];
let suppressPush = false;
let routeListener: ((route: Route) => void) | null = null;

export function currentRoute(): Route {
  const raw = (location.hash || "").replace(/^#/, "") || "/home";
  const [path, query = ""] = raw.split("?");
  return { path: path || "/home", params: new URLSearchParams(query) };
}

export function go(path: string): void {
  location.hash = "#" + path;
}

export function back(): void {
  if (!window.__igtBack?.()) go("/home");
}

function installRouter(onChange: (route: Route) => void): () => void {
  routeListener = onChange;
  const handle = () => {
    const hash = location.hash || "#/home";
    if (suppressPush) suppressPush = false;
    else if (navStack[navStack.length - 1] !== hash) navStack.push(hash);
    routeListener?.(currentRoute());
  };
  window.addEventListener("hashchange", handle);
  navStack = [location.hash || "#/home"];
  window.__igtBack = () => {
    if (navStack.length <= 1) return false;
    navStack.pop();
    const target = navStack[navStack.length - 1];
    if ((location.hash || "#/home") !== target) {
      suppressPush = true;
      location.hash = target;
      setTimeout(() => { suppressPush = false; }, 100);
    }
    routeListener?.(currentRoute());
    return true;
  };
  handle();
  return () => {
    window.removeEventListener("hashchange", handle);
    routeListener = null;
  };
}

/* ------------------------------- context -------------------------------- */

export type Toast = { id: number; message: string; kind: "ok" | "err" };

type AppContextValue = {
  lang: Lang;
  setLang: (value: Lang) => void;
  theme: ThemePref;
  setTheme: (value: ThemePref) => void;
  t: (zh: string, en: string) => string;
  route: Route;
  go: (path: string) => void;
  back: () => void;
  toast: (message: string, kind?: "ok" | "err") => void;
  defaultProfile: string;
  setDefaultProfile: (id: string) => void;
};

const AppContext = createContext<AppContextValue>(null as unknown as AppContextValue);
export const useApp = (): AppContextValue => useContext(AppContext);

export function errorMessage(error: unknown): string {
  if (!error) return "";
  if (typeof error === "string") return error;
  if (error instanceof Error) return error.message;
  return String(error);
}

function updateThemeMeta(mode: string): void {
  document.querySelector('meta[name="theme-color"]')
    ?.setAttribute("content", mode === "dark" ? "#0F1626" : "#F6F8FB");
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => store.read<Lang>("lang", native.locale()));
  const [theme, setThemeState] = useState<ThemePref>(() => store.read<ThemePref>("theme", "system"));
  const [route, setRoute] = useState<Route>(() => currentRoute());
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [defaultProfile, setDefaultProfileState] = useState<string>(() => store.read("defaultProfile", ""));
  const themeRef = useRef(theme);
  themeRef.current = theme;

  const setLang = useCallback((value: Lang) => {
    setLangState(value);
    store.write("lang", value);
    document.documentElement.setAttribute("lang", value === "zh" ? "zh-CN" : "en");
  }, []);

  const setTheme = useCallback((value: ThemePref) => {
    setThemeState(value);
    store.write("theme", value);
  }, []);

  const setDefaultProfile = useCallback((id: string) => {
    setDefaultProfileState(id);
    store.write("defaultProfile", id);
  }, []);

  const toast = useCallback((message: string, kind: "ok" | "err" = "ok") => {
    const id = Date.now() + Math.random();
    setToasts((items) => [...items.slice(-2), { id, message, kind }]);
    setTimeout(() => setToasts((items) => items.filter((item) => item.id !== id)), 2800);
  }, []);

  useEffect(() => installRouter(setRoute), []);

  useEffect(() => {
    document.documentElement.setAttribute("lang", lang === "zh" ? "zh-CN" : "en");
  }, [lang]);

  useEffect(() => {
    const root = document.documentElement;
    const mode = theme === "system" ? native.theme() : theme;
    if (theme === "system") root.setAttribute("data-theme", mode);
    else root.setAttribute("data-theme", theme);
    updateThemeMeta(mode);
  }, [theme]);

  /* Native shell callbacks: insets, system dark mode, shared text, back handling. */
  useEffect(() => {
    window.__igtInsets = (top, right, bottom, left) => {
      const style = document.documentElement.style;
      style.setProperty("--inset-top", `${top}px`);
      style.setProperty("--inset-right", `${right}px`);
      style.setProperty("--inset-bottom", `${bottom}px`);
      style.setProperty("--inset-left", `${left}px`);
    };
    window.__igtTheme = (mode) => {
      if (themeRef.current !== "system" || (mode !== "dark" && mode !== "light")) return;
      document.documentElement.setAttribute("data-theme", mode);
      updateThemeMeta(mode);
    };
    window.__igtShared = (text) => {
      if (!text) return;
      store.write("draft.write", text);
      go("/write");
    };
    const pending = native.sharedText();
    if (pending) {
      store.write("draft.write", pending);
      setTimeout(() => go("/write"), 0);
    }
    return () => {
      delete window.__igtInsets;
      delete window.__igtTheme;
      delete window.__igtShared;
    };
  }, []);

  const t = useCallback((zh: string, en: string) => (lang === "zh" ? zh : en), [lang]);

  const value: AppContextValue = {
    lang, setLang, theme, setTheme, t, route, go, back, toast,
    defaultProfile, setDefaultProfile,
  };

  return <AppContext.Provider value={value}>
    {children}
    <div className="toast-stack" role="status" aria-live="polite">
      {toasts.map((item) => <div key={item.id} className={`toast toast--${item.kind}`}>{item.message}</div>)}
    </div>
  </AppContext.Provider>;
}

/* ------------------------------- hooks ---------------------------------- */

/** Auto-persisted text drafts. Protects against WebView reloads and lost connections. */
export function useDraft(key: string, initial = ""): [string, (value: string) => void, () => void] {
  const storageKey = "draft." + key;
  const [value, setValue] = useState(() => store.read(storageKey, initial));
  useEffect(() => { store.write(storageKey, value); }, [storageKey, value]);
  const clear = useCallback(() => { store.remove(storageKey); setValue(initial); }, [storageKey, initial]);
  return [value, setValue, clear];
}

/** Fetch with an in-memory + localStorage stale cache, so a dropped
 *  Local Runtime connection still shows the last known learning state. */
export function useResource<T>(
  cacheKey: string,
  fetcher: (signal: AbortSignal) => Promise<T>,
  deps: React.DependencyList,
  fallback: T,
) {
  const [data, setData] = useState<T>(() => store.read<T>("cache." + cacheKey, fallback));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [stale, setStale] = useState(false);
  const [nonce, setNonce] = useState(0);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  useEffect(() => {
    const controller = new AbortController();
    let alive = true;
    setLoading(true);
    setError("");
    fetcherRef.current(controller.signal).then((result) => {
      if (!alive) return;
      setData(result);
      setStale(false);
      setLoading(false);
      store.write("cache." + cacheKey, result);
    }).catch((reason: unknown) => {
      if (!alive || controller.signal.aborted) return;
      setError(errorMessage(reason));
      setStale(true);
      setLoading(false);
    });
    return () => { alive = false; controller.abort(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, nonce, cacheKey]);

  return {
    data, loading, error, stale,
    reload: () => setNonce((value) => value + 1),
    setData,
  };
}

/** Screens subscribe to the shell's pull-to-refresh gesture. */
export function useRefresh(handler: () => void): void {
  const ref = useRef(handler);
  ref.current = handler;
  useEffect(() => {
    const listener = () => ref.current();
    window.addEventListener("igt:refresh", listener);
    return () => window.removeEventListener("igt:refresh", listener);
  }, []);
}

/** Keep the soft keyboard from covering the primary action while typing. */
export function useImeState(): boolean {
  const [visible, setVisible] = useState(() => document.documentElement.getAttribute("data-igt-ime") === "true");
  useEffect(() => {
    const observer = new MutationObserver(() => {
      setVisible(document.documentElement.getAttribute("data-igt-ime") === "true");
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-igt-ime"] });
    return () => observer.disconnect();
  }, []);
  return visible;
}
