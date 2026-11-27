import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { DotsThreeOutline, X } from "@phosphor-icons/react";
import { useStore } from "../state";

/** The small prototype menu. Every area of the brief is one tap from here. */
export function ProtoMenu() {
  const [open, setOpen] = useState(false);
  const { state, dispatch } = useStore();
  const Link = ({ to, children, note }: { to: string; children: string; note?: string }) => (
    <a href={`#${to}`} onClick={() => setOpen(false)}>
      <span>{children}</span>
      {note && <small>{note}</small>}
    </a>
  );
  return (
    <>
      <button className="proto-btn" onClick={() => setOpen(!open)} aria-expanded={open} aria-label="Prototype menu">
        {open ? <X size={18} weight="bold" /> : <DotsThreeOutline size={18} weight="fill" />}
      </button>
      <AnimatePresence>
        {open && (
          <motion.nav
            className="proto-menu"
            initial={{ opacity: 0, transform: "scale(0.96)" }}
            animate={{ opacity: 1, transform: "scale(1)" }}
            exit={{ opacity: 0, transform: "scale(0.96)" }}
            transition={{ duration: 0.18, ease: [0.23, 1, 0.32, 1] }}
          >
            <h3>Tablet, 1180 × 820</h3>
            <Link to="/signin" note="1">Sign-in</Link>
            <Link to="/signin/office" note="1">Office sign-in</Link>
            <Link to="/jobs?as=tom" note="2">My Jobs, Tom</Link>
            <Link to="/job/J-1042?as=tom" note="3">Job J-1042</Link>
            <Link to="/job/J-1042/drawing?rev=C&as=tom" note="3">Drawing viewer</Link>
            <h3>Gates</h3>
            <Link to="/job/J-1045?as=steve" note="4">J-1045, no drawing</Link>
            <Link to="/job/J-1047?as=steve" note="4">J-1047, materials</Link>
            <h3>Desktop, 1440 × 900</h3>
            <Link to="/board?as=steve" note="5">Board, Steve</Link>
            <h3>States</h3>
            <Link to="/states" note="6">All states</Link>
            <button onClick={() => dispatch({ type: "offline", on: !state.offline })}>
              <span>Offline</span>
              <small>{state.offline ? "on" : "off"}</small>
            </button>
            <button onClick={() => dispatch({ type: "loading", on: !state.loading })}>
              <span>Loading skeleton</span>
              <small>{state.loading ? "on" : "off"}</small>
            </button>
          </motion.nav>
        )}
      </AnimatePresence>
    </>
  );
}
