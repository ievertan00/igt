import type { ComponentProps, ReactNode } from "react";
import { Icon } from "./Icon";

export function DetailSection({
  variant,
  icon,
  title,
  action,
  children,
}: {
  variant: string;
  icon: ComponentProps<typeof Icon>["name"];
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section
      className={"detail-section detail-" + variant}
      aria-labelledby={"detail-" + variant + "-title"}
    >
      <span className="detail-icon">
        <Icon name={icon} />
      </span>
      <div className="detail-content">
        {action ? (
          <div className="detail-head">
            <h2 id={"detail-" + variant + "-title"}>{title}</h2>
            {action}
          </div>
        ) : (
          <h2 id={"detail-" + variant + "-title"}>{title}</h2>
        )}
        <div className="detail-copy">{children}</div>
      </div>
    </section>
  );
}
