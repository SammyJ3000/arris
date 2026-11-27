// The dev menu. It drives the in-memory source's scenario controls so every
// outcome can be reached on demand while there is no back end: the screens
// themselves only ever see outcomes. It also honours a few URL parameters so a
// screenshot script can open any state directly:
//
//   ?as=p-tom          sign in as a person without a PIN
//   ?dev=loading       hold reads in loading
//   ?dev=error         reads fail
//   ?dev=offline       offline, writes queue
//   ?dev=conflict      the next write to the job on this page meets a change from the bench tablet
//   ?dev=fail          the next write fails
//   ?dev=slow          500 ms round trips
//   ?dev=late          an offline change of Tom's was answered later with a conflict
//   ?dev=reset         back to the sample data, signed out
//
// It only exists on the memory source: with the real back end (Stage 2c) the
// provider holds null and the menu renders nothing. ?as= takes a slug such as
// p-tom or a person id.

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { DotsNine, X } from "@phosphor-icons/react";
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router";
import { useConnectivity, useSession, type MemorySource } from "@/data";
import { PERSON_ID } from "@/domain/demo";
import { PEOPLE } from "@/domain/sample-data";

const Ctx = createContext<MemorySource | null>(null);

/** source is null on the real back end, where there is no dev menu. */
export function DevProvider({ source, children }: { source: MemorySource | null; children: ReactNode }) {
  return <Ctx.Provider value={source}>{children}</Ctx.Provider>;
}

function useDev(): MemorySource["dev"] {
  const s = useContext(Ctx);
  if (!s) throw new Error("DevProvider missing");
  return s.dev;
}

type Item = { label: string; to: string; as?: string | null; dev?: string; reset?: boolean };

const GROUPS: { title: string; items: Item[] }[] = [
  {
    title: "Floor",
    items: [
      { label: "Sign in", to: "/signin", as: null, reset: true },
      { label: "My Jobs, Tom", to: "/jobs", as: "p-tom", reset: true },
      { label: "My Jobs, offline", to: "/jobs", as: "p-tom", dev: "offline" },
      { label: "My Jobs, loading", to: "/jobs", as: "p-tom", dev: "loading" },
      { label: "My Jobs, couldn't load", to: "/jobs", as: "p-tom", dev: "error" },
      { label: "My Jobs, empty (Ryan, spray)", to: "/jobs", as: "p-ryan", reset: true },
      { label: "Job J-1042", to: "/job/J-1042", as: "p-tom", reset: true },
      { label: "Drawing gate, J-1045", to: "/job/J-1045", as: "p-tom" },
      { label: "Permission denied, J-1049", to: "/job/J-1049", as: "p-tom" },
      { label: "Query fails to send, J-1042", to: "/job/J-1042", as: "p-tom", dev: "fail" },
      { label: "Offline change refused later", to: "/jobs", as: "p-tom", dev: "late", reset: true },
    ],
  },
  {
    title: "Office",
    items: [
      { label: "Office sign-in", to: "/signin/office", as: null },
      { label: "Today, Steve", to: "/today", as: "p-steve", reset: true },
      { label: "Board, Steve", to: "/board", as: "p-steve", reset: true },
      { label: "Board, loading", to: "/board", as: "p-steve", dev: "loading" },
      { label: "Board as Helen, read only", to: "/board", as: "p-helen" },
      { label: "Materials check, J-1047", to: "/job/J-1047", as: "p-steve", reset: true },
      { label: "Conflict on J-1042", to: "/job/J-1042", as: "p-steve", dev: "conflict", reset: true },
      { label: "People and settings", to: "/settings", as: "p-steve" },
      { label: "Design system", to: "/design-system" },
    ],
  },
];

/** Applies ?as= and ?dev= from a URL to the source. Called once before the
 * first render (so a deep link is signed in before the route guard looks) and
 * again on every in-app navigation. */
export function applyUrlScenario(dev: MemorySource["dev"], search: string, pathname: string) {
  const q = new URLSearchParams(search);
  const as = q.get("as");
  if (as) dev.signInAs(as);
  const scenario = q.get("dev");
  if (scenario) applyScenario(dev, scenario, pathname);
}

function useUrlScenario() {
  const dev = useDev();
  const { search, pathname } = useLocation();
  useEffect(() => {
    applyUrlScenario(dev, search, pathname);
  }, [dev, search, pathname]);
}

function applyScenario(dev: MemorySource["dev"], scenario: string, pathname: string) {
  dev.holdReads(false);
  dev.setLatency(0);
  switch (scenario) {
    case "reset":
      dev.reset();
      break;
    case "loading":
      dev.holdReads(true);
      break;
    case "error":
      dev.failReads();
      break;
    case "offline":
      dev.setOffline(true);
      break;
    case "fail":
      dev.failNextWrite();
      break;
    case "slow":
      dev.setLatency(500);
      break;
    case "conflict": {
      const id = pathname.match(/\/job\/([^/]+)/)?.[1];
      if (id) dev.armRemoteChange(id, { by: PERSON_ID.tom, device: "Bench tablet", to: "cnc", secondsAgo: 120, summary: "sent it back to CNC / Machining for a recut" });
      break;
    }
    case "late":
      dev.lateConflict("J-1042");
      break;
  }
}

export function DevMenu() {
  return useContext(Ctx) ? <DevMenuInner /> : null;
}

function DevMenuInner() {
  useUrlScenario();
  const dev = useDev();
  const { online } = useConnectivity();
  const { session } = useSession();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
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
    if (item.reset) dev.reset();
    if (item.as === null) dev.reset();
    else if (item.as) dev.signInAs(item.as);
    dev.setOffline(false);
    dev.holdReads(false);
    if (item.dev) applyScenario(dev, item.dev, item.to);
    navigate(item.to);
    setOpen(false);
  };

  return (
    <div className="dev" ref={ref}>
      <AnimatePresence>
        {open && (
          <motion.div
            className="dev__panel"
            role="menu"
            initial={reduce ? { opacity: 0 } : { opacity: 0, transform: "scale(0.94) translateY(8px)" }}
            animate={{ opacity: 1, transform: "scale(1) translateY(0px)" }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, transform: "scale(0.96) translateY(6px)" }}
            transition={{ type: "spring", duration: 0.3, bounce: 0 }}
          >
            <div className="dev__head">
              <span>Scenarios</span>
              <button className="icon-btn icon-btn--sm" aria-label="Close menu" onClick={() => setOpen(false)}>
                <X size={18} />
              </button>
            </div>
            <div className="dev__groups">
              {GROUPS.map((g) => (
                <div key={g.title}>
                  <div className="dev__group-title">{g.title}</div>
                  {g.items.map((it) => (
                    <button key={it.label} role="menuitem" className="dev__item" onClick={() => go(it)}>
                      {it.label}
                    </button>
                  ))}
                </div>
              ))}
              <div>
                <div className="dev__group-title">Signed in as</div>
                {PEOPLE.map((p) => (
                  <button key={p.id} role="menuitem" className="dev__item" onClick={() => { dev.signInAs(p.id); setOpen(false); }} aria-current={session?.person.id === p.id ? "true" : undefined}>
                    {p.name}{session?.person.id === p.id ? " (now)" : ""}
                  </button>
                ))}
              </div>
            </div>
            <label className="dev__toggle">
              <input type="checkbox" checked={!online} onChange={(e) => dev.setOffline(e.target.checked)} />
              Simulate offline
            </label>
            <label className="dev__toggle">
              <input type="checkbox" onChange={(e) => dev.setLatency(e.target.checked ? 600 : 0)} />
              Slow connection
            </label>
          </motion.div>
        )}
      </AnimatePresence>
      <button className="dev__btn" aria-label="Scenario menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <DotsNine size={20} weight="bold" />
        <span>Scenarios</span>
      </button>
    </div>
  );
}
