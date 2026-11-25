import type { ButtonHTMLAttributes } from "react";
import { Icon } from "./Icon";

type Props = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "aria-label" | "children"> & {
  label: string;
  icon: Parameters<typeof Icon>[0]["name"];
  quiet?: boolean;
  pending?: boolean;
  caption?: string;
};

/** Content utilities share a target and states; captions distinguish learning hints. */
export function IconButton({ label, icon, quiet = false, pending = false, caption, className = "", disabled, title, ...props }: Props) {
  return <button {...props} type={props.type ?? "button"}
    className={`icon-button${quiet ? " icon-button-quiet" : ""}${caption ? " icon-button-caption" : ""} ${className}`}
    aria-label={label} title={title ?? label} aria-busy={pending || undefined} disabled={disabled || pending}>
    {pending ? <span className="loading-spinner" aria-hidden="true" /> : <Icon name={icon} />}
    {caption && <span>{caption}</span>}
  </button>;
}
