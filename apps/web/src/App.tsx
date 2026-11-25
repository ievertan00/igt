import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { Practice } from "./pages/Practice";
import { Coach, PracticeLog } from "./pages/LearningPages";
import { Dashboard } from "./pages/LearningDashboard";
import { MyLearningNavigation, myLearningRoutes } from "./pages/MyLearning";
import { useGuideCopy, LearnerLanguageSwitch, GuideText } from "./components/learner-language";
import { Icon } from "./components/Icon";
import { Ask } from "./pages/Ask";
import { SelectionLookup } from "./pages/SelectionLookup";
import { webApi } from "./api/client";
import { VocabularyLibrary } from "./pages/VocabularyLibrary";
import { PageScrollControls } from "./components/PageScrollControls";
import { WordDetails } from "./components/WordDetails";
import { androidApp, AndroidDock, AndroidHeader, AndroidSectionTabs } from "./pages/AndroidWorkspace";
import { Grammar } from "./pages/Grammar";
import { Express } from "./pages/Express";
import { WordReview } from "./pages/WordReview";
import { WordLookup } from "./pages/WordLookup";
import { Handbook } from "./pages/Handbook";
import { LlmSettings } from "./pages/LlmSettings";
type Route =
  | "dashboard"
  | "grammar"
  | "translation"
  | "word-lookup"
  | "word-review"
  | "word-library"
  | "practice"
  | "ask"
  | "handbook"
  | "coach"
  | "settings";
const items: Array<[Route, string]> = [
  ["grammar", "Refine"],
  ["translation", "Express"],
  ["word-lookup", "Vocabulary"],
  ["word-review", "Review"],
  ["word-library", "Saved words"],
  ["practice", "Practice"],
  ["ask", "Ask"],
  ["handbook", "Handbook"],
  ["coach", "Learning reports"],
  ["settings", "Model settings"],
];
const primaryRoutes = ["word-lookup", "practice", "ask"] as const satisfies readonly Route[];
const primaryNavIcons: Record<(typeof primaryRoutes)[number], "word-lookup" | "practice" | "ask"> = {
  "word-lookup": "word-lookup",
  practice: "practice",
  ask: "ask",
};
const navigationGroups: Array<{ label: string; routes: Array<[Route, string]> }> = [
  {
    label: "Writing",
    routes: [
      ["grammar", "Refine"],
      ["translation", "Express"],
    ],
  },
];
function currentRoute(): Route {
  const hash = location.hash.slice(1).split("?")[0];
  return hash === "dashboard" || items.some(([key]) => key === hash) ? (hash as Route) : "grammar";
}
export function App() {
  const { t } = useGuideCopy();
  const [menuOpen, setMenuOpen] = useState(false);
  const [route, setRoute] = useState<Route>(currentRoute);
  const [routeHash, setRouteHash] = useState(location.hash);
  const [statusMsg, setStatusMsg] = useState("");
  const navRef = useRef<HTMLElement>(null);
  const mainRef = useRef<HTMLElement>(null);
  const menuRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    webApi
      .getStatusMessage()
      .then((m) => setStatusMsg(m.content))
      .catch(() => {});
  }, []);
  useEffect(() => {
    const onHash = () => {
      if (location.hash === "#main-content") return;
      setRoute(currentRoute());
      setRouteHash(location.hash);
      setMenuOpen(false);
      navRef.current?.querySelectorAll("details").forEach((menu) => {
        menu.open = false;
      });
      mainRef.current?.focus();
      window.scrollTo(0, 0);
    };
    const dismiss = (event: PointerEvent) => {
      if (!navRef.current?.contains(event.target as Node)) {
        navRef.current?.querySelectorAll("details").forEach((menu) => {
          menu.open = false;
        });
      }
    };
    addEventListener("hashchange", onHash);
    addEventListener("pointerdown", dismiss);
    return () => {
      removeEventListener("hashchange", onHash);
      removeEventListener("pointerdown", dismiss);
    };
  }, []);
  const askView = new URLSearchParams(routeHash.split("?")[1]).get("view") === "notes" ? "notes" : "ask";
  const isMyLearning = route === "word-review" || myLearningRoutes.some(([key]) => key === route && (key !== "ask" || askView === "notes"));
  const practiceLogView = route === "dashboard" && new URLSearchParams(routeHash.split("?")[1]).get("view") === "practice-log";
  const hasScrollNavigation = route === "word-library" || route === "coach" || route === "handbook" || (route === "ask" && askView === "notes");
  const title =
    practiceLogView ? "Practice log" : route === "ask" && askView === "notes" ? "Saved notes" : route === "dashboard" ? "Overview" : items.find(([key]) => key === route)?.[1] || "Refine";
  useEffect(() => {
    document.title = title + " · ClearWrite";
  }, [title]);
  const askVisited = useRef(route === "ask");
  if (route === "ask") askVisited.current = true;
  const pages: Record<Route, ReactNode> = {
    grammar: <Grammar />,
    dashboard: practiceLogView ? <PracticeLog /> : <Dashboard />,
    translation: <Express />,
    ask: null,
    "word-review": <WordReview />,
    "word-library": <VocabularyLibrary renderDetails={entry => <WordDetails entry={entry} examples={[entry.example, entry.example2, entry.example3].filter(Boolean)} />} />,
    "word-lookup": <WordLookup />,
    coach: <Coach />,
    practice: <Practice key={routeHash} />,
    handbook: <Handbook />,
    settings: <LlmSettings fromCli={new URLSearchParams(routeHash.split("?")[1]).get("client") === "cli"} />,
  };
  return (
    <div className={`shell${androidApp ? " android-workspace" : ""}${route === "grammar" ? " writing-shell" : ""}${hasScrollNavigation ? " has-scroll-navigation" : ""}${isMyLearning ? " my-learning-shell" : ""}`}>
      <a className="skip-link" href="#main-content">
        {t("Skip to content")}
      </a>
      {androidApp ? <AndroidHeader settings={route === "settings"} /> : <header
        className="topbar"
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            const openMenu = navRef.current?.querySelector<HTMLDetailsElement>("details[open]");
            if (openMenu) {
              openMenu.open = false;
              openMenu.querySelector("summary")?.focus();
            } else if (menuOpen) {
              setMenuOpen(false);
              menuRef.current?.focus();
            }
          }
        }}
      >
        <a className="brand" href="#grammar" aria-label={t("ClearWrite home")}>
          <span className="brand-mark">
            <Icon name="wand" />
          </span>
          <span className="brand-wordmark">ClearWrite</span>
        </a>
        <button
          ref={menuRef}
          className="menu-toggle"
          aria-label={menuOpen ? t("Close navigation") : t("Open navigation")}
          aria-expanded={menuOpen}
          aria-controls="workspace-nav"
          onClick={() => setMenuOpen(!menuOpen)}
        >
          <Icon name={menuOpen ? "close" : "menu"} />
          <GuideText text="Menu" />
        </button>
        <nav
          ref={navRef}
          id="workspace-nav"
          aria-label={t("Main navigation")}
          className={menuOpen ? "top-nav is-open" : "top-nav"}
          onClick={(event) => {
            if ((event.target as Element).closest("a")) {
              navRef.current?.querySelectorAll("details").forEach((menu) => {
                menu.open = false;
              });
              setMenuOpen(false);
            }
          }}
        >
          <div className="nav-primary">
          {navigationGroups.map((group) => (
            <details key={group.label} className="learning-menu" name="workspace-navigation">
              <summary className={group.routes.some(([key]) => key === route) ? "active" : ""}>
                <Icon name="grammar" className="nav-item-icon" />
                {group.label}
                <Icon name="chevron" />
              </summary>
              <div className="learning-links">
                {group.routes.map(([key, label]) => (
                  <a key={key} href={"#" + key} aria-current={route === key ? "page" : undefined}>
                    <Icon name={key} />
                    {label}
                  </a>
                ))}
              </div>
            </details>
          ))}
          {primaryRoutes.map((key) => (
              <a
                href={"#" + key}
                key={key}
                className={route === key && !(key === "ask" && askView === "notes") ? "nav-link active" : "nav-link"}
                aria-current={route === key && !(key === "ask" && askView === "notes") ? "page" : undefined}
              >
                <Icon name={primaryNavIcons[key]} className="nav-item-icon" />
                {items.find(([itemKey]) => itemKey === key)?.[1]}
              </a>
            ))}
          </div>
          <div className="nav-tools">
            <a
              className={isMyLearning ? "nav-link my-learning-link active" : "nav-link my-learning-link"}
              href="#dashboard"
              aria-current={isMyLearning ? "page" : undefined}
            >
              <Icon name="dashboard" className="nav-item-icon" />
              My learning
            </a>
            <div className="nav-utility">
              <a
                className="settings-link"
                href="#settings"
                aria-label={t("Model settings")}
                aria-current={route === "settings" ? "page" : undefined}
              >
                <Icon name="settings" />
                <span>Settings</span>
              </a>
              <LearnerLanguageSwitch />
            </div>
          </div>
        </nav>
      </header>}
      {androidApp && <AndroidSectionTabs route={route} />}
      {isMyLearning && (!androidApp || (route !== "word-library" && route !== "word-review")) && <MyLearningNavigation route={route} />}
      <main
        ref={mainRef}
        id="main-content"
        tabIndex={-1}
        aria-label={isMyLearning ? t(title) : undefined}
        className={`workspace workspace-${route}${route === "grammar" ? " grammar-workspace" : ""}${isMyLearning ? " my-learning-workspace" : ""}`}
      >
        {pages[route]}
        <div hidden={route !== "ask"}>{askVisited.current && <Ask active={route === "ask"} view={askView} />}</div>
      </main>
      {hasScrollNavigation && <PageScrollControls key={`scroll-${routeHash}`} />}
      <SelectionLookup key={routeHash} renderLookup={(text) => <WordLookup initialQuery={text} compact />} />
      {(!androidApp || statusMsg) && <footer className="site-footer">
        {!androidApp && <span className="site-footer-motto">A tool for practice. Keep reading, listening, and using English beyond it.</span>}
        {statusMsg && (
          <span className="site-footer-status" role="status">
            {statusMsg}
          </span>
        )}
      </footer>}
      {androidApp && <AndroidDock route={route} learning={isMyLearning} />}
    </div>
  );
}
