import * as Dialog from "@radix-ui/react-dialog";
import { AnimatePresence, motion, useReducedMotion, type PanInfo } from "motion/react";
import { X } from "@phosphor-icons/react";
import type { ReactNode } from "react";

const sheetSpring = { type: "spring", duration: 0.5, bounce: 0 } as const;
const dialogSpring = { type: "spring", duration: 0.35, bounce: 0 } as const;

/**
 * Bottom sheet. Springs up from the bottom edge, can be dragged back down and
 * released with a flick. Exits the way it entered.
 */
export function Sheet({
  open,
  onClose,
  title,
  description,
  children,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  wide?: boolean;
}) {
  const reduce = useReducedMotion();
  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.y > 120 || info.velocity.y > 600) onClose();
  };
  return (
    <AnimatePresence>
      {open && (
        <Dialog.Root open onOpenChange={(o) => !o && onClose()}>
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild forceMount>
              <motion.div
                className="scrim"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.22 }}
              />
            </Dialog.Overlay>
            <Dialog.Content
              asChild
              forceMount
              aria-describedby={undefined}
              onOpenAutoFocus={(e) => {
                e.preventDefault();
                (e.currentTarget as HTMLElement | null)?.focus?.();
              }}
            >
              <motion.div
                tabIndex={-1}
                className={`sheet ${wide ? "sheet--wide" : ""}`}
                initial={reduce ? { opacity: 0 } : { y: "100%" }}
                animate={reduce ? { opacity: 1 } : { y: 0 }}
                exit={reduce ? { opacity: 0 } : { y: "100%" }}
                transition={sheetSpring}
                drag={reduce ? false : "y"}
                dragConstraints={{ top: 0, bottom: 0 }}
                dragElastic={{ top: 0.04, bottom: 0.7 }}
                dragSnapToOrigin
                onDragEnd={onDragEnd}
              >
                <div className="sheet__grabber" aria-hidden="true" />
                <header className="sheet__head">
                  <div>
                    <Dialog.Title className="sheet__title">{title}</Dialog.Title>
                    {description && <Dialog.Description className="sheet__desc">{description}</Dialog.Description>}
                  </div>
                  <Dialog.Close asChild>
                    <button className="icon-btn" aria-label="Close">
                      <X size={22} />
                    </button>
                  </Dialog.Close>
                </header>
                <div className="sheet__body">{children}</div>
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      )}
    </AnimatePresence>
  );
}

/** Centred dialog for decisions that need protected focus: gates, conflicts. */
export function Decision({
  open,
  onClose,
  title,
  children,
  tone = "neutral",
  dismissable = true,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  tone?: "neutral" | "warn" | "block";
  dismissable?: boolean;
}) {
  const reduce = useReducedMotion();
  return (
    <AnimatePresence>
      {open && (
        <Dialog.Root open onOpenChange={(o) => !o && dismissable && onClose()}>
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild forceMount>
              <motion.div
                className="scrim"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
              />
            </Dialog.Overlay>
            <Dialog.Content asChild forceMount aria-describedby={undefined}>
              <motion.div
                className={`decision decision--${tone}`}
                initial={reduce ? { opacity: 0 } : { opacity: 0, transform: "scale(0.96) translateY(8px)" }}
                animate={{ opacity: 1, transform: "scale(1) translateY(0px)" }}
                exit={reduce ? { opacity: 0 } : { opacity: 0, transform: "scale(0.98) translateY(4px)" }}
                transition={dialogSpring}
              >
                <Dialog.Title className="decision__title">{title}</Dialog.Title>
                {children}
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      )}
    </AnimatePresence>
  );
}
