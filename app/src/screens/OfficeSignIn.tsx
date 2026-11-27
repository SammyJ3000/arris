import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import { useSession } from "@/data";
import { DEMO_PASSWORD } from "@/domain/demo";
import { Button, Field, Input, Wordmark } from "@/design-system";
import { homeFor } from "@/app/App";

export function OfficeSignIn() {
  const { session, signInOffice } = useSession();
  const navigate = useNavigate();
  const [email, setEmail] = useState("steve.marsden@arris.demo");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (session) navigate(homeFor(session.person.role), { replace: true });
  }, [session, navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) {
      setError("Enter your password.");
      return;
    }
    setBusy(true);
    const o = await signInOffice({ email, password });
    setBusy(false);
    if (o.kind === "ok" || o.kind === "queued") return;
    if (o.kind === "denied") setError(o.denial.reason);
    else if (o.kind === "error") setError(o.error.message);
    else setError("Something went wrong. Try again.");
  };

  return (
    <div className="office">
      <div className="office__card">
        <Wordmark size={28} />
        <div>
          <h1 className="t-title">Office sign-in</h1>
          <p className="t-body t-muted">For the workshop manager and directors. The floor tablet signs in with a PIN.</p>
        </div>
        <form className="form" onSubmit={submit} noValidate>
          <Field label="Email">
            {(a) => <Input {...a} type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" />}
          </Field>
          <Field label="Password" error={error} hint={`Demo password is “${DEMO_PASSWORD}”`}>
            {(a) => (
              <Input
                {...a}
                type="password"
                value={password}
                invalid={!!error}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError(null);
                }}
                autoComplete="current-password"
              />
            )}
          </Field>
          <Button variant="primary" size="md" type="submit" block busy={busy}>
            Sign in
          </Button>
        </form>
        <Link className="link" to="/signin">
          Back to the workshop tablet
        </Link>
      </div>
    </div>
  );
}
