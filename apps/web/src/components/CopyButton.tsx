import { useEffect, useRef, useState } from "react";
import { IconButton } from "./IconButton";

export function CopyButton({ value, label, small }: { value: string; label: string; small?: boolean }) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timerRef.current), []);

  // execCommand still works where the async clipboard does not, such as a plain
  // http:// LAN address, which is how this local app is often opened.
  function copyViaSelection(value: string) {
    const holder = document.createElement("textarea");
    holder.value = value;
    holder.setAttribute("readonly", "");
    holder.style.position = "fixed";
    holder.style.opacity = "0";
    document.body.appendChild(holder);
    holder.select();
    let copied = false;
    try {
      copied = document.execCommand("copy");
    } catch {
      copied = false;
    }
    holder.remove();
    return copied;
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setState("copied");
    } catch {
      setState(copyViaSelection(value) ? "copied" : "failed");
    }
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setState("idle"), 2400);
  }
  if (!value) return null;
  return (
    <span className="copy-control">
      <IconButton
        icon={state === "copied" ? "check" : "copy"}
        quiet={small}
        className={`copy-btn${small ? " copy-btn-sm" : ""}${state === "copied" ? " is-copied" : ""}${state === "failed" ? " is-failed" : ""}`}
        onClick={() => void copy()}
        label={state === "copied" ? `Copied ${label}` : `Copy ${label}`}
        title={
          state === "copied"
            ? "Copied"
            : state === "failed"
              ? "Copying failed — your browser blocked clipboard access"
              : `Copy ${label}`
        }
      />
      <span className="sr-only" role="status" aria-live="polite">
        {state === "copied"
          ? `${label} copied to clipboard`
          : state === "failed"
            ? `Could not copy ${label}`
            : ""}
      </span>
    </span>
  );
}
