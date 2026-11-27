import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect } from "react";
import { useStore, type Toast } from "../state/store";

function ToastItem({ toast }: { toast: Toast }) {
  const { dismissToast } = useStore();
  const reduce = useReducedMotion();
  useEffect(() => {
    const t = setTimeout(() => dismissToast(toast.id), toast.undo ? 7000 : 4500);
    return () => clearTimeout(t);
  }, [toast.id, toast.undo, dismissToast]);
  return (
    <motion.div
      layout
      className="toast"
      role="status"
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: 24, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={reduce ? { opacity: 0 } : { opacity: 0, y: 24, scale: 0.98 }}
      transition={{ type: "spring", duration: 0.45, bounce: 0.1 }}
      drag={reduce ? false : "y"}
      dragConstraints={{ top: 0, bottom: 0 }}
      dragElastic={{ top: 0.05, bottom: 0.6 }}
      dragSnapToOrigin
      onDragEnd={(_, info) => {
        if (info.offset.y > 40 || info.velocity.y > 400) dismissToast(toast.id);
      }}
    >
      <span className="toast__text">{toast.text}</span>
      {toast.undo && (
        <button
          className="toast__action"
          onClick={() => {
            toast.undo?.();
            dismissToast(toast.id);
          }}
        >
          Undo
        </button>
      )}
    </motion.div>
  );
}

export function Toasts() {
  const { toasts } = useStore();
  return (
    <div className="toasts" aria-live="polite">
      <AnimatePresence>
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} />
        ))}
      </AnimatePresence>
    </div>
  );
}
