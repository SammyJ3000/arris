import type { CSSProperties } from "react";

/** The mark: a square with one arris eased, the offcut beside it in the accent. */
export function Mark({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6 2h7.5L22 10.5V18a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V6a4 4 0 0 1 4-4Z" fill="var(--c-ink)" />
      <path d="M16.5 2H18a4 4 0 0 1 4 4v1.5Z" fill="var(--c-accent)" />
    </svg>
  );
}

export function Wordmark({ size = 22, withWord = true }: { size?: number; withWord?: boolean }) {
  return (
    <span className="wordmark" style={{ "--wm": `${size}px` } as CSSProperties}>
      <Mark size={size} />
      {withWord && <span className="wordmark__word">Arris</span>}
    </span>
  );
}
