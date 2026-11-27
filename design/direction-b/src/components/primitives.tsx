import { motion, useReducedMotion } from "motion/react";
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

/* ---------- Wordmark ----------
   A datum symbol (the filled triangle on a base line that a drawing measures from)
   followed by the name. */
export function Wordmark({ size = 18 }: { size?: number }) {
  return (
    <span className="wordmark" style={{ fontSize: size }}>
      <svg width={size * 0.95} height={size * 0.95} viewBox="0 0 20 20" aria-hidden="true">
        <path d="M10 3 L17 15 H3 Z" fill="currentColor" />
        <path d="M1 17.5 H19" stroke="currentColor" strokeWidth="1.6" />
      </svg>
      <span>Datum</span>
    </span>
  );
}

/* ---------- Revision triangle ----------
   The drafting convention for a revision: a triangle with the letter inside. */
export function RevMark({
  rev,
  size = 28,
  superseded = false,
  tone = "ink",
  className = "",
}: {
  rev?: string;
  size?: number;
  superseded?: boolean;
  tone?: "ink" | "blue" | "red" | "empty";
  className?: string;
}) {
  const label = rev ? `Revision ${rev}${superseded ? ", superseded" : ""}` : "No revision";
  return (
    <span
      className={`rev-mark rev-mark--${rev ? tone : "empty"} ${superseded ? "is-superseded" : ""} ${className}`}
      style={{ width: size, height: size, fontSize: size * 0.46 }}
      role="img"
      aria-label={label}
    >
      <svg viewBox="0 0 32 32" width={size} height={size} aria-hidden="true">
        <path
          d="M16 3 L30 28 H2 Z"
          fill={rev && !superseded && tone !== "empty" ? "var(--sheet)" : "none"}
          stroke="currentColor"
          strokeWidth={rev ? 1.8 : 1.4}
          strokeDasharray={rev ? undefined : "3 3"}
          strokeLinejoin="round"
        />
      </svg>
      <span className="rev-mark__letter">{rev ?? "?"}</span>
    </span>
  );
}

/* ---------- Approval stamp ----------
   Rubber stamp, slightly off square, with an ink-bleed filter. Lands with a spring. */
export function Stamp({
  lines,
  tone = "blue",
  animate = false,
  compact = false,
  rotate = -5,
  onLanded,
}: {
  lines: string[];
  tone?: "blue" | "red" | "green" | "ink";
  animate?: boolean;
  compact?: boolean;
  rotate?: number;
  onLanded?: () => void;
}) {
  const reduce = useReducedMotion();
  const [title, ...rest] = lines;
  const body = (
    <div className={`stamp stamp--${tone} ${compact ? "stamp--compact" : ""}`} style={{ rotate: `${rotate}deg` } as CSSProperties}>
      <div className="stamp__title">{title}</div>
      {rest.map((l, i) => (
        <div className="stamp__line" key={i}>
          {l}
        </div>
      ))}
    </div>
  );
  if (!animate || reduce) return <div className="stamp-wrap">{body}</div>;
  return (
    <motion.div
      className="stamp-wrap"
      initial={{ opacity: 0, transform: "scale(1.6)" }}
      animate={{ opacity: 1, transform: "scale(1)" }}
      transition={{ type: "spring", duration: 0.42, bounce: 0.18 }}
      onAnimationComplete={onLanded}
    >
      {body}
    </motion.div>
  );
}

/* ---------- Dimension line ----------
   Extension ticks at each end, the line broken for its text. Used for anything
   that reads as "how much": hours in a stage, a span on a card. */
export function Dimension({
  label,
  tone = "ink",
  size = "md",
  className = "",
}: {
  label: ReactNode;
  tone?: "ink" | "blue" | "red" | "amber" | "muted";
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  return (
    <span className={`dim dim--${tone} dim--${size} ${className}`} aria-hidden={typeof label !== "string"}>
      <span className="dim__tick" />
      <span className="dim__line" />
      <span className="dim__text mono">{label}</span>
      <span className="dim__line" />
      <span className="dim__tick" />
    </span>
  );
}

/* ---------- Revision cloud ----------
   The scalloped outline a draughtsman draws around what changed. Wraps a block and
   redraws itself when the block resizes. */
export function RevisionCloud({
  children,
  tone = "blue",
  className = "",
  scallop = 14,
}: {
  children: ReactNode;
  tone?: "blue" | "red" | "amber";
  className?: string;
  scallop?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ w: 0, h: 0 });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => {
      const r = e.contentRect;
      setBox({ w: r.width, h: r.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const pad = scallop * 1.2;
  const w = box.w + pad * 2;
  const h = box.h + pad * 2;
  return (
    <div ref={ref} className={`rev-cloud rev-cloud--${tone} ${className}`} style={{ "--cloud-pad": `${pad}px` } as CSSProperties}>
      {w > 0 && (
        <svg className="rev-cloud__svg" width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true">
          <path d={cloudPath(w, h, scallop)} fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
      )}
      {children}
    </div>
  );
}

/* Arcs of about 200 degrees (radius 0.52 of the chord, large-arc flag on), so the
   bumps are puffy and overlap at the cusps, the way a cloud is drawn by hand. */
export function cloudPath(w: number, h: number, s: number, ox = 0, oy = 0): string {
  const r = s * 0.52;
  const inset = r * 1.45; // clears the apex of a 200 degree arc
  const x0 = ox + inset, y0 = oy + inset, x1 = ox + w - inset, y1 = oy + h - inset;
  const nx = Math.max(2, Math.round((x1 - x0) / s));
  const ny = Math.max(2, Math.round((y1 - y0) / s));
  const sx = (x1 - x0) / nx;
  const sy = (y1 - y0) / ny;
  const rx = sx * 0.52, ry = sy * 0.52;
  let d = `M ${x0} ${y0}`;
  for (let i = 0; i < nx; i++) d += ` A ${rx} ${rx} 0 1 1 ${x0 + sx * (i + 1)} ${y0}`;
  for (let i = 0; i < ny; i++) d += ` A ${ry} ${ry} 0 1 1 ${x1} ${y0 + sy * (i + 1)}`;
  for (let i = 0; i < nx; i++) d += ` A ${rx} ${rx} 0 1 1 ${x1 - sx * (i + 1)} ${y1}`;
  for (let i = 0; i < ny; i++) d += ` A ${ry} ${ry} 0 1 1 ${x0} ${y1 - sy * (i + 1)}`;
  return d + " Z";
}

/* ---------- Button ---------- */
export function Button({
  children,
  variant = "secondary",
  size = "md",
  icon,
  iconRight,
  className = "",
  full = false,
  ...rest
}: {
  children: ReactNode;
  variant?: "primary" | "secondary" | "ghost" | "danger" | "ink";
  size?: "sm" | "md" | "lg" | "xl";
  icon?: ReactNode;
  iconRight?: ReactNode;
  full?: boolean;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={`btn btn--${variant} btn--${size} ${full ? "btn--full" : ""} ${className}`}
      {...rest}
    >
      {icon && <span className="btn__icon">{icon}</span>}
      <span className="btn__label">{children}</span>
      {iconRight && <span className="btn__icon btn__icon--right">{iconRight}</span>}
    </button>
  );
}

/* ---------- Skeleton ---------- */
export function Skeleton({ w = "100%", h = 16, className = "", style }: { w?: string | number; h?: number; className?: string; style?: CSSProperties }) {
  return <span className={`skeleton ${className}`} style={{ width: w, height: h, ...style }} aria-hidden="true" />;
}

/* ---------- Label/value pair for title blocks ---------- */
export function Cell({
  label,
  children,
  className = "",
  mono = false,
}: {
  label: string;
  children: ReactNode;
  className?: string;
  mono?: boolean;
}) {
  return (
    <div className={`tb-cell ${className}`}>
      <span className="tb-cell__label">{label}</span>
      <span className={`tb-cell__value ${mono ? "mono" : ""}`}>{children}</span>
    </div>
  );
}

/* ---------- Mounted flag for CSS enter transitions ---------- */
export function useMounted() {
  const [m, setM] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setM(true));
    return () => cancelAnimationFrame(id);
  }, []);
  return m;
}
