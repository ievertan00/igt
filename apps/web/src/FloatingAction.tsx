import { useEffect, useState } from "react";
import { Icon } from "./Icon";

/** Repeat an existing destination after the page-header action scrolls away. */
export function FloatingAction({ active, href, label, icon, compact = false }: {
  active: boolean; href: string; label: string; icon: "ask" | "word-review"; compact?: boolean;
}) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!active) { setVisible(false); return; }
    const update = () => setVisible(window.scrollY > 320);
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, [active]);

  if (!active || !visible) return null;
  return <div className={`floating-action-dock${compact ? " floating-action-dock-compact" : ""}`}>
    <a className={`primary floating-action${compact ? " floating-action-compact" : ""}`} href={href} aria-label={compact ? label : undefined} title={compact ? label : undefined}>
      <Icon name={icon} />{!compact && <><span>{label}</span><Icon name="arrow" /></>}
    </a>
  </div>;
}
