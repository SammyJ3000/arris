import * as RadixDialog from "@radix-ui/react-dialog";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";

const dialogSpring = { type: "spring", duration: 0.35, bounce: 0 } as const;

export type DialogTone = "neutral" | "warn" | "block" | "danger";

/**
 * Centred dialog for decisions that need protected focus: gates, conflicts,
 * anything where the person must choose before carrying on. Stays centred
 * (it is not anchored to a trigger), scales from 0.96, never from nothing.
 */
export function Dialog({
  open,
  onClose,
  title,
  children,
  tone = "neutral",
  dismissable = true,
  description,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  tone?: DialogTone;
  dismissable?: boolean;
  /** Read to assistive tech. Defaults to the title. */
  description?: string;
}) {
  const reduce = useReducedMotion();
  return (
    <AnimatePresence>
      {open && (
        <RadixDialog.Root open onOpenChange={(o) => !o && dismissable && onClose()}>
          <RadixDialog.Portal forceMount>
            <RadixDialog.Overlay asChild forceMount>
              <motion.div className="scrim" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} />
            </RadixDialog.Overlay>
            <RadixDialog.Content asChild forceMount>
              <motion.div
                className={`dialog dialog--${tone}`}
                initial={reduce ? { opacity: 0 } : { opacity: 0, transform: "scale(0.96) translateY(8px)" }}
                animate={{ opacity: 1, transform: "scale(1) translateY(0px)" }}
                exit={reduce ? { opacity: 0 } : { opacity: 0, transform: "scale(0.98) translateY(4px)" }}
                transition={dialogSpring}
              >
                <RadixDialog.Title className="dialog__title">{title}</RadixDialog.Title>
                <RadixDialog.Description className="visually-hidden">{description ?? title}</RadixDialog.Description>
                {children}
              </motion.div>
            </RadixDialog.Content>
          </RadixDialog.Portal>
        </RadixDialog.Root>
      )}
    </AnimatePresence>
  );
}

export function DialogBody({ children, muted }: { children: ReactNode; muted?: boolean }) {
  return <p className={`dialog__body ${muted ? "t-muted" : ""}`}>{children}</p>;
}

export function DialogActions({ children }: { children: ReactNode }) {
  return <div className="dialog__actions">{children}</div>;
}
