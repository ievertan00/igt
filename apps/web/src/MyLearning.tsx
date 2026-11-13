import { Fragment, useLayoutEffect, useRef, type KeyboardEvent } from 'react';
import { useGuideCopy } from './learner-language';
import { Icon } from './Icon';
import './MyLearning.css';

export const myLearningRoutes = [
  ['dashboard', 'Overview', 'dashboard', '#dashboard'],
  ['word-library', 'Saved words', 'bookmark', '#word-library'],
  ['ask', 'Saved notes', 'document', '#ask?view=notes'],
  ['handbook', 'Handbook', 'handbook', '#handbook'],
  ['coach', 'Learning reports', 'trend', '#coach'],
] as const;

/* Overview / Library / Insight: a divider opens each group so the tabs read as three places, not five. */
const groupStarts = new Set<string>(['word-library', 'coach']);

export function MyLearningNavigation({ route }: { route: string }) {
  const { t, language } = useGuideCopy();
  const current = route === 'word-review' ? 'word-library' : route;
  const tabsRef = useRef<HTMLElement>(null);
  // A compact track can clip the active label on narrow screens when a sub-page is opened directly.
  // Only the track scrolls: scrollIntoView would also move the whole page, which the reader may have scrolled.
  useLayoutEffect(() => {
    const track = tabsRef.current;
    if (!track) return;
    const reveal = () => {
      const active = track.querySelector<HTMLAnchorElement>('a[aria-current="page"]');
      if (!active) return;
      const bounds = track.getBoundingClientRect(), tab = active.getBoundingClientRect();
      if (tab.left < bounds.left + 8) track.scrollLeft -= bounds.left + 8 - tab.left;
      else if (tab.right > bounds.right - 8) track.scrollLeft += tab.right - (bounds.right - 8);
    };
    reveal();
    window.addEventListener('resize', reveal);
    return () => window.removeEventListener('resize', reveal);
    // Labels change width when the guide language changes, so the same tab may need a different offset.
  }, [current, language]);
  function moveFocus(event: KeyboardEvent<HTMLElement>) {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    const tabs = [...event.currentTarget.querySelectorAll<HTMLAnchorElement>('a')];
    const index = tabs.indexOf(document.activeElement as HTMLAnchorElement);
    event.preventDefault();
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
    tabs[next]?.focus();
    tabs[next]?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }
  return <div className="my-learning-navigation">
    <nav ref={tabsRef} className="my-learning-tabs" aria-label={language === 'zh-CN' ? 'My learning 页面' : 'My learning pages'} onKeyDown={moveFocus}>
      {myLearningRoutes.map(([key, label, icon, href]) => <Fragment key={key}>
        {groupStarts.has(key) && <span className="my-learning-tab-divider" aria-hidden="true" />}
        <a href={href} aria-current={current === key ? 'page' : undefined}><Icon name={icon} /><span>{t(label)}</span></a>
      </Fragment>)}
    </nav>
  </div>;
}
