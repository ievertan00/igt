import { Icon } from "./Icon";
import { LearnerLanguageSwitch, useGuideCopy } from "./learner-language";

export const androidApp = /\bClearWriteAndroid\/[0-9]+\b/.test(navigator.userAgent);

const destinations = [
  { href: "#grammar", label: "Write", zh: "写作", icon: "grammar" },
  { href: "#word-lookup", label: "Words", zh: "词汇", icon: "word-lookup" },
  { href: "#practice", label: "Practice", zh: "练习", icon: "practice" },
  { href: "#ask", label: "Ask", zh: "问答", icon: "ask" },
  { href: "#dashboard", label: "Learning", zh: "学习", icon: "dashboard" },
] as const;

const writing = [["grammar", "Grammar"], ["translation", "Express"]] as const;
const vocabulary = [["word-lookup", "Look up"], ["word-review", "Review"], ["word-library", "Saved words"]] as const;

export function AndroidHeader({ settings }: { settings: boolean }) {
  const { t } = useGuideCopy();
  return <header className="android-header">
    <a href="#grammar" className="android-brand" aria-label={t("ClearWrite home")}>
      <span className="android-brand-mark"><Icon name="wand" /></span>
      ClearWrite
    </a>
    <div className="android-header-tools">
      {settings && <LearnerLanguageSwitch />}
      <a href="#settings" className="android-settings" aria-label={t("Model settings")}
        aria-current={settings ? "page" : undefined}>
        <Icon name="settings" />
      </a>
    </div>
  </header>;
}

export function AndroidSectionTabs({ route }: { route: string }) {
  const { t } = useGuideCopy();
  const section = writing.some(([key]) => route === key) ? writing
    : vocabulary.some(([key]) => route === key) ? vocabulary : null;
  if (!section) return null;
  return <nav className="android-section-tabs" aria-label={t(section === writing ? "Writing" : "Vocabulary")}>
    {section.map(([key, label]) => <a key={key} href={`#${key}`}
      aria-current={route === key ? "page" : undefined}>{t(label)}</a>)}
  </nav>;
}

export function AndroidDock({ route, learning }: { route: string; learning: boolean }) {
  const { t, language } = useGuideCopy();
  const active = writing.some(([key]) => route === key) ? "#grammar"
    : vocabulary.some(([key]) => route === key) ? "#word-lookup"
    : learning ? "#dashboard" : `#${route}`;
  return <nav className="android-dock" aria-label={t("Main navigation")}>
    <div className="android-dock-inner">
      {destinations.map(({ href, label, zh, icon }) => <a key={href} href={href}
        aria-current={active === href ? "true" : undefined}>
        <span className="android-dock-icon"><Icon name={icon} /></span>
        <span>{language === "zh-CN" ? zh : label}</span>
      </a>)}
    </div>
  </nav>;
}
