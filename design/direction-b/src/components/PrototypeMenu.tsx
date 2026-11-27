// A small tab on the sheet edge. Lists every area and every designed state so the
// whole prototype is reachable without knowing the routes.

import { useEffect, useRef, useState } from "react";
import { navigate } from "../router";
import { useStore } from "../store";
import { PEOPLE } from "../shared/sample-data";

const AREAS: [string, string][] = [
  ["Tablet sign-in", "/signin"],
  ["Office sign-in", "/office"],
  ["My Jobs (Tom)", "/jobs?as=tom"],
  ["Job J-1042", "/job/J-1042?as=tom"],
  ["Drawing viewer", "/job/J-1042/drawing?as=tom"],
  ["Gate: drawing (J-1045)", "/job/J-1045?as=steve&gate=1"],
  ["Gate: materials (J-1047)", "/job/J-1047?as=steve&gate=1"],
  ["Board (Steve)", "/board?as=steve"],
];

const STATES: [string, string][] = [
  ["Loading", "/jobs?as=tom&loading=1"],
  ["Empty", "/jobs?as=ryan"],
  ["Offline", "/jobs?as=tom&offline=1"],
  ["Conflict", "/job/J-1042?as=tom&conflict=1"],
  ["Permission denied", "/job/J-1049?as=tom&denied=1"],
  ["Error with a way out", "/job/J-1042?as=tom&error=1"],
  ["Wrong PIN", "/signin?wrong=1"],
];

export function PrototypeMenu() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { state, dispatch } = useStore();

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const go = (to: string) => {
    setOpen(false);
    navigate(to);
  };

  return (
    <div className="proto" ref={ref}>
      <button
        type="button"
        className={`proto__tab mono ${open ? "is-open" : ""}`}
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls="proto-menu"
      >
        Prototype
      </button>
      {open && (
        <div className="proto__menu" id="proto-menu">
          <div className="proto__col">
            <div className="proto__heading">Areas</div>
            {AREAS.map(([label, to]) => (
              <button key={to} type="button" className="proto__item" onClick={() => go(to)}>
                {label}
              </button>
            ))}
          </div>
          <div className="proto__col">
            <div className="proto__heading">States</div>
            {STATES.map(([label, to]) => (
              <button key={to} type="button" className="proto__item" onClick={() => go(to)}>
                {label}
              </button>
            ))}
            <div className="proto__heading">Toggles</div>
            <label className="proto__toggle">
              <input
                type="checkbox"
                checked={state.offline}
                onChange={(e) => dispatch({ type: "set-offline", offline: e.target.checked })}
              />
              <span>Offline</span>
            </label>
            <div className="proto__heading">Signed in as</div>
            <div className="proto__who mono">{state.user?.name ?? "Nobody"}</div>
            {["p-tom", "p-steve", "p-helen", "p-ryan"].map((id) => {
              const p = PEOPLE.find((x) => x.id === id)!;
              return (
                <button
                  key={id}
                  type="button"
                  className="proto__item"
                  onClick={() => {
                    dispatch({ type: "sign-in", person: p });
                    setOpen(false);
                  }}
                >
                  {p.name} <span className="proto__role">{p.teamRole ?? p.role}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
