type IconName = "dashboard" | "grammar" | "translation" | "word-lookup" | "word-review" | "practice" | "ask" | "handbook" | "coach" | "settings" | "chevron" | "menu" | "close" | "arrow" | "document" | "check" | "spark" | "info" | "idea" | "bookmark" | "volume" | "copy" | "home" | "dining" | "shopping" | "entertainment" | "health" | "work" | "transit" | "travel" | "services";

const paths: Record<IconName, string> = {
  home: "M3 11l9-8 9 8 M5 10v11h14V10 M9 21v-7h6v7",
  dining: "M4 3v6a3 3 0 0 0 6 0V3 M7 3v18 M16 21V3c4 2 4 9 0 10h4",
  shopping: "M5 7h14l2 14H3L5 7z M9 7V5a3 3 0 0 1 6 0v2",
  entertainment: "M9 18V5l11-2v13 M9 9l11-2 M9 18a3 3 0 1 1-3-3h3 M20 16a3 3 0 1 1-3-3h3",
  health: "M12 21 3.5 12.5a5.3 5.3 0 0 1 7.5-7.5l1 1 1-1a5.3 5.3 0 0 1 7.5 7.5L12 21z",
  work: "M8 7V4h8v3 M3 7h18v13H3V7z M3 12c6 4 12 4 18 0 M10 13h4v3h-4z",
  transit: "M5 16V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2z M5 11h14 M8 15h.01 M16 15h.01 M8 18l-3 4 M16 18l3 4 M7 21h10",
  travel: "M22 3 9 16 M22 3l-7 19-6-6-7-6 20-7z",
  services: "M3 18h18 M5 18v-4a7 7 0 0 1 14 0v4 M12 7V4 M10 4h4 M2 21h20",
  dashboard: "M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z",
  grammar: "M13 5H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8 M16 3l5 5 M10 14l2-5 6-6 3 3-6 6-5 2 M7 17h6",
  translation: "M3 5h12 M9 3v2 M5 5c1 5 4 8 9 10 M13 5c-1 5-4 8-9 10 M14 21l4-10 4 10 M16 17h4",
  "word-lookup": "M15 10a6 6 0 1 1-12 0 6 6 0 0 1 12 0 M14 15l6 6 M6 8h6 M6 11h4",
  "word-review": "M5 7V3 M5 7h4 M5 7a8 8 0 1 1-1 9 M12 7v5l3 2",
  practice: "M15 4l5 5 M4 20l5-1L21 7a2 2 0 0 0-4-4L5 15l-1 5 M13 21h8",
  ask: "M21 11a8 8 0 0 1-8 8H7l-4 3V7a4 4 0 0 1 4-4h6a8 8 0 0 1 8 8 M7 8h9 M7 12h6",
  handbook: "M12 5v16 M12 5C9 3 5 3 2 4v15c3-1 7-1 10 2 M12 5c3-2 7-2 10-1v15c-3-1-7-1-10 2",
  coach: "M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0 M16 8l-2 6-6 2 2-6 6-2",
  settings: "M12 3v2 M12 19v2 M3 12h2 M19 12h2 M5.64 5.64l1.42 1.42 M16.94 16.94l1.42 1.42 M18.36 5.64l-1.42 1.42 M7.06 16.94l-1.42 1.42 M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8",
  chevron: "M8 10l4 4 4-4",
  menu: "M4 6h16 M4 12h16 M4 18h16",
  close: "M6 6l12 12 M6 18L18 6",
  arrow: "M4 12h16 M14 6l6 6-6 6",
  document: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6 M8 13h8 M8 17h8",
  check: "M20 6 9 17l-5-5",
  spark: "m12 3 1.9 5.8L20 11l-6.1 2.2L12 19l-2-5.8L4 11l6-2.2z M19 14l1.2 2.8L23 18l-2.8 1.2L19 22l-1.2-2.8L15 18l2.8-1.2z",
  info: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20 M12 11v5 M12 8h.01",
  idea: "M9 18h6 M10 22h4 M8.5 14.5a6 6 0 1 1 7 0c-.8.6-1.3 1.3-1.5 2.5h-4c-.2-1.2-.7-1.9-1.5-2.5",
  bookmark: "M6 4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18l-6-4-6 4z",
  volume: "M11 5L6 9H2v6h4l5 4V5z M19.07 4.93a10 10 0 0 1 0 14.14 M15.54 8.46a5 5 0 0 1 0 7.07",
  copy: "M9 9h9a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2v-9a2 2 0 0 1 2-2z M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1",
};

export function Icon({ name, className = "" }: { name: IconName; className?: string }) {
  return <svg className={`icon ${className}`} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"><path d={paths[name]} /></svg>;
}
