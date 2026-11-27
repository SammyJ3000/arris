// Shared tablet. The device stays signed in as the workshop; a person taps their
// name and enters a four-digit PIN. The PIN pad is drawn like a title block grid.

import { useEffect, useState } from "react";
import { Backspace, ArrowLeft, Buildings } from "@phosphor-icons/react";
import { Sheet } from "../components/Sheet";
import { Button } from "../components/primitives";
import { PEOPLE } from "../shared/sample-data";
import type { Person } from "../shared/domain";
import { navigate } from "../router";
import { useStore } from "../store";

const PIN = "1234";

export function SignIn({ wrongDemo = false }: { wrongDemo?: boolean }) {
  const { dispatch } = useStore();
  const floor = PEOPLE.filter((p) => p.role === "operative");
  const [person, setPerson] = useState<Person | null>(wrongDemo ? floor.find((p) => p.id === "p-tom")! : null);
  const [pin, setPin] = useState(wrongDemo ? "1235" : "");
  const [wrong, setWrong] = useState(wrongDemo ? 1 : 0);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    if (pin.length !== 4 || checking) return;
    setChecking(true);
    const t = setTimeout(() => {
      if (pin === PIN && person) {
        dispatch({ type: "sign-in", person });
        navigate("/jobs");
      } else {
        setWrong((w) => w + 1);
        setPin("");
      }
      setChecking(false);
    }, 260);
    return () => clearTimeout(t);
  }, [pin]);

  useEffect(() => {
    if (!person) return;
    const onKey = (e: KeyboardEvent) => {
      if (/^[0-9]$/.test(e.key)) press(e.key);
      if (e.key === "Backspace") press("back");
      if (e.key === "Escape") setPerson(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [person, pin]);

  const press = (k: string) => {
    if (checking) return;
    if (k === "back") setPin((p) => p.slice(0, -1));
    else if (pin.length < 4) setPin((p) => p + k);
  };

  return (
    <Sheet title={person ? `Sign in: ${person.name}` : "Sign in"} className="sheet--signin">
      {!person ? (
        <div className="signin">
          <div className="signin__intro">
            <h1 className="signin__h1">Who is on the bench?</h1>
            <p className="signin__p">Tap your name, then your four-digit PIN.</p>
          </div>
          <ul className="people">
            {floor.map((p) => (
              <li key={p.id}>
                <button type="button" className="person" onClick={() => setPerson(p)}>
                  <span className="person__initials mono">{p.initials}</span>
                  <span className="person__name">{p.name}</span>
                  <span className="person__role">{p.teamRole}</span>
                </button>
              </li>
            ))}
          </ul>
          <div className="signin__office">
            <button type="button" className="link-btn" onClick={() => navigate("/office")}>
              <Buildings size={20} aria-hidden="true" />
              <span>Office sign-in</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="pinscreen">
          <div className="pinscreen__left">
            <button type="button" className="head-back" onClick={() => { setPerson(null); setPin(""); setWrong(0); }}>
              <ArrowLeft size={22} aria-hidden="true" />
              <span>Not you?</span>
            </button>
            <div className="pinscreen__who">
              <span className="person__initials person__initials--lg mono">{person.initials}</span>
              <div>
                <h1 className="pinscreen__name">{person.name}</h1>
                <p className="pinscreen__role">{person.teamRole}</p>
              </div>
            </div>
            <div className={`pin-dots ${wrong && pin.length === 0 ? "is-wrong" : ""}`} aria-live="polite" aria-label={`${pin.length} of 4 digits entered`}>
              {[0, 1, 2, 3].map((i) => (
                <span key={i} className={`pin-dot ${i < pin.length ? "is-filled" : ""}`} />
              ))}
            </div>
            <p className={`pin-help ${wrong ? "pin-help--wrong" : ""}`} role={wrong ? "alert" : undefined}>
              {wrong === 0 && "Enter your PIN"}
              {wrong === 1 && "That PIN is not right. Try again."}
              {wrong >= 2 && (
                <>
                  Still not right. Steve can reset your PIN from the office.
                </>
              )}
            </p>
          </div>
          <div className="pinpad" role="group" aria-label="PIN pad">
            {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((k) => (
              <button key={k} type="button" className="pinkey mono" onClick={() => press(k)}>
                {k}
              </button>
            ))}
            <span className="pinkey pinkey--blank" aria-hidden="true" />
            <button type="button" className="pinkey mono" onClick={() => press("0")}>
              0
            </button>
            <button type="button" className="pinkey pinkey--back" onClick={() => press("back")} aria-label="Delete last digit">
              <Backspace size={30} aria-hidden="true" />
            </button>
          </div>
        </div>
      )}
    </Sheet>
  );
}

export function OfficeSignIn() {
  const { dispatch } = useStore();
  const [email, setEmail] = useState("steve@example.test");
  const [pw, setPw] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pw.length < 4) {
      setErr("Enter your password. It is at least four characters.");
      return;
    }
    const who = email.startsWith("helen") ? PEOPLE.find((p) => p.id === "p-helen")! : PEOPLE.find((p) => p.id === "p-steve")!;
    dispatch({ type: "sign-in", person: who });
    navigate("/board");
  };
  return (
    <Sheet title="Office sign-in" back="/signin" backLabel="Workshop tablet">
      <form className="office" onSubmit={submit} noValidate>
        <h1 className="office__h1">Office sign-in</h1>
        <p className="office__p">For the workshop manager and directors. The floor signs in with a PIN.</p>
        <label className="field">
          <span className="field__label">Email</span>
          <input className="field__input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" />
        </label>
        <label className="field">
          <span className="field__label">Password</span>
          <input
            className={`field__input ${err ? "is-invalid" : ""}`}
            type="password"
            value={pw}
            onChange={(e) => {
              setPw(e.target.value);
              setErr(null);
            }}
            autoComplete="current-password"
            aria-describedby={err ? "pw-err" : undefined}
            aria-invalid={!!err}
          />
          {err && (
            <span className="field__error" id="pw-err" role="alert">
              {err}
            </span>
          )}
        </label>
        <p className="office__hint">Prototype: any password of four or more characters. Use an address starting with "helen" to sign in as the director.</p>
        <Button variant="primary" size="lg" type="submit">
          Sign in
        </Button>
      </form>
    </Sheet>
  );
}
