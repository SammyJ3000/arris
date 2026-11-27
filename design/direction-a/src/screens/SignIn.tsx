import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { Backspace, Buildings } from "@phosphor-icons/react";
import { PEOPLE } from "../shared/sample-data";
import type { Person } from "../shared/domain";
import { Avatar, Btn, Wordmark } from "../components/ui";
import { useStore } from "../state";
import { go } from "../router";

const PIN = "1234";

const ROLE_PAINT: Record<string, "cnc" | "bench" | "spray" | "new"> = {
  "Machine Operator": "cnc",
  "Bench Joiner": "bench",
  Apprentice: "bench",
  "Spray Booth": "spray",
};

export function SignIn({ office = false, presetPerson, presetWrong }: { office?: boolean; presetPerson?: string; presetWrong?: boolean }) {
  const { dispatch } = useStore();
  const [who, setWho] = useState<Person | null>(() => (presetPerson ? PEOPLE.find((p) => p.id === presetPerson) ?? null : null));
  const [pin, setPin] = useState(presetWrong ? "1235" : "");
  const [wrong, setWrong] = useState(!!presetWrong);
  const reduce = useReducedMotion();
  const floor = PEOPLE.filter((p) => p.role === "operative");

  useEffect(() => {
    if (pin.length < 4 || !who) return;
    if (pin === PIN) {
      dispatch({ type: "signin", user: who });
      go(who.role === "manager" ? "/board" : "/jobs");
    } else {
      setWrong(true);
    }
  }, [pin, who, dispatch]);

  const press = (d: string) => {
    if (wrong) {
      setWrong(false);
      setPin(d);
      return;
    }
    if (pin.length < 4) setPin(pin + d);
  };

  if (office) return <OfficeSignIn />;

  return (
    <main style={{ minHeight: "100dvh", display: "grid", gridTemplateColumns: "minmax(0, 1fr) 420px" }}>
      <section style={{ padding: "40px 48px", display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Wordmark size={30} />
          <span className="label">Workshop tablet, Bay 2</span>
        </div>
        <h1 style={{ fontSize: "var(--fs-36)", fontWeight: 700, letterSpacing: "-0.01em", marginTop: 40, lineHeight: 1.1 }}>Who's this?</h1>
        <p className="muted" style={{ fontSize: "var(--fs-18)", marginTop: 6 }}>
          Tap your name, then your four-digit PIN.
        </p>
        <ul
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))",
            gap: 12,
            marginTop: 28,
          }}
        >
          {floor.map((p) => {
            const on = who?.id === p.id;
            return (
              <li key={p.id}>
                <button
                  onClick={() => {
                    setWho(p);
                    setPin("");
                    setWrong(false);
                  }}
                  aria-pressed={on}
                  className="ticket"
                  style={{
                    width: "100%",
                    minHeight: 96,
                    display: "flex",
                    alignItems: "center",
                    gap: 14,
                    padding: "0 16px",
                    boxShadow: on ? `inset 0 0 0 3px var(--ink), var(--shadow-1)` : "var(--shadow-1)",
                    transition: "transform var(--dur-press) var(--ease-out)",
                  }}
                  onPointerDown={(e) => ((e.currentTarget.style.transform = "scale(0.98)"), undefined)}
                  onPointerUp={(e) => ((e.currentTarget.style.transform = ""), undefined)}
                  onPointerLeave={(e) => ((e.currentTarget.style.transform = ""), undefined)}
                >
                  <Avatar initials={p.initials} stage={ROLE_PAINT[p.teamRole ?? ""] ?? "new"} />
                  <span style={{ lineHeight: 1.15 }}>
                    <span style={{ display: "block", fontWeight: 700, fontSize: "var(--fs-20)" }}>{p.name}</span>
                    <span className="muted" style={{ fontSize: "var(--fs-14)" }}>{p.teamRole}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
        <div style={{ marginTop: "auto", paddingTop: 24 }}>
          <a href="#/signin/office" className="btn btn-ghost btn-sm" style={{ minHeight: 44 }}>
            <Buildings size={18} weight="bold" />
            Office sign-in
          </a>
        </div>
      </section>

      <aside
        style={{
          background: "var(--ticket)",
          borderLeft: "2px solid var(--line)",
          padding: "40px 40px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
        }}
        aria-label="PIN"
      >
        {who ? (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <Avatar initials={who.initials} stage={ROLE_PAINT[who.teamRole ?? ""] ?? "new"} />
              <div style={{ lineHeight: 1.15 }}>
                <div style={{ fontWeight: 700, fontSize: "var(--fs-20)" }}>{who.name}</div>
                <div className="muted">Enter your PIN</div>
              </div>
            </div>
            <motion.div
              role="status"
              aria-label={`${pin.length} of 4 digits entered`}
              style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, margin: "28px 0 8px" }}
              animate={wrong && !reduce ? { transform: ["translateX(0)", "translateX(-8px)", "translateX(8px)", "translateX(-5px)", "translateX(0)"] } : { transform: "translateX(0)" }}
              transition={{ duration: 0.32 }}
            >
              {[0, 1, 2, 3].map((i) => (
                <span
                  key={i}
                  style={{
                    height: 64,
                    borderRadius: "var(--r)",
                    border: `2px solid ${wrong ? "var(--red)" : pin.length > i ? "var(--ink)" : "var(--line-strong)"}`,
                    background: wrong ? "var(--red-tint)" : pin.length > i ? "var(--ink)" : "var(--ticket)",
                    display: "grid",
                    placeItems: "center",
                    transition: "background-color var(--dur-fast) ease, border-color var(--dur-fast) ease",
                  }}
                >
                  {pin.length > i && <span style={{ width: 14, height: 14, borderRadius: 7, background: wrong ? "var(--red)" : "var(--on-paint)" }} />}
                </span>
              ))}
            </motion.div>
            <div style={{ minHeight: 28 }}>
              {wrong && (
                <p className="error-text" role="alert">
                  That PIN isn't right. Try again, or ask Steve to reset it.
                </p>
              )}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginTop: 8 }}>
              {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
                <Btn key={d} kind="ghost" size="lg" onClick={() => press(d)} style={{ minHeight: 72, fontSize: "var(--fs-28)", fontFamily: "var(--font-cond)", fontWeight: 600 }}>
                  {d}
                </Btn>
              ))}
              <span />
              <Btn kind="ghost" size="lg" onClick={() => press("0")} style={{ minHeight: 72, fontSize: "var(--fs-28)", fontFamily: "var(--font-cond)", fontWeight: 600 }}>
                0
              </Btn>
              <Btn
                kind="ghost"
                size="lg"
                aria-label="Delete last digit"
                onClick={() => {
                  setWrong(false);
                  setPin(pin.slice(0, -1));
                }}
                style={{ minHeight: 72 }}
              >
                <Backspace size={28} weight="bold" />
              </Btn>
            </div>
          </>
        ) : (
          <div className="outline" style={{ minHeight: 420, display: "grid", placeItems: "center", textAlign: "center", padding: 32 }}>
            <div>
              <div className="num" style={{ fontSize: "var(--fs-88)", color: "var(--line-strong)", lineHeight: 1 }}>
                ····
              </div>
              <p style={{ fontSize: "var(--fs-18)", marginTop: 12 }}>Your PIN pad appears once you've picked your name.</p>
            </div>
          </div>
        )}
      </aside>
    </main>
  );
}

function OfficeSignIn() {
  const { dispatch } = useStore();
  const [email, setEmail] = useState("steve@example.workshop");
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  return (
    <main style={{ minHeight: "100dvh", display: "grid", placeItems: "center", padding: 24 }}>
      <form
        className="ticket"
        style={{ width: "min(460px, 100%)", padding: 40 }}
        onSubmit={(e) => {
          e.preventDefault();
          if (!pw) {
            setErr("Enter your password to sign in.");
            return;
          }
          const steve = PEOPLE.find((p) => p.id === "p-steve")!;
          dispatch({ type: "signin", user: steve });
          go("/board");
        }}
      >
        <Wordmark size={26} />
        <h1 style={{ fontSize: "var(--fs-28)", fontWeight: 700, marginTop: 28, lineHeight: 1.15 }}>Office sign-in</h1>
        <p className="muted" style={{ marginTop: 4 }}>For the manager and directors. The floor uses a PIN.</p>
        <div className="field" style={{ marginTop: 24 }}>
          <label htmlFor="em">Email</label>
          <input id="em" className="input" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" />
        </div>
        <div className="field" style={{ marginTop: 16 }}>
          <label htmlFor="pw">Password</label>
          <input id="pw" className="input" type="password" value={pw} onChange={(e) => (setPw(e.target.value), setErr(""))} autoComplete="current-password" placeholder="Anything will do in the prototype" />
          {err && <span className="error-text">{err}</span>}
        </div>
        <Btn type="submit" size="lg" block style={{ marginTop: 24 }}>
          Sign in
        </Btn>
        <a href="#/signin" className="btn btn-ghost btn-sm" style={{ marginTop: 16, minHeight: 44 }}>
          Back to the tablet sign-in
        </a>
      </form>
    </main>
  );
}
