import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { DotsNine, X } from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";
import { PEOPLE } from "../shared/sample-data";
import { navigate } from "../state/router";
import { useStore } from "../state/store";

const tom = PEOPLE.find((p) => p.id === "p-tom")!;
const steve = PEOPLE.find((p) => p.id === "p-steve")!;
const helen = PEOPLE.find((p) => p.id === "p-helen")!;

type Item = { label: string; to: string; as?: typeof tom | null; offline?: boolean; reset?: boolean };
const GROUPS: { title: string; items: Item[] }[] = [
  {
    title: "Tablet",
    items: [
      { label: "Sign in", to: "/signin", as: null, reset: true },
      { label: "Sign in, wrong PIN", to: "/signin?person=p-tom&pin=wrong", as: null },
      { label: "Office sign-in", to: "/office", as: null },
      { label: "My Jobs (Tom)", to: "/jobs", as: tom, reset: true },
      { label: "My Jobs, offline", to: "/jobs", as: tom, offline: true },
      { label: "My Jobs, loading", to: "/jobs?state=loading", as: tom },
      { label: "My Jobs, empty", to: "/jobs?state=empty", as: tom },
      { label: "Job J-1042", to: "/job/J-1042", as: tom, reset: true },
      { label: "Drawing gate, J-1045", to: "/job/J-1045", as: tom },
      { label: "Materials check, J-1047", to: "/job/J-1047?as=steve", as: steve },
    ],
  },
  {
    title: "Office",
    items: [
      { label: "Board (Steve)", to: "/board", as: steve },
      { label: "Board, loading", to: "/board?state=loading", as: steve },
      { label: "Board as a director, read only", to: "/board", as: helen },
    ],
  },
  {
    title: "States",
    items: [
      { label: "Conflict", to: "/job/J-1042?demo=conflict", as: steve, reset: true },
      { label: "Permission denied", to: "/job/J-1049?demo=permission", as: tom },
      { label: "Error with a way out", to: "/job/J-1042?demo=error", as: tom },
    ],
  },
];

export function PrototypeMenu() {
  const [open, setOpen] = useState(false);
  const { signIn, signOut, setOnline, reset, online } = useStore();
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onDown);
    };
  }, [open]);

  const go = (item: Item) => {
    if (item.reset) reset();
    if (item.as === null) signOut();
    else if (item.as) signIn(item.as);
    setOnline(!item.offline);
    navigate(item.to);
    setOpen(false);
  };

  return (
    <div className="proto" ref={ref}>
      <AnimatePresence>
        {open && (
          <motion.div
            className="proto__panel"
            role="menu"
            initial={reduce ? { opacity: 0 } : { opacity: 0, transform: "scale(0.94) translateY(8px)" }}
            animate={{ opacity: 1, transform: "scale(1) translateY(0px)" }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, transform: "scale(0.96) translateY(6px)" }}
            transition={{ type: "spring", duration: 0.3, bounce: 0 }}
          >
            <div className="proto__head">
              <span>Prototype screens</span>
              <button className="icon-btn icon-btn--sm" aria-label="Close menu" onClick={() => setOpen(false)}>
                <X size={18} />
              </button>
            </div>
            <div className="proto__groups">
              {GROUPS.map((g) => (
                <div key={g.title} className="proto__group">
                  <div className="proto__group-title">{g.title}</div>
                  {g.items.map((it) => (
                    <button key={it.label} role="menuitem" className="proto__item" onClick={() => go(it)}>
                      {it.label}
                    </button>
                  ))}
                </div>
              ))}
            </div>
            <label className="proto__toggle">
              <input type="checkbox" checked={!online} onChange={(e) => setOnline(!e.target.checked)} />
              Simulate offline
            </label>
          </motion.div>
        )}
      </AnimatePresence>
      <button className="proto__btn" aria-label="Prototype menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <DotsNine size={20} weight="bold" />
        <span>Prototype</span>
      </button>
    </div>
  );
}
