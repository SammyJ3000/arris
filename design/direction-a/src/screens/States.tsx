import { Topbar } from "../components/Topbar";
import { href } from "../router";

const STATES: { title: string; desc: string; to: string }[] = [
  { title: "Loading", desc: "My Jobs while the board is fetched. Painted outlines where the tickets will land, no spinner.", to: "/jobs?as=tom&loading=1" },
  { title: "Empty", desc: "Ryan on the spray booth with nothing assigned. The screen says what to do instead.", to: "/jobs?as=ryan" },
  { title: "Offline", desc: "The tablet has lost the signal. Work carries on and changes queue up.", to: "/jobs?as=tom&offline=1" },
  { title: "Conflict", desc: "Steve moves J-1042 on his laptop, but Tom changed it on the bench tablet two minutes ago. Press the pass-on button.", to: "/job/J-1042?as=steve&conflict=1" },
  { title: "Permission denied", desc: "Tom tries to mark J-1049 as delivered. Manager only, and the screen says who can.", to: "/job/J-1049?as=tom" },
  { title: "Error with a way out", desc: "Saving fails halfway. Nothing lost, try again or go back. Press the pass-on button.", to: "/job/J-1042?as=tom&error=1" },
  { title: "Drawing gate", desc: "J-1045 has no drawing. It can't leave New and the screen explains what to do.", to: "/job/J-1045?as=steve" },
  { title: "Materials check", desc: "Moving J-1047 to CNC with items still Required or Ordered. A warning, not a block.", to: "/job/J-1047?as=steve" },
  { title: "Wrong PIN", desc: "Gareth gets a digit wrong on the shared tablet.", to: "/signin?who=gareth&wrong=1" },
];

export function States() {
  return (
    <div className="page">
      <Topbar />
      <main className="page-body">
        <h1 style={{ fontSize: "var(--fs-36)", fontWeight: 700, letterSpacing: "-0.01em" }}>Every state, designed</h1>
        <p className="muted" style={{ fontSize: "var(--fs-18)", marginTop: 4, marginBottom: 24, maxWidth: "65ch" }}>
          The prototype has these built into the real screens. This page is just a quick way to reach each one.
        </p>
        <ul className="states-list">
          {STATES.map((s) => (
            <li key={s.title}>
              <a href={href(s.to)} className="ticket">
                <h3>{s.title}</h3>
                <p>{s.desc}</p>
              </a>
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}
