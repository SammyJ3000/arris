import { useState, type ReactNode } from "react";
import { ArrowRight, Camera, Check, CheckCircle, Lock, MagnifyingGlassMinus, MagnifyingGlassPlus, Warning, X, ChatCircleText, ArrowCounterClockwise, Package } from "@phosphor-icons/react";
import type { Job, StageId, Cut, Material } from "../shared/domain";
import { MATERIAL_STATUS_LABEL } from "../shared/domain";
import { Topbar } from "../components/Topbar";
import { StageRail } from "../components/StageRail";
import { Avatar, Btn, Dialog, DueTag, OfflineStrip, Outline, Sheet, StageTag } from "../components/ui";
import { ReceptionDesk } from "../drawing/ReceptionDesk";
import { useStore } from "../state";
import { CUT_LABEL, fmtBytes, fmtDayNum, nextCutStatus, nextStage, paint, person, personName, relTime, stageLabel, stageShort, firstName, fmtDate } from "../stages";
import { go, href } from "../router";

type Tab = "drawing" | "cuts" | "materials" | "notes";
type Gate = null | "drawing" | "materials" | "permission" | "conflict" | "error" | "query";

export function JobPage({ job, tab, setTab, flags }: { job: Job; tab: Tab; setTab: (t: Tab) => void; flags: { conflict: boolean; error: boolean } }) {
  const { state, dispatch } = useStore();
  const me = state.user!;
  const isManager = me.role === "manager";
  const [gate, setGate] = useState<Gate>(null);
  const [errorTries, setErrorTries] = useState(0);
  const to = nextStage(job.stage);
  const currentDrawing = job.files.find((f) => f.category === "drawing" && !f.superseded);
  const shortMaterials = job.materials.filter((m) => m.status === "required" || m.status === "ordered");

  const doMove = (stage: StageId) => {
    dispatch({ type: "move", jobId: job.id, to: stage, by: me.id });
    dispatch({ type: "toast", text: `${job.id} passed to ${stageLabel(stage)}`, paint: paint(stage) });
    setGate(null);
  };

  const tryPass = () => {
    if (!to) return;
    if (job.stage === "new" && !currentDrawing) return setGate("drawing");
    if (to === "complete" && !isManager) return setGate("permission");
    if (flags.conflict) return setGate("conflict");
    if (flags.error && errorTries === 0) return setGate("error");
    if (to === "cnc" && shortMaterials.length > 0) return setGate("materials");
    doMove(to);
  };

  const passLabel = !to
    ? "Delivered"
    : to === "complete"
      ? "Mark as Delivered"
      : job.stage === "new"
        ? `Pass to ${stageLabel(to)}`
        : `Done at ${stageShort(job.stage)}, pass to ${stageLabel(to)}`;

  const target = fmtDayNum(job.targetDate);
  const install = fmtDayNum(job.installDate);

  return (
    <div className="page">
      <Topbar back={isManager ? "/board" : "/jobs"} title={isManager ? "Board" : "My jobs"} />
      <OfflineStrip />
      <main className="page-body" style={{ paddingBottom: 0 }}>
        <header className="job-head">
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
              <span className="num job-num">{job.id}</span>
              <StageTag stage={job.inDrawingReview ? "review" : job.stage} size="lg" />
              <DueTag targetDate={job.targetDate} stage={job.stage} size="lg" />
              {job.flag !== "None" && !job.inDrawingReview && (
                <span className="tag tag-lg tag-outline" style={{ ["--paint" as any]: job.flag === "Urgent" ? "var(--red)" : "var(--ink-3)" }}>
                  {job.flag}
                </span>
              )}
            </div>
            <h1 className="job-piece">{job.piece}</h1>
            <p className="job-client">
              {job.client} <span style={{ color: "var(--line-strong)", margin: "0 6px" }}>|</span> {job.ref}
            </p>
          </div>
          <div className="dates">
            <div className="date-block">
              <span className="label">Workshop target</span>
              <span className="num">
                {target.day}
                <small>{target.mon}</small>
              </span>
            </div>
            <div className="date-block">
              <span className="label">Install on site</span>
              <span className="num">
                {install.day}
                <small>{install.mon}</small>
              </span>
            </div>
            <div className="date-block" style={{ textAlign: "left" }}>
              <span className="label">Assigned</span>
              <span style={{ display: "flex", gap: 6, marginTop: 10 }}>
                {job.assigned.length === 0 && <span className="muted">Nobody yet</span>}
                {job.assigned.map((p) => (
                  <span key={p} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontWeight: 600 }}>
                    <Avatar initials={person(p)?.initials ?? "?"} small /> {firstName(p)}
                  </span>
                ))}
              </span>
            </div>
          </div>
        </header>

        {job.inDrawingReview && (
          <div className="review-banner" role="status">
            <ChatCircleText size={32} weight="bold" />
            <div style={{ flex: 1 }}>
              <strong style={{ fontSize: "var(--fs-18)" }}>In Drawing Review.</strong> {personName(job.inDrawingReview.raisedBy)} raised a query {relTime(job.inDrawingReview.at)}: "{job.inDrawingReview.note}"
              <div style={{ fontSize: "var(--fs-14)", marginTop: 2 }}>The job stays at {stageLabel(job.stage)} until Steve uploads a revised drawing.</div>
            </div>
            {isManager && (
              <Btn kind="ghost" size="sm" onClick={() => dispatch({ type: "resolveQuery", jobId: job.id, by: me.id })}>
                Resolve
              </Btn>
            )}
          </div>
        )}

        <StageRail job={job} />

        <div className="tabs job-tabs" role="tablist">
          <TabBtn id="drawing" cur={tab} set={setTab}>
            Drawing
          </TabBtn>
          <TabBtn id="cuts" cur={tab} set={setTab} count={job.cuts.length ? `${job.cuts.filter((c) => c.status === "complete").length}/${job.cuts.length}` : undefined}>
            Cutting list
          </TabBtn>
          <TabBtn id="materials" cur={tab} set={setTab} count={job.materials.length ? String(job.materials.length) : undefined}>
            Materials
          </TabBtn>
          <TabBtn id="notes" cur={tab} set={setTab}>
            Notes & history
          </TabBtn>
        </div>

        <div role="tabpanel">
          {tab === "drawing" && <DrawingTab job={job} />}
          {tab === "cuts" && <CutsTab job={job} />}
          {tab === "materials" && <MaterialsTab job={job} />}
          {tab === "notes" && <NotesTab job={job} />}
        </div>

        <div className="job-actions">
          {to ? (
            to === "complete" && !isManager ? (
              <Btn kind="locked" size="xl" onClick={() => setGate("permission")} aria-describedby="lock-help">
                <Lock size={26} weight="bold" />
                Mark as Delivered
              </Btn>
            ) : (
              <Btn kind="paint" stage={to} size="xl" onClick={tryPass} disabled={!!job.inDrawingReview}>
                {passLabel}
                <ArrowRight size={28} weight="bold" />
              </Btn>
            )
          ) : (
            <Btn kind="ghost" size="xl" disabled>
              <CheckCircle size={26} weight="bold" /> Delivered
            </Btn>
          )}
          {job.stage !== "new" && job.stage !== "ready" && job.stage !== "complete" && !job.inDrawingReview && (
            <Btn kind="ghost" size="xl" onClick={() => setGate("query")}>
              <ChatCircleText size={26} weight="bold" />
              Raise a drawing query
            </Btn>
          )}
        </div>
      </main>

      {/* ---------- Gates and states ---------- */}
      <Dialog open={gate === "drawing"} onClose={() => setGate(null)} band={paint("new")} bandText="Can't leave New yet">
        <h2>{job.id} has no approved drawing, so it stays in New.</h2>
        <p>
          Nothing moves to Materials without a drawing to build from. Steve needs to upload the approved drawing from the office. Once it's on the job, this button will pass it on.
        </p>
        <div className="dialog-actions">
          <Btn
            size="lg"
            onClick={() => {
              dispatch({ type: "note", jobId: job.id, text: `${firstName(me.id)} is waiting on the drawing for ${job.id}.`, by: me.id });
              dispatch({ type: "toast", text: "Steve has been asked for the drawing" });
              setGate(null);
            }}
          >
            Ask Steve for the drawing
          </Btn>
          <Btn kind="ghost" size="lg" onClick={() => setGate(null)}>
            Close
          </Btn>
        </div>
      </Dialog>

      <Dialog open={gate === "materials"} onClose={() => setGate(null)} band="var(--amber)" bandText="Check materials first">
        <h2>
          {shortMaterials.length} item{shortMaterials.length === 1 ? " isn't" : "s aren't"} in stock yet.
        </h2>
        <p>CNC can start on what's here, but anything below will hold the job up later if it doesn't arrive.</p>
        <ul className="rows" style={{ marginTop: 16 }}>
          {shortMaterials.map((m) => (
            <li key={m.id} className="row mat-row" style={{ minHeight: 56, boxShadow: "none", background: "var(--ticket-2)" }}>
              <span>
                <span className="mat-name" style={{ fontSize: "var(--fs-16)" }}>{m.name}</span>
                <span className="mat-cat"> {m.category}</span>
              </span>
              <span className="num" style={{ fontSize: "var(--fs-20)" }}>
                {m.qty} <small style={{ fontSize: "var(--fs-14)", fontWeight: 600 }}>{m.unit}</small>
              </span>
              <span className="muted" style={{ fontSize: "var(--fs-14)" }}>{m.supplier || "No supplier yet"}</span>
              <MaterialTag status={m.status} />
            </li>
          ))}
        </ul>
        <div className="dialog-actions">
          <Btn kind="paint" stage="cnc" size="lg" onClick={() => doMove("cnc")}>
            Move to CNC anyway
          </Btn>
          <Btn kind="ghost" size="lg" onClick={() => setGate(null)}>
            Wait for materials
          </Btn>
        </div>
      </Dialog>

      <Dialog open={gate === "permission"} onClose={() => setGate(null)} band={paint("ready")} bandText="Manager only">
        <h2>Only the workshop manager can mark a job as delivered.</h2>
        <p>
          Delivery closes the job and triggers the paperwork, so it's Steve's call. He can do it from the office or from his tablet. You can let him know it's loaded and ready to go.
        </p>
        <div className="dialog-actions">
          <Btn
            size="lg"
            onClick={() => {
              dispatch({ type: "note", jobId: job.id, text: `${firstName(me.id)}: ${job.id} is loaded and ready to go.`, by: me.id });
              dispatch({ type: "toast", text: "Steve has been told it's ready" });
              setGate(null);
            }}
          >
            Tell Steve it's ready
          </Btn>
          <Btn kind="ghost" size="lg" onClick={() => setGate(null)}>
            Close
          </Btn>
        </div>
      </Dialog>

      <Dialog open={gate === "conflict"} onClose={() => setGate(null)} band={paint("review")} bandText="Someone else changed this job">
        <h2>Tom changed this job on the bench tablet 2 minutes ago.</h2>
        <p>
          He {job.cuts.length ? `marked "${job.cuts[Math.min(3, job.cuts.length - 1)].label}" as edged and ` : ""}added a note: "{job.cuts.length ? "Back panel veneer has arrived." : "Finish checked, one door needs a second coat."}" You're about to move {job.id} to {to ? stageLabel(to) : ""}. Have a look at what changed before you do, or move it on regardless. Nothing he did will be lost either way.
        </p>
        <div className="dialog-actions">
          <Btn
            size="lg"
            onClick={() => {
              setGate(null);
              go(`/job/${job.id}?as=steve`);
              setTab("notes");
              dispatch({ type: "toast", text: "Reloaded. Showing Tom's changes." });
            }}
          >
            <ArrowCounterClockwise size={22} weight="bold" />
            Reload and look first
          </Btn>
          <Btn kind="ghost" size="lg" onClick={() => to && doMove(to)}>
            Move it anyway
          </Btn>
        </div>
      </Dialog>

      <Dialog open={gate === "error"} onClose={() => setGate(null)} band="var(--red)" bandText="That didn't save">
        <h2>The change didn't reach the office.</h2>
        <p>
          The tablet lost the connection halfway through saving. Nothing has been lost: {job.id} is still at {stageLabel(job.stage)} and nobody else has moved it. Try again, or go back and carry on; the tablet will keep retrying in the background.
        </p>
        <div className="dialog-actions">
          <Btn
            size="lg"
            onClick={() => {
              setErrorTries(1);
              setGate(null);
              if (to) doMove(to);
            }}
          >
            Try again
          </Btn>
          <Btn kind="ghost" size="lg" onClick={() => go("/jobs")}>
            Back to my jobs
          </Btn>
        </div>
      </Dialog>

      <QuerySheet open={gate === "query"} onClose={() => setGate(null)} job={job} />
    </div>
  );
}

function TabBtn({ id, cur, set, children, count }: { id: Tab; cur: Tab; set: (t: Tab) => void; children: ReactNode; count?: string }) {
  return (
    <button role="tab" className="tab" aria-selected={cur === id} onClick={() => set(id)}>
      {children}
      {count && <span className="count">{count}</span>}
    </button>
  );
}

/* ---------- Drawing ---------- */
function DrawingTab({ job }: { job: Job }) {
  const drawings = job.files.filter((f) => f.category === "drawing").sort((a, b) => (a.superseded ? 1 : 0) - (b.superseded ? 1 : 0));
  if (drawings.length === 0) {
    return (
      <Outline minHeight={240}>
        <div style={{ maxWidth: 440 }}>
          <div className="num" style={{ fontSize: "var(--fs-48)", color: "var(--line-strong)" }}>No drawing yet</div>
          <p style={{ fontSize: "var(--fs-18)", marginTop: 8, color: "var(--ink-2)" }}>
            Steve uploads the approved drawing from the office. Until there's one on the job, it can't leave New.
          </p>
        </div>
      </Outline>
    );
  }
  return (
    <div className="rows" style={{ gap: 16 }}>
      {drawings.map((f) => (
        <article key={f.id} className={`ticket drawing-card ${f.superseded ? "superseded" : ""}`} style={{ padding: 16 }}>
          <a href={href(`/job/${job.id}/drawing?rev=${f.revision}`)} className="drawing-thumb" aria-label={`Open drawing revision ${f.revision}`}>
            {job.id === "J-1042" ? <ReceptionDesk revision={f.revision === "B" ? "B" : "C"} /> : <DrawingPlaceholder name={f.name} />}
          </a>
          <div>
            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <span className="num" style={{ fontSize: f.superseded ? "var(--fs-28)" : "var(--fs-48)" }}>Rev {f.revision}</span>
              {f.superseded ? (
                <span className="tag tag-outline" style={{ ["--paint" as any]: "var(--ink-3)" }}>Superseded</span>
              ) : (
                <span className="tag" style={{ ["--paint" as any]: "var(--ok)" }}>
                  <Check size={16} weight="bold" /> Approved, build to this
                </span>
              )}
            </div>
            <h3 style={{ fontSize: f.superseded ? "var(--fs-18)" : "var(--fs-24)", fontWeight: 700, marginTop: 6 }}>{f.name}</h3>
            <p className="muted" style={{ marginTop: 4 }}>
              Uploaded {relTime(f.uploadedAt)} by {personName(f.uploadedBy)}. PDF, {fmtBytes(f.sizeBytes)}.
            </p>
            {!f.superseded && (
              <div style={{ display: "flex", gap: 12, marginTop: 20 }}>
                <a href={href(`/job/${job.id}/drawing?rev=${f.revision}`)} className="btn btn-ink btn-lg">
                  Open drawing
                </a>
              </div>
            )}
            {f.superseded && (
              <a href={href(`/job/${job.id}/drawing?rev=${f.revision}`)} className="btn btn-ghost btn-sm" style={{ marginTop: 12 }}>
                Open for reference only
              </a>
            )}
          </div>
        </article>
      ))}
    </div>
  );
}

function DrawingPlaceholder({ name }: { name: string }) {
  return (
    <div style={{ aspectRatio: "840 / 594", display: "grid", placeItems: "center", background: "#fff", color: "var(--ink-3)", padding: 16, textAlign: "center" }}>
      <span>
        <span className="num" style={{ display: "block", fontSize: "var(--fs-28)", color: "var(--ink-2)" }}>PDF</span>
        <span style={{ fontSize: "var(--fs-14)" }}>{name}</span>
      </span>
    </div>
  );
}

export function DrawingViewer({ job, rev }: { job: Job; rev: string }) {
  const [zoom, setZoom] = useState(1);
  const file = job.files.find((f) => f.category === "drawing" && f.revision === rev) ?? job.files.find((f) => f.category === "drawing" && !f.superseded);
  const back = `/job/${job.id}`;
  return (
    <div className="viewer" role="dialog" aria-label={`Drawing ${file?.name} revision ${file?.revision}`}>
      <div className="viewer-bar">
        <a href={href(back)} className="btn btn-ghost btn-sm" style={{ minHeight: 44, minWidth: 44 }} aria-label="Close drawing">
          <X size={22} weight="bold" />
        </a>
        <div style={{ lineHeight: 1.15 }}>
          <div style={{ fontWeight: 700, fontSize: "var(--fs-18)" }}>
            {job.id} <span style={{ color: "var(--line-strong)", margin: "0 4px" }}>|</span> {file?.name}
          </div>
          <div className="muted" style={{ fontSize: "var(--fs-14)" }}>
            {file?.superseded ? "Superseded. Do not build to this revision." : `Approved revision. ${fmtBytes(file?.sizeBytes ?? 0)}.`}
          </div>
        </div>
        {file?.superseded ? (
          <span className="tag tag-lg" style={{ ["--paint" as any]: "var(--red)" }}>Rev {file.revision}, superseded</span>
        ) : (
          <span className="tag tag-lg" style={{ ["--paint" as any]: "var(--ok)" }}>Rev {file?.revision}, approved</span>
        )}
        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          <Btn kind="ghost" aria-label="Zoom out" onClick={() => setZoom((z) => Math.max(0.6, z - 0.2))} style={{ minWidth: 56 }}>
            <MagnifyingGlassMinus size={24} weight="bold" />
          </Btn>
          <Btn kind="ghost" aria-label="Zoom in" onClick={() => setZoom((z) => Math.min(2.4, z + 0.2))} style={{ minWidth: 56 }}>
            <MagnifyingGlassPlus size={24} weight="bold" />
          </Btn>
        </div>
      </div>
      <div className="viewer-canvas">
        <div className="viewer-sheet" style={{ width: "min(100%, 1040px)", transform: `scale(${zoom})` }}>
          {job.id === "J-1042" ? <ReceptionDesk revision={file?.revision === "B" ? "B" : "C"} /> : <DrawingPlaceholder name={file?.name ?? ""} />}
        </div>
      </div>
    </div>
  );
}

/* ---------- Cutting list ---------- */
function CutsTab({ job }: { job: Job }) {
  const { state, dispatch } = useStore();
  const me = state.user!;
  if (job.cuts.length === 0) {
    return (
      <Outline minHeight={240}>
        <div style={{ maxWidth: 440 }}>
          <div className="num" style={{ fontSize: "var(--fs-48)", color: "var(--line-strong)" }}>No cutting list</div>
          <p style={{ fontSize: "var(--fs-18)", marginTop: 8, color: "var(--ink-2)" }}>
            Steve imports it from the drawing office's CSV, or types it in. It shows up here with a status per component.
          </p>
        </div>
      </Outline>
    );
  }
  const done = job.cuts.filter((c) => c.status === "complete").length;
  return (
    <>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, marginBottom: 12, flexWrap: "wrap" }}>
        <p style={{ fontSize: "var(--fs-18)", fontWeight: 600 }}>
          {done} of {job.cuts.length} components complete. Tap a status to move it on.
        </p>
        <div style={{ display: "flex", gap: 4 }} aria-hidden>
          {job.cuts.map((c) => (
            <span key={c.id} style={{ width: 28, height: 10, borderRadius: 2, background: c.status === "complete" ? "var(--ink)" : c.status === "issue" ? "var(--red)" : c.status === "pending" ? "var(--floor-deep)" : "var(--ink-4)" }} />
          ))}
        </div>
      </div>
      <ul className="rows">
        {job.cuts.map((c) => (
          <li key={c.id} className="row cut-row">
            <span>
              <span className="cut-label">{c.label}</span>
              <span className="cut-mat" style={{ display: "block" }}>{c.material}</span>
            </span>
            <span className="num cut-qty">{c.qty}</span>
            <span className="cut-dims">{c.dims}</span>
            <span className="muted" style={{ fontSize: "var(--fs-14)" }}>
              <span style={{ display: "block", fontWeight: 600, color: "var(--ink-2)" }}>Edging</span>
              {c.edging}
            </span>
            <CutStatusBtn cut={c} onAdvance={() => dispatch({ type: "cut", jobId: job.id, cutId: c.id, status: nextCutStatus(c.status), by: me.id })} onIssue={() => dispatch({ type: "cut", jobId: job.id, cutId: c.id, status: c.status === "issue" ? "pending" : "issue", by: me.id })} />
          </li>
        ))}
      </ul>
    </>
  );
}

function CutStatusBtn({ cut, onAdvance, onIssue }: { cut: Cut; onAdvance: () => void; onIssue: () => void }) {
  const s = cut.status;
  const style: Record<string, string> =
    s === "complete"
      ? { "--btn-bg": "var(--ink)", "--btn-fg": "var(--on-paint)", "--btn-edge": "#000" }
      : s === "issue"
        ? { "--btn-bg": "var(--red)", "--btn-fg": "var(--on-paint)", "--btn-edge": "var(--red-edge)" }
        : s === "pending"
          ? { "--btn-bg": "var(--ticket)", "--btn-fg": "var(--ink)", "--btn-edge": "var(--line-strong)" }
          : { "--btn-bg": "var(--ink-3)", "--btn-fg": "var(--on-paint)", "--btn-edge": "var(--ink-2)" };
  const nextLabel = s === "complete" ? "" : s === "issue" ? "Clear issue" : `Mark ${CUT_LABEL[nextCutStatus(s)].toLowerCase()}`;
  if (s === "complete") {
    return (
      <span className="btn cut-status" style={{ ...(style as any), boxShadow: "none", cursor: "default", justifyContent: "flex-start" }} aria-label={`${cut.label}: complete`}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
          <Check size={20} weight="bold" /> Complete
        </span>
      </span>
    );
  }
  return (
    <span style={{ display: "grid", gap: 6 }}>
      <button
        className={`btn cut-status ${s === "pending" ? "btn-ghost" : ""}`}
        style={style as any}
        onClick={s === "issue" ? onIssue : onAdvance}
        aria-label={`${cut.label}: ${CUT_LABEL[s]}. ${nextLabel}`}
      >
        <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
          {s === "issue" && <Warning size={20} weight="bold" />}
          {CUT_LABEL[s]}
        </span>
        <span style={{ fontSize: "var(--fs-14)", fontWeight: 500, opacity: 0.85 }}>{nextLabel}</span>
      </button>
      {s !== "issue" && (
        <button onClick={onIssue} style={{ fontSize: "var(--fs-14)", color: "var(--ink-3)", fontWeight: 600, minHeight: 28, textAlign: "right" }}>
          Flag an issue
        </button>
      )}
    </span>
  );
}

/* ---------- Materials ---------- */
export function MaterialTag({ status }: { status: Material["status"] }) {
  const style =
    status === "required"
      ? { ["--paint" as any]: "var(--red)" }
      : status === "ordered"
        ? { ["--paint" as any]: "var(--amber)", ["--tint" as any]: "var(--amber-tint)" }
        : status === "complete"
          ? { ["--paint" as any]: "var(--ink)" }
          : { ["--paint" as any]: "var(--ink-2)", ["--tint" as any]: "var(--ticket-2)" };
  const cls = status === "required" ? "tag tag-outline" : status === "ordered" ? "tag tag-tint" : status === "complete" ? "tag" : "tag tag-tint";
  return (
    <span className={cls} style={style}>
      {MATERIAL_STATUS_LABEL[status]}
    </span>
  );
}

function MaterialsTab({ job }: { job: Job }) {
  if (job.materials.length === 0) {
    return (
      <Outline minHeight={240}>
        <div style={{ maxWidth: 440 }}>
          <Package size={48} weight="bold" style={{ color: "var(--line-strong)" }} />
          <div className="num" style={{ fontSize: "var(--fs-48)", color: "var(--line-strong)" }}>No materials listed</div>
          <p style={{ fontSize: "var(--fs-18)", marginTop: 8, color: "var(--ink-2)" }}>Steve adds them from the office once the drawing is approved.</p>
        </div>
      </Outline>
    );
  }
  const short = job.materials.filter((m) => m.status === "required" || m.status === "ordered").length;
  return (
    <>
      <p style={{ fontSize: "var(--fs-18)", fontWeight: 600, marginBottom: 12 }}>
        {short === 0 ? "Everything is in stock or already issued." : `${short} item${short === 1 ? "" : "s"} still to come in.`}
      </p>
      <ul className="rows">
        {job.materials.map((m) => (
          <li key={m.id} className="row mat-row">
            <span>
              <span className="mat-name">{m.name}</span>
              <span className="mat-cat" style={{ display: "block" }}>{m.category}</span>
            </span>
            <span className="num" style={{ fontSize: "var(--fs-28)" }}>
              {m.qty} <small style={{ fontSize: "var(--fs-14)", fontWeight: 600, color: "var(--ink-3)" }}>{m.unit}</small>
            </span>
            <span className="muted">{m.supplier || "No supplier yet"}</span>
            <MaterialTag status={m.status} />
          </li>
        ))}
      </ul>
    </>
  );
}

/* ---------- Notes and history ---------- */
function NotesTab({ job }: { job: Job }) {
  const { state, dispatch } = useStore();
  const me = state.user!;
  const [text, setText] = useState("");
  const hist = [...job.history].reverse();
  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)", gap: 24 }}>
      <section>
        <h3 style={{ fontSize: "var(--fs-20)", fontWeight: 700, marginBottom: 12 }}>Notes</h3>
        <div className="rows">
          {job.notes.length === 0 && (
            <Outline minHeight={88}>
              <span>No notes yet. Anything the next station should know goes here.</span>
            </Outline>
          )}
          {[...job.notes].reverse().map((n, i) => (
            <div key={i} className="ticket" style={{ padding: 16 }}>
              <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 6 }}>
                <Avatar initials={person(n.by)?.initials ?? "?"} small />
                <strong>{personName(n.by)}</strong>
                <span className="muted" style={{ fontSize: "var(--fs-14)" }}>{relTime(n.at)}</span>
              </div>
              <p style={{ fontSize: "var(--fs-18)" }}>{n.text}</p>
            </div>
          ))}
        </div>
        <form
          style={{ marginTop: 16, display: "grid", gap: 10 }}
          onSubmit={(e) => {
            e.preventDefault();
            if (!text.trim()) return;
            dispatch({ type: "note", jobId: job.id, text: text.trim(), by: me.id });
            setText("");
          }}
        >
          <label htmlFor="note" className="sr-only">
            Add a note
          </label>
          <textarea id="note" className="textarea" placeholder="Add a note for the next station" value={text} onChange={(e) => setText(e.target.value)} style={{ minHeight: 88 }} />
          <Btn type="submit" size="lg" disabled={!text.trim()} style={{ justifySelf: "start" }}>
            Add note
          </Btn>
        </form>
      </section>
      <section>
        <h3 style={{ fontSize: "var(--fs-20)", fontWeight: 700, marginBottom: 12 }}>History</h3>
        <ol className="hist">
          {hist.map((h, i) => (
            <li key={i}>
              <time dateTime={h.at}>{fmtDate(h.at.slice(0, 10))}</time>
              <span>
                {h.text} <span className="muted">by {personName(h.by)}</span>
              </span>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}

/* ---------- Raise a drawing query ---------- */
function QuerySheet({ open, onClose, job }: { open: boolean; onClose: () => void; job: Job }) {
  const { state, dispatch } = useStore();
  const me = state.user!;
  const [note, setNote] = useState("");
  const [photo, setPhoto] = useState(false);
  const [touched, setTouched] = useState(false);
  const send = () => {
    setTouched(true);
    if (!note.trim()) return;
    dispatch({ type: "query", jobId: job.id, note: note.trim(), by: me.id, photo });
    dispatch({ type: "toast", text: `${job.id} sent to Drawing Review`, paint: paint("review") });
    setNote("");
    setPhoto(false);
    setTouched(false);
    onClose();
  };
  return (
    <Sheet open={open} onClose={onClose} title={`Raise a drawing query on ${job.id}`}>
      <p style={{ fontSize: "var(--fs-18)", color: "var(--ink-2)", marginBottom: 20, maxWidth: "65ch" }}>
        This sends the job to Drawing Review. Work can carry on at {stageLabel(job.stage)}, but it won't pass on until Steve has answered and uploaded a revised drawing if one's needed.
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 260px", gap: 24 }}>
        <div className="field">
          <label htmlFor="q">What's wrong with the drawing?</label>
          <textarea
            id="q"
            className="textarea"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="For example: back panel height on rev C doesn't match the carcass. 2100 on the elevation, 2050 on the plan."
            style={{ minHeight: 150 }}
            aria-invalid={touched && !note.trim()}
          />
          {touched && !note.trim() ? <span className="error-text">Say what the problem is, so Steve knows what to check.</span> : <span className="help">Dimensions and which view you were looking at help most.</span>}
        </div>
        <div className="field">
          <span style={{ fontWeight: 600 }}>Photo (optional)</span>
          <button
            type="button"
            className={photo ? "ticket" : "outline"}
            onClick={() => setPhoto(!photo)}
            aria-pressed={photo}
            style={{ minHeight: 150, display: "grid", placeItems: "center", textAlign: "center", padding: 16, width: "100%" }}
          >
            {photo ? (
              <span style={{ display: "grid", gap: 8, placeItems: "center" }}>
                <span style={{ width: 160, height: 90, borderRadius: 4, background: "linear-gradient(135deg, var(--ink-3), var(--ink))" }} aria-hidden />
                <span style={{ fontWeight: 600 }}>IMG_2041.jpg attached</span>
                <span className="help">Tap to remove</span>
              </span>
            ) : (
              <span style={{ display: "grid", gap: 6, placeItems: "center", color: "var(--ink-2)" }}>
                <Camera size={40} weight="bold" />
                <span style={{ fontWeight: 600 }}>Add a photo</span>
                <span className="help">Uses the tablet camera</span>
              </span>
            )}
          </button>
        </div>
      </div>
      <div style={{ display: "flex", gap: 12, marginTop: 24, flexWrap: "wrap" }}>
        <Btn kind="paint" stage="review" size="xl" onClick={send} style={{ flex: 1 }}>
          Send to Drawing Review
          <ArrowRight size={26} weight="bold" />
        </Btn>
        <Btn kind="ghost" size="xl" onClick={onClose}>
          Cancel
        </Btn>
      </div>
    </Sheet>
  );
}
