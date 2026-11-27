import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from "motion/react";
import { Camera, Check, FileText, LockSimple, PencilSimpleLine, Phone, Warning, WifiSlash } from "@phosphor-icons/react";
import { useEffect, useMemo, useState } from "react";
import {
  MATERIAL_STATUS_LABEL,
  STAGES,
  urgency,
  type Cut,
  type CutStatus,
  type Job,
  type JobFile,
  type StageId,
} from "../shared/domain";
import { navigate, type Route } from "../state/router";
import { CUT_ORDER, dueText, firstName, nextStage, personName, shortDate, stageLabel, useStore } from "../state/store";
import { people } from "../components/JobCard";
import { ReceptionDeskDrawing } from "../components/Drawing";
import { DrawingViewer } from "../components/DrawingViewer";
import { Decision, Sheet } from "../components/Sheet";
import { StageTrack } from "../components/StageTrack";
import { TopBar } from "../components/TopBar";
import { AvatarStack, Button, Pill, Section, UrgencyPill } from "../components/ui";
import { actionLabel } from "./MyJobs";

const spring = { type: "spring", duration: 0.4, bounce: 0 } as const;

const CUT_LABEL: Record<CutStatus, string> = { pending: "Pending", cut: "Cut", edged: "Edged", complete: "Complete", issue: "Issue" };

export function JobPage({ route, id }: { route: Route; id: string }) {
  const store = useStore();
  const { session, online, jobById, advance, moveTo, undoMove, setCutStatus, raiseQuery, toast } = store;
  const job = jobById(id);
  const reduce = useReducedMotion();
  const demo = route.query.get("demo");
  const isManager = session?.role === "manager";
  const isDirector = session?.role === "director";

  const [viewing, setViewing] = useState<JobFile | null>(null);
  const [query, setQuery] = useState(false);
  const [gate, setGate] = useState<null | "drawing" | "materials" | "permission">(null);
  const [conflict, setConflict] = useState(false);
  const [optimistic, setOptimistic] = useState<StageId | null>(null);

  useEffect(() => {
    setGate(null);
    setConflict(false);
    setQuery(false);
    if (demo === "permission") setGate("permission");
    if (demo === "conflict") {
      const t = setTimeout(() => setConflict(true), 450);
      return () => clearTimeout(t);
    }
    if (demo === "error") setQuery(true);
  }, [demo, id]);

  if (!job) {
    return (
      <div className="page">
        <TopBar back="/jobs" />
        <main className="jobpage">
          <div className="empty">
            <h1 className="t-title">No job {id}</h1>
            <p className="t-body-lg t-muted">It may have been deleted, or the link is wrong.</p>
            <Button size="lg" onClick={() => navigate("/jobs")}>Back to My Jobs</Button>
          </div>
        </main>
      </div>
    );
  }

  const drawings = job.files.filter((f) => f.category === "drawing");
  const currentDrawing = drawings.find((f) => !f.superseded);
  const superseded = drawings.filter((f) => f.superseded);
  const hasDrawing = !!currentDrawing;
  const to = nextStage(job.stage);
  const u = urgency(job);
  const notReady = job.materials.filter((m) => m.status === "required" || m.status === "ordered");
  const locked = job.stage === "new" && !hasDrawing;
  const canAct = !!to && !job.inDrawingReview;
  const managerOnly = job.stage === "ready" || job.stage === "new" || job.stage === "materials" || job.stage === "qc";

  const onPrimary = () => {
    if (!to) return;
    if (locked) {
      setGate("drawing");
      return;
    }
    if (managerOnly && !isManager) {
      setGate("permission");
      return;
    }
    if (job.stage === "materials" && to === "cnc" && notReady.length > 0) {
      setGate("materials");
      return;
    }
    commitMove(to);
  };

  const commitMove = (stage: StageId) => {
    const from = job.stage;
    const version = job.version;
    setOptimistic(stage);
    setTimeout(
      () => {
        moveTo(job.id, stage);
        setOptimistic(null);
        toast(`${job.id} moved to ${stageLabel(stage)}${online ? "" : ". Will sync when back online"}`, () => undoMove(job.id, from, version));
      },
      reduce ? 0 : 420,
    );
  };

  const cycleCut = (cut: Cut) => {
    const i = CUT_ORDER.indexOf(cut.status);
    if (cut.status === "issue") {
      setCutStatus(job.id, cut.id, "pending");
      return;
    }
    if (i >= 0 && i < CUT_ORDER.length - 1) setCutStatus(job.id, cut.id, CUT_ORDER[i + 1]);
  };

  const flagIssue = (cut: Cut) => setCutStatus(job.id, cut.id, cut.status === "issue" ? "pending" : "issue");

  const primaryLabel = actionLabel(optimistic ?? job.stage);

  return (
    <div className="page">
      <TopBar back={isManager ? "/board" : "/jobs"} title={job.id} />
      <main className="jobpage">
        <header className="jobhead">
          <div className="jobhead__main">
            <div className="jobhead__ids">
              <span className="jobhead__client">{job.client}</span>
              <span className="jobhead__ref">{job.ref}</span>
            </div>
            <h1 className="t-display">{job.piece}</h1>
            <div className="jobhead__meta">
              <UrgencyPill urgency={u}>{dueText(job.targetDate)}</UrgencyPill>
              {job.flag !== "None" && <Pill tone={job.flag === "Urgent" ? "overdue" : "neutral"}>{job.flag}</Pill>}
              <span className="jobhead__who">
                <AvatarStack people={people(job.assigned)} size={30} />
                <span className="t-body t-muted">{job.assigned.length ? job.assigned.map(firstName).join(" and ") : "Not assigned yet"}</span>
              </span>
            </div>
          </div>
        </header>

        <div className="jobpage__track">
          <StageTrack job={job} stage={optimistic ?? undefined} size="lg" showHours locked={locked} />
        </div>

        <div className="jobpage__grid">
          <div className="jobpage__main">
            <Section title="Drawing" aside={hasDrawing && <span className="t-small t-muted">Revision {currentDrawing!.revision} is current</span>}>
              {hasDrawing ? (
                <div className="drawings">
                  <button className="drawcard" onClick={() => setViewing(currentDrawing!)}>
                    <div className="drawcard__thumb">
                      <ReceptionDeskDrawing revision={currentDrawing!.revision ?? "A"} title={`${job.client}, ${job.piece.toLowerCase()}`} sheetRef={job.ref} />
                    </div>
                    <div className="drawcard__meta">
                      <span className="drawcard__rev">Rev {currentDrawing!.revision}</span>
                      <span className="drawcard__name">{currentDrawing!.name}</span>
                      <span className="t-small t-muted">
                        Approved {shortDate(currentDrawing!.uploadedAt)} by {firstName(currentDrawing!.uploadedBy)}. {(currentDrawing!.sizeBytes / 1_000_000).toFixed(1)} MB
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
                        <span className="t-small t-muted">Replaced by rev {currentDrawing!.revision} on {shortDate(currentDrawing!.uploadedAt)}. Kept for reference.</span>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="notice notice--block">
                  <LockSimple size={24} weight="bold" />
                  <div>
                    <strong>No approved drawing yet.</strong> This job stays in New until one is uploaded, so nobody builds from a sketch.
                    {isManager ? " Upload the drawing from the office to unlock it." : " Steve has been told it's needed."}
                  </div>
                </div>
              )}
            </Section>

            {job.cuts.length > 0 && (
              <Section title="Cutting list" aside={<span className="t-small t-muted">{job.cuts.filter((c) => c.status === "complete").length} of {job.cuts.length} complete</span>}>
                <LayoutGroup>
                  <ul className="cuts">
                    {job.cuts.map((c) => (
                      <li key={c.id} className={`cut ${c.status === "complete" ? "cut--done" : ""} ${c.status === "issue" ? "cut--issue" : ""}`}>
                        <div className="cut__main">
                          <span className="cut__label">{c.label}</span>
                          <span className="cut__spec">
                            {c.qty} × {c.dims} mm, {c.material}. Edging: {c.edging.toLowerCase()}
                          </span>
                        </div>
                        <div className="cut__actions">
                          <button
                            className={`cut__issue ${c.status === "issue" ? "cut__issue--on" : ""}`}
                            aria-label={c.status === "issue" ? "Clear issue" : "Flag an issue"}
                            aria-pressed={c.status === "issue"}
                            onClick={() => flagIssue(c)}
                          >
                            <Warning size={22} weight={c.status === "issue" ? "fill" : "regular"} />
                          </button>
                          <CutStatusButton cut={c} onClick={() => cycleCut(c)} />
                        </div>
                      </li>
                    ))}
                  </ul>
                </LayoutGroup>
              </Section>
            )}

            {job.materials.length > 0 && (
              <Section
                title="Materials"
                aside={notReady.length > 0 && <span className="t-small materials__warn">{notReady.length} not in stock</span>}
              >
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
                      <span className={`mstat mstat--${m.status}`}>{MATERIAL_STATUS_LABEL[m.status]}</span>
                    </li>
                  ))}
                </ul>
              </Section>
            )}
          </div>

          <aside className="jobpage__side">
            <div className="actions">
              {isDirector ? (
                <p className="actions__hint">Read only. Directors can see every job but not change it.</p>
              ) : canAct ? (
                <>
                  <Button
                    variant="primary"
                    size="lg"
                    block
                    onClick={onPrimary}
                    disabled={!!optimistic}
                    icon={locked || (managerOnly && !isManager) ? <LockSimple size={24} weight="bold" /> : <Check size={26} weight="bold" />}
                  >
                    {optimistic ? `Moving to ${stageLabel(optimistic)}` : primaryLabel}
                  </Button>
                  {locked && <p className="actions__hint">Needs an approved drawing first.</p>}
                  {managerOnly && !isManager && !locked && <p className="actions__hint">Workshop manager only.</p>}
                </>
              ) : job.inDrawingReview ? (
                <div className="notice notice--review">
                  <PencilSimpleLine size={22} />
                  <span>Waiting on a revised drawing. {isManager ? "Upload it to return the job to " + stageLabel(job.stage) + "." : "Steve has your query."}</span>
                </div>
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

            <AnimatePresence>
              {gate === "permission" && (
                <motion.div
                  className="notice notice--block"
                  role="alert"
                  initial={reduce ? { opacity: 0 } : { opacity: 0, transform: "translateY(-6px)" }}
                  animate={{ opacity: 1, transform: "translateY(0px)" }}
                  exit={{ opacity: 0 }}
                  transition={spring}
                >
                  <LockSimple size={24} weight="bold" />
                  <div>
                    <strong>Only the workshop manager can {primaryLabel.toLowerCase().replace("move to", "move a job to")}.</strong> Steve can do this from the office, or on this tablet by signing in with his PIN. Your work on the job is saved.
                    <div className="notice__actions">
                      <Button size="md" variant="secondary" onClick={() => navigate("/signin")}>
                        Switch person
                      </Button>
                      <Button size="md" variant="ghost" onClick={() => setGate(null)}>
                        Dismiss
                      </Button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

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
                      {firstName(n.by)}, {shortDate(n.at)}
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
                      {h.text} <span className="t-muted">by {personName(h.by)}</span>
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          </aside>
        </div>
      </main>

      <DrawingViewer job={job} file={viewing} onClose={() => setViewing(null)} onPick={setViewing} />

      <QuerySheet
        open={query}
        job={job}
        failFirst={demo === "error"}
        onClose={() => {
          setQuery(false);
          if (demo === "error") navigate(`/job/${job.id}`);
        }}
        onSend={(note, photo) => {
          raiseQuery(job.id, note, photo);
          setQuery(false);
          toast(`${job.id} sent to Drawing Review`);
        }}
      />

      <Decision open={gate === "drawing"} onClose={() => setGate(null)} title="This job needs an approved drawing first" tone="block">
        <p className="decision__body">
          {job.id} has no drawing yet. Jobs can't leave New until a drawing is approved and stored, so the floor never builds from a sketch or a phone photo.
        </p>
        <p className="decision__body t-muted">{isManager ? "Upload the approved drawing and this job unlocks straight away." : "Steve uploads drawings from the office. He'll be told this one is holding the job."}</p>
        <div className="decision__actions">
          {isManager ? (
            <Button variant="primary" size="lg" icon={<FileText size={22} />} onClick={() => { setGate(null); toast("Drawing upload arrives with the real build"); }}>
              Upload drawing
            </Button>
          ) : (
            <Button variant="primary" size="lg" onClick={() => { setGate(null); toast("Steve has been asked for the drawing"); }}>
              Ask the office for the drawing
            </Button>
          )}
          <Button variant="ghost" size="lg" onClick={() => setGate(null)}>
            Not now
          </Button>
        </div>
      </Decision>

      <Decision open={gate === "materials"} onClose={() => setGate(null)} title={`${notReady.length} ${notReady.length === 1 ? "item isn't" : "items aren't"} in stock yet`} tone="warn">
        <p className="decision__body">
          CNC can start, but the machinists may end up waiting. Ironmongery and fixings are often fine to follow later; sheet goods usually aren't.
        </p>
        <ul className="decision__list">
          {notReady.map((m) => (
            <li key={m.id}>
              <span>
                {m.name} <span className="t-muted">({m.qty} {m.unit})</span>
              </span>
              <span className={`mstat mstat--${m.status}`}>{MATERIAL_STATUS_LABEL[m.status]}</span>
            </li>
          ))}
        </ul>
        <div className="decision__actions">
          <Button
            variant="primary"
            size="lg"
            onClick={() => {
              setGate(null);
              commitMove("cnc");
            }}
          >
            Move to CNC anyway
          </Button>
          <Button variant="ghost" size="lg" onClick={() => setGate(null)}>
            Wait for materials
          </Button>
        </div>
      </Decision>

      <Decision open={conflict} onClose={() => setConflict(false)} title="Tom changed this job on the bench tablet 2 minutes ago" tone="warn" dismissable={false}>
        <p className="decision__body">
          While you were editing, Tom marked Bench Work done and passed {job.id} to Spray Booth. You moved it to Quality Check. Both changes are kept in the history, but the job can only be in one place.
        </p>
        <div className="conflict">
          <div className="conflict__opt">
            <span className="conflict__who">Tom, bench tablet</span>
            <span className="conflict__val">Spray Booth</span>
            <span className="t-small t-muted">2 minutes ago</span>
          </div>
          <div className="conflict__opt">
            <span className="conflict__who">You, office</span>
            <span className="conflict__val">Quality Check</span>
            <span className="t-small t-muted">Just now</span>
          </div>
        </div>
        <div className="decision__actions">
          <Button
            variant="primary"
            size="lg"
            onClick={() => {
              setConflict(false);
              moveTo(job.id, "spray");
              toast(`${job.id} is in Spray Booth, as Tom set it`);
              navigate(`/job/${job.id}`);
            }}
          >
            Keep Tom's change
          </Button>
          <Button
            variant="secondary"
            size="lg"
            onClick={() => {
              setConflict(false);
              moveTo(job.id, "qc");
              toast(`${job.id} is in Quality Check. Tom's tablet will update`);
              navigate(`/job/${job.id}`);
            }}
          >
            Use mine
          </Button>
        </div>
      </Decision>
    </div>
  );
}

function CutStatusButton({ cut, onClick }: { cut: Cut; onClick: () => void }) {
  const reduce = useReducedMotion();
  const done = cut.status === "complete";
  const next = CUT_ORDER[CUT_ORDER.indexOf(cut.status) + 1];
  return (
    <motion.button
      className={`cstat cstat--${cut.status}`}
      onClick={onClick}
      disabled={done}
      aria-label={done ? `${cut.label}: complete` : `${cut.label}: ${CUT_LABEL[cut.status]}. Tap to mark ${CUT_LABEL[next ?? "pending"].toLowerCase()}`}
      whileTap={reduce || done ? undefined : { scale: 0.96 }}
      transition={{ type: "spring", duration: 0.25, bounce: 0 }}
    >
      <span className="cstat__steps" aria-hidden="true">
        {CUT_ORDER.slice(1).map((s, i) => (
          <span key={s} className={`cstat__step ${CUT_ORDER.indexOf(cut.status) > i ? "cstat__step--on" : ""}`} />
        ))}
      </span>
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={cut.status}
          className="cstat__label"
          initial={reduce ? { opacity: 0 } : { opacity: 0, transform: "translateY(6px)", filter: "blur(2px)" }}
          animate={{ opacity: 1, transform: "translateY(0px)", filter: "blur(0px)" }}
          exit={reduce ? { opacity: 0 } : { opacity: 0, transform: "translateY(-6px)", filter: "blur(2px)" }}
          transition={{ duration: 0.18, ease: [0.23, 1, 0.32, 1] }}
        >
          {CUT_LABEL[cut.status]}
        </motion.span>
      </AnimatePresence>
      {done && <Check size={18} weight="bold" />}
    </motion.button>
  );
}

function QuerySheet({
  open,
  job,
  onClose,
  onSend,
  failFirst,
}: {
  open: boolean;
  job: Job;
  onClose: () => void;
  onSend: (note: string, photo: boolean) => void;
  failFirst?: boolean;
}) {
  const [note, setNote] = useState("");
  const [photo, setPhoto] = useState(false);
  const [sending, setSending] = useState(false);
  const [failed, setFailed] = useState(false);
  const { toast } = useStore();

  useEffect(() => {
    if (open && failFirst) {
      setNote("Back panel height on rev C reads 2100 but the carcass shoulder only allows 2050. Which is right?");
      setPhoto(true);
      setFailed(true);
    } else if (open) {
      setNote("");
      setPhoto(false);
      setFailed(false);
    }
  }, [open, failFirst]);

  const send = () => {
    setSending(true);
    setTimeout(() => {
      setSending(false);
      if (failFirst && !failed) {
        setFailed(true);
        return;
      }
      onSend(note.trim(), photo);
    }, 500);
  };

  return (
    <Sheet open={open} onClose={onClose} title="Raise a drawing query" description={`${job.id} goes to Drawing Review until Steve answers. Work can carry on where it's safe to.`} wide>
      <div className="query">
        <label className="field">
          <span className="field__label">What's wrong, or unclear?</span>
          <textarea
            className="input input--area"
            rows={3}
            value={note}
            onChange={(e) => {
              setNote(e.target.value);
              setFailed(false);
            }}
            placeholder="Say what you see on the drawing and what you see on the bench."
          />
        </label>
        <div className="query__photo">
          {photo ? (
            <div className="photo">
              <svg viewBox="0 0 120 90" aria-label="Photo of the carcass shoulder">
                <rect width="120" height="90" fill="var(--c-surface-3)" />
                <path d="M0 70 L40 40 L70 60 L95 35 L120 55 V90 H0Z" fill="var(--c-line-strong)" />
                <rect x="20" y="18" width="50" height="34" fill="var(--c-accent-line)" />
                <rect x="26" y="24" width="38" height="22" fill="var(--c-accent-tint)" />
              </svg>
              <button className="photo__remove" onClick={() => setPhoto(false)}>
                Remove photo
              </button>
            </div>
          ) : (
            <Button variant="secondary" size="md" icon={<Camera size={22} />} onClick={() => setPhoto(true)}>
              Add a photo
            </Button>
          )}
        </div>

        <AnimatePresence>
          {failed && (
            <motion.div
              className="notice notice--error"
              role="alert"
              initial={{ opacity: 0, transform: "translateY(-4px)" }}
              animate={{ opacity: 1, transform: "translateY(0px)" }}
              exit={{ opacity: 0 }}
              transition={spring}
            >
              <Warning size={24} weight="fill" />
              <div>
                <strong>The query didn't send.</strong> The tablet lost the connection halfway. Your note and photo are kept here, so nothing is lost. Try again, or keep it on this tablet and it will send on its own when the signal returns.
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="query__actions">
          <Button variant="primary" size="lg" disabled={note.trim().length < 4 || sending} onClick={send}>
            {sending ? "Sending" : failed ? "Try again" : "Send to Drawing Review"}
          </Button>
          {failed ? (
            <Button
              variant="secondary"
              size="lg"
              onClick={() => {
                onClose();
                toast(`Query for ${job.id} is kept on this tablet and will send when online`);
              }}
            >
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

