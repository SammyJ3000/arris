// The job sheet. Where the job is, its drawing (current revision and what it
// superseded), the cutting list, materials, and the two gates made visible.

import { useEffect, useState, type ReactNode } from "react";
import {
  ArrowRight,
  Camera,
  CaretRight,
  FilePdf,
  Flag,
  LockSimple,
  Warning,
  CloudArrowUp,
  Check,
} from "@phosphor-icons/react";
import { Sheet } from "../components/Sheet";
import { StageChain } from "../components/StageChain";
import { Button, Dimension, RevMark, RevisionCloud, Stamp } from "../components/primitives";
import { BottomSheet, Dialog } from "../components/overlays";
import {
  MATERIAL_STATUS_LABEL,
  STAGES,
  type Cut,
  type CutStatus,
  type Job,
  type Material,
} from "../shared/domain";
import { navigate } from "../router";
import { currentDrawing, formatDate, formatDateLong, nextStage, useStore } from "../store";
import { UrgencyMark } from "./MyJobs";

const CUT_ORDER: CutStatus[] = ["pending", "cut", "edged", "complete"];
const CUT_LABEL: Record<CutStatus, string> = {
  pending: "Pending",
  cut: "Cut",
  edged: "Edged",
  complete: "Complete",
  issue: "Issue",
};

export function JobPage({
  jobId,
  demo,
}: {
  jobId: string;
  demo: { gate?: boolean; conflict?: boolean; denied?: boolean; error?: boolean };
}) {
  const { state, dispatch, toast, person } = useStore();
  const job = state.jobs.find((j) => j.id === jobId);
  const me = state.user;
  const isManager = me?.role === "manager";
  const isDirector = me?.role === "director";

  const [query, setQuery] = useState(false);
  const [gate, setGate] = useState<"drawing" | "materials" | null>(null);
  const [conflict, setConflict] = useState(false);
  const [denied, setDenied] = useState(false);
  const [error, setError] = useState<{ action: () => void } | null>(null);
  const [uploading, setUploading] = useState<"idle" | "uploading" | "stamped">("idle");

  // Demo flags from the prototype menu open the relevant state on arrival.
  useEffect(() => {
    if (!job) return;
    if (demo.gate) {
      if (!currentDrawing(job)) setGate("drawing");
      else if (job.stage === "materials") setGate("materials");
    }
    if (demo.conflict) setConflict(true);
    if (demo.denied) setDenied(true);
    if (demo.error) setError({ action: () => {} });
  }, [jobId]);

  if (!job) {
    return (
      <Sheet title="Job not found" back="/jobs" backLabel="My Jobs">
        <div className="notfound">
          <h1>There is no job {jobId}</h1>
          <p>It may have been deleted from the office, or the number was mistyped.</p>
          <Button variant="secondary" size="lg" onClick={() => navigate("/jobs")}>
            Back to My Jobs
          </Button>
        </div>
      </Sheet>
    );
  }

  const drawing = currentDrawing(job);
  const superseded = job.files.filter((f) => f.category === "drawing" && f.superseded);
  const to = nextStage(job.stage);
  const toLabel = to ? STAGES.find((s) => s.id === to)!.label : null;
  const outstanding = job.materials.filter((m) => m.status === "required" || m.status === "ordered");

  const commitMove = () => {
    if (!to) return;
    const from = job.stage;
    const note = gate === "materials" && outstanding.length ? `Moved to ${toLabel} with ${outstanding.length} material${outstanding.length === 1 ? "" : "s"} outstanding` : undefined;
    dispatch({ type: "set-stage", jobId: job.id, stage: to, note });
    setGate(null);
    toast(`${job.id} moved to ${toLabel}`, {
      undo: () => dispatch({ type: "set-stage", jobId: job.id, stage: from, note: "Stage move undone" }),
    });
  };

  const tryMove = () => {
    if (!to) return;
    if (isDirector) {
      setDenied(true);
      return;
    }
    if (to === "complete" && !isManager) {
      setDenied(true);
      return;
    }
    if (job.stage === "new" && !drawing) {
      setGate("drawing");
      return;
    }
    if (to === "cnc" && outstanding.length > 0) {
      setGate("materials");
      return;
    }
    if (demo.error) {
      setError({ action: commitMove });
      return;
    }
    commitMove();
  };

  const advanceCut = (cut: Cut) => {
    if (isDirector) return setDenied(true);
    const i = CUT_ORDER.indexOf(cut.status);
    const nextStatus = cut.status === "issue" ? "pending" : CUT_ORDER[Math.min(i + 1, CUT_ORDER.length - 1)];
    if (nextStatus === cut.status) return;
    dispatch({ type: "set-cut", jobId: job.id, cutId: cut.id, status: nextStatus });
  };
  const flagCut = (cut: Cut) => {
    if (isDirector) return setDenied(true);
    dispatch({ type: "set-cut", jobId: job.id, cutId: cut.id, status: cut.status === "issue" ? "pending" : "issue" });
  };

  const approve = () => {
    setUploading("uploading");
    setTimeout(() => {
      const letters = "ABCDEFGH";
      const last = job.files.filter((f) => f.category === "drawing").map((f) => f.revision ?? "A").sort().pop();
      const rev = last ? letters[letters.indexOf(last) + 1] : "A";
      dispatch({ type: "approve-drawing", jobId: job.id, revision: rev });
      setUploading("stamped");
    }, 1100);
  };

  const stageLabel = STAGES.find((s) => s.id === job.stage)!.label;

  return (
    <Sheet
      title={`${job.piece}`}
      jobNo={job.id}
      rev={drawing?.revision ?? ""}
      back={isManager || isDirector ? "/board" : "/jobs"}
      backLabel={isManager || isDirector ? "Board" : "My Jobs"}
      className="sheet--job"
      headRight={<UrgencyMark job={job} size="md" />}
    >
      <div className="job">
        {/* Identity row */}
        <header className="job__head">
          <div className="job__id-col">
            <span className="job__id mono">{job.id}</span>
            <span className="job__ref mono">{job.ref}</span>
          </div>
          <div className="job__title-col">
            <h1 className="job__piece">{job.piece}</h1>
            <p className="job__client">
              {job.client}. Install {formatDateLong(job.installDate)} at {job.site.address.split(",").slice(-2).join(",").trim()}.
            </p>
          </div>
          <div className="job__people">
            {job.assigned.length === 0 ? (
              <span className="job__unassigned">Nobody assigned</span>
            ) : (
              job.assigned.map((id) => (
                <span key={id} className="chip">
                  <span className="chip__initials mono">{person(id)?.initials}</span>
                  {person(id)?.name}
                </span>
              ))
            )}
          </div>
        </header>

        {/* Stage chain and action */}
        <section className="job__stages" aria-labelledby="stages-h">
          <h2 className="sr-only" id="stages-h">
            Where the job is
          </h2>
          {job.inDrawingReview ? (
            <RevisionCloud tone="blue" className="job__review-cloud">
              <StageChain job={job} size="lg" />
              <div className="review-note">
                <span className="review-note__title">In Drawing Review</span>
                <span className="review-note__body">
                  {person(job.inDrawingReview.raisedBy)?.name.split(" ")[0]} asked: "{job.inDrawingReview.note}". The job stays in {stageLabel} until the office answers.
                </span>
                {isManager && (
                  <Button size="sm" variant="secondary" onClick={() => { dispatch({ type: "resolve-review", jobId: job.id }); toast("Drawing query resolved"); }}>
                    Resolve query
                  </Button>
                )}
              </div>
            </RevisionCloud>
          ) : (
            <StageChain job={job} size="lg" />
          )}

          <div className="job__move">
            {job.stage === "complete" ? (
              <Stamp lines={["Delivered", formatDateLong(job.history[job.history.length - 1].at)]} tone="green" compact rotate={-3} />
            ) : (
              <>
                <Button
                  variant="primary"
                  size="xl"
                  onClick={tryMove}
                  iconRight={
                    job.stage === "new" && !drawing ? <LockSimple size={26} weight="regular" aria-hidden="true" /> : <ArrowRight size={26} weight="bold" aria-hidden="true" />
                  }
                  aria-describedby={job.stage === "new" && !drawing ? "gate-note" : undefined}
                >
                  {job.stage === "new" ? "Move to Materials" : to === "complete" ? "Mark delivered" : `${STAGES.find((s) => s.id === job.stage)!.short} done, pass to ${toLabel}`}
                </Button>
                {job.stage === "new" && !drawing && (
                  <p className="job__move-note" id="gate-note">
                    Locked until a drawing is approved.
                  </p>
                )}
                {to === "cnc" && outstanding.length > 0 && (
                  <p className="job__move-note">
                    {outstanding.length} material{outstanding.length === 1 ? " is" : "s are"} not in stock yet. You will be asked before it moves.
                  </p>
                )}
              </>
            )}
          </div>
        </section>

        <div className="job__grid">
          {/* Drawing */}
          <section className="panel" aria-labelledby="drawing-h">
            <div className="panel__head">
              <h2 className="panel__h2" id="drawing-h">
                Drawing
              </h2>
              {!isDirector && (
                <Button size="sm" variant="ghost" icon={<Flag size={20} aria-hidden="true" />} onClick={() => setQuery(true)}>
                  Raise a drawing query
                </Button>
              )}
            </div>
            {drawing ? (
              <>
                <button type="button" className="drawing-card" onClick={() => navigate(`/job/${job.id}/drawing`)}>
                  <RevMark rev={drawing.revision} size={56} tone="blue" />
                  <span className="drawing-card__main">
                    <span className="drawing-card__name">{drawing.name}</span>
                    <span className="drawing-card__meta">
                      Rev {drawing.revision}, approved {formatDate(drawing.uploadedAt)} by {person(drawing.uploadedBy)?.name}. PDF, {(drawing.sizeBytes / 1_000_000).toFixed(1)} MB.
                    </span>
                  </span>
                  <span className="drawing-card__open">
                    <FilePdf size={26} aria-hidden="true" />
                    Open
                    <CaretRight size={20} weight="bold" aria-hidden="true" />
                  </span>
                </button>
                {superseded.map((f) => (
                  <div key={f.id} className="drawing-card drawing-card--superseded">
                    <RevMark rev={f.revision} size={40} superseded />
                    <span className="drawing-card__main">
                      <span className="drawing-card__name">
                        {f.name} <span className="superseded-tag">Superseded</span>
                      </span>
                      <span className="drawing-card__meta">
                        Rev {f.revision}, replaced {formatDate(drawing.uploadedAt)}. Kept for the record, not for the bench.
                      </span>
                    </span>
                    <button type="button" className="link-btn link-btn--sm" onClick={() => navigate(`/job/${job.id}/drawing?rev=${f.revision}`)}>
                      View anyway
                    </button>
                  </div>
                ))}
              </>
            ) : (
              <DrawingGatePanel job={job} isManager={isManager} uploading={uploading} onApprove={approve} />
            )}
          </section>

          {/* Materials */}
          <section className="panel" aria-labelledby="materials-h">
            <div className="panel__head">
              <h2 className="panel__h2" id="materials-h">
                Materials
              </h2>
              {outstanding.length > 0 && <span className="pencil pencil--sm">{outstanding.length} not in stock</span>}
            </div>
            {job.materials.length === 0 ? (
              <p className="panel__empty">No materials listed yet. The office adds them when the drawing is approved.</p>
            ) : (
              <ul className="mats">
                {job.materials.map((m) => (
                  <MaterialRow key={m.id} m={m} />
                ))}
              </ul>
            )}
          </section>
        </div>

        {/* Cutting list */}
        <section className="panel panel--wide" aria-labelledby="cuts-h">
          <div className="panel__head">
            <h2 className="panel__h2" id="cuts-h">
              Cutting list
            </h2>
            <span className="panel__count mono">
              {job.cuts.filter((c) => c.status === "complete").length} of {job.cuts.length} complete
            </span>
          </div>
          {job.cuts.length === 0 ? (
            <p className="panel__empty">No cutting list yet. It is imported from the CNC export once the drawing is approved.</p>
          ) : (
            <div className="cuts" role="table" aria-label="Cutting list">
              <div className="cuts__head" role="row">
                <span role="columnheader">Component</span>
                <span role="columnheader">Material</span>
                <span role="columnheader" className="cuts__num">
                  Qty
                </span>
                <span role="columnheader" className="cuts__num">
                  Size mm
                </span>
                <span role="columnheader">Edging</span>
                <span role="columnheader">Status. Tap to advance</span>
              </div>
              {job.cuts.map((c) => (
                <div key={c.id} className={`cut cut--${c.status}`} role="row">
                  <span className="cut__label" role="cell">
                    {c.label}
                  </span>
                  <span className="cut__mat" role="cell">
                    {c.material}
                  </span>
                  <span className="cut__qty mono cuts__num" role="cell">
                    {c.qty}
                  </span>
                  <span className="cut__dims mono cuts__num" role="cell">
                    {c.dims}
                  </span>
                  <span className="cut__edge" role="cell">
                    {c.edging}
                  </span>
                  <span className="cut__status" role="cell">
                    <button
                      type="button"
                      className={`cutstep cutstep--${c.status}`}
                      onClick={() => advanceCut(c)}
                      aria-label={`${c.label}: ${CUT_LABEL[c.status]}. ${c.status === "complete" ? "" : "Tap to mark " + CUT_LABEL[c.status === "issue" ? "pending" : CUT_ORDER[Math.min(CUT_ORDER.indexOf(c.status) + 1, 3)]]}`}
                    >
                      {CUT_ORDER.map((s, i) => (
                        <span
                          key={s}
                          className={`cutstep__seg ${c.status !== "issue" && CUT_ORDER.indexOf(c.status) >= i ? "is-on" : ""} ${c.status === s ? "is-current" : ""}`}
                        >
                          {CUT_LABEL[s]}
                        </span>
                      ))}
                      {c.status === "issue" && <span className="cutstep__issue">Issue</span>}
                    </button>
                    <button
                      type="button"
                      className={`icon-btn icon-btn--flag ${c.status === "issue" ? "is-on" : ""}`}
                      onClick={() => flagCut(c)}
                      aria-label={c.status === "issue" ? `Clear issue on ${c.label}` : `Flag an issue on ${c.label}`}
                      aria-pressed={c.status === "issue"}
                    >
                      <Warning size={24} weight={c.status === "issue" ? "fill" : "regular"} aria-hidden="true" />
                    </button>
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* History */}
        <section className="panel panel--wide panel--history" aria-labelledby="hist-h">
          <h2 className="panel__h2" id="hist-h">
            Record
          </h2>
          <ol className="hist">
            {[...job.history].reverse().map((h, i) => (
              <li key={i} className="hist__row">
                <span className="hist__date mono">{formatDate(h.at)}</span>
                <span className="hist__text">{h.text}</span>
                <span className="hist__by">{person(h.by)?.name}</span>
              </li>
            ))}
          </ol>
        </section>
      </div>

      {/* Raise a drawing query */}
      <QuerySheet
        open={query}
        onClose={() => setQuery(false)}
        job={job}
        onSend={(note, photo) => {
          dispatch({ type: "raise-query", jobId: job.id, note, photo });
          setQuery(false);
          toast(`${job.id} sent to Drawing Review`, { tone: "blue" });
        }}
      />

      {/* Materials check */}
      <Dialog open={gate === "materials"} onClose={() => setGate(null)} title="Materials are not all in" tone="amber" width={600} labelledBy="mat-gate-h">
        <div className="dialog__body">
          <p className="dialog__lead">
            Moving {job.id} to CNC / Machining with {outstanding.length} item{outstanding.length === 1 ? "" : "s"} still to arrive. That is fine for things fitted later, like ironmongery. It is not fine for the sheet goods.
          </p>
          <ul className="mats mats--dialog">
            {outstanding.map((m) => (
              <MaterialRow key={m.id} m={m} />
            ))}
          </ul>
        </div>
        <div className="dialog__actions">
          <Button variant="secondary" size="lg" onClick={() => setGate(null)}>
            Wait for materials
          </Button>
          <Button variant="primary" size="lg" onClick={commitMove}>
            Continue to CNC anyway
          </Button>
        </div>
      </Dialog>

      {/* Drawing gate, tried from the button */}
      <Dialog open={gate === "drawing"} onClose={() => setGate(null)} title="No approved drawing" tone="red" width={620} labelledBy="dwg-gate-h">
        <div className="dialog__body">
          <p className="dialog__lead">
            {job.id} cannot leave New Job until a drawing is approved. There is nothing to cut to, so there is nothing to order for.
          </p>
          <DrawingGatePanel job={job} isManager={isManager} uploading={uploading} onApprove={approve} inDialog />
        </div>
        <div className="dialog__actions">
          <Button variant="secondary" size="lg" onClick={() => setGate(null)}>
            {uploading === "stamped" ? "Close" : "Understood"}
          </Button>
          {uploading === "stamped" && (
            <Button variant="primary" size="lg" onClick={commitMove} iconRight={<ArrowRight size={22} weight="bold" aria-hidden="true" />}>
              Move to Materials
            </Button>
          )}
        </div>
      </Dialog>

      {/* Conflict */}
      <Dialog open={conflict} onClose={() => setConflict(false)} title="Someone else changed this job" tone="blue" width={680} labelledBy="conflict-h">
        <div className="dialog__body">
          <p className="dialog__lead">
            Tom changed {job.id} on the bench tablet 2 minutes ago, while this screen was showing the older version. Both changes are kept until you choose.
          </p>
          <div className="conflict">
            <div className="conflict__col">
              <div className="conflict__head">
                <span className="conflict__who">Tom, bench tablet</span>
                <span className="conflict__ver mono">v{job.version + 1}</span>
              </div>
              <ul className="conflict__changes">
                <li>
                  Shelves: <s>Cut</s> <strong>Edged</strong>
                </li>
                <li>
                  Note added: "Back panel veneer arrived, matched."
                </li>
              </ul>
            </div>
            <div className="conflict__col conflict__col--mine">
              <div className="conflict__head">
                <span className="conflict__who">You, this screen</span>
                <span className="conflict__ver mono">v{job.version}</span>
              </div>
              <ul className="conflict__changes">
                <li>
                  Shelves: <s>Cut</s> <strong>Complete</strong>
                </li>
              </ul>
            </div>
          </div>
        </div>
        <div className="dialog__actions">
          <Button variant="secondary" size="lg" onClick={() => { setConflict(false); toast("Kept Tom's version. Your change was not saved."); }}>
            Keep Tom's version
          </Button>
          <Button variant="primary" size="lg" onClick={() => { setConflict(false); dispatch({ type: "set-cut", jobId: job.id, cutId: "c4", status: "complete" }); toast("Your change was applied over Tom's. Both are in the record.", { tone: "blue" }); }}>
            Apply mine on top
          </Button>
        </div>
      </Dialog>

      {/* Permission denied */}
      <Dialog open={denied} onClose={() => setDenied(false)} title={isDirector ? "Read only" : "Only the workshop manager can do that"} tone="ink" width={560} labelledBy="denied-h">
        <div className="dialog__body">
          {isDirector ? (
            <p className="dialog__lead">Directors see the board and the jobs but do not change them. Ask Steve if something needs moving.</p>
          ) : (
            <p className="dialog__lead">
              Marking a job delivered closes it and prints the delivery note, so it is the manager's call. Steve can do it from the office, or sign in here with the office sign-in.
            </p>
          )}
          <div className="authority">
            <span className="authority__label">Authority</span>
            <span className="authority__value">Workshop Manager</span>
            <span className="authority__label">You</span>
            <span className="authority__value">
              {me?.name}, {me?.teamRole ?? me?.role}
            </span>
          </div>
        </div>
        <div className="dialog__actions">
          <Button variant="secondary" size="lg" onClick={() => setDenied(false)}>
            Back to the job
          </Button>
          {!isDirector && (
            <Button variant="primary" size="lg" onClick={() => navigate("/office")}>
              Office sign-in
            </Button>
          )}
        </div>
      </Dialog>

      {/* Error with a way out */}
      <Dialog open={!!error} onClose={() => setError(null)} title="The change did not reach the workshop" tone="red" width={600} labelledBy="error-h">
        <div className="dialog__body">
          <p className="dialog__lead">
            The tablet could not talk to the workshop server, so the stage move is not saved yet. Nothing is lost: it is kept on this tablet.
          </p>
          <p className="dialog__detail mono">PUT /jobs/{job.id} timed out after 8 s</p>
        </div>
        <div className="dialog__actions dialog__actions--three">
          <Button variant="ghost" size="lg" onClick={() => setError(null)}>
            Discard change
          </Button>
          <Button
            variant="secondary"
            size="lg"
            onClick={() => {
              dispatch({ type: "set-offline", offline: true });
              error?.action();
              setError(null);
              toast("Working offline. The change will sync when the wifi is back.");
            }}
          >
            Keep it, sync later
          </Button>
          <Button variant="primary" size="lg" onClick={() => { error?.action(); setError(null); toast("Saved on the second try", { tone: "blue" }); }}>
            Try again
          </Button>
        </div>
      </Dialog>
    </Sheet>
  );
}

function DrawingGatePanel({
  job,
  isManager,
  uploading,
  onApprove,
  inDialog = false,
}: {
  job: Job;
  isManager: boolean;
  uploading: "idle" | "uploading" | "stamped";
  onApprove: () => void;
  inDialog?: boolean;
}) {
  const { person } = useStore();
  const drawing = currentDrawing(job);
  return (
    <div className={`gate ${inDialog ? "gate--dialog" : ""} ${uploading === "stamped" ? "is-open" : ""}`}>
      <div className="gate__tb">
        <div className="gate__cell">
          <span className="gate__label">Drawing</span>
          <span className="gate__value">{drawing ? drawing.name : "None on file"}</span>
        </div>
        <div className="gate__cell gate__cell--rev">
          <span className="gate__label">Rev</span>
          <RevMark rev={drawing?.revision} size={40} tone="blue" />
        </div>
        <div className={`gate__cell ${uploading === "stamped" ? "gate__cell--stamped" : ""}`}>
          <span className="gate__label">Approved</span>
          {uploading === "stamped" && drawing ? (
            <Stamp lines={["Approved", `Rev ${drawing.revision}`, `${person(drawing.uploadedBy)?.name}, ${formatDate(drawing.uploadedAt)}`]} animate compact rotate={-4} />
          ) : (
            <span className="gate__value">{drawing ? `${formatDate(drawing.uploadedAt)}, ${person(drawing.uploadedBy)?.name}` : "Not yet"}</span>
          )}
        </div>
      </div>
      {uploading !== "stamped" ? (
        <div className="gate__what">
          <p className="gate__p">
            <strong>Office:</strong> upload the client-approved drawing to {job.id}. The gate opens on its own.
          </p>
          <p className="gate__p">
            <strong>Floor:</strong> nothing to do here. Ask Steve when the drawing is due.
          </p>
          {isManager && (
            <Button
              variant="primary"
              size="lg"
              icon={<CloudArrowUp size={24} aria-hidden="true" />}
              onClick={onApprove}
              disabled={uploading === "uploading"}
              className={uploading === "uploading" ? "is-busy" : ""}
            >
              {uploading === "uploading" ? "Uploading Rev A" : "Upload approved drawing"}
            </Button>
          )}
        </div>
      ) : (
        <p className="gate__p gate__p--open">
          <Check size={22} weight="bold" aria-hidden="true" /> Gate open. {job.id} can move to Materials.
        </p>
      )}
    </div>
  );
}

function MaterialRow({ m }: { m: Material }) {
  return (
    <li className={`mat mat--${m.status}`}>
      <span className="mat__name">{m.name}</span>
      <span className="mat__cat">{m.category}</span>
      <span className="mat__qty mono">
        {m.qty} {m.unit}
      </span>
      <span className="mat__supplier">{m.supplier || <span className="redpen redpen--sm">No supplier</span>}</span>
      <span className={`mat__status mat__status--${m.status}`}>{MATERIAL_STATUS_LABEL[m.status]}</span>
    </li>
  );
}

function QuerySheet({
  open,
  onClose,
  job,
  onSend,
}: {
  open: boolean;
  onClose: () => void;
  job: Job;
  onSend: (note: string, photo: boolean) => void;
}) {
  const [note, setNote] = useState("");
  const [photo, setPhoto] = useState(false);
  const [touched, setTouched] = useState(false);
  useEffect(() => {
    if (!open) {
      setNote("");
      setPhoto(false);
      setTouched(false);
    }
  }, [open]);
  const drawing = currentDrawing(job);
  const invalid = touched && note.trim().length < 6;
  return (
    <BottomSheet open={open} onClose={onClose} title={`Drawing query on ${job.id}`}>
      <div className="query">
        <div className="query__ctx">
          <RevMark rev={drawing?.revision} size={40} tone="blue" />
          <span>
            Against <strong>{drawing ? `Rev ${drawing.revision}` : "no drawing"}</strong>. The job goes to Drawing Review and stays in{" "}
            {STAGES.find((s) => s.id === job.stage)!.label} until the office answers.
          </span>
        </div>
        <label className="field">
          <span className="field__label">What is wrong, or unclear?</span>
          <textarea
            className={`field__input field__input--area ${invalid ? "is-invalid" : ""}`}
            rows={3}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            onBlur={() => setTouched(true)}
            placeholder="For example: back panel height on sheet 2 does not match the plan"
            aria-invalid={invalid}
            aria-describedby={invalid ? "q-err" : undefined}
          />
          {invalid && (
            <span className="field__error" id="q-err" role="alert">
              Say what the office should look at. A few words is enough.
            </span>
          )}
        </label>
        <div className="query__photo">
          <button type="button" className={`photo-btn ${photo ? "is-on" : ""}`} onClick={() => setPhoto((p) => !p)} aria-pressed={photo}>
            <Camera size={26} aria-hidden="true" />
            <span>{photo ? "Photo attached" : "Add a photo"}</span>
          </button>
          {photo && (
            <span className="photo-thumb" aria-label="Photo preview">
              <svg viewBox="0 0 96 72" width="96" height="72" aria-hidden="true">
                <rect width="96" height="72" fill="var(--sheet-3)" />
                <path d="M0 58 L30 34 L50 50 L66 40 L96 62 V72 H0 Z" fill="var(--rule-2)" />
                <circle cx="74" cy="20" r="7" fill="var(--rule-2)" />
              </svg>
              <span className="mono">IMG_0412</span>
            </span>
          )}
        </div>
        <div className="query__actions">
          <Button variant="secondary" size="lg" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="lg"
            onClick={() => {
              setTouched(true);
              if (note.trim().length >= 6) onSend(note.trim(), photo);
            }}
            iconRight={<ArrowRight size={22} weight="bold" aria-hidden="true" />}
          >
            Send to Drawing Review
          </Button>
        </div>
      </div>
    </BottomSheet>
  );
}

export function Labelled({ label, children }: { label: string; children: ReactNode }) {
  return (
    <span className="labelled">
      <span className="labelled__label">{label}</span>
      {children}
    </span>
  );
}

export { Dimension };
