import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Backspace } from "@phosphor-icons/react";
import { useEffect, useState } from "react";
import type { Person } from "../shared/domain";
import { navigate, type Route } from "../state/router";
import { useStore } from "../state/store";
import { Sheet } from "../components/Sheet";
import { Avatar, Button, Wordmark } from "../components/ui";

const PIN = "1234";

export function SignIn({ route }: { route: Route }) {
  const { people, signIn } = useStore();
  const [person, setPerson] = useState<Person | null>(null);
  const [pin, setPin] = useState("");
  const [wrong, setWrong] = useState(false);
  const [shake, setShake] = useState(0);
  const reduce = useReducedMotion();

  // Deep link for the wrong-PIN state, so it can be screenshotted.
  useEffect(() => {
    const id = route.query.get("person");
    if (id) {
      const p = people.find((x) => x.id === id) ?? null;
      setPerson(p);
      if (route.query.get("pin") === "wrong") {
        setWrong(true);
        setPin("");
      }
    }
  }, [route, people]);

  const floor = people.filter((p) => p.role !== "director");

  const press = (d: string) => {
    if (pin.length >= 4) return;
    const next = pin + d;
    setPin(next);
    setWrong(false);
    if (next.length === 4) {
      if (next === PIN && person) {
        setTimeout(() => {
          signIn(person);
          navigate("/jobs");
          setPerson(null);
          setPin("");
        }, 180);
      } else {
        setTimeout(() => {
          setWrong(true);
          setShake((s) => s + 1);
          setPin("");
        }, 160);
      }
    }
  };

  return (
    <div className="signin">
      <aside className="signin__side">
        <Wordmark size={30} />
        <div className="signin__intro">
          <h1 className="t-display">Who's working?</h1>
          <p className="t-body-lg t-muted">Tap your name, then your four-digit PIN. This tablet stays signed in as the workshop.</p>
        </div>
        <button className="signin__office" onClick={() => navigate("/office")}>
          Office sign-in
        </button>
      </aside>
      <main className="signin__grid" aria-label="People">
        {floor.map((p) => (
          <motion.button
            key={p.id}
            className="person-tile"
            onClick={() => {
              setPerson(p);
              setPin("");
              setWrong(false);
            }}
            whileTap={reduce ? undefined : { scale: 0.975 }}
            transition={{ type: "spring", duration: 0.25, bounce: 0 }}
          >
            <Avatar person={p} size={52} />
            <span className="person-tile__name">{p.name}</span>
            <span className="person-tile__role">{p.teamRole ?? "Workshop Manager"}</span>
          </motion.button>
        ))}
      </main>

      <Sheet
        open={!!person}
        onClose={() => {
          setPerson(null);
          setPin("");
          setWrong(false);
          if (route.query.get("person")) navigate("/signin");
        }}
        title={person ? `Hello ${person.name.split(" ")[0]}` : ""}
        description="Enter your PIN"
      >
        {person && (
          <div className="pin">
            <motion.div
              key={shake}
              className={`pin__dots ${wrong ? "pin__dots--wrong" : ""}`}
              animate={
                reduce || shake === 0
                  ? undefined
                  : { transform: ["translateX(0px)", "translateX(-10px)", "translateX(9px)", "translateX(-6px)", "translateX(4px)", "translateX(0px)"] }
              }
              transition={{ duration: 0.36, ease: "easeOut" }}
              aria-live="polite"
              aria-label={wrong ? "PIN did not match" : `${pin.length} of 4 digits entered`}
            >
              {[0, 1, 2, 3].map((i) => (
                <span key={i} className={`pin__dot ${i < pin.length ? "pin__dot--on" : ""}`} />
              ))}
            </motion.div>
            <div className="pin__msg" role="status">
              <AnimatePresence mode="wait">
                {wrong ? (
                  <motion.span key="wrong" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="pin__wrong">
                    That PIN didn't match. Try again, or ask Steve to reset it.
                  </motion.span>
                ) : (
                  <motion.span key="hint" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="t-muted">
                    Prototype PIN is 1234
                  </motion.span>
                )}
              </AnimatePresence>
            </div>
            <div className="keypad">
              {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((k) => (
                <Key key={k} onPress={() => press(k)}>{k}</Key>
              ))}
              <span />
              <Key onPress={() => press("0")}>0</Key>
              <Key onPress={() => setPin((p) => p.slice(0, -1))} label="Delete">
                <Backspace size={28} />
              </Key>
            </div>
          </div>
        )}
      </Sheet>
    </div>
  );
}

function Key({ children, onPress, label }: { children: React.ReactNode; onPress: () => void; label?: string }) {
  const reduce = useReducedMotion();
  return (
    <motion.button
      className="key"
      aria-label={label}
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

export function OfficeSignIn() {
  const { signIn, people } = useStore();
  const [email, setEmail] = useState("s.marsden@workshop.example");
  const [pw, setPw] = useState("");
  const [err, setErr] = useState<string | null>(null);
  return (
    <div className="office">
      <div className="office__card">
        <Wordmark size={28} />
        <div>
          <h1 className="t-title">Office sign-in</h1>
          <p className="t-body t-muted">For the workshop manager and directors. The floor tablet signs in with a PIN.</p>
        </div>
        <form
          className="form"
          onSubmit={(e) => {
            e.preventDefault();
            if (pw.length < 4) {
              setErr("Enter your password. For the prototype, anything four characters or longer works.");
              return;
            }
            signIn(people.find((p) => p.id === "p-steve")!);
            navigate("/board");
          }}
        >
          <label className="field">
            <span className="field__label">Email</span>
            <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" />
          </label>
          <label className="field">
            <span className="field__label">Password</span>
            <input
              className={`input ${err ? "input--error" : ""}`}
              type="password"
              value={pw}
              onChange={(e) => {
                setPw(e.target.value);
                setErr(null);
              }}
              autoComplete="current-password"
              aria-invalid={!!err}
              aria-describedby={err ? "pw-err" : undefined}
            />
            {err && (
              <span id="pw-err" className="field__error">
                {err}
              </span>
            )}
          </label>
          <Button variant="primary" size="md" type="submit" block>
            Sign in
          </Button>
        </form>
        <button className="link" onClick={() => navigate("/signin")}>
          Back to the workshop tablet
        </button>
      </div>
    </div>
  );
}
