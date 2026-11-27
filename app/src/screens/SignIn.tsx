import { motion, useReducedMotion } from "motion/react";
import { DeviceTablet, WarningCircle } from "@phosphor-icons/react";
import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import { usePeople, useSession, useTablet } from "@/data";
import { DEMO_TABLETS, demoPinHint } from "@/domain/demo";
import type { Person } from "@/domain/domain";
import { roleTitle } from "@/domain/helpers";
import { Avatar, Button, EmptyState, PinPad, Sheet, Skeleton, Wordmark } from "@/design-system";
import { homeFor } from "@/app/App";

/** The shared tablet. Tap your name, enter a PIN. */
export function SignIn() {
  const people = usePeople();
  const { session, signInWithPin } = useSession();
  const { tablet } = useTablet();
  const navigate = useNavigate();
  const location = useLocation();
  const [person, setPerson] = useState<Person | null>(null);
  const reduce = useReducedMotion();

  // Already signed in: carry on to where they were going.
  useEffect(() => {
    if (session) navigate((location.state as { from?: string } | null)?.from ?? homeFor(session.person.role), { replace: true });
  }, [session, navigate, location.state]);

  return (
    <div className="signin">
      <aside className="signin__side">
        <Wordmark size={30} />
        <div className="signin__intro">
          <h1 className="t-display">Who's working?</h1>
          <p className="t-body-lg t-muted">Tap your name, then your four-digit PIN. This tablet stays signed in as the workshop.</p>
        </div>
        <Link className="link" to="/signin/office">
          Office sign-in
        </Link>
      </aside>
      {tablet.kind !== "registered" ? (
        <main className="signin__grid" aria-label="Set up this tablet">
          <div className="signin__state">
            <TabletSetup />
          </div>
        </main>
      ) : (
      <main className="signin__grid" aria-label="People">
        {people.status === "loading" &&
          Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className="person-tile" aria-hidden="true">
              <Skeleton w={52} h={52} r={999} />
              <Skeleton w="70%" h={22} />
              <Skeleton w="50%" h={16} />
            </div>
          ))}
        {people.status === "error" && (
          <div className="signin__state">
            <EmptyState tone="error" icon={<WarningCircle size={30} weight="bold" />} title="Couldn't load the workshop's people" actions={<Button size="lg" variant="primary" onClick={people.retry}>Try again</Button>}>
              {people.error.message} The tablet keeps trying on its own.
            </EmptyState>
          </div>
        )}
        {people.status === "ready" &&
          people.data
            .filter((p) => p.role !== "director")
            .map((p) => (
              <motion.button
                key={p.id}
                className="person-tile"
                onClick={() => setPerson(p)}
                whileTap={reduce ? undefined : { scale: 0.975 }}
                transition={{ type: "spring", duration: 0.25, bounce: 0 }}
              >
                <Avatar person={p} size={52} />
                <span className="person-tile__name">{p.name}</span>
                <span className="person-tile__role">{roleTitle(p)}</span>
              </motion.button>
            ))}
      </main>
      )}

      <Sheet open={!!person} onClose={() => setPerson(null)} title={person ? `Hello ${person.name.split(" ")[0]}` : ""} description="Enter your PIN">
        {person && (
          <PinPad
            hint={demoPinHint(person.id)}
            onComplete={async (pin) => {
              const o = await signInWithPin({ personId: person.id, pin });
              switch (o.kind) {
                case "ok":
                case "queued":
                  setPerson(null);
                  return null;
                case "denied":
                  return o.denial.reason;
                case "error":
                  return o.error.message;
                default:
                  return "Something went wrong. Try again.";
              }
            }}
          />
        )}
      </Sheet>
    </div>
  );
}

/** This device isn't a workshop tablet (yet, or any more). */
function TabletSetup() {
  const { tablet, chooseDemoTablet } = useTablet();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const choose = async (name: string) => {
    setBusy(name);
    setError(null);
    const o = await chooseDemoTablet(name);
    setBusy(null);
    if (o.kind === "error") setError(o.error.message);
    else if (o.kind === "refused") setError(o.refusal.reason);
    else if (o.kind === "denied") setError(o.denial.reason);
  };
  return (
    <EmptyState
      tone={tablet.kind === "removed" ? "error" : "neutral"}
      icon={<DeviceTablet size={30} weight="bold" />}
      title={tablet.kind === "removed" ? `The ${tablet.name.toLowerCase()} was removed` : "This device isn't a workshop tablet"}
      actions={
        <div className="tablet-setup">
          {DEMO_TABLETS.map((t) => (
            <Button key={t.name} size="lg" variant="secondary" busy={busy === t.name} disabled={!!busy && busy !== t.name} onClick={() => void choose(t.name)}>
              Use the demo {t.name.toLowerCase()}
            </Button>
          ))}
          {error && <p className="t-small tablet-setup__error" role="alert">{error}</p>}
        </div>
      }
    >
      {tablet.kind === "removed"
        ? "The workshop manager removed this tablet, so its copy of the workshop has been cleared. The manager can set it up again from the office, under People."
        : "The workshop manager sets up a tablet once, from the office under People. To try the demo, use one of the demo tablets."}
    </EmptyState>
  );
}
