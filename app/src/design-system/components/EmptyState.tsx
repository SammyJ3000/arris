import type { ReactNode } from "react";

/**
 * Nothing here, said properly: what this space is for, why it is empty, and
 * what fills it. Also the shape of an error with a way out.
 */
export function EmptyState({ icon, title, children, actions, tone = "ok" }: { icon: ReactNode; title: string; children?: ReactNode; actions?: ReactNode; tone?: "ok" | "error" | "neutral" | "accent" }) {
  return (
    <div className="empty" role={tone === "error" ? "alert" : undefined}>
      <div className={`empty__mark ${tone !== "ok" ? `empty__mark--${tone}` : ""}`}>{icon}</div>
      <h2 className="t-title">{title}</h2>
      {children && <p className="t-body-lg t-muted">{children}</p>}
      {actions && <div className="empty__actions">{actions}</div>}
    </div>
  );
}
