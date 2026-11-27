import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { Link, type LinkProps } from "react-router";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "quiet" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

interface Common {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: ReactNode;
  block?: boolean;
}

export function buttonClass({ variant = "secondary", size = "md", block, busy, className = "" }: Common & { busy?: boolean; className?: string }) {
  return ["btn", `btn--${variant}`, `btn--${size}`, block ? "btn--block" : "", busy ? "btn--busy" : "", className].filter(Boolean).join(" ");
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
  Common & {
    /** Working on it. Disables the button and shows a spinner in place of the icon. */
    busy?: boolean;
  };

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "secondary", size = "md", icon, block, busy, className = "", children, disabled, ...rest },
  ref,
) {
  return (
    <button ref={ref} className={buttonClass({ variant, size, block, busy, className })} disabled={disabled || busy} aria-busy={busy || undefined} {...rest}>
      {busy ? <span className="btn__icon"><span className="btn__spinner" aria-hidden="true" /></span> : icon ? <span className="btn__icon">{icon}</span> : null}
      <span className="btn__label">{children}</span>
    </button>
  );
});

/** A link that looks like a button. For navigation, never for actions. */
export function ButtonLink({ variant, size, icon, block, className = "", children, ...rest }: LinkProps & Common) {
  return (
    <Link className={buttonClass({ variant, size, block, className })} {...rest}>
      {icon && <span className="btn__icon">{icon}</span>}
      <span className="btn__label">{children}</span>
    </Link>
  );
}

export const IconButton = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & { label: string; size?: "sm" | "md"; strong?: boolean }
>(function IconButton({ label, size = "md", strong, className = "", children, ...rest }, ref) {
  return (
    <button ref={ref} className={`icon-btn ${size === "sm" ? "icon-btn--sm" : ""} ${strong ? "icon-btn--strong" : ""} ${className}`} aria-label={label} title={label} {...rest}>
      {children}
    </button>
  );
});
