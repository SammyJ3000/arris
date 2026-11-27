// Full-screen drawing viewer. The current revision opens by default and draws itself
// in. Superseded revisions can be viewed but say so, loudly.

import { useEffect, useState } from "react";
import { Sheet } from "../components/Sheet";
import { ReceptionDesk, DrawingFrame } from "../drawing/ReceptionDesk";
import { currentDrawing, formatDate, useStore } from "../store";
import { navigate } from "../router";
import { RevMark } from "../components/primitives";

export function DrawingViewer({ jobId, rev }: { jobId: string; rev?: string }) {
  const { state, person } = useStore();
  const job = state.jobs.find((j) => j.id === jobId);
  const [drawn, setDrawn] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setDrawn(true));
    return () => cancelAnimationFrame(id);
  }, [jobId, rev]);

  if (!job) return null;
  const drawings = job.files.filter((f) => f.category === "drawing").sort((a, b) => (a.revision ?? "").localeCompare(b.revision ?? ""));
  const current = currentDrawing(job);
  const showing = drawings.find((f) => f.revision === rev) ?? current ?? drawings[0];
  if (!showing) return null;
  const isSuperseded = !!showing.superseded;
  const svgRev: "B" | "C" = showing.revision === "B" ? "B" : "C";

  return (
    <Sheet
      title={`${showing.name}, Rev ${showing.revision}`}
      jobNo={job.id}
      rev={showing.revision}
      revSuperseded={isSuperseded}
      scale="1:20 @ A3"
      back={`/job/${job.id}`}
      backLabel={job.id}
      className="sheet--viewer"
      dense
      headRight={
        <div className="revswitch" role="group" aria-label="Revision">
          {drawings.map((f) => (
            <button
              key={f.id}
              type="button"
              className={`revswitch__btn ${f.id === showing.id ? "is-on" : ""} ${f.superseded ? "is-superseded" : ""}`}
              onClick={() => navigate(`/job/${job.id}/drawing${f.superseded ? `?rev=${f.revision}` : ""}`)}
              aria-pressed={f.id === showing.id}
            >
              <RevMark rev={f.revision} size={26} superseded={f.superseded} tone={f.superseded ? "ink" : "blue"} />
              <span>
                Rev {f.revision}
                <span className="revswitch__meta">{f.superseded ? "Superseded" : "Current"}</span>
              </span>
            </button>
          ))}
        </div>
      }
    >
      <div className="viewer">
        {isSuperseded && (
          <div className="viewer__warn" role="alert">
            <strong>Rev {showing.revision} is superseded.</strong> Do not cut to it. Rev {current?.revision} was approved {current && formatDate(current.uploadedAt)} by{" "}
            {current && person(current.uploadedBy)?.name}.
            <button type="button" className="link-btn link-btn--sm" onClick={() => navigate(`/job/${job.id}/drawing`)}>
              Show Rev {current?.revision}
            </button>
          </div>
        )}
        <DrawingFrame>
          <ReceptionDesk rev={svgRev} drawn={drawn} />
        </DrawingFrame>
        <p className="viewer__note">
          Prototype: this drawing is drawn as SVG. In the real app this is the uploaded PDF, {(showing.sizeBytes / 1_000_000).toFixed(1)} MB, cached on the tablet for when the wifi drops.
        </p>
      </div>
    </Sheet>
  );
}
