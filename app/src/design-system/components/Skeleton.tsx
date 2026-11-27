import type { CSSProperties } from "react";

export function Skeleton({ w, h = 16, r = 6, style }: { w?: number | string; h?: number; r?: number; style?: CSSProperties }) {
  return <span className="skeleton" style={{ width: w ?? "100%", height: h, borderRadius: r, ...style }} aria-hidden="true" />;
}
