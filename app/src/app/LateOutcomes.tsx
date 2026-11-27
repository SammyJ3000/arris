// How a change made offline, and answered later, reaches the person who made
// it. When the tablet's queue uploads, the server may answer a change with a
// conflict, a refusal, a warning, a denial or an error. By then the person has
// moved on, so the answer waits (in local SQLite on the real source) until they
// are signed in, then shows here with the same dialogs a live answer uses, and
// the same choices: keep theirs or use mine, move anyway or leave it.
//
// The change has already come off the screen: the job shows what the server
// has. Nothing is lost quietly: each answer stays until the person picks one
// of the choices.

import { useState } from "react";
import { useNavigate } from "react-router";
import { useLateOutcomes, usePeople, useSession, type LateOutcome } from "@/data";
import type { Person } from "@/domain/domain";
import { firstName, relativeTime, stageLabel, stageShort } from "@/domain/helpers";
import { Button, Dialog, DialogActions, DialogBody, useToast } from "@/design-system";

export function LateOutcomes() {
  const { session } = useSession();
  const { late, settle } = useLateOutcomes();
  const peopleQ = usePeople();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);

  const people: Person[] = peopleQ.status === "ready" ? peopleQ.data : [];
  // Only the person who made the change is asked about it.
  const item = session ? late.find((l) => l.by === session.person.id) : undefined;
  if (!item) return null;

  const choose = async (choice: "dismiss" | "retry") => {
    setBusy(true);
    const o = await settle(item.id, choice);
    setBusy(false);
    if (!o) return;
    if (o.kind === "ok") toast(`Done: ${item.what}`);
    else if (o.kind === "queued") toast(`Kept on this tablet. Will send when back online`);
    // Anything else comes back as a new late outcome and shows next.
  };

  const lead = `While this tablet was offline, you tried to ${item.what} (${relativeTime(item.madeAt)}).`;
  const o = item.outcome;
  const key = item.id;

  switch (o.kind) {
    case "conflict": {
      const by = o.conflict.theirs.by;
      const them = people.some((p) => p.id === by.id) ? firstName(people, by.id) : by.name.split(" ")[0] || "Someone";
      return (
        <Dialog key={key} open onClose={() => undefined} dismissable={false} tone="warn" title={`${them} changed ${item.jobId} before your change arrived`}>
          <DialogBody>
            {lead} Before it reached the workshop server, {them} {o.conflict.theirs.summary} on the {o.conflict.theirs.device.toLowerCase()} {relativeTime(o.conflict.theirs.at)}. Your change wasn't applied, so {item.jobId} is in {stageLabel(o.conflict.current.stage)}.
          </DialogBody>
          <div className="conflict">
            <div className="conflict__opt">
              <span className="conflict__who">
                {them}, {o.conflict.theirs.device.toLowerCase()}
              </span>
              <span className="conflict__val">{stageLabel(o.conflict.current.stage)}</span>
              <span className="t-small t-muted">{relativeTime(o.conflict.theirs.at)}</span>
            </div>
            <div className="conflict__opt">
              <span className="conflict__who">You, {item.device.toLowerCase()}</span>
              <span className="conflict__val">{stageLabel(o.conflict.mine.stage)}</span>
              <span className="t-small t-muted">{relativeTime(item.madeAt)}, offline</span>
            </div>
          </div>
          <DialogActions>
            <Button variant="primary" size="lg" busy={busy} onClick={() => void choose("dismiss")}>
              Keep {them}'s change
            </Button>
            <Button variant="secondary" size="lg" disabled={busy} onClick={() => void choose("retry")}>
              Use mine
            </Button>
          </DialogActions>
        </Dialog>
      );
    }
    case "refused":
      return (
        <Dialog key={key} open onClose={() => undefined} dismissable={false} tone="block" title={o.refusal.title}>
          <DialogBody>
            {lead} It wasn't applied. {o.refusal.reason}
          </DialogBody>
          {o.refusal.fix && <DialogBody muted>{o.refusal.fix}</DialogBody>}
          <DialogActions>
            <Button variant="primary" size="lg" busy={busy} onClick={() => void choose("dismiss")}>
              OK
            </Button>
            <Button variant="ghost" size="lg" disabled={busy} onClick={() => { void choose("dismiss"); navigate(`/job/${item.jobId}`); }}>
              Open {item.jobId}
            </Button>
          </DialogActions>
        </Dialog>
      );
    case "warning":
      return (
        <Dialog key={key} open onClose={() => undefined} dismissable={false} tone="warn" title={o.warning.title}>
          <DialogBody>
            {lead} The server wants a decision first, so it hasn't moved. {o.warning.detail}
          </DialogBody>
          <ul className="dialog__list">
            {o.warning.items.map((m) => (
              <li key={m.id}>
                <span>{m.label}</span>
                <span className={`mstat mstat--${m.status === "Required" ? "required" : "ordered"}`}>{m.status}</span>
              </li>
            ))}
          </ul>
          <DialogActions>
            <Button variant="primary" size="lg" busy={busy} onClick={() => void choose("retry")}>
              {moveAnyway(item)}
            </Button>
            <Button variant="ghost" size="lg" disabled={busy} onClick={() => void choose("dismiss")}>
              Leave it
            </Button>
          </DialogActions>
        </Dialog>
      );
    case "denied":
      return (
        <Dialog key={key} open onClose={() => undefined} dismissable={false} tone="block" title={`Only the workshop ${o.denial.needed === "manager" ? "manager" : "team"} can ${o.denial.action}`}>
          <DialogBody>
            {lead} It wasn't applied. {o.denial.reason}
          </DialogBody>
          <DialogActions>
            <Button variant="primary" size="lg" busy={busy} onClick={() => void choose("dismiss")}>
              OK
            </Button>
          </DialogActions>
        </Dialog>
      );
    case "error":
      return (
        <Dialog key={key} open onClose={() => undefined} dismissable={false} tone="danger" title="A change didn't go through">
          <DialogBody>
            {lead} {o.error.message}
          </DialogBody>
          <DialogActions>
            {o.error.retryable && (
              <Button variant="primary" size="lg" busy={busy} onClick={() => void choose("retry")}>
                Try again
              </Button>
            )}
            <Button variant={o.error.retryable ? "ghost" : "primary"} size="lg" disabled={busy} onClick={() => void choose("dismiss")}>
              {o.error.retryable ? "Leave it" : "OK"}
            </Button>
          </DialogActions>
        </Dialog>
      );
  }
}

function moveAnyway(item: LateOutcome): string {
  const m = item.what.match(/ to (.+)$/);
  return m ? `Move to ${stageShortFromLabel(m[1]!)} anyway` : "Go ahead anyway";
}

function stageShortFromLabel(label: string): string {
  const ids = ["new", "materials", "cnc", "bench", "spray", "qc", "ready", "complete"] as const;
  const id = ids.find((s) => stageLabel(s) === label);
  return id ? stageShort(id) : label;
}
