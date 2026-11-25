import { useEffect, useRef, useState } from "react";
import { IconButton } from "./IconButton";
import { useGuideCopy } from "./learner-language";
import "./PageScrollControls.css";

/** Page navigation stays separate from the learning actions in the floating dock. */
export function PageScrollControls() {
  const { t } = useGuideCopy();
  const [position, setPosition] = useState({ scrollable: false, atTop: true, atBottom: false });
  const seekingBottom = useRef(false);

  useEffect(() => {
    let frame = 0;
    let lastHeight = document.documentElement.scrollHeight;
    const measure = () => {
      frame = 0;
      const height = document.documentElement.scrollHeight;
      const remaining = height - window.innerHeight;
      // Existing floating actions reveal footer space as we scroll. Follow that
      // height change so a bottom jump still reaches the actual end of the page.
      if (seekingBottom.current && height !== lastHeight) scrollToBottom();
      lastHeight = height;
      const next = {
        scrollable: remaining > 160,
        atTop: window.scrollY <= 2,
        atBottom: window.scrollY >= remaining - 2,
      };
      setPosition(previous => previous.scrollable === next.scrollable && previous.atTop === next.atTop && previous.atBottom === next.atBottom ? previous : next);
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(measure); };
    const cancel = () => { seekingBottom.current = false; };
    // Saved content, report expansion, and filters can change page length without a resize.
    const observer = new ResizeObserver(schedule);
    observer.observe(document.body);
    observer.observe(document.documentElement);
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    window.addEventListener("scrollend", cancel);
    window.addEventListener("wheel", cancel, { passive: true });
    window.addEventListener("touchstart", cancel, { passive: true });
    window.addEventListener("pointerdown", cancel);
    window.addEventListener("keydown", cancel);
    measure();
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      window.removeEventListener("scrollend", cancel);
      window.removeEventListener("wheel", cancel);
      window.removeEventListener("touchstart", cancel);
      window.removeEventListener("pointerdown", cancel);
      window.removeEventListener("keydown", cancel);
    };
  }, []);

  function scroll(edge: "top" | "bottom") {
    if (edge === "top" ? position.atTop : position.atBottom) return;
    seekingBottom.current = edge === "bottom";
    window.scrollTo({
      top: edge === "top" ? 0 : document.documentElement.scrollHeight,
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth",
    });
  }

  if (!position.scrollable) return null;
  return <div className="page-scroll-controls" role="group" aria-label={t("Page scrolling")}>
    <IconButton icon="scroll-top" label={t("Scroll to top")} aria-disabled={position.atTop} onClick={() => scroll("top")} />
    <IconButton icon="scroll-bottom" label={t("Scroll to bottom")} aria-disabled={position.atBottom} onClick={() => scroll("bottom")} />
  </div>;
}

function scrollToBottom() {
  window.scrollTo({
    top: document.documentElement.scrollHeight,
    behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth",
  });
}
