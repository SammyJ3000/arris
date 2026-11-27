import { DeviceTablet, Key, Plus } from "@phosphor-icons/react";
import { useState } from "react";
import { usePeople, useSession, useTablet } from "@/data";
import { roleTitle } from "@/domain/helpers";
import { Avatar, Button, Chip, Field, Input, Skeleton, useToast } from "@/design-system";
import { AppTopBar, LoadError } from "./shell";

/** People, PINs and the things the manager can change himself. Stage 2a shows
 * the people list; editing arrives with the real back end. */
export function Settings() {
  const people = usePeople();
  const { toast } = useToast();
  const later = (what: string) => toast(`${what} arrives with the real sign-in in a later stage`);
  return (
    <div className="page">
      <AppTopBar title="People" />
      <main className="page__main settings">
        <div className="today__head">
          <h1 className="t-display">People</h1>
          <p className="t-body-lg t-muted">Who can sign in, what they can do, and their PIN for the tablets.</p>
        </div>

        {people.status === "loading" && (
          <div className="people-table">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="people-row">
                <Skeleton w={36} h={36} r={999} />
                <Skeleton w="40%" h={18} />
                <Skeleton w={90} h={30} r={999} />
                <Skeleton w={100} h={36} r={8} />
              </div>
            ))}
          </div>
        )}
        {people.status === "error" && <LoadError query={people} what="the people list" />}
        {people.status === "ready" && (
          <>
            <div className="people-table">
              {people.data.map((p) => (
                <div key={p.id} className="people-row">
                  <Avatar person={p} size={36} />
                  <div>
                    <div className="people-row__name">{p.name}</div>
                    <div className="people-row__role">{roleTitle(p)}</div>
                  </div>
                  <Chip tone={p.role === "manager" ? "accent" : p.role === "director" ? "info" : "neutral"}>{p.role === "operative" ? "Floor" : p.role === "manager" ? "Manager" : "Director"}</Chip>
                  <Button size="sm" variant="ghost" icon={<Key size={16} />} onClick={() => later("Resetting a PIN")}>
                    Reset PIN
                  </Button>
                </div>
              ))}
            </div>
            <div>
              <Button size="md" variant="secondary" icon={<Plus size={18} weight="bold" />} onClick={() => later("Adding a person")}>
                Add a person
              </Button>
            </div>
          </>
        )}

        <ThisDevice />

        <div className="settings__grid">
          {[
            ["Materials and suppliers", "The list the job's materials are picked from."],
            ["Hours per stage", "Default estimates for each kind of job, so new jobs land on the board with a load."],
            ["Job templates", "A set of fire doors, a reception desk: the repeat work, ready to copy."],
            ["QC checklist", "The eight checks and their wording."],
          ].map(([title, body]) => (
            <div key={title} className="settings__card">
              <h2 className="t-heading">{title}</h2>
              <p className="t-body t-muted">{body}</p>
              <span className="t-small t-muted">After the vertical slice.</span>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}

/** Set this device up as a workshop tablet, or stop using it as one. Manager only. */
function ThisDevice() {
  const { session } = useSession();
  const { tablet, registerTablet, forgetTablet } = useTablet();
  const { toast } = useToast();
  const [name, setName] = useState("Bench tablet");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (session?.person.role !== "manager") return null;

  const register = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const o = await registerTablet(name);
    setBusy(false);
    if (o.kind === "ok") toast(`This device is now the ${o.value.kind === "registered" ? o.value.name.toLowerCase() : "tablet"}. Sign out to hand it to the floor.`);
    else if (o.kind === "error") setError(o.error.message);
    else if (o.kind === "denied") setError(o.denial.reason);
    else if (o.kind === "refused") setError(o.refusal.reason);
  };

  return (
    <section className="settings__card device-card" aria-label="This device">
      <h2 className="t-heading">
        <DeviceTablet size={20} weight="bold" /> This device
      </h2>
      {tablet.kind === "registered" ? (
        <>
          <p className="t-body t-muted">
            This device is the {tablet.name.toLowerCase()}
            {tablet.demo ? ", using the public demo token" : ""}. When you sign out, it shows "Who's working?" for the floor.
          </p>
          <div>
            <Button size="md" variant="ghost" onClick={() => void forgetTablet()}>
              Stop using it as a tablet
            </Button>
          </div>
        </>
      ) : (
        <form onSubmit={register} noValidate>
          <Field label="Tablet name" error={error} hint="Each tablet in use needs its own name.">
            {(a) => <Input {...a} value={name} invalid={!!error} onChange={(e) => { setName(e.target.value); setError(null); }} />}
          </Field>
          <Button size="md" variant="primary" type="submit" busy={busy}>
            Set up as a tablet
          </Button>
        </form>
      )}
    </section>
  );
}
