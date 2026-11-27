// Shared components. Every control here is built for a gloved finger at arm's
// length first, and scaled down for the office second.
import { type ReactNode, type ButtonHTMLAttributes, type CSSProperties, useEffect } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { X, WifiSlash } from "@phosphor-icons/react";
import type { StageId, Urgency } from "../shared/domain";
import { paint, paintEdge, paintTint, stageLabel, type PaintId, dueText } from "../stages";
import { useStore } from "../state";

/* ---------- Wordmark ---------- */
export function Wordmark({ size = 28, inverse = false }: { size?: number; inverse?: boolean }) {
  // Six painted blocks, one per station, then the name in condensed caps.
  const blocks: PaintId[] = ["materials", "cnc", "bench", "spray", "qc", "ready"];
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: size * 0.4 }} aria-label="Shopboard">
      <span style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: Math.max(2, size * 0.09), width: size, height: size * 0.66 }} aria-hidden>
        {blocks.map((b) => (
          <span key={b} style={{ background: paint(b), borderRadius: 1.5 }} />
        ))}
      </span>
      <span
        className="num"
        style={{
          fontSize: size,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          color: inverse ? "var(--on-paint)" : "var(--ink)",
          lineHeight: 1,
        }}
      >
        Shopboard
      </span>
    </span>
  );
}

/* ---------- Buttons ---------- */
type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  kind?: "ink" | "ghost" | "red" | "paint" | "locked";
  size?: "sm" | "md" | "lg" | "xl";
  stage?: PaintId;
  block?: boolean;
  children: ReactNode;
};
export function Btn({ kind = "ink", size = "md", stage, block, className = "", style, children, ...rest }: BtnProps) {
  const s: CSSProperties = { ...style };
  if (kind === "paint" && stage) {
    (s as any)["--paint"] = paint(stage);
    (s as any)["--paint-edge"] = paintEdge(stage);
  }
  const cls = ["btn", `btn-${kind}`, size !== "md" ? `btn-${size}` : "", block ? "btn-block" : "", className].filter(Boolean).join(" ");
  return (
    <button className={cls} style={s} {...rest}>
      {children}
    </button>
  );
}

/* ---------- Tags ---------- */
export function StageTag({ stage, size = "md", variant = "solid" }: { stage: PaintId; size?: "md" | "lg"; variant?: "solid" | "outline" | "tint" }) {
  const label = stage === "review" ? "Drawing Review" : stageLabel(stage as StageId);
  return (
    <span
      className={["tag", size === "lg" ? "tag-lg" : "", variant === "outline" ? "tag-outline" : "", variant === "tint" ? "tag-tint" : ""].join(" ")}
      style={{ ["--paint" as any]: paint(stage), ["--tint" as any]: paintTint(stage) }}
    >
      {label}
    </span>
  );
}

export function DueTag({ targetDate, stage, size = "md" }: { targetDate: string; stage: StageId; size?: "md" | "lg" }) {
  const u: Urgency = (() => {
    const t = dueText({ targetDate, stage });
    if (t.endsWith("late")) return "overdue";
    if (t === "Due today") return "today";
    if (t === "Due tomorrow" || /Due in [23] days/.test(t)) return "soon";
    return "on-track";
  })();
  const text = dueText({ targetDate, stage });
  const style: CSSProperties =
    u === "overdue"
      ? { ["--paint" as any]: "var(--red)" }
      : u === "today"
        ? { ["--paint" as any]: "var(--red)" }
        : u === "soon"
          ? { ["--paint" as any]: "var(--amber)", ["--tint" as any]: "var(--amber-tint)" }
          : { ["--paint" as any]: "var(--ink-3)", ["--tint" as any]: "var(--ticket-2)" };
  const cls = ["tag", size === "lg" ? "tag-lg" : "", u === "overdue" ? "" : u === "today" ? "tag-outline" : "tag-tint"].join(" ");
  return (
    <span className={cls} style={style}>
      {text}
    </span>
  );
}

/* ---------- Avatar ---------- */
export function Avatar({ initials, small, stage }: { initials: string; small?: boolean; stage?: PaintId }) {
  return (
    <span className={`avatar ${small ? "avatar-sm" : ""}`} style={stage ? { background: paint(stage) } : undefined} aria-hidden>
      {initials}
    </span>
  );
}

/* ---------- Offline strip ---------- */
export function OfflineStrip() {
  const { state } = useStore();
  if (!state.offline) return null;
  return (
    <div className="offline" role="status">
      <WifiSlash size={24} weight="bold" />
      <strong>Offline</strong>
      <span>
        Changes are saved on this tablet and sent when the signal is back.
        {state.pending > 0 ? ` ${state.pending} change${state.pending === 1 ? "" : "s"} waiting.` : ""}
      </span>
    </div>
  );
}

/* ---------- Sheet and Dialog ---------- */
export function Scrim({ onClose }: { onClose?: () => void }) {
  return <motion.div className="scrim" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.22 }} onClick={onClose} />;
}

export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  const reduce = useReducedMotion();
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  return (
    <AnimatePresence>
      {open && (
        <>
          <Scrim key="scrim" onClose={onClose} />
          <motion.section
            key="sheet"
            className="sheet"
            role="dialog"
            aria-modal="true"
            aria-label={title}
            initial={{ transform: reduce ? "translateY(0)" : "translateY(100%)", opacity: reduce ? 0 : 1 }}
            animate={{ transform: "translateY(0)", opacity: 1 }}
            exit={{ transform: reduce ? "translateY(0)" : "translateY(100%)", opacity: reduce ? 0 : 1 }}
            transition={{ duration: reduce ? 0.2 : 0.42, ease: [0.32, 0.72, 0, 1] }}
          >
            <div className="sheet-grip" aria-hidden />
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, marginBottom: 20 }}>
              <h2 style={{ fontSize: "var(--fs-28)", fontWeight: 700, lineHeight: 1.15, letterSpacing: "-0.01em" }}>{title}</h2>
              <Btn kind="ghost" size="sm" onClick={onClose} aria-label="Close" style={{ minWidth: 48, minHeight: 48 }}>
                <X size={22} weight="bold" />
              </Btn>
            </div>
            {children}
          </motion.section>
        </>
      )}
    </AnimatePresence>
  );
}

export function Dialog({ open, onClose, children, band, bandText }: { open: boolean; onClose: () => void; children: ReactNode; band?: string; bandText?: string }) {
  const reduce = useReducedMotion();
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  return (
    <AnimatePresence>
      {open && (
        <>
          <Scrim key="scrim" onClose={onClose} />
          <motion.div
            key="dialog"
            className="dialog"
            role="alertdialog"
            aria-modal="true"
            initial={{ opacity: 0, transform: `translate(-50%, -50%) scale(${reduce ? 1 : 0.96})` }}
            animate={{ opacity: 1, transform: "translate(-50%, -50%) scale(1)" }}
            exit={{ opacity: 0, transform: `translate(-50%, -50%) scale(${reduce ? 1 : 0.96})` }}
            transition={{ duration: 0.22, ease: [0.23, 1, 0.32, 1] }}
          >
            {band && (
              <div className="ticket-band" style={{ ["--paint" as any]: band }}>
                <span>{bandText}</span>
              </div>
            )}
            <div className="dialog-body">{children}</div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

/* ---------- Toasts ---------- */
export function Toasts() {
  const { state, dispatch } = useStore();
  const reduce = useReducedMotion();
  useEffect(() => {
    if (!state.toasts.length) return;
    const t = setTimeout(() => dispatch({ type: "untoast", id: state.toasts[0].id }), 3600);
    return () => clearTimeout(t);
  }, [state.toasts, dispatch]);
  return (
    <div className="toasts" aria-live="polite">
      <AnimatePresence initial={false}>
        {state.toasts.map((t) => (
          <motion.div
            key={t.id}
            className="toast"
            layout
            initial={{ opacity: 0, transform: reduce ? "translateX(0)" : "translateX(40px)" }}
            animate={{ opacity: 1, transform: "translateX(0)" }}
            exit={{ opacity: 0, transform: reduce ? "translateX(0)" : "translateX(40px)" }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            style={{ ["--paint" as any]: t.paint }}
          >
            <span className="toast-chip" aria-hidden />
            <span>{t.text}</span>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

/* ---------- Painted outline (empty) and skeleton (loading) ---------- */
export function Outline({ children, style, minHeight = 120 }: { children: ReactNode; style?: CSSProperties; minHeight?: number }) {
  return (
    <div className="outline" style={{ minHeight, display: "grid", placeItems: "center", textAlign: "center", padding: 24, ...style }}>
      {children}
    </div>
  );
}
export function Skel({ w, h = 16, style }: { w?: number | string; h?: number; style?: CSSProperties }) {
  return <span className="skel" style={{ display: "block", width: w ?? "100%", height: h, ...style }} aria-hidden />;
}
