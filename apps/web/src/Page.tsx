import type { ComponentProps, ReactNode } from "react";
import { Icon } from "./Icon";

export function Heading({ title, detail }: { eyebrow: string; title: ReactNode; detail: string }) {
  return <div className="heading"><h1>{title}</h1><p>{detail}</p></div>;
}
export function Panel({ title, children, icon, className = "" }: { title: string; children: ReactNode; icon?: ComponentProps<typeof Icon>["name"]; className?: string }) {
  return <section className={`panel ${className}`}><div className="panel-heading">{icon && <Icon name={icon} />}<h2>{title}</h2></div>{children}</section>;
}
export function State({ title, detail }: { title: string; detail?: string }) {
  return <div className="state"><strong>{title}</strong>{detail && <p>{detail}</p>}</div>;
}
