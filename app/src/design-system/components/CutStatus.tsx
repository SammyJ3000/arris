import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Check, Warning } from "@phosphor-icons/react";
import type { Cut } from "@/domain/domain";
import { CUT_LABEL, CUT_ORDER } from "@/domain/helpers";

/** One tap moves a component along Pending, Cut, Edged, Complete. */
export function CutStatusButton({ cut, onClick, disabled }: { cut: Cut; onClick: () => void; disabled?: boolean }) {
  const reduce = useReducedMotion();
  const done = cut.status === "complete";
  const next = CUT_ORDER[CUT_ORDER.indexOf(cut.status) + 1];
  return (
    <motion.button
      className={`cstat cstat--${cut.status}`}
      onClick={onClick}
      disabled={done || disabled}
      aria-label={done ? `${cut.label}: complete` : `${cut.label}: ${CUT_LABEL[cut.status]}. Tap to mark ${CUT_LABEL[next ?? "pending"].toLowerCase()}`}
      whileTap={reduce || done ? undefined : { scale: 0.96 }}
      transition={{ type: "spring", duration: 0.25, bounce: 0 }}
    >
      <span className="cstat__steps" aria-hidden="true">
        {CUT_ORDER.slice(1).map((s, i) => (
          <span key={s} className={`cstat__step ${CUT_ORDER.indexOf(cut.status) > i ? "cstat__step--on" : ""}`} />
        ))}
      </span>
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={cut.status}
          className="cstat__label"
          initial={reduce ? { opacity: 0 } : { opacity: 0, transform: "translateY(6px)", filter: "blur(2px)" }}
          animate={{ opacity: 1, transform: "translateY(0px)", filter: "blur(0px)" }}
          exit={reduce ? { opacity: 0 } : { opacity: 0, transform: "translateY(-6px)", filter: "blur(2px)" }}
          transition={{ duration: 0.18, ease: [0.23, 1, 0.32, 1] }}
        >
          {CUT_LABEL[cut.status]}
        </motion.span>
      </AnimatePresence>
      {done && <Check size={18} weight="bold" />}
    </motion.button>
  );
}

export function CutRow({ cut, onAdvance, onFlag, disabled }: { cut: Cut; onAdvance: () => void; onFlag: () => void; disabled?: boolean }) {
  return (
    <li className={`cut ${cut.status === "complete" ? "cut--done" : ""} ${cut.status === "issue" ? "cut--issue" : ""}`}>
      <div className="cut__main">
        <span className="cut__label">{cut.label}</span>
        <span className="cut__spec">
          {cut.qty} × {cut.dims} mm, {cut.material}. Edging: {cut.edging.toLowerCase()}
        </span>
      </div>
      <div className="cut__actions">
        <button
          className={`cut__issue ${cut.status === "issue" ? "cut__issue--on" : ""}`}
          aria-label={cut.status === "issue" ? "Clear issue" : "Flag an issue"}
          aria-pressed={cut.status === "issue"}
          onClick={onFlag}
          disabled={disabled}
        >
          <Warning size={22} weight={cut.status === "issue" ? "fill" : "regular"} />
        </button>
        <CutStatusButton cut={cut} onClick={onAdvance} disabled={disabled} />
      </div>
    </li>
  );
}
