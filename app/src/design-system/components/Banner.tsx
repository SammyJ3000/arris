import { CheckCircle, Info, LockSimple, PencilSimpleLine, Warning, WifiSlash } from "@phosphor-icons/react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";

export type BannerTone = "neutral" | "offline" | "block" | "review" | "error" | "warn" | "info" | "ok";

const ICONS: Record<BannerTone, ReactNode> = {
  neutral: <Info size={24} />,
  offline: <WifiSlash size={24} weight="bold" />,
  block: <LockSimple size={24} weight="bold" />,
  review: <PencilSimpleLine size={24} />,
  error: <Warning size={24} weight="fill" />,
  warn: <Warning size={24} weight="bold" />,
  info: <Info size={24} weight="bold" />,
  ok: <CheckCircle size={24} weight="bold" />,
};

/** An inline notice. For things the person needs to read where they are. */
export function Banner({ tone = "neutral", title, children, actions, icon, role }: { tone?: BannerTone; title?: ReactNode; children?: ReactNode; actions?: ReactNode; icon?: ReactNode; role?: "alert" | "status" }) {
  return (
    <div className={`banner banner--${tone}`} role={role ?? (tone === "error" ? "alert" : "status")}>
      {icon ?? ICONS[tone]}
      <div className="banner__body">
        {title && <strong>{title}</strong>}
        {children && <span>{children}</span>}
        {actions && <div className="banner__actions">{actions}</div>}
      </div>
    </div>
  );
}

/** A banner that arrives and leaves. */
export function AnimatedBanner({ show, ...props }: { show: boolean } & Parameters<typeof Banner>[0]) {
  const reduce = useReducedMotion();
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={reduce ? { opacity: 0 } : { opacity: 0, transform: "translateY(-6px)" }}
          animate={{ opacity: 1, transform: "translateY(0px)" }}
          exit={{ opacity: 0 }}
          transition={{ type: "spring", duration: 0.4, bounce: 0 }}
        >
          <Banner {...props} />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
