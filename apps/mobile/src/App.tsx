import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { go, useApp } from "./core";
import { Icon } from "./ui";
import { HomeScreen } from "./screens/Home";
import { WritingScreen } from "./screens/Writing";
import { WordsScreen, ReviewSession } from "./screens/Words";
import { PracticeScreen } from "./screens/Practice";
import { AskScreen } from "./screens/Ask";
import { MeScreen, OverviewScreen, HandbookScreen, CoachScreen, NotesScreen } from "./screens/Me";
import { SettingsScreen } from "./screens/Settings";

type NavItem = { path: string; icon: string; zh: string; en: string; fab?: boolean };

const NAV: NavItem[] = [
  { path: "/home", icon: "home", zh: "今天", en: "Today" },
  { path: "/ask", icon: "sparkles", zh: "提问", en: "Ask" },
  { path: "/write", icon: "pen", zh: "写作", en: "Write", fab: true },
  { path: "/words", icon: "book", zh: "词汇", en: "Words" },
  { path: "/practice", icon: "target", zh: "练习", en: "Practice" },
];

const TITLES: Record<string, [string, string]> = {
  "/home": ["今天", "Today"],
  "/write": ["写作", "Writing"],
  "/words": ["词汇", "Vocabulary"],
  "/practice": ["句子练习", "Sentence practice"],
  "/ask": ["问一句", "Ask anything"],
  "/me": ["我的", "My learning"],
  "/settings": ["设置", "Settings"],
  "/review": ["单词复习", "Word review"],
};

function screenFor(path: string): React.ReactNode {
  switch (path) {
    case "/home": return <HomeScreen />;
    case "/write": return <WritingScreen />;
    case "/practice": return <PracticeScreen />;
    case "/ask": return <AskScreen />;
    case "/review": return <ReviewSession />;
    case "/me": return <MeScreen />;
    case "/me/overview": return <OverviewScreen />;
    case "/me/handbook": return <HandbookScreen />;
    case "/me/coach": return <CoachScreen />;
    case "/me/notes": return <NotesScreen />;
    case "/settings": return <SettingsScreen />;
    default: return <HomeScreen />;
  }
}

export function App() {
  const { route, t, lang, back } = useApp();
  const screenRef = useRef<HTMLDivElement>(null);
  const backButtonRef = useRef<HTMLButtonElement>(null);
  const wordListReturn = useRef<{ scrollTop: number; trigger: HTMLButtonElement } | null>(null);
  const pullStart = useRef(-1);
  const [pull, setPull] = useState(0);

  const root = "/" + (route.path.split("/")[1] || "home");
  const wordCard = route.path === "/words" && route.params.get("view") === "card";
  const wordLookup = route.path === "/words" && route.params.get("tab") === "lookup";
  const immersive = wordCard || route.path === "/ask" || route.path === "/review" || route.params.get("immersive") === "1";
  const isSub = immersive || wordLookup || route.path === "/settings" || route.path.split("/").length > 2;
  const hideNav = immersive;
  const title = wordCard ? ["单词卡片", "Word cards"] : wordLookup ? ["查词", "Look up"]
    : TITLES[route.path] || TITLES[root] || ["ClearWrite", "ClearWrite"];
  const activeNav = route.path === "/review" ? "/words" : root === "/me" ? "" : root;

  useLayoutEffect(() => {
    const returnPoint = route.path === "/words" && !wordLookup && !wordCard ? wordListReturn.current : null;
    screenRef.current?.scrollTo(0, returnPoint?.scrollTop ?? 0);
    if (returnPoint) {
      returnPoint.trigger.focus({ preventScroll: true });
      wordListReturn.current = null;
    } else if (wordCard) {
      backButtonRef.current?.focus({ preventScroll: true });
    } else {
      wordListReturn.current = null;
    }
  }, [route.path, route.params.toString(), wordLookup, wordCard]);

  useEffect(() => {
    document.title = `ClearWrite · ${lang === "zh" ? title[0] : title[1]}`;
  }, [route.path, route.params.toString(), lang]); // eslint-disable-line react-hooks/exhaustive-deps

  function openWordCard(trigger: HTMLButtonElement) {
    wordListReturn.current = { scrollTop: screenRef.current?.scrollTop ?? 0, trigger };
    go("/words?view=card");
  }

  const onTouchStart = (event: React.TouchEvent) => {
    pullStart.current = (screenRef.current?.scrollTop ?? 0) <= 0 ? event.touches[0].clientY : -1;
  };
  const onTouchMove = (event: React.TouchEvent) => {
    if (pullStart.current < 0) return;
    const distance = event.touches[0].clientY - pullStart.current;
    if (distance > 0) setPull(Math.min(76, distance * 0.45));
  };
  const onTouchEnd = () => {
    if (pull > 46) window.dispatchEvent(new Event("igt:refresh"));
    setPull(0);
    pullStart.current = -1;
  };

  return <div className={`app${hideNav ? " app--no-nav" : ""}`}>
    <header className="appbar">
      {isSub && <button ref={backButtonRef} type="button" className="icon-button" onClick={wordCard || wordLookup ? () => {
        if (!window.__igtBack?.()) go("/words");
      } : back} aria-label={t("返回", "Back")}>
        <Icon name="back" />
      </button>}
      <div className="appbar-title">
        {root === "/home" && !isSub ? <div className="brand-row">
          <span className="brand-mark"><Icon name="wand" size={21} /></span>
          <div><h1>ClearWrite</h1>
            <div className="brand-sub">{new Date().toLocaleDateString(lang === "zh" ? "zh-CN" : "en", { month: "long", day: "numeric", weekday: "long" })}</div>
          </div>
        </div> : <><h1>{lang === "zh" ? title[0] : title[1]}</h1></>}
      </div>
      <div className="appbar-actions">
        {!isSub && <button type="button" className={`icon-button ${root === "/me" ? "icon-button--primary" : "icon-button--soft"}`} onClick={() => go("/me")}
          aria-current={root === "/me" ? "page" : undefined}
          aria-label={t("我的学习", "My learning")}><Icon name="user" size={20} /></button>}
        {isSub && root !== "/settings" && <button type="button" className="icon-button" onClick={() => go("/settings")}
          aria-label={t("设置", "Settings")}><Icon name="settings" size={20} /></button>}
      </div>
    </header>

    <main className="screen" ref={screenRef} onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
      {pull > 0 && <div className="pull-indicator" style={{ height: pull }}>
        <Icon name={pull > 46 ? "refresh" : "down"} size={18} />
        <span>{pull > 46 ? t("松开刷新", "Release to refresh") : t("下拉刷新", "Pull to refresh")}</span>
      </div>}
      <React.Fragment key={route.path}>
        {route.path === "/words" ? <WordsScreen onOpenCard={openWordCard} /> : screenFor(route.path)}
      </React.Fragment>
    </main>

    <nav className="bottom-nav" aria-label={t("主导航", "Main navigation")}>
      {NAV.map((item) => {
        const active = activeNav === item.path;
        return <button key={item.path} type="button"
          className={`nav-item${active ? " is-active" : ""}`}
          aria-current={active ? "page" : undefined}
          onClick={() => { go(item.path); }}>
          {item.fab ? <span className="nav-fab"><Icon name={item.icon} size={23} /></span>
            : <span className="nav-icon"><Icon name={item.icon} size={21} /></span>}
          <span>{lang === "zh" ? item.zh : item.en}</span>
        </button>;
      })}
    </nav>
  </div>;
}
