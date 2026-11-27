import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

export interface ToastOptions {
  /** Shown as a button on the toast. */
  action?: { label: string; onClick: () => void };
  tone?: "neutral" | "error";
  /** ms. Defaults to 4.5 s, or 7 s with an action. */
  duration?: number;
}

export interface ToastItem extends ToastOptions {
  id: number;
  text: string;
}

interface ToastApi {
  toast: (text: string, opts?: ToastOptions) => number;
  dismiss: (id: number) => void;
}

const Ctx = createContext<ToastApi | null>(null);
let seq = 1;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const dismiss = useCallback((id: number) => setItems((t) => t.filter((x) => x.id !== id)), []);
  const toast = useCallback((text: string, opts: ToastOptions = {}) => {
    const id = seq++;
    setItems((t) => [...t.slice(-2), { id, text, ...opts }]);
    return id;
  }, []);
  const api = useMemo(() => ({ toast, dismiss }), [toast, dismiss]);
  return (
    <Ctx.Provider value={api}>
      {children}
      <Toasts items={items} dismiss={dismiss} />
    </Ctx.Provider>
  );
}

export function useToast(): ToastApi {
  const api = useContext(Ctx);
  if (!api) throw new Error("useToast must be used inside ToastProvider");
  return api;
}

function ToastView({ item, dismiss }: { item: ToastItem; dismiss: (id: number) => void }) {
  const reduce = useReducedMotion();
  const timer = useRef<number | null>(null);
  useEffect(() => {
    const ms = item.duration ?? (item.action ? 7000 : 4500);
    const start = () => {
      timer.current = window.setTimeout(() => dismiss(item.id), ms);
    };
    const stop = () => {
      if (timer.current) window.clearTimeout(timer.current);
    };
    // Pause while the tab is hidden, so a toast is not missed.
    const onVis = () => (document.hidden ? stop() : start());
    start();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [item, dismiss]);
  return (
    <motion.div
      layout
      className={`toast ${item.tone === "error" ? "toast--error" : ""}`}
      role={item.tone === "error" ? "alert" : "status"}
      initial={reduce ? { opacity: 0 } : { opacity: 0, transform: "translateY(-12px) scale(0.98)" }}
      animate={{ opacity: 1, transform: "translateY(0px) scale(1)" }}
      exit={reduce ? { opacity: 0 } : { opacity: 0, transform: "translateY(-12px) scale(0.98)" }}
      transition={{ type: "spring", duration: 0.45, bounce: 0.1 }}
      drag={reduce ? false : "y"}
      dragConstraints={{ top: 0, bottom: 0 }}
      dragElastic={{ top: 0.6, bottom: 0.05 }}
      dragSnapToOrigin
      onDragEnd={(_, info) => {
        if (info.offset.y < -40 || info.velocity.y < -400) dismiss(item.id);
      }}
    >
      <span className="toast__text">{item.text}</span>
      {item.action && (
        <button
          className="toast__action"
          onClick={() => {
            item.action?.onClick();
            dismiss(item.id);
          }}
        >
          {item.action.label}
        </button>
      )}
    </motion.div>
  );
}

export function Toasts({ items, dismiss }: { items: ToastItem[]; dismiss: (id: number) => void }) {
  return (
    <div className="toasts" aria-live="polite">
      <AnimatePresence>
        {items.map((t) => (
          <ToastView key={t.id} item={t} dismiss={dismiss} />
        ))}
      </AnimatePresence>
    </div>
  );
}

/** A toast rendered in place, for the design system page. */
export function StaticToast({ text, action, tone }: { text: string; action?: string; tone?: "neutral" | "error" }) {
  return (
    <div className={`toast ${tone === "error" ? "toast--error" : ""}`} style={{ pointerEvents: "none" }}>
      <span className="toast__text">{text}</span>
      {action && <span className="toast__action">{action}</span>}
    </div>
  );
}
