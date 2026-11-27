import { LayoutGroup, useReducedMotion } from "motion/react";
import { Camera, Check, FileText, LockSimple, PencilSimpleLine, Phone, Question, WifiSlash } from "@phosphor-icons/react";
import { useState } from "react";
import { useNavigate, useParams } from "react-router";
import {
  useActions,
  useConnectivity,
  useJob,
  usePeople,
  useSession,
  type Conflict,
  type GateRefusal,
  type Outcome,
  type PermissionDenied,
  type Warning,
} from "@/data";
import { urgency, type Cut, type Job, type JobFile, type Person, type StageId } from "@/domain/domain";
import { CUT_ORDER, actionLabel, canAdvanceFrom, dueText, firstName, hasApprovedDrawing, joinNames, materialsNotReady, nextStage, personName, relativeTime, shortDate, stageLabel, stageShort } from "@/domain/helpers";
import {
  AnimatedBanner,
  AvatarGroup,
  Banner,
  Button,
  Chip,
  CutRow,
  Dialog,
  DialogActions,
  DialogBody,
  DrawingViewer,
  EmptyState,
  Field,
  MaterialStatusChip,
  ReceptionDeskDrawing,
  Section,
  Sheet,
  Skeleton,
  StageTrack,
  Textarea,
  UrgencyChip,
  peopleOn,
  useToast,
} from "@/design-system";
import { AppTopBar, LoadError } from "./shell";

type Modal = { kind: "conflict"; conflict: Conflict } | { kind: "refused"; refusal: GateRefusal } | { kind: "warning"; warning: Warning; to: StageId } | null;

export function JobPage() {
  const { id = "" } = useParams();
  const jobQ = useJob(id);
  const peopleQ = usePeople();
  const { session } = useSession();
  const { online } = useConnectivity();
  const { advanceJob, undoMove, raiseDrawingQuery, setCutStatus } = useActions();
  const { toast } = useToast();
  const navigate = useNavigate();
  const reduce = useReducedMotion();

  const [viewing, setViewing] = useState<JobFile | null>(null);
  const [query, setQuery] = useState(false);
  const [modal, setModal] = useState<Modal>(null);
  const [denied, setDenied] = useState<PermissionDenied | null>(null);
  const [optimistic, setOptimistic] = useState<StageId | null>(null);

  // Moving to another job closes anything left open on the last one.
  const [shownId, setShownId] = useState(id);
  if (shownId !== id) {
    setShownId(id);
    setModal(null);
    setDenied(null);
    setQuery(false);
  }

  const people: Person[] = peopleQ.status === "ready" ? peopleQ.data : [];
  const me = session?.person;
  const isManager = me?.role === "manager";
  const isDirector = me?.role === "director";
  const back = isManager || isDirector ? "/board" : "/jobs";

  if (jobQ.status === "loading" || peopleQ.status === "loading") return <JobSkeleton back={back} id={id} />;

  if (jobQ.status === "error") {
    return (
      <div className="page">
        <AppTopBar back={back} title={id} />
        <main className="page__main jobpage">
          <LoadError query={jobQ} what={`job ${id}`}>
            <Button size="lg" variant="ghost" onClick={() => navigate(back)}>
              Go back
            </Button>
          </LoadError>
        </main>
      </div>
    );
  }

  const job = jobQ.data;
  if (!job) {
    return (
      <div className="page">
        <AppTopBar back={back} />
        <main className="page__main jobpage">
          <EmptyState tone="neutral" icon={<Question size={30} weight="bold" />} title={`No job ${id}`} actions={<Button size="lg" variant="primary" onClick={() => navigate(back)}>{isManager ? "Back to the board" : "Back to My Jobs"}</Button>}>
            It may have been deleted, or the link is wrong.
          </EmptyState>
        </main>
      </div>
    );
  }

  const drawings = job.files.filter((f) => f.category === "drawing");
  const currentDrawing = drawings.find((f) => !f.superseded);
  const superseded = drawings.filter((f) => f.superseded);
  const to = nextStage(job.stage);
  const notReady = materialsNotReady(job);
  const locked = job.stage === "new" && !hasApprovedDrawing(job);
  const canAct = !!to && !job.inDrawingReview && !isDirector;
  const managerOnly = !!me && !canAdvanceFrom(job.stage, me.role) && me.role !== "director";
  const primaryLabel = actionLabel(optimistic ?? job.stage);

  const settle = async (o: Outcome<Job>, from: StageId, target: StageId) => {
    setDenied(null);
    switch (o.kind) {
      case "ok":
      case "queued": {
        const moved = o.value;
        toast(`${job.id} moved to ${stageLabel(target)}${o.kind === "queued" ? ". Will send when back online" : ""}`, {
          action: {
            label: "Undo",
            onClick: async () => {
              const r = await undoMove(moved, from);
              if (r.kind === "conflict") setModal({ kind: "conflict", conflict: r.conflict });
            },
          },
        });
        return;
      }
      case "conflict":
        setModal({ kind: "conflict", conflict: o.conflict });
        return;
      case "refused":
        setModal({ kind: "refused", refusal: o.refusal });
        return;
      case "warning":
        setModal({ kind: "warning", warning: o.warning, to: target });
        return;
      case "denied":
        setDenied(o.denial);
        return;
      case "error":
        toast(`${job.id} wasn't moved. ${o.error.message}`, { tone: "error", action: o.error.retryable ? { label: "Try again", onClick: () => move(target) } : undefined });
        return;
    }
  };

  const move = async (target: StageId, acknowledge?: Warning["code"][], expectedVersion = job.version) => {
    const from = job.stage;
    setOptimistic(target);
    const [o] = await Promise.all([
      advanceJob({ jobId: job.id, expectedVersion, to: target, acknowledge }),
      new Promise((r) => setTimeout(r, reduce ? 0 : 420)),
    ]);
    setOptimistic(null);
    await settle(o, from, target);
  };

  const onPrimary = () => {
    if (to) void move(to);
  };

  const cycleCut = async (cut: Cut) => {
    const i = CUT_ORDER.indexOf(cut.status);
    const status = cut.status === "issue" ? "pending" : CUT_ORDER[i + 1];
    if (!status) return;
    const o = await setCutStatus({ jobId: job.id, expectedVersion: job.version, cutId: cut.id, status });
    reportSmall(o, "cutting list");
  };
  const flagIssue = async (cut: Cut) => {
    const o = await setCutStatus({ jobId: job.id, expectedVersion: job.version, cutId: cut.id, status: cut.status === "issue" ? "pending" : "issue" });
    reportSmall(o, "cutting list");
  };
  const reportSmall = (o: Outcome<Job>, what: string) => {
    if (o.kind === "ok") return;
    if (o.kind === "queued") return toast(`Kept on this tablet. Will send when back online`);
    if (o.kind === "conflict") return setModal({ kind: "conflict", conflict: o.conflict });
    if (o.kind === "denied") return setDenied(o.denial);
    if (o.kind === "error") return toast(`The ${what} didn't save. ${o.error.message}`, { tone: "error" });
    if (o.kind === "refused") return toast(o.refusal.reason, { tone: "error" });
  };

  return (
    <div className="page">
      <AppTopBar back={back} title={job.id} />
      <main className="page__main jobpage">
        <header className="jobhead">
          <div className="jobhead__main">
            <div className="jobhead__ids">
              <span className="jobhead__client">{job.client}</span>
              <span className="jobhead__ref">{job.ref}</span>
            </div>
            <h1 className="t-display">{job.piece}</h1>
            <div className="jobhead__meta">
              <UrgencyChip urgency={urgency(job)}>{dueText(job.targetDate)}</UrgencyChip>
              {job.flag !== "None" && <Chip tone={job.flag === "Urgent" ? "overdue" : "neutral"}>{job.flag}</Chip>}
              <span className="jobhead__who">
                <AvatarGroup people={peopleOn(job, people)} size={30} />
                <span className="t-body t-muted">{job.assigned.length ? joinNames(job.assigned.map((p) => firstName(people, p))) : "Not assigned yet"}</span>
              </span>
            </div>
          </div>
        </header>

        <div className="jobpage__track">
          <StageTrack job={job} stage={optimistic ?? undefined} size="lg" showHours locked={locked} raisedBy={job.inDrawingReview ? firstName(people, job.inDrawingReview.raisedBy) : undefined} />
        </div>

        <div className="jobpage__grid">
          <div className="jobpage__main">
            <Section title="Drawing" aside={currentDrawing && <span>Revision {currentDrawing.revision} is current</span>}>
              {currentDrawing ? (
                <div className="drawings">
                  <button className="drawcard" onClick={() => setViewing(currentDrawing)}>
                    <div className="drawcard__thumb">
                      <ReceptionDeskDrawing revision={currentDrawing.revision ?? "A"} title={`${job.client}, ${job.piece.toLowerCase()}`} sheetRef={job.ref} />
                    </div>
                    <div className="drawcard__meta">
                      <span className="drawcard__rev">Rev {currentDrawing.revision}</span>
                      <span className="drawcard__name">{currentDrawing.name}</span>
                      <span className="t-small t-muted">
                        Approved {shortDate(currentDrawing.uploadedAt)} by {firstName(people, currentDrawing.uploadedBy)}. {(currentDrawing.sizeBytes / 1_000_000).toFixed(1)} MB
                      </span>
                      <span className="drawcard__open">Open drawing</span>
                    </div>
                  </button>
                  {superseded.map((f) => (
                    <button key={f.id} className="drawcard drawcard--old" onClick={() => setViewing(f)}>
                      <div className="drawcard__thumb">
                        <ReceptionDeskDrawing revision={f.revision ?? "A"} superseded title={`${job.client}, ${job.piece.toLowerCase()}`} sheetRef={job.ref} />
                      </div>
                      <div className="drawcard__meta">
                        <span className="drawcard__rev">Rev {f.revision}</span>
                        <span className="drawcard__name">Superseded</span>
                        <span className="t-small t-muted">
                          Replaced by rev {currentDrawing.revision} on {shortDate(currentDrawing.uploadedAt)}. Kept for reference.
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <Banner tone="block" title="No approved drawing yet.">
                  This job stays in New until one is uploaded, so nobody builds from a sketch.
                  {isManager ? " Upload the drawing from the office to unlock it." : " Steve has been told it's needed."}
                </Banner>
              )}
            </Section>

            {job.cuts.length > 0 && (
              <Section title="Cutting list" aside={<span>{job.cuts.filter((c) => c.status === "complete").length} of {job.cuts.length} complete</span>}>
                <LayoutGroup>
                  <ul className="cuts">
                    {job.cuts.map((c) => (
                      <CutRow key={c.id} cut={c} onAdvance={() => cycleCut(c)} onFlag={() => flagIssue(c)} disabled={isDirector} />
                    ))}
                  </ul>
                </LayoutGroup>
              </Section>
            )}

            {job.materials.length > 0 && (
              <Section title="Materials" aside={notReady.length > 0 && <span className="materials__warn">{notReady.length} not in stock</span>}>
                <ul className="mats">
                  {job.materials.map((m) => (
                    <li key={m.id} className="mat">
                      <div className="mat__main">
                        <span className="mat__name">{m.name}</span>
                        <span className="mat__spec">
                          {m.qty} {m.unit}
                          {m.supplier ? `, ${m.supplier}` : ", no supplier yet"}
                        </span>
                      </div>
                      <MaterialStatusChip status={m.status} />
                    </li>
                  ))}
                </ul>
              </Section>
            )}
          </div>

          <aside className="jobpage__side">
            <div className="actions">
              {isDirector ? (
                <Banner tone="info">Read only. Directors can see every job but not change it.</Banner>
              ) : canAct ? (
                <>
                  <Button
                    variant="primary"
                    size="lg"
                    block
                    onClick={onPrimary}
                    busy={!!optimistic}
                    icon={locked || managerOnly ? <LockSimple size={24} weight="bold" /> : <Check size={26} weight="bold" />}
                  >
                    {optimistic ? `Moving to ${stageLabel(optimistic)}` : primaryLabel}
                  </Button>
                  {locked && <p className="actions__hint">Needs an approved drawing first.</p>}
                  {managerOnly && !locked && <p className="actions__hint">Workshop manager only.</p>}
                </>
              ) : job.inDrawingReview ? (
                <Banner tone="review">
                  Waiting on a revised drawing. {isManager ? `Upload it to return the job to ${stageLabel(job.stage)}.` : "Steve has your query."}
                </Banner>
              ) : null}
              {!job.inDrawingReview && !isDirector && (
                <Button variant="secondary" size="lg" block onClick={() => setQuery(true)} icon={<PencilSimpleLine size={24} />}>
                  Raise a drawing query
                </Button>
              )}
              {!online && (
                <p className="actions__hint actions__hint--offline">
                  <WifiSlash size={16} weight="bold" /> Offline. Changes are kept on this tablet.
                </p>
              )}
            </div>

            <AnimatedBanner
              show={!!denied}
              tone="block"
              role="alert"
              title={denied ? `Only the workshop manager can ${denied.action}.` : ""}
              actions={
                <>
                  <Button size="md" variant="secondary" onClick={() => navigate("/signin")}>
                    Switch person
                  </Button>
                  <Button size="md" variant="ghost" onClick={() => setDenied(null)}>
                    Dismiss
                  </Button>
                </>
              }
            >
              {denied?.reason}
            </AnimatedBanner>

            <dl className="details">
              <div>
                <dt>Workshop target</dt>
                <dd>{shortDate(job.targetDate)}</dd>
              </div>
              <div>
                <dt>Site install</dt>
                <dd>{shortDate(job.installDate)}</dd>
              </div>
              <div>
                <dt>Site</dt>
                <dd>{job.site.address}</dd>
              </div>
              <div>
                <dt>Contact</dt>
                <dd>
                  {job.site.contact}
                  <a className="details__phone" href={`tel:${job.site.phone.replace(/\s/g, "")}`}>
                    <Phone size={16} /> {job.site.phone}
                  </a>
                </dd>
              </div>
            </dl>

            {job.notes.length > 0 && (
              <div className="notes">
                <h3 className="t-heading">Notes</h3>
                {job.notes.map((n, i) => (
                  <p key={i} className="note">
                    <span className="note__meta">
                      {firstName(people, n.by)}, {shortDate(n.at)}
                    </span>
                    {n.text}
                  </p>
                ))}
              </div>
            )}

            <div className="history">
              <h3 className="t-heading">History</h3>
              <ol>
                {[...job.history].reverse().map((h, i) => (
                  <li key={i}>
                    <span className="history__when">{shortDate(h.at)}</span>
                    <span className="history__what">
                      {h.text}{" "}
                      <span className="t-muted">
                        by {personName(people, h.by)}
                        {h.device ? `, ${h.device.toLowerCase()}` : ""}
                      </span>
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          </aside>
        </div>
      </main>

      <DrawingViewer job={job} people={people} file={viewing} onClose={() => setViewing(null)} onPick={setViewing} />

      <QuerySheet
        open={query}
        job={job}
        onClose={() => setQuery(false)}
        send={(note, photo) => raiseDrawingQuery({ jobId: job.id, expectedVersion: job.version, note, photo })}
        onSent={(o) => {
          setQuery(false);
          toast(`${job.id} sent to Drawing Review${o === "queued" ? ". Will send when back online" : ""}`);
        }}
        onOther={(o) => {
          setQuery(false);
          if (o.kind === "conflict") setModal({ kind: "conflict", conflict: o.conflict });
          else if (o.kind === "denied") setDenied(o.denial);
          else if (o.kind === "refused") setModal({ kind: "refused", refusal: o.refusal });
        }}
      />

      {/* Gate refused */}
      <Dialog open={modal?.kind === "refused"} onClose={() => setModal(null)} title={modal?.kind === "refused" ? modal.refusal.title : ""} tone="block">
        {modal?.kind === "refused" && (
          <>
            <DialogBody>{modal.refusal.reason}</DialogBody>
            {modal.refusal.fix && <DialogBody muted>{modal.refusal.fix}</DialogBody>}
            <DialogActions>
              {modal.refusal.gate === "drawing" &&
                (isManager ? (
                  <Button variant="primary" size="lg" icon={<FileText size={22} />} onClick={() => { setModal(null); toast("Drawing upload arrives with the real storage"); }}>
                    Upload drawing
                  </Button>
                ) : (
                  <Button variant="primary" size="lg" onClick={() => { setModal(null); toast("Steve has been asked for the drawing"); }}>
                    Ask the office for the drawing
                  </Button>
                ))}
              <Button variant="ghost" size="lg" onClick={() => setModal(null)}>
                Not now
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>

      {/* Warning needing acknowledgement */}
      <Dialog open={modal?.kind === "warning"} onClose={() => setModal(null)} title={modal?.kind === "warning" ? modal.warning.title : ""} tone="warn">
        {modal?.kind === "warning" && (
          <>
            <DialogBody>{modal.warning.detail}</DialogBody>
            <ul className="dialog__list">
              {modal.warning.items.map((m) => (
                <li key={m.id}>
                  <span>{m.label}</span>
                  <span className={`mstat mstat--${m.status === "Required" ? "required" : "ordered"}`}>{m.status}</span>
                </li>
              ))}
            </ul>
            <DialogActions>
              <Button
                variant="primary"
                size="lg"
                onClick={() => {
                  const target = modal.to;
                  setModal(null);
                  void move(target, [modal.warning.code]);
                }}
              >
                Move to {stageShort(modal.to)} anyway
              </Button>
              <Button variant="ghost" size="lg" onClick={() => setModal(null)}>
                Wait for materials
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>

      {/* Conflict */}
      <Dialog
        open={modal?.kind === "conflict"}
        onClose={() => setModal(null)}
        title={modal?.kind === "conflict" ? `${firstName(people, modal.conflict.theirs.by.id)} changed this job on the ${modal.conflict.theirs.device.toLowerCase()} ${relativeTime(modal.conflict.theirs.at)}` : ""}
        tone="warn"
        dismissable={false}
      >
        {modal?.kind === "conflict" && (
          <>
            <DialogBody>
              While you were on this page, {firstName(people, modal.conflict.theirs.by.id)} {modal.conflict.theirs.summary}. You {modal.conflict.mine.summary}. Both are kept in the history, but the job can only be in one place.
            </DialogBody>
            <div className="conflict">
              <div className="conflict__opt">
                <span className="conflict__who">
                  {firstName(people, modal.conflict.theirs.by.id)}, {modal.conflict.theirs.device.toLowerCase()}
                </span>
                <span className="conflict__val">{stageLabel(modal.conflict.theirs.stage)}</span>
                <span className="t-small t-muted">{relativeTime(modal.conflict.theirs.at)}</span>
              </div>
              <div className="conflict__opt">
                <span className="conflict__who">You, {session?.device.toLowerCase()}</span>
                <span className="conflict__val">{stageLabel(modal.conflict.mine.stage)}</span>
                <span className="t-small t-muted">Just now</span>
              </div>
            </div>
            <DialogActions>
              <Button
                variant="primary"
                size="lg"
                onClick={() => {
                  setModal(null);
                  toast(`${job.id} is in ${stageLabel(modal.conflict.current.stage)}, as ${firstName(people, modal.conflict.theirs.by.id)} set it`);
                }}
              >
                Keep {firstName(people, modal.conflict.theirs.by.id)}'s change
              </Button>
              <Button
                variant="secondary"
                size="lg"
                onClick={() => {
                  const c = modal.conflict;
                  setModal(null);
                  void move(c.mine.stage, ["materials"], c.current.version);
                }}
              >
                Use mine
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>
    </div>
  );
}

function QuerySheet({
  open,
  job,
  onClose,
  send,
  onSent,
  onOther,
}: {
  open: boolean;
  job: Job;
  onClose: () => void;
  send: (note: string, photo: boolean) => Promise<Outcome<Job>>;
  onSent: (kind: "ok" | "queued") => void;
  onOther: (o: Exclude<Outcome<Job>, { kind: "ok" | "queued" | "error" }>) => void;
}) {
  const draftKey = `arris.draft.query.${job.id}`;
  const [note, setNote] = useState("");
  const [photo, setPhoto] = useState(false);
  const [sending, setSending] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const { toast } = useToast();

  // Each time the sheet opens, pick up any draft saved for this job.
  const openKey = open ? draftKey : null;
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  if (loadedKey !== openKey) {
    setLoadedKey(openKey);
    if (openKey) {
      const draft = readDraft(openKey);
      setNote(draft.note);
      setPhoto(draft.photo);
      setFailed(null);
    }
  }

  const submit = async () => {
    setSending(true);
    const o = await send(note.trim(), photo);
    setSending(false);
    if (o.kind === "ok" || o.kind === "queued") {
      try {
        sessionStorage.removeItem(draftKey);
      } catch {
        // Storage unavailable (private mode): there is no draft to clear.
      }
      onSent(o.kind);
      return;
    }
    if (o.kind === "error") {
      setFailed(o.error.message);
      return;
    }
    onOther(o);
  };

  const keep = () => {
    try {
      sessionStorage.setItem(draftKey, JSON.stringify({ note, photo }));
    } catch {
      // Storage unavailable (private mode): the draft is not kept.
    }
    onClose();
    toast(`Query for ${job.id} is kept on this tablet. Open the job to send it again.`);
  };

  return (
    <Sheet open={open} onClose={onClose} title="Raise a drawing query" description={`${job.id} goes to Drawing Review until Steve answers. Work can carry on where it's safe to.`} wide>
      <div className="query">
        <Field label="What's wrong, or unclear?">
          {(a) => (
            <Textarea
              {...a}
              rows={3}
              value={note}
              onChange={(e) => {
                setNote(e.target.value);
                setFailed(null);
              }}
              placeholder="Say what you see on the drawing and what you see on the bench."
            />
          )}
        </Field>
        <div className="query__photo">
          {photo ? (
            <div className="photo">
              <svg viewBox="0 0 120 90" aria-label="Photo of the carcass shoulder">
                <rect width="120" height="90" fill="var(--c-surface-3)" />
                <path d="M0 70 L40 40 L70 60 L95 35 L120 55 V90 H0Z" fill="var(--c-line-strong)" />
                <rect x="20" y="18" width="50" height="34" fill="var(--c-accent-line)" />
                <rect x="26" y="24" width="38" height="22" fill="var(--c-accent-tint)" />
              </svg>
              <button className="link" onClick={() => setPhoto(false)}>
                Remove photo
              </button>
            </div>
          ) : (
            <Button variant="secondary" size="md" icon={<Camera size={22} />} onClick={() => setPhoto(true)}>
              Add a photo
            </Button>
          )}
        </div>

        <AnimatedBanner show={!!failed} tone="error" role="alert" title="The query didn't send.">
          {failed} Your note and photo are kept here, so nothing is lost. Try again, or keep it on this tablet and send it when the signal is back.
        </AnimatedBanner>

        <div className="query__actions">
          <Button variant="primary" size="lg" disabled={note.trim().length < 4} busy={sending} onClick={submit}>
            {failed ? "Try again" : "Send to Drawing Review"}
          </Button>
          {failed ? (
            <Button variant="secondary" size="lg" onClick={keep}>
              Keep it on this tablet
            </Button>
          ) : (
            <Button variant="ghost" size="lg" onClick={onClose}>
              Cancel
            </Button>
          )}
        </div>
      </div>
    </Sheet>
  );
}

function JobSkeleton({ back, id }: { back: string; id: string }) {
  return (
    <div className="page">
      <AppTopBar back={back} title={id} />
      <main className="page__main jobpage" aria-busy="true" aria-label={`Loading job ${id}`}>
        <div className="jobhead__main">
          <Skeleton w={220} h={20} />
          <Skeleton w="60%" h={44} r={10} />
          <Skeleton w={300} h={30} r={999} />
        </div>
        <div className="jobpage__track">
          <div className="sk-track">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="jobpage__skeleton">
                <Skeleton h={10} r={5} />
                <Skeleton w="80%" h={16} />
              </div>
            ))}
          </div>
        </div>
        <div className="jobpage__grid">
          <div className="jobpage__main">
            <Skeleton w={120} h={24} />
            <Skeleton h={320} r={16} />
          </div>
          <aside className="jobpage__side">
            <Skeleton h={64} r={16} />
            <Skeleton h={64} r={16} />
            <Skeleton h={220} r={16} />
          </aside>
        </div>
      </main>
    </div>
  );
}

function readDraft(key: string): { note: string; photo: boolean } {
  try {
    const raw = sessionStorage.getItem(key);
    const draft = raw ? (JSON.parse(raw) as { note: string; photo: boolean }) : null;
    return { note: draft?.note ?? "", photo: draft?.photo ?? false };
  } catch {
    return { note: "", photo: false };
  }
}
