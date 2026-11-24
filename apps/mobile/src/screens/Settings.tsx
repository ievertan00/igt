import React, { useState } from "react";
import { api } from "../api";
import { errorMessage, native, store, useApp, useResource } from "../core";
import { Badge, Busy, Button, Card, Chip, ErrorNote, Icon, Input, SectionTitle, Sheet } from "../ui";

const MODEL_PAGES: Array<[string, string, string]> = [
  ["grammar", "语法检查", "Refine"],
  ["translation", "表达转换", "Express"],
  ["word-lookup", "查词", "Look up"],
  ["practice", "练习", "Practice"],
  ["coach", "学习教练", "Coach"],
  ["ask", "问答", "Ask"],
];

export function SettingsScreen() {
  const { t, lang, setLang, theme, setTheme, toast, defaultProfile, setDefaultProfile } = useApp();
  const [modelSheet, setModelSheet] = useState(false);
  const [testing, setTesting] = useState(false);
  const [haptics, setHaptics] = useState(() => store.read("haptics", true));
  const [keepAwake, setKeepAwake] = useState(() => store.read("keepAwake", false));
  const [pageModels, setPageModels] = useState<Record<string, string>>(() => store.read("pageModels", {}));

  const { data, loading, error, reload } = useResource<any>("settings.v1", async () => {
    const [llm, files, runtime] = await Promise.all([
      api.llmSettings().catch(() => null),
      api.fileSettings().catch(() => null),
      api.runtime().catch(() => null),
    ]);
    return { llm, files, runtime };
  }, [], { llm: null, files: null, runtime: null });

  const profiles: any[] = data.llm?.profiles || [];
  const activeId = defaultProfile || data.llm?.activeProfileId || "";

  function chooseProfile(id: string) {
    setDefaultProfile(id);
    native.haptic("ok");
    toast(t("已设为默认模型", "Default model updated"));
  }

  function choosePageModel(page: string, id: string) {
    const next = { ...pageModels, [page]: id };
    setPageModels(next);
    store.write("pageModels", next);
    try {
      const merged = { ...JSON.parse(localStorage.getItem("clearwrite.page-models") || "{}"), [page]: id };
      localStorage.setItem("clearwrite.page-models", JSON.stringify(merged));
    } catch { /* session only */ }
  }

  async function testConnection() {
    const profile = profiles.find((item) => item.id === activeId) || profiles[0];
    if (!profile) { toast(t("没有可用的模型配置", "No model profile available"), "err"); return; }
    setTesting(true);
    try {
      await api.testLlmConnection({ baseUrl: profile.baseUrl, model: profile.models?.flash || profile.models?.pro, profileId: profile.id });
      toast(t("连接成功", "Connection successful"));
      native.haptic("ok");
    } catch (reason) { toast(errorMessage(reason), "err"); }
    finally { setTesting(false); }
  }

  return <div className="stack">
    <Card>
      <p className="card-kicker">{t("界面语言", "LANGUAGE")}</p>
      <div className="chip-row" style={{ marginTop: 8 }}>
        <Chip selected={lang === "zh"} onClick={() => setLang("zh")}>简体中文</Chip>
        <Chip selected={lang === "en"} onClick={() => setLang("en")}>English</Chip>
      </div>
      <div className="divider" />
      <p className="card-kicker">{t("主题", "THEME")}</p>
      <div className="chip-row" style={{ marginTop: 8 }}>
        <Chip icon="sun" selected={theme === "system"} onClick={() => setTheme("system")}>{t("跟随系统", "System")}</Chip>
        <Chip icon="sun" selected={theme === "light"} onClick={() => setTheme("light")}>{t("浅色", "Light")}</Chip>
        <Chip icon="moon" selected={theme === "dark"} onClick={() => setTheme("dark")}>{t("深色", "Dark")}</Chip>
      </div>
    </Card>

    <Card>
      <p className="card-kicker">{t("移动端体验", "MOBILE EXPERIENCE")}</p>
      <div className="kv"><strong>{t("触觉反馈", "Haptics")}</strong>
        <span><Chip selected={haptics} onClick={() => { const next = !haptics; setHaptics(next); store.write("haptics", next); native.haptic("ok"); }}>
          {haptics ? t("已开启", "On") : t("已关闭", "Off")}</Chip></span></div>
      <div className="kv"><strong>{t("屏幕常亮", "Keep awake")}</strong>
        <span><Chip selected={keepAwake} onClick={() => {
          const next = !keepAwake; setKeepAwake(next); store.write("keepAwake", next); native.setKeepScreenOn(next);
        }}>{keepAwake ? t("已开启", "On") : t("已关闭", "Off")}</Chip></span></div>
      <p className="card-note">{t("草稿、模型选择和界面偏好都保存在本机。", "Drafts, model choices and preferences stay on this device.")}</p>
    </Card>

    <div>
      <SectionTitle title={t("模型", "Model")} kicker={t("与桌面端共用", "SHARED WITH DESKTOP")} />
      {loading && !data.llm ? <Card><Busy /></Card> : error ? <ErrorNote message={error} onRetry={reload} retryLabel={t("重试", "Retry")} /> :
        <Card>
          <p className="card-kicker">{t("默认配置", "DEFAULT PROFILE")}</p>
          {profiles.length === 0 ? <p className="card-note">{t("没有已保存的模型配置", "No saved model profiles")}</p> :
            profiles.map((profile) => <button key={profile.id} type="button" className="list-row" onClick={() => chooseProfile(profile.id)}>
              <span className="list-row-icon list-row-icon--primary"><Icon name="sparkles" size={19} /></span>
              <span className="list-row-text"><strong>{profile.name}</strong>
                <small>{profile.provider} · {profile.models?.flash || "—"}</small></span>
              {activeId === profile.id ? <Badge tone="primary">{t("使用中", "Active")}</Badge> : null}
            </button>)}
          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            <Button variant="secondary" icon="settings" onClick={() => setModelSheet(true)}>{t("按页面指定", "Per page")}</Button>
            <Button variant="soft" icon="offline" onClick={testConnection} loading={testing}>{t("测试连接", "Test")}</Button>
          </div>
        </Card>}
    </div>

    <div>
      <SectionTitle title={t("本机运行环境", "LOCAL RUNTIME")} />
      <Card>
        <div className="kv"><strong>{t("运行模式", "Runtime")}</strong><span>{data.runtime?.runtime || "local"}</span></div>
        <div className="kv"><strong>{t("数据库", "Database")}</strong><span>{data.runtime?.storage?.database || "sqlite"}</span></div>
        <div className="kv"><strong>{t("学习资料", "Assets")}</strong><span>{data.runtime?.storage?.assets || "markdown"}</span></div>
        <div className="divider" />
        <p className="card-kicker">{t("电脑上的文件路径", "PATHS ON YOUR COMPUTER")}</p>
        {Object.entries(data.files?.paths || {}).map(([key, value]) => <div key={key} className="kv">
          <strong>{key}</strong><span className="mono break" style={{ fontSize: 11.5 }}>{String(value)}</span>
        </div>)}
        {!data.files && <p className="card-note">{t("文件路径暂不可用", "File paths unavailable")}</p>}
      </Card>
    </div>

    <Card className="connection-card">
      <p className="card-kicker">{t("连接不上时", "IF THE CONNECTION DROPS")}</p>
      <ol>
        <li>{t("在电脑上启动 ClearWrite Local Runtime。", "Start the ClearWrite Local Runtime on your computer.")}</li>
        <li>{t("用 USB 连接手机并开启 USB 调试。", "Connect your phone over USB with debugging enabled.")}</li>
        <li className="break">{t("在电脑执行 ", "On your computer run ")}<span className="code-inline">adb reverse tcp:5173 tcp:&lt;端口&gt;</span></li>
        <li>{t("回到 App 点「重试」。", "Return to the app and tap Retry.")}</li>
      </ol>
      <p className="card-note">{t("端口显示在电脑启动日志的 Ready on 一行。", "The port is printed on the Ready on line of the runtime log.")}</p>
    </Card>

    <Card className="card--tint">
      <div style={{ display: "flex", gap: 10 }}>
        <Icon name="info" size={20} />
        <div><p className="card-kicker">ClearWrite mobile</p>
          <p style={{ margin: 0, fontSize: 13 }}>{t("独立移动端界面，通过本机 WebView 与 Local Runtime 通信；学习记录与桌面端共用同一份数据。",
            "A standalone mobile interface running inside the native WebView. Learning records are shared with the desktop workspace.")}</p></div>
      </div>
    </Card>

    <Sheet open={modelSheet} onClose={() => setModelSheet(false)} title={t("按页面指定模型", "Model per feature")}
      footer={<Button onClick={() => setModelSheet(false)} block>{t("完成", "Done")}</Button>}>
      {MODEL_PAGES.map(([page, zh, en]) => <div key={page} style={{ marginBottom: 14 }}>
        <p className="eyebrow">{lang === "zh" ? zh : en}</p>
        <div className="chip-row" style={{ flexWrap: "wrap", marginTop: 6 }}>
          <Chip selected={!pageModels[page]} onClick={() => choosePageModel(page, "")}>{t("跟随默认", "Default")}</Chip>
          {profiles.map((profile) => <Chip key={profile.id} selected={pageModels[page] === profile.id}
            onClick={() => choosePageModel(page, profile.id)}>{profile.name}</Chip>)}
        </div>
      </div>)}
    </Sheet>
    <div className="hero-space" />
  </div>;
}
