import React, { useEffect, useRef } from "react";
import { useApp } from "./core";

/* A compact, self-contained icon set drawn for this mobile UI only. */
const ICON_PATHS: Record<string, string[]> = {
  home: ["M3 10.6 12 3l9 7.6", "M5.5 9.4V20h13V9.4", "M9.5 20v-6h5v6"],
  pen: ["M4 20h4l10.5-10.5a2.1 2.1 0 0 0-3-3L5 17v3Z", "M14.5 7.5l3 3", "M4 20h16"],
  book: ["M4 4.5h6a3 3 0 0 1 3 3V20a3 3 0 0 0-3-3H4V4.5Z", "M20 4.5h-4a3 3 0 0 0-3 3V20a3 3 0 0 1 3-3h4V4.5Z"],
  target: ["M12 3v3", "M12 18v3", "M3 12h3", "M18 12h3", "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z"],
  sparkles: ["M12 3l1.7 4.6L18.5 9l-4.8 1.4L12 15l-1.7-4.6L5.5 9l4.8-1.4L12 3Z", "M18.5 15l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8.8-2.2Z"],
  user: ["M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z", "M4.5 20c.8-3.6 3.7-5.5 7.5-5.5s6.7 1.9 7.5 5.5"],
  settings: ["M12 15.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4Z", "M19.4 13.4a7.6 7.6 0 0 0 0-2.8l2-1.5-2-3.4-2.4.9a7.6 7.6 0 0 0-2.4-1.4L14.2 3H9.8l-.4 2.2a7.6 7.6 0 0 0-2.4 1.4l-2.4-.9-2 3.4 2 1.5a7.6 7.6 0 0 0 0 2.8l-2 1.5 2 3.4 2.4-.9a7.6 7.6 0 0 0 2.4 1.4l.4 2.2h4.4l.4-2.2a7.6 7.6 0 0 0 2.4-1.4l2.4.9 2-3.4-2-1.5Z"],
  back: ["M15 5l-7 7 7 7"],
  forward: ["M9 5l7 7-7 7"],
  down: ["M5 9l7 7 7-7"],
  up: ["M5 15l7-7 7 7"],
  search: ["M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14Z", "M16.5 16.5 21 21"],
  plus: ["M12 5v14", "M5 12h14"],
  check: ["M4.5 12.5 9.5 17.5 19.5 6.5"],
  copy: ["M9 9h10v11H9V9Z", "M5 15V4h10"],
  volume: ["M4 9.5h3.5L12 5.5v13L7.5 14.5H4v-5Z", "M15.5 9a4.2 4.2 0 0 1 0 6", "M18 6.5a8 8 0 0 1 0 11"],
  share: ["M12 15V3", "M8 7l4-4 4 4", "M5 13v6h14v-6"],
  trash: ["M4 7h16", "M9 7V4h6v3", "M6.5 7l1 13h9l1-13", "M10 11v6", "M14 11v6"],
  close: ["M6 6l12 12", "M18 6 6 18"],
  refresh: ["M20 11a8 8 0 0 0-14-4.5L4 9", "M4 4v5h5", "M4 13a8 8 0 0 0 14 4.5L20 15", "M20 20v-5h-5"],
  arrow: ["M4 12h15", "M13 6l6 6-6 6"],
  star: ["M12 3.5l2.7 5.6 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1L3.2 10l6.1-.9L12 3.5Z"],
  clock: ["M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z", "M12 7v5l3.5 2"],
  calendar: ["M4 6h16v15H4V6Z", "M8 3v5", "M16 3v5", "M4 11h16"],
  filter: ["M3 5h18", "M6 12h12", "M10 19h4"],
  bulb: ["M9 18h6", "M10 21h4", "M8.5 14.5a6 6 0 1 1 7 0c-.8.6-1 1.4-1 2.5h-5c0-1.1-.2-1.9-1-2.5Z"],
  send: ["M4 12 20 4l-4.5 16-3.5-6-8-2Z", "M12 14 20 4"],
  chart: ["M4 20V4", "M4 20h16", "M8 17v-5", "M12.5 17V8", "M17 17v-8"],
  info: ["M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z", "M12 11v5", "M12 8h.01"],
  offline: ["M3 3l18 18", "M8.5 15.5a5 5 0 0 1 7 0", "M5 12a9 9 0 0 1 3-2.2", "M19 12a9 9 0 0 0-6.5-2.7", "M12 19h.01"],
  moon: ["M20 14.5A8.5 8.5 0 0 1 9.5 4 8.5 8.5 0 1 0 20 14.5Z"],
  sun: ["M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10Z", "M12 2v2", "M12 20v2", "M2 12h2", "M20 12h2", "M5 5l1.5 1.5", "M17.5 17.5 19 19", "M19 5l-1.5 1.5", "M6.5 17.5 5 19"],
  globe: ["M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z", "M3 12h18", "M12 3c2.5 2.5 3.5 5.5 3.5 9s-1 6.5-3.5 9c-2.5-2.5-3.5-5.5-3.5-9S9.5 5.5 12 3Z"],
  clipboard: ["M9 4h6v3H9V4Z", "M7 5H5v16h14V5h-2", "M9 11h6", "M9 15h6"],
  play: ["M8 5l11 7-11 7V5Z"],
  alert: ["M12 3 2.5 20h19L12 3Z", "M12 9v5", "M12 17h.01"],
  save: ["M5 4h12l2 2v14H5V4Z", "M8 4v6h8V4", "M8 20v-6h8v6"],
  layers: ["M12 3 3 8l9 5 9-5-9-5Z", "M3 13l9 5 9-5", "M3 17.5l9 5 9-5"],
  flame: ["M12 21c4 0 6.5-2.8 6.5-6.2 0-4.5-4.5-6.3-4-11.8-3 1.3-5 4.3-5 7 0 1.3.4 2.2 1 3-1.8-.3-2.6-1.6-2.8-3.2C6 11.7 5.5 13.4 5.5 15 5.5 18.4 8 21 12 21Z"],
  eye: ["M2.5 12S6 6.5 12 6.5 21.5 12 21.5 12 18 17.5 12 17.5 2.5 12 2.5 12Z", "M12 14.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z"],
  wand: ["M4 20 16 8", "M14 4l1 2.5L17.5 7.5 15 8.5l-1 2.5-1-2.5-2.5-1L13 6.5l1-2.5Z", "M19 12l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7.7-1.8Z"],
  note: ["M5 3h14v18l-4-2-3 2-3-2-4 2V3Z", "M9 8h6", "M9 12h6"],
  list: ["M8 6h13", "M8 12h13", "M8 18h13", "M3.5 6h.01", "M3.5 12h.01", "M3.5 18h.01"],
  external: ["M13 4h7v7", "M20 4 10 14", "M18 14v6H4V6h6"],
  more: ["M6 12h.01", "M12 12h.01", "M18 12h.01"],
};

export function Icon({ name, size = 22, className = "" }: { name: string; size?: number; className?: string }) {
  const paths = ICON_PATHS[name] || ICON_PATHS.info;
  return <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    {paths.map((d) => <path key={d} d={d} />)}
  </svg>;
}

export function IconButton({ name, label, onClick, disabled, tone = "plain", size = 22 }: {
  name: string; label: string; onClick?: () => void; disabled?: boolean; tone?: "plain" | "soft" | "primary"; size?: number;
}) {
  return <button type="button" className={`icon-button icon-button--${tone}`} onClick={onClick} disabled={disabled}
    aria-label={label} title={label}>
    <Icon name={name} size={size} />
  </button>;
}

export function Button({ children, onClick, variant = "primary", icon, disabled, loading, block, type = "button", name }: {
  children?: React.ReactNode; onClick?: () => void; variant?: "primary" | "secondary" | "ghost" | "danger" | "soft";
  icon?: string; disabled?: boolean; loading?: boolean; block?: boolean; type?: "button" | "submit"; name?: string;
}) {
  return <button type={type} name={name} className={`btn btn--${variant}${block ? " btn--block" : ""}`}
    onClick={onClick} disabled={disabled || loading}>
    {loading ? <span className="btn-spinner" aria-hidden="true" /> : icon ? <Icon name={icon} size={19} /> : null}
    {children && <span>{children}</span>}
  </button>;
}

export function Card({ children, className = "", onClick, padded = true, style }: {
  children: React.ReactNode; className?: string; onClick?: () => void; padded?: boolean; style?: React.CSSProperties;
}) {
  if (onClick) {
    return <button type="button" className={`card card--action${padded ? "" : " card--flush"} ${className}`}
      onClick={onClick} style={style}>{children}</button>;
  }
  return <section className={`card${padded ? "" : " card--flush"} ${className}`} style={style}>{children}</section>;
}

export function SectionTitle({ title, action, onAction, kicker }: {
  title: string; action?: string; onAction?: () => void; kicker?: string;
}) {
  return <div className="section-title">
    <div>
      {kicker && <p className="section-kicker">{kicker}</p>}
      <h2>{title}</h2>
    </div>
    {action && <button type="button" className="text-button" onClick={onAction}>{action}<Icon name="forward" size={16} /></button>}
  </div>;
}

export function Chip({ children, selected, onClick, icon, disabled }: {
  children: React.ReactNode; selected?: boolean; onClick?: () => void; icon?: string; disabled?: boolean;
}) {
  if (!onClick) return <span className={`chip${selected ? " chip--on" : ""}`}>{children}</span>;
  return <button type="button" className={`chip${selected ? " chip--on" : ""}`} onClick={onClick} disabled={disabled}
    aria-pressed={selected}>
    {icon && <Icon name={icon} size={15} />}{children}
  </button>;
}

export function Segmented<T extends string>({ items, value, onChange }: {
  items: Array<{ value: T; label: string }>; value: T; onChange: (value: T) => void;
}) {
  return <div className="segmented" role="tablist">
    {items.map((item) => <button key={item.value} type="button" role="tab"
      aria-selected={value === item.value} className={`segmented-item${value === item.value ? " is-active" : ""}`}
      onClick={() => onChange(item.value)}>{item.label}</button>)}
  </div>;
}

export function Input({ value, onChange, placeholder, type = "text", onEnter, disabled, label, icon }: {
  value: string; onChange: (value: string) => void; placeholder?: string; type?: string;
  onEnter?: () => void; disabled?: boolean; label?: string; icon?: string;
}) {
  return <label className="field">
    {label && <span className="field-label">{label}</span>}
    <span className="field-wrap">
      {icon && <span className="field-icon"><Icon name={icon} size={19} /></span>}
      <input type={type} value={value} disabled={disabled} placeholder={placeholder} autoComplete="off"
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => { if (event.key === "Enter" && onEnter) onEnter(); }} />
    </span>
  </label>;
}

export function TextArea({ value, onChange, placeholder, rows = 5, label, disabled }: {
  value: string; onChange: (value: string) => void; placeholder?: string; rows?: number; label?: string; disabled?: boolean;
}) {
  return <label className="field">
    {label && <span className="field-label">{label}</span>}
    <textarea className="field-textarea" value={value} rows={rows} disabled={disabled} placeholder={placeholder}
      onChange={(event) => onChange(event.target.value)} />
  </label>;
}

export function Sheet({ open, onClose, title, children, footer }: {
  open: boolean; onClose: () => void; title: string; children: React.ReactNode; footer?: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    ref.current?.focus();
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  return <div className="sheet-layer">
    <button type="button" className="sheet-scrim" onClick={onClose} aria-label="Close" />
    <div className="sheet" role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} ref={ref}>
      <div className="sheet-handle" />
      <div className="sheet-head"><h2>{title}</h2><IconButton name="close" label="Close" onClick={onClose} /></div>
      <div className="sheet-body">{children}</div>
      {footer && <div className="sheet-foot">{footer}</div>}
    </div>
  </div>;
}

export function Empty({ icon = "info", title, hint, action, onAction }: {
  icon?: string; title: string; hint?: string; action?: string; onAction?: () => void;
}) {
  return <div className="empty">
    <span className="empty-icon"><Icon name={icon} size={30} /></span>
    <h3>{title}</h3>
    {hint && <p>{hint}</p>}
    {action && <Button variant="soft" onClick={onAction}>{action}</Button>}
  </div>;
}

export function ErrorNote({ message, onRetry, retryLabel = "Retry" }: {
  message: string; onRetry?: () => void; retryLabel?: string;
}) {
  return <div className="error-note" role="alert">
    <Icon name="alert" size={19} />
    <span>{message}</span>
    {onRetry && <button type="button" onClick={onRetry}>{retryLabel}</button>}
  </div>;
}

export function Busy({ label }: { label?: string }) {
  const { t } = useApp();
  return <div className="busy"><span className="busy-dot" /><span>{label || t("正在加载…", "Loading…")}</span></div>;
}

export function Skeleton({ lines = 3 }: { lines?: number }) {
  return <div className="skeleton" aria-hidden="true">
    {Array.from({ length: lines }, (_, index) => <span key={index} style={{ width: `${90 - index * 12}%` }} />)}
  </div>;
}

export function Ring({ value, size = 88, label, sub }: { value: number; size?: number; label?: string; sub?: string }) {
  const radius = (size - 10) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, Number(value) || 0));
  return <div className="ring" style={{ width: size, height: size }}>
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
      <circle cx={size / 2} cy={size / 2} r={radius} className="ring-track" strokeWidth={7} fill="none" />
      <circle cx={size / 2} cy={size / 2} r={radius} className="ring-value" strokeWidth={7} fill="none"
        strokeDasharray={circumference} strokeDashoffset={circumference * (1 - clamped / 100)}
        strokeLinecap="round" transform={`rotate(-90 ${size / 2} ${size / 2})`} />
    </svg>
    <div className="ring-label"><strong>{label ?? `${Math.round(clamped)}`}</strong>{sub && <small>{sub}</small>}</div>
  </div>;
}

export function Progress({ value, tone = "primary" }: { value: number; tone?: string }) {
  const clamped = Math.max(0, Math.min(100, value));
  return <div className={`progress progress--${tone}`} role="progressbar" aria-valuenow={clamped} aria-valuemin={0} aria-valuemax={100}>
    <span style={{ width: `${clamped}%` }} />
  </div>;
}

export function Badge({ children, tone = "neutral" }: { children: React.ReactNode; tone?: string }) {
  return <span className={`badge badge--${tone}`}>{children}</span>;
}

export function ListRow({ icon, title, sub, onClick, right, tone = "plain" }: {
  icon: string; title: string; sub?: string; onClick?: () => void; right?: React.ReactNode; tone?: string;
}) {
  return <button type="button" className="list-row" onClick={onClick}>
    <span className={`list-row-icon list-row-icon--${tone}`}><Icon name={icon} size={20} /></span>
    <span className="list-row-text"><strong>{title}</strong>{sub && <small>{sub}</small>}</span>
    {right ?? <Icon name="forward" size={18} />}
  </button>;
}

/** Dependency-free, XSS-safe renderer for the Markdown-ish text the Runtime returns. */
export function RichText({ text }: { text: string }) {
  const lines = String(text || "").split(/\r?\n/);
  const inline = (line: string) => {
    const parts = line.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).filter(Boolean);
    return parts.map((part, index) => {
      if (part.startsWith("**") && part.endsWith("**")) return <strong key={index}>{part.slice(2, -2)}</strong>;
      if (part.startsWith("`") && part.endsWith("`")) return <code key={index}>{part.slice(1, -1)}</code>;
      return <React.Fragment key={index}>{part}</React.Fragment>;
    });
  };
  return <div className="rich-text">
    {lines.map((line, index) => {
      const trimmed = line.trim();
      if (!trimmed) return <div key={index} className="rich-gap" />;
      if (/^#{1,3}\s/.test(trimmed)) return <h4 key={index}>{inline(trimmed.replace(/^#{1,3}\s/, ""))}</h4>;
      if (/^[-*]\s/.test(trimmed)) return <div key={index} className="rich-bullet"><span>•</span><p>{inline(trimmed.replace(/^[-*]\s/, ""))}</p></div>;
      if (/^\d+[.)]\s/.test(trimmed)) return <div key={index} className="rich-bullet"><span>{trimmed.match(/^\d+/)?.[0]}.</span><p>{inline(trimmed.replace(/^\d+[.)]\s/, ""))}</p></div>;
      return <p key={index}>{inline(trimmed)}</p>;
    })}
  </div>;
}

export function relativeTime(value: string, lang: "zh" | "en"): string {
  if (!value) return "";
  const time = new Date(value).getTime();
  if (Number.isNaN(time)) return value;
  const diff = Date.now() - time;
  const minutes = Math.round(diff / 60_000);
  if (minutes < 1) return lang === "zh" ? "刚刚" : "just now";
  if (minutes < 60) return lang === "zh" ? `${minutes} 分钟前` : `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return lang === "zh" ? `${hours} 小时前` : `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return lang === "zh" ? `${days} 天前` : `${days}d ago`;
  return new Date(time).toLocaleDateString(lang === "zh" ? "zh-CN" : "en", { month: "short", day: "numeric" });
}
