import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useRef, type ReactNode } from "react";
import { X } from "@phosphor-icons/react";
import { useStore } from "../store";

/* ---------- Toasts ----------
   One place, bottom left, above the title block. Transitions, not keyframes, so a
   second toast arriving mid-animation retargets smoothly. */
export function Toasts() {
  const { state, dispatch } = useStore();
  return (
    <div className="toasts" aria-live="polite">
      <AnimatePresence initial={false}>
        {state.toasts.map((t) => (
          <ToastItem key={t.id} id={t.id} text={t.text} tone={t.tone} undo={t.undo} onDone={() => dispatch({ type: "dismiss-toast", id: t.id })} />
        ))}
      </AnimatePresence>
    </div>
  );
}

function ToastItem({
  id,
  text,
  tone = "ink",
  undo,
  onDone,
}: {
  id: number;
  text: string;
  tone?: "ink" | "blue" | "red";
  undo?: () => void;
  onDone: () => void;
}) {
  const reduce = useReducedMotion();
  useEffect(() => {
    const t = setTimeout(onDone, undo ? 6000 : 3600);
    return () => clearTimeout(t);
  }, [id]);
  return (
    <motion.div
      className={`toast toast--${tone}`}
      layout={!reduce}
      initial={reduce ? { opacity: 0 } : { opacity: 0, transform: "translateY(12px)" }}
      animate={{ opacity: 1, transform: "translateY(0px)" }}
      exit={{ opacity: 0, transform: reduce ? "translateY(0px)" : "translateY(12px)" }}
      transition={{ duration: 0.26, ease: [0.23, 1, 0.32, 1] }}
    >
      <span className="toast__text">{text}</span>
      {undo && (
        <button
          type="button"
          className="toast__undo"
          onClick={() => {
            undo();
            onDone();
          }}
        >
          Undo
        </button>
      )}
    </motion.div>
  );
}

/* ---------- Dialog ----------
   Centred, because it is not anchored to a trigger. Backdrop fades with it. */
export function Dialog({
  open,
  onClose,
  title,
  children,
  width = 560,
  tone = "ink",
  labelledBy,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  width?: number;
  tone?: "ink" | "red" | "amber" | "blue";
  labelledBy?: string;
}) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    // Focus the dialog itself, not its close icon: no ring on open, keyboard still tabs in.
    ref.current?.focus({ preventScroll: true });
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.22, ease: [0.23, 1, 0.32, 1] }}
          onPointerDown={(e) => e.target === e.currentTarget && onClose()}
        >
          <motion.div
            ref={ref}
            role="dialog"
            aria-modal="true"
            aria-labelledby={labelledBy}
            aria-label={labelledBy ? undefined : title}
            tabIndex={-1}
            className={`dialog dialog--${tone}`}
            style={{ maxWidth: width }}
            initial={reduce ? { opacity: 0 } : { opacity: 0, transform: "scale(0.96)" }}
            animate={{ opacity: 1, transform: "scale(1)" }}
            exit={{ opacity: 0, transform: reduce ? "scale(1)" : "scale(0.97)" }}
            transition={{ duration: 0.22, ease: [0.23, 1, 0.32, 1] }}
          >
            {title && (
              <div className="dialog__head">
                <h2 className="dialog__title" id={labelledBy}>
                  {title}
                </h2>
                <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
                  <X size={22} aria-hidden="true" />
                </button>
              </div>
            )}
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ---------- Bottom sheet ----------
   Slides from the bottom edge with the drawer curve. Exits the way it entered. */
export function BottomSheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  const reduce = useReducedMotion();
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="overlay overlay--bottom"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.24 }}
          onPointerDown={(e) => e.target === e.currentTarget && onClose()}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            className="bsheet"
            initial={reduce ? { opacity: 0 } : { transform: "translateY(100%)" }}
            animate={reduce ? { opacity: 1 } : { transform: "translateY(0%)" }}
            exit={reduce ? { opacity: 0 } : { transform: "translateY(100%)" }}
            transition={{ duration: reduce ? 0.15 : 0.42, ease: [0.32, 0.72, 0, 1] }}
          >
            <div className="bsheet__head">
              <h2 className="bsheet__title">{title}</h2>
              <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
                <X size={24} aria-hidden="true" />
              </button>
            </div>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
