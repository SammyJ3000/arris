import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import type { Urgency } from "../shared/domain";
import type { Person } from "../shared/domain";

/* Wordmark: the word, and a mark that is a square with one arris eased. The
   offcut sits beside it in the accent. */
export function Wordmark({ size = 22, withWord = true }: { size?: number; withWord?: boolean }) {
  return (
    <span className="wordmark" style={{ "--wm": `${size}px` } as React.CSSProperties}>
      <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
        <path
          d="M6 2h7.5L22 10.5V18a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V6a4 4 0 0 1 4-4Z"
          fill="var(--c-ink)"
        />
        <path d="M16.5 2H18a4 4 0 0 1 4 4v1.5Z" fill="var(--c-accent)" />
      </svg>
      {withWord && <span className="wordmark__word">Arris</span>}
    </span>
  );
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "quiet";
  size?: "sm" | "md" | "lg";
  icon?: ReactNode;
  block?: boolean;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "secondary", size = "md", icon, block, className = "", children, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      className={`btn btn--${variant} btn--${size} ${block ? "btn--block" : ""} ${className}`}
      {...rest}
    >
      {icon && <span className="btn__icon">{icon}</span>}
      <span>{children}</span>
    </button>
  );
});

export function Avatar({ person, size = 36 }: { person: Person; size?: number }) {
  return (
    <span
      className="avatar"
      style={{ width: size, height: size, fontSize: Math.round(size * 0.38) }}
      title={person.name}
      aria-label={person.name}
    >
      {person.initials}
    </span>
  );
}

export function AvatarStack({ people, size = 32 }: { people: Person[]; size?: number }) {
  if (people.length === 0) return null;
  return (
    <span className="avatar-stack">
      {people.map((p) => (
        <Avatar key={p.id} person={p} size={size} />
      ))}
    </span>
  );
}

export function UrgencyPill({ urgency, children }: { urgency: Urgency; children: ReactNode }) {
  return <span className={`pill pill--${urgency}`}>{children}</span>;
}

export function Pill({ tone = "neutral", children }: { tone?: "neutral" | "accent" | "ok" | "info" | "offline" | "overdue"; children: ReactNode }) {
  return <span className={`pill pill--tone-${tone}`}>{children}</span>;
}

export function Skeleton({ w, h = 16, r = 6, style }: { w?: number | string; h?: number; r?: number; style?: React.CSSProperties }) {
  return <span className="skeleton" style={{ width: w ?? "100%", height: h, borderRadius: r, ...style }} aria-hidden="true" />;
}

export function Section({ title, aside, children, id }: { title: string; aside?: ReactNode; children: ReactNode; id?: string }) {
  return (
    <section className="section" id={id}>
      <header className="section__head">
        <h2 className="t-heading">{title}</h2>
        {aside && <div className="section__aside">{aside}</div>}
      </header>
      {children}
    </section>
  );
}
