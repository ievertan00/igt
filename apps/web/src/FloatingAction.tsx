import { useEffect, useState } from "react";
import { Icon } from "./Icon";

/** Repeat an existing destination after the page-header action scrolls away. */
export function FloatingAction({ active, href, label, icon }: {
  active: boolean; href: string; label: string; icon: "ask" | "word-review";
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
  return <div className="floating-action-dock">
    <a className="primary floating-action" href={href}>
      <Icon name={icon} /><span>{label}</span><Icon name="arrow" />
    </a>
  </div>;
}
