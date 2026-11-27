import * as Dialog from "@radix-ui/react-dialog";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowsOut, Minus, Plus, X } from "@phosphor-icons/react";
import { useEffect, useState } from "react";
import type { Job, JobFile } from "../shared/domain";
import { shortDate, firstName } from "../state/store";
import { ReceptionDeskDrawing } from "./Drawing";

export function DrawingViewer({
  job,
  file,
  onClose,
  onPick,
}: {
  job: Job;
  file: JobFile | null;
  onClose: () => void;
  onPick: (f: JobFile) => void;
}) {
  const reduce = useReducedMotion();
  const [zoom, setZoom] = useState(1);
  const drawings = job.files.filter((f) => f.category === "drawing").sort((a, b) => (a.revision ?? "").localeCompare(b.revision ?? "")).reverse();
  const current = drawings.find((f) => !f.superseded);
  useEffect(() => setZoom(1), [file?.id]);

  return (
    <AnimatePresence>
      {file && (
        <Dialog.Root open onOpenChange={(o) => !o && onClose()}>
          <Dialog.Portal forceMount>
            <Dialog.Content asChild forceMount aria-describedby={undefined}>
              <motion.div
                className="viewer"
                initial={reduce ? { opacity: 0 } : { opacity: 0, transform: "scale(0.98)" }}
                animate={{ opacity: 1, transform: "scale(1)" }}
                exit={reduce ? { opacity: 0 } : { opacity: 0, transform: "scale(0.985)" }}
                transition={{ type: "spring", duration: 0.4, bounce: 0 }}
              >
                <header className="viewer__bar">
                  <div className="viewer__meta">
                    <Dialog.Title className="viewer__title">{file.name}</Dialog.Title>
                    <span className="t-small t-muted">
                      Revision {file.revision}, uploaded {shortDate(file.uploadedAt)} by {firstName(file.uploadedBy)}
                    </span>
                  </div>
                  <div className="viewer__revs" role="tablist" aria-label="Revisions">
                    {drawings.map((d) => (
                      <button
                        key={d.id}
                        role="tab"
                        aria-selected={d.id === file.id}
                        className={`rev-tab ${d.id === file.id ? "rev-tab--on" : ""} ${d.superseded ? "rev-tab--old" : ""}`}
                        onClick={() => onPick(d)}
                      >
                        Rev {d.revision}
                        {d.superseded && <span className="rev-tab__note">superseded</span>}
                      </button>
                    ))}
                  </div>
                  <div className="viewer__tools">
                    <button className="icon-btn" aria-label="Zoom out" onClick={() => setZoom((z) => Math.max(0.6, z - 0.25))}>
                      <Minus size={22} />
                    </button>
                    <button className="icon-btn" aria-label="Fit to screen" onClick={() => setZoom(1)}>
                      <ArrowsOut size={22} />
                    </button>
                    <button className="icon-btn" aria-label="Zoom in" onClick={() => setZoom((z) => Math.min(3, z + 0.25))}>
                      <Plus size={22} />
                    </button>
                    <Dialog.Close asChild>
                      <button className="icon-btn icon-btn--strong" aria-label="Close drawing">
                        <X size={24} />
                      </button>
                    </Dialog.Close>
                  </div>
                </header>
                {file.superseded && current && (
                  <div className="viewer__warn" role="alert">
                    Revision {file.revision} was superseded by revision {current.revision} on {shortDate(current.uploadedAt)}. Do not build from this sheet.
                  </div>
                )}
                <div className="viewer__stage">
                  <motion.div
                    className="viewer__sheet"
                    animate={{ transform: `scale(${zoom})` }}
                    transition={reduce ? { duration: 0 } : { type: "spring", duration: 0.45, bounce: 0 }}
                  >
                    <ReceptionDeskDrawing revision={file.revision ?? "A"} superseded={file.superseded} title={`${job.client}, ${job.piece.toLowerCase()}`} sheetRef={job.ref} />
                  </motion.div>
                </div>
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      )}
    </AnimatePresence>
  );
}
