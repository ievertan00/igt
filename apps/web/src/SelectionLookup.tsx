import { useEffect, useRef, useState, type ReactNode } from "react";
import { Icon } from "./Icon";
import "./SelectionLookup.css";

type SelectedText = { text: string; left: number; top: number };

// Never read credentials or selections in editable rich-text regions.
const excluded = 'input[type="password"], input[type="hidden"], [contenteditable]:not([contenteditable="false"]), [data-no-lookup]';

export function SelectionLookup({ renderLookup }: { renderLookup: (text: string) => ReactNode }) {
  const [selected, setSelected] = useState<SelectedText | null>(null);
  const [query, setQuery] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const restoreFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    let frame = 0;
    const readSelection = () => {
      if (dialog.current?.open) return;
      const active = document.activeElement;
      let text = "";
      let rect: DOMRect | undefined;
      if (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement) {
        if (active.closest(excluded) || active.selectionStart === null || active.selectionEnd === null) {
          setSelected(null);
          return;
        }
        text = active.value.slice(active.selectionStart, active.selectionEnd);
        rect = active.getBoundingClientRect();
      } else {
        const selection = window.getSelection();
        if (selection && !selection.isCollapsed && selection.rangeCount) {
          const range = selection.getRangeAt(0);
          const elements = [range.startContainer, range.endContainer, range.commonAncestorContainer]
            .map(node => node instanceof Element ? node : node.parentElement);
          if (elements.some(element => element?.closest(excluded))) {
            setSelected(null);
            return;
          }
          text = selection.toString();
          rect = range.getBoundingClientRect();
        }
      }
      text = text.trim();
      if (!rect || !/[\p{Script=Han}a-z]/iu.test(text)) {
        setSelected(null);
        return;
      }
      setSelected({ text, left: Math.max(8, Math.min(rect.left, window.innerWidth - 176)),
        top: Math.max(8, Math.min(rect.bottom + 8, window.innerHeight - 60)) });
    };
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(readSelection);
    };
    const dismiss = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !dialog.current?.open) setSelected(null);
    };
    document.addEventListener("selectionchange", schedule);
    document.addEventListener("select", schedule, true);
    document.addEventListener("pointerup", schedule);
    document.addEventListener("keydown", dismiss);
    window.addEventListener("scroll", schedule, true);
    window.addEventListener("resize", schedule);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("selectionchange", schedule);
      document.removeEventListener("select", schedule, true);
      document.removeEventListener("pointerup", schedule);
      document.removeEventListener("keydown", dismiss);
      window.removeEventListener("scroll", schedule, true);
      window.removeEventListener("resize", schedule);
    };
  }, []);

  function openLookup() {
    if (!selected) return;
    restoreFocus.current = document.activeElement instanceof HTMLElement && document.activeElement !== trigger.current
      ? document.activeElement : document.querySelector<HTMLElement>("main");
    setQuery(selected.text);
    dialog.current?.showModal();
    setSelected(null);
  }

  return <>
    {selected && <button ref={trigger} className="selection-lookup-trigger"
      style={{ left: selected.left, top: selected.top }}
      aria-haspopup="dialog" aria-controls="selection-lookup-dialog"
      onPointerDown={event => event.preventDefault()} onClick={openLookup}>
      <Icon name="word-lookup" /> Look up selection
    </button>}
    <dialog ref={dialog} id="selection-lookup-dialog" className="saved-word-dialog selection-lookup-dialog"
      aria-labelledby="selection-lookup-title"
      onClose={() => { setQuery(""); setSelected(null); restoreFocus.current?.focus({ preventScroll: true }); }}
      onClick={event => {
        if (event.target !== dialog.current) return;
        const rect = dialog.current.getBoundingClientRect();
        if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.current.close();
      }}>
      <header className="saved-word-dialog-header">
        <div className="saved-word-dialog-heading"><h2 id="selection-lookup-title">Selection lookup</h2></div>
        <button type="button" className="secondary" onClick={() => dialog.current?.close()} aria-label="Close selection lookup" autoFocus><Icon name="close" />Close</button>
      </header>
      <div className="saved-word-details">{query && renderLookup(query)}</div>
    </dialog>
  </>;
}
