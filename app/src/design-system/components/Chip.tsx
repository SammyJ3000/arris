import type { ReactNode } from "react";
import { MATERIAL_STATUS_LABEL, type MaterialStatus, type Urgency } from "@/domain/domain";

export type ChipTone = "neutral" | "accent" | "ok" | "info" | "warn" | "overdue" | "today" | "offline" | "outline";

export function Chip({ tone = "neutral", size, icon, children }: { tone?: ChipTone; size?: "sm" | "lg"; icon?: ReactNode; children: ReactNode }) {
  return (
    <span className={`chip chip--${tone} ${size ? `chip--${size}` : ""}`}>
      {icon}
      {children}
    </span>
  );
}

export function UrgencyChip({ urgency, size, children }: { urgency: Urgency; size?: "sm" | "lg"; children: ReactNode }) {
  return <span className={`chip chip--${urgency} ${size ? `chip--${size}` : ""}`}>{children}</span>;
}

export function MaterialStatusChip({ status }: { status: MaterialStatus }) {
  return <span className={`mstat mstat--${status}`}>{MATERIAL_STATUS_LABEL[status]}</span>;
}
