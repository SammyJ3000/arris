import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Backspace } from "@phosphor-icons/react";
import { useState, type ReactNode } from "react";

export interface PinPadProps {
  /** Called when four digits are in. Resolve to an error message to shake and clear. */
  onComplete: (pin: string) => Promise<string | null> | string | null;
  hint?: string;
  disabled?: boolean;
  /** Show this error from the start (for the design system). */
  initialError?: string | null;
}

/**
 * Four dots and a keypad. Keys respond on pointer-down. A wrong PIN shakes
 * the dots, shows why, and clears; the person tries again or gets Steve.
 */
export function PinPad({ onComplete, hint = "Enter your four-digit PIN", disabled, initialError = null }: PinPadProps) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(initialError);
  const [shake, setShake] = useState(0);
  const [checking, setChecking] = useState(false);
  const reduce = useReducedMotion();

  const check = (full: string) => {
    setChecking(true);
    Promise.resolve(onComplete(full)).then((msg) => {
      setChecking(false);
      if (msg) {
        setError(msg);
        setShake((s) => s + 1);
        setPin("");
      }
    });
  };

  const press = (d: string) => {
    if (disabled || checking || pin.length >= 4) return;
    setError(null);
    const next = pin + d;
    setPin(next);
    if (next.length === 4) check(next);
  };

  return (
    <div className="pin">
      <motion.div
        key={shake}
        className={`pin__dots ${error ? "pin__dots--wrong" : ""}`}
        animate={reduce || shake === 0 ? undefined : { transform: ["translateX(0px)", "translateX(-10px)", "translateX(9px)", "translateX(-6px)", "translateX(4px)", "translateX(0px)"] }}
        transition={{ duration: 0.36, ease: "easeOut" }}
        aria-live="polite"
        aria-label={error ? "PIN did not match" : `${pin.length} of 4 digits entered`}
      >
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className={`pin__dot ${i < pin.length ? "pin__dot--on" : ""}`} />
        ))}
      </motion.div>
      <div className="pin__msg" role="status">
        <AnimatePresence mode="wait" initial={false}>
          {error ? (
            <motion.span key="err" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="pin__wrong">
              {error}
            </motion.span>
          ) : (
            <motion.span key="hint" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              {checking ? "Checking" : hint}
            </motion.span>
          )}
        </AnimatePresence>
      </div>
      <div className="keypad">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((k) => (
          <Key key={k} onPress={() => press(k)} disabled={disabled}>
            {k}
          </Key>
        ))}
        <span />
        <Key onPress={() => press("0")} disabled={disabled}>
          0
        </Key>
        <Key onPress={() => setPin((p) => p.slice(0, -1))} label="Delete" disabled={disabled}>
          <Backspace size={28} />
        </Key>
      </div>
    </div>
  );
}

function Key({ children, onPress, label, disabled }: { children: ReactNode; onPress: () => void; label?: string; disabled?: boolean }) {
  const reduce = useReducedMotion();
  return (
    <motion.button
      className="key"
      aria-label={label}
      disabled={disabled}
      onPointerDown={(e) => {
        e.preventDefault();
        onPress();
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onPress();
        }
      }}
      whileTap={reduce ? undefined : { scale: 0.94 }}
      transition={{ type: "spring", duration: 0.2, bounce: 0 }}
    >
      {children}
    </motion.button>
  );
}
